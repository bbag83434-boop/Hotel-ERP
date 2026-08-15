import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { ApprovalService } from './approval.service';
import { Prisma } from '@prisma/client';

export type WastageType =
  | 'EXPIRED'
  | 'SPOILED'
  | 'DAMAGED'
  | 'WRONG_PREPARATION'
  | 'OVERPRODUCTION'
  | 'RETURNED_DISCARDED'
  | 'PRODUCTION_LOSS';

export interface RecordWastageItem {
  itemId: string;
  quantity: number;
  batchNumber?: string;
  reason?: string;
}

export interface RecordWastageParams {
  companyId: string;
  branchId: string;
  warehouseId: string;
  wastageType: WastageType;
  reason: string;
  items: RecordWastageItem[];
  actorId: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class WastageService {
  public static readonly APPROVAL_THRESHOLD = 500.0; // $500 threshold requires manager approval

  public static async recordWastage(params: RecordWastageParams) {
    const { companyId, branchId, warehouseId, wastageType, reason, items, actorId, notes, ipAddress, userAgent } = params;

    if (!items || items.length === 0) {
      throw new AppError('At least one item must be specified for wastage recording', 400);
    }

    const [warehouse, user] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
      prisma.user.findFirst({ where: { id: actorId } })
    ]);

    if (!warehouse) throw new AppError('Invalid warehouse', 404);
    if (!user) throw new AppError('Invalid user', 404);

    return prisma.$transaction(async (tx) => {
      const wastageCount = await tx.stockLedger.count({
        where: { referenceType: 'WASTAGE' }
      });
      const adjustmentNumber = `WST-${new Date().getFullYear()}-${String(wastageCount + 1).padStart(5, '0')}`;

      // 1. Fetch items to verify stock and unit cost
      let totalWastageValue = new Prisma.Decimal(0);
      const processedItems: Array<{
        item: any;
        quantity: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        totalCost: Prisma.Decimal;
        batchNumber?: string;
        reason?: string;
      }> = [];

      for (const line of items) {
        const qty = new Prisma.Decimal(line.quantity);
        if (qty.isZero() || qty.isNegative()) {
          throw new AppError('Wastage quantity must be greater than zero', 400);
        }

        const item = await tx.item.findFirst({
          where: { id: line.itemId, companyId }
        });
        if (!item) throw new AppError(`Item not found: ${line.itemId}`, 404);

        const currentBalance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: { warehouseId, itemId: line.itemId }
          }
        });

        if (!currentBalance || currentBalance.quantity.lessThan(qty)) {
          const available = currentBalance ? currentBalance.quantity.toString() : '0';
          throw new AppError(
            `Insufficient stock to record wastage for "${item.name}". Available: ${available}, Wastage requested: ${qty}`,
            400
          );
        }

        const lineTotal = qty.times(item.costPrice);
        totalWastageValue = totalWastageValue.plus(lineTotal);

        processedItems.push({
          item,
          quantity: qty,
          unitCost: item.costPrice,
          totalCost: lineTotal,
          batchNumber: line.batchNumber,
          reason: line.reason || reason
        });
      }

      // 2. Check approval threshold
      const requiresApproval = totalWastageValue.greaterThan(this.APPROVAL_THRESHOLD);
      const status = requiresApproval ? 'PENDING_APPROVAL' : 'APPLIED';

      const wastageSummary = {
        adjustmentNumber,
        wastageType,
        reason: `[${wastageType}] ${reason}`,
        totalValue: totalWastageValue,
        status,
        warehouseName: warehouse.name,
        createdById: actorId,
        items: processedItems.map((p) => ({
          itemId: p.item.id,
          itemName: p.item.name,
          itemCode: p.item.code,
          quantity: p.quantity,
          unitCost: p.unitCost,
          totalCost: p.totalCost,
          batchNumber: p.batchNumber,
          reason: p.reason
        }))
      };

      // 3. If under threshold, apply stock deduction & GL postings immediately
      if (!requiresApproval) {
        for (const line of processedItems) {
          // Decrement StockBalance
          const updatedBalance = await tx.stockBalance.update({
            where: {
              warehouseId_itemId: { warehouseId, itemId: line.item.id }
            },
            data: {
              quantity: { decrement: line.quantity }
            }
          });

          // Write Immutable StockLedger Entry
          await tx.stockLedger.create({
            data: {
              warehouseId,
              itemId: line.item.id,
              batchNumber: line.batchNumber,
              movementType: 'ADJUSTMENT',
              changeQty: line.quantity.negated(),
              balanceQty: updatedBalance.quantity,
              unitCost: line.unitCost,
              totalCost: line.totalCost,
              referenceType: 'WASTAGE',
              referenceId: adjustmentNumber,
              notes: `[${wastageType}] ${line.reason || reason} (${adjustmentNumber})`,
              createdById: actorId
            }
          });
        }

        // Post Balanced Double-Entry Journal Entry
        // Debit: [5030] Food Wastage Loss ($totalValue)
        // Credit: [1050] Raw Materials Inventory ($totalValue)
        try {
          const [lossAccount, inventoryAccount] = await Promise.all([
            tx.chartOfAccount.findFirst({ where: { companyId, code: '5030' } }) ||
              tx.chartOfAccount.findFirst({ where: { companyId, code: '5020' } }),
            tx.chartOfAccount.findFirst({ where: { companyId, code: '1050' } }) ||
              tx.chartOfAccount.findFirst({ where: { companyId, code: '1010' } })
          ]);

          if (lossAccount && inventoryAccount) {
            const count = await tx.journalEntry.count({ where: { companyId } });
            const entryNumber = `JE-WST-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

            const je = await tx.journalEntry.create({
              data: {
                companyId,
                branchId,
                entryNumber,
                referenceType: 'STOCK_WASTAGE',
                referenceId: adjustmentNumber,
                narration: `Inventory loss written off: [${wastageType}] ${reason} (${adjustmentNumber})`,
                status: 'POSTED',
                totalDebit: totalWastageValue,
                totalCredit: totalWastageValue,
                createdById: actorId
              }
            });

            await tx.journalEntryLine.createMany({
              data: [
                {
                  journalEntryId: je.id,
                  accountId: lossAccount.id,
                  debit: totalWastageValue,
                  credit: new Prisma.Decimal(0),
                  narration: `Wastage loss expense for ${adjustmentNumber}`
                },
                {
                  journalEntryId: je.id,
                  accountId: inventoryAccount.id,
                  debit: new Prisma.Decimal(0),
                  credit: totalWastageValue,
                  narration: `Inventory write-down for ${adjustmentNumber}`
                }
              ]
            });

            await tx.chartOfAccount.update({
              where: { id: lossAccount.id },
              data: { balance: { increment: totalWastageValue } }
            });
            await tx.chartOfAccount.update({
              where: { id: inventoryAccount.id },
              data: { balance: { decrement: totalWastageValue } }
            });
          }
        } catch (glErr) {
          console.warn('Wastage GL journal posting notice:', glErr);
        }
      } else {
        // Create Approval Request in Approval Center
        try {
          await ApprovalService.createApprovalRequest(
            companyId,
            {
              branchId,
              transactionType: 'EXPENSE',
              referenceId: adjustmentNumber,
              amount: totalWastageValue.toNumber(),
              title: `High Wastage Authorization #${adjustmentNumber} ($${totalWastageValue})`,
              description: `Wastage type: ${wastageType}. Reason: ${reason}. Warehouse: ${warehouse.name}`
            },
            actorId,
            ipAddress,
            userAgent
          );
        } catch (err) {
          console.warn('Wastage auto-approval notice:', err);
        }
      }

      await AuditService.log({
        userId: actorId,
        action: 'WASTAGE_RECORDED',
        entity: 'WastageRecord',
        entityId: adjustmentNumber,
        details: {
          adjustmentNumber,
          wastageType,
          totalValue: totalWastageValue.toString(),
          requiresApproval,
          status
        },
        ipAddress,
        userAgent
      });

      return {
        wastage: wastageSummary,
        requiresApproval,
        status,
        message: requiresApproval
          ? `Wastage exceeds $${this.APPROVAL_THRESHOLD} threshold and is pending manager approval`
          : 'Wastage recorded, inventory deducted, and loss posted successfully'
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getWastageRecords(
    companyId: string,
    params: { warehouseId?: string; page?: number; limit?: number }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StockLedgerWhereInput = {
      referenceType: 'WASTAGE',
      warehouse: {
        companyId,
        ...(params.warehouseId ? { id: params.warehouseId } : {})
      }
    };

    const [total, entries] = await Promise.all([
      prisma.stockLedger.count({ where }),
      prisma.stockLedger.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { ApprovalService } from './approval.service';
import { Prisma } from '@prisma/client';

export interface PhysicalCountItemInput {
  itemId: string;
  countedQty: number;
  notes?: string;
}

export interface SubmitStockCountParams {
  companyId: string;
  branchId: string;
  warehouseId: string;
  countedItems: PhysicalCountItemInput[];
  notes?: string;
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

export class StockCountService {
  public static readonly VARIANCE_APPROVAL_THRESHOLD = 200.0; // $200 threshold requires manager approval

  public static async reconcilePhysicalCount(params: SubmitStockCountParams) {
    const { companyId, branchId, warehouseId, countedItems, notes, actorId, ipAddress, userAgent } = params;

    if (!countedItems || countedItems.length === 0) {
      throw new AppError('At least one item must be included in the physical count', 400);
    }

    const [warehouse, user] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
      prisma.user.findFirst({ where: { id: actorId } })
    ]);

    if (!warehouse) throw new AppError('Invalid warehouse', 404);
    if (!user) throw new AppError('Invalid user', 404);

    return prisma.$transaction(async (tx) => {
      const countIndex = await tx.stockLedger.count({ where: { referenceType: 'STOCK_COUNT' } });
      const countNumber = `SC-${new Date().getFullYear()}-${String(countIndex + 1).padStart(5, '0')}`;

      let totalShrinkageValue = new Prisma.Decimal(0);
      let totalSurplusValue = new Prisma.Decimal(0);
      let totalAbsoluteVariance = new Prisma.Decimal(0);

      const reconciliationLines: Array<{
        item: any;
        systemQty: Prisma.Decimal;
        countedQty: Prisma.Decimal;
        varianceQty: Prisma.Decimal;
        unitCost: Prisma.Decimal;
        varianceValue: Prisma.Decimal;
        notes?: string;
      }> = [];

      for (const line of countedItems) {
        const counted = new Prisma.Decimal(line.countedQty);
        if (counted.isNegative()) {
          throw new AppError('Physical counted quantity cannot be negative', 400);
        }

        const item = await tx.item.findFirst({ where: { id: line.itemId, companyId } });
        if (!item) throw new AppError(`Item not found: ${line.itemId}`, 404);

        const currentStock = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: { warehouseId, itemId: line.itemId }
          }
        });

        const systemQty = currentStock ? currentStock.quantity : new Prisma.Decimal(0);
        const varianceQty = counted.minus(systemQty);
        const varianceValue = varianceQty.times(item.costPrice);

        totalAbsoluteVariance = totalAbsoluteVariance.plus(varianceValue.abs());

        if (varianceQty.isNegative()) {
          totalShrinkageValue = totalShrinkageValue.plus(varianceValue.abs());
        } else if (varianceQty.greaterThan(0)) {
          totalSurplusValue = totalSurplusValue.plus(varianceValue);
        }

        reconciliationLines.push({
          item,
          systemQty,
          countedQty: counted,
          varianceQty,
          unitCost: item.costPrice,
          varianceValue,
          notes: line.notes
        });
      }

      // Check approval threshold
      const requiresApproval = totalAbsoluteVariance.greaterThan(this.VARIANCE_APPROVAL_THRESHOLD);
      const status = requiresApproval ? 'PENDING_APPROVAL' : 'APPLIED';

      // If within tolerance, apply stock adjustment & GL postings immediately
      if (!requiresApproval) {
        for (const line of reconciliationLines) {
          if (line.varianceQty.isZero()) continue;

          // 1. Update StockBalance to match countedQty
          const updatedBalance = await tx.stockBalance.upsert({
            where: {
              warehouseId_itemId: { warehouseId, itemId: line.item.id }
            },
            update: { quantity: line.countedQty },
            create: {
              warehouseId,
              itemId: line.item.id,
              quantity: line.countedQty
            }
          });

          // 2. Write Immutable StockLedger Entry
          await tx.stockLedger.create({
            data: {
              warehouseId,
              itemId: line.item.id,
              movementType: 'ADJUSTMENT',
              changeQty: line.varianceQty,
              balanceQty: updatedBalance.quantity,
              unitCost: line.unitCost,
              totalCost: line.varianceValue.abs(),
              referenceType: 'STOCK_COUNT',
              referenceId: countNumber,
              notes: `Physical Reconciliation #${countNumber} (System: ${line.systemQty}, Counted: ${line.countedQty}, Variance: ${line.varianceQty})`,
              createdById: actorId
            }
          });
        }

        // 3. Post Balanced General Ledger Journal for Shrinkage / Surplus
        try {
          const [shrinkageAccount, surplusAccount, inventoryAccount] = await Promise.all([
            tx.chartOfAccount.findFirst({ where: { companyId, code: '5040' } }) ||
              tx.chartOfAccount.findFirst({ where: { companyId, code: '5030' } }),
            tx.chartOfAccount.findFirst({ where: { companyId, code: '4030' } }) ||
              tx.chartOfAccount.findFirst({ where: { companyId, code: '4010' } }),
            tx.chartOfAccount.findFirst({ where: { companyId, code: '1050' } }) ||
              tx.chartOfAccount.findFirst({ where: { companyId, code: '1010' } })
          ]);

          if (inventoryAccount) {
            // A. Post Shrinkage Journal if any
            if (totalShrinkageValue.greaterThan(0) && shrinkageAccount) {
              const count = await tx.journalEntry.count({ where: { companyId } });
              const entryNumber = `JE-SHRINK-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

              const je = await tx.journalEntry.create({
                data: {
                  companyId,
                  branchId,
                  entryNumber,
                  referenceType: 'STOCK_RECONCILIATION',
                  referenceId: countNumber,
                  narration: `Stock Count Shrinkage Loss (${countNumber}) in ${warehouse.name}`,
                  status: 'POSTED',
                  totalDebit: totalShrinkageValue,
                  totalCredit: totalShrinkageValue,
                  createdById: actorId
                }
              });

              await tx.journalEntryLine.createMany({
                data: [
                  {
                    journalEntryId: je.id,
                    accountId: shrinkageAccount.id,
                    debit: totalShrinkageValue,
                    credit: new Prisma.Decimal(0),
                    narration: `Shrinkage Loss for ${countNumber}`
                  },
                  {
                    journalEntryId: je.id,
                    accountId: inventoryAccount.id,
                    debit: new Prisma.Decimal(0),
                    credit: totalShrinkageValue,
                    narration: `Inventory write-down for ${countNumber}`
                  }
                ]
              });

              await tx.chartOfAccount.update({
                where: { id: shrinkageAccount.id },
                data: { balance: { increment: totalShrinkageValue } }
              });
              await tx.chartOfAccount.update({
                where: { id: inventoryAccount.id },
                data: { balance: { decrement: totalShrinkageValue } }
              });
            }

            // B. Post Surplus Journal if any
            if (totalSurplusValue.greaterThan(0) && surplusAccount) {
              const count = await tx.journalEntry.count({ where: { companyId } });
              const entryNumber = `JE-GAIN-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

              const je = await tx.journalEntry.create({
                data: {
                  companyId,
                  branchId,
                  entryNumber,
                  referenceType: 'STOCK_RECONCILIATION',
                  referenceId: countNumber,
                  narration: `Stock Count Inventory Surplus Gain (${countNumber}) in ${warehouse.name}`,
                  status: 'POSTED',
                  totalDebit: totalSurplusValue,
                  totalCredit: totalSurplusValue,
                  createdById: actorId
                }
              });

              await tx.journalEntryLine.createMany({
                data: [
                  {
                    journalEntryId: je.id,
                    accountId: inventoryAccount.id,
                    debit: totalSurplusValue,
                    credit: new Prisma.Decimal(0),
                    narration: `Inventory write-up for ${countNumber}`
                  },
                  {
                    journalEntryId: je.id,
                    accountId: surplusAccount.id,
                    debit: new Prisma.Decimal(0),
                    credit: totalSurplusValue,
                    narration: `Surplus Gain for ${countNumber}`
                  }
                ]
              });

              await tx.chartOfAccount.update({
                where: { id: inventoryAccount.id },
                data: { balance: { increment: totalSurplusValue } }
              });
              await tx.chartOfAccount.update({
                where: { id: surplusAccount.id },
                data: { balance: { increment: totalSurplusValue } }
              });
            }
          }
        } catch (glErr) {
          console.warn('Physical count GL journal posting notice:', glErr);
        }
      } else {
        // Route to Approval Center
        try {
          await ApprovalService.createApprovalRequest(
            companyId,
            {
              branchId,
              transactionType: 'EXPENSE',
              referenceId: countNumber,
              amount: totalAbsoluteVariance.toNumber(),
              title: `Physical Stock Count Variance Authorization #${countNumber} ($${totalAbsoluteVariance})`,
              description: `Variance in ${warehouse.name}. Shrinkage: $${totalShrinkageValue}, Surplus: $${totalSurplusValue}`
            },
            actorId,
            ipAddress,
            userAgent
          );
        } catch (err) {
          console.warn('Stock count approval request notice:', err);
        }
      }

      await AuditService.log({
        userId: actorId,
        action: 'STOCK_COUNT_RECONCILED',
        entity: 'StockCount',
        entityId: countNumber,
        details: {
          countNumber,
          warehouse: warehouse.name,
          totalAbsoluteVariance: totalAbsoluteVariance.toString(),
          totalShrinkageValue: totalShrinkageValue.toString(),
          totalSurplusValue: totalSurplusValue.toString(),
          requiresApproval,
          status
        },
        ipAddress,
        userAgent
      });

      return {
        countNumber,
        warehouseName: warehouse.name,
        totalItemsCounted: countedItems.length,
        totalAbsoluteVariance,
        totalShrinkageValue,
        totalSurplusValue,
        requiresApproval,
        status,
        lines: reconciliationLines.map((l) => ({
          itemId: l.item.id,
          itemName: l.item.name,
          itemCode: l.item.code,
          systemQty: l.systemQty,
          countedQty: l.countedQty,
          varianceQty: l.varianceQty,
          varianceValue: l.varianceValue
        })),
        message: requiresApproval
          ? `Stock variance exceeds $${this.VARIANCE_APPROVAL_THRESHOLD} threshold and is pending manager approval`
          : `Physical stock count #${countNumber} reconciled and inventory adjusted successfully`
      };
    }, { maxWait: 10000, timeout: 30000 });
  }

  public static async getStockCountHistory(companyId: string, params: { warehouseId?: string }) {
    return prisma.stockLedger.findMany({
      where: {
        referenceType: 'STOCK_COUNT',
        warehouse: {
          companyId,
          ...(params.warehouseId ? { id: params.warehouseId } : {})
        }
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

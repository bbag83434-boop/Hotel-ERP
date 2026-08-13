import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { Prisma, ItemType, StockMovementType } from '@prisma/client';

export class InventoryService {
  // -------------------------------------------------------------
  // CATEGORIES & UNITS
  // -------------------------------------------------------------

  public static async getCategories(companyId: string) {
    return prisma.category.findMany({
      where: { companyId },
      include: {
        _count: { select: { items: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  public static async createCategory(
    companyId: string,
    data: { name: string; code: string; description?: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.category.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Category with code "${data.code}" already exists`, 400);
    }

    const category = await prisma.category.create({
      data: {
        companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'INVENTORY_CATEGORY_CREATE',
      entity: 'Category',
      entityId: category.id,
      details: { name: category.name, code: category.code },
      ipAddress,
      userAgent
    });

    return category;
  }

  public static async getUnits(companyId: string) {
    return prisma.unit.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });
  }

  public static async createUnit(
    companyId: string,
    data: { name: string; symbol: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.unit.findFirst({
      where: { companyId, symbol: data.symbol }
    });
    if (existing) {
      throw new AppError(`Unit with symbol "${data.symbol}" already exists`, 400);
    }

    const unit = await prisma.unit.create({
      data: {
        companyId,
        name: data.name,
        symbol: data.symbol.toLowerCase()
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'INVENTORY_UNIT_CREATE',
      entity: 'Unit',
      entityId: unit.id,
      details: { name: unit.name, symbol: unit.symbol },
      ipAddress,
      userAgent
    });

    return unit;
  }

  // -------------------------------------------------------------
  // ITEMS / PRODUCTS MASTER
  // -------------------------------------------------------------

  public static async getItems(
    companyId: string,
    params: {
      search?: string;
      categoryId?: string;
      type?: ItemType;
      isActive?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ItemWhereInput = {
      companyId,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search, mode: 'insensitive' } },
              { barcode: { contains: params.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [total, items] = await Promise.all([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, name: true, symbol: true } },
          stockBalances: {
            include: {
              warehouse: { select: { id: true, name: true, code: true } }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      })
    ]);

    // Calculate total on-hand stock for convenience
    const itemsWithTotalStock = items.map((item) => {
      const totalStock = item.stockBalances.reduce(
        (sum, sb) => sum.plus(sb.quantity),
        new Prisma.Decimal(0)
      );
      const isLowStock = totalStock.lessThanOrEqualTo(item.minStockLevel);
      return {
        ...item,
        totalStock,
        isLowStock
      };
    });

    return {
      items: itemsWithTotalStock,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  public static async getItemById(companyId: string, id: string) {
    const item = await prisma.item.findFirst({
      where: { id, companyId },
      include: {
        category: true,
        unit: true,
        stockBalances: {
          include: {
            warehouse: true
          }
        }
      }
    });

    if (!item) {
      throw new AppError('Item not found', 404);
    }

    return item;
  }

  public static async createItem(
    companyId: string,
    data: {
      name: string;
      code: string;
      barcode?: string;
      categoryId: string;
      unitId: string;
      type?: ItemType;
      description?: string;
      costPrice?: number;
      sellingPrice?: number;
      minStockLevel?: number;
      reorderQty?: number;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.item.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Item with code "${data.code}" already exists`, 400);
    }

    const item = await prisma.item.create({
      data: {
        companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        barcode: data.barcode,
        categoryId: data.categoryId,
        unitId: data.unitId,
        type: data.type || 'RAW_MATERIAL',
        description: data.description,
        costPrice: new Prisma.Decimal(data.costPrice || 0),
        sellingPrice: new Prisma.Decimal(data.sellingPrice || 0),
        minStockLevel: new Prisma.Decimal(data.minStockLevel || 0),
        reorderQty: new Prisma.Decimal(data.reorderQty || 0)
      },
      include: {
        category: true,
        unit: true
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'INVENTORY_ITEM_CREATE',
      entity: 'Item',
      entityId: item.id,
      details: { name: item.name, code: item.code, type: item.type },
      ipAddress,
      userAgent
    });

    return item;
  }

  public static async updateItem(
    companyId: string,
    id: string,
    data: Partial<{
      name: string;
      code: string;
      barcode: string;
      categoryId: string;
      unitId: string;
      type: ItemType;
      description: string;
      costPrice: number;
      sellingPrice: number;
      minStockLevel: number;
      reorderQty: number;
      isActive: boolean;
    }>,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.item.findFirst({
      where: { id, companyId }
    });
    if (!existing) {
      throw new AppError('Item not found', 404);
    }

    if (data.code && data.code !== existing.code) {
      const codeTaken = await prisma.item.findFirst({
        where: { companyId, code: data.code, id: { not: id } }
      });
      if (codeTaken) {
        throw new AppError(`Item code "${data.code}" is already in use`, 400);
      }
    }

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.code ? { code: data.code.toUpperCase() } : {}),
        ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.unitId ? { unitId: data.unitId } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.costPrice !== undefined ? { costPrice: new Prisma.Decimal(data.costPrice) } : {}),
        ...(data.sellingPrice !== undefined ? { sellingPrice: new Prisma.Decimal(data.sellingPrice) } : {}),
        ...(data.minStockLevel !== undefined ? { minStockLevel: new Prisma.Decimal(data.minStockLevel) } : {}),
        ...(data.reorderQty !== undefined ? { reorderQty: new Prisma.Decimal(data.reorderQty) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      },
      include: {
        category: true,
        unit: true
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'INVENTORY_ITEM_UPDATE',
      entity: 'Item',
      entityId: id,
      details: { before: existing, after: updated },
      ipAddress,
      userAgent
    });

    return updated;
  }

  // -------------------------------------------------------------
  // WAREHOUSES
  // -------------------------------------------------------------

  public static async getWarehouses(companyId: string, branchId?: string) {
    return prisma.warehouse.findMany({
      where: {
        companyId,
        ...(branchId ? { OR: [{ branchId }, { isCentral: true }] } : {})
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { stockBalances: true } }
      },
      orderBy: [{ isCentral: 'desc' }, { name: 'asc' }]
    });
  }

  public static async createWarehouse(
    companyId: string,
    data: { name: string; code: string; branchId?: string | null; isCentral?: boolean; address?: string },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.warehouse.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Warehouse code "${data.code}" already exists`, 400);
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId,
        name: data.name,
        code: data.code.toUpperCase(),
        branchId: data.branchId || null,
        isCentral: data.isCentral || false,
        address: data.address
      }
    });

    await AuditService.log({
      userId: actorId,
      action: 'WAREHOUSE_CREATE',
      entity: 'Warehouse',
      entityId: warehouse.id,
      details: { name: warehouse.name, code: warehouse.code, isCentral: warehouse.isCentral },
      ipAddress,
      userAgent
    });

    return warehouse;
  }

  // -------------------------------------------------------------
  // STOCK BALANCES & REORDER ALERTS
  // -------------------------------------------------------------

  public static async getStockBalances(
    companyId: string,
    params: {
      warehouseId?: string;
      branchId?: string;
      lowStockOnly?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.StockBalanceWhereInput = {
      warehouse: {
        companyId,
        ...(params.warehouseId ? { id: params.warehouseId } : {}),
        ...(params.branchId ? { branchId: params.branchId } : {})
      },
      ...(params.search
        ? {
            item: {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } }
              ]
            }
          }
        : {})
    };

    const [total, balances] = await Promise.all([
      prisma.stockBalance.count({ where }),
      prisma.stockBalance.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true, isCentral: true } },
          item: {
            include: {
              unit: { select: { id: true, name: true, symbol: true } },
              category: { select: { id: true, name: true } }
            }
          }
        },
        skip,
        take: limit,
        orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }]
      })
    ]);

    const formattedBalances = balances.map((sb) => {
      const minStock = sb.minStockLevel ?? sb.item.minStockLevel;
      const reorderQty = sb.reorderQty ?? sb.item.reorderQty;
      const isLowStock = sb.quantity.lessThanOrEqualTo(minStock);
      const isOutOfStock = sb.quantity.isZero() || sb.quantity.isNegative();

      return {
        ...sb,
        minStock,
        reorderQty,
        isLowStock,
        isOutOfStock
      };
    });

    const finalBalances = params.lowStockOnly
      ? formattedBalances.filter((b) => b.isLowStock)
      : formattedBalances;

    return {
      balances: finalBalances,
      pagination: {
        page,
        limit,
        total: params.lowStockOnly ? finalBalances.length : total,
        totalPages: Math.ceil((params.lowStockOnly ? finalBalances.length : total) / limit)
      }
    };
  }

  // -------------------------------------------------------------
  // STOCK LEDGER (IMMUTABLE MOVEMENT AUDIT TRAIL)
  // -------------------------------------------------------------

  public static async getStockLedger(
    companyId: string,
    params: {
      warehouseId?: string;
      itemId?: string;
      movementType?: StockMovementType;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.StockLedgerWhereInput = {
      warehouse: {
        companyId,
        ...(params.warehouseId ? { id: params.warehouseId } : {})
      },
      ...(params.itemId ? { itemId: params.itemId } : {}),
      ...(params.movementType ? { movementType: params.movementType } : {})
    };

    const [total, entries] = await Promise.all([
      prisma.stockLedger.count({ where }),
      prisma.stockLedger.findMany({
        where,
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          item: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: { select: { symbol: true } }
            }
          },
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

  // -------------------------------------------------------------
  // STOCK TRANSFER (ATOMIC TRANSACTION: DECREASE SOURCE, INCREASE DEST)
  // -------------------------------------------------------------

  public static async transferStock(params: {
    companyId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    transferDate?: string;
    notes?: string;
    items: Array<{ itemId: string; quantity: number; notes?: string }>;
    actorId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { companyId, fromWarehouseId, toWarehouseId, items, actorId, ipAddress, userAgent } = params;

    if (fromWarehouseId === toWarehouseId) {
      throw new AppError('Source and destination warehouses cannot be the same', 400);
    }

    const [fromWh, toWh] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: fromWarehouseId, companyId } }),
      prisma.warehouse.findFirst({ where: { id: toWarehouseId, companyId } })
    ]);

    if (!fromWh || !toWh) {
      throw new AppError('Invalid source or destination warehouse', 404);
    }

    // Execute within Prisma atomic transaction
    return prisma.$transaction(async (tx) => {
      const transferCount = await tx.stockTransfer.count({ where: { companyId } });
      const transferNumber = `TRF-${new Date().getFullYear()}-${String(transferCount + 1).padStart(5, '0')}`;

      const transfer = await tx.stockTransfer.create({
        data: {
          companyId,
          fromWarehouseId,
          toWarehouseId,
          transferNumber,
          transferDate: params.transferDate ? new Date(params.transferDate) : new Date(),
          notes: params.notes,
          createdById: actorId,
          status: 'COMPLETED'
        }
      });

      for (const itemTransfer of items) {
        const transferQty = new Prisma.Decimal(itemTransfer.quantity);
        if (transferQty.isZero() || transferQty.isNegative()) {
          throw new AppError('Transfer quantity must be greater than zero', 400);
        }

        // 1. Source warehouse verification & balance update
        const fromBalance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_itemId: {
              warehouseId: fromWarehouseId,
              itemId: itemTransfer.itemId
            }
          },
          include: { item: true }
        });

        if (!fromBalance || fromBalance.quantity.lessThan(transferQty)) {
          const available = fromBalance ? fromBalance.quantity.toString() : '0';
          const itemName = fromBalance?.item?.name || itemTransfer.itemId;
          throw new AppError(
            `Insufficient stock for "${itemName}" in ${fromWh.name}. Available: ${available}, Requested: ${transferQty}`,
            400
          );
        }

        const newFromQty = fromBalance.quantity.minus(transferQty);
        await tx.stockBalance.update({
          where: { id: fromBalance.id },
          data: { quantity: newFromQty }
        });

        // 2. Destination warehouse balance update (upsert)
        const toBalance = await tx.stockBalance.upsert({
          where: {
            warehouseId_itemId: {
              warehouseId: toWarehouseId,
              itemId: itemTransfer.itemId
            }
          },
          update: {
            quantity: { increment: transferQty }
          },
          create: {
            warehouseId: toWarehouseId,
            itemId: itemTransfer.itemId,
            quantity: transferQty
          }
        });

        const newToQty = toBalance.quantity;

        // 3. Create Transfer Item record
        await tx.stockTransferItem.create({
          data: {
            transferId: transfer.id,
            itemId: itemTransfer.itemId,
            quantity: transferQty,
            unitCost: fromBalance.item.costPrice,
            notes: itemTransfer.notes
          }
        });

        // 4. Create immutable StockLedger entry for TRANSFER_OUT
        await tx.stockLedger.create({
          data: {
            warehouseId: fromWarehouseId,
            itemId: itemTransfer.itemId,
            movementType: 'TRANSFER_OUT',
            changeQty: transferQty.negated(),
            balanceQty: newFromQty,
            unitCost: fromBalance.item.costPrice,
            totalCost: transferQty.times(fromBalance.item.costPrice),
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            notes: `Transferred to ${toWh.name} (${transferNumber})`,
            createdById: actorId
          }
        });

        // 5. Create immutable StockLedger entry for TRANSFER_IN
        await tx.stockLedger.create({
          data: {
            warehouseId: toWarehouseId,
            itemId: itemTransfer.itemId,
            movementType: 'TRANSFER_IN',
            changeQty: transferQty,
            balanceQty: newToQty,
            unitCost: fromBalance.item.costPrice,
            totalCost: transferQty.times(fromBalance.item.costPrice),
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            notes: `Received from ${fromWh.name} (${transferNumber})`,
            createdById: actorId
          }
        });
      }

      await AuditService.log({
        userId: actorId,
        action: 'STOCK_TRANSFER_COMPLETED',
        entity: 'StockTransfer',
        entityId: transfer.id,
        details: {
          transferNumber,
          from: fromWh.name,
          to: toWh.name,
          itemCount: items.length
        },
        ipAddress,
        userAgent
      });

      return transfer;
    }, { maxWait: 10000, timeout: 30000 });
  }

  // -------------------------------------------------------------
  // STOCK ADJUSTMENT (OPENING BALANCE OR PHYSICAL RECONCILIATION)
  // -------------------------------------------------------------

  public static async adjustStock(params: {
    companyId: string;
    warehouseId: string;
    itemId: string;
    newQuantity: number;
    reason: string;
    actorId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { companyId, warehouseId, itemId, newQuantity, reason, actorId, ipAddress, userAgent } = params;

    const [wh, item] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
      prisma.item.findFirst({ where: { id: itemId, companyId } })
    ]);

    if (!wh || !item) {
      throw new AppError('Invalid warehouse or item', 404);
    }

    const targetQty = new Prisma.Decimal(newQuantity);
    if (targetQty.isNegative()) {
      throw new AppError('Stock quantity cannot be negative', 400);
    }

    return prisma.$transaction(async (tx) => {
      const currentBalance = await tx.stockBalance.findUnique({
        where: {
          warehouseId_itemId: { warehouseId, itemId }
        }
      });

      const oldQty = currentBalance ? currentBalance.quantity : new Prisma.Decimal(0);
      const diffQty = targetQty.minus(oldQty);

      if (diffQty.isZero()) {
        return currentBalance;
      }

      const updatedBalance = await tx.stockBalance.upsert({
        where: {
          warehouseId_itemId: { warehouseId, itemId }
        },
        update: { quantity: targetQty },
        create: {
          warehouseId,
          itemId,
          quantity: targetQty
        }
      });

      await tx.stockLedger.create({
        data: {
          warehouseId,
          itemId,
          movementType: 'ADJUSTMENT',
          changeQty: diffQty,
          balanceQty: targetQty,
          unitCost: item.costPrice,
          totalCost: diffQty.abs().times(item.costPrice),
          referenceType: 'ADJUSTMENT',
          notes: reason,
          createdById: actorId
        }
      });

      await AuditService.log({
        userId: actorId,
        action: 'STOCK_ADJUSTMENT',
        entity: 'StockBalance',
        entityId: updatedBalance.id,
        details: {
          warehouse: wh.name,
          item: item.name,
          oldQty: oldQty.toString(),
          newQty: targetQty.toString(),
          reason
        },
        ipAddress,
        userAgent
      });

      return updatedBalance;
    }, { maxWait: 10000, timeout: 30000 });
  }
}

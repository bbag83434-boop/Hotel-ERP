"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
const routing_service_1 = require("./routing.service");
const approval_service_1 = require("./approval.service");
const client_1 = require("@prisma/client");
class InventoryService {
    // -------------------------------------------------------------
    // CATEGORIES & UNITS
    // -------------------------------------------------------------
    static async getCategories(companyId) {
        return database_1.prisma.category.findMany({
            where: { companyId },
            include: {
                _count: { select: { items: true } }
            },
            orderBy: { name: 'asc' }
        });
    }
    static async createCategory(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.category.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Category with code "${data.code}" already exists`, 400);
        }
        const category = await database_1.prisma.category.create({
            data: {
                companyId,
                name: data.name,
                code: data.code.toUpperCase(),
                description: data.description
            }
        });
        await audit_service_1.AuditService.log({
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
    static async getUnits(companyId) {
        return database_1.prisma.unit.findMany({
            where: { companyId },
            orderBy: { name: 'asc' }
        });
    }
    static async createUnit(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.unit.findFirst({
            where: { companyId, symbol: data.symbol }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Unit with symbol "${data.symbol}" already exists`, 400);
        }
        const unit = await database_1.prisma.unit.create({
            data: {
                companyId,
                name: data.name,
                symbol: data.symbol.toLowerCase()
            }
        });
        await audit_service_1.AuditService.log({
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
    static async getItems(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
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
            database_1.prisma.item.count({ where }),
            database_1.prisma.item.findMany({
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
            const totalStock = item.stockBalances.reduce((sum, sb) => sum.plus(sb.quantity), new client_1.Prisma.Decimal(0));
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
    static async getItemById(companyId, id) {
        const item = await database_1.prisma.item.findFirst({
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
            throw new response_utils_1.AppError('Item not found', 404);
        }
        return item;
    }
    static async createItem(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.item.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Item with code "${data.code}" already exists`, 400);
        }
        const item = await database_1.prisma.item.create({
            data: {
                companyId,
                name: data.name,
                code: data.code.toUpperCase(),
                barcode: data.barcode,
                categoryId: data.categoryId,
                unitId: data.unitId,
                type: data.type || 'RAW_MATERIAL',
                description: data.description,
                costPrice: new client_1.Prisma.Decimal(data.costPrice || 0),
                sellingPrice: new client_1.Prisma.Decimal(data.sellingPrice || 0),
                minStockLevel: new client_1.Prisma.Decimal(data.minStockLevel || 0),
                reorderQty: new client_1.Prisma.Decimal(data.reorderQty || 0)
            },
            include: {
                category: true,
                unit: true
            }
        });
        await audit_service_1.AuditService.log({
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
    static async updateItem(companyId, id, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.item.findFirst({
            where: { id, companyId }
        });
        if (!existing) {
            throw new response_utils_1.AppError('Item not found', 404);
        }
        if (data.code && data.code !== existing.code) {
            const codeTaken = await database_1.prisma.item.findFirst({
                where: { companyId, code: data.code, id: { not: id } }
            });
            if (codeTaken) {
                throw new response_utils_1.AppError(`Item code "${data.code}" is already in use`, 400);
            }
        }
        const updated = await database_1.prisma.item.update({
            where: { id },
            data: {
                ...(data.name ? { name: data.name } : {}),
                ...(data.code ? { code: data.code.toUpperCase() } : {}),
                ...(data.barcode !== undefined ? { barcode: data.barcode } : {}),
                ...(data.categoryId ? { categoryId: data.categoryId } : {}),
                ...(data.unitId ? { unitId: data.unitId } : {}),
                ...(data.type ? { type: data.type } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.costPrice !== undefined ? { costPrice: new client_1.Prisma.Decimal(data.costPrice) } : {}),
                ...(data.sellingPrice !== undefined ? { sellingPrice: new client_1.Prisma.Decimal(data.sellingPrice) } : {}),
                ...(data.minStockLevel !== undefined ? { minStockLevel: new client_1.Prisma.Decimal(data.minStockLevel) } : {}),
                ...(data.reorderQty !== undefined ? { reorderQty: new client_1.Prisma.Decimal(data.reorderQty) } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
            },
            include: {
                category: true,
                unit: true
            }
        });
        await audit_service_1.AuditService.log({
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
    static async getWarehouses(companyId, branchId) {
        return database_1.prisma.warehouse.findMany({
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
    static async createWarehouse(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.warehouse.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Warehouse code "${data.code}" already exists`, 400);
        }
        const warehouse = await database_1.prisma.warehouse.create({
            data: {
                companyId,
                name: data.name,
                code: data.code.toUpperCase(),
                branchId: data.branchId || null,
                isCentral: data.isCentral || false,
                address: data.address
            }
        });
        await audit_service_1.AuditService.log({
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
    static async getStockBalances(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 25));
        const skip = (page - 1) * limit;
        const where = {
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
            database_1.prisma.stockBalance.count({ where }),
            database_1.prisma.stockBalance.findMany({
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
    static async getStockLedger(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 30));
        const skip = (page - 1) * limit;
        const where = {
            warehouse: {
                companyId,
                ...(params.warehouseId ? { id: params.warehouseId } : {})
            },
            ...(params.itemId ? { itemId: params.itemId } : {}),
            ...(params.movementType ? { movementType: params.movementType } : {})
        };
        const [total, entries] = await Promise.all([
            database_1.prisma.stockLedger.count({ where }),
            database_1.prisma.stockLedger.findMany({
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
    static async transferStock(params) {
        const { companyId, fromWarehouseId, toWarehouseId, items, actorId, ipAddress, userAgent } = params;
        if (fromWarehouseId === toWarehouseId) {
            throw new response_utils_1.AppError('Source and destination warehouses cannot be the same', 400);
        }
        const [fromWh, toWh] = await Promise.all([
            database_1.prisma.warehouse.findFirst({ where: { id: fromWarehouseId, companyId } }),
            database_1.prisma.warehouse.findFirst({ where: { id: toWarehouseId, companyId } })
        ]);
        if (!fromWh || !toWh) {
            throw new response_utils_1.AppError('Invalid source or destination warehouse', 404);
        }
        // Execute within Prisma atomic transaction
        return database_1.prisma.$transaction(async (tx) => {
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
                const transferQty = new client_1.Prisma.Decimal(itemTransfer.quantity);
                if (transferQty.isZero() || transferQty.isNegative()) {
                    throw new response_utils_1.AppError('Transfer quantity must be greater than zero', 400);
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
                    throw new response_utils_1.AppError(`Insufficient stock for "${itemName}" in ${fromWh.name}. Available: ${available}, Requested: ${transferQty}`, 400);
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
            await audit_service_1.AuditService.log({
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
    static async adjustStock(params) {
        const { companyId, warehouseId, itemId, newQuantity, reason, actorId, ipAddress, userAgent } = params;
        const [wh, item] = await Promise.all([
            database_1.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
            database_1.prisma.item.findFirst({ where: { id: itemId, companyId } })
        ]);
        if (!wh || !item) {
            throw new response_utils_1.AppError('Invalid warehouse or item', 404);
        }
        const targetQty = new client_1.Prisma.Decimal(newQuantity);
        if (targetQty.isNegative()) {
            throw new response_utils_1.AppError('Stock quantity cannot be negative', 400);
        }
        return database_1.prisma.$transaction(async (tx) => {
            const currentBalance = await tx.stockBalance.findUnique({
                where: {
                    warehouseId_itemId: { warehouseId, itemId }
                }
            });
            const oldQty = currentBalance ? currentBalance.quantity : new client_1.Prisma.Decimal(0);
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
            await audit_service_1.AuditService.log({
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
    // -------------------------------------------------------------
    // STORE REQUISITIONS & MULTI-STAGE WAREHOUSE TRANSFERS (PART 4)
    // -------------------------------------------------------------
    static parseRequisitionMetadata(rawNotes) {
        if (!rawNotes)
            return null;
        try {
            if (rawNotes.startsWith('{') && rawNotes.endsWith('}')) {
                return JSON.parse(rawNotes);
            }
        }
        catch {
            // Return null on malformed JSON
        }
        return null;
    }
    static async createRequisition(params) {
        const { companyId, fromWarehouseId, toWarehouseId, departmentId, section, priority = 'MEDIUM', notes, submitImmediately = false, items, actorId, actorRole, userBranchIds, ipAddress, userAgent } = params;
        if (fromWarehouseId === toWarehouseId) {
            throw new response_utils_1.AppError('Source and destination warehouses cannot be the same', 400);
        }
        const [fromWh, toWh] = await Promise.all([
            database_1.prisma.warehouse.findFirst({ where: { id: fromWarehouseId, companyId } }),
            database_1.prisma.warehouse.findFirst({ where: { id: toWarehouseId, companyId } })
        ]);
        if (!fromWh || !toWh) {
            throw new response_utils_1.AppError('Invalid source or destination warehouse', 404);
        }
        // Outlet / Branch Access Check
        if (userBranchIds &&
            userBranchIds.length > 0 &&
            toWh.branchId &&
            !userBranchIds.includes(toWh.branchId) &&
            actorRole !== 'Super Administrator') {
            throw new response_utils_1.AppError('Unauthorized: You do not have access to the destination outlet/branch', 403);
        }
        // Dynamic POC Resolution (No Hardcoding)
        const poc = await routing_service_1.RoutingService.resolvePoc({
            companyId,
            branchId: toWh.branchId || undefined,
            departmentId: departmentId || undefined,
            section: section || 'Store',
            workflowType: 'STORE_REQUISITION'
        });
        const count = await database_1.prisma.stockTransfer.count({ where: { companyId } });
        const transferNumber = `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const initialStage = submitImmediately ? 'PENDING_APPROVAL' : 'DRAFT';
        const metadata = {
            isRequisition: true,
            stage: initialStage,
            priority,
            departmentId: departmentId || null,
            section: section || 'Store',
            assignedPocUserId: poc.assignedPocUserId,
            assignedPocName: poc.assignedPocName,
            customNotes: notes,
            requestedById: actorId,
            submittedAt: submitImmediately ? new Date().toISOString() : null,
            itemsDetail: items.map((it) => ({
                itemId: it.itemId,
                requestedQty: Number(it.requestedQty),
                dispatchedQty: 0,
                receivedQty: 0,
                notes: it.notes
            }))
        };
        return database_1.prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.create({
                data: {
                    companyId,
                    fromWarehouseId,
                    toWarehouseId,
                    transferNumber,
                    transferDate: new Date(),
                    status: 'PENDING',
                    notes: JSON.stringify(metadata),
                    createdById: actorId
                }
            });
            // Create items
            for (const it of items) {
                const itemObj = await tx.item.findFirst({ where: { id: it.itemId, companyId } });
                if (!itemObj) {
                    throw new response_utils_1.AppError(`Item not found: ${it.itemId}`, 404);
                }
                await tx.stockTransferItem.create({
                    data: {
                        transferId: transfer.id,
                        itemId: it.itemId,
                        quantity: new client_1.Prisma.Decimal(it.requestedQty),
                        unitCost: itemObj.costPrice,
                        notes: it.notes
                    }
                });
            }
            // If submitting immediately, wire approval request
            if (submitImmediately) {
                try {
                    await approval_service_1.ApprovalService.createApprovalRequest(companyId, {
                        branchId: toWh.branchId || undefined,
                        transactionType: 'STOCK_TRANSFER',
                        referenceId: transfer.id,
                        title: `Store Requisition #${transferNumber} (${section || 'Store'})`,
                        description: `Store requisition with ${items.length} items submitted by staff`
                    }, actorId || 'system', ipAddress, userAgent);
                }
                catch (err) {
                    console.warn('Approval request link warning:', err);
                }
            }
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: submitImmediately ? 'REQUISITION_SUBMITTED' : 'REQUISITION_CREATED',
                entity: 'StockTransfer',
                entityId: transfer.id,
                details: { transferNumber, stage: initialStage, from: fromWh.name, to: toWh.name, items: items.length },
                ipAddress,
                userAgent
            });
            return {
                ...transfer,
                stage: initialStage,
                assignedPocUserId: poc.assignedPocUserId,
                assignedPocName: poc.assignedPocName
            };
        });
    }
    static async getRequisitions(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            transferNumber: { startsWith: 'REQ-' },
            ...(params.warehouseId
                ? { OR: [{ fromWarehouseId: params.warehouseId }, { toWarehouseId: params.warehouseId }] }
                : {}),
            ...(params.branchId
                ? {
                    OR: [
                        { fromWarehouse: { branchId: params.branchId } },
                        { toWarehouse: { branchId: params.branchId } }
                    ]
                }
                : {})
        };
        const [total, rawTransfers] = await Promise.all([
            database_1.prisma.stockTransfer.count({ where }),
            database_1.prisma.stockTransfer.findMany({
                where,
                include: {
                    fromWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
                    toWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                    items: {
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    costPrice: true,
                                    unit: { select: { symbol: true } }
                                }
                            }
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);
        const requisitions = rawTransfers.map((t) => {
            const meta = InventoryService.parseRequisitionMetadata(t.notes);
            return {
                id: t.id,
                transferNumber: t.transferNumber,
                status: t.status,
                stage: meta?.stage || (t.status === 'COMPLETED' ? 'RECEIVED' : 'PENDING'),
                priority: meta?.priority || 'MEDIUM',
                section: meta?.section || 'General',
                assignedPocUserId: meta?.assignedPocUserId,
                assignedPocName: meta?.assignedPocName,
                rejectionReason: meta?.rejectionReason,
                fromWarehouse: t.fromWarehouse,
                toWarehouse: t.toWarehouse,
                createdBy: t.createdBy,
                transferDate: t.transferDate,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                items: t.items.map((it) => {
                    const detail = meta?.itemsDetail?.find((d) => d.itemId === it.itemId);
                    return {
                        id: it.id,
                        itemId: it.itemId,
                        item: it.item,
                        requestedQty: Number(it.quantity),
                        dispatchedQty: detail?.dispatchedQty ?? (t.status === 'COMPLETED' ? Number(it.quantity) : 0),
                        receivedQty: detail?.receivedQty ?? (t.status === 'COMPLETED' ? Number(it.quantity) : 0),
                        notes: it.notes
                    };
                })
            };
        });
        const filteredRequisitions = params.stage
            ? requisitions.filter((r) => r.stage.toUpperCase() === params.stage?.toUpperCase())
            : requisitions;
        return {
            requisitions: filteredRequisitions,
            pagination: {
                page,
                limit,
                total: params.stage ? filteredRequisitions.length : total,
                totalPages: Math.ceil((params.stage ? filteredRequisitions.length : total) / limit)
            }
        };
    }
    static async getRequisitionById(companyId, id) {
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id, companyId },
            include: {
                fromWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
                toWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                items: {
                    include: {
                        item: {
                            include: {
                                unit: true,
                                category: true,
                                stockBalances: true
                            }
                        }
                    }
                }
            }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes);
        return {
            ...transfer,
            stage: meta?.stage || (transfer.status === 'COMPLETED' ? 'RECEIVED' : 'PENDING'),
            priority: meta?.priority || 'MEDIUM',
            section: meta?.section || 'Store',
            assignedPocUserId: meta?.assignedPocUserId,
            assignedPocName: meta?.assignedPocName,
            rejectionReason: meta?.rejectionReason,
            customNotes: meta?.customNotes,
            items: transfer.items.map((it) => {
                const detail = meta?.itemsDetail?.find((d) => d.itemId === it.itemId);
                const sourceBal = it.item.stockBalances.find((b) => b.warehouseId === transfer.fromWarehouseId);
                const destBal = it.item.stockBalances.find((b) => b.warehouseId === transfer.toWarehouseId);
                return {
                    id: it.id,
                    itemId: it.itemId,
                    item: {
                        id: it.item.id,
                        name: it.item.name,
                        code: it.item.code,
                        unit: it.item.unit,
                        category: it.item.category
                    },
                    requestedQty: Number(it.quantity),
                    dispatchedQty: detail?.dispatchedQty ?? (transfer.status === 'COMPLETED' ? Number(it.quantity) : 0),
                    receivedQty: detail?.receivedQty ?? (transfer.status === 'COMPLETED' ? Number(it.quantity) : 0),
                    sourceStockAvailable: sourceBal ? Number(sourceBal.quantity) : 0,
                    destStockCurrent: destBal ? Number(destBal.quantity) : 0,
                    notes: it.notes
                };
            })
        };
    }
    static async submitRequisition(params) {
        const { companyId, requisitionId, notes, actorId, ipAddress, userAgent } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: requisitionId, companyId },
            include: { toWarehouse: true, items: true }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes) || {};
        if (meta.stage && meta.stage !== 'DRAFT') {
            throw new response_utils_1.AppError(`Cannot submit requisition in stage "${meta.stage}"`, 400);
        }
        const updatedMeta = {
            ...meta,
            isRequisition: true,
            stage: 'PENDING_APPROVAL',
            submittedAt: new Date().toISOString(),
            submittedById: actorId,
            submissionNotes: notes || meta.customNotes
        };
        const updated = await database_1.prisma.stockTransfer.update({
            where: { id: transfer.id },
            data: {
                notes: JSON.stringify(updatedMeta),
                status: 'PENDING'
            }
        });
        try {
            await approval_service_1.ApprovalService.createApprovalRequest(companyId, {
                branchId: transfer.toWarehouse.branchId || undefined,
                transactionType: 'STOCK_TRANSFER',
                referenceId: transfer.id,
                title: `Store Requisition #${transfer.transferNumber} (${meta.section || 'Store'})`,
                description: `Store requisition with ${transfer.items.length} items submitted for approval`
            }, actorId || 'system', ipAddress, userAgent);
        }
        catch (err) {
            console.warn('Approval request link warning:', err);
        }
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'REQUISITION_SUBMITTED',
            entity: 'StockTransfer',
            entityId: transfer.id,
            details: { transferNumber: transfer.transferNumber, stage: 'PENDING_APPROVAL' },
            ipAddress,
            userAgent
        });
        return { ...updated, stage: 'PENDING_APPROVAL' };
    }
    static async approveRequisition(params) {
        const { companyId, requisitionId, approverId, approverRole, comment, ipAddress, userAgent } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: requisitionId, companyId }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes) || {};
        if (meta.stage !== 'PENDING_APPROVAL') {
            throw new response_utils_1.AppError(`Cannot approve requisition in stage "${meta.stage || transfer.status}"`, 400);
        }
        // Security Check: Approver must be assigned POC or have admin / manage role
        const isAssignedPoc = meta.assignedPocUserId === approverId;
        const isAdmin = approverRole === 'Super Administrator' ||
            approverRole === 'Admin' ||
            approverRole === 'General Manager' ||
            approverRole === 'Operations Manager';
        if (!isAssignedPoc && !isAdmin) {
            throw new response_utils_1.AppError('Unauthorized: You are not authorized to approve this requisition', 403);
        }
        const updatedMeta = {
            ...meta,
            stage: 'APPROVED',
            approvedAt: new Date().toISOString(),
            approvedById: approverId,
            approvalComment: comment
        };
        const updated = await database_1.prisma.stockTransfer.update({
            where: { id: transfer.id },
            data: {
                notes: JSON.stringify(updatedMeta)
            }
        });
        await audit_service_1.AuditService.log({
            userId: approverId,
            action: 'REQUISITION_APPROVED',
            entity: 'StockTransfer',
            entityId: transfer.id,
            details: { transferNumber: transfer.transferNumber, stage: 'APPROVED', comment },
            ipAddress,
            userAgent
        });
        return { ...updated, stage: 'APPROVED' };
    }
    static async rejectRequisition(params) {
        const { companyId, requisitionId, rejecterId, rejecterRole, reason, ipAddress, userAgent } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: requisitionId, companyId }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes) || {};
        if (meta.stage !== 'PENDING_APPROVAL') {
            throw new response_utils_1.AppError(`Cannot reject requisition in stage "${meta.stage || transfer.status}"`, 400);
        }
        // Security Check
        const isAssignedPoc = meta.assignedPocUserId === rejecterId;
        const isAdmin = rejecterRole === 'Super Administrator' ||
            rejecterRole === 'Admin' ||
            rejecterRole === 'General Manager';
        if (!isAssignedPoc && !isAdmin) {
            throw new response_utils_1.AppError('Unauthorized: You are not authorized to reject this requisition', 403);
        }
        const updatedMeta = {
            ...meta,
            stage: 'REJECTED',
            rejectionReason: reason,
            rejectedAt: new Date().toISOString(),
            rejectedById: rejecterId
        };
        const updated = await database_1.prisma.stockTransfer.update({
            where: { id: transfer.id },
            data: {
                status: 'CANCELLED',
                notes: JSON.stringify(updatedMeta)
            }
        });
        await audit_service_1.AuditService.log({
            userId: rejecterId,
            action: 'REQUISITION_REJECTED',
            entity: 'StockTransfer',
            entityId: transfer.id,
            details: { transferNumber: transfer.transferNumber, stage: 'REJECTED', reason },
            ipAddress,
            userAgent
        });
        return { ...updated, stage: 'REJECTED' };
    }
    static async pickAndVerifyRequisition(params) {
        const { companyId, requisitionId } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: requisitionId, companyId },
            include: {
                fromWarehouse: true,
                items: { include: { item: { include: { unit: true } } } }
            }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        let isFullyPickable = true;
        const pickList = [];
        for (const it of transfer.items) {
            const balance = await database_1.prisma.stockBalance.findUnique({
                where: {
                    warehouseId_itemId: {
                        warehouseId: transfer.fromWarehouseId,
                        itemId: it.itemId
                    }
                }
            });
            const availableQty = balance ? Number(balance.quantity) : 0;
            const requestedQty = Number(it.quantity);
            const isShortage = availableQty < requestedQty;
            if (isShortage) {
                isFullyPickable = false;
            }
            pickList.push({
                itemId: it.itemId,
                itemName: it.item.name,
                itemCode: it.item.code,
                unit: it.item.unit.symbol,
                requestedQty,
                availableQty,
                isShortage,
                maxDispatchableQty: Math.min(requestedQty, availableQty)
            });
        }
        return {
            requisitionId: transfer.id,
            transferNumber: transfer.transferNumber,
            sourceWarehouse: transfer.fromWarehouse.name,
            isFullyPickable,
            pickList
        };
    }
    static async dispatchRequisition(params) {
        const { companyId, requisitionId, dispatcherId, actorRole, userBranchIds, notes, items, ipAddress, userAgent } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: requisitionId, companyId },
            include: { fromWarehouse: true, toWarehouse: true, items: { include: { item: true } } }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Requisition not found', 404);
        }
        // Branch Isolation / Wrong Outlet Access Check
        if (userBranchIds &&
            userBranchIds.length > 0 &&
            transfer.fromWarehouse.branchId &&
            !userBranchIds.includes(transfer.fromWarehouse.branchId) &&
            actorRole !== 'Super Administrator') {
            throw new response_utils_1.AppError('Unauthorized: You do not have access to dispatch from this issuing warehouse', 403);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes) || {};
        if (meta.stage && meta.stage !== 'APPROVED') {
            throw new response_utils_1.AppError(`Cannot dispatch requisition in stage "${meta.stage}". Must be APPROVED.`, 400);
        }
        if (transfer.status === 'COMPLETED') {
            throw new response_utils_1.AppError('Transfer has already been completed', 400);
        }
        // Execute atomic dispatch in transaction
        return database_1.prisma.$transaction(async (tx) => {
            // Concurrency protection: Lock row
            const [lockedTransfer] = await tx.$queryRaw `
        SELECT "id", "status"::text, "notes" FROM "stock_transfers"
        WHERE "id" = ${transfer.id}
        FOR UPDATE
      `;
            if (!lockedTransfer) {
                throw new response_utils_1.AppError('Transfer not found', 404);
            }
            if (lockedTransfer.status === 'COMPLETED') {
                throw new response_utils_1.AppError('Transfer has already been completed', 400);
            }
            const lockedMeta = InventoryService.parseRequisitionMetadata(lockedTransfer.notes) || {};
            if (lockedMeta.stage && lockedMeta.stage !== 'APPROVED') {
                throw new response_utils_1.AppError(`Cannot dispatch requisition in stage "${lockedMeta.stage}". Must be APPROVED.`, 400);
            }
            const updatedItemsDetail = [];
            for (const it of transfer.items) {
                const customDispatch = items?.find((d) => d.itemId === it.itemId);
                const requestedQty = Number(it.quantity);
                const dispatchQtyNumber = customDispatch ? Number(customDispatch.dispatchQty) : requestedQty;
                if (dispatchQtyNumber <= 0) {
                    throw new response_utils_1.AppError(`Dispatch quantity for "${it.item.name}" must be greater than 0`, 400);
                }
                if (dispatchQtyNumber > requestedQty) {
                    throw new response_utils_1.AppError(`Dispatch quantity (${dispatchQtyNumber}) cannot exceed requested quantity (${requestedQty}) for "${it.item.name}"`, 400);
                }
                const dispatchQtyDecimal = new client_1.Prisma.Decimal(dispatchQtyNumber);
                // 1. Check source stock balance
                const sourceBal = await tx.stockBalance.findUnique({
                    where: {
                        warehouseId_itemId: {
                            warehouseId: transfer.fromWarehouseId,
                            itemId: it.itemId
                        }
                    }
                });
                if (!sourceBal || sourceBal.quantity.lessThan(dispatchQtyDecimal)) {
                    const available = sourceBal ? sourceBal.quantity.toString() : '0';
                    throw new response_utils_1.AppError(`Insufficient stock for "${it.item.name}" in ${transfer.fromWarehouse.name}. Available: ${available}, Required for dispatch: ${dispatchQtyNumber}`, 400);
                }
                // 2. Deduct from source warehouse
                const newFromQty = sourceBal.quantity.minus(dispatchQtyDecimal);
                await tx.stockBalance.update({
                    where: { id: sourceBal.id },
                    data: { quantity: newFromQty }
                });
                // 3. Create StockLedger entry for TRANSFER_OUT
                await tx.stockLedger.create({
                    data: {
                        warehouseId: transfer.fromWarehouseId,
                        itemId: it.itemId,
                        movementType: 'TRANSFER_OUT',
                        changeQty: dispatchQtyDecimal.negated(),
                        balanceQty: newFromQty,
                        unitCost: it.item.costPrice,
                        totalCost: dispatchQtyDecimal.times(it.item.costPrice),
                        referenceType: 'TRANSFER',
                        referenceId: transfer.id,
                        notes: `Dispatched to ${transfer.toWarehouse.name} (${transfer.transferNumber})`,
                        createdById: dispatcherId
                    }
                });
                // 4. Update transfer item
                await tx.stockTransferItem.update({
                    where: { id: it.id },
                    data: {
                        quantity: dispatchQtyDecimal,
                        notes: `Dispatched: ${dispatchQtyNumber} / Requested: ${requestedQty}`
                    }
                });
                updatedItemsDetail.push({
                    itemId: it.itemId,
                    requestedQty,
                    dispatchedQty: dispatchQtyNumber,
                    receivedQty: 0
                });
            }
            // 5. Update StockTransfer to IN_TRANSIT stage (status PENDING - Destination stock is NOT updated yet)
            const updatedMeta = {
                ...meta,
                stage: 'IN_TRANSIT',
                dispatchedAt: new Date().toISOString(),
                dispatchedById: dispatcherId,
                dispatchNotes: notes,
                itemsDetail: updatedItemsDetail
            };
            const updatedTransfer = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: 'PENDING',
                    notes: JSON.stringify(updatedMeta)
                }
            });
            await audit_service_1.AuditService.log({
                userId: dispatcherId,
                action: 'TRANSFER_DISPATCHED',
                entity: 'StockTransfer',
                entityId: transfer.id,
                details: {
                    transferNumber: transfer.transferNumber,
                    stage: 'IN_TRANSIT',
                    from: transfer.fromWarehouse.name,
                    to: transfer.toWarehouse.name
                },
                ipAddress,
                userAgent
            });
            return {
                ...updatedTransfer,
                stage: 'IN_TRANSIT',
                itemsDetail: updatedItemsDetail
            };
        }, { maxWait: 10000, timeout: 30000 });
    }
    static async receiveTransfer(params) {
        const { companyId, transferId, receiverId, actorRole, userBranchIds, notes, items, ipAddress, userAgent } = params;
        const transfer = await database_1.prisma.stockTransfer.findFirst({
            where: { id: transferId, companyId },
            include: { fromWarehouse: true, toWarehouse: true, items: { include: { item: true } } }
        });
        if (!transfer) {
            throw new response_utils_1.AppError('Transfer not found', 404);
        }
        // Branch Isolation Check
        if (userBranchIds &&
            userBranchIds.length > 0 &&
            transfer.toWarehouse.branchId &&
            !userBranchIds.includes(transfer.toWarehouse.branchId) &&
            actorRole !== 'Super Administrator') {
            throw new response_utils_1.AppError('Unauthorized: You do not have access to receive for this destination outlet/branch', 403);
        }
        // Duplicate Receiving Prevention Check
        if (transfer.status === 'COMPLETED') {
            throw new response_utils_1.AppError('Duplicate receiving prevented: Transfer has already been received and completed', 400);
        }
        const meta = InventoryService.parseRequisitionMetadata(transfer.notes) || {};
        if (meta.stage && meta.stage !== 'IN_TRANSIT') {
            throw new response_utils_1.AppError(`Cannot receive transfer in stage "${meta.stage}". Must be IN_TRANSIT.`, 400);
        }
        return database_1.prisma.$transaction(async (tx) => {
            // Concurrency protection: Row lock to prevent concurrent double-receiving
            const [lockedTransfer] = await tx.$queryRaw `
        SELECT "id", "status"::text, "notes" FROM "stock_transfers"
        WHERE "id" = ${transfer.id}
        FOR UPDATE
      `;
            if (!lockedTransfer || lockedTransfer.status === 'COMPLETED') {
                throw new response_utils_1.AppError('Duplicate receiving prevented: Transfer has already been received and completed', 400);
            }
            const lockedMeta = InventoryService.parseRequisitionMetadata(lockedTransfer.notes) || {};
            if (lockedMeta.stage && lockedMeta.stage !== 'IN_TRANSIT') {
                throw new response_utils_1.AppError('Duplicate receiving prevented: Transfer has already been received and completed', 400);
            }
            const updatedItemsDetail = [];
            for (const it of transfer.items) {
                const customRec = items?.find((d) => d.itemId === it.itemId);
                const dispatchedQty = Number(it.quantity);
                const receivedQtyNumber = customRec ? Number(customRec.receivedQty) : dispatchedQty;
                if (receivedQtyNumber <= 0) {
                    throw new response_utils_1.AppError(`Received quantity for "${it.item.name}" must be greater than 0`, 400);
                }
                if (receivedQtyNumber > dispatchedQty) {
                    throw new response_utils_1.AppError(`Received quantity (${receivedQtyNumber}) cannot exceed dispatched quantity (${dispatchedQty}) for "${it.item.name}"`, 400);
                }
                const receivedQtyDecimal = new client_1.Prisma.Decimal(receivedQtyNumber);
                // 1. Increment Destination Warehouse Stock Balance (upsert)
                const destBalance = await tx.stockBalance.upsert({
                    where: {
                        warehouseId_itemId: {
                            warehouseId: transfer.toWarehouseId,
                            itemId: it.itemId
                        }
                    },
                    update: {
                        quantity: { increment: receivedQtyDecimal }
                    },
                    create: {
                        warehouseId: transfer.toWarehouseId,
                        itemId: it.itemId,
                        quantity: receivedQtyDecimal
                    }
                });
                // 2. Create StockLedger entry for TRANSFER_IN
                await tx.stockLedger.create({
                    data: {
                        warehouseId: transfer.toWarehouseId,
                        itemId: it.itemId,
                        movementType: 'TRANSFER_IN',
                        changeQty: receivedQtyDecimal,
                        balanceQty: destBalance.quantity,
                        unitCost: it.item.costPrice,
                        totalCost: receivedQtyDecimal.times(it.item.costPrice),
                        referenceType: 'TRANSFER',
                        referenceId: transfer.id,
                        notes: `Received from ${transfer.fromWarehouse.name} (${transfer.transferNumber})`,
                        createdById: receiverId
                    }
                });
                updatedItemsDetail.push({
                    itemId: it.itemId,
                    dispatchedQty,
                    receivedQty: receivedQtyNumber
                });
            }
            // 3. Mark transfer as COMPLETED and stage as RECEIVED
            const updatedMeta = {
                ...meta,
                stage: 'RECEIVED',
                receivedAt: new Date().toISOString(),
                receivedById: receiverId,
                receivingNotes: notes,
                itemsDetail: updatedItemsDetail
            };
            const finalTransfer = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: 'COMPLETED',
                    notes: JSON.stringify(updatedMeta)
                }
            });
            await audit_service_1.AuditService.log({
                userId: receiverId,
                action: 'TRANSFER_RECEIVED',
                entity: 'StockTransfer',
                entityId: transfer.id,
                details: {
                    transferNumber: transfer.transferNumber,
                    stage: 'RECEIVED',
                    status: 'COMPLETED',
                    destination: transfer.toWarehouse.name
                },
                ipAddress,
                userAgent
            });
            return {
                ...finalTransfer,
                stage: 'RECEIVED',
                status: 'COMPLETED',
                itemsDetail: updatedItemsDetail
            };
        }, { maxWait: 10000, timeout: 30000 });
    }
}
exports.InventoryService = InventoryService;

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
const accounting_service_1 = require("./accounting.service");
const client_1 = require("@prisma/client");
class PurchaseService {
    // -------------------------------------------------------------
    // SUPPLIER MANAGEMENT & SUPPLIER LEDGER
    // -------------------------------------------------------------
    static async getSuppliers(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
            ...(params.search
                ? {
                    OR: [
                        { name: { contains: params.search, mode: 'insensitive' } },
                        { code: { contains: params.search, mode: 'insensitive' } },
                        { contactPerson: { contains: params.search, mode: 'insensitive' } },
                        { email: { contains: params.search, mode: 'insensitive' } }
                    ]
                }
                : {})
        };
        const [total, suppliers] = await Promise.all([
            database_1.prisma.supplier.count({ where }),
            database_1.prisma.supplier.findMany({
                where,
                include: {
                    _count: { select: { purchaseOrders: true, grns: true } }
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' }
            })
        ]);
        return {
            suppliers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    static async createSupplier(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.supplier.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Supplier with code "${data.code}" already exists`, 400);
        }
        const supplier = await database_1.prisma.supplier.create({
            data: {
                companyId,
                name: data.name,
                code: data.code.toUpperCase(),
                contactPerson: data.contactPerson,
                email: data.email || null,
                phone: data.phone,
                address: data.address,
                taxNumber: data.taxNumber,
                paymentTerms: data.paymentTerms || 'Net 30'
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'SUPPLIER_CREATE',
            entity: 'Supplier',
            entityId: supplier.id,
            details: { name: supplier.name, code: supplier.code },
            ipAddress,
            userAgent
        });
        return supplier;
    }
    static async updateSupplier(companyId, id, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.supplier.findFirst({ where: { id, companyId } });
        if (!existing) {
            throw new response_utils_1.AppError('Supplier not found', 404);
        }
        const updated = await database_1.prisma.supplier.update({
            where: { id },
            data: {
                ...(data.name ? { name: data.name } : {}),
                ...(data.code ? { code: data.code.toUpperCase() } : {}),
                ...(data.contactPerson !== undefined ? { contactPerson: data.contactPerson } : {}),
                ...(data.email !== undefined ? { email: data.email || null } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
                ...(data.address !== undefined ? { address: data.address } : {}),
                ...(data.taxNumber !== undefined ? { taxNumber: data.taxNumber } : {}),
                ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'SUPPLIER_UPDATE',
            entity: 'Supplier',
            entityId: id,
            details: { before: existing, after: updated },
            ipAddress,
            userAgent
        });
        return updated;
    }
    static async getSupplierLedger(companyId, supplierId, params) {
        const supplier = await database_1.prisma.supplier.findFirst({
            where: { id: supplierId, companyId }
        });
        if (!supplier) {
            throw new response_utils_1.AppError('Supplier not found', 404);
        }
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 30));
        const skip = (page - 1) * limit;
        const [total, entries] = await Promise.all([
            database_1.prisma.supplierLedger.count({ where: { supplierId } }),
            database_1.prisma.supplierLedger.findMany({
                where: { supplierId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);
        return {
            supplier,
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
    // PURCHASE REQUESTS (PR)
    // -------------------------------------------------------------
    static async getPurchaseRequests(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            ...(params.branchId ? { branchId: params.branchId } : {}),
            ...(params.status ? { status: params.status } : {})
        };
        const [total, requests] = await Promise.all([
            database_1.prisma.purchaseRequest.count({ where }),
            database_1.prisma.purchaseRequest.findMany({
                where,
                include: {
                    branch: { select: { id: true, name: true, code: true } },
                    requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                    approvedBy: { select: { id: true, firstName: true, lastName: true } },
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
                    },
                    purchaseOrders: { select: { id: true, poNumber: true, status: true } }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);
        return {
            requests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    static async createPurchaseRequest(companyId, branchId, data, requesterId, ipAddress, userAgent) {
        const count = await database_1.prisma.purchaseRequest.count({ where: { companyId } });
        const requestNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const request = await database_1.prisma.purchaseRequest.create({
            data: {
                companyId,
                branchId,
                requestNumber,
                requestedById: requesterId,
                requiredDate: new Date(data.requiredDate),
                priority: data.priority || 'MEDIUM',
                status: 'PENDING_APPROVAL',
                notes: data.notes,
                items: {
                    create: data.items.map((item) => ({
                        itemId: item.itemId,
                        requestedQty: new client_1.Prisma.Decimal(item.requestedQty),
                        estimatedPrice: new client_1.Prisma.Decimal(item.estimatedPrice || 0),
                        notes: item.notes
                    }))
                }
            },
            include: {
                items: { include: { item: true } }
            }
        });
        await audit_service_1.AuditService.log({
            userId: requesterId,
            action: 'PURCHASE_REQUEST_CREATE',
            entity: 'PurchaseRequest',
            entityId: request.id,
            details: { requestNumber, itemCount: data.items.length, priority: request.priority },
            ipAddress,
            userAgent
        });
        // Wire Real Approval Center (Section 13)
        try {
            const { ApprovalService } = await Promise.resolve().then(() => __importStar(require('./approval.service')));
            await ApprovalService.createApprovalRequest(companyId, {
                branchId: request.branchId,
                transactionType: 'PURCHASE_REQUEST',
                referenceId: request.id,
                title: `Purchase Request #${requestNumber} (${data.priority})`,
                description: `PR with ${data.items.length} items requested by staff`
            }, requesterId, ipAddress, userAgent);
        }
        catch (appErr) {
            console.warn('Auto approval request notice:', appErr);
        }
        return request;
    }
    static async approvePurchaseRequest(companyId, requestId, approverId, options, ipAddress, userAgent) {
        const pr = await database_1.prisma.purchaseRequest.findFirst({
            where: { id: requestId, companyId },
            include: { items: { include: { item: true } } }
        });
        if (!pr) {
            throw new response_utils_1.AppError('Purchase request not found', 404);
        }
        if (pr.status !== 'PENDING_APPROVAL') {
            throw new response_utils_1.AppError(`Cannot approve request with status "${pr.status}"`, 400);
        }
        return database_1.prisma.$transaction(async (tx) => {
            let createdPO = null;
            if (options.autoCreatePO && options.supplierId) {
                const poCount = await tx.purchaseOrder.count({ where: { companyId } });
                const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;
                const totalAmount = pr.items.reduce((sum, item) => {
                    const price = item.estimatedPrice.isZero() ? item.item.costPrice : item.estimatedPrice;
                    return sum.plus(item.requestedQty.times(price));
                }, new client_1.Prisma.Decimal(0));
                createdPO = await tx.purchaseOrder.create({
                    data: {
                        companyId,
                        branchId: pr.branchId,
                        supplierId: options.supplierId,
                        requestId: pr.id,
                        poNumber,
                        status: 'ISSUED',
                        totalAmount,
                        taxAmount: new client_1.Prisma.Decimal(0),
                        grandTotal: totalAmount,
                        notes: `Auto-generated from ${pr.requestNumber}. ${options.notes || ''}`,
                        createdById: approverId,
                        items: {
                            create: pr.items.map((it) => {
                                const unitPrice = it.estimatedPrice.isZero() ? it.item.costPrice : it.estimatedPrice;
                                return {
                                    itemId: it.itemId,
                                    orderedQty: it.requestedQty,
                                    unitPrice,
                                    totalPrice: it.requestedQty.times(unitPrice),
                                    notes: it.notes
                                };
                            })
                        }
                    },
                    include: {
                        items: true
                    }
                });
            }
            const updatedPR = await tx.purchaseRequest.update({
                where: { id: requestId },
                data: {
                    status: createdPO ? 'ORDERED' : 'APPROVED',
                    approvedById: approverId,
                    approvedAt: new Date()
                },
                include: {
                    items: true,
                    purchaseOrders: true
                }
            });
            await audit_service_1.AuditService.log({
                userId: approverId,
                action: 'PURCHASE_REQUEST_APPROVED',
                entity: 'PurchaseRequest',
                entityId: requestId,
                details: {
                    requestNumber: pr.requestNumber,
                    autoCreatedPO: createdPO ? createdPO.poNumber : null
                },
                ipAddress,
                userAgent
            });
            return {
                purchaseRequest: updatedPR,
                purchaseOrder: createdPO
            };
        }, { maxWait: 10000, timeout: 30000 });
    }
    static async rejectPurchaseRequest(companyId, requestId, approverId, reason, ipAddress, userAgent) {
        const pr = await database_1.prisma.purchaseRequest.findFirst({
            where: { id: requestId, companyId }
        });
        if (!pr) {
            throw new response_utils_1.AppError('Purchase request not found', 404);
        }
        if (pr.status !== 'PENDING_APPROVAL') {
            throw new response_utils_1.AppError(`Cannot reject request with status "${pr.status}"`, 400);
        }
        const updated = await database_1.prisma.purchaseRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                approvedById: approverId,
                approvedAt: new Date(),
                rejectionReason: reason
            }
        });
        await audit_service_1.AuditService.log({
            userId: approverId,
            action: 'PURCHASE_REQUEST_REJECTED',
            entity: 'PurchaseRequest',
            entityId: requestId,
            details: { requestNumber: pr.requestNumber, reason },
            ipAddress,
            userAgent
        });
        return updated;
    }
    // -------------------------------------------------------------
    // PURCHASE ORDERS (PO)
    // -------------------------------------------------------------
    static async getPurchaseOrders(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            ...(params.branchId ? { branchId: params.branchId } : {}),
            ...(params.supplierId ? { supplierId: params.supplierId } : {}),
            ...(params.status ? { status: params.status } : {})
        };
        const [total, orders] = await Promise.all([
            database_1.prisma.purchaseOrder.count({ where }),
            database_1.prisma.purchaseOrder.findMany({
                where,
                include: {
                    branch: { select: { id: true, name: true, code: true } },
                    supplier: { select: { id: true, name: true, code: true, phone: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    items: {
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                    unit: { select: { symbol: true } }
                                }
                            }
                        }
                    },
                    grns: { select: { id: true, grnNumber: true, status: true, receiveDate: true } }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);
        return {
            orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    static async getPurchaseOrderById(companyId, poId) {
        const po = await database_1.prisma.purchaseOrder.findFirst({
            where: { id: poId, companyId },
            include: {
                branch: true,
                supplier: true,
                createdBy: true,
                items: {
                    include: {
                        item: { include: { unit: true, category: true } }
                    }
                },
                grns: {
                    include: {
                        warehouse: true,
                        items: true
                    }
                }
            }
        });
        if (!po) {
            throw new response_utils_1.AppError('Purchase Order not found', 404);
        }
        return po;
    }
    static async createPurchaseOrder(companyId, branchId, data, actorId, ipAddress, userAgent) {
        const poCount = await database_1.prisma.purchaseOrder.count({ where: { companyId } });
        const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;
        const totalAmount = data.items.reduce((sum, it) => {
            return sum.plus(new client_1.Prisma.Decimal(it.orderedQty).times(new client_1.Prisma.Decimal(it.unitPrice)));
        }, new client_1.Prisma.Decimal(0));
        const taxAmount = new client_1.Prisma.Decimal(data.taxAmount || 0);
        const grandTotal = totalAmount.plus(taxAmount);
        const po = await database_1.prisma.purchaseOrder.create({
            data: {
                companyId,
                branchId,
                supplierId: data.supplierId,
                requestId: data.requestId || null,
                poNumber,
                status: 'ISSUED',
                deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                totalAmount,
                taxAmount,
                grandTotal,
                notes: data.notes,
                createdById: actorId,
                items: {
                    create: data.items.map((it) => {
                        const qty = new client_1.Prisma.Decimal(it.orderedQty);
                        const price = new client_1.Prisma.Decimal(it.unitPrice);
                        return {
                            itemId: it.itemId,
                            orderedQty: qty,
                            unitPrice: price,
                            totalPrice: qty.times(price),
                            notes: it.notes
                        };
                    })
                }
            },
            include: {
                items: { include: { item: true } },
                supplier: true
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'PURCHASE_ORDER_CREATE',
            entity: 'PurchaseOrder',
            entityId: po.id,
            details: { poNumber, supplier: po.supplier.name, grandTotal: grandTotal.toString() },
            ipAddress,
            userAgent
        });
        return po;
    }
    // -------------------------------------------------------------
    // GOODS RECEIVE NOTE (GRN) & AUTOMATED INVENTORY & LEDGER UPDATE
    // -------------------------------------------------------------
    static async createGoodsReceiveNote(params) {
        const { companyId, branchId, warehouseId, supplierId, poId, receiverId, ipAddress, userAgent } = params;
        const [wh, supplier] = await Promise.all([
            database_1.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } }),
            database_1.prisma.supplier.findFirst({ where: { id: supplierId, companyId } })
        ]);
        if (!wh || !supplier) {
            throw new response_utils_1.AppError('Invalid warehouse or supplier', 404);
        }
        // Execute in Prisma Atomic Transaction
        return database_1.prisma.$transaction(async (tx) => {
            const grnCount = await tx.goodsReceiveNote.count({ where: { companyId } });
            const grnNumber = `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(5, '0')}`;
            // Calculate total accepted amount
            let totalAmount = new client_1.Prisma.Decimal(0);
            for (const item of params.items) {
                const acceptedQty = new client_1.Prisma.Decimal(item.acceptedQty);
                const unitPrice = new client_1.Prisma.Decimal(item.unitPrice);
                totalAmount = totalAmount.plus(acceptedQty.times(unitPrice));
            }
            // 1. Create GRN Header
            const grn = await tx.goodsReceiveNote.create({
                data: {
                    companyId,
                    branchId,
                    warehouseId,
                    supplierId,
                    poId: poId || null,
                    grnNumber,
                    receiveDate: params.receiveDate ? new Date(params.receiveDate) : new Date(),
                    invoiceNumber: params.invoiceNumber,
                    status: 'QC_PASSED',
                    totalAmount,
                    notes: params.notes,
                    receivedById: receiverId
                }
            });
            // 2. Process each received item
            for (const item of params.items) {
                const receivedQty = new client_1.Prisma.Decimal(item.receivedQty);
                const acceptedQty = new client_1.Prisma.Decimal(item.acceptedQty);
                const rejectedQty = new client_1.Prisma.Decimal(item.rejectedQty || 0);
                const unitPrice = new client_1.Prisma.Decimal(item.unitPrice);
                const itemTotalPrice = acceptedQty.times(unitPrice);
                // Create GRN Item record
                await tx.goodsReceiveItem.create({
                    data: {
                        grnId: grn.id,
                        poItemId: item.poItemId || null,
                        itemId: item.itemId,
                        receivedQty,
                        acceptedQty,
                        rejectedQty,
                        unitPrice,
                        totalPrice: itemTotalPrice,
                        batchNumber: item.batchNumber,
                        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                        qcStatus: item.qcStatus || 'PASSED',
                        qcNotes: item.qcNotes
                    }
                });
                if (acceptedQty.greaterThan(0)) {
                    // A. Update Stock Balance in target Warehouse (Section 8 automation)
                    const stockBalance = await tx.stockBalance.upsert({
                        where: {
                            warehouseId_itemId: {
                                warehouseId,
                                itemId: item.itemId
                            }
                        },
                        update: {
                            quantity: { increment: acceptedQty }
                        },
                        create: {
                            warehouseId,
                            itemId: item.itemId,
                            quantity: acceptedQty
                        }
                    });
                    // B. Update Item cost price to latest purchase price
                    await tx.item.update({
                        where: { id: item.itemId },
                        data: { costPrice: unitPrice }
                    });
                    // C. Create immutable StockLedger record
                    await tx.stockLedger.create({
                        data: {
                            warehouseId,
                            itemId: item.itemId,
                            batchNumber: item.batchNumber,
                            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                            movementType: 'GRN',
                            changeQty: acceptedQty,
                            balanceQty: stockBalance.quantity,
                            unitCost: unitPrice,
                            totalCost: itemTotalPrice,
                            referenceType: 'GRN',
                            referenceId: grn.id,
                            notes: `Goods received from ${supplier.name} (${grnNumber})`,
                            createdById: receiverId
                        }
                    });
                }
                // D. Update PO Item received quantity if linked to PO
                if (item.poItemId) {
                    await tx.purchaseOrderItem.update({
                        where: { id: item.poItemId },
                        data: {
                            receivedQty: { increment: acceptedQty }
                        }
                    });
                }
            }
            // 3. Update PO status if linked
            if (poId) {
                const poItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
                const allReceived = poItems.every((poi) => poi.receivedQty.greaterThanOrEqualTo(poi.orderedQty));
                const someReceived = poItems.some((poi) => poi.receivedQty.greaterThan(0));
                await tx.purchaseOrder.update({
                    where: { id: poId },
                    data: {
                        status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'ISSUED'
                    }
                });
            }
            // 4. Update Supplier Payable Balance & record in Supplier Ledger
            const updatedSupplier = await tx.supplier.update({
                where: { id: supplierId },
                data: {
                    balance: { increment: totalAmount }
                }
            });
            await tx.supplierLedger.create({
                data: {
                    supplierId,
                    transactionType: 'INVOICE',
                    debit: new client_1.Prisma.Decimal(0),
                    credit: totalAmount,
                    balance: updatedSupplier.balance,
                    referenceType: 'GRN',
                    referenceId: grn.id,
                    description: `Goods received on ${grnNumber}${params.invoiceNumber ? ` (Inv: ${params.invoiceNumber})` : ''}`
                }
            });
            // 5. Create Purchase Invoice record
            const invoiceNumber = `INV-${grnNumber}`;
            await tx.purchaseInvoice.create({
                data: {
                    companyId,
                    supplierId,
                    grnId: grn.id,
                    invoiceNumber,
                    totalAmount,
                    paidAmount: new client_1.Prisma.Decimal(0),
                    status: 'UNPAID',
                    notes: params.invoiceNumber ? `Supplier Invoice: ${params.invoiceNumber}` : undefined
                }
            });
            // 6. Post Double-Entry General Ledger & Accounts Payable via AccountingService
            try {
                await accounting_service_1.AccountingService.recordPurchaseGrnJournal({
                    companyId,
                    branchId: wh.branchId,
                    supplierId,
                    grnId: grn.id,
                    grnNumber,
                    totalAmount,
                    actorId: receiverId
                });
            }
            catch (accErr) {
                console.warn('Auto AP/GL Posting non-fatal notice:', accErr);
            }
            await audit_service_1.AuditService.log({
                userId: receiverId,
                action: 'GOODS_RECEIVE_COMPLETED',
                entity: 'GoodsReceiveNote',
                entityId: grn.id,
                details: {
                    grnNumber,
                    warehouse: wh.name,
                    supplier: supplier.name,
                    totalAmount: totalAmount.toString(),
                    itemCount: params.items.length
                },
                ipAddress,
                userAgent
            });
            return grn;
        }, { maxWait: 10000, timeout: 30000 });
    }
    static async getGoodsReceiveNotes(companyId, params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const where = {
            companyId,
            ...(params.branchId ? { branchId: params.branchId } : {}),
            ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
            ...(params.supplierId ? { supplierId: params.supplierId } : {})
        };
        const [total, grns] = await Promise.all([
            database_1.prisma.goodsReceiveNote.count({ where }),
            database_1.prisma.goodsReceiveNote.findMany({
                where,
                include: {
                    branch: { select: { id: true, name: true, code: true } },
                    warehouse: { select: { id: true, name: true, code: true } },
                    supplier: { select: { id: true, name: true, code: true } },
                    receivedBy: { select: { id: true, firstName: true, lastName: true } },
                    items: {
                        include: {
                            item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } }
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            })
        ]);
        return {
            grns,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
exports.PurchaseService = PurchaseService;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileStockCountSchema = exports.recordWastageSchema = exports.receiveTransferSchema = exports.dispatchTransferSchema = exports.rejectRequisitionSchema = exports.approveRequisitionSchema = exports.submitRequisitionSchema = exports.createRequisitionSchema = exports.adjustStockSchema = exports.transferStockSchema = exports.createWarehouseSchema = exports.updateItemSchema = exports.createItemSchema = exports.createUnitSchema = exports.createCategorySchema = void 0;
const zod_1 = require("zod");
exports.createCategorySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Category name is required'),
        code: zod_1.z.string().min(1, 'Category code is required'),
        description: zod_1.z.string().optional()
    })
});
exports.createUnitSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Unit name is required'),
        symbol: zod_1.z.string().min(1, 'Unit symbol is required')
    })
});
exports.createItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Item name is required'),
        code: zod_1.z.string().min(1, 'Item code is required'),
        barcode: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().uuid('Valid category ID is required'),
        unitId: zod_1.z.string().uuid('Valid unit ID is required'),
        type: zod_1.z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SEMI_FINISHED', 'PACKAGING', 'ASSET']).default('RAW_MATERIAL'),
        description: zod_1.z.string().optional(),
        costPrice: zod_1.z.number().nonnegative().optional().default(0),
        sellingPrice: zod_1.z.number().nonnegative().optional().default(0),
        minStockLevel: zod_1.z.number().nonnegative().optional().default(0),
        reorderQty: zod_1.z.number().nonnegative().optional().default(0)
    })
});
exports.updateItemSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        code: zod_1.z.string().min(1).optional(),
        barcode: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().uuid().optional(),
        unitId: zod_1.z.string().uuid().optional(),
        type: zod_1.z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SEMI_FINISHED', 'PACKAGING', 'ASSET']).optional(),
        description: zod_1.z.string().optional(),
        costPrice: zod_1.z.number().nonnegative().optional(),
        sellingPrice: zod_1.z.number().nonnegative().optional(),
        minStockLevel: zod_1.z.number().nonnegative().optional(),
        reorderQty: zod_1.z.number().nonnegative().optional(),
        isActive: zod_1.z.boolean().optional()
    })
});
exports.createWarehouseSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Warehouse name is required'),
        code: zod_1.z.string().min(1, 'Warehouse code is required'),
        branchId: zod_1.z.string().uuid().optional().nullable(),
        isCentral: zod_1.z.boolean().default(false),
        address: zod_1.z.string().optional()
    })
});
exports.transferStockSchema = zod_1.z.object({
    body: zod_1.z.object({
        fromWarehouseId: zod_1.z.string().uuid('Source warehouse is required'),
        toWarehouseId: zod_1.z.string().uuid('Destination warehouse is required'),
        transferDate: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one item must be selected for transfer')
    })
});
exports.adjustStockSchema = zod_1.z.object({
    body: zod_1.z.object({
        warehouseId: zod_1.z.string().uuid('Warehouse ID is required'),
        itemId: zod_1.z.string().uuid('Item ID is required'),
        newQuantity: zod_1.z.number().nonnegative('New quantity must be 0 or greater'),
        reason: zod_1.z.string().min(1, 'Reason for stock adjustment is required')
    })
});
exports.createRequisitionSchema = zod_1.z.object({
    body: zod_1.z.object({
        fromWarehouseId: zod_1.z.string().uuid('Source / issuing warehouse is required'),
        toWarehouseId: zod_1.z.string().uuid('Destination / requesting warehouse is required'),
        departmentId: zod_1.z.string().uuid().optional().nullable(),
        section: zod_1.z.string().optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        notes: zod_1.z.string().optional(),
        submitImmediately: zod_1.z.boolean().optional().default(false),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            requestedQty: zod_1.z.number().positive('Requested quantity must be greater than 0'),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one item must be included in requisition')
    })
});
exports.submitRequisitionSchema = zod_1.z.object({
    body: zod_1.z.object({
        notes: zod_1.z.string().optional()
    }).optional()
});
exports.approveRequisitionSchema = zod_1.z.object({
    body: zod_1.z.object({
        comment: zod_1.z.string().optional()
    }).optional()
});
exports.rejectRequisitionSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(1, 'Rejection reason is required')
    })
});
exports.dispatchTransferSchema = zod_1.z.object({
    body: zod_1.z.object({
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            dispatchQty: zod_1.z.number().positive('Dispatch quantity must be greater than 0')
        })).optional()
    }).optional()
});
exports.receiveTransferSchema = zod_1.z.object({
    body: zod_1.z.object({
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            receivedQty: zod_1.z.number().positive('Received quantity must be greater than 0')
        })).optional()
    }).optional()
});
exports.recordWastageSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid().optional(),
        warehouseId: zod_1.z.string().uuid('Warehouse ID is required'),
        wastageType: zod_1.z.enum([
            'EXPIRED',
            'SPOILED',
            'DAMAGED',
            'WRONG_PREPARATION',
            'OVERPRODUCTION',
            'RETURNED_DISCARDED',
            'PRODUCTION_LOSS'
        ]),
        reason: zod_1.z.string().min(1, 'Reason for wastage is required'),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
            batchNumber: zod_1.z.string().optional(),
            reason: zod_1.z.string().optional()
        })).min(1, 'At least one item must be specified for wastage recording'),
        notes: zod_1.z.string().optional()
    })
});
exports.reconcileStockCountSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid().optional(),
        warehouseId: zod_1.z.string().uuid('Warehouse ID is required'),
        notes: zod_1.z.string().optional(),
        countedItems: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            countedQty: zod_1.z.number().min(0, 'Counted quantity cannot be negative'),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one item must be included in the physical count')
    })
});

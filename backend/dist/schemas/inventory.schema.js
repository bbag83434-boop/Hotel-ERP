"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustStockSchema = exports.transferStockSchema = exports.createWarehouseSchema = exports.updateItemSchema = exports.createItemSchema = exports.createUnitSchema = exports.createCategorySchema = void 0;
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

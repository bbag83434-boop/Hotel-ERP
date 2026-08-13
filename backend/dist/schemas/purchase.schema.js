"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGoodsReceiveSchema = exports.createPurchaseOrderSchema = exports.rejectPurchaseRequestSchema = exports.approvePurchaseRequestSchema = exports.createPurchaseRequestSchema = exports.updateSupplierSchema = exports.createSupplierSchema = void 0;
const zod_1 = require("zod");
exports.createSupplierSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Supplier name is required'),
        code: zod_1.z.string().min(1, 'Supplier code is required'),
        contactPerson: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
        phone: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        taxNumber: zod_1.z.string().optional(),
        paymentTerms: zod_1.z.string().optional().default('Net 30')
    })
});
exports.updateSupplierSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        code: zod_1.z.string().min(1).optional(),
        contactPerson: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
        phone: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        taxNumber: zod_1.z.string().optional(),
        paymentTerms: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional()
    })
});
exports.createPurchaseRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid('Branch is required'),
        requiredDate: zod_1.z.string().min(1, 'Required date is required'),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item ID is required'),
            requestedQty: zod_1.z.number().positive('Quantity must be greater than 0'),
            estimatedPrice: zod_1.z.number().nonnegative().optional().default(0),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one item is required in the purchase request')
    })
});
exports.approvePurchaseRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        autoCreatePO: zod_1.z.boolean().default(true),
        supplierId: zod_1.z.string().uuid().optional(),
        notes: zod_1.z.string().optional()
    })
});
exports.rejectPurchaseRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().min(1, 'Rejection reason is required')
    })
});
exports.createPurchaseOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid('Branch is required'),
        supplierId: zod_1.z.string().uuid('Supplier is required'),
        requestId: zod_1.z.string().uuid().optional().nullable(),
        deliveryDate: zod_1.z.string().optional(),
        taxAmount: zod_1.z.number().nonnegative().optional().default(0),
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string().uuid('Item is required'),
            orderedQty: zod_1.z.number().positive('Ordered quantity must be greater than 0'),
            unitPrice: zod_1.z.number().nonnegative('Unit price must be non-negative'),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one item is required in the Purchase Order')
    })
});
exports.createGoodsReceiveSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid('Branch is required'),
        warehouseId: zod_1.z.string().uuid('Warehouse is required'),
        supplierId: zod_1.z.string().uuid('Supplier is required'),
        poId: zod_1.z.string().uuid().optional().nullable(),
        receiveDate: zod_1.z.string().optional(),
        invoiceNumber: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            poItemId: zod_1.z.string().uuid().optional().nullable(),
            itemId: zod_1.z.string().uuid('Item is required'),
            receivedQty: zod_1.z.number().positive('Received quantity must be greater than 0'),
            acceptedQty: zod_1.z.number().nonnegative('Accepted quantity must be non-negative'),
            rejectedQty: zod_1.z.number().nonnegative().optional().default(0),
            unitPrice: zod_1.z.number().nonnegative('Unit price must be non-negative'),
            batchNumber: zod_1.z.string().optional(),
            expiryDate: zod_1.z.string().optional(),
            qcStatus: zod_1.z.enum(['PASSED', 'FAILED', 'PENDING']).default('PASSED'),
            qcNotes: zod_1.z.string().optional()
        })).min(1, 'At least one received item is required')
    })
});

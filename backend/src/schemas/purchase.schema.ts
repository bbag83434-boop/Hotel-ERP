import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    code: z.string().min(1, 'Supplier code is required'),
    contactPerson: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    taxNumber: z.string().optional(),
    paymentTerms: z.string().optional().default('Net 30')
  })
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    contactPerson: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    taxNumber: z.string().optional(),
    paymentTerms: z.string().optional(),
    isActive: z.boolean().optional()
  })
});

export const createPurchaseRequestSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Branch is required'),
    requiredDate: z.string().min(1, 'Required date is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        requestedQty: z.number().positive('Quantity must be greater than 0'),
        estimatedPrice: z.number().nonnegative().optional().default(0),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item is required in the purchase request')
  })
});

export const approvePurchaseRequestSchema = z.object({
  body: z.object({
    autoCreatePO: z.boolean().default(true),
    supplierId: z.string().uuid().optional(),
    notes: z.string().optional()
  })
});

export const rejectPurchaseRequestSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required')
  })
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Branch is required'),
    supplierId: z.string().uuid('Supplier is required'),
    requestId: z.string().uuid().optional().nullable(),
    deliveryDate: z.string().optional(),
    taxAmount: z.number().nonnegative().optional().default(0),
    notes: z.string().optional(),
    status: z.enum(['DRAFT', 'ISSUED']).optional().default('ISSUED'),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item is required'),
        orderedQty: z.number().positive('Ordered quantity must be greater than 0'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item is required in the Purchase Order')
  })
});

export const updatePurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid('Supplier is required').optional(),
    deliveryDate: z.string().optional(),
    taxAmount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item is required'),
        orderedQty: z.number().positive('Ordered quantity must be greater than 0'),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item is required').optional()
  })
});

export const updatePOStatusSchema = z.object({
  body: z.object({
    status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']),
    reason: z.string().optional()
  })
});

export const createGoodsReceiveSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Branch is required'),
    warehouseId: z.string().uuid('Warehouse is required'),
    supplierId: z.string().uuid().optional(),
    poId: z.string().uuid().optional().nullable(),
    receiveDate: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceDate: z.string().optional(),
    invoiceAmount: z.number().nonnegative().optional(),
    taxAmount: z.number().nonnegative().optional().default(0),
    freightAmount: z.number().nonnegative().optional().default(0),
    allowPriceVariance: z.boolean().optional().default(false),
    invoiceAttachment: z.object({
      fileName: z.string(),
      fileType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
      fileBase64: z.string(),
      fileSize: z.number().optional()
    }).optional(),
    notes: z.string().optional(),
    status: z.enum(['RECEIVED', 'QC_PASSED']).optional().default('QC_PASSED'),
    items: z.array(
      z.object({
        poItemId: z.string().uuid().optional().nullable(),
        itemId: z.string().uuid('Item is required'),
        receivedQty: z.number().positive('Received quantity must be greater than 0'),
        acceptedQty: z.number().nonnegative('Accepted quantity must be non-negative'),
        rejectedQty: z.number().nonnegative().optional().default(0),
        unitPrice: z.number().nonnegative('Unit price must be non-negative'),
        batchNumber: z.string().optional(),
        expiryDate: z.string().optional(),
        qcStatus: z.enum(['PASSED', 'FAILED', 'PENDING']).default('PASSED'),
        qcNotes: z.string().optional()
      })
    ).min(1, 'At least one received item is required')
  })
});

export const uploadInvoiceSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Branch is required'),
    warehouseId: z.string().uuid('Warehouse is required'),
    supplierId: z.string().uuid('Supplier is required'),
    poId: z.string().uuid().optional().nullable(),
    invoiceNumber: z.string().min(1, 'Invoice number is required'),
    invoiceDate: z.string().optional(),
    invoiceAmount: z.number().positive('Invoice amount must be positive'),
    fileName: z.string().min(1, 'File name is required'),
    fileType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    fileBase64: z.string().min(1, 'File content is required')
  })
});

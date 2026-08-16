import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    code: z.string().min(1, 'Category code is required'),
    description: z.string().optional()
  })
});

export const createUnitSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Unit name is required'),
    symbol: z.string().min(1, 'Unit symbol is required')
  })
});

export const createItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Item name is required'),
    code: z.string().min(1, 'Item code is required'),
    barcode: z.string().optional(),
    categoryId: z.string().uuid('Valid category ID is required'),
    unitId: z.string().uuid('Valid unit ID is required'),
    type: z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SEMI_FINISHED', 'PACKAGING', 'ASSET']).default('RAW_MATERIAL'),
    description: z.string().optional(),
    costPrice: z.number().nonnegative().optional().default(0),
    sellingPrice: z.number().nonnegative().optional().default(0),
    minStockLevel: z.number().nonnegative().optional().default(0),
    reorderQty: z.number().nonnegative().optional().default(0)
  })
});

export const updateItemSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    barcode: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
    type: z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SEMI_FINISHED', 'PACKAGING', 'ASSET']).optional(),
    description: z.string().optional(),
    costPrice: z.number().nonnegative().optional(),
    sellingPrice: z.number().nonnegative().optional(),
    minStockLevel: z.number().nonnegative().optional(),
    reorderQty: z.number().nonnegative().optional(),
    isActive: z.boolean().optional()
  })
});

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Warehouse name is required'),
    code: z.string().min(1, 'Warehouse code is required'),
    branchId: z.string().uuid().optional().nullable(),
    isCentral: z.boolean().default(false),
    address: z.string().optional()
  })
});

export const transferStockSchema = z.object({
  body: z.object({
    fromWarehouseId: z.string().uuid('Source warehouse is required'),
    toWarehouseId: z.string().uuid('Destination warehouse is required'),
    transferDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        quantity: z.number().positive('Quantity must be greater than 0'),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item must be selected for transfer')
  })
});

export const adjustStockSchema = z.object({
  body: z.object({
    warehouseId: z.string().uuid('Warehouse ID is required'),
    itemId: z.string().uuid('Item ID is required'),
    newQuantity: z.number().nonnegative('New quantity must be 0 or greater'),
    reason: z.string().min(1, 'Reason for stock adjustment is required')
  })
});

export const createRequisitionSchema = z.object({
  body: z.object({
    fromWarehouseId: z.string().uuid('Source / issuing warehouse is required'),
    toWarehouseId: z.string().uuid('Destination / requesting warehouse is required'),
    departmentId: z.string().uuid().optional().nullable(),
    section: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    notes: z.string().optional(),
    submitImmediately: z.boolean().optional().default(false),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        requestedQty: z.number().positive('Requested quantity must be greater than 0'),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item must be included in requisition')
  })
});

export const submitRequisitionSchema = z.object({
  body: z.object({
    notes: z.string().optional()
  }).optional()
});

export const approveRequisitionSchema = z.object({
  body: z.object({
    comment: z.string().optional()
  }).optional()
});

export const rejectRequisitionSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required')
  })
});

export const dispatchTransferSchema = z.object({
  body: z.object({
    notes: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        dispatchQty: z.number().positive('Dispatch quantity must be greater than 0')
      })
    ).optional()
  }).optional()
});

export const receiveTransferSchema = z.object({
  body: z.object({
    notes: z.string().optional(),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        receivedQty: z.number().positive('Received quantity must be greater than 0')
      })
    ).optional()
  }).optional()
});

export const recordWastageSchema = z.object({
  body: z.object({
    branchId: z.string().uuid().optional(),
    warehouseId: z.string().uuid('Warehouse ID is required'),
    wastageType: z.enum([
      'EXPIRED',
      'SPOILED',
      'DAMAGED',
      'WRONG_PREPARATION',
      'OVERPRODUCTION',
      'RETURNED_DISCARDED',
      'PRODUCTION_LOSS'
    ]),
    reason: z.string().min(1, 'Reason for wastage is required'),
    items: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        quantity: z.number().positive('Quantity must be greater than 0'),
        batchNumber: z.string().optional(),
        reason: z.string().optional()
      })
    ).min(1, 'At least one item must be specified for wastage recording'),
    notes: z.string().optional()
  })
});

export const reconcileStockCountSchema = z.object({
  body: z.object({
    branchId: z.string().uuid().optional(),
    warehouseId: z.string().uuid('Warehouse ID is required'),
    notes: z.string().optional(),
    countedItems: z.array(
      z.object({
        itemId: z.string().uuid('Item ID is required'),
        countedQty: z.number().min(0, 'Counted quantity cannot be negative'),
        notes: z.string().optional()
      })
    ).min(1, 'At least one item must be included in the physical count')
  })
});


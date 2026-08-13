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

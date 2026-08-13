import { z } from 'zod';

export const createRecipeSchema = z.object({
  body: z.object({
    finishedItemId: z.string().uuid('Finished item is required'),
    name: z.string().min(1, 'Recipe name is required'),
    code: z.string().min(1, 'Recipe code is required'),
    description: z.string().optional(),
    yieldQty: z.number().positive('Yield quantity must be greater than 0').default(1),
    preparationMinutes: z.number().int().nonnegative().optional().default(15),
    instructions: z.string().optional(),
    ingredients: z.array(
      z.object({
        rawItemId: z.string().uuid('Raw material item is required'),
        quantity: z.number().positive('Ingredient quantity must be greater than 0'),
        unitId: z.string().uuid().optional(),
        notes: z.string().optional()
      })
    ).min(1, 'At least one raw ingredient is required')
  })
});

export const updateRecipeSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    description: z.string().optional(),
    yieldQty: z.number().positive().optional(),
    preparationMinutes: z.number().int().nonnegative().optional(),
    instructions: z.string().optional(),
    isActive: z.boolean().optional(),
    ingredients: z.array(
      z.object({
        rawItemId: z.string().uuid('Raw material item is required'),
        quantity: z.number().positive('Ingredient quantity must be greater than 0'),
        unitId: z.string().uuid().optional(),
        notes: z.string().optional()
      })
    ).optional()
  })
});

export const previewProductionSchema = z.object({
  body: z.object({
    recipeId: z.string().uuid('Recipe ID is required'),
    plannedQty: z.number().positive('Planned quantity must be greater than 0'),
    kitchenWarehouseId: z.string().uuid('Kitchen warehouse ID is required')
  })
});

export const createProductionOrderSchema = z.object({
  body: z.object({
    branchId: z.string().uuid('Branch is required'),
    kitchenWarehouseId: z.string().uuid('Kitchen warehouse is required'),
    recipeId: z.string().uuid('Recipe is required'),
    plannedQty: z.number().positive('Planned quantity must be greater than 0'),
    actualYieldQty: z.number().positive('Actual yield quantity must be greater than 0'),
    wastageQty: z.number().nonnegative().optional().default(0),
    plannedDate: z.string().optional(),
    notes: z.string().optional()
  })
});

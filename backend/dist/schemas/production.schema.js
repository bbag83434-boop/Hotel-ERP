"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductionOrderSchema = exports.previewProductionSchema = exports.updateRecipeSchema = exports.createRecipeSchema = void 0;
const zod_1 = require("zod");
exports.createRecipeSchema = zod_1.z.object({
    body: zod_1.z.object({
        finishedItemId: zod_1.z.string().uuid('Finished item is required'),
        name: zod_1.z.string().min(1, 'Recipe name is required'),
        code: zod_1.z.string().min(1, 'Recipe code is required'),
        description: zod_1.z.string().optional(),
        yieldQty: zod_1.z.number().positive('Yield quantity must be greater than 0').default(1),
        preparationMinutes: zod_1.z.number().int().nonnegative().optional().default(15),
        instructions: zod_1.z.string().optional(),
        ingredients: zod_1.z.array(zod_1.z.object({
            rawItemId: zod_1.z.string().uuid('Raw material item is required'),
            quantity: zod_1.z.number().positive('Ingredient quantity must be greater than 0'),
            unitId: zod_1.z.string().uuid().optional(),
            notes: zod_1.z.string().optional()
        })).min(1, 'At least one raw ingredient is required')
    })
});
exports.updateRecipeSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        code: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        yieldQty: zod_1.z.number().positive().optional(),
        preparationMinutes: zod_1.z.number().int().nonnegative().optional(),
        instructions: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional(),
        ingredients: zod_1.z.array(zod_1.z.object({
            rawItemId: zod_1.z.string().uuid('Raw material item is required'),
            quantity: zod_1.z.number().positive('Ingredient quantity must be greater than 0'),
            unitId: zod_1.z.string().uuid().optional(),
            notes: zod_1.z.string().optional()
        })).optional()
    })
});
exports.previewProductionSchema = zod_1.z.object({
    body: zod_1.z.object({
        recipeId: zod_1.z.string().uuid('Recipe ID is required'),
        plannedQty: zod_1.z.number().positive('Planned quantity must be greater than 0'),
        kitchenWarehouseId: zod_1.z.string().uuid('Kitchen warehouse ID is required')
    })
});
exports.createProductionOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        branchId: zod_1.z.string().uuid('Branch is required'),
        kitchenWarehouseId: zod_1.z.string().uuid('Kitchen warehouse is required'),
        recipeId: zod_1.z.string().uuid('Recipe is required'),
        plannedQty: zod_1.z.number().positive('Planned quantity must be greater than 0'),
        actualYieldQty: zod_1.z.number().positive('Actual yield quantity must be greater than 0'),
        wastageQty: zod_1.z.number().nonnegative().optional().default(0),
        plannedDate: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional()
    })
});

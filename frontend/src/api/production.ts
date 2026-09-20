import { apiClient } from './client';
import {
  Recipe,
  ProductionOrder,
  ProductionPreview,
} from '../types/production.types';

/**
 * Recipe API response normalizer.
 *
 * Backend RecipeResponse uses snake_case fields while the frontend Recipe
 * type primarily uses camelCase. Normalize only at the API boundary so
 * RecipeManager and other Recipe consumers receive one consistent shape.
 */
const normalizeRecipe = (recipe: any): Recipe => ({
  ...recipe,

  id: recipe.id,
  companyId: recipe.companyId ?? recipe.company_id,

  finishedItemId: recipe.finishedItemId ?? recipe.finished_item_id,
  finishedItemName: recipe.finishedItemName ?? recipe.finished_item_name,
  finishedItemCode: recipe.finishedItemCode ?? recipe.finished_item_code,
  finishedUnitSymbol:
    recipe.finishedUnitSymbol ?? recipe.finished_unit_symbol,

  name: recipe.name,
  code: recipe.code,
  version: recipe.version,

  effectiveDate: recipe.effectiveDate ?? recipe.effective_date,
  effectiveTo: recipe.effectiveTo ?? recipe.effective_to,
  isCurrent: recipe.isCurrent ?? recipe.is_current,

  description: recipe.description,
  yieldQty: recipe.yieldQty ?? recipe.yield_qty,
  preparationMinutes:
    recipe.preparationMinutes ?? recipe.preparation_minutes,
  instructions: recipe.instructions,

  isActive: recipe.isActive ?? recipe.is_active,

  totalRecipeCost:
    recipe.totalRecipeCost ?? recipe.total_recipe_cost,
  unitCost: recipe.unitCost ?? recipe.unit_cost,

  createdAt: recipe.createdAt ?? recipe.created_at,
  updatedAt: recipe.updatedAt ?? recipe.updated_at,

  ingredients: Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ingredient: any) => ({
        ...ingredient,

        id: ingredient.id,
        recipeId: ingredient.recipeId ?? ingredient.recipe_id,
        rawItemId: ingredient.rawItemId ?? ingredient.raw_item_id,
        unitId: ingredient.unitId ?? ingredient.unit_id,

        quantity: ingredient.quantity,
        grossQuantity:
          ingredient.grossQuantity ?? ingredient.gross_quantity,

        usableYield:
          ingredient.usableYield ?? ingredient.usable_yield,

        wastePercentage:
          ingredient.wastePercentage ?? ingredient.waste_percentage,

        costContribution:
          ingredient.costContribution ??
          ingredient.cost_contribution,

        itemName: ingredient.itemName ?? ingredient.item_name,
        itemCode: ingredient.itemCode ?? ingredient.item_code,
        itemType: ingredient.itemType ?? ingredient.item_type,
        unitSymbol: ingredient.unitSymbol ?? ingredient.unit_symbol,

        unitCost: ingredient.unitCost ?? ingredient.unit_cost,

        isSubRecipe:
          ingredient.isSubRecipe ?? ingredient.is_sub_recipe,

        subRecipeId:
          ingredient.subRecipeId ?? ingredient.sub_recipe_id,

        notes: ingredient.notes ?? null,
      }))
    : [],
});

const normalizeRecipeList = (recipes: any): Recipe[] =>
  Array.isArray(recipes) ? recipes.map(normalizeRecipe) : [];

export const productionApi = {
  // 1. Recipe & BOM Master
  getRecipes: async (
    params?: {
      branch_id?: string;
      is_active?: boolean;
      search?: string;
    },
  ): Promise<Recipe[]> => {
    const res = await apiClient.get<Recipe[]>('/recipes', { params });
    return normalizeRecipeList(res.data);
  },

  getRecipe: async (id: string): Promise<Recipe> => {
    const res = await apiClient.get<Recipe>(`/recipes/${id}`);
    return normalizeRecipe(res.data);
  },

  createRecipe: async (payload: any): Promise<Recipe> => {
    const res = await apiClient.post<Recipe>('/recipes', payload);
    return normalizeRecipe(res.data);
  },

  updateRecipe: async (id: string, payload: any): Promise<Recipe> => {
    const res = await apiClient.put<Recipe>(`/recipes/${id}`, payload);
    return normalizeRecipe(res.data);
  },

  cloneRecipe: async (
    id: string,
    payload?: {
      new_name?: string;
      new_code?: string;
    },
  ): Promise<Recipe> => {
    const res = await apiClient.post<Recipe>(
      `/recipes/${id}/clone`,
      payload,
    );
    return normalizeRecipe(res.data);
  },

  getRecipeHistory: async (id: string): Promise<Recipe[]> => {
    const res = await apiClient.get<Recipe[]>(`/recipes/${id}/history`);
    return normalizeRecipeList(res.data);
  },

  deleteRecipe: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/recipes/${id}`);
    return res.data;
  },

  getRecipeCosting: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/recipes/${id}/costing`);
    return res.data;
  },

  explodeRecipe: async (
    id: string,
    payload: {
      target_yield_qty: number;
      warehouse_id?: string;
    },
  ): Promise<any> => {
    const res = await apiClient.post(
      `/recipes/${id}/explode`,
      payload,
    );
    return res.data;
  },

  // 2. Production Engine & Batch Orders
  getProductionOrders: async (
    params?: {
      branch_id?: string;
      status?: string;
      kitchen_warehouse_id?: string;
    },
  ): Promise<ProductionOrder[]> => {
    const res = await apiClient.get<ProductionOrder[]>(
      '/recipes/production/orders',
      { params },
    );
    return res.data;
  },

  getProductionOrder: async (
    id: string,
  ): Promise<ProductionOrder> => {
    const res = await apiClient.get<ProductionOrder>(
      `/recipes/production/orders/${id}`,
    );
    return res.data;
  },

  createProductionOrder: async (
    payload: any,
  ): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>(
      '/recipes/production/orders',
      payload,
    );
    return res.data;
  },

  previewProduction: async (payload: {
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
  }): Promise<ProductionPreview> => {
    const res = await apiClient.post<ProductionPreview>(
      '/recipes/production/preview',
      payload,
    );
    return res.data;
  },

  executeProduction: async (payload: {
    branch_id: string;
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
    actual_yield_qty?: number;
    wastage_qty?: number;
    batch_number?: string;
    expiry_date?: string;
    custom_consumptions?: Array<{
      raw_item_id: string;
      actual_consumed_qty: number;
    }>;
    notes?: string;
    idempotency_key?: string;
  }): Promise<ProductionOrder> => {
    const finalPayload = {
      ...payload,
      idempotency_key:
        payload.idempotency_key || crypto.randomUUID(),
    };

    const res = await apiClient.post<ProductionOrder>(
      '/recipes/production/execute',
      finalPayload,
    );
    return res.data;
  },

  checkSufficiency: async (orderId: string): Promise<any> => {
    const res = await apiClient.post(
      `/recipes/production/orders/${orderId}/check-sufficiency`,
    );
    return res.data;
  },

  updateProductionStatus: async (
    orderId: string,
    payload: {
      status: string;
      actual_yield_qty?: number;
      wastage_qty?: number;
      batch_number?: string;
      expiry_date?: string;
      notes?: string;
    },
  ): Promise<ProductionOrder> => {
    const res = await apiClient.put<ProductionOrder>(
      `/recipes/production/orders/${orderId}/status`,
      payload,
    );
    return res.data;
  },

  getProductionVariance: async (
    orderId: string,
  ): Promise<any> => {
    const res = await apiClient.get(
      `/recipes/production/orders/${orderId}/variance`,
    );
    return res.data;
  },

  reverseProduction: async (
    orderId: string,
    payload: { reason: string },
  ): Promise<any> => {
    const res = await apiClient.post(
      `/recipes/production/orders/${orderId}/reverse`,
      payload,
    );
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Central Kitchen Production API — completely separate from general production
// and Kitchen Order / Transfer / Dispatch flow.
// ─────────────────────────────────────────────────────────────────────────────
export const centralKitchenProductionApi = {
  getCentralKitchenConfig: async (): Promise<{
    branch_id: string;
    branch_name: string;
    branch_code: string;
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
  }> => {
    const res = await apiClient.get(
      '/recipes/production/central-kitchen/config',
    );
    return res.data;
  },

  /** Production history scoped to central kitchen branches only */
  getCentralKitchenOrders: async (params?: {
    warehouse_id?: string;
    recipe_id?: string;
  }): Promise<ProductionOrder[]> => {
    const res = await apiClient.get<ProductionOrder[]>(
      '/recipes/production/central-kitchen/orders',
      { params },
    );
    return res.data;
  },

  /** Preview/sufficiency check — reuses existing production/preview endpoint */
  previewProduction: async (payload: {
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
  }): Promise<ProductionPreview> => {
    const res = await apiClient.post<ProductionPreview>(
      '/recipes/production/preview',
      payload,
    );
    return res.data;
  },

  /** Execute production — reuses existing execute endpoint with idempotency */
  executeProduction: async (payload: {
    branch_id: string;
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
    actual_yield_qty?: number;
    wastage_qty?: number;
    batch_number?: string;
    expiry_date?: string;
    notes?: string;
    idempotency_key?: string;
  }): Promise<ProductionOrder> => {
    const finalPayload = {
      ...payload,
      idempotency_key:
        payload.idempotency_key || crypto.randomUUID(),
    };

    const res = await apiClient.post<ProductionOrder>(
      '/recipes/production/execute',
      finalPayload,
    );
    return res.data;
  },
};

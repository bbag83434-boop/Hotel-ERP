import { apiClient } from './axios';
import { Recipe, ProductionPreview, ProductionOrder } from '../types/production.types';

export const productionApi = {
  // Recipes
  getRecipes: async (params?: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ recipes: Recipe[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/production/recipes', { params });
    return { recipes: res.data.data, pagination: res.data.meta };
  },
  getRecipeById: async (id: string): Promise<Recipe> => {
    const res = await apiClient.get(`/production/recipes/${id}`);
    return res.data.data;
  },
  createRecipe: async (data: {
    finishedItemId: string;
    name: string;
    code: string;
    description?: string;
    yieldQty?: number;
    preparationMinutes?: number;
    instructions?: string;
    ingredients: Array<{ rawItemId: string; quantity: number; unitId?: string; notes?: string }>;
  }): Promise<Recipe> => {
    const res = await apiClient.post('/production/recipes', data);
    return res.data.data;
  },
  updateRecipe: async (
    id: string,
    data: Partial<Omit<Recipe, 'ingredients'>> & {
      ingredients?: Array<{ rawItemId: string; quantity: number; unitId?: string; notes?: string }>;
    }
  ): Promise<Recipe> => {
    const res = await apiClient.put(`/production/recipes/${id}`, data);
    return res.data.data;
  },

  // Preview Production
  previewProduction: async (data: {
    recipeId: string;
    plannedQty: number;
    kitchenWarehouseId: string;
  }): Promise<ProductionPreview> => {
    const res = await apiClient.post('/production/preview', data);
    return res.data.data;
  },

  // Production Orders
  getProductionOrders: async (params?: {
    branchId?: string;
    kitchenWarehouseId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: ProductionOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/production/orders', { params });
    return { orders: res.data.data, pagination: res.data.meta };
  },
  executeProductionOrder: async (data: {
    branchId: string;
    kitchenWarehouseId: string;
    recipeId: string;
    plannedQty: number;
    actualYieldQty: number;
    wastageQty?: number;
    plannedDate?: string;
    notes?: string;
  }): Promise<ProductionOrder> => {
    const res = await apiClient.post('/production/orders', data);
    return res.data.data;
  }
};

import { apiClient } from './client';
import {
  Recipe,
  ProductionOrder,
  ProductionPreview,
} from '../types/production.types';

export const productionApi = {
  // 1. Recipe & BOM Master
  getRecipes: async (params?: { branch_id?: string; is_active?: boolean; search?: string }): Promise<Recipe[]> => {
    const res = await apiClient.get<Recipe[]>('/recipes', { params });
    return res.data;
  },
  getRecipe: async (id: string): Promise<Recipe> => {
    const res = await apiClient.get<Recipe>(`/recipes/${id}`);
    return res.data;
  },
  createRecipe: async (payload: any): Promise<Recipe> => {
    const res = await apiClient.post<Recipe>('/recipes', payload);
    return res.data;
  },
  updateRecipe: async (id: string, payload: any): Promise<Recipe> => {
    const res = await apiClient.put<Recipe>(`/recipes/${id}`, payload);
    return res.data;
  },
  cloneRecipe: async (id: string, payload?: { new_name?: string; new_code?: string }): Promise<Recipe> => {
    const res = await apiClient.post<Recipe>(`/recipes/${id}/clone`, payload);
    return res.data;
  },
  getRecipeCosting: async (id: string): Promise<any> => {
    const res = await apiClient.get(`/recipes/${id}/costing`);
    return res.data;
  },
  explodeRecipe: async (id: string, payload: { target_yield_qty: number; warehouse_id?: string }): Promise<any> => {
    const res = await apiClient.post(`/recipes/${id}/explode`, payload);
    return res.data;
  },

  // 2. Production Engine & Batch Orders
  getProductionOrders: async (params?: { branch_id?: string; status?: string; kitchen_warehouse_id?: string }): Promise<ProductionOrder[]> => {
    const res = await apiClient.get<ProductionOrder[]>('/recipes/production/orders', { params });
    return res.data;
  },
  getProductionOrder: async (id: string): Promise<ProductionOrder> => {
    const res = await apiClient.get<ProductionOrder>(`/recipes/production/orders/${id}`);
    return res.data;
  },
  createProductionOrder: async (payload: any): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>('/recipes/production/orders', payload);
    return res.data;
  },
  previewProduction: async (payload: {
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
  }): Promise<ProductionPreview> => {
    const res = await apiClient.post<ProductionPreview>('/recipes/production/preview', payload);
    return res.data;
  },
  executeProduction: async (payload: {
    recipe_id: string;
    planned_qty: number;
    kitchen_warehouse_id: string;
    actual_yield_qty?: number;
    wastage_qty?: number;
    batch_number?: string;
    expiry_date?: string;
    custom_consumptions?: Array<{ raw_item_id: string; actual_consumed_qty: number }>;
    notes?: string;
  }): Promise<ProductionOrder> => {
    const res = await apiClient.post<ProductionOrder>('/recipes/production/execute', payload);
    return res.data;
  },
  checkSufficiency: async (orderId: string): Promise<any> => {
    const res = await apiClient.post(`/recipes/production/orders/${orderId}/check-sufficiency`);
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
    }
  ): Promise<ProductionOrder> => {
    const res = await apiClient.put<ProductionOrder>(`/recipes/production/orders/${orderId}/status`, payload);
    return res.data;
  },
  getProductionVariance: async (orderId: string): Promise<any> => {
    const res = await apiClient.get(`/recipes/production/orders/${orderId}/variance`);
    return res.data;
  },
  reverseProduction: async (orderId: string, payload: { reason: string }): Promise<any> => {
    const res = await apiClient.post(`/recipes/production/orders/${orderId}/reverse`, payload);
    return res.data;
  },
};

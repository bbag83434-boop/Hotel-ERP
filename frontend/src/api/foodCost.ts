import { apiClient } from './client';
import {
  FoodCostCalculationRequest,
  FoodCostCalculationResponse,
  FoodCostConfigAdmin,
  FoodCostConfigPublic,
  FoodCostConfigUpdate,
  FoodCostSnapshot,
  FoodCostSnapshotList,
} from '../types/food-cost.types';

export const foodCostApi = {
  calculate: async (payload: FoodCostCalculationRequest): Promise<FoodCostCalculationResponse> => {
    const res = await apiClient.post<FoodCostCalculationResponse>('/food-cost/calculate', payload);
    return res.data;
  },

  calculateWithMarkup: async (
    payload: FoodCostCalculationRequest,
    markupPercentage: number
  ): Promise<FoodCostCalculationResponse> => {
    const res = await apiClient.post<FoodCostCalculationResponse>(
      '/food-cost/calculate',
      payload,
      { params: { markup_percentage: markupPercentage } }
    );
    return res.data;
  },

  getPublicConfig: async (): Promise<FoodCostConfigPublic> => {
    const res = await apiClient.get<FoodCostConfigPublic>('/food-cost/config');
    return res.data;
  },

  getAdminConfig: async (): Promise<FoodCostConfigAdmin> => {
    const res = await apiClient.get<FoodCostConfigAdmin>('/food-cost/admin/config');
    return res.data;
  },

  updateAdminConfig: async (payload: FoodCostConfigUpdate): Promise<FoodCostConfigAdmin> => {
    const res = await apiClient.put<FoodCostConfigAdmin>('/food-cost/admin/config', payload);
    return res.data;
  },

  getSnapshots: async (params?: { limit?: number; offset?: number }): Promise<FoodCostSnapshotList> => {
    const res = await apiClient.get<FoodCostSnapshotList>('/food-cost/snapshots', { params });
    return res.data;
  },

  save: async (payload: FoodCostCalculationRequest & { markupPercentage?: number }): Promise<FoodCostSnapshot> => {
    const res = await apiClient.post<FoodCostSnapshot>('/food-cost/save', payload);
    return res.data;
  },
};


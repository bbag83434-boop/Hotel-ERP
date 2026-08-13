import { apiClient } from './axios';
import { ExecutiveDashboardMetrics, AIAssistantResponse } from '../types/dashboard.types';

export const dashboardApi = {
  getMetrics: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<ExecutiveDashboardMetrics> => {
    const res = await apiClient.get('/dashboard/metrics', { params });
    return res.data.data;
  }
};

export const aiApi = {
  queryAssistant: async (query: string, branchId?: string): Promise<AIAssistantResponse> => {
    const res = await apiClient.post('/ai/query', { query, branchId });
    return res.data.data;
  }
};

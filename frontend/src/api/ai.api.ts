import { apiClient } from './axios';
import { AIAssistantResponse } from '../types/dashboard.types';

export const aiApi = {
  queryAssistant: async (query: string, branchId?: string): Promise<AIAssistantResponse> => {
    const res = await apiClient.post('/ai/query', { query, branchId });
    return res.data.data;
  }
};

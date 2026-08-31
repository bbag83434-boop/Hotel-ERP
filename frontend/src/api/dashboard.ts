import { apiClient } from '@/api/client';
import { DashboardTrendResponse } from '@/types/dashboard.types';

export const dashboardApi = {
  getTrend: async (days: number = 30, branchId?: string): Promise<DashboardTrendResponse> => {
    const res = await apiClient.get<DashboardTrendResponse>('/dashboard/trend', {
      params: {
        days,
        branch_id: branchId,
      },
    });
    return res.data;
  },
};

export default dashboardApi;

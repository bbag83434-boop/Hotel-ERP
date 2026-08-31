import { apiClient } from './client';

export interface WastageSalesIntelligence {
  period: { start: string; end: string; days: number };
  outlet: { branch_id: string; branch_name: string };
  sales: {
    revenue: number; orders: number; average_bill: number; previous_revenue: number; change_percentage: number | null;
    top_products: Array<{ item_id: string; item_name: string; quantity: number; revenue: number }>;
    low_selling_products: Array<{ item_id: string; item_name: string; quantity: number; revenue: number }>;
    peak_hours: Array<{ hour: number; orders: number; revenue: number }>;
  };
  wastage: {
    cost: number; previous_cost: number; change_percentage: number | null; cost_as_percent_of_sales: number;
    top_items: Array<{ item_id: string; item_name: string; quantity: number; cost: number }>;
  };
  signals: Array<{ severity: string; type: string; message: string }>;
  source: string;
}

export const aiIntelligenceApi = {
  getWastageSales: async (days = 7): Promise<WastageSalesIntelligence> => {
    const res = await apiClient.get<{ success: boolean; data: WastageSalesIntelligence }>('/ai/intelligence/wastage-sales', { params: { days } });
    return res.data.data;
  },
};

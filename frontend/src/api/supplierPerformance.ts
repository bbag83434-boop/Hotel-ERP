import { apiClient } from './client';

export interface SupplierPerformanceRow {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  po_count: number;
  purchase_spend: number;
  ordered_qty: number;
  received_qty: number;
  fulfillment_percent: number;
  on_time_delivery_percent: number;
  delivery_checked: number;
  average_delivery_delay_days: number;
  rejected_qty: number;
  damaged_qty: number;
  quality_issue_percent: number;
  bill_count: number;
  billed_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  rating: number;
}

export const supplierPerformanceApi = {
  get: async (params?: { days?: number; supplier_id?: string; branch_id?: string }) => {
    const res = await apiClient.get<{days:number;supplier_count:number;suppliers:SupplierPerformanceRow[]}>('/procurement/supplier-performance', { params });
    return res.data;
  },
};

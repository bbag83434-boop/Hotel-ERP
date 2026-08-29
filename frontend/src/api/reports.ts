import axios from 'axios';
import { apiClient } from '@/api/client';
import {
  ExecutiveDashboardResponse,
  SalesSummaryResponse,
  InventoryValuationResponse,
  FoodCostVarianceResponse,
  WastageSummaryReportResponse,
  ProcurementSummaryResponse,
  VendorReportResponse,
  ReportExportRequest,
  ReportExportResponse,
  ReportSnapshot,
  OutletDashboardResponse,
} from '@/types/reports.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('apex_auth_token') || localStorage.getItem('token') : null;
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  };
};

export const reportsApi = {
  getOutletDashboard: async (branchId?: string): Promise<OutletDashboardResponse> => {
    const res = await apiClient.get('/reports/outlet-dashboard', {
      params: {
        branch_id: branchId,
      },
    });
    return res.data;
  },
  getExecutiveSummary: async (params?: { startDate?: string; endDate?: string }): Promise<ExecutiveDashboardResponse> => {
    const res = await axios.get(`${API_BASE}/reports/executive-summary`, {
      ...getAuthHeaders(),
      params: {
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  getSalesSummary: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<SalesSummaryResponse> => {
    const res = await axios.get(`${API_BASE}/reports/sales-summary`, {
      ...getAuthHeaders(),
      params: {
        branch_id: params?.branchId,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  getInventoryValuation: async (params?: { branchId?: string; warehouseId?: string; categoryId?: string }): Promise<InventoryValuationResponse> => {
    const res = await axios.get(`${API_BASE}/reports/inventory-valuation`, {
      ...getAuthHeaders(),
      params: {
        branch_id: params?.branchId,
        warehouse_id: params?.warehouseId,
        category_id: params?.categoryId,
      },
    });
    return res.data;
  },

  getFoodCostVariance: async (params?: { startDate?: string; endDate?: string }): Promise<FoodCostVarianceResponse> => {
    const res = await axios.get(`${API_BASE}/reports/food-cost-variance`, {
      ...getAuthHeaders(),
      params: {
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  getWastageSummary: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<WastageSummaryReportResponse> => {
    const res = await axios.get(`${API_BASE}/reports/wastage-summary`, {
      ...getAuthHeaders(),
      params: {
        branch_id: params?.branchId,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  getProcurementSummary: async (params?: { startDate?: string; endDate?: string }): Promise<ProcurementSummaryResponse> => {
    const res = await axios.get(`${API_BASE}/reports/procurement-summary`, {
      ...getAuthHeaders(),
      params: {
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  getVendorReport: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<VendorReportResponse> => {
    const res = await axios.get(`${API_BASE}/reports/vendor-report`, {
      ...getAuthHeaders(),
      params: {
        branch_id: params?.branchId,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return res.data;
  },

  exportReport: async (payload: ReportExportRequest): Promise<ReportExportResponse> => {
    const res = await axios.post(`${API_BASE}/reports/export`, payload, getAuthHeaders());
    return res.data;
  },

  getSnapshots: async (params?: { reportType?: string; branchId?: string }): Promise<ReportSnapshot[]> => {
    const res = await axios.get(`${API_BASE}/reports/snapshots`, {
      ...getAuthHeaders(),
      params: {
        report_type: params?.reportType,
        branch_id: params?.branchId,
      },
    });
    return res.data;
  },
};

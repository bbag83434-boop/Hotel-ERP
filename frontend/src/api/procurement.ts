import { apiClient } from './client';
import {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  SmartRequirementDraft,
  BranchRequirementConfig,
  SmartAIAskResponse,
  SmartRequirementItem,
} from '../types/purchase.types';

export const procurementApi = {
  // 1. Supplier Master
  getSuppliers: async (params?: { is_active?: boolean }): Promise<Supplier[]> => {
    const res = await apiClient.get<Supplier[]>('/procurement/suppliers', { params });
    return res.data;
  },
  createSupplier: async (payload: Partial<Supplier>): Promise<Supplier> => {
    const res = await apiClient.post<Supplier>('/procurement/suppliers', payload);
    return res.data;
  },
  updateSupplier: async (id: string, payload: Partial<Supplier>): Promise<Supplier> => {
    const res = await apiClient.put<Supplier>(`/procurement/suppliers/${id}`, payload);
    return res.data;
  },

  // 2. Purchase Requests (Indents)
  getPurchaseRequests: async (params?: { branch_id?: string; status?: string }): Promise<PurchaseRequest[]> => {
    const res = await apiClient.get<PurchaseRequest[]>('/procurement/requests', { params });
    return res.data;
  },
  createPurchaseRequest: async (payload: any): Promise<PurchaseRequest> => {
    const res = await apiClient.post<PurchaseRequest>('/procurement/requests', payload);
    return res.data;
  },

  // 3. Auto Consolidation & WhatsApp Order Workflow
  consolidateOrders: async (payload: { request_ids: string[]; auto_submit?: boolean; notes?: string }): Promise<any> => {
    const res = await apiClient.post('/procurement/orders/consolidate', payload);
    return res.data;
  },
  submitOrder: async (orderId: string): Promise<PurchaseOrder> => {
    const res = await apiClient.post<PurchaseOrder>(`/procurement/orders/${orderId}/submit`);
    return res.data;
  },
  approveOrder: async (orderId: string, payload?: { notes?: string }): Promise<PurchaseOrder> => {
    const res = await apiClient.post<PurchaseOrder>(`/procurement/orders/${orderId}/approve`, payload);
    return res.data;
  },
  rejectOrder: async (orderId: string, payload: { reason: string }): Promise<PurchaseOrder> => {
    const res = await apiClient.post<PurchaseOrder>(`/procurement/orders/${orderId}/reject`, payload);
    return res.data;
  },
  getWhatsAppLink: async (orderId: string): Promise<any> => {
    const res = await apiClient.post(`/procurement/orders/${orderId}/whatsapp-link`);
    return res.data;
  },
  confirmSent: async (orderId: string, payload?: { notes?: string }): Promise<any> => {
    const res = await apiClient.post(`/procurement/orders/${orderId}/confirm-sent`, payload);
    return res.data;
  },

  // 4. Outlet Smart AI Requirement Endpoints
  generateSmartRequirement: async (payload: {
    branch_id: string;
    draft_date?: string;
    lead_time_days?: number;
    safety_buffer_percent?: number;
    force_regenerate?: boolean;
    notes?: string;
  }): Promise<SmartRequirementDraft> => {
    const res = await apiClient.post<SmartRequirementDraft>('/procurement/smart-requirements/generate', payload);
    return res.data;
  },
  getSmartRequirementDraft: async (branchId: string): Promise<SmartRequirementDraft> => {
    const res = await apiClient.get<SmartRequirementDraft>(`/procurement/smart-requirements/draft/${branchId}`);
    return res.data;
  },
  updateSmartRequirementDraftItems: async (
    draftId: string,
    payload: { items: SmartRequirementItem[]; notes?: string }
  ): Promise<SmartRequirementDraft> => {
    const res = await apiClient.put<SmartRequirementDraft>(`/procurement/smart-requirements/draft/${draftId}/items`, payload);
    return res.data;
  },
  confirmSmartRequirementDraft: async (
    draftId: string,
    payload?: { notes?: string; priority?: string }
  ): Promise<any> => {
    const res = await apiClient.post(`/procurement/smart-requirements/draft/${draftId}/confirm`, payload);
    return res.data;
  },
  askSmartRequirementAssistant: async (payload: { branch_id: string; question: string }): Promise<SmartAIAskResponse> => {
    const res = await apiClient.post<SmartAIAskResponse>('/procurement/smart-requirements/ask', payload);
    return res.data;
  },
  getBranchRequirementConfig: async (branchId: string): Promise<BranchRequirementConfig> => {
    const res = await apiClient.get<BranchRequirementConfig>(`/procurement/smart-requirements/config/${branchId}`);
    return res.data;
  },
  updateBranchRequirementConfig: async (
    branchId: string,
    payload: Partial<BranchRequirementConfig>
  ): Promise<BranchRequirementConfig> => {
    const res = await apiClient.put<BranchRequirementConfig>(`/procurement/smart-requirements/config/${branchId}`, payload);
    return res.data;
  },
  processScheduledRequirements: async (): Promise<any> => {
    const res = await apiClient.post('/procurement/smart-requirements/process-schedules');
    return res.data;
  },
};

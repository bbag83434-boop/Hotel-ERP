import { apiClient } from './client';
import {
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceiveNote,
  GoodsReceiveNoteCreate,
  GoodsReceiveFromPOCreateInput,
  SupplierInvoiceUploadResult,
  PurchaseOrderCreate,
  ThreeWayMatchResponse,
  OutletClosingRecord,
  ActiveClosingDraft,
  ClosingSubmitRequest,
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

  // 2. Purchase Requests (Indents) & Central Purchase Control Queue
  getPurchaseRequests: async (params?: { branch_id?: string; status_filter?: string; priority?: string; search?: string }): Promise<PurchaseRequest[]> => {
    const res = await apiClient.get<PurchaseRequest[]>('/procurement/requests', { params });
    return res.data;
  },
  getPurchaseRequest: async (id: string): Promise<PurchaseRequest> => {
    const res = await apiClient.get<PurchaseRequest>(`/procurement/requests/${id}`);
    return res.data;
  },
  createPurchaseRequest: async (payload: any): Promise<PurchaseRequest> => {
    const res = await apiClient.post<PurchaseRequest>('/procurement/requests', payload);
    return res.data;
  },
  updatePurchaseRequest: async (id: string, payload: any): Promise<PurchaseRequest> => {
    const res = await apiClient.put<PurchaseRequest>(`/procurement/requests/${id}`, payload);
    return res.data;
  },
  approvePurchaseRequest: async (id: string): Promise<PurchaseRequest> => {
    const res = await apiClient.post<PurchaseRequest>(`/procurement/requests/${id}/approve`);
    return res.data;
  },
  rejectPurchaseRequest: async (id: string, payload: { reason: string }): Promise<PurchaseRequest> => {
    const res = await apiClient.post<PurchaseRequest>(`/procurement/requests/${id}/reject`, payload);
    return res.data;
  },
  returnPurchaseRequest: async (id: string, payload: { reason: string }): Promise<PurchaseRequest> => {
    const res = await apiClient.post<PurchaseRequest>(`/procurement/requests/${id}/return`, payload);
    return res.data;
  },

  // 3. Purchase Orders & WhatsApp Dispatch
  getPurchaseOrders: async (params?: { branch_id?: string; supplier_id?: string; status_filter?: string; search?: string }): Promise<PurchaseOrder[]> => {
    const res = await apiClient.get<PurchaseOrder[]>('/procurement/orders', { params });
    return res.data;
  },
  getPurchaseOrder: async (orderId: string): Promise<PurchaseOrder> => {
    const res = await apiClient.get<PurchaseOrder>(`/procurement/orders/${orderId}`);
    return res.data;
  },
  createDirectPurchaseOrder: async (payload: PurchaseOrderCreate): Promise<PurchaseOrder> => {
    const res = await apiClient.post<PurchaseOrder>('/procurement/orders', payload);
    return res.data;
  },
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
  cancelPurchaseOrder: async (orderId: string, payload: { reason: string }): Promise<PurchaseOrder> => {
    const res = await apiClient.post<PurchaseOrder>(`/procurement/orders/${orderId}/cancel`, payload);
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

  // 4. Goods Receiving Notes (GRN) & 3-Way Match
  getGoodsReceiveNotes: async (params?: { branch_id?: string; supplier_id?: string; po_id?: string; status_filter?: string }): Promise<GoodsReceiveNote[]> => {
    const res = await apiClient.get<GoodsReceiveNote[]>('/procurement/grn', { params });
    return res.data;
  },
  getGoodsReceiveNote: async (grnId: string): Promise<GoodsReceiveNote> => {
    const res = await apiClient.get<GoodsReceiveNote>(`/procurement/grn/${grnId}`);
    return res.data;
  },
  createGoodsReceiveNote: async (payload: GoodsReceiveNoteCreate): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post<GoodsReceiveNote>('/procurement/grn', payload);
    return res.data;
  },
  createGoodsReceiveFromPO: async (payload: GoodsReceiveFromPOCreateInput): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post<GoodsReceiveNote>('/procurement/grn/from-po', payload);
    return res.data;
  },
  approveGoodsReceiveNote: async (grnId: string, payload?: { notes?: string }): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post<GoodsReceiveNote>(`/procurement/grn/${grnId}/approve`, payload);
    return res.data;
  },
  rejectGoodsReceiveNote: async (grnId: string, payload: { reason: string }): Promise<GoodsReceiveNote> => {
    const res = await apiClient.post<GoodsReceiveNote>(`/procurement/grn/${grnId}/reject`, payload);
    return res.data;
  },
  uploadSupplierInvoice: async (payload: {
    po_id?: string;
    branch_id?: string;
    warehouse_id?: string;
    supplier_id?: string;
    invoice_number: string;
    invoice_date?: string;
    invoice_amount: number;
    file_name: string;
    file_type: string;
    file_base64: string;
  }): Promise<SupplierInvoiceUploadResult> => {
    const res = await apiClient.post<SupplierInvoiceUploadResult>('/procurement/grn/upload-invoice', payload);
    return res.data;
  },
  getOrder3WayMatch: async (orderId: string): Promise<ThreeWayMatchResponse> => {
    const res = await apiClient.get<ThreeWayMatchResponse>(`/procurement/orders/${orderId}/3way-match`);
    return res.data;
  },

  // 5. Twice-Monthly Closing & Food Cost Tie-In
  getOutletClosings: async (params?: { branch_id?: string; year?: number; month?: number }): Promise<OutletClosingRecord[]> => {
    const res = await apiClient.get<OutletClosingRecord[]>('/procurement/closings', { params });
    return res.data;
  },
  getActiveClosingDraft: async (branchId: string): Promise<ActiveClosingDraft> => {
    const res = await apiClient.get<ActiveClosingDraft>(`/procurement/closings/active/${branchId}`);
    return res.data;
  },
  submitOutletClosing: async (payload: ClosingSubmitRequest): Promise<OutletClosingRecord> => {
    const res = await apiClient.post<OutletClosingRecord>('/procurement/closings/submit', payload);
    return res.data;
  },
  lockOutletClosing: async (closingId: string): Promise<OutletClosingRecord> => {
    const res = await apiClient.post<OutletClosingRecord>(`/procurement/closings/${closingId}/lock`);
    return res.data;
  },
  reopenOutletClosing: async (closingId: string, payload: { reason: string }): Promise<OutletClosingRecord> => {
    const res = await apiClient.post<OutletClosingRecord>(`/procurement/closings/${closingId}/reopen`, payload);
    return res.data;
  },

  // 6. Outlet Smart AI Requirement Endpoints
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

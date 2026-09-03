import { apiClient } from './client';
import {
  KitchenOrder,
  KitchenOrderApproveInput,
  KitchenOrderCancelInput,
  KitchenOrderCreateInput,
  KitchenOrderDispatchInput,
  KitchenOrderIssueInput,
  KitchenOrderItemOption,
  KitchenOrderReceiveInput,
  KitchenOrderRejectInput,
  KitchenOrderStartProductionInput,
} from '../types/kitchen-order.types';

export const kitchenOrdersApi = {
  // Finished / semi-finished Items from Item Master that can be ordered.
  getAvailableItems: async (params?: { search?: string }): Promise<KitchenOrderItemOption[]> => {
    const res = await apiClient.get<KitchenOrderItemOption[]>('/kitchen-orders/available-items', { params });
    return res.data;
  },

  getKitchenOrders: async (params?: { branch_id?: string; status?: string }): Promise<KitchenOrder[]> => {
    const res = await apiClient.get<KitchenOrder[]>('/kitchen-orders', { params });
    return res.data;
  },

  getKitchenOrder: async (id: string): Promise<KitchenOrder> => {
    const res = await apiClient.get<KitchenOrder>(`/kitchen-orders/${id}`);
    return res.data;
  },

  createKitchenOrder: async (payload: KitchenOrderCreateInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>('/kitchen-orders', payload);
    return res.data;
  },

  startProduction: async (id: string, payload?: KitchenOrderStartProductionInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/start-production`, payload || {});
    return res.data;
  },

  approveKitchenOrder: async (id: string, payload?: KitchenOrderApproveInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/approve`, payload || {});
    return res.data;
  },

  rejectKitchenOrder: async (id: string, payload: KitchenOrderRejectInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/reject`, payload);
    return res.data;
  },

  issueKitchenOrder: async (id: string, payload: KitchenOrderIssueInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/issue`, payload);
    return res.data;
  },

  dispatchKitchenOrder: async (id: string, payload: KitchenOrderDispatchInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/dispatch`, payload);
    return res.data;
  },

  approveDispatch: async (id: string, payload?: any): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/approve-dispatch`, payload || {});
    return res.data;
  },

  rejectDispatch: async (id: string, payload?: any): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/reject-dispatch`, payload || {});
    return res.data;
  },

  receiveKitchenOrder: async (id: string, payload: KitchenOrderReceiveInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/receive`, payload);
    return res.data;
  },

  cancelKitchenOrder: async (id: string, payload: KitchenOrderCancelInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/cancel`, payload);
    return res.data;
  },
};
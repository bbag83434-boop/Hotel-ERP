import { apiClient } from './client';
import {
  KitchenOrder,
  KitchenOrderCancelInput,
  KitchenOrderCreateInput,
  KitchenOrderDispatchInput,
  KitchenOrderItemOption,
  KitchenOrderReceiveInput,
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

  dispatchKitchenOrder: async (id: string, payload: KitchenOrderDispatchInput): Promise<KitchenOrder> => {
    const res = await apiClient.post<KitchenOrder>(`/kitchen-orders/${id}/dispatch`, payload);
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
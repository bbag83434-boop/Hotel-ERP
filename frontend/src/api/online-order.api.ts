import { apiClient } from './axios';
import {
  MenuCategoryGroup,
  TableSessionInfo,
  PlaceOrderPayload,
  OrderTrackingData,
  BranchTableQRItem
} from '../types/online-order.types';

export const onlineOrderApi = {
  // Public Digital Ordering
  getPublicMenu: async (branchId?: string, token?: string): Promise<MenuCategoryGroup[]> => {
    const params: Record<string, string> = {};
    if (branchId) params.branchId = branchId;
    if (token) params.token = token;
    const res = await apiClient.get('/online-orders/menu', { params });
    return res.data?.data || [];
  },

  getSessionDetails: async (token: string): Promise<TableSessionInfo> => {
    const res = await apiClient.get(`/online-orders/session/${token}`);
    return res.data?.data;
  },

  placeOrder: async (payload: PlaceOrderPayload): Promise<{
    onlineOrder: any;
    restaurantOrderId: string;
    posOrderNumber: string;
    ticketNumber: string;
  }> => {
    const res = await apiClient.post('/online-orders/place', payload);
    return res.data?.data;
  },

  settlePayment: async (data: {
    orderId: string;
    paymentMethod: 'UPI' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'PAY_AT_COUNTER' | 'ROOM_POSTING';
    transactionRef?: string;
  }): Promise<any> => {
    const res = await apiClient.post('/online-orders/settle', data);
    return res.data?.data;
  },

  trackOrder: async (orderNumber: string): Promise<OrderTrackingData> => {
    const res = await apiClient.get(`/online-orders/track/${orderNumber}`);
    return res.data?.data;
  },

  // Authenticated Management
  generateTableQR: async (tableId: string, guestName?: string, guestPhone?: string): Promise<any> => {
    const res = await apiClient.post('/online-orders/generate-qr', { tableId, guestName, guestPhone });
    return res.data?.data;
  },

  getBranchTablesQR: async (branchId?: string): Promise<BranchTableQRItem[]> => {
    const res = await apiClient.get('/online-orders/branch-tables', { params: branchId ? { branchId } : {} });
    return res.data?.data || [];
  },

  getOnlineOrdersList: async (params?: { branchId?: string; status?: string }): Promise<any[]> => {
    const res = await apiClient.get('/online-orders/orders', { params });
    return res.data?.data || [];
  }
};

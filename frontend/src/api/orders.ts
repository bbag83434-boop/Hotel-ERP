import { apiClient } from './client';
import { RestaurantOrder } from '@/types/restaurant.types';

export type OrderSource = 'ZOMATO' | 'SWIGGY' | 'MANUAL';

export interface CreateOrderPayload {
  branch_id: string;
  source: OrderSource;
  external_order_id?: string;
  table_id?: string;
  guest_count?: number;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  items: Array<{ menu_item_id: string; quantity: number; notes?: string }>;
}

export interface OrderStats {
  today_orders: number;
  today_revenue: number;
  open_orders: number;
  completed_orders: number;
  zomato_orders: number;
  swiggy_orders: number;
  manual_orders: number;
}

export const ordersApi = {
  menu: async (branchId?: string) => {
    const res = await apiClient.get<Array<{ id: string; code: string; name: string; price: number; tax_rate: number; recipe_id?: string; finished_item_id?: string }>>('/orders/menu', { params: { branch_id: branchId } });
    return res.data;
  },
  list: async (branchId?: string, source?: OrderSource) => {
    const res = await apiClient.get<RestaurantOrder[]>('/orders', { params: { branch_id: branchId, source } });
    return res.data;
  },
  stats: async (branchId?: string) => {
    const res = await apiClient.get<OrderStats>('/orders/stats', { params: { branch_id: branchId } });
    return res.data;
  },
  create: async (payload: CreateOrderPayload) => {
    const res = await apiClient.post<RestaurantOrder>('/orders', payload);
    return res.data;
  },
  kds: async (branchId?: string) => {
    const res = await apiClient.get<RestaurantOrder[]>('/orders/kds', { params: { branch_id: branchId } });
    return res.data;
  },
  kdsStatus: async (orderId: string, newStatus: string) => {
    const res = await apiClient.post<RestaurantOrder>(`/orders/${orderId}/kds-status`, null, { params: { new_status: newStatus } });
    return res.data;
  },
  complete: async (orderId: string, warehouseId: string, payment_method?: "CASH" | "UPI" | "CARD", received_amount?: number, session_id?: string) => {
    const res = await apiClient.post<RestaurantOrder>(`/orders/${orderId}/complete`, { warehouse_id: warehouseId, payment_method, received_amount, session_id });
    return res.data;
  },
};

import { apiClient } from './axios';
import {
  Menu,
  MenuCategory,
  MenuItem,
  DiningTable,
  RestaurantOrder,
  KitchenTicket,
  SalesAnalytics
} from '../types/restaurant.types';

export const restaurantApi = {
  // Branches
  getBranches: async (): Promise<any[]> => {
    const res = await apiClient.get('/users/branches');
    return res.data.data;
  },

  // Menus & Categories
  getMenus: async (branchId?: string): Promise<Menu[]> => {
    const res = await apiClient.get('/restaurant/menus', { params: { branchId } });
    return res.data.data;
  },

  createMenu: async (data: { branchId?: string; name: string; code: string; description?: string }): Promise<Menu> => {
    const res = await apiClient.post('/restaurant/menus', data);
    return res.data.data;
  },

  createMenuCategory: async (data: { menuId: string; name: string; code: string; sortOrder?: number; icon?: string }): Promise<MenuCategory> => {
    const res = await apiClient.post('/restaurant/categories', data);
    return res.data.data;
  },

  // Menu Items
  getMenuItems: async (params?: { menuId?: string; categoryId?: string; search?: string; station?: string }): Promise<MenuItem[]> => {
    const res = await apiClient.get('/restaurant/items', { params });
    return res.data.data;
  },

  createMenuItem: async (data: any): Promise<MenuItem> => {
    const res = await apiClient.post('/restaurant/items', data);
    return res.data.data;
  },

  // Tables
  getTables: async (branchId: string): Promise<DiningTable[]> => {
    const res = await apiClient.get('/restaurant/tables', { params: { branchId } });
    return res.data.data;
  },

  createTable: async (data: { branchId: string; tableNumber: string; name?: string; capacity?: number; section?: string }): Promise<DiningTable> => {
    const res = await apiClient.post('/restaurant/tables', data);
    return res.data.data;
  },

  updateTableStatus: async (tableId: string, status: string): Promise<DiningTable> => {
    const res = await apiClient.put(`/restaurant/tables/${tableId}/status`, { status });
    return res.data.data;
  },

  mergeTables: async (sourceTableId: string, targetTableId: string): Promise<{ message: string }> => {
    const res = await apiClient.post('/restaurant/tables/merge', { sourceTableId, targetTableId });
    return res.data.data;
  },

  // Orders
  createOrder: async (data: {
    branchId: string;
    tableId?: string | null;
    orderType?: string;
    guestCount?: number;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  }): Promise<RestaurantOrder> => {
    const res = await apiClient.post('/restaurant/orders', data);
    return res.data.data;
  },

  sendOrderToKitchen: async (orderId: string): Promise<{ orderId: string; tickets: KitchenTicket[] }> => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/send-kitchen`);
    return res.data.data;
  },

  applyDiscount: async (
    orderId: string,
    data: { discountType: string; rateOrAmount: number; reason: string }
  ): Promise<any> => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/discount`, data);
    return res.data.data;
  },

  completeOrderCheckout: async (
    orderId: string,
    data: {
      paymentMethod: string;
      amount: number;
      receivedAmount?: number;
      transactionRef?: string;
      cardLast4?: string;
      notes?: string;
    }
  ): Promise<any> => {
    const res = await apiClient.post(`/restaurant/orders/${orderId}/checkout`, data);
    return res.data.data;
  },

  // KDS
  getKitchenTickets: async (params?: { branchId?: string; station?: string; status?: string }): Promise<KitchenTicket[]> => {
    const res = await apiClient.get('/restaurant/kds/tickets', { params });
    return res.data.data;
  },

  updateTicketStatus: async (ticketId: string, status: string): Promise<KitchenTicket> => {
    const res = await apiClient.put(`/restaurant/kds/tickets/${ticketId}/status`, { status });
    return res.data.data;
  },

  // Sales Analytics
  getSalesAnalytics: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<SalesAnalytics> => {
    const res = await apiClient.get('/restaurant/sales/analytics', { params });
    return res.data.data;
  }
};

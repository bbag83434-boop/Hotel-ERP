import { apiClient } from './client';
import {
  Category,
  Unit,
  Item,
  ItemCreateInput,
  StockBalance,
  LowStockAlert,
  StockTransfer,
  StockTransferCreateInput,
  StockAdjustmentInput,
  StockAdjustmentResult,
  InventoryValuation,
} from '../types/inventory.types';

export const inventoryApi = {
  // Categories
  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get<Category[]>('/inventory/categories');
    return res.data;
  },
  createCategory: async (payload: { name: string; code: string; description?: string }): Promise<Category> => {
    const res = await apiClient.post<Category>('/inventory/categories', payload);
    return res.data;
  },

  // Units
  getUnits: async (): Promise<Unit[]> => {
    const res = await apiClient.get<Unit[]>('/inventory/units');
    return res.data;
  },
  createUnit: async (payload: { name: string; symbol: string }): Promise<Unit> => {
    const res = await apiClient.post<Unit>('/inventory/units', payload);
    return res.data;
  },

  // Items
  getItems: async (params?: { category_id?: string; type?: string; is_active?: boolean; search?: string }): Promise<Item[]> => {
    const res = await apiClient.get<Item[]>('/inventory/items', { params });
    return res.data;
  },
  getItem: async (itemId: string): Promise<Item> => {
    const res = await apiClient.get<Item>(`/inventory/items/${itemId}`);
    return res.data;
  },
  createItem: async (payload: ItemCreateInput): Promise<Item> => {
    const res = await apiClient.post<Item>('/inventory/items', payload);
    return res.data;
  },
  updateItem: async (itemId: string, payload: Partial<ItemCreateInput>): Promise<Item> => {
    const res = await apiClient.put<Item>(`/inventory/items/${itemId}`, payload);
    return res.data;
  },

  // Stock Balances & Alerts
  getStockBalances: async (params?: { warehouse_id?: string; item_id?: string; is_low_stock?: boolean }): Promise<StockBalance[]> => {
    const res = await apiClient.get<StockBalance[]>('/inventory/stock-balances', { params });
    return res.data;
  },
  getLowStockAlerts: async (params?: { warehouse_id?: string }): Promise<LowStockAlert[]> => {
    const res = await apiClient.get<LowStockAlert[]>('/inventory/stock-balances/low-stock', { params });
    return res.data;
  },

  // Transfers
  getTransfers: async (params?: { warehouse_id?: string; status?: string }): Promise<StockTransfer[]> => {
    const res = await apiClient.get<StockTransfer[]>('/inventory/transfers', { params });
    return res.data;
  },
  getTransfer: async (transferId: string): Promise<StockTransfer> => {
    const res = await apiClient.get<StockTransfer>(`/inventory/transfers/${transferId}`);
    return res.data;
  },
  createTransfer: async (payload: StockTransferCreateInput): Promise<StockTransfer> => {
    const res = await apiClient.post<StockTransfer>('/inventory/transfers', payload);
    return res.data;
  },
  updateTransferStatus: async (transferId: string, status: string, notes?: string): Promise<StockTransfer> => {
    const res = await apiClient.put<StockTransfer>(`/inventory/transfers/${transferId}/status`, { status, notes });
    return res.data;
  },

  // Direct Stock Adjustments
  adjustStock: async (payload: StockAdjustmentInput): Promise<StockAdjustmentResult> => {
    const res = await apiClient.post<StockAdjustmentResult>('/inventory/adjustments', payload);
    return res.data;
  },

  // Valuation
  getValuation: async (warehouseId?: string): Promise<InventoryValuation> => {
    const res = await apiClient.get<InventoryValuation>('/inventory/valuation', {
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return res.data;
  },
};

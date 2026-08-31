import { apiClient } from './client';
import {
  Category,
  Unit,
  Item,
  ItemCreateInput,
  Warehouse,
  StockBalance,
  LowStockAlert,
  StockTransfer,
  StockTransferCreateInput,
  StockAdjustmentInput,
  StockAdjustmentResult,
  InventoryValuation,
  StockLedgerEntry,
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
  updateCategory: async (categoryId: string, payload: Partial<{ name: string; code: string; description?: string; is_active?: boolean }>): Promise<Category> => {
    const res = await apiClient.put<Category>(`/inventory/categories/${categoryId}`, payload);
    return res.data;
  },
  deleteCategory: async (categoryId: string): Promise<{ message: string } | { message: string; references?: string[]; deactivate_instead?: boolean }> => {
    const res = await apiClient.delete(`/inventory/categories/${categoryId}`);
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
  updateUnit: async (unitId: string, payload: Partial<{ name: string; symbol: string; is_active?: boolean }>): Promise<Unit> => {
    const res = await apiClient.put<Unit>(`/inventory/units/${unitId}`, payload);
    return res.data;
  },
  deleteUnit: async (unitId: string): Promise<{ message: string } | { message: string; references?: string[]; deactivate_instead?: boolean }> => {
    const res = await apiClient.delete(`/inventory/units/${unitId}`);
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
  deleteItem: async (itemId: string): Promise<{ message: string } | { message: string; id: string; deactivated?: boolean; references?: string[]; deactivate_instead?: boolean }> => {
    const res = await apiClient.delete(`/inventory/items/${itemId}`);
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

  // Stock Ledger & Timeline
  getStockLedger: async (params?: { warehouse_id?: string; item_id?: string; movement_type?: string; limit?: number }): Promise<StockLedgerEntry[]> => {
    const res = await apiClient.get<StockLedgerEntry[]>('/inventory/stock-ledger', { params });
    return res.data;
  },
  getMovementTimeline: async (params?: { item_id?: string; warehouse_id?: string; start_date?: string; end_date?: string; movement_type?: string; limit?: number }) => {
    const res = await apiClient.get('/inventory/stock-ledger/timeline', { params });
    return res.data;
  },

  // Direct Stock Adjustments
  adjustStock: async (payload: { warehouse_id: string; item_id: string; change_qty: number; reason_code: string; batch_number?: string; expiry_date?: string; unit_cost?: number; notes?: string; is_emergency_override?: boolean; override_reason?: string }) => {
    const res = await apiClient.post('/inventory/stock-adjustments', payload);
    return res.data;
  },


  getReorderRecommendations: async (params?: { warehouse_id?: string }) => {
    const res = await apiClient.get('/inventory/reorder-recommendations', { params });
    return res.data;
  },

  // Valuation
  getValuation: async (warehouseId?: string): Promise<InventoryValuation> => {
    const res = await apiClient.get<InventoryValuation>('/inventory/valuation', {
      params: warehouseId ? { warehouse_id: warehouseId } : undefined,
    });
    return res.data;
  },

  // Warehouses
  getWarehouses: async (params?: { branch_id?: string }): Promise<Warehouse[]> => {
    const res = await apiClient.get<Warehouse[]>('/organization/warehouses', {
      params,
    });
    return res.data;
  },
};

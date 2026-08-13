import { apiClient } from './axios';
import { Category, Unit, Item, Warehouse, StockBalance, StockLedgerEntry, ItemType, StockMovementType } from '../types/inventory.types';

export const inventoryApi = {
  // Categories & Units
  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get('/inventory/categories');
    return res.data.data;
  },
  createCategory: async (data: { name: string; code: string; description?: string }): Promise<Category> => {
    const res = await apiClient.post('/inventory/categories', data);
    return res.data.data;
  },
  getUnits: async (): Promise<Unit[]> => {
    const res = await apiClient.get('/inventory/units');
    return res.data.data;
  },
  createUnit: async (data: { name: string; symbol: string }): Promise<Unit> => {
    const res = await apiClient.post('/inventory/units', data);
    return res.data.data;
  },

  // Items
  getItems: async (params?: {
    search?: string;
    categoryId?: string;
    type?: ItemType;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: Item[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/inventory/items', { params });
    return { items: res.data.data, pagination: res.data.meta };
  },
  getItemById: async (id: string): Promise<Item> => {
    const res = await apiClient.get(`/inventory/items/${id}`);
    return res.data.data;
  },
  createItem: async (data: Partial<Item>): Promise<Item> => {
    const res = await apiClient.post('/inventory/items', data);
    return res.data.data;
  },
  updateItem: async (id: string, data: Partial<Item>): Promise<Item> => {
    const res = await apiClient.put(`/inventory/items/${id}`, data);
    return res.data.data;
  },

  // Warehouses
  getWarehouses: async (branchId?: string): Promise<Warehouse[]> => {
    const res = await apiClient.get('/inventory/warehouses', { params: { branchId } });
    return res.data.data;
  },
  createWarehouse: async (data: {
    name: string;
    code: string;
    branchId?: string | null;
    isCentral?: boolean;
    address?: string;
  }): Promise<Warehouse> => {
    const res = await apiClient.post('/inventory/warehouses', data);
    return res.data.data;
  },

  // Stock Balances & Alerts
  getStockBalances: async (params?: {
    warehouseId?: string;
    branchId?: string;
    lowStockOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ balances: StockBalance[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/inventory/stocks', { params });
    return { balances: res.data.data, pagination: res.data.meta };
  },

  // Stock Ledger
  getStockLedger: async (params?: {
    warehouseId?: string;
    itemId?: string;
    movementType?: StockMovementType;
    page?: number;
    limit?: number;
  }): Promise<{ entries: StockLedgerEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const res = await apiClient.get('/inventory/ledger', { params });
    return { entries: res.data.data, pagination: res.data.meta };
  },

  // Stock Transfer & Adjustment
  transferStock: async (data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    transferDate?: string;
    notes?: string;
    items: Array<{ itemId: string; quantity: number; notes?: string }>;
  }): Promise<any> => {
    const res = await apiClient.post('/inventory/transfer', data);
    return res.data.data;
  },
  adjustStock: async (data: {
    warehouseId: string;
    itemId: string;
    newQuantity: number;
    reason: string;
  }): Promise<StockBalance> => {
    const res = await apiClient.post('/inventory/adjust', data);
    return res.data.data;
  }
};

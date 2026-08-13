export type ItemType = 'RAW_MATERIAL' | 'FINISHED_GOOD' | 'SEMI_FINISHED' | 'PACKAGING' | 'ASSET';

export type StockMovementType =
  | 'GRN'
  | 'PRODUCTION_IN'
  | 'PRODUCTION_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'POS_SALE';

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  _count?: { items: number };
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  isCentral: boolean;
  address?: string;
  branchId?: string;
  branch?: { id: string; name: string; code: string };
  _count?: { stockBalances: number };
}

export interface Item {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  type: ItemType;
  description?: string;
  costPrice: number | string;
  sellingPrice: number | string;
  minStockLevel: number | string;
  reorderQty: number | string;
  isActive: boolean;
  categoryId: string;
  category: Category;
  unitId: string;
  unit: Unit;
  totalStock?: number | string;
  isLowStock?: boolean;
}

export interface StockBalance {
  id: string;
  warehouseId: string;
  warehouse: Warehouse;
  itemId: string;
  item: Item;
  quantity: number | string;
  minStock: number | string;
  reorderQty: number | string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  itemId: string;
  item: { id: string; name: string; code: string; unit: { symbol: string } };
  movementType: StockMovementType;
  changeQty: number | string;
  balanceQty: number | string;
  unitCost?: number | string;
  totalCost?: number | string;
  batchNumber?: string;
  expiryDate?: string;
  referenceType: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
}

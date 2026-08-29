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
  company_id?: string;
  name: string;
  code: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Unit {
  id: string;
  company_id?: string;
  name: string;
  symbol: string;
  created_at?: string;
  updated_at?: string;
}

export interface UnitConversion {
  id: string;
  company_id?: string;
  from_unit_id: string;
  to_unit_id: string;
  conversion_factor: number;
  from_unit_name?: string;
  to_unit_name?: string;
  from_unit_symbol?: string;
  to_unit_symbol?: string;
}

export interface Item {
  id: string;
  company_id?: string;
  category_id: string;
  unit_id: string;
  name: string;
  code: string;
  barcode?: string;
  type: string;
  description?: string;
  cost_price: number | string;
  selling_price: number | string;
  min_stock_level: number | string;
  reorder_qty: number | string;
  is_active: boolean;
  category_name?: string;
  unit_symbol?: string;
  unit_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ItemCreateInput {
  name: string;
  code: string;
  category_id: string;
  unit_id: string;
  barcode?: string;
  type?: string;
  description?: string;
  cost_price?: number;
  selling_price?: number;
  min_stock_level?: number;
  reorder_qty?: number;
  is_active?: boolean;
}

export interface StockBalance {
  id: string;
  warehouse_id: string;
  item_id: string;
  quantity: number | string;
  min_stock_level?: number | string;
  reorder_qty?: number | string;
  avg_unit_cost?: number | string;
  item_name?: string;
  item_code?: string;
  item_type?: string;
  unit_symbol?: string;
  warehouse_name?: string;
  is_low_stock: boolean;
  updated_at?: string;
}

export interface LowStockAlert {
  warehouse_id: string;
  warehouse_name: string;
  item_id: string;
  item_name: string;
  item_code: string;
  current_quantity: number | string;
  min_stock_level: number | string;
  reorder_qty: number | string;
  shortage: number | string;
  unit_symbol?: string;
}

export interface StockTransferItem {
  id?: string;
  transfer_id?: string;
  item_id: string;
  quantity: number | string;
  unit_cost?: number | string;
  notes?: string;
  item_name?: string;
  item_code?: string;
  unit_symbol?: string;
}

export interface StockTransfer {
  id: string;
  company_id?: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_number: string;
  status: 'PENDING' | 'DISPATCHED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
  transfer_date: string;
  notes?: string;
  created_by_id?: string;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  items: StockTransferItem[];
  created_at?: string;
  updated_at?: string;
}

export interface StockTransferCreateInput {
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_number?: string;
  transfer_date?: string;
  notes?: string;
  items: {
    item_id: string;
    quantity: number;
    unit_cost?: number;
    notes?: string;
  }[];
}

export interface StockAdjustmentInput {
  warehouse_id: string;
  item_id: string;
  change_qty: number;
  reason_code: string;
  batch_number?: string;
  expiry_date?: string;
  unit_cost?: number;
  notes?: string;
  is_emergency_override?: boolean;
  override_reason?: string;
}

export interface StockAdjustmentResult {
  success: boolean;
  ledger_entry_id: string;
  warehouse_id: string;
  item_id: string;
  change_qty: number;
  new_balance: number;
  movement_type: string;
  notes?: string;
}

export interface Warehouse {
  id: string;
  company_id?: string;
  branch_id?: string;
  branchId?: string;
  name: string;
  code?: string;
  is_central?: boolean;
  isCentral?: boolean;
  is_active?: boolean;
  isActive?: boolean;
}

export interface InventoryValuation {
  company_id: string;
  total_inventory_value: number | string;
  total_items_count: number;
  warehouse_valuations: {
    warehouse_id: string;
    warehouse_name: string;
    total_value: number | string;
    items_count: number;
  }[];
}

export interface StockLedgerEntry {
  id: string;
  company_id?: string;
  branch_id?: string;
  warehouse_id: string;
  item_id: string;
  unit_id?: string;
  unit_symbol?: string;
  batch_number?: string;
  expiry_date?: string;
  movement_type: string;
  change_qty: number | string;
  balance_qty: number | string;
  unit_cost?: number | string;
  total_cost?: number | string;
  reference_type?: string;
  reference_id?: string;
  reversal_reference_id?: string;
  idempotency_key?: string;
  is_emergency_override?: boolean;
  notes?: string;
  created_by_id?: string;
  created_by_name?: string;
  user_name?: string;
  created_at?: string;
  item_name?: string;
  item_code?: string;
  warehouse_name?: string;
  direction?: 'IN' | 'OUT' | 'REVERSAL';
  badge_color?: 'emerald' | 'rose' | 'amber' | 'blue';
}

export interface StockMovementTimelineEntry {
  id: string;
  timestamp: string;
  movement_type: string;
  direction: 'IN' | 'OUT' | 'REVERSAL';
  change_qty: number | string;
  balance_qty: number | string;
  unit_symbol?: string;
  unit_cost?: number | string;
  total_cost?: number | string;
  item_id: string;
  item_name: string;
  item_code: string;
  warehouse_id: string;
  warehouse_name: string;
  batch_number?: string;
  expiry_date?: string;
  reference_type?: string;
  reference_id?: string;
  reversal_reference_id?: string;
  is_emergency_override?: boolean;
  user_id?: string;
  user_name?: string;
  reason_code?: string;
  notes?: string;
  badge_color: 'emerald' | 'rose' | 'amber' | 'blue';
}


export interface ReorderRecommendation {
  warehouse_id: string;
  warehouse_name: string;
  item_id: string;
  item_name: string;
  item_code: string;
  unit_symbol?: string;
  current_stock: number | string;
  min_stock_level: number | string;
  reorder_qty: number | string;
  suggested_order_qty: number | string;
  estimated_unit_cost: number | string;
  estimated_total_cost: number | string;
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | string;
}

export interface ReorderRecommendationResponse {
  total_items_to_reorder: number;
  total_estimated_replenishment_cost: number | string;
  recommendations: ReorderRecommendation[];
}

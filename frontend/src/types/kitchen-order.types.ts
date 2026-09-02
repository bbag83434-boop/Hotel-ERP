export type KitchenOrderStatus =
  | 'SUBMITTED'
  | 'IN_PRODUCTION'
  | 'DISPATCHED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface KitchenOrderItemOption {
  id: string;
  code: string;
  name: string;
  type: 'FINISHED_GOOD' | 'SEMI_FINISHED' | string;
  category_name?: string | null;
  unit_symbol?: string | null;
  cost_price?: number | string;
  selling_price?: number | string;
  has_recipe?: boolean;
}

export interface KitchenOrder {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string | null;
  branch_code?: string | null;
  branch_type?: string | null;

  item_id: string;
  item_name?: string | null;
  item_code?: string | null;
  item_type?: string | null;
  unit_symbol?: string | null;

  order_number: string;
  requested_qty: number | string;
  dispatched_qty: number | string;
  received_qty: number | string;
  status: KitchenOrderStatus;

  required_date?: string | null;
  notes?: string | null;

  kitchen_warehouse_id?: string | null;
  kitchen_warehouse_name?: string | null;
  kitchen_available_qty?: number | string | null;
  batch_number?: string | null;
  expiry_date?: string | null;

  dispatched_by?: string | null;
  dispatched_at?: string | null;
  dispatch_notes?: string | null;

  received_warehouse_id?: string | null;
  received_warehouse_name?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  receive_notes?: string | null;

  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;

  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KitchenOrderCreateInput {
  branch_id: string;
  item_id: string;
  requested_qty: number;
  required_date?: string;
  notes?: string;
  kitchen_warehouse_id?: string;
}

export interface KitchenOrderDispatchInput {
  dispatched_qty?: number;
  kitchen_warehouse_id?: string;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

export interface KitchenOrderReceiveInput {
  accepted_qty?: number;
  received_warehouse_id?: string;
  notes?: string;
}

export interface KitchenOrderCancelInput {
  reason: string;
}

export interface KitchenOrderStartProductionInput {
  kitchen_warehouse_id?: string;
  notes?: string;
}
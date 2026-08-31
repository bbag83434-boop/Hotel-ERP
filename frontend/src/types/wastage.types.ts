export type WastageReasonCode =
  | 'EXPIRED'
  | 'PREPARATION_LOSS'
  | 'BURNT_DROPPED'
  | 'QUALITY_ISSUE'
  | 'STORAGE_FAILURE'
  | 'CUSTOMER_RETURN'
  | 'OTHER';

export type WastageStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface WastageReason {
  code: WastageReasonCode;
  label: string;
  description: string;
}

export interface WastageItem {
  id: string;
  wastage_entry_id: string;
  item_id: string;
  item_name?: string;
  item_code?: string;
  unit_id?: string;
  unit_symbol?: string;
  quantity: number | string;
  unit_cost: number | string;
  total_cost: number | string;
  reason_code: WastageReasonCode;
  batch_number?: string;
  notes?: string;
}

export interface WastageEntry {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  entry_number: string;
  entry_date: string;
  status: WastageStatus;
  total_cost: number | string;
  total_items_count: number;
  requires_approval: boolean;
  reported_by_id: string;
  reported_by_name?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  items: WastageItem[];
  created_at: string;
  updated_at: string;
}

export interface WastageItemInput {
  item_id: string;
  quantity: number;
  unit_id?: string;
  unit_cost?: number;
  reason_code: WastageReasonCode;
  batch_number?: string;
  notes?: string;
}

export interface WastageEntryCreateInput {
  branch_id: string;
  warehouse_id: string;
  entry_date?: string;
  notes?: string;
  items: WastageItemInput[];
  auto_submit?: boolean;
}

export interface WastageAnalytics {
  period_start: string;
  period_end: string;
  total_wastage_cost: number | string;
  total_wastage_entries: number;
  total_items_wasted: number | string;
  by_reason: Record<string, { code: string; total_cost: number; count: number; quantity: number; percentage: number }>;
  by_outlet: Array<{
    branch_id: string;
    branch_name: string;
    total_cost: number;
    entries_count: number;
  }>;
  top_wasted_items: Array<{
    item_id: string;
    item_name: string;
    item_code: string;
    quantity: number;
    total_cost: number;
    primary_reason: string;
  }>;
  abnormal_alerts: Array<{
    branch_id: string;
    branch_name: string;
    current_cost: number;
    baseline_cost: number;
    surge_percentage: number;
    reason: string;
  }>;
}

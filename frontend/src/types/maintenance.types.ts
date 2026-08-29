export interface MaintenanceAsset {
  id: string; company_id: string; branch_id: string; asset_code: string; name: string; category: string; location?: string;
  manufacturer?: string; model_number?: string; serial_number?: string; purchase_date?: string; warranty_expiry?: string;
  service_contract_expiry?: string; purchase_cost: number | string; status: string; is_active: boolean; notes?: string;
  open_ticket_count: number; warranty_days_remaining?: number | null;
}
export interface AssetCreate { branch_id: string; asset_code: string; name: string; category: string; location?: string; manufacturer?: string; model_number?: string; serial_number?: string; purchase_date?: string; warranty_expiry?: string; service_contract_expiry?: string; purchase_cost?: number; notes?: string; }
export interface MaintenanceTicket { id: string; company_id: string; branch_id: string; asset_id?: string; ticket_number: string; title: string; description: string; category: string; priority: string; status: string; assigned_to_id?: string; vendor_name?: string; estimated_cost: number|string; actual_cost: number|string; downtime_minutes: number; opened_at: string; due_at?: string; completed_at?: string; resolution?: string; asset_name?: string; asset_code?: string; }
export interface TicketCreate { branch_id: string; asset_id?: string; title: string; description: string; category: string; priority?: string; assigned_to_id?: string; vendor_name?: string; estimated_cost?: number; due_at?: string; }
export interface TicketUpdate { status?: string; priority?: string; assigned_to_id?: string; vendor_name?: string; actual_cost?: number; downtime_minutes?: number; due_at?: string; resolution?: string; }
export interface MaintenanceSummary { assets: number; active_assets: number; open_tickets: number; critical_tickets: number; overdue_tickets: number; warranty_expiring_30d: number; estimated_open_cost: number|string; actual_cost_30d: number|string; }

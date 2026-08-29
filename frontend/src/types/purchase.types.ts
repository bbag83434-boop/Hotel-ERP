export type PRStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'CANCELLED';
export type PRPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'WHATSAPP_OPENED' | 'SENT_MANUALLY' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
export type GRNStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'RECEIVED' | 'QC_PASSED' | 'QC_FAILED' | 'REJECTED';
export type QCStatus = 'PASSED' | 'FAILED' | 'PENDING';
export type SupplierTxType = 'INVOICE' | 'PAYMENT' | 'RETURN' | 'ADJUSTMENT';

export interface GoodsReceiveFromPOCreateInput {
  po_id: string;
  branch_id?: string;
  warehouse_id?: string;
  supplier_invoice_number: string;
  invoice_amount?: number;
  invoice_file_name?: string;
  invoice_file_data?: string;
  notes?: string;
}

export interface SupplierInvoiceUploadResult {
  id: string;
  file_name: string;
  file_type: string;
  storage_ref: string;
  invoice_number: string;
  invoice_amount: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  paymentTerms?: string;
  balance: number | string;
  isActive: boolean;
  _count?: { purchaseOrders: number; grns: number };
}

export interface SupplierItem {
  id: string;
  company_id: string;
  supplier_id: string;
  item_id: string;
  supplier_item_code?: string;
  supplier_item_name?: string;
  purchase_unit_id?: string;
  purchase_price: number;
  conversion_rate: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  supplier_name?: string;
  supplier_code?: string;
  item_name?: string;
  item_code?: string;
  purchase_unit_name?: string;
  purchase_unit_symbol?: string;
  base_unit_symbol?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierItemCreateInput {
  supplier_id: string;
  item_id: string;
  supplier_item_code?: string;
  supplier_item_name?: string;
  purchase_unit_id?: string;
  purchase_price?: number;
  conversion_rate?: number;
  lead_time_days?: number;
  is_preferred?: boolean;
  is_active?: boolean;
}

export interface SupplierItemUpdateInput {
  supplier_item_code?: string;
  supplier_item_name?: string;
  purchase_unit_id?: string;
  purchase_price?: number;
  conversion_rate?: number;
  lead_time_days?: number;
  is_preferred?: boolean;
  is_active?: boolean;
}


export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  transactionType: SupplierTxType;
  debit: number | string;
  credit: number | string;
  balance: number | string;
  referenceType: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface PurchaseRequestItem {
  id: string;
  itemId: string;
  item: { id: string; name: string; code: string; costPrice: number | string; unit: { symbol: string } };
  requestedQty: number | string;
  estimatedPrice: number | string;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  requestedById: string;
  requestedBy: { id: string; firstName: string; lastName: string; email: string };
  approvedById?: string;
  approvedBy?: { id: string; firstName: string; lastName: string };
  requiredDate: string;
  status: PRStatus;
  priority: PRPriority;
  notes?: string;
  rejectionReason?: string;
  createdAt: string;
  items: PurchaseRequestItem[];
  purchaseOrders?: Array<{ id: string; poNumber: string; status: POStatus }>;
}

export interface PurchaseOrderItem {
  id: string;
  itemId: string;
  item: { id: string; name: string; code: string; unit: { symbol: string } };
  orderedQty: number | string;
  receivedQty: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  supplierId: string;
  supplier: { id: string; name: string; code: string; phone?: string };
  requestId?: string;
  status: POStatus;
  issueDate: string;
  deliveryDate?: string;
  totalAmount: number | string;
  taxAmount: number | string;
  grandTotal: number | string;
  notes?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  items: PurchaseOrderItem[];
  grns?: Array<{ id: string; grnNumber: string; status: GRNStatus; receiveDate: string }>;
}

export interface GoodsReceiveItem {
  id: string;
  itemId: string;
  item: { id: string; name: string; code: string; unit: { symbol: string } };
  receivedQty: number | string;
  acceptedQty: number | string;
  rejectedQty: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
  batchNumber?: string;
  expiryDate?: string;
  qcStatus: QCStatus;
  qcNotes?: string;
}

export interface GoodsReceiveNote {
  id: string;
  grnNumber: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  supplierId: string;
  supplier_id?: string;
  supplier: { id: string; name: string; code: string };
  poId?: string;
  po?: { id: string; poNumber: string; totalAmount?: number | string };
  receiveDate: string;
  invoiceNumber?: string;
  status: GRNStatus;
  totalAmount: number | string;
  notes?: string;
  receivedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  items: GoodsReceiveItem[];
}

export interface SmartRequirementItem {
  id?: string;
  item_id: string;
  item_name?: string;
  item_code?: string;
  unit_symbol?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_whatsapp?: string;
  current_stock: number | string;
  min_stock: number | string;
  target_stock: number | string;
  pending_incoming: number | string;
  daily_consumption: number | string;
  short_qty: number | string;
  system_suggested_qty: number | string;
  final_order_qty: number | string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  is_user_modified: boolean;
  is_manually_added: boolean;
  reason?: string;
  notes?: string;
}

export interface SmartRequirementDraft {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string;
  draft_date: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISCARDED';
  generated_at: string;
  confirmed_at?: string;
  confirmed_by_id?: string;
  purchase_request_id?: string;
  purchase_request_number?: string;
  notes?: string;
  items: SmartRequirementItem[];
  total_items: number;
  critical_count: number;
  high_priority_count: number;
  estimated_total_order_value: number | string;
  audit_summary?: any;
}

export interface BranchRequirementConfig {
  id: string;
  company_id: string;
  branch_id: string;
  preparation_time: string;
  is_auto_enabled: boolean;
  lead_time_days: number;
  safety_buffer_percent: number | string;
  last_generated_date?: string;
}

export interface SmartAIAskResponse {
  success: boolean;
  branch_id: string;
  branch_name: string;
  question: string;
  intent: string;
  answer_text: string;
  metrics?: {
    total_monitored_items?: number;
    critical_count?: number;
    low_stock_count?: number;
    need_order_count?: number;
    pending_items_count?: number;
  };
  items: SmartRequirementItem[];
  suggested_action?: string;
}

export interface ThreeWayMatchLine {
  item_id: string;
  item_name: string;
  item_code: string;
  unit_symbol: string;
  po_qty: number;
  po_rate: number;
  po_total: number;
  grn_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  actual_rate: number;
  actual_total: number;
  qty_variance: number;
  rate_variance: number;
  amount_variance: number;
  status: 'MATCHED' | 'SHORT_DELIVERY' | 'EXCESS_DELIVERY' | 'PRICE_VARIANCE' | 'PENDING_DELIVERY';
}

export interface ThreeWayMatchResponse {
  po_id: string;
  po_number: string;
  po_status: string;
  po_total: number;
  supplier_id: string;
  supplier_name: string;
  branch_name: string;
  grn_count: number;
  grns: GoodsReceiveNote[];
  lines: ThreeWayMatchLine[];
  total_ordered_amount: number;
  total_received_amount: number;
  total_invoice_amount: number;
  overall_status: 'PERFECT_MATCH' | 'VARIANCE_DETECTED' | 'PENDING_GRN';
}

export interface ClosingStockItem {
  id: string;
  item_id: string;
  item_name?: string;
  item_code?: string;
  unit_symbol?: string;
  opening_qty: number;
  received_qty: number;
  theoretical_closing_qty: number;
  physical_closing_qty: number;
  variance_qty: number;
  unit_cost: number;
  total_valuation: number;
  notes?: string;
}

export interface FoodCostBreakdown {
  category_id?: string;
  category_name?: string;
  sales_revenue: number;
  theoretical_cost: number;
  actual_cost: number;
  theoretical_cost_pct: number;
  actual_cost_pct: number;
  variance_cost: number;
  variance_pct: number;
}

export interface OutletClosingRecord {
  id: string;
  company_id: string;
  branch_id: string;
  branch_name?: string;
  period_type: 'FIRST_HALF' | 'SECOND_HALF';
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: 'DRAFT' | 'SUBMITTED' | 'FINALIZED_LOCKED' | 'LOCKED' | 'AUDITED';
  opening_valuation: number;
  total_purchases: number;
  closing_physical_valuation: number;
  calculated_consumption: number;
  theoretical_food_cost: number;
  actual_food_cost: number;
  variance_amount: number;
  variance_percentage: number;
  notes?: string;
  submitted_by_id?: string;
  submitted_at?: string;
  verified_by_id?: string;
  verified_at?: string;
  finalized_at?: string;
  closing_items: ClosingStockItem[];
  food_cost_breakdowns?: FoodCostBreakdown[];
  created_at?: string;
  updated_at?: string;
}

export interface ActiveClosingDraft {
  branch_id: string;
  branch_name: string;
  period_type: 'FIRST_HALF' | 'SECOND_HALF';
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: string;
  days_remaining: number;
  opening_valuation: number;
  total_purchases: number;
  items: ClosingStockItem[];
}

export interface ClosingSubmitRequest {
  branch_id: string;
  period_type: 'FIRST_HALF' | 'SECOND_HALF';
  year: number;
  month: number;
  items: Array<{ item_id: string; physical_closing_qty: number; notes?: string }>;
  notes?: string;
}

export interface GoodsReceiveItemCreate {
  item_id: string;
  po_item_id?: string;
  received_qty: number;
  accepted_qty: number;
  rejected_qty?: number;
  unit_price: number;
  batch_number?: string;
  expiry_date?: string;
  qc_status?: 'PASSED' | 'FAILED' | 'PENDING';
  qc_notes?: string;
}

export interface GoodsReceiveNoteCreate {
  branch_id: string;
  warehouse_id?: string;
  supplier_id?: string;
  po_id?: string;
  receive_date?: string;
  supplier_invoice_number?: string;
  invoice_amount?: number;
  notes?: string;
  items: GoodsReceiveItemCreate[];
}

export interface PurchaseOrderItemCreate {
  item_id: string;
  ordered_qty: number;
  unit_price: number;
  notes?: string;
}

export interface PurchaseOrderCreate {
  branch_id?: string;
  supplier_id: string;
  expected_delivery_date?: string;
  tax_amount?: number;
  discount_amount?: number;
  notes?: string;
  items: PurchaseOrderItemCreate[];
}


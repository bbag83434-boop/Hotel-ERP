export type PRStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'CANCELLED';
export type PRPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'WHATSAPP_OPENED' | 'SENT_MANUALLY' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';
export type GRNStatus = 'RECEIVED' | 'QC_PASSED' | 'QC_FAILED' | 'REJECTED';
export type QCStatus = 'PASSED' | 'FAILED' | 'PENDING';
export type SupplierTxType = 'INVOICE' | 'PAYMENT' | 'RETURN' | 'ADJUSTMENT';

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
  metrics: {
    total_monitored_items: number;
    critical_count: number;
    low_stock_count: number;
    need_order_count: number;
    pending_items_count: number;
  };
  items: SmartRequirementItem[];
}


import json
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from decimal import Decimal
from app.models.procurement import PRStatus, POStatus, PRPriority

# ==========================================
# Supplier Schemas
# ==========================================
class SupplierBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    payment_terms: Optional[str] = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    company_id: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    payment_terms: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(SupplierBase):
    id: str
    company_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# Vendor-Item Mapping (SupplierItem) Schemas
# ==========================================
class SupplierItemBase(BaseModel):
    supplier_id: str
    item_id: str
    supplier_item_code: Optional[str] = None
    supplier_item_name: Optional[str] = None
    purchase_unit_id: Optional[str] = None
    purchase_price: Decimal = Field(default=Decimal("0.0000"), ge=0)
    conversion_rate: Decimal = Field(default=Decimal("1.0000"), gt=0)
    lead_time_days: int = Field(default=1, ge=0)
    is_preferred: bool = False
    is_active: bool = True

class SupplierItemCreate(SupplierItemBase):
    company_id: Optional[str] = None

class SupplierItemUpdate(BaseModel):
    supplier_item_code: Optional[str] = None
    supplier_item_name: Optional[str] = None
    purchase_unit_id: Optional[str] = None
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    conversion_rate: Optional[Decimal] = Field(None, gt=0)
    lead_time_days: Optional[int] = Field(None, ge=0)
    is_preferred: Optional[bool] = None
    is_active: Optional[bool] = None

class SupplierItemResponse(SupplierItemBase):
    id: str
    company_id: str
    supplier_name: Optional[str] = None
    supplier_code: Optional[str] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    purchase_unit_name: Optional[str] = None
    purchase_unit_symbol: Optional[str] = None
    base_unit_symbol: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# Purchase Request (Outlet Indent) Schemas
# ==========================================
class PurchaseRequestItemCreate(BaseModel):
    item_id: str
    supplier_id: Optional[str] = None
    requested_qty: Decimal = Field(..., gt=0)
    estimated_price: Optional[Decimal] = Decimal("0.0000")
    notes: Optional[str] = None

class PurchaseRequestItemResponse(BaseModel):
    id: str
    request_id: str
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    requested_qty: Decimal
    estimated_price: Decimal
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class PurchaseRequestCreate(BaseModel):
    branch_id: str
    required_date: Optional[datetime] = None
    priority: Optional[str] = "MEDIUM"
    notes: Optional[str] = None
    items: List[PurchaseRequestItemCreate]

class PurchaseRequestUpdate(BaseModel):
    required_date: Optional[datetime] = None
    priority: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseRequestItemCreate]] = None

class PurchaseRequestRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class PurchaseRequestReturnRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class PurchaseRequestResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    request_number: str
    requested_by_id: str
    required_date: datetime
    status: PRStatus
    priority: str
    purchase_type: Optional[str] = None
    notes: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    items: List[PurchaseRequestItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# Purchase Order & Consolidation Schemas
# ==========================================
class OutletAllocationDetail(BaseModel):
    branch_id: str
    branch_name: str
    quantity: Decimal
    unit: str

class PurchaseOrderItemResponse(BaseModel):
    id: str
    po_id: str
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    ordered_qty: Decimal
    received_qty: Decimal
    unit_price: Decimal
    total_price: Decimal
    notes: Optional[str] = None
    allocations: Optional[Union[List[Any], Dict[str, Any], str]] = None

    @field_validator("allocations", mode="before")
    @classmethod
    def parse_item_allocations(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

    class Config:
        from_attributes = True

class PurchaseOrderItemCreate(BaseModel):
    item_id: str
    ordered_qty: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    notes: Optional[str] = None

class PurchaseOrderCreate(BaseModel):
    branch_id: Optional[str] = None  # None indicates Multi-destination or Central Store
    supplier_id: str
    expected_delivery_date: Optional[datetime] = None
    tax_amount: Optional[Decimal] = Decimal("0.0000")
    discount_amount: Optional[Decimal] = Decimal("0.0000")
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class PurchaseOrderResponse(BaseModel):
    id: str
    company_id: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    supplier_id: str
    supplier_name: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_whatsapp: Optional[str] = None
    po_number: str
    status: POStatus
    purchase_type: Optional[str] = None
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    total_amount: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    notes: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    whatsapp_opened_at: Optional[datetime] = None
    whatsapp_number: Optional[str] = None
    allocations: Optional[Union[Dict[str, Any], List[Any], str]] = None
    items: List[PurchaseOrderItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("allocations", mode="before")
    @classmethod
    def parse_po_allocations(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return v
        return v

    class Config:
        from_attributes = True

# ==========================================
# Goods Receive Note (GRN) & 3-Way Match Schemas
# ==========================================
class GoodsReceiveItemCreate(BaseModel):
    item_id: str
    po_item_id: Optional[str] = None
    received_qty: Decimal = Field(..., gt=0)
    accepted_qty: Decimal = Field(..., ge=0)
    rejected_qty: Optional[Decimal] = Decimal("0.0000")
    damaged_qty: Optional[Decimal] = Decimal("0.0000")     # physically damaged on delivery
    short_qty: Optional[Decimal] = Decimal("0.0000")       # ordered but not delivered
    shortage_reason_code: Optional[str] = None             # DAMAGED/SHORT/QUALITY_REJECT/OTHER
    unit_price: Decimal = Field(..., ge=0)
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    qc_status: Optional[str] = "PASSED"
    qc_notes: Optional[str] = None

class GoodsReceiveItemResponse(BaseModel):
    id: str
    grn_id: str
    po_item_id: Optional[str] = None
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    ordered_qty: Optional[Decimal] = None       # from linked PO item
    received_qty: Decimal
    accepted_qty: Decimal
    rejected_qty: Decimal
    damaged_qty: Decimal = Decimal("0.0000")
    short_qty: Decimal = Decimal("0.0000")
    shortage_reason_code: Optional[str] = None
    remaining_qty: Optional[Decimal] = None     # ordered_qty - cumulative accepted
    unit_price: Decimal
    total_price: Decimal
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    qc_status: Optional[str] = None
    qc_notes: Optional[str] = None

    class Config:
        from_attributes = True

class GoodsReceiveNoteCreate(BaseModel):
    branch_id: str
    warehouse_id: Optional[str] = None
    supplier_id: Optional[str] = None
    po_id: Optional[str] = None
    receive_date: Optional[datetime] = None
    delivery_reference: Optional[str] = None    # vendor delivery challan/DC number
    supplier_invoice_number: Optional[str] = None
    invoice_amount: Optional[Decimal] = None
    notes: Optional[str] = None
    auto_approve: Optional[bool] = None
    status: Optional[str] = None
    items: List[GoodsReceiveItemCreate]

class GoodsReceiveFromPOCreate(BaseModel):
    po_id: str
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    delivery_reference: Optional[str] = None
    supplier_invoice_number: str = Field(..., min_length=1)
    invoice_amount: Optional[Decimal] = None
    invoice_file_name: Optional[str] = None
    invoice_file_data: Optional[str] = None
    notes: Optional[str] = None

class GoodsReceiveNoteApproveRequest(BaseModel):
    notes: Optional[str] = None

class GoodsReceiveNoteRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class SupplierInvoiceUploadRequest(BaseModel):
    po_id: Optional[str] = None
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    supplier_id: Optional[str] = None
    invoice_number: str
    invoice_date: Optional[str] = None
    invoice_amount: Decimal
    file_name: str
    file_type: str
    file_base64: str

class SupplierInvoiceUploadResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    storage_ref: str
    invoice_number: str
    invoice_amount: Decimal
    created_at: datetime

class GoodsReceiveNoteResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    warehouse_id: str
    warehouse_name: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    po_id: Optional[str] = None
    po_number: Optional[str] = None
    grn_number: str
    receive_date: datetime
    delivery_reference: Optional[str] = None
    supplier_invoice_number: Optional[str] = None
    invoice_amount: Optional[Decimal] = None
    total_amount: Decimal
    damaged_qty: Decimal = Decimal("0.0000")
    short_qty: Decimal = Decimal("0.0000")
    status: str
    notes: Optional[str] = None
    received_by_id: Optional[str] = None
    received_by_name: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    items: List[GoodsReceiveItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True



class ThreeWayMatchLine(BaseModel):
    item_id: str
    item_name: str
    item_code: str
    unit_symbol: str
    po_qty: Decimal
    po_rate: Decimal
    po_total: Decimal
    grn_qty: Decimal
    accepted_qty: Decimal
    rejected_qty: Decimal
    actual_rate: Decimal
    actual_total: Decimal
    qty_variance: Decimal
    rate_variance: Decimal
    amount_variance: Decimal
    status: str  # MATCHED, SHORT_DELIVERY, EXCESS_DELIVERY, PRICE_VARIANCE

class ThreeWayMatchResponse(BaseModel):
    po_id: str
    po_number: str
    po_status: str
    po_total: Decimal
    supplier_id: str
    supplier_name: str
    branch_name: str
    grn_count: int
    grns: List[GoodsReceiveNoteResponse] = []
    lines: List[ThreeWayMatchLine] = []
    total_ordered_amount: Decimal
    total_received_amount: Decimal
    total_invoice_amount: Decimal
    overall_status: str  # PERFECT_MATCH, VARIANCE_DETECTED, PENDING_GRN

# ==========================================
# Twice-Monthly Closing Schemas
# ==========================================
class ClosingItemSubmit(BaseModel):
    item_id: str
    physical_closing_qty: Decimal = Field(..., ge=0)
    notes: Optional[str] = None

class ClosingSubmitRequest(BaseModel):
    branch_id: str
    period_type: str  # FIRST_HALF or SECOND_HALF
    year: int
    month: int
    items: List[ClosingItemSubmit]
    notes: Optional[str] = None

class ClosingStockItemResponse(BaseModel):
    id: str
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    opening_qty: Decimal
    received_qty: Decimal
    theoretical_closing_qty: Decimal
    physical_closing_qty: Decimal
    variance_qty: Decimal
    unit_cost: Decimal
    total_valuation: Decimal
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class FoodCostBreakdownResponse(BaseModel):
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    sales_revenue: Decimal
    theoretical_cost: Decimal
    actual_cost: Decimal
    theoretical_cost_pct: Decimal
    actual_cost_pct: Decimal
    variance_cost: Decimal
    variance_pct: Decimal

    class Config:
        from_attributes = True

class OutletClosingRecordResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    period_type: str
    year: int
    month: int
    start_date: datetime
    end_date: datetime
    status: str
    opening_valuation: Decimal
    total_purchases: Decimal
    closing_physical_valuation: Decimal
    calculated_consumption: Decimal
    theoretical_food_cost: Decimal
    actual_food_cost: Decimal
    variance_amount: Decimal
    variance_percentage: Decimal
    notes: Optional[str] = None
    submitted_by_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_by_id: Optional[str] = None
    verified_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    closing_items: List[ClosingStockItemResponse] = []
    food_cost_breakdowns: List[FoodCostBreakdownResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActiveClosingDraftResponse(BaseModel):
    branch_id: str
    branch_name: str
    period_type: str
    year: int
    month: int
    start_date: datetime
    end_date: datetime
    status: str
    days_remaining: int
    opening_valuation: Decimal
    total_purchases: Decimal
    items: List[ClosingStockItemResponse] = []

class ConsolidateOrdersRequest(BaseModel):
    request_ids: List[str] = Field(..., min_items=1, description="List of Purchase Request / Indent IDs to consolidate")
    auto_submit: bool = Field(False, description="If True, moves PO to PENDING_APPROVAL; else DRAFT")
    notes: Optional[str] = None

class ConsolidateOrdersResponse(BaseModel):
    success: bool
    consolidated_orders_count: int
    orders: List[PurchaseOrderResponse]
    message: str

class ApproveOrderRequest(BaseModel):
    notes: Optional[str] = None

class RejectOrderRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class WhatsAppLinkResponse(BaseModel):
    success: bool
    po_id: str
    po_number: str
    supplier_id: str
    supplier_name: str
    whatsapp_number: str
    whatsapp_url: str
    prefilled_message: str
    status: POStatus
    opened_at: datetime
    message: str

class ConfirmSentRequest(BaseModel):
    notes: Optional[str] = None

class ConfirmSentResponse(BaseModel):
    success: bool
    po_id: str
    po_number: str
    status: POStatus
    confirmed_at: datetime
    message: str

# ==========================================
# Outlet Smart Requirement Schemas
# ==========================================
class SmartRequirementItemSchema(BaseModel):
    id: Optional[str] = None
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_whatsapp: Optional[str] = None
    current_stock: Decimal = Decimal("0.0000")
    min_stock: Decimal = Decimal("0.0000")
    target_stock: Decimal = Decimal("0.0000")
    pending_incoming: Decimal = Decimal("0.0000")
    daily_consumption: Decimal = Decimal("0.0000")
    short_qty: Decimal = Decimal("0.0000")
    system_suggested_qty: Decimal = Decimal("0.0000")
    final_order_qty: Decimal = Decimal("0.0000")
    priority: str = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, LOW
    is_user_modified: bool = False
    is_manually_added: bool = False
    reason: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class SmartRequirementDraftResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    draft_date: date
    status: str
    generated_at: datetime
    confirmed_at: Optional[datetime] = None
    confirmed_by_id: Optional[str] = None
    purchase_request_id: Optional[str] = None
    purchase_request_number: Optional[str] = None
    notes: Optional[str] = None
    items: List[SmartRequirementItemSchema] = []
    total_items: int = 0
    critical_count: int = 0
    high_priority_count: int = 0
    estimated_total_order_value: Decimal = Decimal("0.0000")
    audit_summary: Optional[Dict[str, Any]] = None

    @field_validator("audit_summary", mode="before")
    @classmethod
    def parse_audit_summary(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True

class GenerateRequirementRequest(BaseModel):
    branch_id: str
    draft_date: Optional[date] = None
    lead_time_days: Optional[int] = 1
    safety_buffer_percent: Optional[Decimal] = Decimal("10.00")
    force_regenerate: Optional[bool] = False
    notes: Optional[str] = None

class UpdateDraftItemsRequest(BaseModel):
    items: List[SmartRequirementItemSchema]
    notes: Optional[str] = None

class ConfirmDraftRequest(BaseModel):
    notes: Optional[str] = None
    priority: Optional[str] = "MEDIUM"

class ConfirmDraftResponse(BaseModel):
    success: bool
    draft_id: str
    purchase_request_id: str
    request_number: str
    branch_id: str
    branch_name: str
    items_count: int
    total_estimated_amount: Decimal
    message: str

class BranchRequirementConfigCreateUpdate(BaseModel):
    preparation_time: Optional[str] = "16:00"
    is_auto_enabled: Optional[bool] = True
    lead_time_days: Optional[int] = 1
    safety_buffer_percent: Optional[Decimal] = Decimal("10.00")

class BranchRequirementConfigResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    preparation_time: str
    is_auto_enabled: bool
    lead_time_days: int
    safety_buffer_percent: Decimal
    last_generated_date: Optional[date] = None

    class Config:
        from_attributes = True

class SmartAIAskRequest(BaseModel):
    branch_id: str
    question: str

class SmartAIAskResponse(BaseModel):
    success: bool
    branch_id: str
    branch_name: str
    question: str
    intent: str
    answer_text: str
    metrics: Dict[str, Any]
    items: List[SmartRequirementItemSchema]


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

class PurchaseOrderResponse(BaseModel):
    id: str
    company_id: str
    branch_id: Optional[str] = None
    supplier_id: str
    supplier_name: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_whatsapp: Optional[str] = None
    po_number: str
    status: POStatus
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


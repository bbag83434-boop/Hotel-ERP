from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models.wastage import WastageReasonCode, WastageStatus

class WastageItemCreate(BaseModel):
    item_id: str
    quantity: Decimal = Field(..., gt=Decimal("0.0000"), description="Quantity of item wasted")
    unit_id: Optional[str] = None
    unit_cost: Optional[Decimal] = Field(None, ge=Decimal("0.0000"), description="Unit cost at time of wastage; auto-filled if omitted")
    reason_code: WastageReasonCode = WastageReasonCode.EXPIRED
    batch_number: Optional[str] = None
    notes: Optional[str] = None

class WastageItemResponse(BaseModel):
    id: str
    wastage_entry_id: str
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_id: Optional[str] = None
    unit_symbol: Optional[str] = None
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    reason_code: WastageReasonCode
    batch_number: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class WastageEntryCreate(BaseModel):
    branch_id: str
    warehouse_id: str
    entry_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[WastageItemCreate] = Field(..., min_items=1, description="List of wasted items")
    auto_submit: bool = Field(False, description="Automatically submit for manager approval on creation")

class WastageEntryUpdate(BaseModel):
    notes: Optional[str] = None
    items: Optional[List[WastageItemCreate]] = None

class WastageApprovalAction(BaseModel):
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class WastageEntryResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    warehouse_id: str
    warehouse_name: Optional[str] = None
    entry_number: str
    entry_date: datetime
    status: WastageStatus
    total_cost: Decimal
    total_items_count: int
    requires_approval: bool
    reported_by_id: str
    reported_by_name: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    items: List[WastageItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WastageAnalyticsResponse(BaseModel):
    period_start: str
    period_end: str
    total_wastage_cost: Decimal
    total_wastage_entries: int
    total_items_wasted: Decimal
    by_reason: Dict[str, Dict[str, Any]]
    by_outlet: List[Dict[str, Any]]
    top_wasted_items: List[Dict[str, Any]]
    abnormal_alerts: List[Dict[str, Any]]

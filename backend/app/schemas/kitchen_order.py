from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# -------------------------------------------------------------
# Kitchen Order Schemas
# -------------------------------------------------------------
class KitchenOrderCreate(BaseModel):
    branch_id: str
    item_id: str
    requested_qty: Decimal = Field(gt=Decimal("0.0000"))
    required_date: Optional[datetime] = None
    notes: Optional[str] = None
    kitchen_warehouse_id: Optional[str] = None


class KitchenOrderStartProductionRequest(BaseModel):
    kitchen_warehouse_id: Optional[str] = None
    notes: Optional[str] = None


class KitchenOrderApproveRequest(BaseModel):
    notes: Optional[str] = None


class KitchenOrderRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class KitchenOrderIssueRequest(BaseModel):
    issue_qty: Decimal = Field(..., gt=Decimal("0.0000"))
    kitchen_warehouse_id: Optional[str] = None


class KitchenOrderDispatchRequest(BaseModel):
    # Optional override; if not provided, the saved issued_qty is used.
    dispatched_qty: Optional[Decimal] = Field(default=None, gt=Decimal("0.0000"))
    kitchen_warehouse_id: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


class KitchenOrderReceiveRequest(BaseModel):
    accepted_qty: Optional[Decimal] = Field(default=None, gt=Decimal("0.0000"))
    received_warehouse_id: Optional[str] = None
    notes: Optional[str] = None


class KitchenOrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class KitchenOrderAvailableItem(BaseModel):
    id: str
    code: str
    name: str
    type: str
    category_name: Optional[str] = None
    unit_symbol: Optional[str] = None
    cost_price: Decimal = Decimal("0.0000")
    selling_price: Decimal = Decimal("0.0000")
    has_recipe: bool = False


class KitchenOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    branch_type: Optional[str] = None

    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    item_type: Optional[str] = None
    unit_symbol: Optional[str] = None

    order_number: str
    requested_qty: Decimal
    issued_qty: Decimal = Decimal("0.0000")
    dispatched_qty: Decimal = Decimal("0.0000")
    received_qty: Decimal = Decimal("0.0000")
    status: str

    required_date: Optional[datetime] = None
    notes: Optional[str] = None

    kitchen_warehouse_id: Optional[str] = None
    kitchen_warehouse_name: Optional[str] = None
    kitchen_available_qty: Optional[Decimal] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None

    dispatched_by: Optional[str] = None
    dispatched_at: Optional[datetime] = None
    dispatch_notes: Optional[str] = None

    received_warehouse_id: Optional[str] = None
    received_warehouse_name: Optional[str] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    receive_notes: Optional[str] = None

    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    cancelled_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None

    # Challan metadata (computed)
    challan_number: Optional[str] = None
    central_kitchen_name: Optional[str] = None

    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
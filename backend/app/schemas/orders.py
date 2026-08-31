from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class OrderSource(str, Enum):
    ZOMATO = "ZOMATO"
    SWIGGY = "SWIGGY"
    MANUAL = "MANUAL"

class OrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: Decimal = Field(..., gt=0)
    notes: Optional[str] = Field(None, max_length=500)

class OrderCreate(BaseModel):
    branch_id: str
    source: OrderSource = OrderSource.MANUAL
    external_order_id: Optional[str] = Field(None, max_length=100)
    table_id: Optional[str] = None
    guest_count: int = Field(1, ge=1, le=999)
    customer_name: Optional[str] = Field(None, max_length=255)
    customer_phone: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=1000)
    items: List[OrderItemCreate] = Field(..., min_length=1)

class OrderItemResponse(BaseModel):
    id: str
    menu_item_id: str
    name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    status: str

class OrderResponse(BaseModel):
    id: str
    company_id: str
    branch_id: str
    order_number: str
    source: str
    external_order_id: Optional[str]
    table_id: Optional[str]
    status: str
    guest_count: int
    customer_name: Optional[str]
    customer_phone: Optional[str]
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    notes: Optional[str]
    created_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True

class OrderCompleteRequest(BaseModel):
    warehouse_id: str
    payment_method: Optional[str] = Field(None, pattern="^(CASH|UPI|CARD)$")
    received_amount: Optional[Decimal] = Field(None, ge=0)
    session_id: Optional[str] = None

class OrderStatsResponse(BaseModel):
    today_orders: int
    today_revenue: Decimal
    open_orders: int
    completed_orders: int
    zomato_orders: int
    swiggy_orders: int
    manual_orders: int

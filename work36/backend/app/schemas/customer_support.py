from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

class CustomerCreate(BaseModel):
    phone: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    email: Optional[str] = Field(default=None, max_length=255)
    customer_type: str = 'REGULAR'
    notes: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    email: Optional[str] = Field(default=None, max_length=255)
    customer_type: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerResponse(BaseModel):
    id: str
    phone: str
    name: str
    email: Optional[str]
    customer_type: str
    total_orders: int
    total_spent: Decimal
    loyalty_points: int
    is_active: bool
    notes: Optional[str]
    class Config:
        from_attributes = True

class LoyaltyAdjust(BaseModel):
    points: int = Field(description='Positive to add, negative to redeem/adjust')
    description: Optional[str] = Field(default=None, max_length=255)

class ComplaintCreate(BaseModel):
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    category: str = Field(min_length=1, max_length=80)
    severity: str = 'MEDIUM'
    description: str = Field(min_length=1, max_length=5000)
    assigned_to: Optional[str] = None

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    investigation: Optional[str] = None
    action_taken: Optional[str] = None
    resolution: Optional[str] = None
    compensation_amount: Optional[Decimal] = None
    root_cause: Optional[str] = None
    management_review: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    complaint_number: str
    branch_id: str
    customer_id: Optional[str]
    order_id: Optional[str]
    category: str
    severity: str
    status: str
    description: str
    assigned_to: Optional[str]
    investigation: Optional[str]
    action_taken: Optional[str]
    resolution: Optional[str]
    compensation_amount: Decimal
    root_cause: Optional[str]
    management_review: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    class Config:
        from_attributes = True

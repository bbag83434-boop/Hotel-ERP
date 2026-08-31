from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

class AssetCreate(BaseModel):
    branch_id: str
    asset_code: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=255)
    category: str = Field(min_length=2, max_length=100)
    location: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    service_contract_expiry: Optional[datetime] = None
    purchase_cost: Decimal = Decimal("0")
    notes: Optional[str] = None

class AssetResponse(AssetCreate):
    id: str
    company_id: str
    status: str
    is_active: bool
    open_ticket_count: int = 0
    warranty_days_remaining: Optional[int] = None

class TicketCreate(BaseModel):
    branch_id: str
    asset_id: Optional[str] = None
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=3)
    category: str = Field(min_length=2, max_length=100)
    priority: str = "MEDIUM"
    assigned_to_id: Optional[str] = None
    vendor_name: Optional[str] = None
    estimated_cost: Decimal = Decimal("0")
    due_at: Optional[datetime] = None

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None
    vendor_name: Optional[str] = None
    actual_cost: Optional[Decimal] = None
    downtime_minutes: Optional[int] = None
    due_at: Optional[datetime] = None
    resolution: Optional[str] = None

class TicketResponse(TicketCreate):
    id: str
    company_id: str
    ticket_number: str
    status: str
    actual_cost: Decimal
    downtime_minutes: int
    opened_at: datetime
    completed_at: Optional[datetime] = None
    asset_name: Optional[str] = None
    asset_code: Optional[str] = None

class MaintenanceSummary(BaseModel):
    assets: int
    active_assets: int
    open_tickets: int
    critical_tickets: int
    overdue_tickets: int
    warranty_expiring_30d: int
    estimated_open_cost: Decimal
    actual_cost_30d: Decimal

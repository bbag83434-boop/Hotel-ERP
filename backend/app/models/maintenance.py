import enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, DateTime, Text, Index
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class AssetStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    UNDER_REPAIR = "UNDER_REPAIR"
    OUT_OF_SERVICE = "OUT_OF_SERVICE"
    RETIRED = "RETIRED"

class MaintenanceStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_PARTS = "WAITING_PARTS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class MaintenancePriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class MaintenanceAsset(BaseModel):
    __tablename__ = "maintenance_assets"
    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_code = Column("assetCode", String(80), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    location = Column(String(255), nullable=True)
    manufacturer = Column(String(150), nullable=True)
    model_number = Column("modelNumber", String(150), nullable=True)
    serial_number = Column("serialNumber", String(150), nullable=True)
    purchase_date = Column("purchaseDate", DateTime, nullable=True)
    warranty_expiry = Column("warrantyExpiry", DateTime, nullable=True)
    service_contract_expiry = Column("serviceContractExpiry", DateTime, nullable=True)
    purchase_cost = Column("purchaseCost", Numeric(14, 2), nullable=True, default=0)
    status = Column(String(30), nullable=False, default=AssetStatus.ACTIVE.value, index=True)
    is_active = Column("isActive", Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    tickets = relationship("MaintenanceTicket", back_populates="asset", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_maintenance_assets_company_code", "companyId", "assetCode", unique=True),)

class MaintenanceTicket(BaseModel):
    __tablename__ = "maintenance_tickets"
    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    asset_id = Column("assetId", String(36), ForeignKey("maintenance_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_number = Column("ticketNumber", String(80), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False)
    priority = Column(String(30), nullable=False, default=MaintenancePriority.MEDIUM.value, index=True)
    status = Column(String(30), nullable=False, default=MaintenanceStatus.OPEN.value, index=True)
    assigned_to_id = Column("assignedToId", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_name = Column("vendorName", String(255), nullable=True)
    estimated_cost = Column("estimatedCost", Numeric(14, 2), nullable=False, default=0)
    actual_cost = Column("actualCost", Numeric(14, 2), nullable=False, default=0)
    downtime_minutes = Column("downtimeMinutes", Numeric(12, 0), nullable=False, default=0)
    opened_at = Column("openedAt", DateTime, nullable=False)
    due_at = Column("dueAt", DateTime, nullable=True)
    completed_at = Column("completedAt", DateTime, nullable=True)
    resolution = Column(Text, nullable=True)

    asset = relationship("MaintenanceAsset", back_populates="tickets")

    __table_args__ = (Index("ix_maintenance_tickets_company_branch_status", "companyId", "branchId", "status"),)

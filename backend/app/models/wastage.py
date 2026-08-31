import uuid
import enum
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Integer, Text, DateTime, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel

class WastageReasonCode(str, enum.Enum):
    EXPIRED = "EXPIRED"
    PREPARATION_LOSS = "PREPARATION_LOSS"
    BURNT_DROPPED = "BURNT_DROPPED"
    QUALITY_ISSUE = "QUALITY_ISSUE"
    STORAGE_FAILURE = "STORAGE_FAILURE"
    CUSTOMER_RETURN = "CUSTOMER_RETURN"
    OTHER = "OTHER"

class WastageStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class WastageEntry(BaseModel):
    __tablename__ = "wastage_entries"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column("kitchenWarehouseId", String(36), ForeignKey("warehouses.id"), nullable=False, index=True)
    entry_number = Column("entryNumber", String(50), nullable=False, index=True)
    entry_date = Column("entryDate", DateTime, default=datetime.utcnow, nullable=False)
    status = Column(SQLEnum(WastageStatus, name="wastage_status_enum", native_enum=False), default=WastageStatus.DRAFT, nullable=False, index=True)
    total_cost = Column("totalCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    total_items_count = Column("totalItemsCount", Integer, default=0, nullable=False)
    requires_approval = Column("requiresApproval", Boolean, default=False, nullable=False)
    reported_by_id = Column("reportedById", String(36), ForeignKey("users.id"), nullable=False)
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column("approvedAt", DateTime, nullable=True)
    rejection_reason = Column("rejectionReason", String(500), nullable=True)
    notes = Column(Text, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    warehouseId = synonym("warehouse_id")
    entryNumber = synonym("entry_number")
    entryDate = synonym("entry_date")
    totalCost = synonym("total_cost")
    totalItemsCount = synonym("total_items_count")
    requiresApproval = synonym("requires_approval")
    reportedById = synonym("reported_by_id")
    approvedById = synonym("approved_by_id")
    approvedAt = synonym("approved_at")
    rejectionReason = synonym("rejection_reason")

    branch = relationship("Branch", foreign_keys=[branch_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    reported_by = relationship("User", foreign_keys=[reported_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("WastageItem", back_populates="wastage_entry", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_wastage_company_branch", "companyId", "branchId"),
        Index("idx_wastage_entry_date", "entryDate"),
    )

class WastageItem(Base):
    __tablename__ = "wastage_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wastage_entry_id = Column("wastageEntryId", String(36), ForeignKey("wastage_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    unit_id = Column("unitId", String(36), ForeignKey("units.id"), nullable=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    total_cost = Column("totalCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reason_code = Column("reasonCode", SQLEnum(WastageReasonCode, name="wastage_reason_code_enum", native_enum=False), default=WastageReasonCode.EXPIRED, nullable=False)
    batch_number = Column("batchNumber", String(50), nullable=True)
    notes = Column(String(255), nullable=True)

    wastageEntryId = synonym("wastage_entry_id")
    itemId = synonym("item_id")
    unitId = synonym("unit_id")
    unitCost = synonym("unit_cost")
    totalCost = synonym("total_cost")
    reasonCode = synonym("reason_code")
    batchNumber = synonym("batch_number")

    wastage_entry = relationship("WastageEntry", back_populates="items")
    item = relationship("Item", foreign_keys=[item_id])
    unit = relationship("Unit", foreign_keys=[unit_id])

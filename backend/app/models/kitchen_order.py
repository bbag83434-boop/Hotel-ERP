import uuid
import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Text, DateTime, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel


class KitchenOrderStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"                    # Outlet placed the requirement
    APPROVED = "APPROVED"                      # Admin/HQ approved the requirement (appears in central kitchen queue)
    REJECTED = "REJECTED"                      # Admin/HQ rejected the requirement
    IN_PRODUCTION = "IN_PRODUCTION"            # Central/Production kitchen acknowledged (producing) — kept for backward compat
    DISPATCHED = "DISPATCHED"                  # Kitchen allocated/dispatched finished/semi-finished goods
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"  # Outlet received part of the dispatch
    RECEIVED = "RECEIVED"                      # Outlet received the full requested qty
    CANCELLED = "CANCELLED"


class KitchenOrder(BaseModel):
    """
    Outlet Kitchen Order — a requirement raised by an outlet against the
    Central/Production Kitchen for finished / semi-finished recipe-produced
    items (e.g. Gulab Jamun, desserts, gravy, sauce). The kitchen produces or
    allocates the item and dispatches it to the outlet; the outlet receives it
    through the Receiving flow and stock increases in the outlet warehouse.
    """

    __tablename__ = "kitchen_orders"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    # Outlet that raised the requirement
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    # Finished / semi-finished item from Item Master (must be a real Item)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)

    order_number = Column("orderNumber", String(50), nullable=False, index=True)
    requested_qty = Column("requestedQty", Numeric(14, 4), nullable=False)
    dispatched_qty = Column("dispatchedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    received_qty = Column("receivedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    status = Column(
        SQLEnum('SUBMITTED', 'APPROVED', 'REJECTED', 'IN_PRODUCTION', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED',
                name='KitchenOrderStatus'),
        default='SUBMITTED', nullable=False, index=True
    )

    required_date = Column("requiredDate", DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    # Issue quantity — the actual quantity the Central Kitchen decides to issue
    # (saved at Issue step; may be less than requested; used by Dispatch).
    issued_qty = Column("issuedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    # Kitchen / production warehouse fields
    kitchen_warehouse_id = Column("kitchenWarehouseId", String(36), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    batch_number = Column("batchNumber", String(100), nullable=True)
    expiry_date = Column("expiryDate", DateTime, nullable=True)

    # Dispatch (kitchen side) audit fields
    dispatched_by_id = Column("dispatchedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dispatched_at = Column("dispatchedAt", DateTime, nullable=True)
    dispatch_notes = Column("dispatchNotes", Text, nullable=True)

    # Receive (outlet side) audit fields
    received_warehouse_id = Column("receivedWarehouseId", String(36), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    received_by_id = Column("receivedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_at = Column("receivedAt", DateTime, nullable=True)
    receive_notes = Column("receiveNotes", Text, nullable=True)

    # Approval audit fields
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column("approvedAt", DateTime, nullable=True)
    rejected_by_id = Column("rejectedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejected_at = Column("rejectedAt", DateTime, nullable=True)
    rejection_reason = Column("rejectionReason", String(500), nullable=True)

    cancelled_by_id = Column("cancelledById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancelled_at = Column("cancelledAt", DateTime, nullable=True)
    cancel_reason = Column("cancelReason", String(500), nullable=True)

    created_by_id = Column("createdById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    itemId = synonym("item_id")
    orderNumber = synonym("order_number")
    requestedQty = synonym("requested_qty")
    dispatchedQty = synonym("dispatched_qty")
    receivedQty = synonym("received_qty")
    requiredDate = synonym("required_date")
    issuedQty = synonym("issued_qty")
    kitchenWarehouseId = synonym("kitchen_warehouse_id")
    batchNumber = synonym("batch_number")
    expiryDate = synonym("expiry_date")
    dispatchedById = synonym("dispatched_by_id")
    dispatchedAt = synonym("dispatched_at")
    dispatchNotes = synonym("dispatch_notes")
    receivedWarehouseId = synonym("received_warehouse_id")
    receivedById = synonym("received_by_id")
    receivedAt = synonym("received_at")
    receiveNotes = synonym("receive_notes")
    approvedById = synonym("approved_by_id")
    approvedAt = synonym("approved_at")
    rejectedById = synonym("rejected_by_id")
    rejectedAt = synonym("rejected_at")
    rejectionReason = synonym("rejection_reason")
    cancelledById = synonym("cancelled_by_id")
    cancelledAt = synonym("cancelled_at")
    cancelReason = synonym("cancel_reason")
    createdById = synonym("created_by_id")

    branch = relationship("Branch", foreign_keys=[branch_id], lazy="joined")
    item = relationship("Item", foreign_keys=[item_id], lazy="joined")
    kitchen_warehouse = relationship("Warehouse", foreign_keys=[kitchen_warehouse_id], lazy="joined")
    received_warehouse = relationship("Warehouse", foreign_keys=[received_warehouse_id], lazy="joined")
    dispatched_by = relationship("User", foreign_keys=[dispatched_by_id], lazy="joined")
    received_by = relationship("User", foreign_keys=[received_by_id], lazy="joined")
    approved_by = relationship("User", foreign_keys=[approved_by_id], lazy="joined")
    rejected_by = relationship("User", foreign_keys=[rejected_by_id], lazy="joined")
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id], lazy="joined")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined")

    __table_args__ = (
        Index("idx_kitchen_order_company_num", "companyId", "orderNumber", unique=True),
        Index("idx_kitchen_order_branch_status", "branchId", "status"),
    )
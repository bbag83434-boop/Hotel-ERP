from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class PRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ORDERED = "ORDERED"

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"

class GRNStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    QC_PASSED = "QC_PASSED"
    QC_FAILED = "QC_FAILED"
    REJECTED = "REJECTED"

class Supplier(BaseModel):
    __tablename__ = "suppliers"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    gst_number = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

class PurchaseRequest(BaseModel):
    __tablename__ = "purchase_requests"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    request_number = Column(String(50), unique=True, nullable=False, index=True)
    requested_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    required_date = Column(DateTime, nullable=False)
    status = Column(SQLEnum(PRStatus), default=PRStatus.PENDING_APPROVAL, nullable=False, index=True)
    is_direct_supplier_delivery = Column(Boolean, default=True, nullable=False)
    notes = Column(String(500), nullable=True)
    rejection_reason = Column(String(500), nullable=True)

    items = relationship("PurchaseRequestItem", back_populates="request", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="request")

class PurchaseRequestItem(BaseModel):
    __tablename__ = "purchase_request_items"

    request_id = Column(String(36), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    requested_qty = Column(Numeric(14, 4), nullable=False)
    estimated_price = Column(Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(255), nullable=True)

    request = relationship("PurchaseRequest", back_populates="items")

class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_branch_id = Column(String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    destination_warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(String(36), ForeignKey("suppliers.id"), nullable=False, index=True)
    request_id = Column(String(36), ForeignKey("purchase_requests.id", ondelete="SET NULL"), nullable=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    status = Column(SQLEnum(POStatus), default=POStatus.ISSUED, nullable=False, index=True)
    total_amount = Column(Numeric(14, 4), default=0, nullable=False)
    tax_amount = Column(Numeric(14, 4), default=0, nullable=False)
    grand_total = Column(Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(500), nullable=True)

    supplier = relationship("Supplier", back_populates="purchase_orders")
    request = relationship("PurchaseRequest", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="po", cascade="all, delete-orphan")
    grns = relationship("GoodsReceiveNote", back_populates="po")

class PurchaseOrderItem(BaseModel):
    __tablename__ = "purchase_order_items"

    po_id = Column(String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    ordered_qty = Column(Numeric(14, 4), nullable=False)
    received_qty = Column(Numeric(14, 4), default=0, nullable=False)
    unit_price = Column(Numeric(14, 4), nullable=False)
    total_price = Column(Numeric(14, 4), nullable=False)

    po = relationship("PurchaseOrder", back_populates="items")

class GoodsReceiveNote(BaseModel):
    __tablename__ = "goods_receive_notes"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(String(36), ForeignKey("warehouses.id"), nullable=False, index=True)
    po_id = Column(String(36), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    grn_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_invoice_number = Column(String(100), nullable=True)
    invoice_amount = Column(Numeric(14, 4), nullable=True)
    status = Column(SQLEnum(GRNStatus), default=GRNStatus.RECEIVED, nullable=False)

    po = relationship("PurchaseOrder", back_populates="grns")
    items = relationship("GoodsReceiveItem", back_populates="grn", cascade="all, delete-orphan")

class GoodsReceiveItem(BaseModel):
    __tablename__ = "goods_receive_items"

    grn_id = Column(String(36), ForeignKey("goods_receive_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    received_qty = Column(Numeric(14, 4), nullable=False)
    accepted_qty = Column(Numeric(14, 4), nullable=False)
    rejected_qty = Column(Numeric(14, 4), default=0, nullable=False)
    unit_price = Column(Numeric(14, 4), nullable=False)
    total_price = Column(Numeric(14, 4), nullable=False)

    grn = relationship("GoodsReceiveNote", back_populates="items")

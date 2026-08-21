import uuid
import enum
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, DateTime, Date, Integer, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel

class PRPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class PRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ORDERED = "ORDERED"
    CANCELLED = "CANCELLED"

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    WHATSAPP_OPENED = "WHATSAPP_OPENED"
    SENT_MANUALLY = "SENT_MANUALLY"
    ISSUED = "ISSUED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class GRNStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    QC_PASSED = "QC_PASSED"
    QC_FAILED = "QC_FAILED"
    REJECTED = "REJECTED"

class Supplier(BaseModel):
    __tablename__ = "suppliers"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    contact_person = Column("contactPerson", String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    whatsapp_number = Column("whatsappNumber", String(50), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    gst_number = Column("taxNumber", String(50), nullable=True)
    payment_terms = Column("paymentTerms", String(100), nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    companyId = synonym("company_id")
    contactPerson = synonym("contact_person")
    whatsappNumber = synonym("whatsapp_number")
    taxNumber = synonym("gst_number")
    paymentTerms = synonym("payment_terms")
    isActive = synonym("is_active")

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

    @property
    def effective_whatsapp_number(self) -> str:
        return self.whatsapp_number or self.phone or ""

class PurchaseRequest(BaseModel):
    __tablename__ = "purchase_requests"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    request_number = Column("requestNumber", String(50), unique=True, nullable=False, index=True)
    requested_by_id = Column("requestedById", String(36), ForeignKey("users.id"), nullable=False)
    required_date = Column("requiredDate", DateTime, nullable=False)
    status = Column(SQLEnum(PRStatus, name="PRStatus"), default=PRStatus.PENDING_APPROVAL, nullable=False, index=True)
    priority = Column(SQLEnum(PRPriority, name="PRPriority"), default=PRPriority.MEDIUM, nullable=False)
    notes = Column(String(500), nullable=True)
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column("approvedAt", DateTime, nullable=True)
    rejection_reason = Column("rejectionReason", String(500), nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    requestNumber = synonym("request_number")
    requestedById = synonym("requested_by_id")
    requiredDate = synonym("required_date")
    approvedById = synonym("approved_by_id")
    approvedAt = synonym("approved_at")
    rejectionReason = synonym("rejection_reason")

    branch = relationship("Branch")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("PurchaseRequestItem", back_populates="request", cascade="all, delete-orphan")

class PurchaseRequestItem(Base):
    __tablename__ = "purchase_request_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column("requestId", String(36), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_qty = Column("requestedQty", Numeric(14, 4), nullable=False)
    estimated_price = Column("estimatedPrice", Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(255), nullable=True)

    requestId = synonym("request_id")
    itemId = synonym("item_id")
    supplierId = synonym("supplier_id")
    requestedQty = synonym("requested_qty")
    estimatedPrice = synonym("estimated_price")

    request = relationship("PurchaseRequest", back_populates="items")
    item = relationship("Item")
    supplier = relationship("Supplier")

class PurchaseOrder(BaseModel):
    __tablename__ = "purchase_orders"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id"), nullable=False, index=True)
    po_number = Column("poNumber", String(50), unique=True, nullable=False, index=True)
    status = Column(SQLEnum(POStatus, name="POStatus"), default=POStatus.DRAFT, nullable=False, index=True)
    order_date = Column("orderDate", DateTime, default=datetime.utcnow, nullable=False)
    expected_delivery_date = Column("expectedDeliveryDate", DateTime, nullable=True)
    total_amount = Column("totalAmount", Numeric(14, 4), default=0, nullable=False)
    tax_amount = Column("taxAmount", Numeric(14, 4), default=0, nullable=False)
    discount_amount = Column("discountAmount", Numeric(14, 4), default=0, nullable=False)
    net_amount = Column("netAmount", Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(500), nullable=True)
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column("approvedAt", DateTime, nullable=True)
    whatsapp_opened_at = Column("whatsappOpenedAt", DateTime, nullable=True)
    whatsapp_number = Column("whatsappNumber", String(50), nullable=True)
    allocations = Column(Text, nullable=True)  # JSON-encoded outlet-wise item allocations

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    supplierId = synonym("supplier_id")
    poNumber = synonym("po_number")
    orderDate = synonym("order_date")
    expectedDeliveryDate = synonym("expected_delivery_date")
    totalAmount = synonym("total_amount")
    taxAmount = synonym("tax_amount")
    discountAmount = synonym("discount_amount")
    netAmount = synonym("net_amount")
    approvedById = synonym("approved_by_id")
    approvedAt = synonym("approved_at")
    whatsappOpenedAt = synonym("whatsapp_opened_at")
    whatsappNumber = synonym("whatsapp_number")

    @property
    def grand_total(self):
        return self.net_amount or self.total_amount

    @grand_total.setter
    def grand_total(self, val):
        self.net_amount = val

    supplier = relationship("Supplier", back_populates="purchase_orders")
    branch = relationship("Branch", foreign_keys=[branch_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("PurchaseOrderItem", back_populates="po", cascade="all, delete-orphan")
    grns = relationship("GoodsReceiveNote", back_populates="po")

class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    po_id = Column("poId", String(36), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    ordered_qty = Column("orderedQty", Numeric(14, 4), nullable=False)
    received_qty = Column("receivedQty", Numeric(14, 4), default=0, nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), default=0, nullable=False)
    total_price = Column("totalPrice", Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(255), nullable=True)
    allocations = Column(Text, nullable=True)  # JSON-encoded per-outlet breakdown for this item

    poId = synonym("po_id")
    itemId = synonym("item_id")
    orderedQty = synonym("ordered_qty")
    receivedQty = synonym("received_qty")
    unitPrice = synonym("unit_price")
    totalPrice = synonym("total_price")

    po = relationship("PurchaseOrder", back_populates="items")
    item = relationship("Item")

class GoodsReceiveNote(BaseModel):
    __tablename__ = "goods_receive_notes"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id"), nullable=False, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    po_id = Column("poId", String(36), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    grn_number = Column("grnNumber", String(50), unique=True, nullable=False, index=True)
    receive_date = Column("receiveDate", DateTime, default=datetime.utcnow, nullable=False)
    invoice_number = Column("invoiceNumber", String(100), nullable=True)
    total_amount = Column("totalAmount", Numeric(14, 4), default=0, nullable=True)
    status = Column(SQLEnum(GRNStatus, name="GRNStatus"), default=GRNStatus.RECEIVED, nullable=False)
    notes = Column(String(500), nullable=True)
    received_by_id = Column("receivedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    warehouseId = synonym("warehouse_id")
    supplierId = synonym("supplier_id")
    poId = synonym("po_id")
    grnNumber = synonym("grn_number")
    receiveDate = synonym("receive_date")
    invoiceNumber = synonym("invoice_number")
    totalAmount = synonym("total_amount")
    receivedById = synonym("received_by_id")

    po = relationship("PurchaseOrder", back_populates="grns")
    branch = relationship("Branch")
    warehouse = relationship("Warehouse")
    supplier = relationship("Supplier")
    received_by = relationship("User", foreign_keys=[received_by_id])
    items = relationship("GoodsReceiveItem", back_populates="grn", cascade="all, delete-orphan")

class GoodsReceiveItem(Base):
    __tablename__ = "goods_receive_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    grn_id = Column("grnId", String(36), ForeignKey("goods_receive_notes.id", ondelete="CASCADE"), nullable=False, index=True)
    po_item_id = Column("poItemId", String(36), ForeignKey("purchase_order_items.id", ondelete="SET NULL"), nullable=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    received_qty = Column("receivedQty", Numeric(14, 4), nullable=False)
    accepted_qty = Column("acceptedQty", Numeric(14, 4), nullable=False)
    rejected_qty = Column("rejectedQty", Numeric(14, 4), default=0, nullable=False)
    unit_price = Column("unitPrice", Numeric(14, 4), nullable=False)
    total_price = Column("totalPrice", Numeric(14, 4), nullable=False)
    batch_number = Column("batchNumber", String(100), nullable=True)
    expiry_date = Column("expiryDate", DateTime, nullable=True)
    qc_status = Column("qcStatus", String(50), default="PASSED", nullable=True)
    qc_notes = Column("qcNotes", String(255), nullable=True)

    grnId = synonym("grn_id")
    poItemId = synonym("po_item_id")
    itemId = synonym("item_id")
    receivedQty = synonym("received_qty")
    acceptedQty = synonym("accepted_qty")
    rejectedQty = synonym("rejected_qty")
    unitPrice = synonym("unit_price")
    totalPrice = synonym("total_price")
    batchNumber = synonym("batch_number")
    expiryDate = synonym("expiry_date")
    qcStatus = synonym("qc_status")
    qcNotes = synonym("qc_notes")

    grn = relationship("GoodsReceiveNote", back_populates="items")
    item = relationship("Item")
    po_item = relationship("PurchaseOrderItem")

class BranchRequirementConfig(BaseModel):
    __tablename__ = "branch_requirement_configs"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    preparation_time = Column("preparationTime", String(10), default="16:00", nullable=False)
    is_auto_enabled = Column("isAutoEnabled", Boolean, default=True, nullable=False)
    lead_time_days = Column("leadTimeDays", Integer, default=1, nullable=False)
    safety_buffer_percent = Column("safetyBufferPercent", Numeric(5, 2), default=Decimal("10.00"), nullable=False)
    last_generated_date = Column("lastGeneratedDate", Date, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    preparationTime = synonym("preparation_time")
    isAutoEnabled = synonym("is_auto_enabled")
    leadTimeDays = synonym("lead_time_days")
    safetyBufferPercent = synonym("safety_buffer_percent")
    lastGeneratedDate = synonym("last_generated_date")

    branch = relationship("Branch")

class SmartRequirementDraft(BaseModel):
    __tablename__ = "smart_requirement_drafts"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    draft_date = Column("draftDate", Date, nullable=False)
    status = Column(String(50), default="DRAFT", nullable=False)  # DRAFT, CONFIRMED, DISCARDED
    generated_at = Column("generatedAt", DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column("confirmedAt", DateTime, nullable=True)
    confirmed_by_id = Column("confirmedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    purchase_request_id = Column("purchaseRequestId", String(36), ForeignKey("purchase_requests.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    audit_summary = Column("auditSummary", Text, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    draftDate = synonym("draft_date")
    generatedAt = synonym("generated_at")
    confirmedAt = synonym("confirmed_at")
    confirmedById = synonym("confirmed_by_id")
    purchaseRequestId = synonym("purchase_request_id")
    auditSummary = synonym("audit_summary")

    branch = relationship("Branch")
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_id])
    purchase_request = relationship("PurchaseRequest", foreign_keys=[purchase_request_id])
    items = relationship("SmartRequirementItem", back_populates="draft", cascade="all, delete-orphan")

class SmartRequirementItem(Base):
    __tablename__ = "smart_requirement_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    draft_id = Column("draftId", String(36), ForeignKey("smart_requirement_drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    current_stock = Column("currentStock", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    min_stock = Column("minStock", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    target_stock = Column("targetStock", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    pending_incoming = Column("pendingIncoming", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    daily_consumption = Column("dailyConsumption", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    short_qty = Column("shortQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    system_suggested_qty = Column("systemSuggestedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    final_order_qty = Column("finalOrderQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    priority = Column(String(20), default="MEDIUM", nullable=False)
    is_user_modified = Column("isUserModified", Boolean, default=False, nullable=False)
    is_manually_added = Column("isManuallyAdded", Boolean, default=False, nullable=False)
    reason = Column(Text, nullable=True)
    notes = Column(String(255), nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    draftId = synonym("draft_id")
    itemId = synonym("item_id")
    supplierId = synonym("supplier_id")
    currentStock = synonym("current_stock")
    minStock = synonym("min_stock")
    targetStock = synonym("target_stock")
    pendingIncoming = synonym("pending_incoming")
    dailyConsumption = synonym("daily_consumption")
    shortQty = synonym("short_qty")
    systemSuggestedQty = synonym("system_suggested_qty")
    finalOrderQty = synonym("final_order_qty")
    isUserModified = synonym("is_user_modified")
    isManuallyAdded = synonym("is_manually_added")
    createdAt = synonym("created_at")
    updatedAt = synonym("updated_at")

    draft = relationship("SmartRequirementDraft", back_populates="items")
    item = relationship("Item")
    supplier = relationship("Supplier")


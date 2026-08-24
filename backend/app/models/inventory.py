import uuid
import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Enum as SQLEnum, Index, Date, DateTime, Text, Integer
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel

class ItemType(str, enum.Enum):
    RAW_MATERIAL = "RAW_MATERIAL"
    FINISHED_GOOD = "FINISHED_GOOD"
    SEMI_FINISHED = "SEMI_FINISHED"
    PACKAGING = "PACKAGING"
    ASSET = "ASSET"

class TransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class StockMovementType(str, enum.Enum):
    GRN = "GRN"
    PRODUCTION_IN = "PRODUCTION_IN"
    PRODUCTION_OUT = "PRODUCTION_OUT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"
    POS_SALE = "POS_SALE"
    WASTAGE = "WASTAGE"
    REVERSAL = "REVERSAL"

class StockCountStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    ADJUSTED = "ADJUSTED"
    CANCELLED = "CANCELLED"

class Category(BaseModel):
    __tablename__ = "categories"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)

    companyId = synonym("company_id")
    items = relationship("Item", back_populates="category")

    __table_args__ = (
        Index("idx_category_company_code", "companyId", "code", unique=True),
    )

class Unit(BaseModel):
    __tablename__ = "units"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)

    companyId = synonym("company_id")
    items = relationship("Item", back_populates="unit")

    __table_args__ = (
        Index("idx_unit_company_symbol", "companyId", "symbol", unique=True),
    )

class UnitConversion(BaseModel):
    __tablename__ = "unit_conversions"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    from_unit_id = Column(String(36), ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True)
    to_unit_id = Column(String(36), ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True)
    conversion_factor = Column(Numeric(14, 6), nullable=False)  # e.g., 1 KG = 1000 G (factor = 1000)

    companyId = synonym("company_id")
    fromUnitId = synonym("from_unit_id")
    toUnitId = synonym("to_unit_id")
    conversionFactor = synonym("conversion_factor")

    from_unit = relationship("Unit", foreign_keys=[from_unit_id])
    to_unit = relationship("Unit", foreign_keys=[to_unit_id])

class Item(BaseModel):
    __tablename__ = "items"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column("categoryId", String(36), ForeignKey("categories.id"), nullable=False, index=True)
    unit_id = Column("unitId", String(36), ForeignKey("units.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    barcode = Column(String(100), nullable=True)
    type = Column(SQLEnum(ItemType, name="ItemType"), default=ItemType.RAW_MATERIAL, nullable=False)
    description = Column(Text, nullable=True)
    
    cost_price = Column("costPrice", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    selling_price = Column("sellingPrice", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    min_stock_level = Column("minStockLevel", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reorder_qty = Column("reorderQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    supplier_id = Column("supplierId", String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    companyId = synonym("company_id")
    categoryId = synonym("category_id")
    unitId = synonym("unit_id")
    supplierId = synonym("supplier_id")
    costPrice = synonym("cost_price")
    sellingPrice = synonym("selling_price")
    minStockLevel = synonym("min_stock_level")
    reorderQty = synonym("reorder_qty")
    isActive = synonym("is_active")

    category = relationship("Category", back_populates="items")
    unit = relationship("Unit", back_populates="items")
    supplier = relationship("Supplier", foreign_keys=[supplier_id])
    stock_balances = relationship("StockBalance", back_populates="item")

    __table_args__ = (
        Index("idx_item_company_code", "companyId", "code", unique=True),
    )

class StockBalance(Base):
    __tablename__ = "stock_balances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    min_stock_level = Column("minStockLevel", Numeric(14, 4), nullable=True)
    reorder_qty = Column("reorderQty", Numeric(14, 4), nullable=True)
    updated_at = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    warehouseId = synonym("warehouse_id")
    itemId = synonym("item_id")
    minStockLevel = synonym("min_stock_level")
    reorderQty = synonym("reorder_qty")
    updatedAt = synonym("updated_at")

    @property
    def avg_unit_cost(self):
        return Decimal("0.0000")

    @property
    def avgUnitCost(self):
        return Decimal("0.0000")

    item = relationship("Item", back_populates="stock_balances")
    warehouse = relationship("Warehouse")

    __table_args__ = (
        Index("idx_stock_warehouse_item", "warehouseId", "itemId", unique=True),
    )

class StockBatch(BaseModel):
    __tablename__ = "stock_batches"

    warehouse_id = Column("warehouse_id", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("item_id", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column("batch_number", String(100), nullable=False, index=True)
    
    quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    unit_cost = Column("unit_cost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    expiry_date = Column("expiry_date", Date, nullable=True)
    mfg_date = Column("mfg_date", Date, nullable=True)
    is_active = Column("is_active", Boolean, default=True, nullable=False)

    warehouseId = synonym("warehouse_id")
    itemId = synonym("item_id")
    batchNumber = synonym("batch_number")
    unitCost = synonym("unit_cost")
    expiryDate = synonym("expiry_date")
    mfgDate = synonym("mfg_date")
    isActive = synonym("is_active")

    __table_args__ = (
        Index("idx_batch_warehouse_item_num", "warehouse_id", "item_id", "batch_number", unique=True),
    )

class StockLedger(Base):
    __tablename__ = "stock_ledgers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column("unitId", String(36), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    batch_number = Column("batchNumber", String(100), nullable=True)
    expiry_date = Column("expiryDate", DateTime, nullable=True)
    movement_type = Column("movementType", String(50), nullable=False)
    change_qty = Column("changeQty", Numeric(14, 4), nullable=False)
    balance_qty = Column("balanceQty", Numeric(14, 4), nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=True)
    total_cost = Column("totalCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=True)
    reference_type = Column("referenceType", String(100), nullable=False)
    reference_id = Column("referenceId", String(36), nullable=True)
    reversal_reference_id = Column("reversalReferenceId", String(36), nullable=True, index=True)
    idempotency_key = Column("idempotencyKey", String(255), nullable=True, index=True)
    is_emergency_override = Column("isEmergencyOverride", Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_by_id = Column("createdById", String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.utcnow, nullable=False)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    warehouseId = synonym("warehouse_id")
    itemId = synonym("item_id")
    unitId = synonym("unit_id")
    batchNumber = synonym("batch_number")
    expiryDate = synonym("expiry_date")
    movementType = synonym("movement_type")
    changeQty = synonym("change_qty")
    balanceQty = synonym("balance_qty")
    unitCost = synonym("unit_cost")
    totalCost = synonym("total_cost")
    referenceType = synonym("reference_type")
    referenceId = synonym("reference_id")
    reversalReferenceId = synonym("reversal_reference_id")
    idempotencyKey = synonym("idempotency_key")
    isEmergencyOverride = synonym("is_emergency_override")
    createdById = synonym("created_by_id")
    createdAt = synonym("created_at")

    warehouse = relationship("Warehouse")
    item = relationship("Item")
    unit = relationship("Unit", foreign_keys=[unit_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        Index("idx_ledger_wh_item_date", "warehouseId", "itemId", "createdAt"),
        Index("idx_ledger_company_branch", "companyId", "branchId"),
    )

class TransferStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    PENDING = "PENDING"        # kept for backward compat
    APPROVED = "APPROVED"
    DISPATCHED = "DISPATCHED"
    IN_TRANSIT = "IN_TRANSIT"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    FULLY_RECEIVED = "FULLY_RECEIVED"
    RECONCILED = "RECONCILED"
    COMPLETED = "COMPLETED"    # kept for backward compat
    CANCELLED = "CANCELLED"

class StockTransfer(BaseModel):
    __tablename__ = "stock_transfers"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    from_warehouse_id = Column("fromWarehouseId", String(36), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    to_warehouse_id = Column("toWarehouseId", String(36), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    source_branch_id = Column("sourceBranchId", String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    destination_branch_id = Column("destinationBranchId", String(36), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    transfer_number = Column("transferNumber", String(50), nullable=False, index=True)
    status = Column(String(50), default="REQUESTED", nullable=False, index=True)
    transfer_date = Column("transferDate", DateTime, nullable=False)
    expected_delivery_date = Column("expectedDeliveryDate", DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    dispatch_notes = Column("dispatchNotes", Text, nullable=True)
    rejection_reason = Column("rejectionReason", String(500), nullable=True)
    idempotency_key = Column("idempotencyKey", String(255), nullable=True)
    # Audit fields
    created_by_id = Column("createdById", String(36), ForeignKey("users.id"), nullable=True)
    requested_by_id = Column("requestedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column("approvedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column("approvedAt", DateTime, nullable=True)
    dispatched_by_id = Column("dispatchedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dispatched_at = Column("dispatchedAt", DateTime, nullable=True)
    received_by_id = Column("receivedById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_at = Column("receivedAt", DateTime, nullable=True)
    reconciled_by_id = Column("reconciledById", String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reconciled_at = Column("reconciledAt", DateTime, nullable=True)

    companyId = synonym("company_id")
    fromWarehouseId = synonym("from_warehouse_id")
    toWarehouseId = synonym("to_warehouse_id")
    sourceBranchId = synonym("source_branch_id")
    destinationBranchId = synonym("destination_branch_id")
    transferNumber = synonym("transfer_number")
    transferDate = synonym("transfer_date")
    expectedDeliveryDate = synonym("expected_delivery_date")
    dispatchNotes = synonym("dispatch_notes")
    rejectionReason = synonym("rejection_reason")
    idempotencyKey = synonym("idempotency_key")
    createdById = synonym("created_by_id")
    requestedById = synonym("requested_by_id")
    approvedById = synonym("approved_by_id")
    approvedAt = synonym("approved_at")
    dispatchedById = synonym("dispatched_by_id")
    dispatchedAt = synonym("dispatched_at")
    receivedById = synonym("received_by_id")
    receivedAt = synonym("received_at")
    reconciledById = synonym("reconciled_by_id")
    reconciledAt = synonym("reconciled_at")

    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])
    source_branch = relationship("Branch", foreign_keys=[source_branch_id])
    destination_branch = relationship("Branch", foreign_keys=[destination_branch_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    dispatched_by = relationship("User", foreign_keys=[dispatched_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
    reconciled_by = relationship("User", foreign_keys=[reconciled_by_id])
    items = relationship("StockTransferItem", back_populates="transfer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_transfer_company_num", "companyId", "transferNumber", unique=True),
    )

class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transfer_id = Column("transferId", String(36), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_qty = Column("requestedQty", Numeric(14, 4), nullable=True)      # originally requested
    quantity = Column(Numeric(14, 4), nullable=False)                          # approved/confirmed qty (alias: dispatched)
    dispatched_qty = Column("dispatchedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    accepted_qty = Column("acceptedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    damaged_qty = Column("damagedQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    short_qty = Column("shortQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    shortage_reason_code = Column("shortageReasonCode", String(50), nullable=True)
    unit_cost = Column("unitCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=True)
    batch_number = Column("batchNumber", String(100), nullable=True)
    expiry_date = Column("expiryDate", DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    transferId = synonym("transfer_id")
    itemId = synonym("item_id")
    requestedQty = synonym("requested_qty")
    dispatchedQty = synonym("dispatched_qty")
    acceptedQty = synonym("accepted_qty")
    damagedQty = synonym("damaged_qty")
    shortQty = synonym("short_qty")
    shortageReasonCode = synonym("shortage_reason_code")
    unitCost = synonym("unit_cost")
    batchNumber = synonym("batch_number")
    expiryDate = synonym("expiry_date")

    transfer = relationship("StockTransfer", back_populates="items")
    item = relationship("Item")



class StockCount(BaseModel):
    __tablename__ = "stock_counts"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=True, index=True)
    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    count_number = Column("countNumber", String(50), nullable=False, index=True)
    count_date = Column("countDate", DateTime, nullable=False)
    status = Column(SQLEnum('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='StockCountStatus'), default='DRAFT', nullable=False)
    created_by_id = Column("createdById", String(36), ForeignKey("users.id"), nullable=True)
    verified_by_id = Column("verifiedById", String(36), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    warehouseId = synonym("warehouse_id")
    countNumber = synonym("count_number")
    countDate = synonym("count_date")
    createdById = synonym("created_by_id")
    verifiedById = synonym("verified_by_id")

    warehouse = relationship("Warehouse")
    items = relationship("StockCountItem", back_populates="stock_count", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_count_company_num", "companyId", "countNumber", unique=True),
    )

class StockCountItem(Base):
    __tablename__ = "stock_count_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    stock_count_id = Column("stockCountId", String(36), ForeignKey("stock_counts.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    system_qty = Column("systemQty", Numeric(14, 4), nullable=False)
    physical_qty = Column("physicalQty", Numeric(14, 4), nullable=False)
    variance_qty = Column("varianceQty", Numeric(14, 4), nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=True)
    variance_value = Column("varianceValue", Numeric(14, 4), default=Decimal("0.0000"), nullable=True)
    batch_number = Column("batchNumber", String(100), nullable=True)
    remarks = Column(Text, nullable=True)

    stockCountId = synonym("stock_count_id")
    itemId = synonym("item_id")
    systemQty = synonym("system_qty")
    physicalQty = synonym("physical_qty")
    varianceQty = synonym("variance_qty")
    unitCost = synonym("unit_cost")
    varianceValue = synonym("variance_value")
    batchNumber = synonym("batch_number")

    stock_count = relationship("StockCount", back_populates="items")
    item = relationship("Item")

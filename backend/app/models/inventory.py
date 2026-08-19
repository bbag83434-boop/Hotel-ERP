from decimal import Decimal
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Enum as SQLEnum, Index, Date, DateTime, Text, Integer
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class ItemType(str, enum.Enum):
    RAW_MATERIAL = "RAW_MATERIAL"
    FINISHED_GOOD = "FINISHED_GOOD"
    SEMI_FINISHED = "SEMI_FINISHED"
    PACKAGING = "PACKAGING"
    ASSET = "ASSET"

class TransferStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    DISPATCHED = "DISPATCHED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"

class StockCountStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    ADJUSTED = "ADJUSTED"
    CANCELLED = "CANCELLED"

class Category(BaseModel):
    __tablename__ = "categories"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)

    items = relationship("Item", back_populates="category")

    __table_args__ = (
        Index("idx_category_company_code", "company_id", "code", unique=True),
    )

class Unit(BaseModel):
    __tablename__ = "units"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)

    items = relationship("Item", back_populates="unit")

    __table_args__ = (
        Index("idx_unit_company_symbol", "company_id", "symbol", unique=True),
    )

class UnitConversion(BaseModel):
    __tablename__ = "unit_conversions"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    from_unit_id = Column(String(36), ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True)
    to_unit_id = Column(String(36), ForeignKey("units.id", ondelete="CASCADE"), nullable=False, index=True)
    conversion_factor = Column(Numeric(14, 6), nullable=False)  # e.g., 1 KG = 1000 G (factor = 1000)

class Item(BaseModel):
    __tablename__ = "items"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    barcode = Column(String(100), nullable=True)
    type = Column(SQLEnum(ItemType), default=ItemType.RAW_MATERIAL, nullable=False)
    
    cost_price = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    selling_price = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    min_stock_level = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reorder_qty = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    category = relationship("Category", back_populates="items")
    unit = relationship("Unit", back_populates="items")
    stock_balances = relationship("StockBalance", back_populates="item")

    __table_args__ = (
        Index("idx_item_company_code", "company_id", "code", unique=True),
    )

class StockBalance(BaseModel):
    __tablename__ = "stock_balances"

    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reserved_quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    avg_unit_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    item = relationship("Item", back_populates="stock_balances")

    __table_args__ = (
        Index("idx_stock_warehouse_item", "warehouse_id", "item_id", unique=True),
    )

class StockBatch(BaseModel):
    __tablename__ = "stock_batches"

    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, index=True)
    
    quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    expiry_date = Column(Date, nullable=True)
    mfg_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("idx_batch_warehouse_item_num", "warehouse_id", "item_id", "batch_number", unique=True),
    )

class StockLedger(BaseModel):
    __tablename__ = "stock_ledgers"

    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String(50), nullable=False, index=True)  # GRN, POS_SALE, PRODUCTION_CONSUMPTION, PRODUCTION_YIELD, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    total_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(String(36), nullable=True)
    balance_after = Column(Numeric(14, 4), nullable=False)

    __table_args__ = (
        Index("idx_ledger_wh_item_date", "warehouse_id", "item_id", "createdAt"),
    )

class StockTransfer(BaseModel):
    __tablename__ = "stock_transfers"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    from_warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    to_warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    transfer_number = Column(String(50), nullable=False, index=True)
    status = Column(SQLEnum(TransferStatus), default=TransferStatus.DRAFT, nullable=False)
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    items = relationship("StockTransferItem", back_populates="transfer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_transfer_company_num", "company_id", "transfer_number", unique=True),
    )

class StockTransferItem(BaseModel):
    __tablename__ = "stock_transfer_items"

    transfer_id = Column(String(36), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    
    requested_quantity = Column(Numeric(14, 4), nullable=False)
    dispatched_quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    received_quantity = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    transfer = relationship("StockTransfer", back_populates="items")

class StockCount(BaseModel):
    __tablename__ = "stock_counts"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    
    count_number = Column(String(50), nullable=False, index=True)
    count_date = Column(Date, nullable=False)
    status = Column(SQLEnum(StockCountStatus), default=StockCountStatus.DRAFT, nullable=False)
    counted_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    items = relationship("StockCountItem", back_populates="stock_count", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_count_company_num", "company_id", "count_number", unique=True),
    )

class StockCountItem(BaseModel):
    __tablename__ = "stock_count_items"

    stock_count_id = Column(String(36), ForeignKey("stock_counts.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    
    system_quantity = Column(Numeric(14, 4), nullable=False)
    physical_quantity = Column(Numeric(14, 4), nullable=False)
    variance_quantity = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    variance_value = Column(Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    stock_count = relationship("StockCount", back_populates="items")

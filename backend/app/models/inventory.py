from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class ItemType(str, enum.Enum):
    RAW_MATERIAL = "RAW_MATERIAL"
    FINISHED_GOOD = "FINISHED_GOOD"
    SEMI_FINISHED = "SEMI_FINISHED"
    PACKAGING = "PACKAGING"
    ASSET = "ASSET"

class Category(BaseModel):
    __tablename__ = "categories"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)

    items = relationship("Item", back_populates="category")

class Unit(BaseModel):
    __tablename__ = "units"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False, index=True)

    items = relationship("Item", back_populates="unit")

class Item(BaseModel):
    __tablename__ = "items"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("units.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    barcode = Column(String(100), nullable=True)
    type = Column(SQLEnum(ItemType), default=ItemType.RAW_MATERIAL, nullable=False)
    cost_price = Column(Numeric(14, 4), default=0, nullable=False)
    selling_price = Column(Numeric(14, 4), default=0, nullable=False)
    min_stock_level = Column(Numeric(14, 4), default=0, nullable=False)
    reorder_qty = Column(Numeric(14, 4), default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    category = relationship("Category", back_populates="items")
    unit = relationship("Unit", back_populates="items")
    stock_balances = relationship("StockBalance", back_populates="item")

class StockBalance(BaseModel):
    __tablename__ = "stock_balances"

    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric(14, 4), default=0, nullable=False)
    reserved_quantity = Column(Numeric(14, 4), default=0, nullable=False)
    avg_unit_cost = Column(Numeric(14, 4), default=0, nullable=False)

    item = relationship("Item", back_populates="stock_balances")

class StockLedger(BaseModel):
    __tablename__ = "stock_ledgers"

    warehouse_id = Column(String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type = Column(String(50), nullable=False, index=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=0, nullable=False)
    total_cost = Column(Numeric(14, 4), default=0, nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(String(36), nullable=True)
    balance_after = Column(Numeric(14, 4), nullable=False)

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Numeric, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class ClosingPeriodType(str, enum.Enum):
    FIRST_HALF = "FIRST_HALF"   # Days 1 to 15
    SECOND_HALF = "SECOND_HALF" # Days 16 to Month-End

class ClosingStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    FINALIZED_LOCKED = "FINALIZED_LOCKED"
    REJECTED = "REJECTED"

class OutletClosingRecord(BaseModel):
    __tablename__ = "outlet_closing_records"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    period_type = Column(SQLEnum(ClosingPeriodType), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    status = Column(SQLEnum(ClosingStatus), default=ClosingStatus.DRAFT, nullable=False, index=True)

    opening_valuation = Column(Numeric(14, 4), default=0, nullable=False)
    total_purchases = Column(Numeric(14, 4), default=0, nullable=False)
    closing_physical_valuation = Column(Numeric(14, 4), default=0, nullable=False)
    calculated_consumption = Column(Numeric(14, 4), default=0, nullable=False)
    theoretical_food_cost = Column(Numeric(14, 4), default=0, nullable=False)
    actual_food_cost = Column(Numeric(14, 4), default=0, nullable=False)
    variance_amount = Column(Numeric(14, 4), default=0, nullable=False)
    variance_percentage = Column(Numeric(8, 4), default=0, nullable=False)

    notes = Column(String(500), nullable=True)
    submitted_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    verified_by_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    finalized_at = Column(DateTime, nullable=True)

    branch = relationship("Branch", back_populates="closing_records")
    closing_items = relationship("ClosingStockItem", back_populates="closing_record", cascade="all, delete-orphan")
    food_cost_breakdowns = relationship("FoodCostCalculation", back_populates="closing_record", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("branch_id", "year", "month", "period_type", name="uq_outlet_closing_period"),
    )

class ClosingStockItem(BaseModel):
    __tablename__ = "closing_stock_items"

    closing_record_id = Column(String(36), ForeignKey("outlet_closing_records.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("units.id"), nullable=True)
    opening_qty = Column(Numeric(14, 4), default=0, nullable=False)
    received_qty = Column(Numeric(14, 4), default=0, nullable=False)
    theoretical_closing_qty = Column(Numeric(14, 4), default=0, nullable=False)
    physical_closing_qty = Column(Numeric(14, 4), default=0, nullable=False)
    variance_qty = Column(Numeric(14, 4), default=0, nullable=False)
    unit_cost = Column(Numeric(14, 4), default=0, nullable=False)
    total_valuation = Column(Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(255), nullable=True)

    closing_record = relationship("OutletClosingRecord", back_populates="closing_items")
    item = relationship("Item")
    unit = relationship("Unit")

class FoodCostCalculation(BaseModel):
    __tablename__ = "food_cost_calculations"

    closing_record_id = Column(String(36), ForeignKey("outlet_closing_records.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    sales_revenue = Column(Numeric(14, 4), default=0, nullable=False)
    theoretical_cost = Column(Numeric(14, 4), default=0, nullable=False)
    actual_cost = Column(Numeric(14, 4), default=0, nullable=False)
    theoretical_cost_pct = Column(Numeric(8, 4), default=0, nullable=False)
    actual_cost_pct = Column(Numeric(8, 4), default=0, nullable=False)
    variance_cost = Column(Numeric(14, 4), default=0, nullable=False)
    variance_pct = Column(Numeric(8, 4), default=0, nullable=False)

    closing_record = relationship("OutletClosingRecord", back_populates="food_cost_breakdowns")

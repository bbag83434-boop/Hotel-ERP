import uuid
import enum
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Integer, Text, DateTime, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel

class ProductionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Recipe(BaseModel):
    __tablename__ = "recipes"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    finished_item_id = Column("finishedItemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    effective_date = Column("effectiveDate", DateTime, default=datetime.utcnow, nullable=False)
    effective_to = Column("effectiveTo", DateTime, nullable=True)
    is_current = Column("isCurrent", Boolean, default=True, nullable=False)
    description = Column(String(500), nullable=True)
    yield_qty = Column("yieldQty", Numeric(14, 4), default=Decimal("1.0000"), nullable=False)
    preparation_minutes = Column("preparationMinutes", Integer, default=15, nullable=False)
    instructions = Column(Text, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)

    companyId = synonym("company_id")
    finishedItemId = synonym("finished_item_id")
    effectiveDate = synonym("effective_date")
    effectiveTo = synonym("effective_to")
    isCurrent = synonym("is_current")
    yieldQty = synonym("yield_qty")
    preparationMinutes = synonym("preparation_minutes")
    isActive = synonym("is_active")

    finished_item = relationship("Item", foreign_keys=[finished_item_id])
    ingredients = relationship("RecipeItem", back_populates="recipe", cascade="all, delete-orphan")
    production_orders = relationship("ProductionOrder", back_populates="recipe")

    __table_args__ = (
        Index("idx_recipe_company_code_version", "companyId", "code", "version", unique=True),
    )

class RecipeItem(Base):
    __tablename__ = "recipe_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id = Column("recipeId", String(36), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_item_id = Column("rawItemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    unit_id = Column("unitId", String(36), ForeignKey("units.id"), nullable=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    gross_quantity = Column("grossQuantity", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    usable_yield = Column("usableYield", Numeric(5, 2), default=Decimal("100.00"), nullable=False)
    waste_percentage = Column("wastePercentage", Numeric(5, 2), default=Decimal("0.00"), nullable=False)
    cost_contribution = Column("costContribution", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    notes = Column(String(255), nullable=True)

    recipeId = synonym("recipe_id")
    rawItemId = synonym("raw_item_id")
    unitId = synonym("unit_id")
    grossQuantity = synonym("gross_quantity")
    usableYield = synonym("usable_yield")
    wastePercentage = synonym("waste_percentage")
    costContribution = synonym("cost_contribution")

    recipe = relationship("Recipe", back_populates="ingredients")
    raw_item = relationship("Item", foreign_keys=[raw_item_id])
    unit = relationship("Unit", foreign_keys=[unit_id])

class ProductionOrder(BaseModel):
    __tablename__ = "production_orders"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    kitchen_warehouse_id = Column("kitchenWarehouseId", String(36), ForeignKey("warehouses.id"), nullable=False, index=True)
    recipe_id = Column("recipeId", String(36), ForeignKey("recipes.id"), nullable=False, index=True)
    order_number = Column("orderNumber", String(50), nullable=False, index=True)
    planned_qty = Column("plannedQty", Numeric(14, 4), nullable=False)
    actual_yield_qty = Column("actualYieldQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    wastage_qty = Column("wastageQty", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    status = Column(SQLEnum('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='ProductionStatus'), default='DRAFT', nullable=False)
    planned_date = Column("plannedDate", DateTime, nullable=True)
    completed_date = Column("completedDate", DateTime, nullable=True)
    total_raw_cost = Column("totalRawCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    unit_food_cost = Column("unitFoodCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    notes = Column(Text, nullable=True)
    idempotency_key = Column("idempotencyKey", String(255), nullable=True, unique=True)
    created_by_id = Column("createdById", String(36), ForeignKey("users.id"), nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    kitchenWarehouseId = synonym("kitchen_warehouse_id")
    recipeId = synonym("recipe_id")
    orderNumber = synonym("order_number")
    plannedQty = synonym("planned_qty")
    actualYieldQty = synonym("actual_yield_qty")
    wastageQty = synonym("wastage_qty")
    plannedDate = synonym("planned_date")
    completedDate = synonym("completed_date")
    totalRawCost = synonym("total_raw_cost")
    unitFoodCost = synonym("unit_food_cost")
    idempotencyKey = synonym("idempotency_key")
    createdById = synonym("created_by_id")

    recipe = relationship("Recipe", back_populates="production_orders")
    kitchen_warehouse = relationship("Warehouse", foreign_keys=[kitchen_warehouse_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    consumptions = relationship("ProductionConsumption", back_populates="production_order", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_prod_order_company_num", "companyId", "orderNumber", unique=True),
    )

class ProductionConsumption(Base):
    __tablename__ = "production_consumptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_order_id = Column("productionOrderId", String(36), ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_item_id = Column("rawItemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    stock_batch_id = Column("stockBatchId", String(36), ForeignKey("stock_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    batch_number = Column("batchNumber", String(100), nullable=True)
    standard_qty = Column("standardQty", Numeric(14, 4), nullable=False)
    actual_consumed_qty = Column("actualConsumedQty", Numeric(14, 4), nullable=False)
    unit_cost = Column("unitCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)
    total_cost = Column("totalCost", Numeric(14, 4), default=Decimal("0.0000"), nullable=False)

    productionOrderId = synonym("production_order_id")
    rawItemId = synonym("raw_item_id")
    stockBatchId = synonym("stock_batch_id")
    batchNumber = synonym("batch_number")
    standardQty = synonym("standard_qty")
    actualConsumedQty = synonym("actual_consumed_qty")
    unitCost = synonym("unit_cost")
    totalCost = synonym("total_cost")

    production_order = relationship("ProductionOrder", back_populates="consumptions")
    raw_item = relationship("Item", foreign_keys=[raw_item_id])
    stock_batch = relationship("StockBatch", foreign_keys=[stock_batch_id])

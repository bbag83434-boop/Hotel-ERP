from sqlalchemy import Column, String, Boolean, ForeignKey, Numeric, Integer, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel

class ProductionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Recipe(BaseModel):
    __tablename__ = "recipes"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    finished_item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    yield_qty = Column(Numeric(14, 4), default=1, nullable=False)
    preparation_minutes = Column(Integer, default=15, nullable=False)
    instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    ingredients = relationship("RecipeItem", back_populates="recipe", cascade="all, delete-orphan")
    production_orders = relationship("ProductionOrder", back_populates="recipe")

class RecipeItem(BaseModel):
    __tablename__ = "recipe_items"

    recipe_id = Column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)
    raw_item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("units.id"), nullable=True)
    quantity = Column(Numeric(14, 4), nullable=False)
    cost_contribution = Column(Numeric(14, 4), default=0, nullable=False)
    notes = Column(String(255), nullable=True)

    recipe = relationship("Recipe", back_populates="ingredients")

class ProductionOrder(BaseModel):
    __tablename__ = "production_orders"

    company_id = Column(String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    kitchen_warehouse_id = Column(String(36), ForeignKey("warehouses.id"), nullable=False, index=True)
    recipe_id = Column(String(36), ForeignKey("recipes.id"), nullable=False, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    planned_qty = Column(Numeric(14, 4), nullable=False)
    actual_qty = Column(Numeric(14, 4), default=0, nullable=False)
    status = Column(SQLEnum(ProductionStatus), default=ProductionStatus.DRAFT, nullable=False)
    total_cost = Column(Numeric(14, 4), default=0, nullable=False)
    unit_cost = Column(Numeric(14, 4), default=0, nullable=False)

    recipe = relationship("Recipe", back_populates="production_orders")
    consumptions = relationship("ProductionConsumption", back_populates="production_order", cascade="all, delete-orphan")

class ProductionConsumption(BaseModel):
    __tablename__ = "production_consumptions"

    production_order_id = Column(String(36), ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id"), nullable=False, index=True)
    planned_qty = Column(Numeric(14, 4), nullable=False)
    actual_qty = Column(Numeric(14, 4), nullable=False)
    unit_cost = Column(Numeric(14, 4), default=0, nullable=False)
    total_cost = Column(Numeric(14, 4), default=0, nullable=False)

    production_order = relationship("ProductionOrder", back_populates="consumptions")

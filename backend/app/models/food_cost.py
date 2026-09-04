"""Food Cost module models."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, String, Boolean, ForeignKey, Numeric, Integer, DateTime, Text,
    Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base
from app.models.base import BaseModel


class FoodCostConfig(BaseModel):
    __tablename__ = "food_cost_configs"
    company_id = Column("companyId", String(36),
                        ForeignKey("companies.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    effective_date = Column("effectiveDate", DateTime,
                            default=datetime.utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_by_id = Column("createdById", String(36),
                           ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    companyId = synonym("company_id")
    isActive = synonym("is_active")
    effectiveDate = synonym("effective_date")
    cost_heads = relationship("FoodCostCostHead", back_populates="config",
                              cascade="all, delete-orphan",
                              order_by="FoodCostCostHead.display_order")
    markup_options = relationship("FoodCostMarkupOption", back_populates="config",
                                  cascade="all, delete-orphan",
                                  order_by="FoodCostMarkupOption.display_order")
    snapshots = relationship("FoodCostSnapshot", back_populates="config")
    __table_args__ = (
        Index("idx_food_cost_config_company_active", "companyId", "isActive"),
        Index("idx_food_cost_config_company_version", "companyId", "version"),
    )


class FoodCostCostHead(BaseModel):
    __tablename__ = "food_cost_cost_heads"
    config_id = Column("configId", String(36),
                       ForeignKey("food_cost_configs.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    percentage = Column(Numeric(10, 4), default=Decimal("0.0000"), nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    display_order = Column("displayOrder", Integer, default=0, nullable=False)
    configId = synonym("config_id")
    isActive = synonym("is_active")
    displayOrder = synonym("display_order")
    config = relationship("FoodCostConfig", back_populates="cost_heads")


class FoodCostMarkupOption(BaseModel):
    __tablename__ = "food_cost_markup_options"
    config_id = Column("configId", String(36),
                       ForeignKey("food_cost_configs.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    percentage = Column(Numeric(10, 4), default=Decimal("0.0000"), nullable=False)
    label = Column(String(20), nullable=False)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    display_order = Column("displayOrder", Integer, default=0, nullable=False)
    configId = synonym("config_id")
    isActive = synonym("is_active")
    displayOrder = synonym("display_order")
    config = relationship("FoodCostConfig", back_populates="markup_options")
    __table_args__ = (
        UniqueConstraint("configId", "percentage", name="uq_markup_config_pct"),
        Index("idx_markup_config_active", "configId", "isActive"),
    )



class FoodCostSnapshot(BaseModel):
    """Immutable record of a completed Food Cost calculation."""
    __tablename__ = "food_cost_snapshots"
    company_id = Column("companyId", String(36),
                        ForeignKey("companies.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    branch_id = Column("branchId", String(36),
                        ForeignKey("branches.id", ondelete="SET NULL"),
                        nullable=True, index=True)
    config_id = Column("configId", String(36),
                        ForeignKey("food_cost_configs.id", ondelete="SET NULL"),
                        nullable=True, index=True)
    calculation_date = Column("calculationDate", DateTime,
                              default=datetime.utcnow, nullable=False)
    effective_date = Column("effectiveDate", DateTime, nullable=True)
    ingredient_cost = Column("ingredientCost", Numeric(14, 4),
                             default=Decimal("0.0000"), nullable=False)
    management_cost_total = Column("managementCostTotal", Numeric(14, 4),
                                   default=Decimal("0.0000"), nullable=False)
    management_cost_percentage = Column("managementCostPercentage", Numeric(10, 4),
                                        default=Decimal("0.0000"), nullable=False)
    total_cost = Column("totalCost", Numeric(14, 4),
                        default=Decimal("0.0000"), nullable=False)
    selected_markup_percentage = Column("selectedMarkupPercentage", Numeric(10, 4),
                                        nullable=True)
    final_selling_cost = Column("finalSellingCost", Numeric(14, 4),
                                default=Decimal("0.0000"), nullable=False)
    ingredient_lines = Column("ingredientLines", Text, nullable=False)
    idempotency_key = Column("idempotencyKey", String(255),
                             nullable=True, unique=True, index=True)
    notes = Column(String(500), nullable=True)
    created_by_id = Column("createdById", String(36),
                           ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True, index=True)
    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    configId = synonym("config_id")
    calculationDate = synonym("calculation_date")
    effectiveDate = synonym("effective_date")
    ingredientCost = synonym("ingredient_cost")
    managementCostTotal = synonym("management_cost_total")
    managementCostPercentage = synonym("management_cost_percentage")
    totalCost = synonym("total_cost")
    selectedMarkupPercentage = synonym("selected_markup_percentage")
    finalSellingCost = synonym("final_selling_cost")
    ingredientLines = synonym("ingredient_lines")
    idempotencyKey = synonym("idempotency_key")
    createdById = synonym("created_by_id")
    config = relationship("FoodCostConfig")
    branch = relationship("Branch")
    __table_args__ = (
        Index("idx_snapshot_company_date", "companyId", "calculationDate"),
        Index("idx_snapshot_idempotency", "idempotencyKey"),
    )
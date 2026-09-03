from sqlalchemy import Column, String, ForeignKey, Numeric, Date, Text
from sqlalchemy.orm import relationship, synonym
from app.models.base import BaseModel

class OutletSale(BaseModel):
    __tablename__ = "outlet_sales"

    company_id = Column("companyId", String(36), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column("branchId", String(36), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column("warehouseId", String(36), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column("itemId", String(36), ForeignKey("items.id"), nullable=False, index=True)
    recipe_id = Column("recipeId", String(36), ForeignKey("recipes.id"), nullable=True)
    
    transaction_date = Column("transactionDate", Date, nullable=False)
    quantity = Column(Numeric(14, 4), default=0, nullable=False)
    unit_id = Column("unitId", String(36), ForeignKey("units.id"), nullable=False)
    
    total_cost = Column("totalCost", Numeric(14, 4), default=0, nullable=False)
    cost_per_unit = Column("costPerUnit", Numeric(14, 4), default=0, nullable=False)
    
    status = Column(String(50), default="COMPLETED", nullable=False)
    created_by_id = Column("createdById", String(36), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    companyId = synonym("company_id")
    branchId = synonym("branch_id")
    warehouseId = synonym("warehouse_id")
    itemId = synonym("item_id")
    recipeId = synonym("recipe_id")
    transactionDate = synonym("transaction_date")
    unitId = synonym("unit_id")
    totalCost = synonym("total_cost")
    costPerUnit = synonym("cost_per_unit")
    createdById = synonym("created_by_id")

    item = relationship("Item", foreign_keys=[item_id])
    recipe = relationship("Recipe", foreign_keys=[recipe_id])
    unit = relationship("Unit", foreign_keys=[unit_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    creator = relationship("User", foreign_keys=[created_by_id])
    
    ingredients = relationship("OutletSaleIngredient", back_populates="sale", cascade="all, delete-orphan")
    
class OutletSaleIngredient(BaseModel):
    __tablename__ = "outlet_sale_ingredients"

    sale_id = Column("saleId", String(36), ForeignKey("outlet_sales.id", ondelete="CASCADE"), nullable=False, index=True)
    ingredient_item_id = Column("ingredientItemId", String(36), ForeignKey("items.id"), nullable=False)
    unit_id = Column("unitId", String(36), ForeignKey("units.id"), nullable=False)
    
    required_qty = Column("requiredQty", Numeric(14, 4), default=0, nullable=False)
    consumed_qty = Column("consumedQty", Numeric(14, 4), default=0, nullable=False)
    
    rate = Column(Numeric(14, 4), default=0, nullable=False)
    cost = Column(Numeric(14, 4), default=0, nullable=False)

    saleId = synonym("sale_id")
    ingredientItemId = synonym("ingredient_item_id")
    unitId = synonym("unit_id")
    requiredQty = synonym("required_qty")
    consumedQty = synonym("consumed_qty")

    sale = relationship("OutletSale", back_populates="ingredients")
    ingredient_item = relationship("Item", foreign_keys=[ingredient_item_id])
    unit = relationship("Unit", foreign_keys=[unit_id])

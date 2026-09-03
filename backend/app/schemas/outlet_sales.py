from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime

class IngredientRequirementInfo(BaseModel):
    ingredient_item_id: str
    ingredient_name: str
    unit_id: str
    unit_symbol: str
    required_qty: Decimal
    available_qty: Decimal
    rate: Decimal
    cost: Decimal
    is_shortage: bool
    shortage_qty: Decimal

class OutletSalePreviewRequest(BaseModel):
    branch_id: str
    item_id: str
    quantity: Decimal
    unit_id: str

class OutletSalePreviewResponse(BaseModel):
    item_id: str
    item_name: str
    sold_qty: Decimal
    recipe_id: str
    recipe_yield: Decimal
    ingredients: List[IngredientRequirementInfo]
    total_cost: Decimal
    is_valid: bool
    message: str

class OutletSaleCreate(BaseModel):
    branch_id: str
    item_id: str
    quantity: Decimal
    unit_id: str
    transaction_date: date
    idempotency_key: str

class OutletSaleIngredientSchema(BaseModel):
    id: str
    ingredient_item_id: str
    unit_id: str
    required_qty: Decimal
    consumed_qty: Decimal
    rate: Decimal
    cost: Decimal

    class Config:
        from_attributes = True

class OutletSaleSchema(BaseModel):
    id: str
    branch_id: str
    warehouse_id: str
    item_id: str
    recipe_id: Optional[str]
    transaction_date: date
    quantity: Decimal
    unit_id: str
    total_cost: Decimal
    cost_per_unit: Decimal
    status: str
    created_by_id: Optional[str]
    created_at: datetime
    ingredients: List[OutletSaleIngredientSchema]

    class Config:
        from_attributes = True

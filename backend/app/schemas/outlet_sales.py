from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================
# INGREDIENT PREVIEW
# ============================================================

class IngredientRequirementInfo(BaseModel):
    ingredient_item_id: str
    ingredient_name: str

    # Recipe / stock comparison unit.
    unit_id: str
    unit_symbol: str

    required_qty: Decimal = Field(..., ge=0)
    available_qty: Decimal = Field(..., ge=0)

    rate: Decimal = Field(..., ge=0)
    cost: Decimal = Field(..., ge=0)

    is_shortage: bool
    shortage_qty: Decimal = Field(..., ge=0)


# ============================================================
# PREVIEW REQUEST
# ============================================================

class OutletSalePreviewRequest(BaseModel):
    branch_id: str
    item_id: str

    quantity: Decimal = Field(..., gt=0)
    unit_id: str


# ============================================================
# PREVIEW RESPONSE
# ============================================================

class OutletSalePreviewResponse(BaseModel):
    item_id: str
    item_name: str

    sold_qty: Decimal = Field(..., gt=0)
    recipe_id: str
    recipe_yield: Decimal = Field(..., gt=0)

    ingredients: List[IngredientRequirementInfo] = Field(default_factory=list)

    total_cost: Decimal = Field(..., ge=0)

    is_valid: bool
    message: str


# ============================================================
# CREATE / POST REQUEST
# ============================================================

class OutletSaleCreate(BaseModel):
    branch_id: str
    item_id: str

    quantity: Decimal = Field(..., gt=0)
    unit_id: str

    transaction_date: date

    # Used to prevent duplicate posting of the same Admin action.
    idempotency_key: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )


# ============================================================
# POSTED INGREDIENT HISTORY
# ============================================================

class OutletSaleIngredientSchema(BaseModel):
    id: str

    ingredient_item_id: str
    unit_id: str

    required_qty: Decimal = Field(..., ge=0)
    consumed_qty: Decimal = Field(..., ge=0)

    rate: Decimal = Field(..., ge=0)
    cost: Decimal = Field(..., ge=0)

    class Config:
        from_attributes = True


# ============================================================
# POSTED OUTLET SALE
# ============================================================

class OutletSaleSchema(BaseModel):
    id: str

    branch_id: str
    warehouse_id: str

    item_id: str
    recipe_id: Optional[str] = None

    transaction_date: date

    quantity: Decimal = Field(..., gt=0)
    unit_id: str

    total_cost: Decimal = Field(..., ge=0)
    cost_per_unit: Decimal = Field(..., ge=0)

    status: str

    created_by_id: Optional[str] = None
    created_at: datetime

    ingredients: List[OutletSaleIngredientSchema] = Field(
        default_factory=list
    )

    class Config:
        from_attributes = True

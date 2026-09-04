"""Food Cost schemas.

All schemas serialize/deserialize with camelCase aliases to match the ERP's
existing REST convention. Pydantic also accepts the pythonic field names
(populate_by_name), so backend code stays snake_case while the wire uses
camelCase just like every other endpoint in the application.
"""
from decimal import Decimal
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict


def to_camel(value: str) -> str:
    if "_" not in value:
        return value
    head, *rest = value.split("_")
    return head + "".join(part.title() for part in rest)


# -------------------------------------------------------------
# Cost Head Schemas
# -------------------------------------------------------------
class FoodCostCostHeadBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    name: str = Field(..., max_length=100)
    percentage: Decimal = Field(..., ge=0, le=100, decimal_places=4)
    is_active: bool = True
    sort_order: int = Field(0, ge=0)


class FoodCostCostHeadCreate(FoodCostCostHeadBase):
    pass


class FoodCostCostHeadUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    id: Optional[str] = None
    name: Optional[str] = None
    percentage: Optional[Decimal] = Field(None, ge=0, le=100, decimal_places=4)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)


class FoodCostCostHeadResponse(FoodCostCostHeadBase):
    id: str
    config_id: str
    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, alias_generator=to_camel
    )


# -------------------------------------------------------------
# Markup Option Schemas
# -------------------------------------------------------------
class FoodCostMarkupOptionBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    label: str = Field(..., max_length=20)
    percentage: Decimal = Field(..., ge=0, decimal_places=4)
    is_active: bool = True
    sort_order: int = Field(0, ge=0)


class FoodCostMarkupOptionCreate(FoodCostMarkupOptionBase):
    pass


class FoodCostMarkupOptionUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    id: Optional[str] = None
    label: Optional[str] = None
    percentage: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)


class FoodCostMarkupOptionResponse(FoodCostMarkupOptionBase):
    id: str
    config_id: str
    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, alias_generator=to_camel
    )
# -------------------------------------------------------------
# Config Schemas
# -------------------------------------------------------------
class FoodCostConfigUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    cost_heads: Optional[List[FoodCostCostHeadUpdate]] = None
    markup_options: Optional[List[FoodCostMarkupOptionUpdate]] = None


class FoodCostConfigPublicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    id: str
    company_id: str
    # Deliberately NO management_cost_percentage and NO cost_heads: the public
    # response the Main page consumes must never reveal the private config.
    active_markup_options: List[FoodCostMarkupOptionResponse]


class FoodCostConfigAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    id: str
    company_id: str
    management_cost_percentage: Decimal
    cost_heads: List[FoodCostCostHeadResponse]
    markup_options: List[FoodCostMarkupOptionResponse]


# -------------------------------------------------------------
# Calculation Schemas
# -------------------------------------------------------------
class FoodCostIngredientInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    item_id: str
    quantity: Decimal = Field(..., gt=0, decimal_places=4)
    unit_id: str


class FoodCostCalculationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    ingredients: List[FoodCostIngredientInput] = Field(..., min_length=1)
    calculation_date: Optional[date] = None
    idempotency_key: Optional[str] = Field(None, max_length=255)


class FoodCostSaveRequest(BaseModel):
    """Persist request. Re-running with the same idempotency key never creates
    a duplicate financial record."""
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)
    ingredients: List[FoodCostIngredientInput] = Field(..., min_length=1)
    calculation_date: Optional[date] = None
    markup_percentage: Optional[Decimal] = Field(None, ge=0, le=1000, decimal_places=4)
    idempotency_key: str = Field(..., min_length=1, max_length=255)


class FoodCostIngredientResult(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    item_id: str
    item_name: str
    item_code: str
    quantity: Decimal
    unit_id: str
    unit_symbol: Optional[str]
    normalized_quantity: Decimal
    rate: Decimal
    ingredient_cost: Decimal


class FoodCostCalculationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    ingredients: List[FoodCostIngredientResult]
    ingredient_cost: Decimal
    management_cost: Decimal
    total_cost: Decimal
    selected_markup: Optional[Decimal] = None
    final_selling_cost: Optional[Decimal] = None
    calculation_date: date
    idempotency_key: Optional[str] = None


# -------------------------------------------------------------
# Snapshot Schemas
# -------------------------------------------------------------
class FoodCostSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    id: str
    company_id: str
    config_id: Optional[str]
    calculation_date: datetime
    idempotency_key: Optional[str]
    snapshot_data: dict


class FoodCostSnapshotList(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, alias_generator=to_camel)
    snapshots: List[FoodCostSnapshotResponse]
    total: int
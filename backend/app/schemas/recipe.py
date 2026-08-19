from decimal import Decimal
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

# -------------------------------------------------------------
# Recipe Item / BOM Ingredient Schemas
# -------------------------------------------------------------
class RecipeItemBase(BaseModel):
    raw_item_id: str
    unit_id: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    notes: Optional[str] = None

class RecipeItemCreate(RecipeItemBase):
    pass

class RecipeItemResponse(RecipeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipe_id: str
    cost_contribution: Decimal = Decimal("0.0000")
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    item_type: Optional[str] = None
    unit_symbol: Optional[str] = None
    unit_cost: Decimal = Decimal("0.0000")
    is_sub_recipe: bool = False
    sub_recipe_id: Optional[str] = None

# -------------------------------------------------------------
# Recipe Header Schemas
# -------------------------------------------------------------
class RecipeBase(BaseModel):
    finished_item_id: str
    name: str
    code: str
    description: Optional[str] = None
    yield_qty: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    preparation_minutes: int = Field(default=15, ge=0)
    instructions: Optional[str] = None
    is_active: bool = True

class RecipeCreate(RecipeBase):
    ingredients: List[RecipeItemCreate] = []

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    yield_qty: Optional[Decimal] = None
    preparation_minutes: Optional[int] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None
    ingredients: Optional[List[RecipeItemCreate]] = None

class RecipeResponse(RecipeBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    finished_item_name: Optional[str] = None
    finished_item_code: Optional[str] = None
    finished_unit_symbol: Optional[str] = None
    total_recipe_cost: Decimal = Decimal("0.0000")
    unit_cost: Decimal = Decimal("0.0000")
    ingredients: List[RecipeItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# -------------------------------------------------------------
# Costing & Theoretical Margin Simulation Schemas
# -------------------------------------------------------------
class RecipeCostingBreakdownItem(BaseModel):
    raw_item_id: str
    item_name: str
    item_code: str
    item_type: str
    unit_symbol: Optional[str] = None
    quantity: Decimal
    unit_cost: Decimal
    cost_subtotal: Decimal
    is_sub_recipe: bool = False
    sub_recipe_id: Optional[str] = None

class RecipeCostingResponse(BaseModel):
    recipe_id: str
    recipe_name: str
    recipe_code: str
    yield_qty: Decimal
    finished_item_name: str
    finished_item_code: str
    selling_price: Decimal
    ingredient_raw_cost: Decimal
    expected_wastage_percent: Decimal = Decimal("0.00")
    expected_wastage_cost: Decimal = Decimal("0.0000")
    yield_adjustment_cost: Decimal = Decimal("0.0000")
    packaging_cost: Decimal = Decimal("0.0000")
    production_overhead_cost: Decimal = Decimal("0.0000")
    total_batch_cost: Decimal
    unit_recipe_cost: Decimal
    theoretical_food_cost_percentage: Decimal
    gross_margin_percentage: Decimal
    ingredients_breakdown: List[RecipeCostingBreakdownItem] = []

# -------------------------------------------------------------
# Recipe Explosion & Sufficiency Schemas
# -------------------------------------------------------------
class RecipeExplodeRequest(BaseModel):
    target_yield_qty: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    warehouse_id: Optional[str] = None

class RecipeExplodeItem(BaseModel):
    raw_item_id: str
    item_name: str
    item_code: str
    unit_symbol: Optional[str] = None
    standard_qty_per_unit_yield: Decimal
    required_qty: Decimal
    available_stock: Optional[Decimal] = None
    is_sufficient: bool = True
    shortage_qty: Decimal = Decimal("0.0000")
    unit_cost: Decimal = Decimal("0.0000")
    total_cost: Decimal = Decimal("0.0000")
    is_sub_recipe: bool = False

class RecipeExplodeResponse(BaseModel):
    recipe_id: str
    recipe_name: str
    recipe_code: str
    target_yield_qty: Decimal
    multiplier: Decimal
    is_all_ingredients_sufficient: bool
    total_estimated_raw_cost: Decimal
    estimated_unit_food_cost: Decimal
    ingredients: List[RecipeExplodeItem] = []

# -------------------------------------------------------------
# Production Order Schemas
# -------------------------------------------------------------
class ProductionConsumptionCreate(BaseModel):
    raw_item_id: str
    actual_consumed_qty: Decimal = Field(ge=Decimal("0.0000"))

class ProductionOrderCreate(BaseModel):
    branch_id: str
    kitchen_warehouse_id: str
    recipe_id: str
    planned_qty: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    planned_date: Optional[datetime] = None
    notes: Optional[str] = None

class ProductionOrderStatusUpdate(BaseModel):
    status: str
    actual_yield_qty: Optional[Decimal] = None
    wastage_qty: Optional[Decimal] = None
    actual_consumptions: Optional[List[ProductionConsumptionCreate]] = None
    notes: Optional[str] = None

class ProductionConsumptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    production_order_id: str
    raw_item_id: str
    raw_item_name: Optional[str] = None
    raw_item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    standard_qty: Decimal
    actual_consumed_qty: Decimal
    unit_cost: Decimal = Decimal("0.0000")
    total_cost: Decimal = Decimal("0.0000")

class ProductionOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    company_id: str
    branch_id: str
    branch_name: Optional[str] = None
    kitchen_warehouse_id: str
    warehouse_name: Optional[str] = None
    recipe_id: str
    recipe_name: Optional[str] = None
    recipe_code: Optional[str] = None
    finished_item_id: Optional[str] = None
    finished_item_name: Optional[str] = None
    finished_item_code: Optional[str] = None
    finished_unit_symbol: Optional[str] = None
    order_number: str
    batch_number: Optional[str] = None
    planned_qty: Decimal
    actual_yield_qty: Decimal
    wastage_qty: Decimal
    status: str
    planned_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    total_raw_cost: Decimal
    unit_food_cost: Decimal
    yield_variance_percent: Optional[Decimal] = None
    notes: Optional[str] = None
    created_by_id: Optional[str] = None
    consumptions: List[ProductionConsumptionResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# -------------------------------------------------------------
# Part 9: Pre-Production Preview & Shortage Check Schemas
# -------------------------------------------------------------
class ProductionPreviewRequest(BaseModel):
    recipe_id: str
    planned_qty: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    kitchen_warehouse_id: str

class ProductionPreviewItem(BaseModel):
    raw_item_id: str
    item_name: str
    item_code: str
    unit_symbol: Optional[str] = None
    standard_qty_per_unit_yield: Decimal
    required_qty: Decimal
    available_qty: Decimal
    is_sufficient: bool
    shortage_qty: Decimal
    unit_cost: Decimal
    total_cost: Decimal

class ProductionPreviewResponse(BaseModel):
    recipe_id: str
    recipe_name: str
    recipe_code: str
    finished_item_name: str
    planned_qty: Decimal
    multiplier: Decimal
    all_ingredients_available: bool
    total_estimated_raw_cost: Decimal
    estimated_unit_food_cost: Decimal
    ingredients: List[ProductionPreviewItem] = []

# -------------------------------------------------------------
# Part 9: Direct Production Order Execution Schema
# -------------------------------------------------------------
class ProductionOrderExecuteRequest(BaseModel):
    branch_id: str
    kitchen_warehouse_id: str
    recipe_id: str
    planned_qty: Decimal = Field(default=Decimal("1.0000"), ge=Decimal("0.0001"))
    actual_yield_qty: Optional[Decimal] = None
    wastage_qty: Optional[Decimal] = Decimal("0.0000")
    batch_number: Optional[str] = None
    mfg_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None
    custom_consumptions: Optional[List[ProductionConsumptionCreate]] = None

# -------------------------------------------------------------
# Part 9: Production Variance & Cost Analysis Schemas
# -------------------------------------------------------------
class ProductionVarianceItem(BaseModel):
    raw_item_id: str
    item_name: str
    item_code: str
    unit_symbol: Optional[str] = None
    standard_qty: Decimal
    actual_consumed_qty: Decimal
    variance_qty: Decimal
    variance_percent: Decimal
    unit_cost: Decimal
    standard_cost: Decimal
    actual_cost: Decimal
    cost_variance: Decimal

class ProductionVarianceResponse(BaseModel):
    production_order_id: str
    order_number: str
    recipe_id: str
    recipe_name: str
    finished_item_name: str
    planned_qty: Decimal
    actual_yield_qty: Decimal
    wastage_qty: Decimal
    yield_variance_qty: Decimal
    yield_variance_percent: Decimal
    total_standard_cost: Decimal
    total_actual_cost: Decimal
    total_cost_variance: Decimal
    unit_food_cost: Decimal
    ingredient_variances: List[ProductionVarianceItem] = []

# -------------------------------------------------------------
# Part 9: Production Order Reversal Schema
# -------------------------------------------------------------
class ProductionOrderReverseRequest(BaseModel):
    reason: str = Field(min_length=3)


import uuid
from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.models.user import User
from app.models.organization import Warehouse, Branch
from app.models.inventory import Item, Unit, StockBalance, StockBatch, StockLedger, ItemType
from app.models.recipe import Recipe, RecipeItem, ProductionOrder, ProductionConsumption, ProductionStatus
from app.services.unit_conversion import convert_quantity
from app.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeItemResponse,
    RecipeCostingResponse,
    RecipeCostingBreakdownItem,
    RecipeExplodeRequest,
    RecipeExplodeResponse,
    RecipeExplodeItem,
    ProductionOrderCreate,
    ProductionOrderStatusUpdate,
    ProductionOrderResponse,
    ProductionConsumptionResponse,
    ProductionPreviewRequest,
    ProductionPreviewItem,
    ProductionPreviewResponse,
    ProductionOrderExecuteRequest,
    ProductionVarianceItem,
    ProductionVarianceResponse,
    ProductionOrderReverseRequest,
)

router = APIRouter()

def _calculate_recipe_costs(recipe: Recipe, db: Session) -> tuple[Decimal, Decimal, List[RecipeItemResponse]]:
    """
    Helper to calculate real-time theoretical ingredient costs, gross requirements, and recursive sub-recipe rollups.
    """
    total_recipe_cost = Decimal("0.0000")
    ingredients_res = []

    for ing in recipe.ingredients:
        raw_item = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        raw_unit = db.query(Unit).filter(Unit.id == ing.unit_id).first() if ing.unit_id else (
            db.query(Unit).filter(Unit.id == raw_item.unit_id).first() if raw_item and raw_item.unit_id else None
        )

        # Check if ingredient is a sub-recipe (Semi-finished item with an active recipe)
        sub_recipe = None
        is_sub = False
        unit_cost = Decimal(str(raw_item.cost_price or 0)) if raw_item else Decimal("0.0000")

        if raw_item and raw_item.type == ItemType.SEMI_FINISHED:
            sub_rec = db.query(Recipe).filter(
                Recipe.finished_item_id == raw_item.id,
                Recipe.company_id == recipe.company_id,
                Recipe.is_active == True,
            ).first()
            if sub_rec and sub_rec.id != recipe.id:
                sub_recipe = sub_rec
                is_sub = True
                sub_tot_cost, sub_u_cost, _ = _calculate_recipe_costs(sub_rec, db)
                if sub_u_cost > 0:
                    unit_cost = sub_u_cost

        qty = Decimal(str(ing.quantity or 1.0))
        usable_yield = Decimal(str(getattr(ing, "usable_yield", 100.0) or 100.0))
        waste_pct = Decimal(str(getattr(ing, "waste_percentage", 0.0) or 0.0))

        # Compute gross quantity: Usable / (Yield% / 100)
        yield_factor = usable_yield / Decimal("100.00") if usable_yield > 0 else Decimal("1.00")
        gross_qty = getattr(ing, "gross_quantity", None)
        if not gross_qty or gross_qty <= 0:
            gross_qty = qty / yield_factor

        item_cost = gross_qty * unit_cost
        total_recipe_cost += item_cost

        ingredients_res.append(
            RecipeItemResponse(
                id=ing.id,
                recipe_id=recipe.id,
                raw_item_id=ing.raw_item_id,
                unit_id=ing.unit_id or (raw_item.unit_id if raw_item else None),
                quantity=qty,
                gross_quantity=gross_qty,
                usable_yield=usable_yield,
                waste_percentage=waste_pct,
                cost_contribution=item_cost,
                notes=ing.notes,
                item_name=raw_item.name if raw_item else None,
                item_code=raw_item.code if raw_item else None,
                item_type=raw_item.type.value if raw_item and hasattr(raw_item.type, "value") else str(raw_item.type if raw_item else ""),
                unit_symbol=raw_unit.symbol if raw_unit else None,
                unit_cost=unit_cost,
                is_sub_recipe=is_sub,
                sub_recipe_id=sub_recipe.id if sub_recipe else None,
            )
        )

    yield_qty = Decimal(str(recipe.yield_qty or 1))
    unit_cost = total_recipe_cost / yield_qty if yield_qty > 0 else total_recipe_cost

    return total_recipe_cost, unit_cost, ingredients_res


def _format_recipe_response(recipe: Recipe, db: Session) -> RecipeResponse:
    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
    finished_unit = db.query(Unit).filter(Unit.id == finished_item.unit_id).first() if finished_item and finished_item.unit_id else None
    tot_cost, u_cost, ingredients_res = _calculate_recipe_costs(recipe, db)

    # Selling price / margin — use recipe-stored selling price (NEVER auto-overwrite from item rates)
    selling_price_per_unit = Decimal(str(getattr(recipe, "selling_price_per_unit", 0) or 0))
    yield_qty = Decimal(str(recipe.yield_qty or 1))
    expected_sales = selling_price_per_unit * yield_qty
    gross_profit = expected_sales - tot_cost
    gross_margin_pct = (
        (gross_profit / expected_sales * Decimal("100.00")).quantize(Decimal("0.01"))
        if expected_sales > 0 else Decimal("0.00")
    )

    return RecipeResponse(
        id=recipe.id,
        company_id=recipe.company_id,
        finished_item_id=recipe.finished_item_id,
        finished_item_name=finished_item.name if finished_item else None,
        finished_item_code=finished_item.code if finished_item else None,
        finished_unit_symbol=finished_unit.symbol if finished_unit else None,
        name=recipe.name,
        code=recipe.code,
        version=getattr(recipe, "version", 1) or 1,
        effective_date=getattr(recipe, "effective_date", None) or recipe.created_at,
        effective_to=getattr(recipe, "effective_to", None),
        is_current=getattr(recipe, "is_current", True) if getattr(recipe, "is_current", True) is not None else True,
        description=recipe.description,
        yield_qty=Decimal(str(recipe.yield_qty)),
        preparation_minutes=recipe.preparation_minutes,
        instructions=recipe.instructions,
        is_active=recipe.is_active,
        total_recipe_cost=tot_cost,
        unit_cost=u_cost,
        selling_price_per_unit=selling_price_per_unit,
        expected_sales_value=expected_sales,
        gross_profit=gross_profit,
        gross_margin_pct=gross_margin_pct,
        ingredients=ingredients_res,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )


# =============================================================
# 1. Recipe CRUD Endpoints
# =============================================================

@router.get("", response_model=List[RecipeResponse])
def list_recipes(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    finished_item_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(Recipe).filter(Recipe.company_id == current_user.company_id)

    if is_active is not None:
        query = query.filter(Recipe.is_active == is_active)
    if finished_item_id:
        query = query.filter(Recipe.finished_item_id == finished_item_id)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Recipe.name.ilike(search_fmt)) |
            (Recipe.code.ilike(search_fmt)) |
            (Recipe.description.ilike(search_fmt))
        )

    recipes = query.order_by(Recipe.name.asc()).all()
    return [_format_recipe_response(r, db) for r in recipes]


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    recipe_in: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate finished item
    finished_item = db.query(Item).filter(
        Item.id == recipe_in.finished_item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not finished_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finished / semi-finished good item not found")

    # Check unique code within company
    existing = db.query(Recipe).filter(
        Recipe.company_id == current_user.company_id,
        func.lower(Recipe.code) == recipe_in.code.strip().lower(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Recipe code '{recipe_in.code}' already exists in your company",
        )

    # Validate ingredients
    for ing in recipe_in.ingredients:
        raw = db.query(Item).filter(
            Item.id == ing.raw_item_id,
            Item.company_id == current_user.company_id,
        ).first()
        if not raw:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ingredient raw item '{ing.raw_item_id}' not found",
            )
        if ing.raw_item_id == recipe_in.finished_item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A recipe cannot use its own finished item as a raw ingredient",
            )

    new_recipe = Recipe(
        company_id=current_user.company_id,
        finished_item_id=recipe_in.finished_item_id,
        name=recipe_in.name.strip(),
        code=recipe_in.code.strip().upper(),
        description=recipe_in.description.strip() if recipe_in.description else None,
        yield_qty=Decimal(str(recipe_in.yield_qty)),
        preparation_minutes=recipe_in.preparation_minutes,
        instructions=recipe_in.instructions.strip() if recipe_in.instructions else None,
        is_active=recipe_in.is_active,
        selling_price_per_unit=Decimal(str(recipe_in.selling_price_per_unit or 0)),
    )
    db.add(new_recipe)
    db.flush()

    # Add ingredients
    for ing in recipe_in.ingredients:
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        net_qty = Decimal(str(ing.quantity))
        waste_pct = Decimal(str(ing.waste_percentage or 0))
        usable_yield = Decimal(str(ing.usable_yield or 100))
        gross_qty = Decimal(str(ing.gross_quantity)) if ing.gross_quantity is not None else (
            net_qty / (Decimal("1") - waste_pct / Decimal("100")) if waste_pct < Decimal("100") else net_qty
        )
        cost_contrib = gross_qty * Decimal(str(raw.cost_price or 0))
        rec_item = RecipeItem(
            recipe_id=new_recipe.id,
            raw_item_id=ing.raw_item_id,
            unit_id=ing.unit_id or raw.unit_id,
            quantity=net_qty,
            gross_quantity=gross_qty,
            usable_yield=usable_yield,
            waste_percentage=waste_pct,
            cost_contribution=cost_contrib,
            notes=ing.notes.strip() if ing.notes else None,
        )
        db.add(rec_item)

    db.commit()
    db.refresh(new_recipe)
    return _format_recipe_response(new_recipe, db)


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    return _format_recipe_response(recipe, db)


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: str,
    recipe_in: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    if recipe_in.code and recipe_in.code.strip().lower() != recipe.code.lower():
        existing = db.query(Recipe).filter(
            Recipe.company_id == current_user.company_id,
            func.lower(Recipe.code) == recipe_in.code.strip().lower(),
            Recipe.id != recipe_id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Recipe code '{recipe_in.code}' already exists",
            )
        recipe.code = recipe_in.code.strip().upper()

    if recipe_in.name is not None:
        recipe.name = recipe_in.name.strip()
    if recipe_in.description is not None:
        recipe.description = recipe_in.description.strip() if recipe_in.description else None
    if recipe_in.yield_qty is not None:
        recipe.yield_qty = Decimal(str(recipe_in.yield_qty))
    if recipe_in.preparation_minutes is not None:
        recipe.preparation_minutes = recipe_in.preparation_minutes
    if recipe_in.instructions is not None:
        recipe.instructions = recipe_in.instructions.strip() if recipe_in.instructions else None
    if recipe_in.is_active is not None:
        recipe.is_active = recipe_in.is_active
    # Selling price is user-controlled and must be persisted when provided
    if recipe_in.selling_price_per_unit is not None:
        recipe.selling_price_per_unit = Decimal(str(recipe_in.selling_price_per_unit))

    if recipe_in.ingredients is not None:
        # Remove old ingredients and add new
        db.query(RecipeItem).filter(RecipeItem.recipe_id == recipe.id).delete()
        for ing in recipe_in.ingredients:
            raw = db.query(Item).filter(
                Item.id == ing.raw_item_id,
                Item.company_id == current_user.company_id,
            ).first()
            if not raw:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ingredient '{ing.raw_item_id}' not found")
            net_qty = Decimal(str(ing.quantity))
            waste_pct = Decimal(str(ing.waste_percentage or 0))
            usable_yield = Decimal(str(ing.usable_yield or 100))
            gross_qty = Decimal(str(ing.gross_quantity)) if ing.gross_quantity is not None else (
                net_qty / (Decimal("1") - waste_pct / Decimal("100")) if waste_pct < Decimal("100") else net_qty
            )
            cost_contrib = gross_qty * Decimal(str(raw.cost_price or 0))
            rec_item = RecipeItem(
                recipe_id=recipe.id,
                raw_item_id=ing.raw_item_id,
                unit_id=ing.unit_id or raw.unit_id,
                quantity=net_qty,
                gross_quantity=gross_qty,
                usable_yield=usable_yield,
                waste_percentage=waste_pct,
                cost_contribution=cost_contrib,
                notes=ing.notes.strip() if ing.notes else None,
            )
            db.add(rec_item)

    db.commit()
    db.refresh(recipe)
    return _format_recipe_response(recipe, db)


@router.delete("/{recipe_id}", status_code=status.HTTP_200_OK)
def delete_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    recipe.is_active = False
    db.commit()
    return {"success": True, "message": f"Recipe '{recipe.name}' ({recipe.code}) deactivated successfully"}


# =============================================================
# 2. Recipe Versioning / Cloning Endpoint
# =============================================================

@router.post("/{recipe_id}/clone", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def clone_recipe(
    recipe_id: str,
    new_version_code: Optional[str] = None,
    new_version_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    clone_code = (new_version_code or f"{recipe.code}-V{datetime.utcnow().strftime('%H%M%S')}").strip().upper()
    clone_name = (new_version_name or f"{recipe.name} (Copy)").strip()

    # Ensure unique code
    existing = db.query(Recipe).filter(
        Recipe.company_id == current_user.company_id,
        func.lower(Recipe.code) == clone_code.lower(),
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Recipe code '{clone_code}' already exists")

    new_recipe = Recipe(
        company_id=current_user.company_id,
        finished_item_id=recipe.finished_item_id,
        name=clone_name,
        code=clone_code,
        description=f"Cloned from {recipe.code}. {recipe.description or ''}".strip(),
        yield_qty=recipe.yield_qty,
        preparation_minutes=recipe.preparation_minutes,
        instructions=recipe.instructions,
        is_active=True,
    )
    db.add(new_recipe)
    db.flush()

    for ing in recipe.ingredients:
        cloned_item = RecipeItem(
            recipe_id=new_recipe.id,
            raw_item_id=ing.raw_item_id,
            unit_id=ing.unit_id,
            quantity=ing.quantity,
            cost_contribution=ing.cost_contribution,
            notes=ing.notes,
        )
        db.add(cloned_item)

    db.commit()
    db.refresh(new_recipe)
    return _format_recipe_response(new_recipe, db)


# =============================================================
# 3. Recipe Costing & Theoretical Food Cost Engine
# =============================================================

@router.get("/{recipe_id}/costing", response_model=RecipeCostingResponse)
def calculate_recipe_costing(
    recipe_id: str,
    wastage_percent: Decimal = Query(Decimal("5.00"), ge=Decimal("0.00"), le=Decimal("100.00")),
    packaging_percent: Decimal = Query(Decimal("2.00"), ge=Decimal("0.00"), le=Decimal("100.00")),
    overhead_percent: Decimal = Query(Decimal("3.00"), ge=Decimal("0.00"), le=Decimal("100.00")),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Master Formula (Section 11):
    Ingredient Cost + Expected Wastage + Yield Adjustment + Packaging + Overhead = Total Recipe Cost
    """
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
    raw_ing_cost, _, ing_list = _calculate_recipe_costs(recipe, db)

    breakdown_items = []
    for ing in ing_list:
        breakdown_items.append(
            RecipeCostingBreakdownItem(
                raw_item_id=ing.raw_item_id,
                item_name=ing.item_name or "",
                item_code=ing.item_code or "",
                item_type=ing.item_type or "",
                unit_symbol=ing.unit_symbol,
                quantity=ing.quantity,
                unit_cost=ing.unit_cost,
                cost_subtotal=ing.cost_contribution,
                is_sub_recipe=ing.is_sub_recipe,
                sub_recipe_id=ing.sub_recipe_id,
            )
        )

    # Calculate additional costs
    wastage_cost = raw_ing_cost * (wastage_percent / Decimal("100.00"))
    packaging_cost = raw_ing_cost * (packaging_percent / Decimal("100.00"))
    overhead_cost = raw_ing_cost * (overhead_percent / Decimal("100.00"))

    total_batch_cost = raw_ing_cost + wastage_cost + packaging_cost + overhead_cost
    yield_qty = Decimal(str(recipe.yield_qty or 1))
    unit_recipe_cost = total_batch_cost / yield_qty if yield_qty > 0 else total_batch_cost

    selling_price = Decimal(str(finished_item.selling_price or 0)) if finished_item else Decimal("0.0000")
    if selling_price > 0:
        theoretical_food_cost_pct = (unit_recipe_cost / selling_price) * Decimal("100.00")
        gross_margin_pct = Decimal("100.00") - theoretical_food_cost_pct
    else:
        theoretical_food_cost_pct = Decimal("0.00")
        gross_margin_pct = Decimal("0.00")

    return RecipeCostingResponse(
        recipe_id=recipe.id,
        recipe_name=recipe.name,
        recipe_code=recipe.code,
        yield_qty=yield_qty,
        finished_item_name=finished_item.name if finished_item else "",
        finished_item_code=finished_item.code if finished_item else "",
        selling_price=selling_price,
        ingredient_raw_cost=raw_ing_cost,
        expected_wastage_percent=wastage_percent,
        expected_wastage_cost=wastage_cost,
        yield_adjustment_cost=Decimal("0.0000"),
        packaging_cost=packaging_cost,
        production_overhead_cost=overhead_cost,
        total_batch_cost=total_batch_cost,
        unit_recipe_cost=unit_recipe_cost,
        theoretical_food_cost_percentage=round(theoretical_food_cost_pct, 2),
        gross_margin_percentage=round(gross_margin_pct, 2),
        ingredients_breakdown=breakdown_items,
    )


# =============================================================
# 4. Recipe BOM Explosion & Stock Sufficiency Engine
# =============================================================

@router.post("/{recipe_id}/explode", response_model=RecipeExplodeResponse)
def explode_recipe_bom(
    recipe_id: str,
    explode_in: RecipeExplodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Given a target production quantity, calculate the gross required ingredients,
    check stock levels in warehouse, and evaluate sufficiency.
    """
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    target_qty = Decimal(str(explode_in.target_yield_qty))
    base_yield = Decimal(str(recipe.yield_qty or 1))
    multiplier = target_qty / base_yield if base_yield > 0 else target_qty

    all_sufficient = True
    total_est_cost = Decimal("0.0000")
    exploded_items = []

    for ing in recipe.ingredients:
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        raw_unit = db.query(Unit).filter(Unit.id == ing.unit_id).first() if ing.unit_id else (
            db.query(Unit).filter(Unit.id == raw.unit_id).first() if raw and raw.unit_id else None
        )

        std_qty = Decimal(str(ing.quantity))
        req_qty = std_qty * multiplier
        unit_cost = Decimal(str(raw.cost_price or 0)) if raw else Decimal("0.0000")
        line_cost = req_qty * unit_cost
        total_est_cost += line_cost

        avail_stock = None
        is_suff = True
        shortage = Decimal("0.0000")

        if explode_in.warehouse_id:
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == explode_in.warehouse_id,
                StockBalance.item_id == ing.raw_item_id,
            ).first()
            avail_stock = Decimal(str(bal.quantity if bal else 0))
            if avail_stock < req_qty:
                is_suff = False
                shortage = req_qty - avail_stock
                all_sufficient = False

        exploded_items.append(
            RecipeExplodeItem(
                raw_item_id=ing.raw_item_id,
                item_name=raw.name if raw else "",
                item_code=raw.code if raw else "",
                unit_symbol=raw_unit.symbol if raw_unit else None,
                standard_qty_per_unit_yield=std_qty,
                required_qty=req_qty,
                available_stock=avail_stock,
                is_sufficient=is_suff,
                shortage_qty=shortage,
                unit_cost=unit_cost,
                total_cost=line_cost,
                is_sub_recipe=raw.type == ItemType.SEMI_FINISHED if raw else False,
            )
        )

    est_unit_food_cost = total_est_cost / target_qty if target_qty > 0 else total_est_cost

    return RecipeExplodeResponse(
        recipe_id=recipe.id,
        recipe_name=recipe.name,
        recipe_code=recipe.code,
        target_yield_qty=target_qty,
        multiplier=multiplier,
        is_all_ingredients_sufficient=all_sufficient,
        total_estimated_raw_cost=total_est_cost,
        estimated_unit_food_cost=est_unit_food_cost,
        ingredients=exploded_items,
    )


# =============================================================
# 5. Production Orders Endpoints
# =============================================================

def _format_production_order_response(po: ProductionOrder, db: Session) -> ProductionOrderResponse:
    branch = db.query(Branch).filter(Branch.id == po.branch_id).first()
    wh = db.query(Warehouse).filter(Warehouse.id == po.kitchen_warehouse_id).first()
    recipe = db.query(Recipe).filter(Recipe.id == po.recipe_id).first()
    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first() if recipe else None
    finished_unit = db.query(Unit).filter(Unit.id == finished_item.unit_id).first() if finished_item and finished_item.unit_id else None

    # Check batch if any
    batch = db.query(StockBatch).filter(
        StockBatch.warehouse_id == po.kitchen_warehouse_id,
        StockBatch.item_id == (recipe.finished_item_id if recipe else None),
        StockBatch.batch_number.like(f"%{po.order_number}%")
    ).first()
    batch_num = batch.batch_number if batch else None

    planned_q = Decimal(str(po.planned_qty or 0))
    actual_y = Decimal(str(po.actual_yield_qty or 0))
    yield_var_pct = Decimal("0.00")
    if planned_q > 0 and actual_y > 0:
        yield_var_pct = (((actual_y - planned_q) / planned_q) * Decimal("100.00")).quantize(Decimal("0.01"))

    consumptions_res = []
    for c in po.consumptions:
        raw = db.query(Item).filter(Item.id == c.raw_item_id).first()
        raw_u = db.query(Unit).filter(Unit.id == raw.unit_id).first() if raw and raw.unit_id else None
        consumptions_res.append(
            ProductionConsumptionResponse(
                id=c.id,
                production_order_id=po.id,
                raw_item_id=c.raw_item_id,
                raw_item_name=raw.name if raw else None,
                raw_item_code=raw.code if raw else None,
                unit_symbol=raw_u.symbol if raw_u else None,
                standard_qty=Decimal(str(c.standard_qty)),
                actual_consumed_qty=Decimal(str(c.actual_consumed_qty)),
                unit_cost=Decimal(str(c.unit_cost)),
                total_cost=Decimal(str(c.total_cost)),
            )
        )

    return ProductionOrderResponse(
        id=po.id,
        company_id=po.company_id,
        branch_id=po.branch_id,
        branch_name=branch.name if branch else None,
        kitchen_warehouse_id=po.kitchen_warehouse_id,
        warehouse_name=wh.name if wh else None,
        recipe_id=po.recipe_id,
        recipe_name=recipe.name if recipe else None,
        recipe_code=recipe.code if recipe else None,
        finished_item_id=recipe.finished_item_id if recipe else None,
        finished_item_name=finished_item.name if finished_item else None,
        finished_item_code=finished_item.code if finished_item else None,
        finished_unit_symbol=finished_unit.symbol if finished_unit else None,
        order_number=po.order_number,
        batch_number=batch_num,
        planned_qty=planned_q,
        actual_yield_qty=actual_y,
        wastage_qty=Decimal(str(po.wastage_qty)),
        status=po.status.value if hasattr(po.status, "value") else str(po.status),
        planned_date=po.planned_date,
        completed_date=po.completed_date,
        total_raw_cost=Decimal(str(po.total_raw_cost)),
        unit_food_cost=Decimal(str(po.unit_food_cost)),
        yield_variance_percent=yield_var_pct,
        notes=po.notes,
        created_by_id=po.created_by_id,
        consumptions=consumptions_res,
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


# =============================================================
# 5. Production Orders Endpoints
# =============================================================

@router.get("/production/orders", response_model=List[ProductionOrderResponse])
def list_production_orders(
    branch_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    recipe_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(ProductionOrder).filter(ProductionOrder.company_id == current_user.company_id)

    if branch_id:
        query = query.filter(ProductionOrder.branch_id == branch_id)
    if warehouse_id:
        query = query.filter(ProductionOrder.kitchen_warehouse_id == warehouse_id)
    if status_filter:
        query = query.filter(ProductionOrder.status == status_filter.upper())
    if recipe_id:
        query = query.filter(ProductionOrder.recipe_id == recipe_id)

    orders = query.order_by(ProductionOrder.created_at.desc()).all()
    return [_format_production_order_response(o, db) for o in orders]


@router.post("/production/preview", response_model=ProductionPreviewResponse)
def preview_production(
    preview_in: ProductionPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Section 13: Pre-Production Sufficiency & Cost Simulation.
    Calculates required ingredients vs available stock in the designated kitchen warehouse.
    """
    recipe = db.query(Recipe).filter(
        Recipe.id == preview_in.recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    wh = db.query(Warehouse).filter(
        Warehouse.id == preview_in.kitchen_warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kitchen warehouse not found")

    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
    planned_qty = Decimal(str(preview_in.planned_qty))
    base_yield = Decimal(str(recipe.yield_qty or 1))
    multiplier = planned_qty / base_yield if base_yield > 0 else planned_qty

    all_avail = True
    total_est_cost = Decimal("0.0000")
    items_breakdown = []

    for ing in recipe.ingredients:
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        raw_u = db.query(Unit).filter(Unit.id == ing.unit_id).first() if ing.unit_id else (
            db.query(Unit).filter(Unit.id == raw.unit_id).first() if raw and raw.unit_id else None
        )

        std_q = Decimal(str(ing.quantity))
        req_q = std_q * multiplier
        unit_cost = Decimal(str(raw.cost_price or 0)) if raw else Decimal("0.0000")
        line_cost = req_q * unit_cost
        total_est_cost += line_cost

        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == preview_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).first()

        avail_q = Decimal(str(bal.quantity if bal else 0))
        is_suff = avail_q >= req_q
        shortage = max(Decimal("0.0000"), req_q - avail_q)
        if not is_suff:
            all_avail = False

        items_breakdown.append(
            ProductionPreviewItem(
                raw_item_id=ing.raw_item_id,
                item_name=raw.name if raw else "",
                item_code=raw.code if raw else "",
                unit_symbol=raw_u.symbol if raw_u else None,
                standard_qty_per_unit_yield=std_q,
                required_qty=req_q,
                available_qty=avail_q,
                is_sufficient=is_suff,
                shortage_qty=shortage,
                unit_cost=unit_cost,
                total_cost=line_cost,
            )
        )

    est_unit_food_cost = total_est_cost / planned_qty if planned_qty > 0 else total_est_cost

    return ProductionPreviewResponse(
        recipe_id=recipe.id,
        recipe_name=recipe.name,
        recipe_code=recipe.code,
        finished_item_name=finished_item.name if finished_item else "",
        planned_qty=planned_qty,
        multiplier=multiplier,
        all_ingredients_available=all_avail,
        total_estimated_raw_cost=total_est_cost,
        estimated_unit_food_cost=est_unit_food_cost,
        ingredients=items_breakdown,
    )


@router.post("/production/execute", response_model=ProductionOrderResponse, status_code=status.HTTP_201_CREATED)
def execute_production_order(
    exec_in: ProductionOrderExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Section 13: Direct Atomic Production Order Execution.
    1. Validates ingredient availability; BLOCKS if shortage.
    2. Creates production order & consumption lines.
    3. Atomically deducts raw materials from StockBalance (PRODUCTION_OUT).
    4. Creates finished goods StockBatch with lot & expiry tracking.
    5. Credits finished goods to StockBalance (PRODUCTION_IN).
    6. Synchronizes finished good Item cost price.
    """
    branch = db.query(Branch).filter(
        Branch.id == exec_in.branch_id,
        Branch.company_id == current_user.company_id,
    ).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    wh = db.query(Warehouse).filter(
        Warehouse.id == exec_in.kitchen_warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kitchen warehouse not found")

    recipe = db.query(Recipe).filter(
        Recipe.id == exec_in.recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    planned_qty = Decimal(str(exec_in.planned_qty))
    actual_yield = Decimal(str(exec_in.actual_yield_qty if exec_in.actual_yield_qty is not None else planned_qty))
    wastage_qty = Decimal(str(exec_in.wastage_qty or 0))

    if planned_qty <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Planned quantity must be greater than zero")
    if actual_yield <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual yield quantity must be greater than zero")

    base_yield = Decimal(str(recipe.yield_qty or 1))
    multiplier = planned_qty / base_yield if base_yield > 0 else planned_qty

    # Custom consumptions map if provided
    custom_map = {c.raw_item_id: Decimal(str(c.actual_consumed_qty)) for c in (exec_in.custom_consumptions or [])}

    # Step 1: Pre-Production Sufficiency Check (Strict Blocking)
    shortages = []
    consumptions_to_process = []
    for ing in recipe.ingredients:
        std_recipe_req = Decimal(str(ing.quantity)) * multiplier
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        if not raw:
            raise HTTPException(status_code=400, detail=f"Raw item missing: {ing.raw_item_id}")
        try:
            std_req = convert_quantity(db, current_user.company_id, std_recipe_req, ing.unit_id, raw.unit_id)
            custom_req = custom_map.get(ing.raw_item_id)
            act_req = convert_quantity(db, current_user.company_id, custom_req, ing.unit_id, raw.unit_id) if custom_req is not None else std_req
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).first()

        avail = Decimal(str(bal.quantity if bal else 0))
        if avail < act_req:
            shortage_qty = act_req - avail
            shortages.append(
                f"{raw.name if raw else ing.raw_item_id} (Required: {act_req}, Available: {avail}, Shortage: {shortage_qty})"
            )

        unit_cost = Decimal(str(raw.cost_price or 0)) if raw else Decimal("0.0000")
        line_cost = act_req * unit_cost
        consumptions_to_process.append((ing, raw, std_req, act_req, unit_cost, line_cost))

    if shortages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Production blocked: Insufficient stock for {', '.join(shortages)}",
        )

    # Generate unique order number
    today_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = db.query(func.count(ProductionOrder.id)).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.order_number.like(f"PRD-{today_str}-%"),
    ).scalar() or 0
    order_number = f"PRD-{today_str}-{str(count_today + 1).zfill(4)}"

    new_order = ProductionOrder(
        company_id=current_user.company_id,
        branch_id=exec_in.branch_id,
        kitchen_warehouse_id=exec_in.kitchen_warehouse_id,
        recipe_id=exec_in.recipe_id,
        order_number=order_number,
        planned_qty=planned_qty,
        actual_yield_qty=actual_yield,
        wastage_qty=wastage_qty,
        status="COMPLETED",
        planned_date=datetime.utcnow(),
        completed_date=datetime.utcnow(),
        total_raw_cost=Decimal("0.0000"),
        unit_food_cost=Decimal("0.0000"),
        notes=exec_in.notes.strip() if exec_in.notes else None,
        created_by_id=current_user.id,
    )
    db.add(new_order)
    db.flush()

    # Step 2: Atomic Raw Material Deduction & Ledger Writing
    total_consumed_cost = Decimal("0.0000")
    for ing, raw, std_req, act_req, unit_cost, line_cost in consumptions_to_process:
        total_consumed_cost += line_cost

        # Lock StockBalance row
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
            StockBalance.item_id == ing.raw_item_id,
        ).with_for_update().first()

        if not bal:
            bal = StockBalance(
                warehouse_id=exec_in.kitchen_warehouse_id,
                item_id=ing.raw_item_id,
                quantity=-act_req,
            )
            db.add(bal)
            db.flush()
        else:
            bal.quantity = Decimal(str(bal.quantity)) - act_req

        # Record Consumption
        consump = ProductionConsumption(
            production_order_id=new_order.id,
            raw_item_id=ing.raw_item_id,
            standard_qty=std_req,
            actual_consumed_qty=act_req,
            unit_cost=unit_cost,
            total_cost=line_cost,
        )
        db.add(consump)

        # Record StockLedger (PRODUCTION_OUT)
        ledger_out = StockLedger(
            warehouse_id=exec_in.kitchen_warehouse_id,
            item_id=ing.raw_item_id,
            movement_type="PRODUCTION_OUT",
            change_qty=-act_req,
            balance_qty=Decimal(str(bal.quantity)),
            unit_cost=unit_cost,
            total_cost=-line_cost,
            reference_type="PRODUCTION_ORDER",
            reference_id=new_order.id,
            notes=f"Production Order #{order_number} Raw Consumption: {raw.name if raw else ing.raw_item_id}",
            created_by_id=current_user.id,
        )
        db.add(ledger_out)

    # Step 3: Finished Good Calculation, Batch Generation & Stock Credit
    unit_food_cost = (total_consumed_cost / actual_yield).quantize(Decimal("0.0001")) if actual_yield > 0 else Decimal("0.0000")
    new_order.total_raw_cost = total_consumed_cost
    new_order.unit_food_cost = unit_food_cost

    # Finished good balance
    fg_bal = db.query(StockBalance).filter(
        StockBalance.warehouse_id == exec_in.kitchen_warehouse_id,
        StockBalance.item_id == recipe.finished_item_id,
    ).with_for_update().first()

    if not fg_bal:
        fg_bal = StockBalance(
            warehouse_id=exec_in.kitchen_warehouse_id,
            item_id=recipe.finished_item_id,
            quantity=actual_yield,
        )
        db.add(fg_bal)
        db.flush()
    else:
        fg_bal.quantity = Decimal(str(fg_bal.quantity)) + actual_yield

    # Batch tracking for produced finished good
    batch_num = exec_in.batch_number or f"BATCH-{recipe.code}-{order_number}"
    mfg_dt = exec_in.mfg_date or datetime.utcnow()
    exp_dt = exec_in.expiry_date

    batch = StockBatch(
        warehouse_id=exec_in.kitchen_warehouse_id,
        item_id=recipe.finished_item_id,
        batch_number=batch_num,
        quantity=actual_yield,
        unit_cost=unit_food_cost,
        mfg_date=mfg_dt.date() if isinstance(mfg_dt, datetime) else mfg_dt,
        expiry_date=exp_dt.date() if isinstance(exp_dt, datetime) else exp_dt,
        is_active=True,
    )
    db.add(batch)

    # Record StockLedger (PRODUCTION_IN)
    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
    ledger_in = StockLedger(
        warehouse_id=exec_in.kitchen_warehouse_id,
        item_id=recipe.finished_item_id,
        batch_number=batch_num,
        expiry_date=batch.expiry_date,
        movement_type="PRODUCTION_IN",
        change_qty=actual_yield,
        balance_qty=Decimal(str(fg_bal.quantity)),
        unit_cost=unit_food_cost,
        total_cost=total_consumed_cost,
        reference_type="PRODUCTION_ORDER",
        reference_id=new_order.id,
        notes=f"Production Order #{order_number} Finished Good Output: {finished_item.name if finished_item else recipe.finished_item_id}",
        created_by_id=current_user.id,
    )
    db.add(ledger_in)

    # Synchronize finished good item cost price
    if finished_item:
        finished_item.cost_price = unit_food_cost

    db.commit()
    db.refresh(new_order)
    return _format_production_order_response(new_order, db)


@router.post("/production/orders", response_model=ProductionOrderResponse, status_code=status.HTTP_201_CREATED)
def create_production_order(
    order_in: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Validate branch
    branch = db.query(Branch).filter(
        Branch.id == order_in.branch_id,
        Branch.company_id == current_user.company_id,
    ).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    # Validate kitchen warehouse
    wh = db.query(Warehouse).filter(
        Warehouse.id == order_in.kitchen_warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kitchen warehouse not found")

    # Validate recipe
    recipe = db.query(Recipe).filter(
        Recipe.id == order_in.recipe_id,
        Recipe.company_id == current_user.company_id,
    ).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    planned_qty = Decimal(str(order_in.planned_qty))
    base_yield = Decimal(str(recipe.yield_qty or 1))
    multiplier = planned_qty / base_yield if base_yield > 0 else planned_qty

    # Generate unique order number
    today_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = db.query(func.count(ProductionOrder.id)).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.order_number.like(f"PRD-{today_str}-%"),
    ).scalar() or 0
    order_number = f"PRD-{today_str}-{str(count_today + 1).zfill(4)}"

    new_order = ProductionOrder(
        company_id=current_user.company_id,
        branch_id=order_in.branch_id,
        kitchen_warehouse_id=order_in.kitchen_warehouse_id,
        recipe_id=order_in.recipe_id,
        order_number=order_number,
        planned_qty=planned_qty,
        actual_yield_qty=Decimal("0.0000"),
        wastage_qty=Decimal("0.0000"),
        status="DRAFT",
        planned_date=order_in.planned_date or datetime.utcnow(),
        total_raw_cost=Decimal("0.0000"),
        unit_food_cost=Decimal("0.0000"),
        notes=order_in.notes.strip() if order_in.notes else None,
        created_by_id=current_user.id,
    )
    db.add(new_order)
    db.flush()

    # Explode standard ingredients into ProductionConsumption
    tot_est_raw_cost = Decimal("0.0000")
    for ing in recipe.ingredients:
        raw = db.query(Item).filter(Item.id == ing.raw_item_id).first()
        std_req = Decimal(str(ing.quantity)) * multiplier
        unit_cost = Decimal(str(raw.cost_price or 0)) if raw else Decimal("0.0000")
        line_cost = std_req * unit_cost
        tot_est_raw_cost += line_cost

        consump = ProductionConsumption(
            production_order_id=new_order.id,
            raw_item_id=ing.raw_item_id,
            standard_qty=std_req,
            actual_consumed_qty=std_req,
            unit_cost=unit_cost,
            total_cost=line_cost,
        )
        db.add(consump)

    new_order.total_raw_cost = tot_est_raw_cost
    new_order.unit_food_cost = tot_est_raw_cost / planned_qty if planned_qty > 0 else tot_est_raw_cost

    db.commit()
    db.refresh(new_order)
    return _format_production_order_response(new_order, db)


@router.get("/production/orders/{order_id}", response_model=ProductionOrderResponse)
def get_production_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    po = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id,
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")

    return _format_production_order_response(po, db)


@router.post("/production/orders/{order_id}/check-sufficiency")
def check_order_sufficiency(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Section 13: Sufficiency Check before production.
    If ANY ingredient is insufficient, report shortage.
    """
    po = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id,
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")

    all_suff = True
    details = []

    for c in po.consumptions:
        raw = db.query(Item).filter(Item.id == c.raw_item_id).first()
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == po.kitchen_warehouse_id,
            StockBalance.item_id == c.raw_item_id,
        ).first()

        avail = Decimal(str(bal.quantity if bal else 0))
        req = Decimal(str(c.standard_qty))
        is_suff = avail >= req
        shortage = max(Decimal("0.0000"), req - avail)
        if not is_suff:
            all_suff = False

        details.append({
            "raw_item_id": c.raw_item_id,
            "item_name": raw.name if raw else None,
            "item_code": raw.code if raw else None,
            "required_qty": req,
            "available_qty": avail,
            "is_sufficient": is_suff,
            "shortage_qty": shortage,
        })

    return {
        "production_order_id": po.id,
        "order_number": po.order_number,
        "warehouse_id": po.kitchen_warehouse_id,
        "is_all_ingredients_sufficient": all_suff,
        "can_start_production": all_suff,
        "ingredients": details,
    }


@router.get("/production/orders/{order_id}/variance", response_model=ProductionVarianceResponse)
def get_production_order_variance(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Section 13: Production Yield & Raw Material Variance Analysis.
    """
    po = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id,
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")

    recipe = db.query(Recipe).filter(Recipe.id == po.recipe_id).first()
    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first() if recipe else None

    planned_q = Decimal(str(po.planned_qty or 0))
    actual_y = Decimal(str(po.actual_yield_qty or 0))
    yield_var_qty = actual_y - planned_q
    yield_var_pct = ((yield_var_qty / planned_q) * Decimal("100.00")).quantize(Decimal("0.01")) if planned_q > 0 else Decimal("0.00")

    total_std_cost = Decimal("0.0000")
    total_act_cost = Decimal("0.0000")
    ing_variances = []

    for c in po.consumptions:
        raw = db.query(Item).filter(Item.id == c.raw_item_id).first()
        raw_u = db.query(Unit).filter(Unit.id == raw.unit_id).first() if raw and raw.unit_id else None

        std_q = Decimal(str(c.standard_qty))
        act_q = Decimal(str(c.actual_consumed_qty))
        u_cost = Decimal(str(c.unit_cost))

        std_cost = std_q * u_cost
        act_cost = act_q * u_cost
        cost_var = act_cost - std_cost

        total_std_cost += std_cost
        total_act_cost += act_cost

        var_qty = act_q - std_q
        var_pct = ((var_qty / std_q) * Decimal("100.00")).quantize(Decimal("0.01")) if std_q > 0 else Decimal("0.00")

        ing_variances.append(
            ProductionVarianceItem(
                raw_item_id=c.raw_item_id,
                item_name=raw.name if raw else "",
                item_code=raw.code if raw else "",
                unit_symbol=raw_u.symbol if raw_u else None,
                standard_qty=std_q,
                actual_consumed_qty=act_q,
                variance_qty=var_qty,
                variance_percent=var_pct,
                unit_cost=u_cost,
                standard_cost=std_cost,
                actual_cost=act_cost,
                cost_variance=cost_var,
            )
        )

    tot_cost_var = total_act_cost - total_std_cost

    return ProductionVarianceResponse(
        production_order_id=po.id,
        order_number=po.order_number,
        recipe_id=po.recipe_id,
        recipe_name=recipe.name if recipe else "",
        finished_item_name=finished_item.name if finished_item else "",
        planned_qty=planned_q,
        actual_yield_qty=actual_y,
        wastage_qty=Decimal(str(po.wastage_qty)),
        yield_variance_qty=yield_var_qty,
        yield_variance_percent=yield_var_pct,
        total_standard_cost=total_std_cost,
        total_actual_cost=total_act_cost,
        total_cost_variance=tot_cost_var,
        unit_food_cost=Decimal(str(po.unit_food_cost)),
        ingredient_variances=ing_variances,
    )


@router.put("/production/orders/{order_id}/status", response_model=ProductionOrderResponse)
def update_production_order_status(
    order_id: str,
    status_in: ProductionOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Transitions production order through state machine:
    - DRAFT -> IN_PROGRESS: Checks ingredient sufficiency; BLOCKS if shortage.
    - IN_PROGRESS -> COMPLETED:
        1. Checks ingredient sufficiency; BLOCKS if shortage.
        2. Auto-deducts actual raw material quantities from warehouse StockBalance (PRODUCTION_OUT).
        3. Creates finished goods StockBatch with batch & expiry tracking.
        4. Auto-credits finished goods yield to warehouse StockBalance (PRODUCTION_IN).
        5. Synchronizes finished good item cost price.
        6. Creates double-entry StockLedger audit entries.
    - Any -> CANCELLED
    """
    po = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id,
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")

    target_status = status_in.status.upper().strip()
    current_status = po.status.value if hasattr(po.status, "value") else str(po.status)

    if current_status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed production orders cannot be modified directly (use /reverse instead)")
    if current_status == "CANCELLED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled production orders cannot be reopened")

    if target_status not in ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid target status '{target_status}'")

    if status_in.notes:
        po.notes = (po.notes or "") + f" | {status_in.notes}"

    # Handle actual consumptions override if supplied
    if status_in.actual_consumptions:
        consump_map = {c.raw_item_id: Decimal(str(c.actual_consumed_qty)) for c in status_in.actual_consumptions}
        for pc in po.consumptions:
            if pc.raw_item_id in consump_map:
                actual_q = consump_map[pc.raw_item_id]
                pc.actual_consumed_qty = actual_q
                pc.total_cost = actual_q * Decimal(str(pc.unit_cost))

    # Transition to IN_PROGRESS
    if target_status == "IN_PROGRESS":
        # Check stock sufficiency before allowing start
        shortages = []
        for pc in po.consumptions:
            req_q = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).first()
            avail = Decimal(str(bal.quantity if bal else 0))
            if avail < req_q:
                shortages.append(
                    f"{raw.name if raw else pc.raw_item_id} (Required: {req_q}, Available: {avail}, Shortage: {req_q - avail})"
                )

        if shortages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Production blocked: Insufficient stock for {', '.join(shortages)}",
            )

        po.status = "IN_PROGRESS"
        db.commit()
        db.refresh(po)
        return _format_production_order_response(po, db)

    # Transition to CANCELLED
    if target_status == "CANCELLED":
        po.status = "CANCELLED"
        db.commit()
        db.refresh(po)
        return _format_production_order_response(po, db)

    # Transition to COMPLETED -> Atomic Inventory Processing
    if target_status == "COMPLETED":
        recipe = db.query(Recipe).filter(Recipe.id == po.recipe_id).first()
        actual_yield = Decimal(str(status_in.actual_yield_qty if status_in.actual_yield_qty is not None else po.planned_qty))
        wastage_qty = Decimal(str(status_in.wastage_qty or 0))

        if actual_yield <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual yield quantity must be greater than zero")

        # Check stock sufficiency before completing
        shortages = []
        for pc in po.consumptions:
            qty_to_deduct = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).first()
            avail = Decimal(str(bal.quantity if bal else 0))
            if avail < qty_to_deduct:
                shortages.append(
                    f"{raw_item.name if raw_item else pc.raw_item_id} (Required: {qty_to_deduct}, Available: {avail}, Shortage: {qty_to_deduct - avail})"
                )

        if shortages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Production blocked: Insufficient stock for {', '.join(shortages)}",
            )

        # 1. Deduct raw materials (PRODUCTION_OUT) with row locking
        total_consumed_cost = Decimal("0.0000")
        for pc in po.consumptions:
            qty_to_deduct = Decimal(str(pc.actual_consumed_qty if pc.actual_consumed_qty > 0 else pc.standard_qty))
            raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
            unit_cost = Decimal(str(raw_item.cost_price or 0)) if raw_item else Decimal("0.0000")
            line_cost = qty_to_deduct * unit_cost
            total_consumed_cost += line_cost

            # Lock StockBalance for raw material
            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == po.kitchen_warehouse_id,
                StockBalance.item_id == pc.raw_item_id,
            ).with_for_update().first()

            if not bal:
                bal = StockBalance(
                    warehouse_id=po.kitchen_warehouse_id,
                    item_id=pc.raw_item_id,
                    quantity=-qty_to_deduct,
                )
                db.add(bal)
                db.flush()
            else:
                bal.quantity = Decimal(str(bal.quantity)) - qty_to_deduct

            # StockLedger entry for raw consumption
            ledger_out = StockLedger(
                warehouse_id=po.kitchen_warehouse_id,
                item_id=pc.raw_item_id,
                movement_type="PRODUCTION_OUT",
                change_qty=-qty_to_deduct,
                balance_qty=Decimal(str(bal.quantity)),
                unit_cost=unit_cost,
                total_cost=-line_cost,
                reference_type="PRODUCTION_ORDER",
                reference_id=po.id,
                notes=f"Production Order #{po.order_number} Raw Consumption: {raw_item.name if raw_item else pc.raw_item_id}",
                created_by_id=current_user.id,
            )
            db.add(ledger_out)

        # 2. Credit finished goods (PRODUCTION_IN) with row locking
        unit_food_cost = (total_consumed_cost / actual_yield).quantize(Decimal("0.0001")) if actual_yield > 0 else Decimal("0.0000")

        fg_bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == po.kitchen_warehouse_id,
            StockBalance.item_id == recipe.finished_item_id,
        ).with_for_update().first()

        if not fg_bal:
            fg_bal = StockBalance(
                warehouse_id=po.kitchen_warehouse_id,
                item_id=recipe.finished_item_id,
                quantity=actual_yield,
            )
            db.add(fg_bal)
            db.flush()
        else:
            fg_bal.quantity = Decimal(str(fg_bal.quantity)) + actual_yield

        # Create StockBatch for finished goods
        batch_num = f"BATCH-{recipe.code}-{po.order_number}"
        batch = StockBatch(
            warehouse_id=po.kitchen_warehouse_id,
            item_id=recipe.finished_item_id,
            batch_number=batch_num,
            quantity=actual_yield,
            unit_cost=unit_food_cost,
            mfg_date=datetime.utcnow().date(),
            expiry_date=None,
            is_active=True,
        )
        db.add(batch)

        # StockLedger entry for finished good yield
        finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
        ledger_in = StockLedger(
            warehouse_id=po.kitchen_warehouse_id,
            item_id=recipe.finished_item_id,
            batch_number=batch_num,
            movement_type="PRODUCTION_IN",
            change_qty=actual_yield,
            balance_qty=Decimal(str(fg_bal.quantity)),
            unit_cost=unit_food_cost,
            total_cost=total_consumed_cost,
            reference_type="PRODUCTION_ORDER",
            reference_id=po.id,
            notes=f"Production Order #{po.order_number} Finished Good Output: {finished_item.name if finished_item else recipe.finished_item_id}",
            created_by_id=current_user.id,
        )
        db.add(ledger_in)

        # Synchronize item cost price
        if finished_item:
            finished_item.cost_price = unit_food_cost

        # Finalize production order header
        po.status = "COMPLETED"
        po.actual_yield_qty = actual_yield
        po.wastage_qty = wastage_qty
        po.total_raw_cost = total_consumed_cost
        po.unit_food_cost = unit_food_cost
        po.completed_date = datetime.utcnow()

        db.commit()
        db.refresh(po)
        return _format_production_order_response(po, db)


@router.post("/production/orders/{order_id}/reverse", response_model=ProductionOrderResponse)
def reverse_production_order(
    order_id: str,
    reverse_in: ProductionOrderReverseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Blueprint Section 13: Production Order Reversal & Inventory Rollback.
    Reverses a completed production order:
    1. Deducts produced finished goods from warehouse.
    2. Restores consumed raw materials to warehouse.
    3. Creates double-entry audit ledgers.
    4. Marks order as CANCELLED.
    """
    po = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id,
    ).first()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order not found")

    current_status = po.status.value if hasattr(po.status, "value") else str(po.status)
    if current_status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only COMPLETED production orders can be reversed (current status: {current_status})",
        )

    recipe = db.query(Recipe).filter(Recipe.id == po.recipe_id).first()
    actual_yield = Decimal(str(po.actual_yield_qty))

    # 1. Reverse finished goods: Deduct produced quantity from stock
    fg_bal = db.query(StockBalance).filter(
        StockBalance.warehouse_id == po.kitchen_warehouse_id,
        StockBalance.item_id == recipe.finished_item_id,
    ).with_for_update().first()

    if not fg_bal or Decimal(str(fg_bal.quantity)) < actual_yield:
        avail_fg = Decimal(str(fg_bal.quantity if fg_bal else 0))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reversal blocked: Insufficient finished good stock to reverse output (Available: {avail_fg}, Produced: {actual_yield})",
        )

    fg_bal.quantity = Decimal(str(fg_bal.quantity)) - actual_yield

    # Deactivate finished good batch if exists
    batch = db.query(StockBatch).filter(
        StockBatch.warehouse_id == po.kitchen_warehouse_id,
        StockBatch.item_id == recipe.finished_item_id,
        StockBatch.batch_number.like(f"%{po.order_number}%"),
    ).first()
    if batch:
        batch.quantity = Decimal("0.0000")
        batch.is_active = False

    # Ledger entry for finished good deduction (PRODUCTION_OUT / REVERSAL)
    finished_item = db.query(Item).filter(Item.id == recipe.finished_item_id).first()
    ledger_fg_rev = StockLedger(
        warehouse_id=po.kitchen_warehouse_id,
        item_id=recipe.finished_item_id,
        movement_type="PRODUCTION_OUT",
        change_qty=-actual_yield,
        balance_qty=Decimal(str(fg_bal.quantity)),
        unit_cost=Decimal(str(po.unit_food_cost)),
        total_cost=-Decimal(str(po.total_raw_cost)),
        reference_type="PRODUCTION_REVERSAL",
        reference_id=po.id,
        notes=f"Reversal of Production Order #{po.order_number}: Output deducted ({reverse_in.reason})",
        created_by_id=current_user.id,
    )
    db.add(ledger_fg_rev)

    # 2. Reverse raw materials: Restore consumed quantities back to stock
    for pc in po.consumptions:
        qty_to_restore = Decimal(str(pc.actual_consumed_qty))
        raw_item = db.query(Item).filter(Item.id == pc.raw_item_id).first()
        unit_cost = Decimal(str(pc.unit_cost))
        line_cost = qty_to_restore * unit_cost

        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == po.kitchen_warehouse_id,
            StockBalance.item_id == pc.raw_item_id,
        ).with_for_update().first()

        if not bal:
            bal = StockBalance(
                warehouse_id=po.kitchen_warehouse_id,
                item_id=pc.raw_item_id,
                quantity=qty_to_restore,
            )
            db.add(bal)
            db.flush()
        else:
            bal.quantity = Decimal(str(bal.quantity)) + qty_to_restore

        # Ledger entry for raw material restoration (PRODUCTION_IN / REVERSAL)
        ledger_raw_rev = StockLedger(
            warehouse_id=po.kitchen_warehouse_id,
            item_id=pc.raw_item_id,
            movement_type="PRODUCTION_IN",
            change_qty=qty_to_restore,
            balance_qty=Decimal(str(bal.quantity)),
            unit_cost=unit_cost,
            total_cost=line_cost,
            reference_type="PRODUCTION_REVERSAL",
            reference_id=po.id,
            notes=f"Reversal of Production Order #{po.order_number}: Raw material restored ({reverse_in.reason})",
            created_by_id=current_user.id,
        )
        db.add(ledger_raw_rev)

    po.status = "CANCELLED"
    po.notes = (po.notes or "") + f" | REVERSED: {reverse_in.reason}"
    db.commit()
    db.refresh(po)
    return _format_production_order_response(po, db)


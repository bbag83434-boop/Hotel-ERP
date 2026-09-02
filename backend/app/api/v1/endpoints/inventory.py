import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, select

from app.core.database import get_db
from app.core.auth import get_current_active_user, optional_outlet_scope
from app.models.user import User
from app.models.organization import Warehouse, Branch, StoreLocation
from app.models.inventory import (
    Category,
    Unit,
    UnitConversion,
    Item,
    ItemType,
    StockBalance,
    StockBatch,
    StockLedger,
    StockTransfer,
    StockTransferItem,
    StockCount,
    StockCountItem,
    TransferStatus,
    StockMovementType,
    StockCountStatus,
)
from app.schemas.inventory import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    UnitCreate,
    UnitUpdate,
    UnitResponse,
    UnitConversionCreate,
    UnitConversionResponse,
    UnitConvertRequest,
    UnitConvertResponse,
    ItemCreate,
    ItemUpdate,
    ItemResponse,
    StockBalanceResponse,
    LowStockAlertResponse,
    StockLedgerResponse,
    StockTransferCreate,
    StockTransferStatusUpdate,
    StockTransferResponse,
    StockTransferItemResponse,
    StockCountCreate,
    StockCountSubmit,
    StockCountResponse,
    StockCountItemResponse,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
    StockMovementTimelineEntry,
    StockBatchCreate,
    StockBatchUpdate,
    StockBatchResponse,
    StoreLocationCreate,
    StoreLocationUpdate,
    StoreLocationResponse,
    PickingAllocationItem,
    PickingSuggestRequest,
    PickingSuggestResponse,
    PickingConsumeRequest,
    PickingConsumeResponse,
    ReorderRecommendationItem,
    ReorderRecommendationResponse,
    WarehouseValuationItem,
    CategoryValuationItem,
    ItemValuationItem,
    InventoryValuationResponse,
)

router = APIRouter()


def _role_name(user: User) -> str:
    return (user.role.name if user.role else "").strip().upper()

def _is_inventory_manager(user: User) -> bool:
    return _role_name(user) in {
        "SUPER_ADMIN", "SUPERADMIN", "OWNER", "ADMIN", "HQ_ADMIN", "HEAD_OFFICE_ADMIN",
        "CENTRAL_PURCHASE_MANAGER", "CENTRAL_STORE_MANAGER", "GENERAL_MANAGER", "DIRECTOR"
    }

def _user_branch_ids(user: User) -> set:
    return {ub.branch_id for ub in (user.branches or [])}



# =============================================================
# 1. CATEGORY MANAGEMENT
# =============================================================

@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    is_active: Optional[bool] = None,
):
    query = db.query(Category).filter(Category.company_id == current_user.company_id)
    if is_active is not None:
        query = query.filter(Category.is_active == is_active)
    categories = query.order_by(Category.name.asc()).all()
    return [
        CategoryResponse(
            id=c.id,
            company_id=c.company_id,
            name=c.name,
            code=c.code,
            description=c.description,
            is_active=c.is_active,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in categories
    ]

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    existing = db.query(Category).filter(
        Category.company_id == current_user.company_id,
        func.lower(Category.code) == category_in.code.lower(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with code '{category_in.code}' already exists",
        )

    category = Category(
        company_id=current_user.company_id,
        name=category_in.name,
        code=category_in.code.upper(),
        description=category_in.description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryResponse(
        id=category.id,
        company_id=category.company_id,
        name=category.name,
        code=category.code,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )

@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.company_id == current_user.company_id,
    ).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return CategoryResponse(
        id=category.id,
        company_id=category.company_id,
        name=category.name,
        code=category.code,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )

@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    category_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.company_id == current_user.company_id,
    ).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    if category_in.name is not None:
        category.name = category_in.name
    if category_in.code is not None:
        category.code = category_in.code.upper()
    if category_in.description is not None:
        category.description = category_in.description
    if category_in.is_active is not None:
        category.is_active = category_in.is_active

    db.commit()
    db.refresh(category)
    return CategoryResponse(
        id=category.id,
        company_id=category.company_id,
        name=category.name,
        code=category.code,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at,
        updated_at=category.updated_at,
    )

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.company_id == current_user.company_id,
    ).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    
    items_count = db.query(Item).filter(Item.category_id == category_id).count()
    if items_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Category cannot be deleted because it is referenced by existing records.",
                "references": [f"{items_count} item(s) use this category"],
                "deactivate_instead": True,
            },
        )

    from app.models.closing import FoodCostCalculation

    closing_count = db.query(FoodCostCalculation).filter(FoodCostCalculation.category_id == category_id).count()
    if closing_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Category cannot be deleted because it is referenced by existing records.",
                "references": [f"{closing_count} outlet closing food-cost line(s) use this category"],
                "deactivate_instead": True,
            },
        )

    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}


# =============================================================
# 2. UNIT & UNIT CONVERSION MANAGEMENT
# =============================================================

@router.get("/units", response_model=List[UnitResponse])
def get_units(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    is_active: Optional[bool] = None,
):
    query = db.query(Unit).filter(Unit.company_id == current_user.company_id)
    if is_active is not None:
        query = query.filter(Unit.is_active == is_active)
    units = query.order_by(Unit.name.asc()).all()
    return [
        UnitResponse(
            id=u.id,
            company_id=u.company_id,
            name=u.name,
            symbol=u.symbol,
            is_active=u.is_active,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in units
    ]

@router.post("/units", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
def create_unit(
    unit_in: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    existing = db.query(Unit).filter(
        Unit.company_id == current_user.company_id,
        func.lower(Unit.symbol) == unit_in.symbol.lower(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unit with symbol '{unit_in.symbol}' already exists",
        )

    unit = Unit(
        company_id=current_user.company_id,
        name=unit_in.name,
        symbol=unit_in.symbol.lower(),
        is_active=True,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return UnitResponse(
        id=unit.id,
        company_id=unit.company_id,
        name=unit.name,
        symbol=unit.symbol,
        is_active=unit.is_active,
        created_at=unit.created_at,
        updated_at=unit.updated_at,
    )

@router.get("/units/{unit_id}", response_model=UnitResponse)
def get_unit(
    unit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    unit = db.query(Unit).filter(
        Unit.id == unit_id,
        Unit.company_id == current_user.company_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")
    return UnitResponse(
        id=unit.id,
        company_id=unit.company_id,
        name=unit.name,
        symbol=unit.symbol,
        is_active=unit.is_active,
        created_at=unit.created_at,
        updated_at=unit.updated_at,
    )

@router.put("/units/{unit_id}", response_model=UnitResponse)
def update_unit(
    unit_id: str,
    unit_in: UnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    unit = db.query(Unit).filter(
        Unit.id == unit_id,
        Unit.company_id == current_user.company_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")

    if unit_in.name is not None:
        unit.name = unit_in.name
    if unit_in.symbol is not None:
        unit.symbol = unit_in.symbol.lower()
    if unit_in.is_active is not None:
        unit.is_active = unit_in.is_active

    db.commit()
    db.refresh(unit)
    return UnitResponse(
        id=unit.id,
        company_id=unit.company_id,
        name=unit.name,
        symbol=unit.symbol,
        is_active=unit.is_active,
        created_at=unit.created_at,
        updated_at=unit.updated_at,
    )

@router.delete("/units/{unit_id}")
def delete_unit(
    unit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Dependency-safe unit deletion.

    If the unit is referenced by any master/transactional record, hard deletion
    is blocked with a clear reason and the caller is asked to deactivate instead.
    """
    unit = db.query(Unit).filter(
        Unit.id == unit_id,
        Unit.company_id == current_user.company_id,
    ).first()
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")

    from app.models.procurement import SupplierItem
    from app.models.recipe import RecipeItem
    from app.models.wastage import WastageItem
    from app.models.closing import ClosingStockItem

    reasons: list = []
    item_count = db.query(Item).filter(Item.unit_id == unit_id).count()
    if item_count:
        reasons.append(f"{item_count} item(s) use this unit")

    conv_count = db.query(UnitConversion).filter(
        or_(UnitConversion.from_unit_id == unit_id, UnitConversion.to_unit_id == unit_id)
    ).count()
    if conv_count:
        reasons.append(f"{conv_count} unit conversion rule(s) reference this unit")

    sup_unit_count = db.query(SupplierItem).filter(SupplierItem.purchase_unit_id == unit_id).count()
    if sup_unit_count:
        reasons.append(f"{sup_unit_count} vendor-item mapping(s) use this purchase unit")

    ledger_count = db.query(StockLedger).filter(StockLedger.unit_id == unit_id).count()
    if ledger_count:
        reasons.append(f"{ledger_count} stock ledger entr(ies) reference this unit")

    recipe_unit_count = db.query(RecipeItem).filter(RecipeItem.unit_id == unit_id).count()
    if recipe_unit_count:
        reasons.append(f"{recipe_unit_count} recipe/BOM line(s) reference this unit")

    wastage_unit_count = db.query(WastageItem).filter(WastageItem.unit_id == unit_id).count()
    if wastage_unit_count:
        reasons.append(f"{wastage_unit_count} wastage record(s) reference this unit")

    closing_unit_count = db.query(ClosingStockItem).filter(ClosingStockItem.unit_id == unit_id).count()
    if closing_unit_count:
        reasons.append(f"{closing_unit_count} outlet closing stock line(s) reference this unit")

    if reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Unit cannot be deleted because it is referenced by existing records.",
                "references": reasons,
                "deactivate_instead": True,
            },
        )

    db.delete(unit)
    db.commit()
    return {"message": "Unit deleted successfully", "id": unit_id}

@router.get("/unit-conversions", response_model=List[UnitConversionResponse])
def get_unit_conversions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversions = db.query(UnitConversion).filter(
        UnitConversion.company_id == current_user.company_id
    ).all()

    results = []
    for c in conversions:
        from_u = db.query(Unit).filter(Unit.id == c.from_unit_id).first()
        to_u = db.query(Unit).filter(Unit.id == c.to_unit_id).first()
        results.append(
            UnitConversionResponse(
                id=c.id,
                company_id=c.company_id,
                from_unit_id=c.from_unit_id,
                to_unit_id=c.to_unit_id,
                conversion_factor=c.conversion_factor,
                from_unit_name=from_u.name if from_u else None,
                to_unit_name=to_u.name if to_u else None,
                from_unit_symbol=from_u.symbol if from_u else None,
                to_unit_symbol=to_u.symbol if to_u else None,
            )
        )
    return results

@router.post("/unit-conversions", response_model=UnitConversionResponse, status_code=status.HTTP_201_CREATED)
def create_unit_conversion(
    conv_in: UnitConversionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from_u = db.query(Unit).filter(Unit.id == conv_in.from_unit_id, Unit.company_id == current_user.company_id).first()
    to_u = db.query(Unit).filter(Unit.id == conv_in.to_unit_id, Unit.company_id == current_user.company_id).first()
    if not from_u or not to_u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="From or To unit not found")

    existing = db.query(UnitConversion).filter(
        UnitConversion.company_id == current_user.company_id,
        UnitConversion.from_unit_id == conv_in.from_unit_id,
        UnitConversion.to_unit_id == conv_in.to_unit_id,
    ).first()
    if existing:
        existing.conversion_factor = conv_in.conversion_factor
        db.commit()
        db.refresh(existing)
        return UnitConversionResponse(
            id=existing.id,
            company_id=existing.company_id,
            from_unit_id=existing.from_unit_id,
            to_unit_id=existing.to_unit_id,
            conversion_factor=existing.conversion_factor,
            from_unit_name=from_u.name,
            to_unit_name=to_u.name,
            from_unit_symbol=from_u.symbol,
            to_unit_symbol=to_u.symbol,
        )

    conv = UnitConversion(
        company_id=current_user.company_id,
        from_unit_id=conv_in.from_unit_id,
        to_unit_id=conv_in.to_unit_id,
        conversion_factor=conv_in.conversion_factor,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return UnitConversionResponse(
        id=conv.id,
        company_id=conv.company_id,
        from_unit_id=conv.from_unit_id,
        to_unit_id=conv.to_unit_id,
        conversion_factor=conv.conversion_factor,
        from_unit_name=from_u.name,
        to_unit_name=to_u.name,
        from_unit_symbol=from_u.symbol,
        to_unit_symbol=to_u.symbol,
    )

# Standard unit conversion engine with dimensional compatibility checks
STANDARD_CONVERSIONS = {
    # Weight
    ("kg", "g"): Decimal("1000"),
    ("kg", "gram"): Decimal("1000"),
    ("kg", "grams"): Decimal("1000"),
    ("g", "kg"): Decimal("0.001"),
    ("gram", "kg"): Decimal("0.001"),
    ("g", "mg"): Decimal("1000"),
    ("mg", "g"): Decimal("0.001"),
    # Volume
    ("l", "ml"): Decimal("1000"),
    ("litre", "ml"): Decimal("1000"),
    ("liter", "ml"): Decimal("1000"),
    ("ml", "l"): Decimal("0.001"),
    ("ml", "litre"): Decimal("0.001"),
    # Count
    ("dozen", "pcs"): Decimal("12"),
    ("dozen", "pieces"): Decimal("12"),
    ("pcs", "dozen"): Decimal("1") / Decimal("12"),
    ("box", "pcs"): Decimal("1"),  # fallback
}

WEIGHT_UNITS = {"kg", "g", "gram", "grams", "mg", "ton", "tonne", "lb", "oz"}
VOLUME_UNITS = {"l", "litre", "liter", "ml", "cup", "tbsp", "tsp", "gal"}
COUNT_UNITS = {"pcs", "pieces", "dozen", "box", "pack", "tray", "portion", "portions", "unit", "units"}

@router.post("/unit-conversions/convert", response_model=UnitConvertResponse)
def convert_unit(
    req: UnitConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from_raw = req.from_unit.strip().lower()
    to_raw = req.to_unit.strip().lower()

    if from_raw == to_raw:
        return UnitConvertResponse(
            original_value=req.value,
            from_unit=req.from_unit,
            to_unit=req.to_unit,
            converted_value=req.value,
            conversion_factor=Decimal("1.0"),
            formula=f"{req.value} {req.from_unit} = {req.value} {req.to_unit}",
        )

    # Dimensional incompatibility checks
    from_dim = "weight" if from_raw in WEIGHT_UNITS else ("volume" if from_raw in VOLUME_UNITS else ("count" if from_raw in COUNT_UNITS else None))
    to_dim = "weight" if to_raw in WEIGHT_UNITS else ("volume" if to_raw in VOLUME_UNITS else ("count" if to_raw in COUNT_UNITS else None))

    # Standard conversion table
    factor = STANDARD_CONVERSIONS.get((from_raw, to_raw))
    
    # Check DB custom conversion if not in standard
    if factor is None:
        db_conv = db.query(UnitConversion).join(
            Unit, Unit.id == UnitConversion.from_unit_id
        ).filter(
            UnitConversion.company_id == current_user.company_id,
            or_(
                and_(UnitConversion.from_unit_id == req.from_unit, UnitConversion.to_unit_id == req.to_unit),
                and_(func.lower(Unit.symbol) == from_raw)
            )
        ).first()
        if db_conv:
            factor = Decimal(str(db_conv.conversion_factor))

    if factor is None:
        if from_dim and to_dim and from_dim != to_dim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dimensionally incompatible conversion from '{req.from_unit}' ({from_dim}) to '{req.to_unit}' ({to_dim}) is not allowed without a specific recipe density rule.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No unit conversion factor configured between '{req.from_unit}' and '{req.to_unit}'.",
        )

    converted = (req.value * factor).quantize(Decimal("0.0001"))
    return UnitConvertResponse(
        original_value=req.value,
        from_unit=req.from_unit,
        to_unit=req.to_unit,
        converted_value=converted,
        conversion_factor=factor,
        formula=f"{req.value} {req.from_unit} * {factor} = {converted} {req.to_unit}",
    )


# =============================================================
# 3. ITEM / RAW MATERIAL / FINISHED GOOD MASTER
# =============================================================

@router.get("/items", response_model=List[ItemResponse])
def get_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    query = (
        db.query(Item)
        .options(joinedload(Item.category), joinedload(Item.unit))
        .filter(Item.company_id == current_user.company_id)
    )
    if category_id:
        query = query.filter(Item.category_id == category_id)
    if type:
        query = query.filter(Item.type == type)
    if is_active is not None:
        query = query.filter(Item.is_active == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Item.name.ilike(search_pattern),
                Item.code.ilike(search_pattern),
                Item.barcode.ilike(search_pattern),
            )
        )

    items = query.order_by(Item.name.asc()).all()
    results = []
    for it in items:
        results.append(
            ItemResponse(
                id=it.id,
                company_id=it.company_id,
                category_id=it.category_id,
                unit_id=it.unit_id,
                name=it.name,
                code=it.code,
                barcode=it.barcode,
                type=it.type.value if hasattr(it.type, "value") else str(it.type),
                description=it.description,
                cost_price=Decimal(str(it.cost_price or 0)),
                selling_price=Decimal(str(it.selling_price or 0)),
                min_stock_level=Decimal(str(it.min_stock_level or 0)),
                reorder_qty=Decimal(str(it.reorder_qty or 0)),
                is_active=it.is_active,
                category_name=it.category.name if it.category else None,
                unit_symbol=it.unit.symbol if it.unit else None,
                unit_name=it.unit.name if it.unit else None,
                created_at=it.created_at,
                updated_at=it.updated_at,
            )
        )
    return results

@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    item_in: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    cat = db.query(Category).filter(Category.id == item_in.category_id, Category.company_id == current_user.company_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    u = db.query(Unit).filter(Unit.id == item_in.unit_id, Unit.company_id == current_user.company_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unit not found")

    existing = db.query(Item).filter(
        Item.company_id == current_user.company_id,
        func.lower(Item.code) == item_in.code.lower(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Item with code '{item_in.code}' already exists",
        )

    item = Item(
        company_id=current_user.company_id,
        category_id=item_in.category_id,
        unit_id=item_in.unit_id,
        name=item_in.name,
        code=item_in.code.upper(),
        barcode=item_in.barcode,
        type=item_in.type or "RAW_MATERIAL",
        description=item_in.description,
        cost_price=item_in.cost_price or Decimal("0.0000"),
        selling_price=item_in.selling_price or Decimal("0.0000"),
        min_stock_level=item_in.min_stock_level or Decimal("0.0000"),
        reorder_qty=item_in.reorder_qty or Decimal("0.0000"),
        is_active=item_in.is_active if item_in.is_active is not None else True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return ItemResponse(
        id=item.id,
        company_id=item.company_id,
        category_id=item.category_id,
        unit_id=item.unit_id,
        name=item.name,
        code=item.code,
        barcode=item.barcode,
        type=item.type.value if hasattr(item.type, "value") else str(item.type),
        description=item.description,
        cost_price=Decimal(str(item.cost_price or 0)),
        selling_price=Decimal(str(item.selling_price or 0)),
        min_stock_level=Decimal(str(item.min_stock_level or 0)),
        reorder_qty=Decimal(str(item.reorder_qty or 0)),
        is_active=item.is_active,
        category_name=cat.name,
        unit_symbol=u.symbol,
        unit_name=u.name,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    cat = db.query(Category).filter(Category.id == item.category_id).first()
    u = db.query(Unit).filter(Unit.id == item.unit_id).first()
    return ItemResponse(
        id=item.id,
        company_id=item.company_id,
        category_id=item.category_id,
        unit_id=item.unit_id,
        name=item.name,
        code=item.code,
        barcode=item.barcode,
        type=item.type.value if hasattr(item.type, "value") else str(item.type),
        description=item.description,
        cost_price=Decimal(str(item.cost_price or 0)),
        selling_price=Decimal(str(item.selling_price or 0)),
        min_stock_level=Decimal(str(item.min_stock_level or 0)),
        reorder_qty=Decimal(str(item.reorder_qty or 0)),
        is_active=item.is_active,
        category_name=cat.name if cat else None,
        unit_symbol=u.symbol if u else None,
        unit_name=u.name if u else None,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: str,
    item_in: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    if item_in.name is not None:
        item.name = item_in.name
    if item_in.code is not None:
        item.code = item_in.code.upper()
    if item_in.category_id is not None:
        item.category_id = item_in.category_id
    if item_in.unit_id is not None:
        item.unit_id = item_in.unit_id
    if item_in.barcode is not None:
        item.barcode = item_in.barcode
    if item_in.type is not None:
        item.type = item_in.type
    if item_in.description is not None:
        item.description = item_in.description
    if item_in.cost_price is not None:
        item.cost_price = item_in.cost_price
    if item_in.selling_price is not None:
        item.selling_price = item_in.selling_price
    if item_in.min_stock_level is not None:
        item.min_stock_level = item_in.min_stock_level
    if item_in.reorder_qty is not None:
        item.reorder_qty = item_in.reorder_qty
    if item_in.is_active is not None:
        item.is_active = item_in.is_active

    db.commit()
    db.refresh(item)

    cat = db.query(Category).filter(Category.id == item.category_id).first()
    u = db.query(Unit).filter(Unit.id == item.unit_id).first()
    return ItemResponse(
        id=item.id,
        company_id=item.company_id,
        category_id=item.category_id,
        unit_id=item.unit_id,
        name=item.name,
        code=item.code,
        barcode=item.barcode,
        type=item.type.value if hasattr(item.type, "value") else str(item.type),
        description=item.description,
        cost_price=Decimal(str(item.cost_price or 0)),
        selling_price=Decimal(str(item.selling_price or 0)),
        min_stock_level=Decimal(str(item.min_stock_level or 0)),
        reorder_qty=Decimal(str(item.reorder_qty or 0)),
        is_active=item.is_active,
        category_name=cat.name if cat else None,
        unit_symbol=u.symbol if u else None,
        unit_name=u.name if u else None,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )

@router.delete("/items/{item_id}")
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    # ------------------------------------------------------------------
    # Dependency-safe deletion:
    # If the item is referenced by any transactional/master record we do
    # NOT hard-delete. Instead we deactivate (Active/Inactive) and report
    # the exact references that prevent destructive deletion.
    # ------------------------------------------------------------------
    from app.models.procurement import (
        PurchaseRequestItem,
        PurchaseOrderItem,
        GoodsReceiveItem,
        SupplierItem,
        SmartRequirementItem,
    )
    from app.models.recipe import Recipe, RecipeItem, ProductionConsumption
    from app.models.billing import VendorBillItem
    from app.models.wastage import WastageItem
    from app.models.closing import ClosingStockItem

    ref_checks = [
        ("stock balance(s)", db.query(StockBalance).filter(StockBalance.item_id == item_id).count()),
        ("stock batch(es)", db.query(StockBatch).filter(StockBatch.item_id == item_id).count()),
        ("stock ledger entr(ies)", db.query(StockLedger).filter(StockLedger.item_id == item_id).count()),
        ("purchase requisition line(s)", db.query(PurchaseRequestItem).filter(PurchaseRequestItem.item_id == item_id).count()),
        ("purchase order line(s)", db.query(PurchaseOrderItem).filter(PurchaseOrderItem.item_id == item_id).count()),
        ("GRN line(s)", db.query(GoodsReceiveItem).filter(GoodsReceiveItem.item_id == item_id).count()),
        ("recipe/BOM(s) as finished item", db.query(Recipe).filter(Recipe.finished_item_id == item_id).count()),
        ("recipe/BOM ingredient line(s)", db.query(RecipeItem).filter(RecipeItem.raw_item_id == item_id).count()),
        ("production consumption line(s)", db.query(ProductionConsumption).filter(ProductionConsumption.raw_item_id == item_id).count()),
        ("store transfer line(s)", db.query(StockTransferItem).filter(StockTransferItem.item_id == item_id).count()),
        ("wastage line(s)", db.query(WastageItem).filter(WastageItem.item_id == item_id).count()),
        ("vendor-item mapping(s)", db.query(SupplierItem).filter(SupplierItem.item_id == item_id).count()),
        ("vendor bill line(s)", db.query(VendorBillItem).filter(VendorBillItem.item_id == item_id).count()),
        ("outlet closing stock line(s)", db.query(ClosingStockItem).filter(ClosingStockItem.item_id == item_id).count()),
        ("stock count line(s)", db.query(StockCountItem).filter(StockCountItem.item_id == item_id).count()),
        ("store location assignment(s)", db.query(StoreLocation).filter(StoreLocation.item_id == item_id).count()),
        ("smart requirement line(s)", db.query(SmartRequirementItem).filter(SmartRequirementItem.item_id == item_id).count()),
    ]
    existing_refs = [f"{count} {label}" for label, count in ref_checks if count]

    if existing_refs:
        # Destructive deletion is blocked by backend. Deactivate instead.
        item.is_active = False
        db.commit()
        return {
            "message": "Item deactivated instead of deleted because it is referenced by existing records.",
            "id": item_id,
            "deactivated": True,
            "references": existing_refs,
            "deactivate_instead": True,
        }

    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully", "id": item_id}


# =============================================================
# 4. STOCK BALANCES & REAL-TIME STOCK LEDGER
# =============================================================

@router.get("/stock-balances", response_model=List[StockBalanceResponse])
def get_stock_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    outlet_id: Optional[str] = Depends(optional_outlet_scope),
    warehouse_id: Optional[str] = None,
    item_id: Optional[str] = None,
    low_stock_only: bool = False,
):
    query = db.query(StockBalance).join(
        Item, Item.id == StockBalance.item_id
    ).filter(Item.company_id == current_user.company_id)
    
    if outlet_id:
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id == outlet_id)
    elif not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return [] # No branches -> no stock
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))


    if warehouse_id:
        query = query.filter(StockBalance.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(StockBalance.item_id == item_id)

    balances = query.all()
    results = []
    for sb in balances:
        it = db.query(Item).filter(Item.id == sb.item_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == sb.warehouse_id).first()
        u = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None
        
        min_lvl = sb.min_stock_level if sb.min_stock_level is not None else (it.min_stock_level if it else Decimal(0))
        qty = Decimal(str(sb.quantity or 0))
        is_low = bool(min_lvl and qty < Decimal(str(min_lvl)))

        if low_stock_only and not is_low:
            continue

        results.append(
            StockBalanceResponse(
                id=sb.id,
                warehouse_id=sb.warehouse_id,
                item_id=sb.item_id,
                quantity=qty,
                min_stock_level=min_lvl,
                reorder_qty=sb.reorder_qty if sb.reorder_qty is not None else (it.reorder_qty if it else None),
                avg_unit_cost=Decimal(str(sb.avg_unit_cost or 0)),
                item_name=it.name if it else None,
                item_code=it.code if it else None,
                item_type=it.type.value if it and hasattr(it.type, "value") else (str(it.type) if it else None),
                unit_symbol=u.symbol if u else None,
                warehouse_name=wh.name if wh else None,
                is_low_stock=is_low,
                updated_at=sb.updated_at,
            )
        )
    return results

@router.get("/stock-balances/low-stock", response_model=List[LowStockAlertResponse])
def get_low_stock_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    outlet_id: Optional[str] = Depends(optional_outlet_scope),
    warehouse_id: Optional[str] = None,
):
    query = db.query(StockBalance).join(
        Item, Item.id == StockBalance.item_id
    ).filter(Item.company_id == current_user.company_id)
    
    if outlet_id:
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id == outlet_id)
    elif not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.join(Warehouse, Warehouse.id == StockBalance.warehouse_id).filter(Warehouse.branch_id.in_(user_bids))


    if warehouse_id:
        query = query.filter(StockBalance.warehouse_id == warehouse_id)

    balances = query.all()
    alerts = []
    for sb in balances:
        it = db.query(Item).filter(Item.id == sb.item_id).first()
        if not it:
            continue
        wh = db.query(Warehouse).filter(Warehouse.id == sb.warehouse_id).first()
        u = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None

        min_lvl = Decimal(str(sb.min_stock_level if sb.min_stock_level is not None else it.min_stock_level or 0))
        reorder = Decimal(str(sb.reorder_qty if sb.reorder_qty is not None else it.reorder_qty or 0))
        current_qty = Decimal(str(sb.quantity or 0))

        if min_lvl > 0 and current_qty <= min_lvl:
            shortage = min_lvl - current_qty
            alerts.append(
                LowStockAlertResponse(
                    warehouse_id=sb.warehouse_id,
                    warehouse_name=wh.name if wh else "Unknown",
                    item_id=it.id,
                    item_name=it.name,
                    item_code=it.code,
                    current_quantity=current_qty,
                    min_stock_level=min_lvl,
                    reorder_qty=reorder,
                    shortage=shortage,
                    unit_symbol=u.symbol if u else None,
                )
            )
    return alerts

@router.get("/stock-ledger", response_model=List[StockLedgerResponse])
def get_stock_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    outlet_id: Optional[str] = Depends(optional_outlet_scope),
    warehouse_id: Optional[str] = None,
    item_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
):
    query = db.query(StockLedger).join(
        Item, Item.id == StockLedger.item_id
    ).filter(Item.company_id == current_user.company_id)
    
    if outlet_id:
        query = query.filter(StockLedger.branch_id == outlet_id)
    elif not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.filter(StockLedger.branch_id.in_(user_bids))

    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(StockLedger.item_id == item_id)
    if movement_type:
        query = query.filter(StockLedger.movement_type == movement_type)

    entries = query.order_by(StockLedger.created_at.desc()).limit(limit).all()
    results = []
    for entry in entries:
        it = db.query(Item).filter(Item.id == entry.item_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == entry.warehouse_id).first()
        u = db.query(Unit).filter(Unit.id == entry.unit_id).first() if entry.unit_id else (
            db.query(Unit).filter(Unit.id == it.unit_id).first() if it and it.unit_id else None
        )
        usr = db.query(User).filter(User.id == entry.created_by_id).first() if entry.created_by_id else None

        mv_type_str = entry.movement_type.value if hasattr(entry.movement_type, "value") else str(entry.movement_type)
        chg = Decimal(str(entry.change_qty))
        
        if mv_type_str in ["GRN", "PRODUCTION_IN", "TRANSFER_IN", "ADJUSTMENT_IN", "PURCHASE_RECEIVE"] or (mv_type_str == "ADJUSTMENT" and chg > 0):
            direction = "IN"
            badge_color = "emerald"
        elif mv_type_str in ["POS_SALE", "PRODUCTION_OUT", "TRANSFER_OUT", "WASTAGE", "ADJUSTMENT_OUT"] or (mv_type_str == "ADJUSTMENT" and chg < 0):
            direction = "OUT"
            badge_color = "rose"
        elif mv_type_str == "REVERSAL":
            direction = "REVERSAL"
            badge_color = "amber"
        else:
            direction = "IN" if chg >= 0 else "OUT"
            badge_color = "emerald" if chg >= 0 else "rose"

        results.append(
            StockLedgerResponse(
                id=entry.id,
                company_id=getattr(entry, "company_id", None) or (it.company_id if it else None),
                branch_id=getattr(entry, "branch_id", None) or (wh.branch_id if wh else None),
                warehouse_id=entry.warehouse_id,
                item_id=entry.item_id,
                unit_id=entry.unit_id or (it.unit_id if it else None),
                unit_symbol=u.symbol if u else None,
                batch_number=entry.batch_number,
                expiry_date=entry.expiry_date,
                movement_type=mv_type_str,
                change_qty=chg,
                balance_qty=Decimal(str(entry.balance_qty)),
                unit_cost=Decimal(str(entry.unit_cost)) if entry.unit_cost is not None else None,
                total_cost=Decimal(str(entry.total_cost)) if entry.total_cost is not None else None,
                reference_type=entry.reference_type,
                reference_id=entry.reference_id,
                reversal_reference_id=getattr(entry, "reversal_reference_id", None),
                idempotency_key=getattr(entry, "idempotency_key", None),
                is_emergency_override=bool(getattr(entry, "is_emergency_override", False)),
                notes=entry.notes,
                created_by_id=entry.created_by_id,
                created_by_name=usr.name if usr else None,
                created_at=entry.created_at,
                item_name=it.name if it else None,
                item_code=it.code if it else None,
                warehouse_name=wh.name if wh else None,
                direction=direction,
                badge_color=badge_color,
            )
        )
    return results


@router.get("/stock-ledger/timeline", response_model=List[StockMovementTimelineEntry])
def get_stock_movement_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    outlet_id: Optional[str] = Depends(optional_outlet_scope),
    item_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    movement_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    query = db.query(StockLedger).join(
        Item, Item.id == StockLedger.item_id
    ).filter(Item.company_id == current_user.company_id)
    
    if outlet_id:
        query = query.filter(StockLedger.branch_id == outlet_id)
    elif not _is_inventory_manager(current_user):
        user_bids = list(_user_branch_ids(current_user))
        if not user_bids:
            return []
        query = query.filter(StockLedger.branch_id.in_(user_bids))

    if item_id:
        query = query.filter(StockLedger.item_id == item_id)
    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    if movement_type:
        query = query.filter(StockLedger.movement_type == movement_type)
    if start_date:
        query = query.filter(StockLedger.created_at >= start_date)
    if end_date:
        query = query.filter(StockLedger.created_at <= end_date)

    entries = query.order_by(StockLedger.created_at.desc()).limit(limit).all()
    timeline = []
    for entry in entries:
        it = db.query(Item).filter(Item.id == entry.item_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == entry.warehouse_id).first()
        u = db.query(Unit).filter(Unit.id == entry.unit_id).first() if entry.unit_id else (
            db.query(Unit).filter(Unit.id == it.unit_id).first() if it and it.unit_id else None
        )
        usr = db.query(User).filter(User.id == entry.created_by_id).first() if entry.created_by_id else None

        mv_type_str = entry.movement_type.value if hasattr(entry.movement_type, "value") else str(entry.movement_type)
        chg = Decimal(str(entry.change_qty))

        if mv_type_str in ["GRN", "PRODUCTION_IN", "TRANSFER_IN", "ADJUSTMENT_IN", "PURCHASE_RECEIVE"] or (mv_type_str == "ADJUSTMENT" and chg > 0):
            direction = "IN"
            badge_color = "emerald"
        elif mv_type_str in ["POS_SALE", "PRODUCTION_OUT", "TRANSFER_OUT", "WASTAGE", "ADJUSTMENT_OUT"] or (mv_type_str == "ADJUSTMENT" and chg < 0):
            direction = "OUT"
            badge_color = "rose"
        elif mv_type_str == "REVERSAL":
            direction = "REVERSAL"
            badge_color = "amber"
        else:
            direction = "IN" if chg >= 0 else "OUT"
            badge_color = "emerald" if chg >= 0 else "rose"

        timeline.append(
            StockMovementTimelineEntry(
                id=entry.id,
                timestamp=entry.created_at,
                movement_type=mv_type_str,
                direction=direction,
                change_qty=chg,
                balance_qty=Decimal(str(entry.balance_qty)),
                unit_symbol=u.symbol if u else None,
                unit_cost=Decimal(str(entry.unit_cost)) if entry.unit_cost is not None else None,
                total_cost=Decimal(str(entry.total_cost)) if entry.total_cost is not None else None,
                item_id=entry.item_id,
                item_name=it.name if it else "Unknown Item",
                item_code=it.code if it else "",
                warehouse_id=entry.warehouse_id,
                warehouse_name=wh.name if wh else "Unknown Warehouse",
                batch_number=entry.batch_number,
                expiry_date=entry.expiry_date,
                reference_type=entry.reference_type,
                reference_id=entry.reference_id,
                reversal_reference_id=getattr(entry, "reversal_reference_id", None),
                is_emergency_override=bool(getattr(entry, "is_emergency_override", False)),
                user_id=entry.created_by_id,
                user_name=usr.name if usr else None,
                reason_code=getattr(entry, "notes", None),
                notes=entry.notes,
                badge_color=badge_color,
            )
        )
    return timeline


@router.post("/stock-adjustments", response_model=StockLedgerResponse, status_code=status.HTTP_201_CREATED)
def create_stock_adjustment(
    adjustment_in: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Direct inventory adjustment with strict negative stock policy and reason code logging.
    """
    wh = db.query(Warehouse).filter(
        Warehouse.id == adjustment_in.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    item = db.query(Item).filter(
        Item.id == adjustment_in.item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    chg_qty = Decimal(str(adjustment_in.change_qty))
    if chg_qty == Decimal("0.0000"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adjustment quantity cannot be zero")

    # Lock stock balance
    bal = db.query(StockBalance).filter(
        StockBalance.warehouse_id == adjustment_in.warehouse_id,
        StockBalance.item_id == adjustment_in.item_id,
    ).with_for_update().first()

    current_qty = Decimal(str(bal.quantity if bal else 0))
    new_qty = current_qty + chg_qty

    # Negative stock policy check
    if new_qty < Decimal("0.0000"):
        if not adjustment_in.is_emergency_override:
            shortage = abs(new_qty)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {item.name}: Available {current_qty}, Adjustment requires {abs(chg_qty)}. Shortage: {shortage}",
            )
        if not adjustment_in.override_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Emergency negative stock override requires a valid justification note",
            )

    if not bal:
        bal = StockBalance(
            warehouse_id=adjustment_in.warehouse_id,
            item_id=adjustment_in.item_id,
            quantity=Decimal("0.0000"),
        )
        db.add(bal)
        db.flush()

    bal.quantity = new_qty

    unit_cost = adjustment_in.unit_cost if adjustment_in.unit_cost is not None else Decimal(str(item.cost_price or 0))
    total_cost = abs(chg_qty) * unit_cost
    note_text = f"[{adjustment_in.reason_code}] {adjustment_in.notes or ''}".strip()
    if adjustment_in.is_emergency_override:
        note_text += f" | OVERRIDE: {adjustment_in.override_reason}"

    ledger = StockLedger(
        company_id=current_user.company_id,
        branch_id=wh.branch_id,
        warehouse_id=adjustment_in.warehouse_id,
        item_id=adjustment_in.item_id,
        unit_id=item.unit_id,
        batch_number=adjustment_in.batch_number,
        expiry_date=adjustment_in.expiry_date,
        movement_type="ADJUSTMENT",
        change_qty=chg_qty,
        balance_qty=new_qty,
        unit_cost=unit_cost,
        total_cost=total_cost,
        reference_type="STOCK_ADJUSTMENT",
        reference_id=str(uuid.uuid4()),
        is_emergency_override=adjustment_in.is_emergency_override,
        notes=note_text,
        created_by_id=current_user.id,
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)

    u = db.query(Unit).filter(Unit.id == item.unit_id).first() if item.unit_id else None
    return StockLedgerResponse(
        id=ledger.id,
        company_id=ledger.company_id,
        branch_id=ledger.branch_id,
        warehouse_id=ledger.warehouse_id,
        item_id=ledger.item_id,
        unit_id=ledger.unit_id,
        unit_symbol=u.symbol if u else None,
        batch_number=ledger.batch_number,
        expiry_date=ledger.expiry_date,
        movement_type=ledger.movement_type,
        change_qty=ledger.change_qty,
        balance_qty=ledger.balance_qty,
        unit_cost=ledger.unit_cost,
        total_cost=ledger.total_cost,
        reference_type=ledger.reference_type,
        reference_id=ledger.reference_id,
        reversal_reference_id=ledger.reversal_reference_id,
        idempotency_key=ledger.idempotency_key,
        is_emergency_override=ledger.is_emergency_override,
        notes=ledger.notes,
        created_by_id=ledger.created_by_id,
        created_by_name=current_user.name,
        created_at=ledger.created_at,
        item_name=item.name,
        item_code=item.code,
        warehouse_name=wh.name,
        direction="IN" if chg_qty > 0 else "OUT",
        badge_color="emerald" if chg_qty > 0 else "rose",
    )


# =============================================================
# 5. MULTI-OUTLET STOCK TRANSFER & CENTRAL COMMISSARY
# =============================================================

@router.get("/transfers", response_model=List[StockTransferResponse])
def get_stock_transfers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    warehouse_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
):
    query = db.query(StockTransfer).filter(StockTransfer.company_id == current_user.company_id)
    if warehouse_id:
        query = query.filter(
            or_(
                StockTransfer.from_warehouse_id == warehouse_id,
                StockTransfer.to_warehouse_id == warehouse_id,
            )
        )
    if status_filter:
        query = query.filter(StockTransfer.status == status_filter)

    transfers = query.order_by(StockTransfer.created_at.desc()).all()
    results = []
    for trf in transfers:
        from_wh = db.query(Warehouse).filter(Warehouse.id == trf.from_warehouse_id).first()
        to_wh = db.query(Warehouse).filter(Warehouse.id == trf.to_warehouse_id).first()
        items_res = []
        for itm in trf.items:
            item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
            u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
            items_res.append(
                StockTransferItemResponse(
                    id=itm.id,
                    transfer_id=itm.transfer_id,
                    item_id=itm.item_id,
                    quantity=Decimal(str(itm.quantity)),
                    unit_cost=Decimal(str(itm.unit_cost)) if itm.unit_cost is not None else None,
                    notes=itm.notes,
                    item_name=item_obj.name if item_obj else None,
                    item_code=item_obj.code if item_obj else None,
                    unit_symbol=u.symbol if u else None,
                )
            )
        results.append(
            StockTransferResponse(
                id=trf.id,
                company_id=trf.company_id,
                from_warehouse_id=trf.from_warehouse_id,
                to_warehouse_id=trf.to_warehouse_id,
                transfer_number=trf.transfer_number,
                status=trf.status.value if hasattr(trf.status, "value") else str(trf.status),
                transfer_date=trf.transfer_date,
                notes=trf.notes,
                created_by_id=trf.created_by_id,
                from_warehouse_name=from_wh.name if from_wh else None,
                to_warehouse_name=to_wh.name if to_wh else None,
                items=items_res,
                created_at=trf.created_at,
                updated_at=trf.updated_at,
            )
        )
    return results

@router.post("/transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
def create_stock_transfer(
    transfer_in: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from_wh = db.query(Warehouse).filter(
        Warehouse.id == transfer_in.from_warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    to_wh = db.query(Warehouse).filter(
        Warehouse.id == transfer_in.to_warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()

    if not from_wh or not to_wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source or Destination Warehouse not found")

    if from_wh.id == to_wh.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and destination warehouses cannot be the same")

    if not transfer_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer must contain at least one item")

    trf_num = transfer_in.transfer_number or f"TRF-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    transfer = StockTransfer(
        company_id=current_user.company_id,
        from_warehouse_id=transfer_in.from_warehouse_id,
        to_warehouse_id=transfer_in.to_warehouse_id,
        transfer_number=trf_num,
        status="PENDING",
        transfer_date=transfer_in.transfer_date or datetime.now(timezone.utc),
        notes=transfer_in.notes,
        created_by_id=current_user.id,
    )
    db.add(transfer)
    db.flush()

    items_res = []
    for item_data in transfer_in.items:
        item_obj = db.query(Item).filter(
            Item.id == item_data.item_id,
            Item.company_id == current_user.company_id,
        ).first()
        if not item_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item {item_data.item_id} not found")

        trf_item = StockTransferItem(
            transfer_id=transfer.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost if item_data.unit_cost is not None else item_obj.cost_price,
            notes=item_data.notes,
        )
        db.add(trf_item)
        db.flush()

        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first()
        items_res.append(
            StockTransferItemResponse(
                id=trf_item.id,
                transfer_id=transfer.id,
                item_id=item_obj.id,
                quantity=Decimal(str(trf_item.quantity)),
                unit_cost=Decimal(str(trf_item.unit_cost or 0)),
                notes=trf_item.notes,
                item_name=item_obj.name,
                item_code=item_obj.code,
                unit_symbol=u.symbol if u else None,
            )
        )

    db.commit()
    db.refresh(transfer)

    return StockTransferResponse(
        id=transfer.id,
        company_id=transfer.company_id,
        from_warehouse_id=transfer.from_warehouse_id,
        to_warehouse_id=transfer.to_warehouse_id,
        transfer_number=transfer.transfer_number,
        status=transfer.status.value if hasattr(transfer.status, "value") else str(transfer.status),
        transfer_date=transfer.transfer_date,
        notes=transfer.notes,
        created_by_id=transfer.created_by_id,
        from_warehouse_name=from_wh.name,
        to_warehouse_name=to_wh.name,
        items=items_res,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
    )

@router.get("/transfers/{transfer_id}", response_model=StockTransferResponse)
def get_stock_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    transfer = db.query(StockTransfer).filter(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == current_user.company_id,
    ).with_for_update().first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    from_wh = db.query(Warehouse).filter(Warehouse.id == transfer.from_warehouse_id).first()
    to_wh = db.query(Warehouse).filter(Warehouse.id == transfer.to_warehouse_id).first()
    items_res = []
    for itm in transfer.items:
        item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
        items_res.append(
            StockTransferItemResponse(
                id=itm.id,
                transfer_id=itm.transfer_id,
                item_id=itm.item_id,
                quantity=Decimal(str(itm.quantity)),
                unit_cost=Decimal(str(itm.unit_cost)) if itm.unit_cost is not None else None,
                notes=itm.notes,
                item_name=item_obj.name if item_obj else None,
                item_code=item_obj.code if item_obj else None,
                unit_symbol=u.symbol if u else None,
            )
        )

    return StockTransferResponse(
        id=transfer.id,
        company_id=transfer.company_id,
        from_warehouse_id=transfer.from_warehouse_id,
        to_warehouse_id=transfer.to_warehouse_id,
        transfer_number=transfer.transfer_number,
        status=transfer.status.value if hasattr(transfer.status, "value") else str(transfer.status),
        transfer_date=transfer.transfer_date,
        notes=transfer.notes,
        created_by_id=transfer.created_by_id,
        from_warehouse_name=from_wh.name if from_wh else None,
        to_warehouse_name=to_wh.name if to_wh else None,
        items=items_res,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
    )

@router.put("/transfers/{transfer_id}/status", response_model=StockTransferResponse)
def update_stock_transfer_status(
    transfer_id: str,
    status_in: StockTransferStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    transfer = db.query(StockTransfer).filter(
        StockTransfer.id == transfer_id,
        StockTransfer.company_id == current_user.company_id,
    ).with_for_update().first()
    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock transfer not found")

    target_status = status_in.status.upper()
    current_status = transfer.status.value if hasattr(transfer.status, "value") else str(transfer.status)

    if current_status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change status of already COMPLETED transfer")
    if current_status == "CANCELLED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change status of CANCELLED transfer")

    if target_status == "COMPLETED":
        # Execute stock deduction and credit with atomic row-level locking
        for trf_item in transfer.items:
            qty = Decimal(str(trf_item.quantity))

            # 1. Source warehouse balance
            from_bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == transfer.from_warehouse_id,
                StockBalance.item_id == trf_item.item_id,
            ).with_for_update().first()

            if not from_bal:
                from_bal = StockBalance(
                    warehouse_id=transfer.from_warehouse_id,
                    item_id=trf_item.item_id,
                    quantity=Decimal("0.0000"),
                )
                db.add(from_bal)
                db.flush()

            available_from = Decimal(str(from_bal.quantity))
            if qty <= Decimal("0"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer quantity must be greater than zero")
            if available_from < qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for transfer: Available {available_from}, Requested {qty}, Shortage {qty - available_from}",
                )
            new_from_qty = available_from - qty
            from_bal.quantity = new_from_qty

            # Source ledger: TRANSFER_OUT
            ledger_out = StockLedger(
                warehouse_id=transfer.from_warehouse_id,
                item_id=trf_item.item_id,
                movement_type="TRANSFER_OUT",
                change_qty=-qty,
                balance_qty=new_from_qty,
                unit_cost=trf_item.unit_cost or Decimal("0.0000"),
                total_cost=(qty * Decimal(str(trf_item.unit_cost or 0))),
                reference_type="STOCK_TRANSFER",
                reference_id=transfer.id,
                notes=f"Stock Transfer Out #{transfer.transfer_number}",
                created_by_id=current_user.id,
            )
            db.add(ledger_out)

            # 2. Destination warehouse balance
            to_bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == transfer.to_warehouse_id,
                StockBalance.item_id == trf_item.item_id,
            ).with_for_update().first()

            if not to_bal:
                to_bal = StockBalance(
                    warehouse_id=transfer.to_warehouse_id,
                    item_id=trf_item.item_id,
                    quantity=Decimal("0.0000"),
                )
                db.add(to_bal)
                db.flush()

            new_to_qty = Decimal(str(to_bal.quantity)) + qty
            to_bal.quantity = new_to_qty

            # Destination ledger: TRANSFER_IN
            ledger_in = StockLedger(
                warehouse_id=transfer.to_warehouse_id,
                item_id=trf_item.item_id,
                movement_type="TRANSFER_IN",
                change_qty=qty,
                balance_qty=new_to_qty,
                unit_cost=trf_item.unit_cost or Decimal("0.0000"),
                total_cost=(qty * Decimal(str(trf_item.unit_cost or 0))),
                reference_type="STOCK_TRANSFER",
                reference_id=transfer.id,
                notes=f"Stock Transfer In #{transfer.transfer_number}",
                created_by_id=current_user.id,
            )
            db.add(ledger_in)

        transfer.status = "COMPLETED"

    elif target_status == "CANCELLED":
        transfer.status = "CANCELLED"
    else:
        transfer.status = target_status

    if status_in.notes:
        transfer.notes = (transfer.notes or "") + f" | Status update: {status_in.notes}"

    db.commit()
    db.refresh(transfer)

    from_wh = db.query(Warehouse).filter(Warehouse.id == transfer.from_warehouse_id).first()
    to_wh = db.query(Warehouse).filter(Warehouse.id == transfer.to_warehouse_id).first()
    items_res = []
    for itm in transfer.items:
        item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
        items_res.append(
            StockTransferItemResponse(
                id=itm.id,
                transfer_id=itm.transfer_id,
                item_id=itm.item_id,
                quantity=Decimal(str(itm.quantity)),
                unit_cost=Decimal(str(itm.unit_cost)) if itm.unit_cost is not None else None,
                notes=itm.notes,
                item_name=item_obj.name if item_obj else None,
                item_code=item_obj.code if item_obj else None,
                unit_symbol=u.symbol if u else None,
            )
        )

    return StockTransferResponse(
        id=transfer.id,
        company_id=transfer.company_id,
        from_warehouse_id=transfer.from_warehouse_id,
        to_warehouse_id=transfer.to_warehouse_id,
        transfer_number=transfer.transfer_number,
        status=transfer.status.value if hasattr(transfer.status, "value") else str(transfer.status),
        transfer_date=transfer.transfer_date,
        notes=transfer.notes,
        created_by_id=transfer.created_by_id,
        from_warehouse_name=from_wh.name if from_wh else None,
        to_warehouse_name=to_wh.name if to_wh else None,
        items=items_res,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
    )


# =============================================================
# 6. PHYSICAL STOCK COUNT & VARIANCE RECONCILIATION
# =============================================================

@router.get("/stock-counts", response_model=List[StockCountResponse])
def get_stock_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    warehouse_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
):
    query = db.query(StockCount).filter(StockCount.company_id == current_user.company_id)
    if warehouse_id:
        query = query.filter(StockCount.warehouse_id == warehouse_id)
    if status_filter:
        query = query.filter(StockCount.status == status_filter)

    counts = query.order_by(StockCount.created_at.desc()).all()
    results = []
    for sc in counts:
        wh = db.query(Warehouse).filter(Warehouse.id == sc.warehouse_id).first()
        items_res = []
        tot_var = Decimal("0.0000")
        for itm in sc.items:
            item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
            u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
            var_val = Decimal(str(itm.variance_value or 0))
            tot_var += var_val
            items_res.append(
                StockCountItemResponse(
                    id=itm.id,
                    stock_count_id=itm.stock_count_id,
                    item_id=itm.item_id,
                    system_qty=Decimal(str(itm.system_qty)),
                    physical_qty=Decimal(str(itm.physical_qty)),
                    variance_qty=Decimal(str(itm.variance_qty)),
                    unit_cost=Decimal(str(itm.unit_cost)) if itm.unit_cost is not None else None,
                    variance_value=var_val,
                    batch_number=itm.batch_number,
                    remarks=itm.remarks,
                    item_name=item_obj.name if item_obj else None,
                    item_code=item_obj.code if item_obj else None,
                    unit_symbol=u.symbol if u else None,
                )
            )
        results.append(
            StockCountResponse(
                id=sc.id,
                company_id=sc.company_id,
                branch_id=sc.branch_id,
                warehouse_id=sc.warehouse_id,
                count_number=sc.count_number,
                count_date=sc.count_date,
                status=sc.status,
                created_by_id=sc.created_by_id,
                verified_by_id=sc.verified_by_id,
                notes=sc.notes,
                warehouse_name=wh.name if wh else None,
                items=items_res,
                total_variance_value=tot_var,
                created_at=sc.created_at,
                updated_at=sc.updated_at,
            )
        )
    return results

@router.post("/stock-counts", response_model=StockCountResponse, status_code=status.HTTP_201_CREATED)
def create_stock_count(
    count_in: StockCountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == count_in.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    cnt_num = count_in.count_number or f"CNT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    stock_count = StockCount(
        company_id=current_user.company_id,
        branch_id=count_in.branch_id or wh.branch_id,
        warehouse_id=count_in.warehouse_id,
        count_number=cnt_num,
        count_date=count_in.count_date or datetime.now(timezone.utc),
        status="DRAFT",
        created_by_id=current_user.id,
        notes=count_in.notes,
    )
    db.add(stock_count)
    db.flush()

    items_res = []
    tot_var = Decimal("0.0000")
    if count_in.items:
        for itm_in in count_in.items:
            item_obj = db.query(Item).filter(
                Item.id == itm_in.item_id,
                Item.company_id == current_user.company_id,
            ).first()
            if not item_obj:
                continue

            bal = db.query(StockBalance).filter(
                StockBalance.warehouse_id == count_in.warehouse_id,
                StockBalance.item_id == itm_in.item_id,
            ).first()
            sys_qty = itm_in.system_qty if itm_in.system_qty is not None else (Decimal(str(bal.quantity)) if bal else Decimal("0.0000"))
            phys_qty = itm_in.physical_qty
            var_qty = phys_qty - sys_qty
            unit_cost = itm_in.unit_cost if itm_in.unit_cost is not None else Decimal(str(item_obj.cost_price or 0))
            var_val = var_qty * unit_cost
            tot_var += var_val

            count_item = StockCountItem(
                stock_count_id=stock_count.id,
                item_id=itm_in.item_id,
                system_qty=sys_qty,
                physical_qty=phys_qty,
                variance_qty=var_qty,
                unit_cost=unit_cost,
                variance_value=var_val,
                batch_number=itm_in.batch_number,
                remarks=itm_in.remarks,
            )
            db.add(count_item)
            db.flush()

            u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first()
            items_res.append(
                StockCountItemResponse(
                    id=count_item.id,
                    stock_count_id=stock_count.id,
                    item_id=item_obj.id,
                    system_qty=sys_qty,
                    physical_qty=phys_qty,
                    variance_qty=var_qty,
                    unit_cost=unit_cost,
                    variance_value=var_val,
                    batch_number=count_item.batch_number,
                    remarks=count_item.remarks,
                    item_name=item_obj.name,
                    item_code=item_obj.code,
                    unit_symbol=u.symbol if u else None,
                )
            )

    db.commit()
    db.refresh(stock_count)

    return StockCountResponse(
        id=stock_count.id,
        company_id=stock_count.company_id,
        branch_id=stock_count.branch_id,
        warehouse_id=stock_count.warehouse_id,
        count_number=stock_count.count_number,
        count_date=stock_count.count_date,
        status=stock_count.status,
        created_by_id=stock_count.created_by_id,
        verified_by_id=stock_count.verified_by_id,
        notes=stock_count.notes,
        warehouse_name=wh.name,
        items=items_res,
        total_variance_value=tot_var,
        created_at=stock_count.created_at,
        updated_at=stock_count.updated_at,
    )

@router.get("/stock-counts/{count_id}", response_model=StockCountResponse)
def get_stock_count(
    count_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    sc = db.query(StockCount).filter(
        StockCount.id == count_id,
        StockCount.company_id == current_user.company_id,
    ).first()
    if not sc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock count not found")

    wh = db.query(Warehouse).filter(Warehouse.id == sc.warehouse_id).first()
    items_res = []
    tot_var = Decimal("0.0000")
    for itm in sc.items:
        item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
        var_val = Decimal(str(itm.variance_value or 0))
        tot_var += var_val
        items_res.append(
            StockCountItemResponse(
                id=itm.id,
                stock_count_id=itm.stock_count_id,
                item_id=itm.item_id,
                system_qty=Decimal(str(itm.system_qty)),
                physical_qty=Decimal(str(itm.physical_qty)),
                variance_qty=Decimal(str(itm.variance_qty)),
                unit_cost=Decimal(str(itm.unit_cost)) if itm.unit_cost is not None else None,
                variance_value=var_val,
                batch_number=itm.batch_number,
                remarks=itm.remarks,
                item_name=item_obj.name if item_obj else None,
                item_code=item_obj.code if item_obj else None,
                unit_symbol=u.symbol if u else None,
            )
        )

    return StockCountResponse(
        id=sc.id,
        company_id=sc.company_id,
        branch_id=sc.branch_id,
        warehouse_id=sc.warehouse_id,
        count_number=sc.count_number,
        count_date=sc.count_date,
        status=sc.status,
        created_by_id=sc.created_by_id,
        verified_by_id=sc.verified_by_id,
        notes=sc.notes,
        warehouse_name=wh.name if wh else None,
        items=items_res,
        total_variance_value=tot_var,
        created_at=sc.created_at,
        updated_at=sc.updated_at,
    )

@router.put("/stock-counts/{count_id}/submit", response_model=StockCountResponse)
def submit_stock_count(
    count_id: str,
    submit_in: StockCountSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    sc = db.query(StockCount).filter(
        StockCount.id == count_id,
        StockCount.company_id == current_user.company_id,
    ).first()
    if not sc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock count not found")

    if sc.status in ["APPROVED", "ADJUSTED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock count already in '{sc.status}' status")

    # Clear old items if updating
    db.query(StockCountItem).filter(StockCountItem.stock_count_id == sc.id).delete()

    items_res = []
    tot_var = Decimal("0.0000")
    for itm_in in submit_in.items:
        item_obj = db.query(Item).filter(
            Item.id == itm_in.item_id,
            Item.company_id == current_user.company_id,
        ).first()
        if not item_obj:
            continue

        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == sc.warehouse_id,
            StockBalance.item_id == itm_in.item_id,
        ).first()
        sys_qty = itm_in.system_qty if itm_in.system_qty is not None else (Decimal(str(bal.quantity)) if bal else Decimal("0.0000"))
        phys_qty = itm_in.physical_qty
        var_qty = phys_qty - sys_qty
        unit_cost = itm_in.unit_cost if itm_in.unit_cost is not None else Decimal(str(item_obj.cost_price or 0))
        var_val = var_qty * unit_cost
        tot_var += var_val

        count_item = StockCountItem(
            stock_count_id=sc.id,
            item_id=itm_in.item_id,
            system_qty=sys_qty,
            physical_qty=phys_qty,
            variance_qty=var_qty,
            unit_cost=unit_cost,
            variance_value=var_val,
            batch_number=itm_in.batch_number,
            remarks=itm_in.remarks,
        )
        db.add(count_item)
        db.flush()

        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first()
        items_res.append(
            StockCountItemResponse(
                id=count_item.id,
                stock_count_id=sc.id,
                item_id=item_obj.id,
                system_qty=sys_qty,
                physical_qty=phys_qty,
                variance_qty=var_qty,
                unit_cost=unit_cost,
                variance_value=var_val,
                batch_number=count_item.batch_number,
                remarks=count_item.remarks,
                item_name=item_obj.name,
                item_code=item_obj.code,
                unit_symbol=u.symbol if u else None,
            )
        )

    sc.status = "IN_PROGRESS"
    if submit_in.notes:
        sc.notes = (sc.notes or "") + f" | {submit_in.notes}"

    db.commit()
    db.refresh(sc)

    wh = db.query(Warehouse).filter(Warehouse.id == sc.warehouse_id).first()
    return StockCountResponse(
        id=sc.id,
        company_id=sc.company_id,
        branch_id=sc.branch_id,
        warehouse_id=sc.warehouse_id,
        count_number=sc.count_number,
        count_date=sc.count_date,
        status=sc.status,
        created_by_id=sc.created_by_id,
        verified_by_id=sc.verified_by_id,
        notes=sc.notes,
        warehouse_name=wh.name if wh else None,
        items=items_res,
        total_variance_value=tot_var,
        created_at=sc.created_at,
        updated_at=sc.updated_at,
    )

@router.put("/stock-counts/{count_id}/adjust", response_model=StockCountResponse)
def adjust_stock_count(
    count_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    sc = db.query(StockCount).filter(
        StockCount.id == count_id,
        StockCount.company_id == current_user.company_id,
    ).first()
    if not sc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock count not found")

    if sc.status == "COMPLETED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock count has already been adjusted into inventory")

    # Apply physical quantity to StockBalance and record StockLedger ADJUSTMENT
    tot_var = Decimal("0.0000")
    items_res = []
    for itm in sc.items:
        var_qty = Decimal(str(itm.variance_qty))
        phys_qty = Decimal(str(itm.physical_qty))
        unit_cost = Decimal(str(itm.unit_cost or 0))
        var_val = Decimal(str(itm.variance_value or (var_qty * unit_cost)))
        tot_var += var_val

        # Lock and update stock balance
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == sc.warehouse_id,
            StockBalance.item_id == itm.item_id,
        ).with_for_update().first()

        if not bal:
            bal = StockBalance(
                warehouse_id=sc.warehouse_id,
                item_id=itm.item_id,
                quantity=phys_qty,
            )
            db.add(bal)
            db.flush()
        else:
            bal.quantity = phys_qty

        # Write ADJUSTMENT ledger entry if there was variance
        if var_qty != 0:
            ledger = StockLedger(
                warehouse_id=sc.warehouse_id,
                item_id=itm.item_id,
                movement_type="ADJUSTMENT",
                change_qty=var_qty,
                balance_qty=phys_qty,
                unit_cost=unit_cost,
                total_cost=var_val,
                reference_type="STOCK_COUNT",
                reference_id=sc.id,
                notes=f"Physical Count Variance Reconciliation #{sc.count_number}: variance={var_qty}",
                created_by_id=current_user.id,
            )
            db.add(ledger)

        item_obj = db.query(Item).filter(Item.id == itm.item_id).first()
        u = db.query(Unit).filter(Unit.id == item_obj.unit_id).first() if item_obj else None
        items_res.append(
            StockCountItemResponse(
                id=itm.id,
                stock_count_id=sc.id,
                item_id=itm.item_id,
                system_qty=Decimal(str(itm.system_qty)),
                physical_qty=phys_qty,
                variance_qty=var_qty,
                unit_cost=unit_cost,
                variance_value=var_val,
                batch_number=itm.batch_number,
                remarks=itm.remarks,
                item_name=item_obj.name if item_obj else None,
                item_code=item_obj.code if item_obj else None,
                unit_symbol=u.symbol if u else None,
            )
        )

    sc.status = "COMPLETED"
    sc.verified_by_id = current_user.id
    db.commit()
    db.refresh(sc)

    wh = db.query(Warehouse).filter(Warehouse.id == sc.warehouse_id).first()
    return StockCountResponse(
        id=sc.id,
        company_id=sc.company_id,
        branch_id=sc.branch_id,
        warehouse_id=sc.warehouse_id,
        count_number=sc.count_number,
        count_date=sc.count_date,
        status=sc.status,
        created_by_id=sc.created_by_id,
        verified_by_id=sc.verified_by_id,
        notes=sc.notes,
        warehouse_name=wh.name if wh else None,
        items=items_res,
        total_variance_value=tot_var,
        created_at=sc.created_at,
        updated_at=sc.updated_at,
    )


# =============================================================
# 7. DIRECT STOCK ADJUSTMENT
# =============================================================

@router.post("/adjustments", response_model=StockAdjustmentResponse)
def adjust_stock_direct(
    adj_in: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == adj_in.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    item_obj = db.query(Item).filter(
        Item.id == adj_in.item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not item_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    # Lock stock balance
    bal = db.query(StockBalance).filter(
        StockBalance.warehouse_id == adj_in.warehouse_id,
        StockBalance.item_id == adj_in.item_id,
    ).with_for_update().first()

    if not bal:
        bal = StockBalance(
            warehouse_id=adj_in.warehouse_id,
            item_id=adj_in.item_id,
            quantity=Decimal("0.0000"),
        )
        db.add(bal)
        db.flush()

    new_qty = Decimal(str(bal.quantity)) + Decimal(str(adj_in.change_qty))
    bal.quantity = new_qty

    unit_cost = adj_in.unit_cost if adj_in.unit_cost is not None else Decimal(str(item_obj.cost_price or 0))
    total_cost = (Decimal(str(adj_in.change_qty)) * unit_cost).quantize(Decimal("0.0001"))

    # Log in stock ledger
    ledger = StockLedger(
        warehouse_id=adj_in.warehouse_id,
        item_id=adj_in.item_id,
        batch_number=adj_in.batch_number,
        expiry_date=adj_in.expiry_date,
        movement_type=adj_in.movement_type or "ADJUSTMENT",
        change_qty=adj_in.change_qty,
        balance_qty=new_qty,
        unit_cost=unit_cost,
        total_cost=total_cost,
        reference_type="DIRECT_ADJUSTMENT",
        reference_id=str(uuid.uuid4()),
        notes=f"Reason: {adj_in.reason}" + (f" | {adj_in.notes}" if adj_in.notes else ""),
        created_by_id=current_user.id,
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)

    return StockAdjustmentResponse(
        success=True,
        ledger_entry_id=ledger.id,
        warehouse_id=adj_in.warehouse_id,
        item_id=adj_in.item_id,
        change_qty=adj_in.change_qty,
        new_balance=new_qty,
        movement_type=adj_in.movement_type or "ADJUSTMENT",
        notes=adj_in.notes,
    )


# =============================================================
# 8. BATCH / LOT & EXPIRY TRACKING
# =============================================================

@router.get("/batches", response_model=List[StockBatchResponse])
def get_stock_batches(
    warehouse_id: Optional[str] = None,
    item_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = (
        db.query(StockBatch)
        .join(Warehouse, Warehouse.id == StockBatch.warehouse_id)
        .filter(Warehouse.company_id == current_user.company_id)
    )
    if warehouse_id:
        query = query.filter(StockBatch.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(StockBatch.item_id == item_id)
    if is_active is not None:
        query = query.filter(StockBatch.is_active == is_active)

    batches = query.order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.created_at.desc()).all()
    results = []
    now_dt = datetime.utcnow()
    for b in batches:
        wh = db.query(Warehouse).filter(Warehouse.id == b.warehouse_id).first()
        it = db.query(Item).filter(Item.id == b.item_id).first()
        unit = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None
        
        is_expired = False
        days_to_expiry = None
        if b.expiry_date:
            exp_date = b.expiry_date.date() if isinstance(b.expiry_date, datetime) else b.expiry_date
            diff = (exp_date - now_dt.date()).days
            days_to_expiry = diff
            is_expired = diff < 0

        qty = Decimal(str(b.quantity or 0))
        ucost = Decimal(str(b.unit_cost or 0))
        tot_cost = (qty * ucost).quantize(Decimal("0.0001"))

        results.append(
            StockBatchResponse(
                id=b.id,
                warehouse_id=b.warehouse_id,
                warehouse_name=wh.name if wh else None,
                item_id=b.item_id,
                item_name=it.name if it else None,
                item_code=it.code if it else None,
                unit_symbol=unit.symbol if unit else None,
                batch_number=b.batch_number,
                quantity=qty,
                unit_cost=ucost,
                total_cost=tot_cost,
                expiry_date=datetime.combine(b.expiry_date, datetime.min.time()) if isinstance(b.expiry_date, datetime) == False and b.expiry_date else b.expiry_date,
                mfg_date=datetime.combine(b.mfg_date, datetime.min.time()) if isinstance(b.mfg_date, datetime) == False and b.mfg_date else b.mfg_date,
                is_expired=is_expired,
                days_to_expiry=days_to_expiry,
                is_active=b.is_active,
                created_at=b.created_at,
                updated_at=b.updated_at,
            )
        )
    return results

@router.get("/batches/expiring", response_model=List[StockBatchResponse])
def get_expiring_batches(
    days: int = Query(30, description="Expiry threshold in days"),
    warehouse_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = (
        db.query(StockBatch)
        .join(Warehouse, Warehouse.id == StockBatch.warehouse_id)
        .filter(
            Warehouse.company_id == current_user.company_id,
            StockBatch.is_active == True,
            StockBatch.quantity > 0,
            StockBatch.expiry_date.isnot(None),
        )
    )
    if warehouse_id:
        query = query.filter(StockBatch.warehouse_id == warehouse_id)

    now_dt = datetime.utcnow()
    threshold_date = (now_dt + timedelta(days=days)).date()
    
    batches = query.order_by(StockBatch.expiry_date.asc()).all()
    results = []
    for b in batches:
        exp_date = b.expiry_date.date() if isinstance(b.expiry_date, datetime) else b.expiry_date
        if not exp_date:
            continue
        if exp_date <= threshold_date:
            wh = db.query(Warehouse).filter(Warehouse.id == b.warehouse_id).first()
            it = db.query(Item).filter(Item.id == b.item_id).first()
            unit = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None
            
            diff = (exp_date - now_dt.date()).days
            is_expired = diff < 0

            qty = Decimal(str(b.quantity or 0))
            ucost = Decimal(str(b.unit_cost or 0))
            tot_cost = (qty * ucost).quantize(Decimal("0.0001"))

            results.append(
                StockBatchResponse(
                    id=b.id,
                    warehouse_id=b.warehouse_id,
                    warehouse_name=wh.name if wh else None,
                    item_id=b.item_id,
                    item_name=it.name if it else None,
                    item_code=it.code if it else None,
                    unit_symbol=unit.symbol if unit else None,
                    batch_number=b.batch_number,
                    quantity=qty,
                    unit_cost=ucost,
                    total_cost=tot_cost,
                    expiry_date=datetime.combine(b.expiry_date, datetime.min.time()) if isinstance(b.expiry_date, datetime) == False and b.expiry_date else b.expiry_date,
                    mfg_date=datetime.combine(b.mfg_date, datetime.min.time()) if isinstance(b.mfg_date, datetime) == False and b.mfg_date else b.mfg_date,
                    is_expired=is_expired,
                    days_to_expiry=diff,
                    is_active=b.is_active,
                    created_at=b.created_at,
                    updated_at=b.updated_at,
                )
            )
    return results

@router.post("/batches", response_model=StockBatchResponse, status_code=status.HTTP_201_CREATED)
def create_stock_batch(
    batch_in: StockBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == batch_in.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    it = db.query(Item).filter(
        Item.id == batch_in.item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not it:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    existing = db.query(StockBatch).filter(
        StockBatch.warehouse_id == batch_in.warehouse_id,
        StockBatch.item_id == batch_in.item_id,
        func.lower(StockBatch.batch_number) == batch_in.batch_number.lower(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch number '{batch_in.batch_number}' already exists for this item in this warehouse",
        )

    exp_d = batch_in.expiry_date.date() if batch_in.expiry_date else None
    mfg_d = batch_in.mfg_date.date() if batch_in.mfg_date else None

    batch = StockBatch(
        warehouse_id=batch_in.warehouse_id,
        item_id=batch_in.item_id,
        batch_number=batch_in.batch_number.upper(),
        quantity=batch_in.quantity,
        unit_cost=batch_in.unit_cost,
        expiry_date=exp_d,
        mfg_date=mfg_d,
        is_active=batch_in.is_active,
    )
    db.add(batch)

    # If quantity > 0, update StockBalance and add StockLedger entry
    if batch_in.quantity > 0:
        bal = db.query(StockBalance).filter(
            StockBalance.warehouse_id == batch_in.warehouse_id,
            StockBalance.item_id == batch_in.item_id,
        ).with_for_update().first()
        if not bal:
            bal = StockBalance(
                warehouse_id=batch_in.warehouse_id,
                item_id=batch_in.item_id,
                quantity=Decimal("0.0000"),
            )
            db.add(bal)
            db.flush()

        new_bal = Decimal(str(bal.quantity)) + Decimal(str(batch_in.quantity))
        bal.quantity = new_bal

        tot_cost = (Decimal(str(batch_in.quantity)) * Decimal(str(batch_in.unit_cost))).quantize(Decimal("0.0001"))
        ledger = StockLedger(
            warehouse_id=batch_in.warehouse_id,
            item_id=batch_in.item_id,
            batch_number=batch.batch_number,
            expiry_date=batch_in.expiry_date,
            movement_type="GRN",
            change_qty=batch_in.quantity,
            balance_qty=new_bal,
            unit_cost=batch_in.unit_cost,
            total_cost=tot_cost,
            reference_type="BATCH_INITIALIZATION",
            reference_id=batch.id,
            notes=f"Initial stock for batch {batch.batch_number}",
            created_by_id=current_user.id,
        )
        db.add(ledger)

    db.commit()
    db.refresh(batch)

    unit = db.query(Unit).filter(Unit.id == it.unit_id).first()
    now_dt = datetime.utcnow()
    diff = (exp_d - now_dt.date()).days if exp_d else None

    return StockBatchResponse(
        id=batch.id,
        warehouse_id=batch.warehouse_id,
        warehouse_name=wh.name,
        item_id=batch.item_id,
        item_name=it.name,
        item_code=it.code,
        unit_symbol=unit.symbol if unit else None,
        batch_number=batch.batch_number,
        quantity=Decimal(str(batch.quantity or 0)),
        unit_cost=Decimal(str(batch.unit_cost or 0)),
        total_cost=(Decimal(str(batch.quantity or 0)) * Decimal(str(batch.unit_cost or 0))).quantize(Decimal("0.0001")),
        expiry_date=batch_in.expiry_date,
        mfg_date=batch_in.mfg_date,
        is_expired=diff < 0 if diff is not None else False,
        days_to_expiry=diff,
        is_active=batch.is_active,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )

@router.get("/batches/{id}", response_model=StockBatchResponse)
def get_stock_batch_by_id(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    batch = (
        db.query(StockBatch)
        .join(Warehouse, Warehouse.id == StockBatch.warehouse_id)
        .filter(
            StockBatch.id == id,
            Warehouse.company_id == current_user.company_id,
        )
        .first()
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock batch not found")

    wh = db.query(Warehouse).filter(Warehouse.id == batch.warehouse_id).first()
    it = db.query(Item).filter(Item.id == batch.item_id).first()
    unit = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None
    
    now_dt = datetime.utcnow()
    exp_d = batch.expiry_date.date() if isinstance(batch.expiry_date, datetime) else batch.expiry_date
    diff = (exp_d - now_dt.date()).days if exp_d else None

    return StockBatchResponse(
        id=batch.id,
        warehouse_id=batch.warehouse_id,
        warehouse_name=wh.name if wh else None,
        item_id=batch.item_id,
        item_name=it.name if it else None,
        item_code=it.code if it else None,
        unit_symbol=unit.symbol if unit else None,
        batch_number=batch.batch_number,
        quantity=Decimal(str(batch.quantity or 0)),
        unit_cost=Decimal(str(batch.unit_cost or 0)),
        total_cost=(Decimal(str(batch.quantity or 0)) * Decimal(str(batch.unit_cost or 0))).quantize(Decimal("0.0001")),
        expiry_date=datetime.combine(batch.expiry_date, datetime.min.time()) if isinstance(batch.expiry_date, datetime) == False and batch.expiry_date else batch.expiry_date,
        mfg_date=datetime.combine(batch.mfg_date, datetime.min.time()) if isinstance(batch.mfg_date, datetime) == False and batch.mfg_date else batch.mfg_date,
        is_expired=diff < 0 if diff is not None else False,
        days_to_expiry=diff,
        is_active=batch.is_active,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )

@router.put("/batches/{id}", response_model=StockBatchResponse)
def update_stock_batch(
    id: str,
    batch_in: StockBatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    batch = (
        db.query(StockBatch)
        .join(Warehouse, Warehouse.id == StockBatch.warehouse_id)
        .filter(
            StockBatch.id == id,
            Warehouse.company_id == current_user.company_id,
        )
        .first()
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock batch not found")

    if batch_in.quantity is not None:
        batch.quantity = batch_in.quantity
    if batch_in.unit_cost is not None:
        batch.unit_cost = batch_in.unit_cost
    if batch_in.expiry_date is not None:
        batch.expiry_date = batch_in.expiry_date.date() if isinstance(batch_in.expiry_date, datetime) else batch_in.expiry_date
    if batch_in.mfg_date is not None:
        batch.mfg_date = batch_in.mfg_date.date() if isinstance(batch_in.mfg_date, datetime) else batch_in.mfg_date
    if batch_in.is_active is not None:
        batch.is_active = batch_in.is_active

    db.commit()
    db.refresh(batch)

    wh = db.query(Warehouse).filter(Warehouse.id == batch.warehouse_id).first()
    it = db.query(Item).filter(Item.id == batch.item_id).first()
    unit = db.query(Unit).filter(Unit.id == it.unit_id).first() if it else None
    
    now_dt = datetime.utcnow()
    exp_d = batch.expiry_date.date() if isinstance(batch.expiry_date, datetime) else batch.expiry_date
    diff = (exp_d - now_dt.date()).days if exp_d else None

    return StockBatchResponse(
        id=batch.id,
        warehouse_id=batch.warehouse_id,
        warehouse_name=wh.name if wh else None,
        item_id=batch.item_id,
        item_name=it.name if it else None,
        item_code=it.code if it else None,
        unit_symbol=unit.symbol if unit else None,
        batch_number=batch.batch_number,
        quantity=Decimal(str(batch.quantity or 0)),
        unit_cost=Decimal(str(batch.unit_cost or 0)),
        total_cost=(Decimal(str(batch.quantity or 0)) * Decimal(str(batch.unit_cost or 0))).quantize(Decimal("0.0001")),
        expiry_date=datetime.combine(batch.expiry_date, datetime.min.time()) if isinstance(batch.expiry_date, datetime) == False and batch.expiry_date else batch.expiry_date,
        mfg_date=datetime.combine(batch.mfg_date, datetime.min.time()) if isinstance(batch.mfg_date, datetime) == False and batch.mfg_date else batch.mfg_date,
        is_expired=diff < 0 if diff is not None else False,
        days_to_expiry=diff,
        is_active=batch.is_active,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
    )

@router.delete("/batches/{id}", status_code=status.HTTP_200_OK)
def delete_stock_batch(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    batch = (
        db.query(StockBatch)
        .join(Warehouse, Warehouse.id == StockBatch.warehouse_id)
        .filter(
            StockBatch.id == id,
            Warehouse.company_id == current_user.company_id,
        )
        .first()
    )
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock batch not found")

    batch.is_active = False
    db.commit()
    return {"success": True, "message": f"Batch '{batch.batch_number}' deactivated"}


# =============================================================
# 9. STORE LOCATIONS (AISLE/RACK/SHELF/BIN)
# =============================================================

@router.get("/store-locations", response_model=List[StoreLocationResponse])
def get_store_locations(
    warehouse_id: Optional[str] = None,
    item_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = (
        db.query(StoreLocation)
        .join(Warehouse, Warehouse.id == StoreLocation.warehouse_id)
        .filter(Warehouse.company_id == current_user.company_id)
    )
    if warehouse_id:
        query = query.filter(StoreLocation.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(StoreLocation.item_id == item_id)

    locations = query.order_by(StoreLocation.aisle.asc(), StoreLocation.rack.asc()).all()
    results = []
    for loc in locations:
        wh = db.query(Warehouse).filter(Warehouse.id == loc.warehouse_id).first()
        it = db.query(Item).filter(Item.id == loc.item_id).first() if loc.item_id else None
        results.append(
            StoreLocationResponse(
                id=loc.id,
                warehouse_id=loc.warehouse_id,
                warehouse_name=wh.name if wh else None,
                item_id=loc.item_id,
                item_name=it.name if it else None,
                item_code=it.code if it else None,
                aisle=loc.aisle,
                rack=loc.rack,
                shelf=loc.shelf,
                bin=loc.bin,
                capacity=loc.capacity,
                created_at=loc.created_at,
                updated_at=loc.updated_at,
            )
        )
    return results

@router.post("/store-locations", response_model=StoreLocationResponse, status_code=status.HTTP_201_CREATED)
def create_store_location(
    loc_in: StoreLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == loc_in.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    if loc_in.item_id:
        it = db.query(Item).filter(
            Item.id == loc_in.item_id,
            Item.company_id == current_user.company_id,
        ).first()
        if not it:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    loc = StoreLocation(
        warehouse_id=loc_in.warehouse_id,
        item_id=loc_in.item_id,
        aisle=loc_in.aisle,
        rack=loc_in.rack,
        shelf=loc_in.shelf,
        bin=loc_in.bin,
        capacity=loc_in.capacity,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)

    it = db.query(Item).filter(Item.id == loc.item_id).first() if loc.item_id else None

    return StoreLocationResponse(
        id=loc.id,
        warehouse_id=loc.warehouse_id,
        warehouse_name=wh.name,
        item_id=loc.item_id,
        item_name=it.name if it else None,
        item_code=it.code if it else None,
        aisle=loc.aisle,
        rack=loc.rack,
        shelf=loc.shelf,
        bin=loc.bin,
        capacity=loc.capacity,
        created_at=loc.created_at,
        updated_at=loc.updated_at,
    )

@router.put("/store-locations/{id}", response_model=StoreLocationResponse)
def update_store_location(
    id: str,
    loc_in: StoreLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    loc = (
        db.query(StoreLocation)
        .join(Warehouse, Warehouse.id == StoreLocation.warehouse_id)
        .filter(
            StoreLocation.id == id,
            Warehouse.company_id == current_user.company_id,
        )
        .first()
    )
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store location not found")

    if loc_in.item_id is not None:
        loc.item_id = loc_in.item_id
    if loc_in.aisle is not None:
        loc.aisle = loc_in.aisle
    if loc_in.rack is not None:
        loc.rack = loc_in.rack
    if loc_in.shelf is not None:
        loc.shelf = loc_in.shelf
    if loc_in.bin is not None:
        loc.bin = loc_in.bin
    if loc_in.capacity is not None:
        loc.capacity = loc_in.capacity

    db.commit()
    db.refresh(loc)

    wh = db.query(Warehouse).filter(Warehouse.id == loc.warehouse_id).first()
    it = db.query(Item).filter(Item.id == loc.item_id).first() if loc.item_id else None

    return StoreLocationResponse(
        id=loc.id,
        warehouse_id=loc.warehouse_id,
        warehouse_name=wh.name if wh else None,
        item_id=loc.item_id,
        item_name=it.name if it else None,
        item_code=it.code if it else None,
        aisle=loc.aisle,
        rack=loc.rack,
        shelf=loc.shelf,
        bin=loc.bin,
        capacity=loc.capacity,
        created_at=loc.created_at,
        updated_at=loc.updated_at,
    )

@router.delete("/store-locations/{id}", status_code=status.HTTP_200_OK)
def delete_store_location(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    loc = (
        db.query(StoreLocation)
        .join(Warehouse, Warehouse.id == StoreLocation.warehouse_id)
        .filter(
            StoreLocation.id == id,
            Warehouse.company_id == current_user.company_id,
        )
        .first()
    )
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store location not found")

    db.delete(loc)
    db.commit()
    return {"success": True, "message": "Store location deleted"}


# =============================================================
# 10. FIFO / FEFO PICKING & CONSUMPTION ENGINE
# =============================================================

@router.post("/picking/suggest", response_model=PickingSuggestResponse)
def suggest_picking_allocation(
    req: PickingSuggestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == req.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    it = db.query(Item).filter(
        Item.id == req.item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not it:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    query = db.query(StockBatch).filter(
        StockBatch.warehouse_id == req.warehouse_id,
        StockBatch.item_id == req.item_id,
        StockBatch.is_active == True,
        StockBatch.quantity > 0,
    )

    strat = req.strategy.upper() if req.strategy else "FEFO"
    if strat == "FEFO":
        batches = query.order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.created_at.asc()).all()
    else:
        batches = query.order_by(StockBatch.mfg_date.asc().nullslast(), StockBatch.created_at.asc()).all()

    remaining_needed = Decimal(str(req.requested_qty))
    allocations = []
    total_allocated = Decimal("0.0000")
    total_est_cost = Decimal("0.0000")

    for b in batches:
        if remaining_needed <= Decimal("0.0000"):
            break

        b_qty = Decimal(str(b.quantity))
        take_qty = min(remaining_needed, b_qty)
        unit_cost = Decimal(str(b.unit_cost or it.cost_price or 0))
        line_cost = (take_qty * unit_cost).quantize(Decimal("0.0001"))

        allocations.append(
            PickingAllocationItem(
                batch_id=b.id,
                batch_number=b.batch_number,
                expiry_date=datetime.combine(b.expiry_date, datetime.min.time()) if isinstance(b.expiry_date, datetime) == False and b.expiry_date else b.expiry_date,
                mfg_date=datetime.combine(b.mfg_date, datetime.min.time()) if isinstance(b.mfg_date, datetime) == False and b.mfg_date else b.mfg_date,
                available_qty=b_qty,
                allocated_qty=take_qty,
                unit_cost=unit_cost,
                line_cost=line_cost,
            )
        )

        total_allocated += take_qty
        total_est_cost += line_cost
        remaining_needed -= take_qty

    shortage = max(Decimal("0.0000"), Decimal(str(req.requested_qty)) - total_allocated)
    is_fully = (shortage == Decimal("0.0000"))

    return PickingSuggestResponse(
        warehouse_id=req.warehouse_id,
        item_id=req.item_id,
        item_name=it.name,
        requested_qty=req.requested_qty,
        strategy=strat,
        is_fully_allocated=is_fully,
        total_allocated_qty=total_allocated,
        shortage_qty=shortage,
        total_estimated_cost=total_est_cost,
        allocations=allocations,
    )

@router.post("/picking/consume", response_model=PickingConsumeResponse)
def execute_picking_consumption(
    req: PickingConsumeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh = db.query(Warehouse).filter(
        Warehouse.id == req.warehouse_id,
        Warehouse.company_id == current_user.company_id,
    ).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    it = db.query(Item).filter(
        Item.id == req.item_id,
        Item.company_id == current_user.company_id,
    ).first()
    if not it:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    # Lock stock balance
    bal = db.query(StockBalance).filter(
        StockBalance.warehouse_id == req.warehouse_id,
        StockBalance.item_id == req.item_id,
    ).with_for_update().first()

    if not bal or Decimal(str(bal.quantity)) < Decimal(str(req.requested_qty)):
        current_bal = Decimal(str(bal.quantity)) if bal else Decimal("0.0000")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient inventory for {it.name}. Available: {current_bal}, Requested: {req.requested_qty}",
        )

    # Get active batches with for update
    query = db.query(StockBatch).filter(
        StockBatch.warehouse_id == req.warehouse_id,
        StockBatch.item_id == req.item_id,
        StockBatch.is_active == True,
        StockBatch.quantity > 0,
    ).with_for_update()

    strat = req.strategy.upper() if req.strategy else "FEFO"
    if strat == "FEFO":
        batches = query.order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.created_at.asc()).all()
    else:
        batches = query.order_by(StockBatch.mfg_date.asc().nullslast(), StockBatch.created_at.asc()).all()

    remaining_needed = Decimal(str(req.requested_qty))
    consumed_allocations = []
    total_cost = Decimal("0.0000")
    total_consumed = Decimal("0.0000")

    # Deduct from batches
    for b in batches:
        if remaining_needed <= Decimal("0.0000"):
            break

        b_qty = Decimal(str(b.quantity))
        take_qty = min(remaining_needed, b_qty)
        unit_cost = Decimal(str(b.unit_cost or it.cost_price or 0))
        line_cost = (take_qty * unit_cost).quantize(Decimal("0.0001"))

        b.quantity = b_qty - take_qty
        if b.quantity == Decimal("0.0000"):
            b.is_active = False

        consumed_allocations.append(
            PickingAllocationItem(
                batch_id=b.id,
                batch_number=b.batch_number,
                expiry_date=datetime.combine(b.expiry_date, datetime.min.time()) if isinstance(b.expiry_date, datetime) == False and b.expiry_date else b.expiry_date,
                mfg_date=datetime.combine(b.mfg_date, datetime.min.time()) if isinstance(b.mfg_date, datetime) == False and b.mfg_date else b.mfg_date,
                available_qty=b_qty,
                allocated_qty=take_qty,
                unit_cost=unit_cost,
                line_cost=line_cost,
            )
        )

        total_consumed += take_qty
        total_cost += line_cost
        remaining_needed -= take_qty

        # Log individual batch deduction in stock ledger
        ledger_entry = StockLedger(
            warehouse_id=req.warehouse_id,
            item_id=req.item_id,
            batch_number=b.batch_number,
            expiry_date=datetime.combine(b.expiry_date, datetime.min.time()) if isinstance(b.expiry_date, datetime) == False and b.expiry_date else b.expiry_date,
            movement_type=req.movement_type or "PRODUCTION_OUT",
            change_qty=-take_qty,
            balance_qty=Decimal(str(bal.quantity)) - total_consumed,
            unit_cost=unit_cost,
            total_cost=-line_cost,
            reference_type=req.reference_type or "PICKING_ORDER",
            reference_id=req.reference_id or str(uuid.uuid4()),
            notes=f"{strat} Picking Consumption: {take_qty} from batch {b.batch_number}" + (f" | {req.notes}" if req.notes else ""),
            created_by_id=current_user.id,
        )
        db.add(ledger_entry)

    # Deduct from overall warehouse balance
    new_balance = Decimal(str(bal.quantity)) - total_consumed
    bal.quantity = new_balance

    db.commit()

    return PickingConsumeResponse(
        success=True,
        warehouse_id=req.warehouse_id,
        item_id=req.item_id,
        total_consumed_qty=total_consumed,
        total_cost=total_cost,
        new_warehouse_balance=new_balance,
        movement_type=req.movement_type or "PRODUCTION_OUT",
        allocations=consumed_allocations,
    )


# =============================================================
# 11. AUTOMATED REORDER RECOMMENDATIONS ENGINE
# =============================================================

@router.get("/reorder-recommendations", response_model=ReorderRecommendationResponse)
def get_reorder_recommendations(
    warehouse_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = (
        db.query(StockBalance, Warehouse, Item, Unit)
        .join(Warehouse, Warehouse.id == StockBalance.warehouse_id)
        .join(Item, Item.id == StockBalance.item_id)
        .outerjoin(Unit, Unit.id == Item.unit_id)
        .filter(
            Warehouse.company_id == current_user.company_id,
            Item.is_active == True,
        )
    )
    if warehouse_id:
        query = query.filter(StockBalance.warehouse_id == warehouse_id)

    records = query.all()
    recommendations = []
    total_est_cost = Decimal("0.0000")

    for bal, wh, it, u in records:
        cur_qty = Decimal(str(bal.quantity or 0))
        min_level = Decimal(str(bal.min_stock_level or it.min_stock_level or 0))
        reorder_qty = Decimal(str(bal.reorder_qty or it.reorder_qty or 0))

        if min_level > 0 and cur_qty <= min_level:
            suggested_qty = max(reorder_qty, (min_level * 2) - cur_qty)
            if suggested_qty <= Decimal("0.0000"):
                suggested_qty = reorder_qty if reorder_qty > 0 else Decimal("10.0000")

            unit_cost = Decimal(str(it.cost_price or 0))
            tot_cost = (suggested_qty * unit_cost).quantize(Decimal("0.0001"))

            if cur_qty <= Decimal("0.0000"):
                urgency = "CRITICAL"
            elif cur_qty < (min_level * Decimal("0.5")):
                urgency = "HIGH"
            else:
                urgency = "MEDIUM"

            recommendations.append(
                ReorderRecommendationItem(
                    warehouse_id=wh.id,
                    warehouse_name=wh.name,
                    item_id=it.id,
                    item_name=it.name,
                    item_code=it.code,
                    unit_symbol=u.symbol if u else None,
                    current_stock=cur_qty,
                    min_stock_level=min_level,
                    reorder_qty=reorder_qty,
                    suggested_order_qty=suggested_qty,
                    estimated_unit_cost=unit_cost,
                    estimated_total_cost=tot_cost,
                    urgency_level=urgency,
                )
            )
            total_est_cost += tot_cost

    # Sort recommendations by urgency: CRITICAL first, then HIGH, then MEDIUM
    urgency_weights = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    recommendations.sort(key=lambda x: (urgency_weights.get(x.urgency_level, 3), -x.estimated_total_cost))

    return ReorderRecommendationResponse(
        total_items_to_reorder=len(recommendations),
        total_estimated_replenishment_cost=total_est_cost,
        recommendations=recommendations,
    )


# =============================================================
# 12. ENTERPRISE INVENTORY VALUATION ENGINE
# =============================================================

@router.get("/valuation", response_model=InventoryValuationResponse)
def get_inventory_valuation(
    warehouse_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    wh_query = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id, Warehouse.is_active == True)
    if warehouse_id:
        wh_query = wh_query.filter(Warehouse.id == warehouse_id)
    warehouses = wh_query.all()
    wh_ids = [w.id for w in warehouses]

    balances = (
        db.query(StockBalance, Item, Category, Unit)
        .join(Item, Item.id == StockBalance.item_id)
        .join(Category, Category.id == Item.category_id)
        .outerjoin(Unit, Unit.id == Item.unit_id)
        .filter(
            StockBalance.warehouse_id.in_(wh_ids),
            Item.company_id == current_user.company_id,
        )
        .all()
    )

    batches = (
        db.query(StockBatch)
        .filter(
            StockBatch.warehouse_id.in_(wh_ids),
            StockBatch.is_active == True,
            StockBatch.quantity > 0,
        )
        .all()
    )

    batch_map = {}
    for b in batches:
        key = (b.warehouse_id, b.item_id)
        if key not in batch_map:
            batch_map[key] = []
        batch_map[key].append(b)

    wh_stats = {w.id: {"name": w.name, "items": set(), "qty": Decimal("0.0000"), "fifo_val": Decimal("0.0000"), "avg_val": Decimal("0.0000")} for w in warehouses}
    cat_stats = {}
    item_stats = {}

    for bal, it, cat, u in balances:
        qty = Decimal(str(bal.quantity or 0))
        if qty <= Decimal("0.0000"):
            continue

        item_cost = Decimal(str(it.cost_price or 0))
        key = (bal.warehouse_id, bal.item_id)
        it_batches = batch_map.get(key, [])

        batch_qty_sum = sum(Decimal(str(b.quantity)) for b in it_batches)
        fifo_val = sum((Decimal(str(b.quantity)) * Decimal(str(b.unit_cost))).quantize(Decimal("0.0001")) for b in it_batches)
        
        if qty > batch_qty_sum:
            fifo_val += ((qty - batch_qty_sum) * item_cost).quantize(Decimal("0.0001"))

        avg_val = (qty * item_cost).quantize(Decimal("0.0001"))

        if bal.warehouse_id in wh_stats:
            wh_stats[bal.warehouse_id]["items"].add(it.id)
            wh_stats[bal.warehouse_id]["qty"] += qty
            wh_stats[bal.warehouse_id]["fifo_val"] += fifo_val
            wh_stats[bal.warehouse_id]["avg_val"] += avg_val

        if cat.id not in cat_stats:
            cat_stats[cat.id] = {"name": cat.name, "items": set(), "qty": Decimal("0.0000"), "val": Decimal("0.0000")}
        cat_stats[cat.id]["items"].add(it.id)
        cat_stats[cat.id]["qty"] += qty
        cat_stats[cat.id]["val"] += fifo_val

        if it.id not in item_stats:
            item_stats[it.id] = {
                "name": it.name,
                "code": it.code,
                "category_name": cat.name,
                "unit_symbol": u.symbol if u else None,
                "qty": Decimal("0.0000"),
                "avg_cost": item_cost,
                "val": Decimal("0.0000"),
                "batch_count": 0,
            }
        item_stats[it.id]["qty"] += qty
        item_stats[it.id]["val"] += fifo_val
        item_stats[it.id]["batch_count"] += len(it_batches)

    wh_list = [
        WarehouseValuationItem(
            warehouse_id=w_id,
            warehouse_name=data["name"],
            total_items_count=len(data["items"]),
            total_stock_quantity=data["qty"],
            fifo_batch_value=data["fifo_val"],
            weighted_avg_value=data["avg_val"],
        )
        for w_id, data in wh_stats.items()
        if data["qty"] > 0 or len(data["items"]) > 0
    ]

    cat_list = [
        CategoryValuationItem(
            category_id=c_id,
            category_name=data["name"],
            total_items_count=len(data["items"]),
            total_stock_quantity=data["qty"],
            valuation_amount=data["val"],
        )
        for c_id, data in cat_stats.items()
    ]

    item_list = [
        ItemValuationItem(
            item_id=i_id,
            item_name=data["name"],
            item_code=data["code"],
            category_name=data["category_name"],
            unit_symbol=data["unit_symbol"],
            total_quantity=data["qty"],
            avg_unit_cost=data["avg_cost"],
            total_value=data["val"],
            active_batches_count=data["batch_count"],
        )
        for i_id, data in item_stats.items()
    ]

    total_val = sum(w.fifo_batch_value for w in wh_list)

    return InventoryValuationResponse(
        company_id=current_user.company_id,
        total_inventory_value=total_val,
        total_skus=len(item_list),
        warehouses=wh_list,
        categories=cat_list,
        items=item_list,
    )


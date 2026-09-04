"""
Food Cost API Endpoints.

Access rules
------------
Every endpoint requires Admin authorization. Non-admin users receive HTTP 403
and can never retrieve configuration, calculation results, or history through
the API - the frontend route hiding is only a convenience, not a control.

Public surface (Main page)
--------------------------
- GET /food-cost/config     -> enabled mark-up options ONLY (never the private
                               management-cost configuration)
- POST /food-cost/calculate -> ingredient cost, management cost TOTAL,
                               total cost, selected mark-up, final selling cost

Admin surface (Settings)
------------------------
- GET/PUT /food-cost/admin/config -> full private configuration
- POST /food-cost/save            -> immutable snapshot with idempotency
- GET /food-cost/snapshots        -> saved history
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.models.user import User
from app.models.food_cost import (
    FoodCostConfig,
    FoodCostCostHead,
    FoodCostMarkupOption,
    FoodCostSnapshot,
)
from app.schemas.food_cost import (
    FoodCostConfigAdminResponse,
    FoodCostConfigPublicResponse,
    FoodCostConfigUpdate,
    FoodCostCalculationRequest,
    FoodCostCalculationResponse,
    FoodCostCostHeadResponse,
    FoodCostIngredientResult,
    FoodCostMarkupOptionResponse,
    FoodCostSaveRequest,
    FoodCostSnapshotList,
    FoodCostSnapshotResponse,
)
from app.services.food_cost import (
    _get_or_create_config,
    calculate_food_cost,
    calculate_selling_cost,
    get_management_cost_percentage,
    save_food_cost_snapshot,
    validate_markup_percentage,
)

router = APIRouter()

_ADMIN_ROLES = {
    "SUPER_ADMIN",
    "SUPERADMIN",
    "OWNER",
    "ADMIN",
    "HQ_ADMIN",
    "HEAD_OFFICE_ADMIN",
    "GENERAL_MANAGER",
    "DIRECTOR",
}


def _is_admin(user: User) -> bool:
    role = (user.role.name if user.role else "").strip().upper()
    return role in _ADMIN_ROLES


def _require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Backend enforcement: Food Cost is ADMIN ONLY."""
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Food Cost is restricted to Admin users.",
        )
    return current_user


def _as_public_config(db: Session, user: User) -> FoodCostConfigPublicResponse:
    config = _get_or_create_config(db, user.company_id)
    return FoodCostConfigPublicResponse(
        id=config.id,
        company_id=config.company_id,
        active_markup_options=[
            FoodCostMarkupOptionResponse(
                id=mo.id,
                config_id=mo.config_id,
                label=mo.label,
                percentage=mo.percentage,
                is_active=mo.is_active,
                sort_order=mo.display_order,
            )
            for mo in config.markup_options
            if mo.is_active
        ],
    )
# ==============================================================
# MAIN PAGE ENDPOINTS
# ==============================================================
@router.get("/config", response_model=FoodCostConfigPublicResponse)
def get_public_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Public Main-page config: enabled mark-up options only. Private
    management-cost configuration is NEVER returned here."""
    return _as_public_config(db, current_user)


@router.post("/calculate", response_model=FoodCostCalculationResponse)
def calculate_food_cost_endpoint(
    request: FoodCostCalculationRequest,
    markup_percentage: Optional[Decimal] = Query(None, ge=0, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Run a Food Cost calculation.

    Response contains ONLY:
      ingredient lines, ingredient cost, management cost TOTAL,
      total cost, selected mark-up, final selling cost.
    It NEVER contains management-cost heads/percentages (private).
    """
    try:
        result = calculate_food_cost(
            db=db,
            company_id=current_user.company_id,
            ingredients=[ing.model_dump() for ing in request.ingredients],
            calculation_date=request.calculation_date,
        )

        selected_markup: Optional[Decimal] = None
        final_selling_cost: Optional[Decimal] = None
        if markup_percentage is not None:
            selected_markup = Decimal(str(markup_percentage)).quantize(
                Decimal("0.0001")
            )
            validate_markup_percentage(db, current_user.company_id, selected_markup)
            final_selling_cost = calculate_selling_cost(
                result["total_cost"], selected_markup
            )

        return FoodCostCalculationResponse(
            ingredients=[
                FoodCostIngredientResult(**ing) for ing in result["ingredients"]
            ],
            ingredient_cost=result["ingredient_cost"],
            management_cost=result["management_cost"],
            total_cost=result["total_cost"],
            selected_markup=selected_markup,
            final_selling_cost=final_selling_cost,
            calculation_date=result["calculation_date"],
            idempotency_key=request.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Food Cost calculation failed: {exc}",
        )
# ==============================================================
# HISTORY / SNAPSHOT ENDPOINTS
# ==============================================================
@router.post("/save", response_model=FoodCostSnapshotResponse, status_code=201)
def save_food_cost_endpoint(
    request: FoodCostSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Calculate AND persist an immutable snapshot.

    Duplicate protection: re-sending the same ``idempotency_key`` returns the
    already-saved record instead of creating a second financial record.
    """
    try:
        result = calculate_food_cost(
            db=db,
            company_id=current_user.company_id,
            ingredients=[ing.model_dump() for ing in request.ingredients],
            calculation_date=request.calculation_date,
        )
        selected_markup: Optional[Decimal] = None
        if request.markup_percentage is not None:
            selected_markup = Decimal(str(request.markup_percentage)).quantize(
                Decimal("0.0001")
            )
            validate_markup_percentage(
                db, current_user.company_id, selected_markup
            )

        snapshot = save_food_cost_snapshot(
            db=db,
            company_id=current_user.company_id,
            calculation_result=result,
            selected_markup=selected_markup,
            idempotency_key=request.idempotency_key,
            created_by_id=current_user.id,
        )
        db.commit()
        db.refresh(snapshot)
        return FoodCostSnapshotResponse(
            id=snapshot.id,
            company_id=snapshot.company_id,
            config_id=snapshot.config_id,
            calculation_date=snapshot.calculation_date,
            idempotency_key=snapshot.idempotency_key,
            snapshot_data={
                "ingredient_cost": str(snapshot.ingredient_cost),
                "management_cost": str(snapshot.management_cost_total),
                "management_cost_percentage": str(
                    snapshot.management_cost_percentage
                ),
                "total_cost": str(snapshot.total_cost),
                "selected_markup_percentage": (
                    str(snapshot.selected_markup_percentage)
                    if snapshot.selected_markup_percentage is not None
                    else None
                ),
                "final_selling_cost": str(snapshot.final_selling_cost),
                "effective_date": (
                    snapshot.effective_date.isoformat()
                    if snapshot.effective_date
                    else None
                ),
                "ingredient_lines": snapshot.ingredient_lines,
            },
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Food Cost save failed: {exc}",
        )


@router.get("/snapshots", response_model=FoodCostSnapshotList)
def list_food_cost_snapshots(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Saved Food Cost history for this company (admin only)."""
    query = db.query(FoodCostSnapshot).filter(
        FoodCostSnapshot.company_id == current_user.company_id
    )
    total = query.count()
    snapshots = (
        query.order_by(FoodCostSnapshot.calculation_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return FoodCostSnapshotList(
        snapshots=[
            FoodCostSnapshotResponse(
                id=s.id,
                company_id=s.company_id,
                config_id=s.config_id,
                calculation_date=s.calculation_date,
                idempotency_key=s.idempotency_key,
                snapshot_data={
                    "ingredient_cost": str(s.ingredient_cost),
                    "management_cost": str(s.management_cost_total),
                    "total_cost": str(s.total_cost),
                    "selected_markup_percentage": (
                        str(s.selected_markup_percentage)
                        if s.selected_markup_percentage is not None
                        else None
                    ),
                    "final_selling_cost": str(s.final_selling_cost),
                    "effective_date": (
                        s.effective_date.isoformat() if s.effective_date else None
                    ),
                    "ingredient_lines": s.ingredient_lines,
                },
            )
            for s in snapshots
        ],
        total=total,
    )
# ==============================================================
# ADMIN SETTINGS ENDPOINTS (private configuration)
# ==============================================================
@router.get("/admin/config", response_model=FoodCostConfigAdminResponse)
def get_admin_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Admin-only read of the private management-cost configuration."""
    config = _get_or_create_config(db, current_user.company_id)
    return FoodCostConfigAdminResponse(
        id=config.id,
        company_id=config.company_id,
        management_cost_percentage=get_management_cost_percentage(config),
        cost_heads=[
            FoodCostCostHeadResponse(
                id=ch.id,
                config_id=ch.config_id,
                name=ch.name,
                percentage=ch.percentage,
                is_active=ch.is_active,
                sort_order=ch.display_order,
            )
            for ch in config.cost_heads
        ],
        markup_options=[
            FoodCostMarkupOptionResponse(
                id=mo.id,
                config_id=mo.config_id,
                label=mo.label,
                percentage=mo.percentage,
                is_active=mo.is_active,
                sort_order=mo.display_order,
            )
            for mo in config.markup_options
        ],
    )


@router.put("/admin/config", response_model=FoodCostConfigAdminResponse)
def update_admin_config(
    payload: FoodCostConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Admin-only update of the private configuration.

    Existing snapshots are never touched; this changes the configuration used
    by NEW calculations only.
    """
    config = _get_or_create_config(db, current_user.company_id)

    # Update cost heads
    if payload.cost_heads is not None:
        existing_ids = {ch.id for ch in config.cost_heads}
        submitted_ids = {ch.id for ch in payload.cost_heads if ch.id}
        for ch_update in payload.cost_heads:
            if ch_update.id:
                head = next(
                    (ch for ch in config.cost_heads if ch.id == ch_update.id),
                    None,
                )
                if head:
                    if ch_update.name is not None:
                        head.name = ch_update.name
                    if ch_update.percentage is not None:
                        head.percentage = ch_update.percentage
                    if ch_update.is_active is not None:
                        head.is_active = ch_update.is_active
                    if ch_update.sort_order is not None:
                        head.display_order = ch_update.sort_order
            else:
                db.add(
                    FoodCostCostHead(
                        config_id=config.id,
                        name=ch_update.name or "Cost Head",
                        percentage=ch_update.percentage or Decimal("0.0000"),
                        is_active=(
                            ch_update.is_active
                            if ch_update.is_active is not None
                            else True
                        ),
                        display_order=(
                            ch_update.sort_order
                            if ch_update.sort_order is not None
                            else 0
                        ),
                    )
                )
        # Remove heads deleted by the client
        for head_id in existing_ids - submitted_ids:
            head = next(
                (ch for ch in config.cost_heads if ch.id == head_id), None
            )
            if head:
                db.delete(head)

    # Update markup options
    if payload.markup_options is not None:
        existing_ids = {mo.id for mo in config.markup_options}
        submitted_ids = {mo.id for mo in payload.markup_options if mo.id}
        for mo_update in payload.markup_options:
            if mo_update.id:
                opt = next(
                    (mo for mo in config.markup_options if mo.id == mo_update.id),
                    None,
                )
                if opt:
                    if mo_update.label is not None:
                        opt.label = mo_update.label
                    if mo_update.percentage is not None:
                        opt.percentage = mo_update.percentage
                    if mo_update.is_active is not None:
                        opt.is_active = mo_update.is_active
                    if mo_update.sort_order is not None:
                        opt.display_order = mo_update.sort_order
            else:
                db.add(
                    FoodCostMarkupOption(
                        config_id=config.id,
                        label=mo_update.label or f"{mo_update.percentage}%",
                        percentage=mo_update.percentage or Decimal("0.0000"),
                        is_active=(
                            mo_update.is_active
                            if mo_update.is_active is not None
                            else True
                        ),
                        display_order=(
                            mo_update.sort_order
                            if mo_update.sort_order is not None
                            else 0
                        ),
                    )
                )
        for opt_id in existing_ids - submitted_ids:
            opt = next(
                (mo for mo in config.markup_options if mo.id == opt_id), None
            )
            if opt:
                db.delete(opt)

    db.commit()
    db.refresh(config)
    return FoodCostConfigAdminResponse(
        id=config.id,
        company_id=config.company_id,
        management_cost_percentage=get_management_cost_percentage(config),
        cost_heads=[
            FoodCostCostHeadResponse(
                id=ch.id,
                config_id=ch.config_id,
                name=ch.name,
                percentage=ch.percentage,
                is_active=ch.is_active,
                sort_order=ch.display_order,
            )
            for ch in config.cost_heads
        ],
        markup_options=[
            FoodCostMarkupOptionResponse(
                id=mo.id,
                config_id=mo.config_id,
                label=mo.label,
                percentage=mo.percentage,
                is_active=mo.is_active,
                sort_order=mo.display_order,
            )
            for mo in config.markup_options
        ],
    )
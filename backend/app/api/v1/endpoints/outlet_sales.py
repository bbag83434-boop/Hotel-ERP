from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.exceptions import AppException
from app.api.v1.endpoints.auth import get_current_active_user
from app.models.user import User
from app.models.organization import Branch
from app.models.outlet_sales import OutletSale
from app.schemas.outlet_sales import (
    OutletSaleCreate,
    OutletSalePreviewRequest,
    OutletSalePreviewResponse,
    OutletSaleSchema,
)
from app.services.outlet_sales import OutletSalesService


# IMPORTANT:
# This is the API ROUTER file.
# The business logic stays in app/services/outlet_sales.py.
# Frontend calls: /api/v1/outlet-sales/...
router = APIRouter(prefix="/outlet-sales", tags=["Outlet Sales"])


ADMIN_ROLES = {
    "SUPER_ADMIN",
    "SUPERADMIN",
    "OWNER",
    "ADMIN",
    "HQ_ADMIN",
    "HEAD_OFFICE_ADMIN",
}


CENTRAL_BRANCH_TYPES = {
    "HEAD_OFFICE",
    "CENTRAL_STORE",
    "DESSERT_KITCHEN",
}


def _role_name(user: User) -> str:
    role = getattr(user, "role", None)
    if isinstance(role, str):
        return role.upper().strip()

    name = getattr(role, "name", None)
    return str(name or "").upper().strip()


def _require_admin(current_user: User) -> None:
    if _role_name(current_user) not in ADMIN_ROLES:
        raise AppException(
            403,
            "ACCESS_DENIED",
            "Only Admin users can access Outlet Sales & Consumption.",
        )


def _get_valid_outlet_branch(
    db: Session,
    company_id: str,
    branch_id: str,
) -> Branch:
    branch = (
        db.query(Branch)
        .filter(
            Branch.id == branch_id,
            Branch.is_active.is_(True),
            # Branch.company_id is nullable in the existing master data.
            # Legacy/global outlets may have NULL company_id, so they must still
            # be valid for the current company instead of returning a false 404.
            or_(
                Branch.company_id == company_id,
                Branch.company_id.is_(None),
            ),
        )
        .first()
    )

    if not branch:
        raise AppException(404, "OUTLET_NOT_FOUND", "Outlet not found")

    branch_type = str(getattr(branch, "type", "") or "").upper()
    if branch_type in CENTRAL_BRANCH_TYPES:
        raise AppException(
            400,
            "INVALID_OUTLET",
            "Central Store / Head Office / Kitchen branch cannot be used as an outlet for Outlet Sales & Consumption.",
        )

    return branch


@router.post(
    "/preview",
    response_model=OutletSalePreviewResponse,
)
def preview_outlet_sale(
    payload: OutletSalePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Preview recipe consumption against the selected outlet's own stock."""
    _require_admin(current_user)
    _get_valid_outlet_branch(db, current_user.company_id, payload.branch_id)

    service = OutletSalesService(db)
    return service.preview_sale(current_user.company_id, payload)


@router.post(
    "",
    response_model=OutletSaleSchema,
)
def create_outlet_sale(
    payload: OutletSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Atomically post Outlet Sales/Consumption and deduct outlet-wise stock."""
    _require_admin(current_user)
    _get_valid_outlet_branch(db, current_user.company_id, payload.branch_id)

    service = OutletSalesService(db)
    return service.post_sale(
        current_user.company_id,
        payload,
        current_user.id,
    )


@router.get(
    "",
    response_model=List[OutletSaleSchema],
)
def list_outlet_sales(
    branch_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin history for Outlet Sales/Consumption."""
    _require_admin(current_user)

    query = db.query(OutletSale).filter(
        OutletSale.company_id == current_user.company_id,
    )

    if branch_id:
        _get_valid_outlet_branch(db, current_user.company_id, branch_id)
        query = query.filter(OutletSale.branch_id == branch_id)

    return query.order_by(OutletSale.created_at.desc()).all()

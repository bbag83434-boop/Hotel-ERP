from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.organization import Branch
from app.models.outlet_sales import OutletSale
from app.schemas.outlet_sales import (
    OutletSalePreviewRequest,
    OutletSalePreviewResponse,
    OutletSaleCreate,
    OutletSaleSchema
)
from app.services.outlet_sales import OutletSalesService
from app.core.exceptions import AppException

router = APIRouter()

@router.post("/preview", response_model=OutletSalePreviewResponse)
def preview_outlet_sale(
    req: OutletSalePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Preview the consumption and stock status before posting an outlet sale.
    Outlet user can only preview for their own outlet.
    Admin can preview for any outlet.
    Central Kitchen cannot use this.
    """
    # Check authorization
    branch = db.query(Branch).filter(Branch.id == req.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    if branch.type in ["HEAD_OFFICE", "CENTRAL_STORE", "DESSERT_KITCHEN"]:
        raise HTTPException(status_code=403, detail="Central kitchen or head office cannot use Outlet Sales module")

    is_admin = current_user.role.name == "Admin" if current_user.role else False
    if not is_admin:
        if req.branch_id not in [b.branch_id for b in current_user.branches]:
            raise HTTPException(status_code=403, detail="You can only access your own outlet")

    svc = OutletSalesService(db)
    try:
        return svc.preview_sale(current_user.company_id, req)
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("", response_model=OutletSaleSchema)
def create_outlet_sale(
    req: OutletSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Post an outlet sale, deducting ingredients and recording consumption.
    """
    # Check authorization
    branch = db.query(Branch).filter(Branch.id == req.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    if branch.type in ["HEAD_OFFICE", "CENTRAL_STORE", "DESSERT_KITCHEN"]:
        raise HTTPException(status_code=403, detail="Central kitchen or head office cannot use Outlet Sales module")

    is_admin = current_user.role.name == "Admin" if current_user.role else False
    if not is_admin:
        if req.branch_id not in [b.branch_id for b in current_user.branches]:
            raise HTTPException(status_code=403, detail="You can only access your own outlet")

    svc = OutletSalesService(db)
    try:
        return svc.post_sale(current_user.company_id, current_user.id, req)
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("", response_model=List[OutletSaleSchema])
def list_outlet_sales(
    branch_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List sales history.
    """
    is_admin = current_user.role.name == "Admin" if current_user.role else False
    
    query = db.query(OutletSale).filter(OutletSale.company_id == current_user.company_id)
    
    if branch_id:
        if not is_admin and branch_id not in [b.branch_id for b in current_user.branches]:
            raise HTTPException(status_code=403, detail="You can only access your own outlet")
        query = query.filter(OutletSale.branch_id == branch_id)
    else:
        if not is_admin:
            allowed_branches = [b.branch_id for b in current_user.branches]
            query = query.filter(OutletSale.branch_id.in_(allowed_branches))

    sales = query.order_by(OutletSale.transaction_date.desc()).all()
    return sales

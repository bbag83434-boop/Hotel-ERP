from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.models.user import User, Role, UserBranch
from app.models.organization import Branch
from app.models.restaurant import RestaurantOrder, OrderStatus
from app.models.procurement import PurchaseOrder, POStatus
from app.schemas.dashboard import DashboardTrendResponse, DailyTrendItem

router = APIRouter()

def _check_dashboard_access(current_user: User, db: Session):
    """
    Ensure user has SUPER_ADMIN / OWNER / HQ privileges or belongs to a HEAD_OFFICE branch.
    """
    is_authorized = False
    if current_user.role_id:
        role_obj = db.query(Role).filter(Role.id == current_user.role_id).first()
        if role_obj:
            role_name = role_obj.name.upper()
            if any(r in role_name for r in ["ADMIN", "SUPER", "DIRECTOR", "OWNER", "HQ", "GENERAL_MANAGER", "AREA", "CENTRAL"]):
                is_authorized = True

    if not is_authorized:
        user_branches = db.query(Branch).join(UserBranch, UserBranch.branch_id == Branch.id).filter(
            UserBranch.user_id == current_user.id,
            Branch.company_id == current_user.company_id
        ).all()
        if any(b.type == "HEAD_OFFICE" for b in user_branches):
            is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Head Office and Super Admin roles."
        )


@router.get("/trend", response_model=DashboardTrendResponse)
def get_sales_vs_purchase_trend(
    days: int = Query(30, ge=1, le=365, description="Number of days for sales vs purchase trend"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Consolidated 30-day (or custom duration) Sales vs Purchase daily trend.
    Aggregated across all outlets for HEAD_OFFICE scope.
    Fills missing dates with 0.0 for a continuous chart series.
    """
    _check_dashboard_access(current_user, db)

    now = datetime.utcnow()
    end_date = now.date()
    start_date = end_date - timedelta(days=days - 1)

    start_datetime = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end_datetime = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999999)

    # 1. Query Sales aggregated across all company branches
    sales_query = db.query(
        func.date(RestaurantOrder.created_at).label("day"),
        func.sum(RestaurantOrder.total_amount).label("total_sales")
    ).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.created_at >= start_datetime,
        RestaurantOrder.created_at <= end_datetime,
        RestaurantOrder.status != OrderStatus.CANCELLED.value,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ).group_by(func.date(RestaurantOrder.created_at)).all()

    # 2. Query Purchases aggregated across all company branches
    approved_statuses = [
        POStatus.APPROVED,
        POStatus.ISSUED,
        POStatus.RECEIVED,
        POStatus.PARTIALLY_RECEIVED,
        POStatus.APPROVED.value,
        POStatus.ISSUED.value,
        POStatus.RECEIVED.value,
        POStatus.PARTIALLY_RECEIVED.value
    ]

    purchase_query = db.query(
        func.date(PurchaseOrder.order_date).label("day"),
        func.sum(PurchaseOrder.total_amount).label("total_purchase")
    ).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.order_date >= start_datetime,
        PurchaseOrder.order_date <= end_datetime,
        PurchaseOrder.status.in_(approved_statuses)
    ).group_by(func.date(PurchaseOrder.order_date)).all()

    # Build continuous chronological dictionary for the requested date window
    date_map = {}
    for i in range(days):
        d = start_date + timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        date_map[d_str] = {"date": d_str, "sales": 0.0, "purchase": 0.0}

    # Populate Sales
    for row in sales_query:
        d_str = str(row.day)[:10]
        if d_str in date_map:
            date_map[d_str]["sales"] = float(row.total_sales or 0.0)

    # Populate Purchases
    for row in purchase_query:
        d_str = str(row.day)[:10]
        if d_str in date_map:
            date_map[d_str]["purchase"] = float(row.total_purchase or 0.0)

    trend_items = [
        DailyTrendItem(
            date=val["date"],
            sales=round(val["sales"], 2),
            purchase=round(val["purchase"], 2)
        )
        for val in date_map.values()
    ]

    return DashboardTrendResponse(trend=trend_items)

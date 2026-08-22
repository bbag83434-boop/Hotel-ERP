import io
import csv
import json
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.models.user import User, Role, UserBranch
from app.models.organization import Branch, Warehouse, Company
from app.models.hr import Staff
from app.models.inventory import (
    Item, Category, Unit, StockBalance, StockBatch, StockLedger,
    StockMovementType, StockTransfer, TransferStatus
)
from app.models.restaurant import RestaurantOrder, OrderItem, Menu, MenuCategory, MenuItem, DiningTable, OrderStatus
from app.models.procurement import PurchaseRequest, PurchaseOrder, POStatus, PRStatus, Supplier
from app.models.recipe import Recipe, ProductionOrder
from app.models.wastage import WastageEntry, WastageItem, WastageStatus
from app.models.closing import OutletClosingRecord, FoodCostCalculation
from app.models.report import ReportSnapshot, ReportSchedule, ReportType
from app.models.audit import AuditLog
from app.schemas.reports import (
    ExecutiveDashboardResponse,
    GroupKpiMetric,
    OutletRankingMetric,
    SalesSummaryResponse,
    SalesCategoryBreakdown,
    SalesItemBreakdown,
    SalesDailyDataPoint,
    InventoryValuationResponse,
    ItemValuationSummary,
    FoodCostVarianceResponse,
    OutletFoodCostMetric,
    WastageSummaryReportResponse,
    ProcurementSummaryResponse,
    SupplierSpendMetric,
    ReportExportRequest,
    ReportExportResponse,
    ReportSnapshotCreate,
    ReportSnapshotResponse,
    OutletDashboardResponse,
    OutletDashboardInfo,
    OutletTodaySalesSummary,
    LowStockAlertItem,
    OutletStockSummary,
    OutletProcurementSummary,
    OutletProductionSummary,
    OutletTransfersSummary,
    OutletWastageSummary,
    OutletStaffSummary,
    OutletClosingCycleInfo,
    OutletActivityItem,
)

router = APIRouter()

def _check_user_branch_access(current_user: User, branch_id: Optional[str], db: Session) -> Optional[List[str]]:
    """
    Returns list of accessible branch IDs or None if user is SuperAdmin/HQ with global scope.
    Raises 403 if staff attempts to access an unauthorized outlet.
    """
    is_super_or_admin = False
    if current_user.role_id:
        role_obj = db.query(Role).filter(Role.id == current_user.role_id).first()
        if role_obj:
            role_name = role_obj.name.upper()
            if any(r in role_name for r in ["ADMIN", "SUPER", "DIRECTOR", "OWNER", "HQ", "GENERAL_MANAGER", "AREA", "CENTRAL"]):
                is_super_or_admin = True

    if is_super_or_admin:
        if branch_id:
            # Verify branch belongs to user's company
            branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == current_user.company_id).first()
            if not branch:
                raise HTTPException(status_code=404, detail="Branch not found in company.")
            return [branch_id]
        return None # Global company view

    # Restricted outlet staff
    user_branches = db.query(UserBranch.branch_id).filter(UserBranch.user_id == current_user.id).all()
    accessible_ids = [ub[0] for ub in user_branches]

    if not accessible_ids:
        raise HTTPException(status_code=403, detail="No outlet assigned to this user account.")

    if branch_id:
        if branch_id not in accessible_ids:
            raise HTTPException(status_code=403, detail="Access denied: You do not have permission for this outlet.")
        return [branch_id]

    return accessible_ids

def _parse_date_range(start_date: Optional[datetime], end_date: Optional[datetime], default_days: int = 30):
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=default_days)
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    return start_date, end_date

# ==============================================================================
# 1. EXECUTIVE SUMMARY & MULTI-OUTLET CONSOLIDATED DASHBOARD
# ==============================================================================
@router.get("/executive-summary", response_model=ExecutiveDashboardResponse)
def get_executive_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_date, end_date = _parse_date_range(start_date, end_date, default_days=30)
    scoped_branches = _check_user_branch_access(current_user, None, db)

    # 1. Query branches in scope
    branch_query = db.query(Branch).filter(Branch.company_id == current_user.company_id, Branch.is_active == True)
    if scoped_branches is not None:
        branch_query = branch_query.filter(Branch.id.in_(scoped_branches))
    branches = branch_query.all()
    branch_map = {b.id: b for b in branches}
    branch_ids = list(branch_map.keys())

    if not branch_ids:
        # Return empty metrics if no active branches
        kpi = GroupKpiMetric(
            total_revenue=Decimal("0.00"),
            total_orders=0,
            gross_profit=Decimal("0.00"),
            gross_profit_margin=Decimal("0.00"),
            total_cogs=Decimal("0.00"),
            food_cost_percentage=Decimal("0.00"),
            total_wastage_loss=Decimal("0.00"),
            wastage_percentage=Decimal("0.00"),
            total_procurement_spend=Decimal("0.00"),
            active_outlets_count=0,
            average_order_value=Decimal("0.00")
        )
        return ExecutiveDashboardResponse(
            period_start=start_date,
            period_end=end_date,
            kpis=kpi,
            outlet_rankings=[],
            daily_revenue_trend=[],
            cost_breakdown={"cogs": Decimal("0"), "wastage": Decimal("0"), "procurement": Decimal("0")}
        )

    # 2. Query Sales / Orders
    order_query = db.query(
        RestaurantOrder.branch_id,
        func.count(RestaurantOrder.id).label("order_count"),
        func.sum(RestaurantOrder.total_amount).label("total_sales"),
        func.sum(RestaurantOrder.sub_total).label("net_sales")
    ).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.branch_id.in_(branch_ids),
        RestaurantOrder.created_at >= start_date,
        RestaurantOrder.created_at <= end_date,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ).group_by(RestaurantOrder.branch_id).all()

    sales_by_branch = {r.branch_id: {"orders": r.order_count, "total_sales": Decimal(str(r.total_sales or 0)), "net_sales": Decimal(str(r.net_sales or 0))} for r in order_query}

    # 3. Query Wastage Costs
    wastage_query = db.query(
        WastageEntry.branch_id,
        func.sum(WastageEntry.total_cost).label("total_wastage")
    ).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.branch_id.in_(branch_ids),
        WastageEntry.entry_date >= start_date,
        WastageEntry.entry_date <= end_date,
        WastageEntry.status == WastageStatus.APPROVED
    ).group_by(WastageEntry.branch_id).all()

    wastage_by_branch = {r.branch_id: Decimal(str(r.total_wastage or 0)) for r in wastage_query}

    # 4. Query Theoretical / Actual Food Cost from Closing Records or Estimate from Stock Movement
    closing_query = db.query(
        OutletClosingRecord.branch_id,
        func.sum(OutletClosingRecord.actual_food_cost).label("total_food_cost")
    ).filter(
        OutletClosingRecord.company_id == current_user.company_id,
        OutletClosingRecord.branch_id.in_(branch_ids),
        OutletClosingRecord.start_date >= start_date,
        OutletClosingRecord.end_date <= end_date
    ).group_by(OutletClosingRecord.branch_id).all()

    food_cost_by_branch = {r.branch_id: Decimal(str(r.total_food_cost or 0)) for r in closing_query}

    # 5. Query Procurement Spend
    po_query = db.query(
        func.sum(PurchaseOrder.total_amount).label("total_po_spend")
    ).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.branch_id.in_(branch_ids),
        PurchaseOrder.order_date >= start_date,
        PurchaseOrder.order_date <= end_date,
        PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ISSUED, POStatus.RECEIVED, POStatus.PARTIALLY_RECEIVED])
    ).scalar()
    total_procurement_spend = Decimal(str(po_query or 0))

    # Compile Outlet Rankings
    outlet_rankings: List[OutletRankingMetric] = []
    total_revenue = Decimal("0.00")
    total_orders = 0
    total_cogs = Decimal("0.00")
    total_wastage = Decimal("0.00")

    for bid, branch in branch_map.items():
        s_data = sales_by_branch.get(bid, {"orders": 0, "total_sales": Decimal("0.00"), "net_sales": Decimal("0.00")})
        w_cost = wastage_by_branch.get(bid, Decimal("0.00"))
        fc_cost = food_cost_by_branch.get(bid, s_data["total_sales"] * Decimal("0.30")) # Fallback to standard 30% baseline if closing not finalized

        rev = s_data["total_sales"]
        orders = s_data["orders"]
        total_revenue += rev
        total_orders += orders
        total_cogs += fc_cost
        total_wastage += w_cost

        fc_pct = (fc_cost / rev * 100) if rev > 0 else Decimal("0.00")
        gross_margin_pct = ((rev - fc_cost) / rev * 100) if rev > 0 else Decimal("0.00")

        outlet_rankings.append(OutletRankingMetric(
            branch_id=bid,
            branch_name=branch.name,
            branch_code=branch.code,
            revenue=round(rev, 2),
            orders_count=orders,
            food_cost_percentage=round(fc_pct, 2),
            wastage_cost=round(w_cost, 2),
            gross_margin_percentage=round(gross_margin_pct, 2),
            rank=0
        ))

    # Rank by Revenue descending
    outlet_rankings.sort(key=lambda x: x.revenue, reverse=True)
    for idx, item in enumerate(outlet_rankings):
        item.rank = idx + 1

    # Consolidated KPIs
    gross_profit = total_revenue - total_cogs
    gross_profit_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else Decimal("0.00")
    food_cost_percentage = (total_cogs / total_revenue * 100) if total_revenue > 0 else Decimal("0.00")
    wastage_percentage = (total_wastage / total_revenue * 100) if total_revenue > 0 else Decimal("0.00")
    aov = (total_revenue / Decimal(str(total_orders))) if total_orders > 0 else Decimal("0.00")

    kpis = GroupKpiMetric(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        gross_profit=round(gross_profit, 2),
        gross_profit_margin=round(gross_profit_margin, 2),
        total_cogs=round(total_cogs, 2),
        food_cost_percentage=round(food_cost_percentage, 2),
        total_wastage_loss=round(total_wastage, 2),
        wastage_percentage=round(wastage_percentage, 2),
        total_procurement_spend=round(total_procurement_spend, 2),
        active_outlets_count=len(branches),
        average_order_value=round(aov, 2)
    )

    # 6. Daily Revenue Trend
    daily_query = db.query(
        func.date(RestaurantOrder.created_at).label("day"),
        func.sum(RestaurantOrder.total_amount).label("daily_sales"),
        func.count(RestaurantOrder.id).label("daily_orders")
    ).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.branch_id.in_(branch_ids),
        RestaurantOrder.created_at >= start_date,
        RestaurantOrder.created_at <= end_date,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ).group_by(func.date(RestaurantOrder.created_at)).order_by("day").all()

    daily_trend = [
        {"date": str(r.day), "revenue": float(r.daily_sales or 0), "orders": int(r.daily_orders or 0)}
        for r in daily_query
    ]

    return ExecutiveDashboardResponse(
        period_start=start_date,
        period_end=end_date,
        kpis=kpis,
        outlet_rankings=outlet_rankings,
        daily_revenue_trend=daily_trend,
        cost_breakdown={
            "cogs": round(total_cogs, 2),
            "wastage": round(total_wastage, 2),
            "procurement": round(total_procurement_spend, 2)
        }
    )

# ==============================================================================
# 2. SALES & REVENUE REPORT
# ==============================================================================
@router.get("/sales-summary", response_model=SalesSummaryResponse)
def get_sales_summary(
    branch_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_date, end_date = _parse_date_range(start_date, end_date, default_days=30)
    scoped_branches = _check_user_branch_access(current_user, branch_id, db)

    # Base query for orders
    order_filter = [
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.created_at >= start_date,
        RestaurantOrder.created_at <= end_date,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ]
    if scoped_branches is not None:
        order_filter.append(RestaurantOrder.branch_id.in_(scoped_branches))

    orders = db.query(RestaurantOrder).filter(*order_filter).all()

    total_orders = len(orders)
    total_guests = sum(o.guest_count for o in orders)
    gross_sales = sum(Decimal(str(o.total_amount)) for o in orders)
    net_sales = sum(Decimal(str(o.sub_total)) for o in orders)
    total_tax = sum(Decimal(str(o.tax_amount)) for o in orders)
    total_discount = sum(Decimal(str(o.discount_amount)) for o in orders)
    aov = (gross_sales / Decimal(str(total_orders))) if total_orders > 0 else Decimal("0.00")

    # Category breakdown & top selling items
    order_ids = [o.id for o in orders]
    by_category: List[SalesCategoryBreakdown] = []
    top_selling_items: List[SalesItemBreakdown] = []

    if order_ids:
        item_sales_query = db.query(
            OrderItem.item_id,
            func.coalesce(MenuItem.name, OrderItem.name, "Item").label("item_name"),
            func.coalesce(MenuItem.code, "CODE").label("item_code"),
            MenuCategory.id.label("category_id"),
            func.coalesce(MenuCategory.name, "General").label("category_name"),
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.total_price).label("total_sales"),
            func.avg(OrderItem.unit_price).label("avg_unit_price")
        ).outerjoin(MenuItem, OrderItem.item_id == MenuItem.id)\
         .outerjoin(MenuCategory, MenuItem.category_id == MenuCategory.id)\
         .filter(OrderItem.order_id.in_(order_ids))\
         .group_by(OrderItem.item_id, MenuItem.name, OrderItem.name, MenuItem.code, MenuCategory.id, MenuCategory.name)\
         .order_by(desc("total_sales")).all()

        category_totals: Dict[str, Dict[str, Any]] = {}
        for row in item_sales_query:
            cat_name = row.category_name or "General"
            cat_id = row.category_id
            sales_val = Decimal(str(row.total_sales or 0))
            qty_val = int(row.total_qty or 0)

            if cat_name not in category_totals:
                category_totals[cat_name] = {"category_id": cat_id, "gross_sales": Decimal("0.00"), "item_count": 0}
            category_totals[cat_name]["gross_sales"] += sales_val
            category_totals[cat_name]["item_count"] += qty_val

            top_selling_items.append(SalesItemBreakdown(
                item_id=row.item_id,
                item_name=row.item_name,
                item_code=row.item_code or "",
                category_name=cat_name,
                quantity_sold=qty_val,
                unit_price=round(Decimal(str(row.avg_unit_price or 0)), 2),
                total_sales=round(sales_val, 2)
            ))

        for c_name, c_data in category_totals.items():
            pct = (c_data["gross_sales"] / gross_sales * 100) if gross_sales > 0 else Decimal("0.00")
            by_category.append(SalesCategoryBreakdown(
                category_id=c_data["category_id"],
                category_name=c_name,
                item_count_sold=c_data["item_count"],
                gross_sales=round(c_data["gross_sales"], 2),
                percentage_of_total=round(pct, 2)
            ))
        by_category.sort(key=lambda x: x.gross_sales, reverse=True)

    # Daily trend data
    daily_data: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        d_str = o.created_at.strftime("%Y-%m-%d")
        if d_str not in daily_data:
            daily_data[d_str] = {
                "date": d_str,
                "order_count": 0,
                "guest_count": 0,
                "sub_total": Decimal("0.00"),
                "tax_amount": Decimal("0.00"),
                "discount_amount": Decimal("0.00"),
                "total_sales": Decimal("0.00")
            }
        daily_data[d_str]["order_count"] += 1
        daily_data[d_str]["guest_count"] += o.guest_count
        daily_data[d_str]["sub_total"] += Decimal(str(o.sub_total))
        daily_data[d_str]["tax_amount"] += Decimal(str(o.tax_amount))
        daily_data[d_str]["discount_amount"] += Decimal(str(o.discount_amount))
        daily_data[d_str]["total_sales"] += Decimal(str(o.total_amount))

    daily_trend: List[SalesDailyDataPoint] = []
    for d_str in sorted(daily_data.keys()):
        d_val = daily_data[d_str]
        d_aov = (d_val["total_sales"] / Decimal(str(d_val["order_count"]))) if d_val["order_count"] > 0 else Decimal("0.00")
        daily_trend.append(SalesDailyDataPoint(
            date=d_val["date"],
            order_count=d_val["order_count"],
            guest_count=d_val["guest_count"],
            sub_total=round(d_val["sub_total"], 2),
            tax_amount=round(d_val["tax_amount"], 2),
            discount_amount=round(d_val["discount_amount"], 2),
            total_sales=round(d_val["total_sales"], 2),
            average_order_value=round(d_aov, 2)
        ))

    return SalesSummaryResponse(
        branch_id=branch_id,
        period_start=start_date,
        period_end=end_date,
        total_orders=total_orders,
        total_guests=total_guests,
        gross_sales=round(gross_sales, 2),
        net_sales=round(net_sales, 2),
        total_tax=round(total_tax, 2),
        total_discount=round(total_discount, 2),
        average_order_value=round(aov, 2),
        by_category=by_category,
        top_selling_items=top_selling_items[:15],
        daily_trend=daily_trend
    )

# ==============================================================================
# 3. INVENTORY & STOCK VALUATION REPORT
# ==============================================================================
@router.get("/inventory-valuation", response_model=InventoryValuationResponse)
def get_inventory_valuation(
    branch_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    scoped_branches = _check_user_branch_access(current_user, branch_id, db)

    # Base query for stock balances
    wh_query = db.query(Warehouse).filter(Warehouse.company_id == current_user.company_id, Warehouse.is_active == True)
    if scoped_branches is not None:
        wh_query = wh_query.filter(Warehouse.branch_id.in_(scoped_branches))
    if warehouse_id:
        wh_query = wh_query.filter(Warehouse.id == warehouse_id)

    warehouses = wh_query.all()
    warehouse_ids = [w.id for w in warehouses]
    warehouse_map = {w.id: w.name for w in warehouses}

    if not warehouse_ids:
        return InventoryValuationResponse(
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            total_valuation=Decimal("0.00"),
            total_items_count=0,
            low_stock_items_count=0,
            by_category={},
            items=[]
        )

    sb_query = db.query(
        StockBalance,
        Item,
        Category.name.label("category_name"),
        Unit.symbol.label("unit_symbol")
    ).join(Item, StockBalance.item_id == Item.id)\
     .outerjoin(Category, Item.category_id == Category.id)\
     .outerjoin(Unit, Item.unit_id == Unit.id)\
     .filter(
         StockBalance.warehouse_id.in_(warehouse_ids),
         Item.company_id == current_user.company_id,
         Item.is_active == True
     )

    if category_id:
        sb_query = sb_query.filter(Item.category_id == category_id)

    results = sb_query.all()

    total_valuation = Decimal("0.00")
    low_stock_count = 0
    by_category: Dict[str, Decimal] = {}
    items_list: List[ItemValuationSummary] = []

    for sb, item, cat_name, u_symbol in results:
        current_qty = Decimal(str(sb.quantity or 0))
        cost_price = Decimal(str(item.cost_price or 0))
        val = current_qty * cost_price
        total_valuation += val

        c_name = cat_name or "Uncategorized"
        by_category[c_name] = by_category.get(c_name, Decimal("0.00")) + val

        min_level = Decimal(str(item.min_stock_level or 0))
        is_low = (current_qty <= min_level) and (min_level > 0)
        if is_low:
            low_stock_count += 1

        items_list.append(ItemValuationSummary(
            item_id=item.id,
            item_name=item.name,
            item_code=item.code or "",
            category_name=c_name,
            warehouse_name=warehouse_map.get(sb.warehouse_id, "Warehouse"),
            current_stock=round(current_qty, 2),
            unit_symbol=u_symbol or "unit",
            cost_price=round(cost_price, 2),
            total_valuation=round(val, 2),
            is_low_stock=is_low
        ))

    items_list.sort(key=lambda x: x.total_valuation, reverse=True)

    return InventoryValuationResponse(
        branch_id=branch_id,
        warehouse_id=warehouse_id,
        total_valuation=round(total_valuation, 2),
        total_items_count=len(items_list),
        low_stock_items_count=low_stock_count,
        by_category={k: round(v, 2) for k, v in by_category.items()},
        items=items_list
    )

# ==============================================================================
# 4. FOOD COST & MARGIN VARIANCE REPORT
# ==============================================================================
@router.get("/food-cost-variance", response_model=FoodCostVarianceResponse)
def get_food_cost_variance(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_date, end_date = _parse_date_range(start_date, end_date, default_days=30)
    scoped_branches = _check_user_branch_access(current_user, None, db)

    branches_query = db.query(Branch).filter(Branch.company_id == current_user.company_id, Branch.is_active == True)
    if scoped_branches is not None:
        branches_query = branches_query.filter(Branch.id.in_(scoped_branches))
    branches = branches_query.all()

    outlets_metrics: List[OutletFoodCostMetric] = []
    total_theo = Decimal("0.00")
    total_act = Decimal("0.00")
    total_sales_all = Decimal("0.00")

    for b in branches:
        # 1. Total sales for outlet
        sales_val = db.query(func.sum(RestaurantOrder.total_amount)).filter(
            RestaurantOrder.company_id == current_user.company_id,
            RestaurantOrder.branch_id == b.id,
            RestaurantOrder.created_at >= start_date,
            RestaurantOrder.created_at <= end_date,
            RestaurantOrder.status != OrderStatus.CANCELLED
        ).scalar()
        sales_val = Decimal(str(sales_val or 0))
        total_sales_all += sales_val

        # 2. Closing record for period
        closing_rec = db.query(OutletClosingRecord).filter(
            OutletClosingRecord.company_id == current_user.company_id,
            OutletClosingRecord.branch_id == b.id,
            OutletClosingRecord.start_date >= start_date,
            OutletClosingRecord.end_date <= end_date
        ).first()

        if closing_rec:
            theo_cost = Decimal(str(closing_rec.theoretical_food_cost or 0))
            act_cost = Decimal(str(closing_rec.actual_food_cost or 0))
        else:
            # Fallback estimation based on sales (standard benchmark 28.5% theoretical vs 31.0% actual)
            theo_cost = sales_val * Decimal("0.285")
            act_cost = sales_val * Decimal("0.312")

        variance = act_cost - theo_cost
        total_theo += theo_cost
        total_act += act_cost

        theo_pct = (theo_cost / sales_val * 100) if sales_val > 0 else Decimal("0.00")
        act_pct = (act_cost / sales_val * 100) if sales_val > 0 else Decimal("0.00")
        var_pct = act_pct - theo_pct

        if var_pct > Decimal("4.0"):
            c_status = "CRITICAL"
        elif var_pct > Decimal("2.0"):
            c_status = "ALERT"
        else:
            c_status = "NORMAL"

        outlets_metrics.append(OutletFoodCostMetric(
            branch_id=b.id,
            branch_name=b.name,
            total_sales=round(sales_val, 2),
            theoretical_cost=round(theo_cost, 2),
            actual_consumption_cost=round(act_cost, 2),
            variance_amount=round(variance, 2),
            theoretical_percentage=round(theo_pct, 2),
            actual_percentage=round(act_pct, 2),
            variance_percentage=round(var_pct, 2),
            status=c_status
        ))

    consolidated_var = total_act - total_theo
    consolidated_fc_pct = (total_act / total_sales_all * 100) if total_sales_all > 0 else Decimal("0.00")

    return FoodCostVarianceResponse(
        period_start=start_date,
        period_end=end_date,
        consolidated_theoretical_cost=round(total_theo, 2),
        consolidated_actual_cost=round(total_act, 2),
        consolidated_variance=round(consolidated_var, 2),
        consolidated_food_cost_percentage=round(consolidated_fc_pct, 2),
        outlets=outlets_metrics
    )

# ==============================================================================
# 5. WASTAGE SUMMARY REPORT
# ==============================================================================
@router.get("/wastage-summary", response_model=WastageSummaryReportResponse)
def get_wastage_summary(
    branch_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_date, end_date = _parse_date_range(start_date, end_date, default_days=30)
    scoped_branches = _check_user_branch_access(current_user, branch_id, db)

    filter_args = [
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.entry_date >= start_date,
        WastageEntry.entry_date <= end_date,
        WastageEntry.status == WastageStatus.APPROVED
    ]
    if scoped_branches is not None:
        filter_args.append(WastageEntry.branch_id.in_(scoped_branches))

    entries = db.query(WastageEntry).filter(*filter_args).all()
    entry_ids = [e.id for e in entries]

    total_loss = sum(Decimal(str(e.total_cost or 0)) for e in entries)
    total_entries = len(entries)

    # Outlet breakdown
    outlet_loss: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        bid = e.branch_id
        if bid not in outlet_loss:
            b_obj = db.query(Branch).filter(Branch.id == bid).first()
            outlet_loss[bid] = {"branch_id": bid, "branch_name": b_obj.name if b_obj else "Outlet", "loss_cost": Decimal("0.00"), "entries_count": 0}
        outlet_loss[bid]["loss_cost"] += Decimal(str(e.total_cost or 0))
        outlet_loss[bid]["entries_count"] += 1

    by_outlet = [
        {"branch_id": v["branch_id"], "branch_name": v["branch_name"], "loss_cost": round(v["loss_cost"], 2), "entries_count": v["entries_count"]}
        for v in outlet_loss.values()
    ]
    by_outlet.sort(key=lambda x: x["loss_cost"], reverse=True)

    by_reason: Dict[str, Decimal] = {}
    top_wasted_skus: List[Dict[str, Any]] = []

    if entry_ids:
        items_query = db.query(
            WastageItem.item_id,
            Item.name.label("item_name"),
            Item.code.label("item_code"),
            WastageItem.reason_code,
            func.sum(WastageItem.quantity).label("total_qty"),
            func.sum(WastageItem.total_cost).label("total_cost")
        ).join(Item, WastageItem.item_id == Item.id)\
         .filter(WastageItem.wastage_entry_id.in_(entry_ids))\
         .group_by(WastageItem.item_id, Item.name, Item.code, WastageItem.reason_code)\
         .all()

        sku_totals: Dict[str, Dict[str, Any]] = {}
        for r in items_query:
            r_code = r.reason_code or "OTHER"
            c_val = Decimal(str(r.total_cost or 0))
            by_reason[r_code] = by_reason.get(r_code, Decimal("0.00")) + c_val

            if r.item_id not in sku_totals:
                sku_totals[r.item_id] = {
                    "item_id": r.item_id,
                    "item_name": r.item_name,
                    "item_code": r.item_code or "",
                    "quantity": Decimal("0.00"),
                    "loss_cost": Decimal("0.00")
                }
            sku_totals[r.item_id]["quantity"] += Decimal(str(r.total_qty or 0))
            sku_totals[r.item_id]["loss_cost"] += c_val

        top_wasted_skus = [
            {"item_id": v["item_id"], "item_name": v["item_name"], "item_code": v["item_code"], "quantity": round(v["quantity"], 2), "loss_cost": round(v["loss_cost"], 2)}
            for v in sku_totals.values()
        ]
        top_wasted_skus.sort(key=lambda x: x["loss_cost"], reverse=True)

    return WastageSummaryReportResponse(
        period_start=start_date,
        period_end=end_date,
        total_loss_cost=round(total_loss, 2),
        total_entries_count=total_entries,
        by_reason={k: round(v, 2) for k, v in by_reason.items()},
        by_outlet=by_outlet,
        top_wasted_skus=top_wasted_skus[:10]
    )

# ==============================================================================
# 6. PROCUREMENT & SUPPLIER SUMMARY REPORT
# ==============================================================================
@router.get("/procurement-summary", response_model=ProcurementSummaryResponse)
def get_procurement_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    start_date, end_date = _parse_date_range(start_date, end_date, default_days=30)
    scoped_branches = _check_user_branch_access(current_user, None, db)

    po_filter = [
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.order_date >= start_date,
        PurchaseOrder.order_date <= end_date,
        PurchaseOrder.status != POStatus.CANCELLED
    ]
    if scoped_branches is not None:
        po_filter.append(PurchaseOrder.branch_id.in_(scoped_branches))

    orders = db.query(PurchaseOrder).filter(*po_filter).all()

    total_spend = sum(Decimal(str(po.total_amount or 0)) for po in orders)
    total_count = len(orders)
    fulfilled_count = sum(1 for po in orders if po.status == POStatus.RECEIVED)
    pending_count = sum(1 for po in orders if po.status in [POStatus.ISSUED, POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED, POStatus.WHATSAPP_OPENED, POStatus.SENT_MANUALLY])
    rate_pct = (Decimal(str(fulfilled_count)) / Decimal(str(total_count)) * 100) if total_count > 0 else Decimal("0.00")

    # Supplier breakdown
    supplier_data: Dict[str, Dict[str, Any]] = {}
    for po in orders:
        sid = po.supplier_id
        if not sid:
            continue
        if sid not in supplier_data:
            s_obj = db.query(Supplier).filter(Supplier.id == sid).first()
            supplier_data[sid] = {
                "supplier_id": sid,
                "supplier_name": s_obj.name if s_obj else "Supplier",
                "orders_count": 0,
                "spend": Decimal("0.00")
            }
        supplier_data[sid]["orders_count"] += 1
        supplier_data[sid]["spend"] += Decimal(str(po.total_amount or 0))

    top_suppliers: List[SupplierSpendMetric] = []
    for s_dict in supplier_data.values():
        s_pct = (s_dict["spend"] / total_spend * 100) if total_spend > 0 else Decimal("0.00")
        top_suppliers.append(SupplierSpendMetric(
            supplier_id=s_dict["supplier_id"],
            supplier_name=s_dict["supplier_name"],
            total_orders_count=s_dict["orders_count"],
            total_spend=round(s_dict["spend"], 2),
            percentage_of_total_spend=round(s_pct, 2)
        ))
    top_suppliers.sort(key=lambda x: x.total_spend, reverse=True)

    return ProcurementSummaryResponse(
        period_start=start_date,
        period_end=end_date,
        total_po_spend=round(total_spend, 2),
        total_po_count=total_count,
        fulfilled_po_count=fulfilled_count,
        pending_po_count=pending_count,
        fulfillment_rate_percentage=round(rate_pct, 2),
        top_suppliers=top_suppliers[:10]
    )

# ==============================================================================
# 7. EXPORT REPORTS (CSV / JSON)
# ==============================================================================
@router.post("/export", response_model=ReportExportResponse)
def export_report(
    payload: ReportExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    rep_type = payload.report_type.upper()
    export_fmt = payload.format.upper()
    timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if rep_type == "SALES_SUMMARY":
        sales_resp = get_sales_summary(
            branch_id=payload.branch_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            db=db,
            current_user=current_user
        )
        filename = f"sales_report_{timestamp_str}.csv"
        if export_fmt == "JSON":
            return ReportExportResponse(
                filename=f"sales_report_{timestamp_str}.json",
                format="JSON",
                content_type="application/json",
                data=sales_resp.json()
            )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Order Count", "Guest Count", "Sub Total (INR)", "Tax Amount (INR)", "Total Sales (INR)", "AOV (INR)"])
        for d in sales_resp.daily_trend:
            writer.writerow([d.date, d.order_count, d.guest_count, d.sub_total, d.tax_amount, d.total_sales, d.average_order_value])
        return ReportExportResponse(
            filename=filename,
            format="CSV",
            content_type="text/csv",
            data=output.getvalue()
        )

    elif rep_type == "INVENTORY_VALUATION":
        inv_resp = get_inventory_valuation(
            branch_id=payload.branch_id,
            warehouse_id=None,
            category_id=None,
            db=db,
            current_user=current_user
        )
        filename = f"inventory_valuation_{timestamp_str}.csv"
        if export_fmt == "JSON":
            return ReportExportResponse(
                filename=f"inventory_valuation_{timestamp_str}.json",
                format="JSON",
                content_type="application/json",
                data=inv_resp.json()
            )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Item Code", "Item Name", "Category", "Warehouse", "Stock Qty", "Unit", "Cost Price (INR)", "Valuation (INR)", "Low Stock Alert"])
        for it in inv_resp.items:
            writer.writerow([it.item_code, it.item_name, it.category_name, it.warehouse_name, it.current_stock, it.unit_symbol, it.cost_price, it.total_valuation, "YES" if it.is_low_stock else "NO"])
        return ReportExportResponse(
            filename=filename,
            format="CSV",
            content_type="text/csv",
            data=output.getvalue()
        )

    else: # EXECUTIVE_SUMMARY or others
        exec_resp = get_executive_summary(
            start_date=payload.start_date,
            end_date=payload.end_date,
            db=db,
            current_user=current_user
        )
        filename = f"executive_summary_{timestamp_str}.csv"
        if export_fmt == "JSON":
            return ReportExportResponse(
                filename=f"executive_summary_{timestamp_str}.json",
                format="JSON",
                content_type="application/json",
                data=exec_resp.json()
            )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Rank", "Outlet Code", "Outlet Name", "Revenue (INR)", "Orders Count", "Food Cost %", "Wastage Cost (INR)", "Gross Margin %"])
        for r in exec_resp.outlet_rankings:
            writer.writerow([r.rank, r.branch_code, r.branch_name, r.revenue, r.orders_count, r.food_cost_percentage, r.wastage_cost, r.gross_margin_percentage])
        return ReportExportResponse(
            filename=filename,
            format="CSV",
            content_type="text/csv",
            data=output.getvalue()
        )

# ==============================================================================
# 8. SNAPSHOTS CRUD
# ==============================================================================
@router.get("/snapshots", response_model=List[ReportSnapshotResponse])
def list_report_snapshots(
    report_type: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ReportSnapshot).filter(ReportSnapshot.company_id == current_user.company_id)
    if report_type:
        query = query.filter(ReportSnapshot.report_type == report_type)
    if branch_id:
        query = query.filter(ReportSnapshot.branch_id == branch_id)
    return query.order_by(desc(ReportSnapshot.generated_at)).limit(50).all()

@router.post("/snapshots", response_model=ReportSnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_report_snapshot(
    payload: ReportSnapshotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    snapshot = ReportSnapshot(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        report_type=payload.report_type,
        period_start=payload.period_start,
        period_end=payload.period_end,
        generated_at=datetime.utcnow(),
        generated_by_id=current_user.id,
        title=payload.title,
        metrics=payload.metrics,
        summary_text=payload.summary_text
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot

# ==============================================================================
# 9. OUTLET OPERATIONAL DASHBOARD (Single-Outlet Command Cockpit)
# ==============================================================================
@router.get("/outlet-dashboard", response_model=OutletDashboardResponse)
def get_outlet_dashboard(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Production-ready Single-Outlet Operational Dashboard API.
    Strictly isolated per tenant and authorized branch access.
    """
    # 1. Determine and validate target branch
    is_super_or_admin = False
    if current_user.role_id:
        role_obj = db.query(Role).filter(Role.id == current_user.role_id).first()
        if role_obj:
            role_name = role_obj.name.upper()
            if any(r in role_name for r in ["ADMIN", "SUPER", "DIRECTOR", "OWNER", "HQ", "GENERAL_MANAGER", "AREA", "CENTRAL"]):
                is_super_or_admin = True

    target_branch_id = branch_id

    if is_super_or_admin:
        if target_branch_id:
            branch = db.query(Branch).filter(
                Branch.id == target_branch_id,
                Branch.company_id == current_user.company_id
            ).first()
            if not branch:
                raise HTTPException(status_code=404, detail="Branch not found in company.")
        else:
            branch = db.query(Branch).filter(
                Branch.company_id == current_user.company_id,
                Branch.is_active == True
            ).first()
            if not branch:
                raise HTTPException(status_code=404, detail="No active branches found.")
            target_branch_id = branch.id
    else:
        # Restricted outlet user
        user_branches = db.query(UserBranch.branch_id).filter(UserBranch.user_id == current_user.id).all()
        accessible_ids = [ub[0] for ub in user_branches]
        if not accessible_ids:
            raise HTTPException(status_code=403, detail="No outlet assigned to this user account.")
        
        if target_branch_id:
            if target_branch_id not in accessible_ids:
                raise HTTPException(status_code=403, detail="Access denied: You do not have permission for this outlet.")
            branch = db.query(Branch).filter(
                Branch.id == target_branch_id,
                Branch.company_id == current_user.company_id
            ).first()
            if not branch:
                raise HTTPException(status_code=404, detail="Branch not found.")
        else:
            target_branch_id = accessible_ids[0]
            branch = db.query(Branch).filter(
                Branch.id == target_branch_id,
                Branch.company_id == current_user.company_id
            ).first()
            if not branch:
                raise HTTPException(status_code=404, detail="Assigned branch not found.")

    company = db.query(Company).filter(Company.id == current_user.company_id).first()

    # 2. Timing & Bi-Monthly Closing Cycle Calculations
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)

    day = now.day
    is_first_half = day <= 15
    period_type = "FIRST_HALF" if is_first_half else "SECOND_HALF"
    start_day = 1 if is_first_half else 16
    if now.month == 12:
        last_day = 15 if is_first_half else 31
    else:
        next_month = datetime(now.year, now.month + 1, 1)
        last_day = 15 if is_first_half else (next_month - timedelta(days=1)).day
    
    period_start = datetime(now.year, now.month, start_day, 0, 0, 0)
    period_end = datetime(now.year, now.month, last_day, 23, 59, 59, 999999)
    days_remaining = max(0, last_day - day)

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    period_label = f"{month_names[now.month - 1]} {now.year} - {'1st Half (1–15)' if is_first_half else '2nd Half (16–End)'}"

    # 3. Today's POS Sales & Orders
    today_orders = db.query(
        func.count(RestaurantOrder.id).label("order_count"),
        func.sum(RestaurantOrder.total_amount).label("total_sales"),
        func.sum(RestaurantOrder.sub_total).label("net_sales")
    ).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.branch_id == target_branch_id,
        RestaurantOrder.created_at >= today_start,
        RestaurantOrder.created_at <= today_end,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ).first()

    today_sales_val = Decimal(str(today_orders.total_sales or 0)) if today_orders else Decimal("0.00")
    today_net_val = Decimal(str(today_orders.net_sales or 0)) if today_orders else Decimal("0.00")
    today_count_val = int(today_orders.order_count or 0) if today_orders else 0
    avg_order_val = (today_sales_val / Decimal(str(today_count_val))) if today_count_val > 0 else Decimal("0.00")

    # Period sales for closing cycle
    period_orders = db.query(
        func.count(RestaurantOrder.id).label("order_count"),
        func.sum(RestaurantOrder.total_amount).label("total_sales")
    ).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.branch_id == target_branch_id,
        RestaurantOrder.created_at >= period_start,
        RestaurantOrder.created_at <= period_end,
        RestaurantOrder.status != OrderStatus.CANCELLED
    ).first()

    period_sales_val = Decimal(str(period_orders.total_sales or 0)) if period_orders else Decimal("0.00")
    period_count_val = int(period_orders.order_count or 0) if period_orders else 0

    # Tables occupied
    total_tables = db.query(func.count(DiningTable.id)).filter(
        DiningTable.branch_id == target_branch_id,
        DiningTable.is_active == True
    ).scalar() or 0

    active_occupied_tables = db.query(func.count(DiningTable.id)).filter(
        DiningTable.branch_id == target_branch_id,
        DiningTable.status == "OCCUPIED"
    ).scalar() or 0

    today_sales_summary = OutletTodaySalesSummary(
        today_sales=round(today_sales_val, 2),
        today_orders_count=today_count_val,
        today_net_sales=round(today_net_val, 2),
        active_tables_occupied=active_occupied_tables,
        total_dining_tables=total_tables,
        avg_order_value=round(avg_order_val, 2)
    )

    # 4. Stock & Inventory Summary
    branch_warehouses = db.query(Warehouse.id).filter(
        Warehouse.branch_id == target_branch_id,
        Warehouse.is_active == True
    ).all()
    warehouse_ids = [w[0] for w in branch_warehouses]

    total_items_in_stock = 0
    total_stock_value = Decimal("0.00")
    low_stock_count = 0
    out_of_stock_count = 0
    low_stock_items: List[LowStockAlertItem] = []

    if warehouse_ids:
        # Stock balance query
        stock_query = db.query(
            StockBalance,
            Item,
            Category.name.label("category_name"),
            Unit.symbol.label("unit_symbol")
        ).join(Item, Item.id == StockBalance.item_id)\
         .outerjoin(Category, Category.id == Item.category_id)\
         .outerjoin(Unit, Unit.id == Item.unit_id)\
         .filter(StockBalance.warehouse_id.in_(warehouse_ids)).all()

        for sb, itm, cat_name, u_sym in stock_query:
            qty = Decimal(str(sb.quantity or 0))
            cost = Decimal(str(itm.cost_price or 0))
            min_lvl = Decimal(str(sb.min_stock_level if sb.min_stock_level is not None else (itm.min_stock_level or 0)))

            if qty > 0:
                total_items_in_stock += 1
                total_stock_value += (qty * cost)

            if qty <= 0:
                out_of_stock_count += 1
            elif qty <= min_lvl:
                low_stock_count += 1
                if len(low_stock_items) < 8:
                    low_stock_items.append(LowStockAlertItem(
                        item_id=str(itm.id),
                        name=itm.name,
                        code=itm.code,
                        category_name=cat_name or "General",
                        current_stock=round(qty, 2),
                        min_stock_level=round(min_lvl, 2),
                        unit_symbol=u_sym or "units",
                        cost_price=round(cost, 2)
                    ))

    # Expiring batches in next 7 days
    expiring_count = 0
    if warehouse_ids:
        exp_threshold = (now + timedelta(days=7)).date()
        expiring_count = db.query(func.count(StockBatch.id)).filter(
            StockBatch.warehouse_id.in_(warehouse_ids),
            StockBatch.expiry_date.isnot(None),
            StockBatch.expiry_date >= now.date(),
            StockBatch.expiry_date <= exp_threshold,
            StockBatch.quantity > 0,
            StockBatch.is_active == True
        ).scalar() or 0

    stock_summary = OutletStockSummary(
        total_items_in_stock=total_items_in_stock,
        total_stock_value=round(total_stock_value, 2),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        expiring_batches_count=expiring_count,
        low_stock_items=low_stock_items
    )

    # 5. Procurement & Purchase Requests
    pending_prs = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.company_id == current_user.company_id,
        PurchaseRequest.branch_id == target_branch_id,
        PurchaseRequest.status.in_([PRStatus.DRAFT, PRStatus.PENDING_APPROVAL])
    ).scalar() or 0

    approved_prs = db.query(func.count(PurchaseRequest.id)).filter(
        PurchaseRequest.company_id == current_user.company_id,
        PurchaseRequest.branch_id == target_branch_id,
        PurchaseRequest.status.in_([PRStatus.APPROVED, PRStatus.ORDERED])
    ).scalar() or 0

    direct_pos = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.branch_id == target_branch_id
    ).scalar() or 0

    pending_grns = db.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.branch_id == target_branch_id,
        PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ISSUED, POStatus.PARTIALLY_RECEIVED])
    ).scalar() or 0

    # Month PO spend
    month_start = datetime(now.year, now.month, 1, 0, 0, 0)
    month_po_spend_val = db.query(func.sum(PurchaseOrder.total_amount)).filter(
        PurchaseOrder.company_id == current_user.company_id,
        PurchaseOrder.branch_id == target_branch_id,
        PurchaseOrder.order_date >= month_start,
        PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ISSUED, POStatus.RECEIVED, POStatus.PARTIALLY_RECEIVED])
    ).scalar() or Decimal("0.00")

    procurement_summary = OutletProcurementSummary(
        pending_pr_count=pending_prs,
        approved_pr_count=approved_prs,
        direct_po_count=direct_pos,
        pending_grn_count=pending_grns,
        month_po_spend=round(Decimal(str(month_po_spend_val)), 2)
    )

    # 6. Production & Recipes
    active_recipes = db.query(func.count(Recipe.id)).filter(
        Recipe.company_id == current_user.company_id,
        Recipe.is_active == True
    ).scalar() or 0

    today_prod = db.query(
        func.count(ProductionOrder.id).label("batch_count"),
        func.sum(ProductionOrder.actual_yield_qty).label("total_yield")
    ).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.branch_id == target_branch_id,
        ProductionOrder.created_at >= today_start,
        ProductionOrder.created_at <= today_end
    ).first()

    prod_summary = OutletProductionSummary(
        active_recipes_count=active_recipes,
        today_production_batches=int(today_prod.batch_count or 0) if today_prod else 0,
        today_produced_qty=round(Decimal(str(today_prod.total_yield or 0)), 2) if today_prod else Decimal("0.00")
    )

    # 7. Transfers
    pending_inbound = 0
    pending_outbound = 0
    today_completed_transfers = 0
    if warehouse_ids:
        pending_inbound = db.query(func.count(StockTransfer.id)).filter(
            StockTransfer.company_id == current_user.company_id,
            StockTransfer.to_warehouse_id.in_(warehouse_ids),
            StockTransfer.status == TransferStatus.PENDING
        ).scalar() or 0

        pending_outbound = db.query(func.count(StockTransfer.id)).filter(
            StockTransfer.company_id == current_user.company_id,
            StockTransfer.from_warehouse_id.in_(warehouse_ids),
            StockTransfer.status == TransferStatus.PENDING
        ).scalar() or 0

        today_completed_transfers = db.query(func.count(StockTransfer.id)).filter(
            StockTransfer.company_id == current_user.company_id,
            or_(
                StockTransfer.to_warehouse_id.in_(warehouse_ids),
                StockTransfer.from_warehouse_id.in_(warehouse_ids)
            ),
            StockTransfer.status == TransferStatus.COMPLETED,
            StockTransfer.updated_at >= today_start
        ).scalar() or 0

    transfers_summary = OutletTransfersSummary(
        pending_inbound_transfers=pending_inbound,
        pending_outbound_transfers=pending_outbound,
        today_completed_transfers=today_completed_transfers
    )

    # 8. Wastage Summary
    today_wastage = db.query(
        func.count(WastageEntry.id).label("entry_count"),
        func.sum(WastageEntry.total_cost).label("total_loss")
    ).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.branch_id == target_branch_id,
        WastageEntry.entry_date >= today_start,
        WastageEntry.entry_date <= today_end
    ).first()

    period_wastage_loss = db.query(func.sum(WastageEntry.total_cost)).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.branch_id == target_branch_id,
        WastageEntry.entry_date >= period_start,
        WastageEntry.entry_date <= period_end,
        WastageEntry.status == WastageStatus.APPROVED
    ).scalar() or Decimal("0.00")

    pending_wastage = db.query(func.count(WastageEntry.id)).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.branch_id == target_branch_id,
        WastageEntry.status == WastageStatus.PENDING_APPROVAL
    ).scalar() or 0

    wastage_summary = OutletWastageSummary(
        today_wastage_cost=round(Decimal(str(today_wastage.total_loss or 0)), 2) if today_wastage else Decimal("0.00"),
        today_wastage_entries=int(today_wastage.entry_count or 0) if today_wastage else 0,
        period_wastage_cost=round(Decimal(str(period_wastage_loss)), 2),
        pending_wastage_approvals=pending_wastage
    )

    # 9. Staff Summary
    active_staff = db.query(func.count(Staff.id)).filter(
        Staff.branch_id == target_branch_id,
        Staff.is_active == True,
        Staff.status == "ACTIVE"
    ).scalar() or 0

    total_staff = db.query(func.count(Staff.id)).filter(
        Staff.branch_id == target_branch_id
    ).scalar() or 0

    staff_summary = OutletStaffSummary(
        active_staff_count=active_staff,
        total_staff_count=total_staff
    )

    # 10. Closing Cycle Info
    closing_cycle_info = OutletClosingCycleInfo(
        period_label=period_label,
        period_type=period_type,
        start_date=period_start,
        end_date=period_end,
        days_remaining=days_remaining,
        period_sales=round(period_sales_val, 2),
        period_orders_count=period_count_val
    )

    # 11. Recent Live Activities (Chronological real stream)
    recent_activities: List[OutletActivityItem] = []

    # Recent Orders
    recent_orders = db.query(RestaurantOrder).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.branch_id == target_branch_id
    ).order_by(desc(RestaurantOrder.created_at)).limit(4).all()

    for ro in recent_orders:
        recent_activities.append(OutletActivityItem(
            id=str(ro.id),
            type="ORDER",
            title=f"Order #{ro.order_number}",
            description=f"Dining Order · {ro.guest_count} guests",
            timestamp=ro.created_at,
            status=str(ro.status),
            amount=round(Decimal(str(ro.total_amount or 0)), 2)
        ))

    # Recent PRs
    recent_pr_list = db.query(PurchaseRequest).filter(
        PurchaseRequest.company_id == current_user.company_id,
        PurchaseRequest.branch_id == target_branch_id
    ).order_by(desc(PurchaseRequest.created_at)).limit(3).all()

    for pr in recent_pr_list:
        recent_activities.append(OutletActivityItem(
            id=str(pr.id),
            type="PURCHASE_REQUEST",
            title=f"PR #{pr.request_number}",
            description=f"Priority {pr.priority} · {pr.notes or 'Stock replenishment'}",
            timestamp=pr.created_at,
            status=str(pr.status.value if hasattr(pr.status, 'value') else pr.status),
            amount=round(Decimal(str(pr.estimated_total or 0)), 2) if hasattr(pr, 'estimated_total') and pr.estimated_total else None
        ))

    # Recent Wastage
    recent_wastage_list = db.query(WastageEntry).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.branch_id == target_branch_id
    ).order_by(desc(WastageEntry.entry_date)).limit(3).all()

    for we in recent_wastage_list:
        recent_activities.append(OutletActivityItem(
            id=str(we.id),
            type="WASTAGE",
            title=f"Wastage #{we.entry_number}",
            description=f"{we.total_items_count} items logged",
            timestamp=we.entry_date,
            status=str(we.status.value if hasattr(we.status, 'value') else we.status),
            amount=round(Decimal(str(we.total_cost or 0)), 2)
        ))

    # Recent Transfers
    if warehouse_ids:
        recent_transfers_list = db.query(StockTransfer).filter(
            StockTransfer.company_id == current_user.company_id,
            or_(
                StockTransfer.to_warehouse_id.in_(warehouse_ids),
                StockTransfer.from_warehouse_id.in_(warehouse_ids)
            )
        ).order_by(desc(StockTransfer.created_at)).limit(3).all()

        for st in recent_transfers_list:
            is_in = st.to_warehouse_id in warehouse_ids
            recent_activities.append(OutletActivityItem(
                id=str(st.id),
                type="TRANSFER",
                title=f"Transfer #{st.transfer_number}",
                description="Inbound Dispatch" if is_in else "Outbound Transfer",
                timestamp=st.created_at,
                status=str(st.status.value if hasattr(st.status, 'value') else st.status),
                amount=None
            ))

    # Sort recent activities by timestamp descending
    recent_activities.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activities = recent_activities[:10]

    # 12. Allowed Modules Matrix
    role_name = ""
    if current_user.role:
        role_name = current_user.role.name.upper()
    elif current_user.role_id:
        r_obj = db.query(Role).filter(Role.id == current_user.role_id).first()
        if r_obj:
            role_name = r_obj.name.upper()

    if is_super_or_admin:
        allowed_modules = ["inventory", "purchase", "production", "transfers", "wastage", "assistant", "organization", "hr", "closing", "reports", "telemetry"]
    elif "MANAGER" in role_name:
        allowed_modules = ["inventory", "purchase", "production", "transfers", "wastage", "assistant", "closing", "reports", "hr"]
    elif "STORE" in role_name:
        allowed_modules = ["inventory", "purchase", "transfers", "assistant"]
    elif "PURCHASE" in role_name:
        allowed_modules = ["purchase", "inventory", "assistant"]
    elif "KITCHEN" in role_name or "CHEF" in role_name:
        allowed_modules = ["production", "wastage", "inventory", "transfers", "assistant"]
    elif "CASHIER" in role_name:
        allowed_modules = ["assistant", "closing"]
    else:
        allowed_modules = ["inventory", "purchase", "production", "transfers", "wastage", "assistant"]

    outlet_info = OutletDashboardInfo(
        id=str(branch.id),
        name=branch.name,
        code=branch.code,
        type=str(branch.type),
        is_active=bool(branch.is_active),
        company_name=company.name if company else None
    )

    return OutletDashboardResponse(
        outlet=outlet_info,
        today_sales=today_sales_summary,
        stock=stock_summary,
        procurement=procurement_summary,
        production=prod_summary,
        transfers=transfers_summary,
        wastage=wastage_summary,
        staff=staff_summary,
        closing_cycle=closing_cycle_info,
        recent_activities=recent_activities,
        allowed_modules=allowed_modules
    )


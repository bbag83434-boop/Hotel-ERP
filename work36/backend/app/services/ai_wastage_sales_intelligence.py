from datetime import datetime, timedelta, time
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.models.restaurant import RestaurantOrder, OrderItem
from app.models.wastage import WastageEntry, WastageItem, WastageStatus
from app.models.organization import Branch
from app.models.inventory import Item


def _money(value) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01")))


def build_wastage_sales_intelligence(db: Session, company_id: str, branch_id: str, days: int = 7) -> Dict[str, Any]:
    days = max(1, min(int(days), 90))
    now = datetime.utcnow()
    start = datetime.combine((now - timedelta(days=days - 1)).date(), time.min)
    end = now
    previous_start = start - timedelta(days=days)

    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == company_id).first()
    if not branch:
        raise ValueError("Branch not found in company")

    # Sales are based only on completed, non-cancelled restaurant orders.
    current_sales = db.query(
        func.coalesce(func.sum(RestaurantOrder.total_amount), 0),
        func.count(RestaurantOrder.id),
    ).filter(
        RestaurantOrder.company_id == company_id,
        RestaurantOrder.branch_id == branch_id,
        RestaurantOrder.created_at >= start,
        RestaurantOrder.created_at <= end,
        RestaurantOrder.status == "COMPLETED",
    ).one()
    previous_sales = db.query(func.coalesce(func.sum(RestaurantOrder.total_amount), 0)).filter(
        RestaurantOrder.company_id == company_id,
        RestaurantOrder.branch_id == branch_id,
        RestaurantOrder.created_at >= previous_start,
        RestaurantOrder.created_at < start,
        RestaurantOrder.status == "COMPLETED",
    ).scalar() or 0

    current_revenue = Decimal(str(current_sales[0] or 0))
    order_count = int(current_sales[1] or 0)
    prev_revenue = Decimal(str(previous_sales or 0))
    sales_change_pct = ((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue else None

    # Top/low selling products from actual order-item quantities and revenue.
    item_rows = db.query(
        OrderItem.item_id,
        func.max(OrderItem.name).label("item_name"),
        func.sum(OrderItem.quantity).label("quantity"),
        func.sum(OrderItem.total_price).label("revenue"),
    ).join(RestaurantOrder, RestaurantOrder.id == OrderItem.order_id).filter(
        RestaurantOrder.company_id == company_id,
        RestaurantOrder.branch_id == branch_id,
        RestaurantOrder.created_at >= start,
        RestaurantOrder.created_at <= end,
        RestaurantOrder.status == "COMPLETED",
        OrderItem.status != "CANCELLED",
    ).group_by(OrderItem.item_id).order_by(desc("revenue"))
    rows = item_rows.limit(50).all()
    top_products = [
        {"item_id": r.item_id, "item_name": r.item_name or "Unknown", "quantity": _money(r.quantity), "revenue": _money(r.revenue)}
        for r in rows[:10]
    ]
    low_products = [
        {"item_id": r.item_id, "item_name": r.item_name or "Unknown", "quantity": _money(r.quantity), "revenue": _money(r.revenue)}
        for r in sorted(rows, key=lambda x: float(x.quantity or 0))[:10]
    ]

    # Peak hours from actual completed orders. Keep hour buckets deterministic.
    hour_rows = db.query(
        func.extract("hour", RestaurantOrder.created_at).label("hour"),
        func.count(RestaurantOrder.id).label("orders"),
        func.coalesce(func.sum(RestaurantOrder.total_amount), 0).label("revenue"),
    ).filter(
        RestaurantOrder.company_id == company_id,
        RestaurantOrder.branch_id == branch_id,
        RestaurantOrder.created_at >= start,
        RestaurantOrder.created_at <= end,
        RestaurantOrder.status == "COMPLETED",
    ).group_by(func.extract("hour", RestaurantOrder.created_at)).order_by(desc("orders"))
    peak_hours = [
        {"hour": int(r.hour), "orders": int(r.orders), "revenue": _money(r.revenue)}
        for r in hour_rows.limit(8).all()
    ]

    # Approved wastage only: rejected/draft records must never become loss signals.
    wastage_total = db.query(func.coalesce(func.sum(WastageEntry.total_cost), 0)).filter(
        WastageEntry.company_id == company_id,
        WastageEntry.branch_id == branch_id,
        WastageEntry.entry_date >= start,
        WastageEntry.entry_date <= end,
        WastageEntry.status == WastageStatus.APPROVED,
    ).scalar() or 0
    prev_wastage = db.query(func.coalesce(func.sum(WastageEntry.total_cost), 0)).filter(
        WastageEntry.company_id == company_id,
        WastageEntry.branch_id == branch_id,
        WastageEntry.entry_date >= previous_start,
        WastageEntry.entry_date < start,
        WastageEntry.status == WastageStatus.APPROVED,
    ).scalar() or 0
    wastage_cost = Decimal(str(wastage_total or 0))
    prev_wastage_cost = Decimal(str(prev_wastage or 0))
    wastage_change_pct = ((wastage_cost - prev_wastage_cost) / prev_wastage_cost * 100) if prev_wastage_cost else None

    wastage_item_rows = db.query(
        WastageItem.item_id,
        func.sum(WastageItem.quantity).label("quantity"),
        func.sum(WastageItem.total_cost).label("cost"),
    ).join(WastageEntry, WastageEntry.id == WastageItem.wastage_entry_id).filter(
        WastageEntry.company_id == company_id,
        WastageEntry.branch_id == branch_id,
        WastageEntry.entry_date >= start,
        WastageEntry.entry_date <= end,
        WastageEntry.status == WastageStatus.APPROVED,
    ).group_by(WastageItem.item_id).order_by(desc("cost")).limit(10).all()

    item_ids = [r.item_id for r in wastage_item_rows]
    names = {}
    if item_ids:
        names = {x.id: x.name for x in db.query(Item.id, Item.name).filter(Item.id.in_(item_ids)).all()}
    top_wastage_items = [
        {"item_id": r.item_id, "item_name": names.get(r.item_id, "Unknown"), "quantity": _money(r.quantity), "cost": _money(r.cost)}
        for r in wastage_item_rows
    ]

    # Signals are deterministic explanations; no AI-generated arithmetic or invented data.
    signals = []
    if wastage_change_pct is not None and wastage_change_pct >= 20:
        signals.append({"severity": "HIGH", "type": "WASTAGE_SURGE", "message": f"Approved wastage cost increased {_money(wastage_change_pct)}% versus the previous {days}-day period."})
    if current_revenue > 0 and wastage_cost / current_revenue >= Decimal("0.02"):
        signals.append({"severity": "HIGH", "type": "WASTAGE_TO_SALES", "message": "Approved wastage is at or above 2% of completed sales for this period."})
    if sales_change_pct is not None and sales_change_pct <= -15:
        signals.append({"severity": "MEDIUM", "type": "SALES_DROP", "message": f"Completed sales decreased {_money(abs(sales_change_pct))}% versus the previous period."})
    if not signals:
        signals.append({"severity": "INFO", "type": "NO_MAJOR_ANOMALY", "message": "No major wastage or sales anomaly crossed the configured thresholds."})

    return {
        "period": {"start": start.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d"), "days": days},
        "outlet": {"branch_id": branch.id, "branch_name": branch.name},
        "sales": {
            "revenue": _money(current_revenue), "orders": order_count,
            "average_bill": _money(current_revenue / order_count) if order_count else 0,
            "previous_revenue": _money(prev_revenue),
            "change_percentage": _money(sales_change_pct) if sales_change_pct is not None else None,
            "top_products": top_products, "low_selling_products": low_products, "peak_hours": peak_hours,
        },
        "wastage": {
            "cost": _money(wastage_cost), "previous_cost": _money(prev_wastage_cost),
            "change_percentage": _money(wastage_change_pct) if wastage_change_pct is not None else None,
            "cost_as_percent_of_sales": _money((wastage_cost / current_revenue) * 100) if current_revenue else 0,
            "top_items": top_wastage_items,
        },
        "signals": signals,
        "source": "deterministic-stored-data",
    }

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
import json
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, desc
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Branch, Warehouse
from app.models.restaurant import RestaurantOrder, OrderItem, DiningTable, Menu, MenuItem
from app.models.restaurant import OrderStatus
from app.models.inventory import StockBalance, StockLedger, StockMovementType, Item
from app.models.recipe import Recipe, RecipeItem
from app.models.audit import AuditLog
from app.services.unit_conversion import convert_quantity
from app.models.cashier import CashSession, CashMovement, CashSessionStatus, CashMovementType
from app.schemas.orders import (
    OrderCreate, OrderResponse, OrderItemResponse, OrderCompleteRequest,
    OrderStatsResponse,
)

router = APIRouter()


def _assert_branch_access(db: Session, user: User, branch_id: str) -> Branch:
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.company_id == user.company_id,
        Branch.is_active.is_(True),
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    role = (user.role.name if user.role else "").upper()
    if role in {"SUPER_ADMIN", "OWNER", "HQ_ADMIN", "ADMIN", "HEAD_OFFICE_ADMIN"}:
        return branch
    allowed = {b.branch_id for b in user.branches}
    if branch_id not in allowed:
        raise HTTPException(status_code=403, detail="Access denied for this outlet")
    return branch


def _serialize(order: RestaurantOrder) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        company_id=order.company_id,
        branch_id=order.branch_id,
        order_number=order.order_number,
        source=order.source,
        external_order_id=order.external_order_id,
        table_id=order.table_id,
        status=order.status,
        guest_count=order.guest_count,
        customer_name=getattr(order, "customer_name", None),
        customer_phone=getattr(order, "customer_phone", None),
        subtotal=Decimal(str(order.sub_total or 0)),
        tax_amount=Decimal(str(order.tax_amount or 0)),
        discount_amount=Decimal(str(order.discount_amount or 0)),
        total_amount=Decimal(str(order.total_amount or 0)),
        paid_amount=Decimal(str(order.paid_amount or 0)),
        notes=order.notes,
        created_at=order.created_at,
        items=[OrderItemResponse(
            id=i.id,
            menu_item_id=i.item_id,
            name=i.name or "",
            quantity=Decimal(str(i.quantity)),
            unit_price=Decimal(str(i.unit_price)),
            total_price=Decimal(str(i.total_price)),
            status=i.status or "SERVED",
        ) for i in order.items],
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _assert_branch_access(db, current_user, payload.branch_id)

    if payload.external_order_id:
        existing = db.query(RestaurantOrder).filter(
            RestaurantOrder.company_id == current_user.company_id,
            RestaurantOrder.source == payload.source.value,
            RestaurantOrder.external_order_id == payload.external_order_id,
        ).first()
        if existing:
            return _serialize(existing)

    menu_ids = [x.menu_item_id for x in payload.items]
    menu_items = db.query(MenuItem).filter(
        MenuItem.company_id == current_user.company_id,
        MenuItem.id.in_(menu_ids),
        MenuItem.is_available.is_(True),
    ).all()
    menu_map = {m.id: m for m in menu_items}
    missing = [mid for mid in menu_ids if mid not in menu_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unavailable or unknown menu item(s): {', '.join(missing)}")

    if payload.table_id:
        table = db.query(DiningTable).filter(
            DiningTable.id == payload.table_id,
            DiningTable.branch_id == payload.branch_id,
            DiningTable.company_id == current_user.company_id,
        ).first()
        if not table:
            raise HTTPException(status_code=404, detail="Dining table not found")
        if table.status == "BLOCKED":
            raise HTTPException(status_code=400, detail="Dining table is blocked")
    else:
        table = None

    today = datetime.utcnow().strftime("%Y%m%d")
    order_number = None
    for _ in range(5):
        candidate = f"ORD-{today}-{secrets.token_hex(3).upper()}"
        if not db.query(RestaurantOrder.id).filter(RestaurantOrder.order_number == candidate).first():
            order_number = candidate
            break
    if not order_number:
        raise HTTPException(status_code=503, detail="Could not generate a unique order number")

    subtotal = Decimal("0")
    tax = Decimal("0")
    order = RestaurantOrder(
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
        table_id=payload.table_id,
        order_number=order_number,
        source=payload.source.value,
        external_order_id=payload.external_order_id,
        status=OrderStatus.OPEN.value,
        guest_count=payload.guest_count,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    for line in payload.items:
        menu = menu_map[line.menu_item_id]
        qty = Decimal(str(line.quantity))
        unit_price = Decimal(str(menu.price or 0))
        line_total = (unit_price * qty).quantize(Decimal("0.0001"))
        line_tax = (line_total * Decimal(str(menu.tax_rate or 0)) / Decimal("100")).quantize(Decimal("0.0001"))
        subtotal += line_total
        tax += line_tax
        db.add(OrderItem(
            order_id=order.id,
            item_id=menu.id,
            name=menu.name,
            quantity=qty,
            unit_price=unit_price,
            total_price=line_total,
            cogs_amount=Decimal(str(menu.cost_price or 0)) * qty,
            status="PENDING",
            notes=line.notes,
        ))

    order.sub_total = subtotal
    order.tax_amount = tax
    order.total_amount = subtotal + tax
    order.paid_amount = Decimal("0")

    if table:
        table.status = "OCCUPIED"
        table.active_order_id = order.id

    db.add(AuditLog(
        user_id=current_user.id,
        action="CREATE",
        entity_type="RestaurantOrder",
        entity_id=order.id,
        details=json.dumps({"source": payload.source.value, "order_number": order_number, "external_order_id": payload.external_order_id or ""}),
    ))
    db.commit()
    db.refresh(order)
    return _serialize(order)



@router.get("/menu", response_model=list[dict])
def list_order_menu(
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if branch_id:
        _assert_branch_access(db, current_user, branch_id)
    q = db.query(MenuItem).filter(MenuItem.company_id == current_user.company_id, MenuItem.is_available.is_(True))
    if branch_id:
        q = q.join(Menu, MenuItem.menu_id == Menu.id).filter(
            or_(Menu.branch_id == branch_id, Menu.branch_id.is_(None))
        )
    return [{"id": m.id, "code": m.code, "name": m.name, "price": float(m.price or 0), "tax_rate": float(m.tax_rate or 0), "recipe_id": m.recipe_id, "finished_item_id": m.finished_item_id} for m in q.order_by(MenuItem.name.asc()).all()]

@router.get("", response_model=List[OrderResponse])
def list_orders(
    branch_id: Optional[str] = None,
    source: Optional[str] = Query(None, pattern="^(ZOMATO|SWIGGY|MANUAL)$"),
    order_status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if branch_id:
        _assert_branch_access(db, current_user, branch_id)
    else:
        branch_id = next((b.branch_id for b in current_user.branches if b.is_default), None)

    q = db.query(RestaurantOrder).options(joinedload(RestaurantOrder.items)).filter(
        RestaurantOrder.company_id == current_user.company_id
    )
    if branch_id:
        q = q.filter(RestaurantOrder.branch_id == branch_id)
    if source:
        q = q.filter(RestaurantOrder.source == source)
    if order_status:
        q = q.filter(RestaurantOrder.status == order_status)
    orders = q.order_by(desc(RestaurantOrder.created_at)).limit(limit).all()
    return [_serialize(o) for o in orders]


@router.get("/stats", response_model=OrderStatsResponse)
def order_stats(
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if branch_id:
        _assert_branch_access(db, current_user, branch_id)
    else:
        branch_id = next((b.branch_id for b in current_user.branches if b.is_default), None)

    base = [RestaurantOrder.company_id == current_user.company_id]
    if branch_id:
        base.append(RestaurantOrder.branch_id == branch_id)
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    today = db.query(RestaurantOrder).filter(*base, RestaurantOrder.created_at >= start).all()
    open_count = db.query(func.count(RestaurantOrder.id)).filter(*base, RestaurantOrder.status.notin_(["COMPLETED", "CANCELLED"])).scalar() or 0
    completed = db.query(func.count(RestaurantOrder.id)).filter(*base, RestaurantOrder.status == "COMPLETED").scalar() or 0
    return OrderStatsResponse(
        today_orders=len(today),
        today_revenue=sum((Decimal(str(o.total_amount or 0)) for o in today), Decimal("0")),
        open_orders=int(open_count),
        completed_orders=int(completed),
        zomato_orders=sum(1 for o in today if o.source == "ZOMATO"),
        swiggy_orders=sum(1 for o in today if o.source == "SWIGGY"),
        manual_orders=sum(1 for o in today if o.source == "MANUAL"),
    )


@router.get("/kds", response_model=List[OrderResponse])
def kitchen_display_orders(
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if branch_id:
        _assert_branch_access(db, current_user, branch_id)
    else:
        branch_id = next((b.branch_id for b in current_user.branches if b.is_default), None)
    q = db.query(RestaurantOrder).options(joinedload(RestaurantOrder.items)).filter(
        RestaurantOrder.company_id == current_user.company_id,
        RestaurantOrder.status.in_(["OPEN", "SENT_TO_KITCHEN", "IN_PREPARATION", "READY", "SERVED"]),
    )
    if branch_id:
        q = q.filter(RestaurantOrder.branch_id == branch_id)
    orders = q.order_by(RestaurantOrder.created_at.asc()).limit(200).all()
    return [_serialize(o) for o in orders]


@router.post("/{order_id}/kds-status", response_model=OrderResponse)
def update_kds_status(
    order_id: str,
    new_status: str = Query(..., pattern="^(SENT_TO_KITCHEN|IN_PREPARATION|READY|SERVED|CANCELLED)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = db.query(RestaurantOrder).options(joinedload(RestaurantOrder.items)).filter(
        RestaurantOrder.id == order_id,
        RestaurantOrder.company_id == current_user.company_id,
    ).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _assert_branch_access(db, current_user, order.branch_id)
    allowed = {
        "OPEN": {"SENT_TO_KITCHEN", "CANCELLED"},
        "SENT_TO_KITCHEN": {"IN_PREPARATION", "CANCELLED"},
        "IN_PREPARATION": {"READY", "CANCELLED"},
        "READY": {"SERVED", "CANCELLED"},
        "SERVED": set(),
        "COMPLETED": set(),
        "CANCELLED": set(),
    }
    if new_status not in allowed.get(order.status, set()):
        raise HTTPException(status_code=400, detail=f"Invalid KDS transition: {order.status} -> {new_status}")
    order.status = new_status
    item_status = {
        "SENT_TO_KITCHEN": "PENDING",
        "IN_PREPARATION": "PREPARING",
        "READY": "READY",
        "SERVED": "SERVED",
        "CANCELLED": "CANCELLED",
    }.get(new_status)
    if item_status:
        for item in order.items:
            if item.status != "CANCELLED":
                item.status = item_status
    db.add(AuditLog(
        user_id=current_user.id,
        action="KDS_STATUS",
        entity_type="RestaurantOrder",
        entity_id=order.id,
        details=json.dumps({"order_number": order.order_number, "status": new_status}),
    ))
    db.commit()
    db.refresh(order)
    return _serialize(order)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = db.query(RestaurantOrder).options(joinedload(RestaurantOrder.items)).filter(
        RestaurantOrder.id == order_id,
        RestaurantOrder.company_id == current_user.company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _assert_branch_access(db, current_user, order.branch_id)
    return _serialize(order)


@router.post("/{order_id}/complete", response_model=OrderResponse)
def complete_order(
    order_id: str,
    payload: OrderCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = db.query(RestaurantOrder).options(joinedload(RestaurantOrder.items)).filter(
        RestaurantOrder.id == order_id,
        RestaurantOrder.company_id == current_user.company_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _assert_branch_access(db, current_user, order.branch_id)
    if order.status == "COMPLETED":
        return _serialize(order)
    if order.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cancelled order cannot be completed")

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == payload.warehouse_id,
        Warehouse.company_id == current_user.company_id,
        Warehouse.is_active.is_(True),
    ).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Stock warehouse not found")
    if warehouse.branch_id and warehouse.branch_id != order.branch_id:
        raise HTTPException(status_code=400, detail="Warehouse does not belong to order outlet")

    # Build recipe consumption first so insufficient stock fails before any ledger is posted.
    consumption = {}
    for line in order.items:
        menu = db.query(MenuItem).filter(MenuItem.id == line.item_id, MenuItem.company_id == current_user.company_id).first()
        if not menu:
            raise HTTPException(status_code=400, detail=f"Menu item missing: {line.item_id}")
        recipe = None
        if menu.recipe_id:
            recipe = db.query(Recipe).options(joinedload(Recipe.ingredients)).filter(
                Recipe.id == menu.recipe_id,
                Recipe.company_id == current_user.company_id,
                Recipe.is_active.is_(True),
            ).first()
        if recipe:
            yield_qty = Decimal(str(recipe.yield_qty or 1))
            for ing in recipe.ingredients:
                base_qty = Decimal(str(ing.gross_quantity or ing.quantity or 0))
                waste_pct = Decimal(str(ing.waste_percentage or 0))
                required_recipe_unit = (base_qty / yield_qty) * Decimal(str(line.quantity)) * (Decimal("1") + waste_pct / Decimal("100"))
                raw_item = db.query(Item).filter(Item.id == ing.raw_item_id, Item.company_id == current_user.company_id).first()
                if not raw_item:
                    raise HTTPException(status_code=400, detail=f"Raw item missing: {ing.raw_item_id}")
                try:
                    required = convert_quantity(db, current_user.company_id, required_recipe_unit, ing.unit_id, raw_item.unit_id)
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail=str(exc)) from exc
                consumption[ing.raw_item_id] = consumption.get(ing.raw_item_id, Decimal("0")) + required
        elif menu.finished_item_id:
            consumption[menu.finished_item_id] = consumption.get(menu.finished_item_id, Decimal("0")) + Decimal(str(line.quantity))

    for item_id, qty in consumption.items():
        bal = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_id).with_for_update().first()
        available = Decimal(str(bal.quantity if bal else 0))
        if available < qty:
            item_name = db.query(MenuItem.name).filter(MenuItem.finished_item_id == item_id).first()
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item_id}: need {qty}, available {available}")

    for item_id, qty in consumption.items():
        bal = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_id).with_for_update().first()
        if not bal:
            raise HTTPException(status_code=400, detail=f"Stock balance missing for item {item_id}")
        new_balance = Decimal(str(bal.quantity)) - qty
        if new_balance < 0:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item_id}")
        bal.quantity = new_balance
        db.add(StockLedger(
            company_id=current_user.company_id,
            branch_id=order.branch_id,
            warehouse_id=warehouse.id,
            item_id=item_id,
            movement_type=StockMovementType.POS_SALE.value,
            change_qty=-qty,
            balance_qty=bal.quantity,
            reference_type="RESTAURANT_ORDER",
            reference_id=order.id,
            created_by_id=current_user.id,
            idempotency_key=f"pos_sale:{order.id}:{item_id}",
            notes=f"Auto stock deduction for {order.order_number}",
        ))

    # Optional POS payment reconciliation: new cashier-aware checkout callers provide payment method/session.
    if payload.payment_method:
        session = None
        if payload.session_id:
            session = db.query(CashSession).filter(
                CashSession.id == payload.session_id,
                CashSession.company_id == current_user.company_id,
                CashSession.branch_id == order.branch_id,
                CashSession.cashier_id == current_user.id,
                CashSession.status == CashSessionStatus.OPEN.value,
            ).first()
        else:
            session = db.query(CashSession).filter(
                CashSession.company_id == current_user.company_id,
                CashSession.branch_id == order.branch_id,
                CashSession.cashier_id == current_user.id,
                CashSession.status == CashSessionStatus.OPEN.value,
            ).order_by(CashSession.opened_at.desc()).first()
        if not session:
            raise HTTPException(status_code=400, detail='An open cashier shift is required for reconciled POS payment.')
        received = Decimal(str(payload.received_amount if payload.received_amount is not None else order.total_amount))
        if payload.payment_method == 'CASH' and received < Decimal(str(order.total_amount)):
            raise HTTPException(status_code=400, detail='Cash received cannot be below order total.')
        if payload.payment_method == 'CASH':
            movement_type = CashMovementType.CASH_SALE.value
            amount = Decimal(str(order.total_amount))
            reason = f'POS cash sale {order.order_number}; received={received}; change={received-amount}'
        elif payload.payment_method == 'UPI':
            movement_type = CashMovementType.UPI_SALE.value; amount = Decimal(str(order.total_amount)); reason = f'POS UPI sale {order.order_number}'
        else:
            movement_type = CashMovementType.CARD_SALE.value; amount = Decimal(str(order.total_amount)); reason = f'POS card sale {order.order_number}'
        db.add(CashMovement(company_id=current_user.company_id, session_id=session.id, branch_id=order.branch_id, created_by_id=current_user.id, order_id=order.id, movement_type=movement_type, amount=amount, reason=reason))

    order.status = OrderStatus.COMPLETED.value
    order.paid_amount = order.total_amount
    if order.table_id:
        table = db.query(DiningTable).filter(DiningTable.id == order.table_id).first()
        if table and table.active_order_id == order.id:
            table.active_order_id = None
            table.status = "CLEANING"

    db.add(AuditLog(
        user_id=current_user.id,
        action="COMPLETE",
        entity_type="RestaurantOrder",
        entity_id=order.id,
        details=json.dumps({"action": "Auto stock deduction", "warehouse_id": warehouse.id, "order_number": order.order_number}),
    ))
    db.commit()
    db.refresh(order)
    return _serialize(order)

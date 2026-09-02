import uuid
from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    InsufficientStockException,
)
from app.models.user import User
from app.models.organization import Branch, Warehouse
from app.models.inventory import Item, StockBalance
from app.models.recipe import Recipe
from app.models.kitchen_order import KitchenOrder, KitchenOrderStatus
from app.schemas.kitchen_order import (
    KitchenOrderAvailableItem,
    KitchenOrderCancelRequest,
    KitchenOrderCreate,
    KitchenOrderDispatchRequest,
    KitchenOrderReceiveRequest,
    KitchenOrderResponse,
    KitchenOrderStartProductionRequest,
)
from app.services.stock import StockService

router = APIRouter()

# Roles that can manage the full outlet-wise kitchen order queue (produce/dispatch).
KITCHEN_ORDER_MANAGER_ROLES = {
    "SUPER_ADMIN", "SUPERADMIN", "OWNER", "ADMIN", "HQ_ADMIN", "HEAD_OFFICE_ADMIN",
    "CENTRAL_PURCHASE_MANAGER", "CENTRAL_STORE_MANAGER", "DESSERT_KITCHEN_HEAD",
    "GENERAL_MANAGER", "DIRECTOR", "KITCHEN_CHEF", "PRODUCTION_MANAGER",
}

CENTRAL_BRANCH_TYPES = {"CENTRAL_STORE", "DESSERT_KITCHEN", "HEAD_OFFICE"}

FINISHED_TYPES = {"FINISHED_GOOD", "SEMI_FINISHED"}


def _role_name(user: User) -> str:
    return (user.role.name if user.role else "").strip().upper()


def _is_kitchen_manager(user: User) -> bool:
    return _role_name(user) in KITCHEN_ORDER_MANAGER_ROLES


def _user_branch_ids(user: User) -> set:
    return {ub.branch_id for ub in (user.branches or [])}


def _resolve_kitchen_warehouse(company_id: str, db: Session) -> Warehouse:
    """
    Resolve the Central/Production Kitchen warehouse that fulfils outlet kitchen orders.
    Priority:
      1. An explicitly central warehouse (is_central=True)
      2. A warehouse belonging to a CENTRAL_STORE / DESSERT_KITCHEN / HEAD_OFFICE branch
    """
    wh = (
        db.query(Warehouse)
        .filter(Warehouse.company_id == company_id, Warehouse.is_central == True, Warehouse.is_active == True)
        .order_by(Warehouse.created_at.asc())
        .first()
    )
    if wh:
        return wh

    wh = (
        db.query(Warehouse)
        .join(Branch, Branch.id == Warehouse.branch_id)
        .filter(
            Warehouse.company_id == company_id,
            Warehouse.is_active == True,
            Branch.type.in_(list(CENTRAL_BRANCH_TYPES)),
        )
        .order_by(Warehouse.created_at.asc())
        .first()
    )
    if wh:
        return wh

    raise BadRequestException(
        "No central production kitchen warehouse configured. "
        "Create a central warehouse (is_central=True) under a CENTRAL_STORE / DESSERT_KITCHEN / HEAD_OFFICE branch "
        "or run production in Recipes & Production so finished stock can be dispatched."
    )


def _resolve_outlet_warehouse(branch_id: str, db: Session) -> Warehouse:
    wh = (
        db.query(Warehouse)
        .filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True)
        .order_by(Warehouse.created_at.asc())
        .first()
    )
    if not wh:
        raise BadRequestException(
            f"No active warehouse found for outlet branch '{branch_id}'. Create a warehouse for this outlet before receiving."
        )
    return wh
def _format_kitchen_order(order: KitchenOrder, db: Session, user: User) -> KitchenOrderResponse:
    item = order.item
    unit_symbol = item.unit.symbol if item.unit else None
    kitchen_wh_name = order.kitchen_warehouse.name if order.kitchen_warehouse else None
    received_wh_name = order.received_warehouse.name if order.received_warehouse else None

    kitchen_available = None
    if _is_kitchen_manager(user) and order.status in (
        KitchenOrderStatus.SUBMITTED,
        KitchenOrderStatus.IN_PRODUCTION,
        KitchenOrderStatus.DISPATCHED,
        KitchenOrderStatus.PARTIALLY_RECEIVED,
    ):
        wh_id = order.kitchen_warehouse_id
        if not wh_id:
            try:
                wh = _resolve_kitchen_warehouse(order.company_id, db)
                wh_id = wh.id
                kitchen_wh_name = wh.name
            except Exception:
                wh_id = None
        if wh_id:
            bal = (
                db.query(StockBalance)
                .filter(StockBalance.warehouse_id == wh_id, StockBalance.item_id == order.item_id)
                .first()
            )
            kitchen_available = (bal.quantity if bal else Decimal("0.0000"))

    def _person_name(u) -> Optional[str]:
        if not u:
            return None
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or (u.email or None)

    return KitchenOrderResponse(
        id=order.id,
        company_id=order.company_id,
        branch_id=order.branch_id,
        branch_name=order.branch.name if order.branch else None,
        branch_code=order.branch.code if order.branch else None,
        branch_type=order.branch.type if order.branch else None,
        item_id=order.item_id,
        item_name=item.name if item else None,
        item_code=item.code if item else None,
        item_type=item.type.value if item and hasattr(item.type, "value") else (item.type if item else None),
        unit_symbol=unit_symbol,
        order_number=order.order_number,
        requested_qty=Decimal(str(order.requested_qty or 0)),
        dispatched_qty=Decimal(str(order.dispatched_qty or 0)),
        received_qty=Decimal(str(order.received_qty or 0)),
        status=order.status.value if hasattr(order.status, "value") else str(order.status),
        required_date=order.required_date,
        notes=order.notes,
        kitchen_warehouse_id=order.kitchen_warehouse_id,
        kitchen_warehouse_name=kitchen_wh_name,
        kitchen_available_qty=kitchen_available,
        batch_number=order.batch_number,
        expiry_date=order.expiry_date,
        dispatched_by=_person_name(order.dispatched_by),
        dispatched_at=order.dispatched_at,
        dispatch_notes=order.dispatch_notes,
        received_warehouse_id=order.received_warehouse_id,
        received_warehouse_name=received_wh_name,
        received_by=_person_name(order.received_by),
        received_at=order.received_at,
        receive_notes=order.receive_notes,
        cancelled_by=_person_name(order.cancelled_by),
        cancelled_at=order.cancelled_at,
        cancel_reason=order.cancel_reason,
        created_by=_person_name(order.created_by),
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("/available-items", response_model=List[KitchenOrderAvailableItem])
def list_kitchen_order_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    search: Optional[str] = Query(None),
):
    """
    Finished / semi-finished items available for Kitchen Orders.
    Uses only real Items from the Item Master (no fake/derived items).
    """
    query = (
        db.query(Item)
        .filter(
            Item.company_id == current_user.company_id,
            Item.is_active == True,
            Item.type.in_(list(FINISHED_TYPES)),
        )
    )
    if search:
        pattern = f"%{search}%"
        query = query.filter((Item.name.ilike(pattern)) | (Item.code.ilike(pattern)))

    items = query.order_by(Item.name.asc()).all()

    active_recipe_finished_ids = {
        rid
        for (rid,) in (
            db.query(Recipe.finished_item_id)
            .filter(
                Recipe.company_id == current_user.company_id,
                Recipe.is_active == True,
                Recipe.is_current == True,
            )
            .all()
        )
    }

    results = []
    for it in items:
        item_type = it.type.value if hasattr(it.type, "value") else str(it.type)
        results.append(
            KitchenOrderAvailableItem(
                id=it.id,
                code=it.code,
                name=it.name,
                type=item_type,
                category_name=it.category.name if it.category else None,
                unit_symbol=it.unit.symbol if it.unit else None,
                cost_price=Decimal(str(it.cost_price or 0)),
                selling_price=Decimal(str(it.selling_price or 0)),
                has_recipe=it.id in active_recipe_finished_ids,
            )
        )
    return results
@router.get("", response_model=List[KitchenOrderResponse])
def list_kitchen_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    branch_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    query = db.query(KitchenOrder).filter(KitchenOrder.company_id == current_user.company_id)

    if not _is_kitchen_manager(current_user):
        # Outlet users only see their own outlet's orders.
        branch_ids = _user_branch_ids(current_user)
        if not branch_ids:
            raise ForbiddenException("No outlet branches are assigned to this user.")
        query = query.filter(KitchenOrder.branch_id.in_(list(branch_ids)))
    elif branch_id:
        query = query.filter(KitchenOrder.branch_id == branch_id)

    if status_filter:
        query = query.filter(KitchenOrder.status == status_filter)

    orders = query.order_by(KitchenOrder.created_at.desc()).all()
    return [_format_kitchen_order(o, db, current_user) for o in orders]


@router.post("", response_model=KitchenOrderResponse, status_code=status.HTTP_201_CREATED)
def create_kitchen_order(
    payload: KitchenOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise NotFoundException("Outlet branch", payload.branch_id)

    if not _is_kitchen_manager(current_user):
        if payload.branch_id not in _user_branch_ids(current_user):
            raise ForbiddenException(
                f"Access denied: User is not authorized to create kitchen orders for outlet '{branch.name or payload.branch_id}'."
            )

    item = (
        db.query(Item)
        .filter(
            Item.id == payload.item_id,
            Item.company_id == current_user.company_id,
            Item.is_active == True,
        )
        .first()
    )
    if not item:
        raise NotFoundException("Item", payload.item_id)

    item_type = item.type.value if hasattr(item.type, "value") else str(item.type)
    if item_type not in FINISHED_TYPES:
        raise BadRequestException(
            f"Kitchen Orders can only be raised for FINISHED_GOOD / SEMI_FINISHED items (selected '{item_type}')."
        )

    requested_qty = Decimal(str(payload.requested_qty))
    if requested_qty <= Decimal("0.0000"):
        raise BadRequestException("Requested quantity must be greater than zero.")

    today = datetime.utcnow().strftime("%Y%m%d")
    count = (
        db.query(KitchenOrder)
        .filter(
            KitchenOrder.company_id == current_user.company_id,
            KitchenOrder.order_number.like(f"KO-{today}-%"),
        )
        .count()
    )
    order_number = f"KO-{today}-{str(count + 1).zfill(4)}"

    order = KitchenOrder(
        company_id=current_user.company_id,
        branch_id=branch.id,
        item_id=item.id,
        order_number=order_number,
        requested_qty=requested_qty,
        dispatched_qty=Decimal("0.0000"),
        received_qty=Decimal("0.0000"),
        status="SUBMITTED",
        required_date=payload.required_date,
        notes=payload.notes.strip() if payload.notes else None,
        kitchen_warehouse_id=payload.kitchen_warehouse_id,
        created_by_id=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return _format_kitchen_order(order, db, current_user)


@router.get("/{order_id}", response_model=KitchenOrderResponse)
def get_kitchen_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = (
        db.query(KitchenOrder)
        .filter(KitchenOrder.id == order_id, KitchenOrder.company_id == current_user.company_id)
        .first()
    )
    if not order:
        raise NotFoundException("Kitchen order", order_id)

    if not _is_kitchen_manager(current_user) and order.branch_id not in _user_branch_ids(current_user):
        raise ForbiddenException("Access denied: User cannot view this kitchen order.")

    return _format_kitchen_order(order, db, current_user)


@router.post("/{order_id}/cancel", response_model=KitchenOrderResponse)
def cancel_kitchen_order(
    order_id: str,
    payload: KitchenOrderCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    order = (
        db.query(KitchenOrder)
        .filter(KitchenOrder.id == order_id, KitchenOrder.company_id == current_user.company_id)
        .first()
    )
    if not order:
        raise NotFoundException("Kitchen order", order_id)

    if not _is_kitchen_manager(current_user) and order.branch_id not in _user_branch_ids(current_user):
        raise ForbiddenException("Access denied: User cannot cancel this kitchen order.")

    if order.status not in (KitchenOrderStatus.SUBMITTED, KitchenOrderStatus.IN_PRODUCTION):
        current_status = order.status.value if hasattr(order.status, "value") else order.status
        raise BadRequestException(f"Cannot cancel a kitchen order in status '{current_status}'.")

    order.status = "CANCELLED"
    order.cancel_reason = payload.reason.strip()
    order.cancelled_by_id = current_user.id
    order.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return _format_kitchen_order(order, db, current_user)
@router.post("/{order_id}/start-production", response_model=KitchenOrderResponse)
def start_kitchen_order_production(
    order_id: str,
    payload: KitchenOrderStartProductionRequest = KitchenOrderStartProductionRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not _is_kitchen_manager(current_user):
        raise ForbiddenException("Only the Central/Production Kitchen can acknowledge and produce kitchen orders.")

    order = (
        db.query(KitchenOrder)
        .filter(KitchenOrder.id == order_id, KitchenOrder.company_id == current_user.company_id)
        .first()
    )
    if not order:
        raise NotFoundException("Kitchen order", order_id)

    if order.status != KitchenOrderStatus.SUBMITTED:
        raise BadRequestException("Only SUBMITTED kitchen orders can be moved into production.")

    if payload.kitchen_warehouse_id:
        wh = (
            db.query(Warehouse)
            .filter(Warehouse.id == payload.kitchen_warehouse_id, Warehouse.company_id == current_user.company_id)
            .first()
        )
        if not wh:
            raise NotFoundException("Warehouse", payload.kitchen_warehouse_id)
        order.kitchen_warehouse_id = wh.id
    else:
        order.kitchen_warehouse_id = _resolve_kitchen_warehouse(current_user.company_id, db).id

    order.status = "IN_PRODUCTION"
    if payload.notes:
        note = payload.notes.strip()
        order.dispatch_notes = (
            f"{order.dispatch_notes + ' | ' if order.dispatch_notes else ''}Production note: {note}"
        )
    db.commit()
    db.refresh(order)
    return _format_kitchen_order(order, db, current_user)


@router.post("/{order_id}/dispatch", response_model=KitchenOrderResponse)
def dispatch_kitchen_order(
    order_id: str,
    payload: KitchenOrderDispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Central/Production Kitchen produces or allocates the finished/semi-finished
    quantity and dispatches it to the requesting outlet. Deducts stock from the
    central kitchen warehouse (writes StockLedger) so the outlet can receive it.
    """
    if not _is_kitchen_manager(current_user):
        raise ForbiddenException("Only the Central/Production Kitchen can dispatch kitchen orders.")

    order = (
        db.query(KitchenOrder)
        .filter(KitchenOrder.id == order_id, KitchenOrder.company_id == current_user.company_id)
        .first()
    )
    if not order:
        raise NotFoundException("Kitchen order", order_id)

    current_status = order.status.value if hasattr(order.status, "value") else order.status
    if order.status not in (
        KitchenOrderStatus.SUBMITTED,
        KitchenOrderStatus.IN_PRODUCTION,
        KitchenOrderStatus.DISPATCHED,
        KitchenOrderStatus.PARTIALLY_RECEIVED,
    ):
        raise BadRequestException(f"Cannot dispatch a kitchen order in status '{current_status}'.")

    requested = Decimal(str(order.requested_qty or 0))
    fully_received = Decimal(str(order.received_qty or 0))
    already_dispatched = Decimal(str(order.dispatched_qty or 0))
    remaining_to_dispatch = (requested - fully_received).max(Decimal("0.0000"))

    if remaining_to_dispatch <= Decimal("0.0000"):
        raise BadRequestException("This kitchen order is already fully received.")

    dispatch_qty = Decimal(str(payload.dispatched_qty)) if payload.dispatched_qty is not None else remaining_to_dispatch
    if dispatch_qty <= Decimal("0.0000"):
        raise BadRequestException("Dispatch quantity must be greater than zero.")
    if dispatch_qty > remaining_to_dispatch:
        raise BadRequestException(
            f"Dispatch quantity {dispatch_qty} exceeds remaining requirement {remaining_to_dispatch}."
        )

    # Resolve the central kitchen warehouse that will dispatch.
    kitchen_wh = None
    if payload.kitchen_warehouse_id:
        kitchen_wh = (
            db.query(Warehouse)
            .filter(
                Warehouse.id == payload.kitchen_warehouse_id,
                Warehouse.company_id == current_user.company_id,
            )
            .first()
        )
        if not kitchen_wh:
            raise NotFoundException("Warehouse", payload.kitchen_warehouse_id)
    else:
        if order.kitchen_warehouse_id:
            kitchen_wh = db.query(Warehouse).filter(Warehouse.id == order.kitchen_warehouse_id).first()
        if not kitchen_wh:
            kitchen_wh = _resolve_kitchen_warehouse(current_user.company_id, db)

    # Ensure stock availability at the kitchen warehouse.
    balance = (
        db.query(StockBalance)
        .filter(StockBalance.warehouse_id == kitchen_wh.id, StockBalance.item_id == order.item_id)
        .with_for_update()
        .first()
    )
    available = Decimal(str(balance.quantity if balance else 0))

    if available < dispatch_qty:
        unit = order.item.unit.symbol if order.item.unit else "units"
        raise InsufficientStockException(
            item=order.item.name,
            required=float(dispatch_qty),
            available=float(available),
            unit=unit,
        )

    # Deduct central kitchen stock (ledger movement KITCHEN_DISPATCH).
    stock_service = StockService(db)
    stock_service.post_stock_movement(
        warehouse_id=kitchen_wh.id,
        item_id=order.item_id,
        change_qty=-dispatch_qty,
        movement_type="KITCHEN_DISPATCH",
        reference_type="KITCHEN_ORDER",
        reference_id=order.id,
        batch_number=payload.batch_number,
        expiry_date=payload.expiry_date,
        user_id=current_user.id,
        idempotency_key=f"ko_dispatch_{order.id}_{dispatch_qty}",
    )

    order.kitchen_warehouse_id = kitchen_wh.id
    order.dispatched_qty = already_dispatched + dispatch_qty
    order.batch_number = payload.batch_number or order.batch_number
    order.expiry_date = payload.expiry_date or order.expiry_date
    order.status = "DISPATCHED"
    order.dispatched_by_id = current_user.id
    order.dispatched_at = datetime.utcnow()
    if payload.notes:
        note = payload.notes.strip()
        order.dispatch_notes = f"{order.dispatch_notes + ' | ' if order.dispatch_notes else ''}{note}"

    db.commit()
    db.refresh(order)
    return _format_kitchen_order(order, db, current_user)


@router.post("/{order_id}/receive", response_model=KitchenOrderResponse)
def receive_kitchen_order(
    order_id: str,
    payload: KitchenOrderReceiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Outlet receives the dispatched finished/semi-finished goods. Stock increases
    in the outlet's warehouse (StockBalance + StockLedger KITCHEN_RECEIVE).
    """
    order = (
        db.query(KitchenOrder)
        .filter(KitchenOrder.id == order_id, KitchenOrder.company_id == current_user.company_id)
        .first()
    )
    if not order:
        raise NotFoundException("Kitchen order", order_id)

    if not _is_kitchen_manager(current_user) and order.branch_id not in _user_branch_ids(current_user):
        raise ForbiddenException("Access denied: User cannot receive this kitchen order.")

    current_status = order.status.value if hasattr(order.status, "value") else order.status
    if order.status not in (KitchenOrderStatus.DISPATCHED, KitchenOrderStatus.PARTIALLY_RECEIVED):
        raise BadRequestException(f"Only DISPATCHED kitchen orders can be received (current '{current_status}').")

    dispatched = Decimal(str(order.dispatched_qty or 0))
    received = Decimal(str(order.received_qty or 0))
    receivable = (dispatched - received).max(Decimal("0.0000"))

    if receivable <= Decimal("0.0000"):
        raise BadRequestException("Nothing left to receive for this kitchen order.")

    accepted_qty = Decimal(str(payload.accepted_qty)) if payload.accepted_qty is not None else receivable
    if accepted_qty <= Decimal("0.0000"):
        raise BadRequestException("Accepted quantity must be greater than zero.")
    if accepted_qty > receivable:
        raise BadRequestException(f"Accepted quantity {accepted_qty} exceeds receivable quantity {receivable}.")

    # Resolve the outlet (destination) warehouse.
    outlet_wh = None
    if payload.received_warehouse_id:
        outlet_wh = (
            db.query(Warehouse)
            .filter(Warehouse.id == payload.received_warehouse_id, Warehouse.company_id == current_user.company_id)
            .first()
        )
        if not outlet_wh:
            raise NotFoundException("Warehouse", payload.received_warehouse_id)
    else:
        if order.received_warehouse_id:
            outlet_wh = db.query(Warehouse).filter(Warehouse.id == order.received_warehouse_id).first()
        if not outlet_wh:
            outlet_wh = _resolve_outlet_warehouse(order.branch_id, db)

    # Increase outlet stock (ledger movement KITCHEN_RECEIVE).
    stock_service = StockService(db)
    stock_service.post_stock_movement(
        warehouse_id=outlet_wh.id,
        item_id=order.item_id,
        change_qty=accepted_qty,
        movement_type="KITCHEN_RECEIVE",
        reference_type="KITCHEN_ORDER",
        reference_id=order.id,
        batch_number=order.batch_number,
        expiry_date=order.expiry_date,
        user_id=current_user.id,
        idempotency_key=f"ko_receive_{order.id}_{accepted_qty}",
    )

    order.received_warehouse_id = outlet_wh.id
    order.received_qty = received + accepted_qty
    requested = Decimal(str(order.requested_qty or 0))
    if (received + accepted_qty) >= requested:
        order.status = "RECEIVED"
    else:
        order.status = "PARTIALLY_RECEIVED"
    order.received_by_id = current_user.id
    order.received_at = datetime.utcnow()
    if payload.notes:
        note = payload.notes.strip()
        order.receive_notes = f"{order.receive_notes + ' | ' if order.receive_notes else ''}{note}"

    db.commit()
    db.refresh(order)
    return _format_kitchen_order(order, db, current_user)
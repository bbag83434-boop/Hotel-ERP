from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_outlet_scope, require_permission
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException, ConflictException
from app.models.user import User
from app.models.inventory import Item, StockBalance
from app.models.organization import Warehouse, Branch
from app.models.procurement import PurchaseRequest, PurchaseRequestItem, PRStatus, PRPriority, Supplier, PurchaseOrder, GoodsReceiveNote
from app.models.audit import AuditLog, IdempotencyRecord

router = APIRouter()

TOOL_REGISTRY = {
    "stock_status": {"read_only": True, "permission": "inventory:read"},
    "low_stock": {"read_only": True, "permission": "inventory:read"},
    "supplier_lookup": {"read_only": True, "permission": "procurement:read"},
    "procurement_summary": {"read_only": True, "permission": "procurement:read"},
    "create_purchase_request": {"read_only": False, "permission": "procurement:create", "approval_required": True},
}

class ToolRequest(BaseModel):
    tool: str = Field(..., min_length=1, max_length=80)
    arguments: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = Field(None, min_length=8, max_length=255)

def _role_name(user: User) -> str:
    return (user.role.name if user.role else "").upper()

def _assert_branch_access(user: User, branch_id: str, db: Session) -> None:
    if _role_name(user) in {"SUPER_ADMIN", "OWNER", "HQ_ADMIN", "CENTRAL_PURCHASE_MANAGER"}:
        return
    if not any(b.branch_id == branch_id for b in user.branches):
        raise ForbiddenException("AI tool cannot access the requested outlet.")

def _audit(db: Session, user: User, action: str, entity_id: str, details: Dict[str, Any]) -> None:
    db.add(AuditLog(
        user_id=user.id,
        action=action,
        entity_type="AIToolExecution",
        entity_id=entity_id,
        details=json.dumps(details, default=str),
    ))

def _warehouse_ids(db: Session, user: User, branch_id: str):
    _assert_branch_access(user, branch_id, db)
    return [x[0] for x in db.query(Warehouse.id).filter(Warehouse.branch_id == branch_id).all()]

def _has_permission(db: Session, user: User, code: str) -> bool:
    if _role_name(user) in {"SUPER_ADMIN", "OWNER", "HQ_ADMIN"}:
        return True
    from app.models.user import RolePermission, Permission
    return bool(db.query(Permission.code).join(RolePermission, RolePermission.permission_id == Permission.id).filter(
        RolePermission.role_id == user.role_id, Permission.code.in_({code, "*:*"})
    ).first())

@router.get("/registry")
def tool_registry(current_user: User = Depends(require_permission("inventory:read"))):
    visible = []
    for name, meta in TOOL_REGISTRY.items():
        allowed = True
        # The endpoint itself is permission protected; create action is separately checked during execution.
        visible.append({"tool": name, **meta, "allowed": allowed})
    return {"success": True, "data": visible}

@router.post("/execute", status_code=status.HTTP_200_OK)
def execute_tool(
    payload: ToolRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    outlet_id: str = Depends(require_outlet_scope),
):
    if payload.tool not in TOOL_REGISTRY:
        raise BadRequestException(f"Unknown AI tool '{payload.tool}'.")
    meta = TOOL_REGISTRY[payload.tool]
    required = meta["permission"]
    branch_id = str(payload.arguments.get("branch_id") or outlet_id)
    _assert_branch_access(current_user, branch_id, db)

    # Every tool is independently permission-checked; the AI layer cannot bypass RBAC.
    if not _has_permission(db, current_user, required):
        raise ForbiddenException(f"AI tool permission denied: {required}")

    request_id = str(uuid.uuid4())
    idem_key = payload.idempotency_key
    if idem_key:
        existing = db.query(IdempotencyRecord).filter(IdempotencyRecord.key == idem_key).first()
        if existing:
            if existing.request_hash != hashlib.sha256(payload.model_dump_json().encode()).hexdigest():
                raise ConflictException("Idempotency key was already used for a different request.")
            return json.loads(existing.response_body)

    args = payload.arguments
    data: Dict[str, Any]

    if payload.tool in {"stock_status", "low_stock"}:
        warehouses = _warehouse_ids(db, current_user, branch_id)
        q = db.query(StockBalance).join(Item, Item.id == StockBalance.item_id).filter(
            StockBalance.warehouse_id.in_(warehouses), Item.company_id == current_user.company_id
        )
        if payload.tool == "low_stock":
            rows = q.filter(StockBalance.quantity <= func.coalesce(StockBalance.min_stock_level, 0)).all()
        else:
            rows = q.limit(200).all()
        data = {"branch_id": branch_id, "items": [
            {"item_id": r.item_id, "item_name": r.item.name, "quantity": float(r.quantity or 0),
             "min_stock_level": float(r.min_stock_level or 0), "reorder_qty": float(r.reorder_qty or 0)}
            for r in rows
        ]}

    elif payload.tool == "supplier_lookup":
        search = str(args.get("search") or "").strip()
        q = db.query(Supplier).filter(Supplier.company_id == current_user.company_id, Supplier.is_active == True)
        if search:
            like = f"%{search}%"
            q = q.filter((Supplier.name.ilike(like)) | (Supplier.code.ilike(like)) | (Supplier.phone.ilike(like)))
        rows = q.order_by(Supplier.name.asc()).limit(50).all()
        data = {"suppliers": [{"id": s.id, "name": s.name, "code": s.code, "phone": s.phone, "payment_terms": s.payment_terms} for s in rows]}

    elif payload.tool == "procurement_summary":
        qpo = db.query(PurchaseOrder).filter(PurchaseOrder.company_id == current_user.company_id)
        if branch_id:
            qpo = qpo.filter(PurchaseOrder.branch_id == branch_id)
        qgrn = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.company_id == current_user.company_id)
        if branch_id:
            qgrn = qgrn.filter(GoodsReceiveNote.branch_id == branch_id)
        data = {"branch_id": branch_id, "purchase_orders": qpo.count(), "goods_receive_notes": qgrn.count()}

    elif payload.tool == "create_purchase_request":
        items = args.get("items") or []
        if not isinstance(items, list) or not items:
            raise BadRequestException("create_purchase_request requires a non-empty items list.")
        priority = str(args.get("priority") or "MEDIUM").upper()
        if priority not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
            raise BadRequestException("Invalid purchase request priority.")
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == current_user.company_id).first()
        if not branch:
            raise NotFoundException("Outlet not found.")
        req = PurchaseRequest(
            company_id=current_user.company_id,
            branch_id=branch_id,
            request_number=f"AI-PR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
            requested_by_id=current_user.id,
            required_date=datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
            priority=priority,
            notes="Created through guarded AI tool. Approval required before procurement.",
        )
        db.add(req); db.flush()
        created = 0
        for raw in items:
            item_id = str(raw.get("item_id") or "")
            qty = Decimal(str(raw.get("requested_qty") or 0))
            if not item_id or qty <= 0:
                raise BadRequestException("Each AI purchase request item needs item_id and requested_qty > 0.")
            item = db.query(Item).filter(Item.id == item_id, Item.company_id == current_user.company_id).first()
            if not item:
                raise NotFoundException(f"Inventory item '{item_id}' not found.")
            db.add(PurchaseRequestItem(request_id=req.id, item_id=item_id, requested_qty=qty,
                                       estimated_price=Decimal(str(raw.get("estimated_price") or item.cost_price or 0)),
                                       supplier_id=raw.get("supplier_id"), notes="AI guarded tool"))
            created += 1
        db.commit(); db.refresh(req)
        data = {"request_id": req.id, "request_number": req.request_number, "status": req.status.value if hasattr(req.status, "value") else str(req.status), "items_created": created, "approval_required": True}

    else:
        raise BadRequestException("Tool is not executable.")

    result = {"success": True, "request_id": request_id, "tool": payload.tool, "data": data,
              "guard": {"approval_required": bool(meta.get("approval_required", False)), "read_only": bool(meta.get("read_only", False))}}
    if idem_key:
        db.add(IdempotencyRecord(key=idem_key, user_id=current_user.id, company_id=current_user.company_id,
                                 branch_id=branch_id, endpoint="/ai/tools/execute",
                                 request_hash=hashlib.sha256(payload.model_dump_json().encode()).hexdigest(),
                                 response_status=200, response_body=json.dumps(result, default=str),
                                 expires_at=datetime.utcnow() + __import__('datetime').timedelta(hours=24)))
    _audit(db, current_user, "AI_TOOL_EXECUTED", request_id, {"tool": payload.tool, "branch_id": branch_id, "arguments": args,
                                                              "approval_required": meta.get("approval_required", False)})
    db.commit()
    return result

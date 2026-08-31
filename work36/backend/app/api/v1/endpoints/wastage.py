import json
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_head_office_role
from app.models.user import User, Role, UserBranch
from app.models.organization import Branch, Warehouse
from app.models.inventory import Item, Unit, StockBalance, StockLedger
from app.models.wastage import WastageEntry, WastageItem, WastageReasonCode, WastageStatus
from app.models.audit import AuditLog
from app.schemas.wastage import (
    WastageEntryCreate,
    WastageEntryUpdate,
    WastageEntryResponse,
    WastageItemResponse,
    WastageApprovalAction,
    WastageAnalyticsResponse,
)
from app.core.exceptions import (
    NotFoundException,
    ForbiddenException,
    BadRequestException,
)

router = APIRouter()

APPROVAL_THRESHOLD_COST = Decimal("1000.00")

def _check_branch_access(branch_id: str, current_user: User, db: Session) -> Branch:
    """Validate branch exists in user's company and user has access permissions."""
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.company_id == current_user.company_id
    ).first()
    if not branch:
        raise NotFoundException("Branch not found in company.")

    is_super_or_admin = False
    if current_user.role_id:
        role_obj = db.query(Role).filter(Role.id == current_user.role_id).first()
        if role_obj:
            role_name = role_obj.name.upper()
            if any(r in role_name for r in ["ADMIN", "SUPER", "DIRECTOR", "OWNER", "HQ", "GENERAL_MANAGER", "AREA", "CENTRAL", "MANAGER"]):
                is_super_or_admin = True

    if not is_super_or_admin:
        assigned = db.query(UserBranch).filter(
            UserBranch.user_id == current_user.id,
            UserBranch.branch_id == branch_id
        ).first()
        if not assigned:
            raise ForbiddenException("Access denied: You do not have permission for this outlet.")

    return branch

def _log_wastage_audit(
    db: Session,
    user: User,
    action: str,
    entry_id: str,
    details: Dict[str, Any]
):
    audit = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        action=action,
        entity="WastageEntry",
        entity_id=entry_id,
        details=json.dumps(details, default=str),
    )
    db.add(audit)

def _format_entry_response(entry: WastageEntry, db: Session) -> WastageEntryResponse:
    branch = db.query(Branch).filter(Branch.id == entry.branch_id).first()
    warehouse = db.query(Warehouse).filter(Warehouse.id == entry.warehouse_id).first()
    reporter = db.query(User).filter(User.id == entry.reported_by_id).first()
    approver = db.query(User).filter(User.id == entry.approved_by_id).first() if entry.approved_by_id else None

    formatted_items: List[WastageItemResponse] = []
    for item in entry.items:
        itm_obj = db.query(Item).filter(Item.id == item.item_id).first()
        unit_obj = db.query(Unit).filter(Unit.id == item.unit_id).first() if item.unit_id else (itm_obj.unit if itm_obj else None)
        formatted_items.append(
            WastageItemResponse(
                id=item.id,
                wastage_entry_id=item.wastage_entry_id,
                item_id=item.item_id,
                item_name=itm_obj.name if itm_obj else "Unknown Item",
                item_code=itm_obj.code if itm_obj else "",
                unit_id=item.unit_id,
                unit_symbol=unit_obj.symbol if unit_obj else "",
                quantity=Decimal(str(item.quantity)),
                unit_cost=Decimal(str(item.unit_cost)),
                total_cost=Decimal(str(item.total_cost)),
                reason_code=item.reason_code,
                batch_number=item.batch_number,
                notes=item.notes,
            )
        )

    return WastageEntryResponse(
        id=entry.id,
        company_id=entry.company_id,
        branch_id=entry.branch_id,
        branch_name=branch.name if branch else None,
        warehouse_id=entry.warehouse_id,
        warehouse_name=warehouse.name if warehouse else None,
        entry_number=entry.entry_number,
        entry_date=entry.entry_date,
        status=entry.status,
        total_cost=Decimal(str(entry.total_cost)),
        total_items_count=entry.total_items_count,
        requires_approval=entry.requires_approval,
        reported_by_id=entry.reported_by_id,
        reported_by_name=f"{reporter.first_name} {reporter.last_name}" if reporter else None,
        approved_by_id=entry.approved_by_id,
        approved_by_name=f"{approver.first_name} {approver.last_name}" if approver else None,
        approved_at=entry.approved_at,
        rejection_reason=entry.rejection_reason,
        notes=entry.notes,
        items=formatted_items,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )

# -------------------------------------------------------------
# 1. Standard Reason Codes Directory
# -------------------------------------------------------------
@router.get("/reasons", summary="Get standardized wastage reason codes")
def get_wastage_reasons():
    return [
        {"code": "EXPIRED", "label": "Expired / Spoilage", "description": "Item passed shelf-life or spoiled"},
        {"code": "PREPARATION_LOSS", "label": "Kitchen Prep Discard", "description": "Trimming, over-peeling or prep loss"},
        {"code": "BURNT_DROPPED", "label": "Burnt / Dropped / Spill", "description": "Accidental kitchen burn, drop or liquid spill"},
        {"code": "QUALITY_ISSUE", "label": "QC Defect / Rotten", "description": "Failed quality inspection or rotten raw material"},
        {"code": "STORAGE_FAILURE", "label": "Storage / Cooler Breakdown", "description": "Refrigeration malfunction or improper temp storage"},
        {"code": "CUSTOMER_RETURN", "label": "Customer Return", "description": "Dish returned due to order error or complaint"},
        {"code": "OTHER", "label": "Other General Loss", "description": "Unclassified or general loss"},
    ]

# -------------------------------------------------------------
# 2. List Wastage Entries
# -------------------------------------------------------------
@router.get("/entries", response_model=List[WastageEntryResponse], summary="List wastage entries with filters")
def list_wastage_entries(
    branch_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    reason_code: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    query = db.query(WastageEntry).filter(WastageEntry.company_id == current_user.company_id)

    if branch_id:
        _check_branch_access(branch_id, current_user, db)
        query = query.filter(WastageEntry.branch_id == branch_id)
    else:
        # Filter by permitted branches for non-admin
        is_super = False
        if current_user.role and any(r in current_user.role.name.upper() for r in ["ADMIN", "OWNER", "DIRECTOR", "HQ"]):
            is_super = True
        if not is_super:
            user_branches = db.query(UserBranch.branch_id).filter(UserBranch.user_id == current_user.id).all()
            b_ids = [ub[0] for ub in user_branches]
            query = query.filter(WastageEntry.branch_id.in_(b_ids))

    if warehouse_id:
        query = query.filter(WastageEntry.warehouse_id == warehouse_id)

    if status:
        query = query.filter(WastageEntry.status == status)

    if start_date:
        query = query.filter(WastageEntry.entry_date >= start_date)

    if end_date:
        query = query.filter(WastageEntry.entry_date <= end_date)

    if search:
        query = query.filter(
            or_(
                WastageEntry.entry_number.ilike(f"%{search}%"),
                WastageEntry.notes.ilike(f"%{search}%"),
            )
        )

    entries = query.order_by(desc(WastageEntry.entry_date)).all()

    if reason_code:
        # Filter entries that contain at least one item matching reason_code
        filtered_entries = []
        for e in entries:
            if any(item.reason_code == reason_code for item in e.items):
                filtered_entries.append(e)
        entries = filtered_entries

    return [_format_entry_response(e, db) for e in entries]

# -------------------------------------------------------------
# 3. Create Wastage Entry
# -------------------------------------------------------------
@router.post("/entries", response_model=WastageEntryResponse, status_code=status.HTTP_201_CREATED, summary="Log a new wastage entry")
def create_wastage_entry(
    payload: WastageEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    branch = _check_branch_access(payload.branch_id, current_user, db)
    warehouse = db.query(Warehouse).filter(
        Warehouse.id == payload.warehouse_id,
        Warehouse.company_id == current_user.company_id
    ).first()
    if not warehouse:
        raise NotFoundException("Target warehouse not found.")

    # Generate unique entry number WST-YYYYMMDD-XXXX
    date_str = datetime.utcnow().strftime("%Y%m%d")
    count_today = db.query(func.count(WastageEntry.id)).filter(
        WastageEntry.company_id == current_user.company_id,
        func.to_char(WastageEntry.created_at, 'YYYYMMDD') == date_str
    ).scalar() or 0
    entry_number = f"WST-{date_str}-{count_today + 1:04d}"

    entry_id = str(uuid.uuid4())
    total_cost = Decimal("0.0000")
    total_items_count = len(payload.items)
    wastage_items: List[WastageItem] = []

    for item_in in payload.items:
        itm = db.query(Item).filter(
            Item.id == item_in.item_id,
            Item.company_id == current_user.company_id
        ).first()
        if not itm:
            raise BadRequestException(f"Item ID {item_in.item_id} not found.")

        qty = Decimal(str(item_in.quantity))
        unit_cost = Decimal(str(item_in.unit_cost)) if item_in.unit_cost is not None else Decimal(str(itm.cost_price or 0))
        item_total = qty * unit_cost
        total_cost += item_total

        w_item = WastageItem(
            id=str(uuid.uuid4()),
            wastage_entry_id=entry_id,
            item_id=itm.id,
            unit_id=item_in.unit_id or itm.unit_id,
            quantity=qty,
            unit_cost=unit_cost,
            total_cost=item_total,
            reason_code=item_in.reason_code,
            batch_number=item_in.batch_number,
            notes=item_in.notes,
        )
        wastage_items.append(w_item)

    requires_approval = total_cost >= APPROVAL_THRESHOLD_COST
    status_to_set = WastageStatus.PENDING_APPROVAL if (payload.auto_submit or requires_approval) else WastageStatus.DRAFT

    entry = WastageEntry(
        id=entry_id,
        company_id=current_user.company_id,
        branch_id=branch.id,
        warehouse_id=warehouse.id,
        entry_number=entry_number,
        entry_date=payload.entry_date or datetime.utcnow(),
        status=status_to_set,
        total_cost=total_cost,
        total_items_count=total_items_count,
        requires_approval=requires_approval,
        reported_by_id=current_user.id,
        notes=payload.notes,
    )
    db.add(entry)
    db.flush()

    for wi in wastage_items:
        db.add(wi)

    _log_wastage_audit(
        db,
        current_user,
        "CREATE_WASTAGE_ENTRY",
        entry.id,
        {
            "entry_number": entry_number,
            "branch_id": branch.id,
            "warehouse_id": warehouse.id,
            "total_cost": float(total_cost),
            "status": status_to_set,
            "items_count": total_items_count,
        }
    )

    db.commit()
    db.refresh(entry)
    return _format_entry_response(entry, db)

# -------------------------------------------------------------
# 4. Get Single Wastage Entry
# -------------------------------------------------------------
@router.get("/entries/{entry_id}", response_model=WastageEntryResponse, summary="Get single wastage entry")
def get_wastage_entry(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    entry = db.query(WastageEntry).filter(
        WastageEntry.id == entry_id,
        WastageEntry.company_id == current_user.company_id
    ).first()
    if not entry:
        raise NotFoundException("Wastage entry not found.")

    _check_branch_access(entry.branch_id, current_user, db)
    return _format_entry_response(entry, db)

# -------------------------------------------------------------
# 5. Submit Wastage Entry for Approval
# -------------------------------------------------------------
@router.post("/entries/{entry_id}/submit", response_model=WastageEntryResponse, summary="Submit draft wastage entry for approval")
def submit_wastage_entry(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    entry = db.query(WastageEntry).filter(
        WastageEntry.id == entry_id,
        WastageEntry.company_id == current_user.company_id
    ).first()
    if not entry:
        raise NotFoundException("Wastage entry not found.")

    _check_branch_access(entry.branch_id, current_user, db)

    if entry.status != WastageStatus.DRAFT:
        raise BadRequestException(f"Cannot submit: entry is currently in '{entry.status}' status.")

    entry.status = WastageStatus.PENDING_APPROVAL
    _log_wastage_audit(
        db,
        current_user,
        "SUBMIT_WASTAGE_ENTRY",
        entry.id,
        {"entry_number": entry.entry_number, "status": "PENDING_APPROVAL"}
    )
    db.commit()
    db.refresh(entry)
    return _format_entry_response(entry, db)

# -------------------------------------------------------------
# 6. Approve Wastage Entry (Deducts Stock & Generates Ledger)
# -------------------------------------------------------------
@router.post("/entries/{entry_id}/approve", response_model=WastageEntryResponse, summary="Approve wastage entry and deduct inventory")
def approve_wastage_entry(
    entry_id: str,
    action_in: Optional[WastageApprovalAction] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    require_head_office_role(current_user, db)
    entry = db.query(WastageEntry).filter(
        WastageEntry.id == entry_id,
        WastageEntry.company_id == current_user.company_id
    ).first()
    if not entry:
        raise NotFoundException("Wastage entry not found.")

    _check_branch_access(entry.branch_id, current_user, db)

    if entry.status not in [WastageStatus.PENDING_APPROVAL, WastageStatus.DRAFT]:
        raise BadRequestException(f"Cannot approve: entry is currently in '{entry.status}' status.")

    if entry.reported_by_id == current_user.id:
        raise ForbiddenException("A wastage reporter cannot approve their own entry.")

    # Deduct stock and record ledger entries
    for item in entry.items:
        balance = db.query(StockBalance).filter(
            StockBalance.warehouse_id == entry.warehouse_id,
            StockBalance.item_id == item.item_id
        ).with_for_update().first()

        current_balance_qty = Decimal(str(balance.quantity)) if balance else Decimal("0.0000")
        deduction_qty = Decimal(str(item.quantity))
        new_balance_qty = current_balance_qty - deduction_qty

        if balance:
            balance.quantity = new_balance_qty
        else:
            balance = StockBalance(
                id=str(uuid.uuid4()),
                warehouse_id=entry.warehouse_id,
                item_id=item.item_id,
                quantity=new_balance_qty,
            )
            db.add(balance)

        # Create StockLedger entry
        ledger = StockLedger(
            id=str(uuid.uuid4()),
            warehouse_id=entry.warehouse_id,
            item_id=item.item_id,
            batch_number=item.batch_number,
            movement_type="WASTAGE",
            change_qty=-deduction_qty,
            balance_qty=new_balance_qty,
            unit_cost=item.unit_cost,
            total_cost=item.total_cost,
            reference_type="WASTAGE_ENTRY",
            reference_id=entry.id,
            notes=f"Wastage #{entry.entry_number}: {item.reason_code.value} - {item.notes or 'Wastage Discard'}",
            created_by_id=current_user.id,
        )
        db.add(ledger)

    entry.status = WastageStatus.APPROVED
    entry.approved_by_id = current_user.id
    entry.approved_at = datetime.utcnow()
    if action_in and action_in.notes:
        entry.notes = f"{entry.notes or ''} [Approval Note: {action_in.notes}]".strip()

    _log_wastage_audit(
        db,
        current_user,
        "APPROVE_WASTAGE_ENTRY",
        entry.id,
        {
            "entry_number": entry.entry_number,
            "total_cost": float(entry.total_cost),
            "approved_by": current_user.email,
        }
    )

    db.commit()
    db.refresh(entry)
    return _format_entry_response(entry, db)

# -------------------------------------------------------------
# 7. Reject Wastage Entry
# -------------------------------------------------------------
@router.post("/entries/{entry_id}/reject", response_model=WastageEntryResponse, summary="Reject wastage entry")
def reject_wastage_entry(
    entry_id: str,
    action_in: WastageApprovalAction,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    require_head_office_role(current_user, db)
    entry = db.query(WastageEntry).filter(
        WastageEntry.id == entry_id,
        WastageEntry.company_id == current_user.company_id
    ).first()
    if not entry:
        raise NotFoundException("Wastage entry not found.")

    _check_branch_access(entry.branch_id, current_user, db)

    if entry.status not in [WastageStatus.PENDING_APPROVAL, WastageStatus.DRAFT]:
        raise BadRequestException(f"Cannot reject: entry is currently in '{entry.status}' status.")

    if not action_in.rejection_reason:
        raise BadRequestException("Rejection reason is required.")

    entry.status = WastageStatus.REJECTED
    entry.rejection_reason = action_in.rejection_reason
    if action_in.notes:
        entry.notes = f"{entry.notes or ''} [Rejection: {action_in.notes}]".strip()

    _log_wastage_audit(
        db,
        current_user,
        "REJECT_WASTAGE_ENTRY",
        entry.id,
        {
            "entry_number": entry.entry_number,
            "rejection_reason": action_in.rejection_reason,
            "rejected_by": current_user.email,
        }
    )

    db.commit()
    db.refresh(entry)
    return _format_entry_response(entry, db)

# -------------------------------------------------------------
# 8. Wastage Analytics & Outlier Detection
# -------------------------------------------------------------
@router.get("/analytics", response_model=WastageAnalyticsResponse, summary="Wastage analytics, breakdown, and abnormal surge alerts")
def get_wastage_analytics(
    branch_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    start_date = datetime.utcnow() - timedelta(days=days)
    end_date = datetime.utcnow()

    query = db.query(WastageEntry).filter(
        WastageEntry.company_id == current_user.company_id,
        WastageEntry.entry_date >= start_date,
        WastageEntry.status == WastageStatus.APPROVED
    )

    if branch_id:
        _check_branch_access(branch_id, current_user, db)
        query = query.filter(WastageEntry.branch_id == branch_id)
    else:
        is_super = False
        if current_user.role and any(r in current_user.role.name.upper() for r in ["ADMIN", "OWNER", "DIRECTOR", "HQ"]):
            is_super = True
        if not is_super:
            user_branches = db.query(UserBranch.branch_id).filter(UserBranch.user_id == current_user.id).all()
            b_ids = [ub[0] for ub in user_branches]
            query = query.filter(WastageEntry.branch_id.in_(b_ids))

    approved_entries = query.all()
    entry_ids = [e.id for e in approved_entries]

    total_cost = Decimal("0.0000")
    total_items_wasted = Decimal("0.0000")
    by_reason: Dict[str, Dict[str, Any]] = {}
    by_outlet_dict: Dict[str, Dict[str, Any]] = {}
    top_items_dict: Dict[str, Dict[str, Any]] = {}

    for e in approved_entries:
        total_cost += Decimal(str(e.total_cost))
        br_name = e.branch.name if e.branch else "Unknown"
        if e.branch_id not in by_outlet_dict:
            by_outlet_dict[e.branch_id] = {
                "branch_id": e.branch_id,
                "branch_name": br_name,
                "total_cost": Decimal("0.0000"),
                "entries_count": 0,
            }
        by_outlet_dict[e.branch_id]["total_cost"] += Decimal(str(e.total_cost))
        by_outlet_dict[e.branch_id]["entries_count"] += 1

    if entry_ids:
        items = db.query(WastageItem).filter(WastageItem.wastage_entry_id.in_(entry_ids)).all()
        for itm in items:
            q = Decimal(str(itm.quantity))
            c = Decimal(str(itm.total_cost))
            total_items_wasted += q

            # By Reason
            r_code = itm.reason_code.value
            if r_code not in by_reason:
                by_reason[r_code] = {"code": r_code, "total_cost": Decimal("0.0000"), "count": 0, "quantity": Decimal("0.0000")}
            by_reason[r_code]["total_cost"] += c
            by_reason[r_code]["count"] += 1
            by_reason[r_code]["quantity"] += q

            # Top Items
            if itm.item_id not in top_items_dict:
                itm_obj = itm.item
                top_items_dict[itm.item_id] = {
                    "item_id": itm.item_id,
                    "item_name": itm_obj.name if itm_obj else "Unknown",
                    "item_code": itm_obj.code if itm_obj else "",
                    "quantity": Decimal("0.0000"),
                    "total_cost": Decimal("0.0000"),
                    "primary_reason": itm.reason_code.value,
                }
            top_items_dict[itm.item_id]["quantity"] += q
            top_items_dict[itm.item_id]["total_cost"] += c

    # Calculate percentage for reasons
    for r_k, r_v in by_reason.items():
        pct = (r_v["total_cost"] / total_cost * Decimal("100.0")) if total_cost > 0 else Decimal("0.0")
        r_v["percentage"] = round(float(pct), 2)
        r_v["total_cost"] = float(r_v["total_cost"])
        r_v["quantity"] = float(r_v["quantity"])

    by_outlet = [
        {
            "branch_id": v["branch_id"],
            "branch_name": v["branch_name"],
            "total_cost": float(v["total_cost"]),
            "entries_count": v["entries_count"],
        }
        for v in by_outlet_dict.values()
    ]
    by_outlet.sort(key=lambda x: x["total_cost"], reverse=True)

    top_wasted_items = sorted(
        [
            {
                "item_id": v["item_id"],
                "item_name": v["item_name"],
                "item_code": v["item_code"],
                "quantity": float(v["quantity"]),
                "total_cost": float(v["total_cost"]),
                "primary_reason": v["primary_reason"],
            }
            for v in top_items_dict.values()
        ],
        key=lambda x: x["total_cost"],
        reverse=True
    )[:10]

    # Abnormal Alerts: flag outlets with cost > ₹2000 in past 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_entries = [e for e in approved_entries if e.entry_date >= seven_days_ago]
    abnormal_alerts = []
    recent_branch_costs: Dict[str, Decimal] = {}
    for re in recent_entries:
        recent_branch_costs[re.branch_id] = recent_branch_costs.get(re.branch_id, Decimal("0.0000")) + Decimal(str(re.total_cost))

    for b_id, b_cost in recent_branch_costs.items():
        if b_cost >= Decimal("2000.00"):
            br = db.query(Branch).filter(Branch.id == b_id).first()
            abnormal_alerts.append({
                "branch_id": b_id,
                "branch_name": br.name if br else "Outlet",
                "current_cost": float(b_cost),
                "baseline_cost": 1000.0,
                "surge_percentage": round(float((b_cost - Decimal("1000.00")) / Decimal("1000.00") * 100), 1),
                "reason": "Wastage exceeded high-loss safety threshold in past 7 days",
            })

    return WastageAnalyticsResponse(
        period_start=start_date.strftime("%Y-%m-%d"),
        period_end=end_date.strftime("%Y-%m-%d"),
        total_wastage_cost=total_cost,
        total_wastage_entries=len(approved_entries),
        total_items_wasted=total_items_wasted,
        by_reason=by_reason,
        by_outlet=by_outlet,
        top_wasted_items=top_wasted_items,
        abnormal_alerts=abnormal_alerts,
    )

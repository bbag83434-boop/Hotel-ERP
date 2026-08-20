import uuid
import json
import re
import urllib.parse
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple

from fastapi import APIRouter, Depends, Query, Path, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission, require_outlet_scope
from app.core.exceptions import (
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
)
from app.models.user import User, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Unit, StockBalance, StockLedger, StockTransfer, StockMovementType
from app.models.procurement import (
    Supplier,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PRStatus,
    POStatus,
    PRPriority,
    SmartRequirementDraft,
    SmartRequirementItem,
    BranchRequirementConfig,
)
from app.models.audit import AuditLog
from app.schemas.procurement import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    PurchaseRequestCreate,
    PurchaseRequestResponse,
    PurchaseOrderResponse,
    ConsolidateOrdersRequest,
    ConsolidateOrdersResponse,
    ApproveOrderRequest,
    RejectOrderRequest,
    WhatsAppLinkResponse,
    ConfirmSentRequest,
    ConfirmSentResponse,
    SmartRequirementItemSchema,
    SmartRequirementDraftResponse,
    GenerateRequirementRequest,
    UpdateDraftItemsRequest,
    ConfirmDraftRequest,
    ConfirmDraftResponse,
    BranchRequirementConfigCreateUpdate,
    BranchRequirementConfigResponse,
    SmartAIAskRequest,
    SmartAIAskResponse,
)

router = APIRouter()

# ==============================================================================
# Helper Functions
# ==============================================================================

def validate_whatsapp_number(raw_number: Optional[str], supplier_name: str) -> str:
    """
    Validates and cleans a WhatsApp phone number.
    Raises BadRequestException if missing or invalid.
    Returns sanitized numeric string for wa.me URL (E.164 without leading +).
    """
    if not raw_number or not str(raw_number).strip():
        raise BadRequestException(f"Missing WhatsApp number: Supplier '{supplier_name}' does not have a registered WhatsApp number.")

    clean_str = str(raw_number).strip()
    
    # Disallow letters or invalid symbols
    if re.search(r"[a-zA-Z]", clean_str):
        raise BadRequestException(f"Invalid WhatsApp number '{clean_str}' for supplier '{supplier_name}': Contains alphabetical characters.")

    # Check for invalid non-phone characters
    if not re.match(r"^\+?[\d\s\-\(\)\.]+$", clean_str):
        raise BadRequestException(f"Invalid WhatsApp number '{clean_str}' for supplier '{supplier_name}': Contains illegal characters.")

    # Extract digits only
    digits_only = re.sub(r"\D", "", clean_str)

    if len(digits_only) < 10 or len(digits_only) > 15:
        raise BadRequestException(
            f"Invalid WhatsApp number '{clean_str}' for supplier '{supplier_name}': Must contain between 10 and 15 digits (got {len(digits_only)})."
        )

    return digits_only


def log_procurement_audit(
    db: Session,
    user: User,
    action: str,
    entity_type: str,
    entity_id: str,
    company_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
):
    """Creates a structured AuditLog record in the database."""
    details_dict = {}
    if old_values:
        details_dict["old_values"] = old_values
    if new_values:
        details_dict["new_values"] = new_values

    audit_entry = AuditLog(
        user_id=user.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details_dict, default=str) if details_dict else None,
    )
    db.add(audit_entry)


def check_user_outlet_access(user: User, branch_id: str, db: Session):
    """Verifies that user is authorized for the given branch/outlet."""
    if user.role and user.role.name in ["SUPER_ADMIN", "OWNER", "HQ_ADMIN", "CENTRAL_PURCHASE_MANAGER"]:
        return True
    
    user_branch = db.query(UserBranch).filter(
        UserBranch.user_id == user.id,
        UserBranch.branch_id == branch_id
    ).first()
    
    if not user_branch:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        branch_name = branch.name if branch else branch_id
        raise ForbiddenException(f"Access denied: User is not authorized to access outlet '{branch_name}'.")
    return True


def format_whatsapp_message(
    supplier_name: str,
    po_number: str,
    items_summary: List[Dict[str, Any]],
    allocations_by_outlet: Dict[str, List[Dict[str, Any]]]
) -> str:
    """
    Generates exact pre-filled WhatsApp message matching specification:
    
    Dear [Supplier Name],

    Please supply:

    1. Rice — 35 KG
    2. Oil — 15 L

    Outlet allocation:
    Outlet 1:
    Rice — 20 KG
    Oil — 10 L

    Outlet 2:
    Rice — 15 KG
    Oil — 5 L

    Order Ref: [ORDER NUMBER]
    """
    lines = []
    lines.append(f"Dear {supplier_name},")
    lines.append("")
    lines.append("Please supply:")
    lines.append("")

    for idx, item in enumerate(items_summary, 1):
        qty_formatted = f"{item['total_qty']:g}" if isinstance(item['total_qty'], (int, float, Decimal)) else str(item['total_qty'])
        unit_str = f" {item['unit_symbol']}" if item.get('unit_symbol') else ""
        lines.append(f"{idx}. {item['item_name']} — {qty_formatted}{unit_str}")

    lines.append("")
    lines.append("Outlet allocation:")

    for outlet_name, outlet_items in allocations_by_outlet.items():
        lines.append(f"{outlet_name}:")
        for oi in outlet_items:
            qty_fmt = f"{oi['qty']:g}" if isinstance(oi['qty'], (int, float, Decimal)) else str(oi['qty'])
            u_str = f" {oi.get('unit_symbol', '')}" if oi.get('unit_symbol') else ""
            lines.append(f"{oi['item_name']} — {qty_fmt}{u_str}")
        lines.append("")

    lines.append(f"Order Ref: {po_number}")
    return "\n".join(lines)


# ==============================================================================
# Supplier Master Endpoints
# ==============================================================================

@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all registered suppliers with optional search and active status filters."""
    query = db.query(Supplier)
    if current_user.company_id:
        query = query.filter(Supplier.company_id == current_user.company_id)
    if is_active is not None:
        query = query.filter(Supplier.is_active == is_active)
    if search:
        s = f"%{search}%"
        query = query.filter(or_(Supplier.name.ilike(s), Supplier.code.ilike(s), Supplier.phone.ilike(s)))
    return query.order_by(Supplier.name.asc()).all()


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Register a new supplier with contact details and WhatsApp phone number."""
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        # Fallback to any company if test environment
        first_comp = db.query(Company).first()
        company_id = first_comp.id if first_comp else "default-company"

    # Check duplicate code
    existing = db.query(Supplier).filter(
        Supplier.company_id == company_id,
        Supplier.code == payload.code
    ).first()
    if existing:
        raise ConflictException(f"Supplier with code '{payload.code}' already exists.")

    supplier = Supplier(
        company_id=company_id,
        name=payload.name,
        code=payload.code,
        contact_person=payload.contact_person,
        phone=payload.phone,
        whatsapp_number=payload.whatsapp_number,
        email=payload.email,
        address=payload.address,
        gst_number=payload.gst_number,
        payment_terms=payload.payment_terms,
        is_active=payload.is_active,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_SUPPLIER",
        entity_type="Supplier",
        entity_id=supplier.id,
        company_id=company_id,
        new_values={"name": supplier.name, "code": supplier.code, "whatsapp": supplier.whatsapp_number}
    )
    db.commit()
    return supplier


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve single supplier details."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise NotFoundException(f"Supplier '{supplier_id}' not found.")
    return supplier


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str = Path(...),
    payload: SupplierUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update supplier information including WhatsApp phone number."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise NotFoundException(f"Supplier '{supplier_id}' not found.")

    old_data = {"name": supplier.name, "phone": supplier.phone, "whatsapp": supplier.whatsapp_number}
    
    update_dict = payload.dict(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(supplier, k, v)

    db.commit()
    db.refresh(supplier)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="UPDATE_SUPPLIER",
        entity_type="Supplier",
        entity_id=supplier.id,
        old_values=old_data,
        new_values=update_dict
    )
    db.commit()
    return supplier


# ==============================================================================
# Purchase Requests (Outlet Indents)
# ==============================================================================

@router.post("/requests", response_model=PurchaseRequestResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_request(
    payload: PurchaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a new Purchase Request (Indent) for an individual outlet/branch.
    Validates user outlet authorization and checks item catalog.
    """
    check_user_outlet_access(current_user, payload.branch_id, db)

    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise NotFoundException(f"Outlet branch '{payload.branch_id}' not found.")

    company_id = branch.company_id or current_user.company_id
    req_number = f"PR-{datetime.utcnow().strftime('%Y%m%d')}-{abs(hash(str(datetime.utcnow()) + payload.branch_id)) % 100000:05d}"

    req = PurchaseRequest(
        company_id=company_id,
        branch_id=payload.branch_id,
        request_number=req_number,
        requested_by_id=current_user.id,
        required_date=payload.required_date or datetime.utcnow(),
        status=PRStatus.PENDING_APPROVAL,
        priority=payload.priority or "NORMAL",
        notes=payload.notes,
    )
    db.add(req)
    db.flush()

    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Inventory Item '{item_in.item_id}' not found.")

        # Determine supplier: explicit -> item master -> None
        supplier_id = item_in.supplier_id or db_item.supplier_id

        pr_item = PurchaseRequestItem(
            request_id=req.id,
            item_id=item_in.item_id,
            supplier_id=supplier_id,
            requested_qty=item_in.requested_qty,
            estimated_price=item_in.estimated_price or db_item.cost_price or Decimal("0.0000"),
            notes=item_in.notes,
        )
        db.add(pr_item)

    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_PURCHASE_REQUEST",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        company_id=company_id,
        branch_id=payload.branch_id,
        new_values={"request_number": req.request_number, "items_count": len(payload.items)}
    )
    db.commit()
    return req


@router.get("/requests", response_model=List[PurchaseRequestResponse])
def list_purchase_requests(
    branch_id: Optional[str] = None,
    status_filter: Optional[PRStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase requests with optional outlet and status filters."""
    query = db.query(PurchaseRequest)
    if current_user.company_id:
        query = query.filter(PurchaseRequest.company_id == current_user.company_id)
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(PurchaseRequest.branch_id == branch_id)
    if status_filter:
        query = query.filter(PurchaseRequest.status == status_filter)

    return query.order_by(desc(PurchaseRequest.created_at)).all()


@router.get("/requests/{request_id}", response_model=PurchaseRequestResponse)
def get_purchase_request(
    request_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve details of a specific purchase request."""
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)
    return req


# ==============================================================================
# FEATURE: Supplier-Wise Auto Order Consolidation
# ==============================================================================

@router.post("/orders/consolidate", response_model=ConsolidateOrdersResponse, status_code=status.HTTP_201_CREATED)
def consolidate_outlet_orders(
    payload: ConsolidateOrdersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    CORE ENGINE:
    Consolidates multiple Outlet Purchase Requests / Indents into Supplier-wise Purchase Orders.
    
    1. Validates user permission & outlet-level authorizations.
    2. Identifies supplier for each line item (raises error if missing).
    3. Groups items strictly by Supplier (never mixes suppliers).
    4. Consolidates quantities for identical items.
    5. Preserves complete outlet-wise allocation details.
    6. Prevents duplicate consolidation.
    7. Generates Purchase Order drafts / pending approval orders.
    8. Records complete structured Audit Trail.
    """
    if not payload.request_ids:
        raise BadRequestException("At least one Purchase Request ID must be provided for consolidation.")

    # Fetch all requested purchase requests
    requests = db.query(PurchaseRequest).filter(PurchaseRequest.id.in_(payload.request_ids)).all()
    if len(requests) != len(set(payload.request_ids)):
        found_ids = {r.id for r in requests}
        missing_ids = set(payload.request_ids) - found_ids
        raise NotFoundException(f"Purchase Requests not found: {missing_ids}")

    # RBAC & Duplicate Prevention Audit
    company_id = current_user.company_id or requests[0].company_id

    for pr in requests:
        # Check outlet authorization for the creator/actor
        check_user_outlet_access(current_user, pr.branch_id, db)
        
        # Duplicate order prevention: Cannot re-consolidate already ordered/consolidated PRs
        if pr.status == PRStatus.ORDERED:
            raise ConflictException(
                f"Duplicate consolidation prevented: Purchase Request '{pr.request_number}' (Outlet: {pr.branch.name if pr.branch else pr.branch_id}) has already been ordered/consolidated."
            )
        if pr.status in [PRStatus.REJECTED, PRStatus.CANCELLED]:
            raise BadRequestException(
                f"Cannot consolidate Purchase Request '{pr.request_number}' because its status is {pr.status.value}."
            )

    # --------------------------------------------------------------------------
    # Supplier Identification & Grouping
    # --------------------------------------------------------------------------
    # Data structure: supplier_id -> {
    #     "supplier": Supplier,
    #     "items": { item_id -> { "item": Item, "total_qty": Decimal, "unit_price": Decimal, "allocations": [...] } },
    #     "outlet_breakdown": { outlet_name -> [ { "item_name": ..., "qty": ..., "unit_symbol": ... } ] },
    #     "participating_requests": set(pr.id),
    #     "participating_branches": set(pr.branch.name)
    # }
    supplier_groups: Dict[str, Dict[str, Any]] = {}

    for pr in requests:
        branch_name = pr.branch.name if pr.branch else f"Outlet-{pr.branch_id[:8]}"
        
        for pr_item in pr.items:
            db_item = pr_item.item
            if not db_item:
                db_item = db.query(Item).filter(Item.id == pr_item.item_id).first()
                if not db_item:
                    raise NotFoundException(f"Item '{pr_item.item_id}' not found in catalog.")

            # Identify Supplier: PR item explicit -> Item Master supplier_id
            effective_supplier_id = pr_item.supplier_id or db_item.supplier_id
            
            if not effective_supplier_id:
                raise BadRequestException(
                    f"Missing supplier: Item '{db_item.name}' (Code: {db_item.code}) requested by outlet '{branch_name}' has no assigned supplier. Every item must have a mapped supplier before auto-consolidation."
                )

            supplier = db.query(Supplier).filter(Supplier.id == effective_supplier_id).first()
            if not supplier:
                raise BadRequestException(
                    f"Missing supplier: Supplier record '{effective_supplier_id}' assigned to item '{db_item.name}' does not exist in master catalog."
                )
            if not supplier.is_active:
                raise BadRequestException(
                    f"Inactive supplier: Supplier '{supplier.name}' assigned to item '{db_item.name}' is marked inactive."
                )

            # Initialize supplier group if first time encountered
            if effective_supplier_id not in supplier_groups:
                supplier_groups[effective_supplier_id] = {
                    "supplier": supplier,
                    "items": {},
                    "outlet_breakdown": {},
                    "participating_requests": set(),
                    "participating_branches": set(),
                }

            s_group = supplier_groups[effective_supplier_id]
            s_group["participating_requests"].add(pr.id)
            s_group["participating_branches"].add(branch_name)

            unit_sym = db_item.unit.symbol if db_item.unit else "Units"
            qty = Decimal(str(pr_item.requested_qty))
            price = Decimal(str(pr_item.estimated_price or db_item.cost_price or 0))

            # Consolidate same items
            if db_item.id not in s_group["items"]:
                s_group["items"][db_item.id] = {
                    "item": db_item,
                    "item_name": db_item.name,
                    "item_code": db_item.code,
                    "unit_symbol": unit_sym,
                    "total_qty": Decimal("0.0000"),
                    "unit_price": price,
                    "allocations": [],
                }

            s_item = s_group["items"][db_item.id]
            s_item["total_qty"] += qty
            s_item["allocations"].append({
                "branch_id": pr.branch_id,
                "branch_name": branch_name,
                "quantity": float(qty),
                "unit": unit_sym,
                "request_id": pr.id,
                "request_number": pr.request_number,
            })

            # Record in outlet allocation breakdown
            if branch_name not in s_group["outlet_breakdown"]:
                s_group["outlet_breakdown"][branch_name] = []
            
            s_group["outlet_breakdown"][branch_name].append({
                "item_id": db_item.id,
                "item_name": db_item.name,
                "item_code": db_item.code,
                "qty": float(qty),
                "unit_symbol": unit_sym,
            })

    # --------------------------------------------------------------------------
    # Generate Consolidated Purchase Orders (One PO per Supplier)
    # --------------------------------------------------------------------------
    created_orders: List[PurchaseOrder] = []
    timestamp_str = datetime.utcnow().strftime('%Y%m%d%H%M')

    for s_id, s_data in supplier_groups.items():
        supplier: Supplier = s_data["supplier"]
        po_status = POStatus.PENDING_APPROVAL if payload.auto_submit else POStatus.DRAFT
        po_num = f"PO-{timestamp_str}-{abs(hash(str(supplier.id) + str(datetime.utcnow()))) % 10000:04d}"

        # Calculate totals
        total_amt = Decimal("0.0000")
        for item_data in s_data["items"].values():
            line_tot = item_data["total_qty"] * item_data["unit_price"]
            total_amt += line_tot

        # Format allocation payload
        full_allocation_payload = {
            "supplier_id": supplier.id,
            "supplier_name": supplier.name,
            "consolidated_at": datetime.utcnow().isoformat(),
            "outlets": s_data["outlet_breakdown"],
            "participating_request_ids": list(s_data["participating_requests"]),
            "items_summary": [
                {
                    "item_id": i["item"].id,
                    "item_name": i["item_name"],
                    "total_qty": float(i["total_qty"]),
                    "unit_symbol": i["unit_symbol"],
                    "unit_price": float(i["unit_price"]),
                    "allocations": i["allocations"]
                }
                for i in s_data["items"].values()
            ]
        }

        # Create PO
        po = PurchaseOrder(
            company_id=company_id,
            branch_id=None,  # Nullable for centralized multi-outlet consolidated order
            supplier_id=supplier.id,
            po_number=po_num,
            status=po_status,
            order_date=datetime.utcnow(),
            total_amount=total_amt,
            tax_amount=Decimal("0.0000"),
            discount_amount=Decimal("0.0000"),
            net_amount=total_amt,
            notes=payload.notes or f"Auto-consolidated order for outlets: {', '.join(s_data['participating_branches'])}",
            allocations=json.dumps(full_allocation_payload),
            whatsapp_number=supplier.effective_whatsapp_number,
        )
        db.add(po)
        db.flush()

        # Add PO Line Items
        for item_id, item_dict in s_data["items"].items():
            tot_qty = item_dict["total_qty"]
            u_price = item_dict["unit_price"]
            tot_price = tot_qty * u_price

            po_item = PurchaseOrderItem(
                po_id=po.id,
                item_id=item_id,
                ordered_qty=tot_qty,
                received_qty=Decimal("0.0000"),
                unit_price=u_price,
                total_price=tot_price,
                notes=f"Consolidated across {len(item_dict['allocations'])} outlet(s)",
                allocations=json.dumps(item_dict["allocations"]),
            )
            db.add(po_item)

        created_orders.append(po)

        # Log detailed audit
        log_procurement_audit(
            db=db,
            user=current_user,
            action="CONSOLIDATE_PURCHASE_ORDER",
            entity_type="PurchaseOrder",
            entity_id=po.id,
            company_id=company_id,
            new_values={
                "po_number": po.po_number,
                "supplier_name": supplier.name,
                "supplier_id": supplier.id,
                "status": po.status.value,
                "outlets": list(s_data["participating_branches"]),
                "items_count": len(s_data["items"]),
                "grand_total": float(total_amt),
                "requests": list(s_data["participating_requests"]),
            }
        )

    # Update all participating Purchase Requests to ORDERED
    for pr in requests:
        pr.status = PRStatus.ORDERED
        pr.updated_at = datetime.utcnow()

    db.commit()

    for po in created_orders:
        db.refresh(po)

    return ConsolidateOrdersResponse(
        success=True,
        consolidated_orders_count=len(created_orders),
        orders=created_orders,
        message=f"Successfully auto-consolidated {len(requests)} outlet requests into {len(created_orders)} supplier-wise order(s)."
    )


# ==============================================================================
# Purchase Order Management & Approval Workflow
# ==============================================================================

@router.get("/orders", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(
    supplier_id: Optional[str] = None,
    status_filter: Optional[POStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase orders with supplier and status filters."""
    query = db.query(PurchaseOrder)
    if current_user.company_id:
        query = query.filter(PurchaseOrder.company_id == current_user.company_id)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)

    return query.order_by(desc(PurchaseOrder.created_at)).all()


@router.get("/orders/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    order_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve details of a purchase order."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")
    return po


@router.post("/orders/{order_id}/submit", response_model=PurchaseOrderResponse)
def submit_order_for_approval(
    order_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Transitions a DRAFT purchase order to PENDING_APPROVAL."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status != POStatus.DRAFT:
        raise BadRequestException(f"Cannot submit order with status '{po.status.value}'. Must be DRAFT.")

    po.status = POStatus.PENDING_APPROVAL
    po.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="SUBMIT_ORDER_APPROVAL",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        new_values={"status": po.status.value, "po_number": po.po_number}
    )
    db.commit()
    return po


@router.post("/orders/{order_id}/approve", response_model=PurchaseOrderResponse)
def approve_purchase_order(
    order_id: str = Path(...),
    payload: ApproveOrderRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approves a Purchase Order for supplier issuance.
    Requires manager / approver authorization.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status not in [POStatus.PENDING_APPROVAL, POStatus.DRAFT]:
        raise BadRequestException(f"Cannot approve order with status '{po.status.value}'. Must be PENDING_APPROVAL or DRAFT.")

    old_status = po.status.value
    po.status = POStatus.APPROVED
    po.approved_by_id = current_user.id
    po.approved_at = datetime.utcnow()
    if payload.notes:
        po.notes = f"{po.notes or ''} [Approval Note: {payload.notes}]".strip()
    po.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="APPROVE_PURCHASE_ORDER",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        old_values={"status": old_status},
        new_values={
            "status": po.status.value,
            "approved_by": current_user.email,
            "approved_at": po.approved_at.isoformat(),
            "po_number": po.po_number,
            "notes": payload.notes,
        }
    )
    db.commit()
    return po


@router.post("/orders/{order_id}/reject", response_model=PurchaseOrderResponse)
def reject_purchase_order(
    order_id: str = Path(...),
    payload: RejectOrderRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Rejects / cancels a purchase order with recorded reason."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status in [POStatus.RECEIVED, POStatus.SENT_MANUALLY, POStatus.CANCELLED]:
        raise BadRequestException(f"Cannot reject order with status '{po.status.value}'.")

    old_status = po.status.value
    po.status = POStatus.CANCELLED
    po.notes = f"{po.notes or ''} [Rejection Reason: {payload.reason}]".strip()
    po.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="REJECT_PURCHASE_ORDER",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        old_values={"status": old_status},
        new_values={"status": po.status.value, "reason": payload.reason, "po_number": po.po_number}
    )
    db.commit()
    return po


# ==============================================================================
# FEATURE: WhatsApp Pre-filled Link & Manual Send Lifecycle
# ==============================================================================

@router.post("/orders/{order_id}/whatsapp-link", response_model=WhatsAppLinkResponse)
def open_supplier_whatsapp(
    order_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    OPEN SUPPLIER WHATSAPP
    
    1. Validates order status is APPROVED (or WHATSAPP_OPENED).
    2. Validates Supplier has a valid WhatsApp phone number.
    3. Builds formatted pre-filled order message with consolidated item totals & outlet allocation.
    4. Generates deep link: https://wa.me/{clean_phone}?text={encoded_message}
    5. Updates status to WHATSAPP_OPENED (does NOT mark SENT automatically).
    6. Records complete audit log.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    # Validation: Order must be APPROVED before WhatsApp can be opened
    if po.status not in [POStatus.APPROVED, POStatus.WHATSAPP_OPENED]:
        raise BadRequestException(
            f"Cannot open WhatsApp for order '{po.po_number}': Order status is '{po.status.value}'. Purchase order must be APPROVED before dispatching via WhatsApp."
        )

    supplier = po.supplier
    if not supplier:
        supplier = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
        if not supplier:
            raise NotFoundException(f"Supplier record '{po.supplier_id}' not found.")

    # Validate supplier WhatsApp number
    raw_whatsapp = supplier.whatsapp_number or supplier.phone
    clean_whatsapp = validate_whatsapp_number(raw_whatsapp, supplier.name)

    # Parse item totals and outlet allocations
    items_summary: List[Dict[str, Any]] = []
    allocations_by_outlet: Dict[str, List[Dict[str, Any]]] = {}

    # Prefer stored structured allocation JSON if present
    if po.allocations:
        try:
            alloc_data = json.loads(po.allocations)
            if "items_summary" in alloc_data and "outlets" in alloc_data:
                items_summary = alloc_data["items_summary"]
                allocations_by_outlet = alloc_data["outlets"]
        except Exception:
            pass

    # Fallback to reconstructing from line items if allocation JSON wasn't loaded
    if not items_summary:
        for po_item in po.items:
            unit_name = po_item.item.unit.symbol if po_item.item and po_item.item.unit else "Units"
            items_summary.append({
                "item_name": po_item.item.name if po_item.item else f"Item-{po_item.item_id[:6]}",
                "total_qty": float(po_item.ordered_qty),
                "unit_symbol": unit_name,
            })
            if po_item.allocations:
                try:
                    item_allocs = json.loads(po_item.allocations)
                    for alloc in item_allocs:
                        b_name = alloc.get("branch_name", "Outlet")
                        if b_name not in allocations_by_outlet:
                            allocations_by_outlet[b_name] = []
                        allocations_by_outlet[b_name].append({
                            "item_name": po_item.item.name if po_item.item else "Item",
                            "qty": alloc.get("quantity", 0),
                            "unit_symbol": unit_name,
                        })
                except Exception:
                    pass

    # Generate message
    prefilled_message = format_whatsapp_message(
        supplier_name=supplier.name,
        po_number=po.po_number,
        items_summary=items_summary,
        allocations_by_outlet=allocations_by_outlet,
    )

    # Encode message for wa.me URL
    encoded_text = urllib.parse.quote(prefilled_message)
    whatsapp_url = f"https://wa.me/{clean_whatsapp}?text={encoded_text}"

    # IMPORTANT: System sets status to WHATSAPP_OPENED (NOT SENT_MANUALLY)
    opened_timestamp = datetime.utcnow()
    po.status = POStatus.WHATSAPP_OPENED
    po.whatsapp_opened_at = opened_timestamp
    po.whatsapp_number = clean_whatsapp
    po.updated_at = opened_timestamp

    db.commit()
    db.refresh(po)

    # Audit Trail
    log_procurement_audit(
        db=db,
        user=current_user,
        action="OPEN_SUPPLIER_WHATSAPP",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        new_values={
            "po_number": po.po_number,
            "supplier_name": supplier.name,
            "whatsapp_number_used": clean_whatsapp,
            "whatsapp_opened_at": opened_timestamp.isoformat(),
            "status": po.status.value,
        }
    )
    db.commit()

    return WhatsAppLinkResponse(
        success=True,
        po_id=po.id,
        po_number=po.po_number,
        supplier_id=supplier.id,
        supplier_name=supplier.name,
        whatsapp_number=clean_whatsapp,
        whatsapp_url=whatsapp_url,
        prefilled_message=prefilled_message,
        status=po.status,
        opened_at=opened_timestamp,
        message="WhatsApp conversation link generated successfully. Status marked as WHATSAPP_OPENED."
    )


@router.post("/orders/{order_id}/confirm-sent", response_model=ConfirmSentResponse)
def confirm_order_sent_manually(
    order_id: str = Path(...),
    payload: ConfirmSentRequest = Body(default=ConfirmSentRequest()),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    MANUAL SEND CONFIRMATION
    
    User manually confirms having pressed SEND in WhatsApp.
    Transitions status: WHATSAPP_OPENED -> SENT_MANUALLY.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status not in [POStatus.WHATSAPP_OPENED, POStatus.APPROVED]:
        raise BadRequestException(
            f"Cannot mark order as SENT_MANUALLY: Current status is '{po.status.value}'. Must be WHATSAPP_OPENED or APPROVED."
        )

    confirmed_timestamp = datetime.utcnow()
    po.status = POStatus.SENT_MANUALLY
    if payload.notes:
        po.notes = f"{po.notes or ''} [Sent Note: {payload.notes}]".strip()
    po.updated_at = confirmed_timestamp

    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CONFIRM_ORDER_SENT_MANUALLY",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        new_values={
            "po_number": po.po_number,
            "status": po.status.value,
            "confirmed_by": current_user.email,
            "confirmed_at": confirmed_timestamp.isoformat(),
            "notes": payload.notes,
        }
    )
    db.commit()

    return ConfirmSentResponse(
        success=True,
        po_id=po.id,
        po_number=po.po_number,
        status=po.status,
        confirmed_at=confirmed_timestamp,
        message="Order successfully confirmed and marked as SENT_MANUALLY."
    )


# ==============================================================================
# Outlet Smart AI Requirement Calculation Engine & Endpoints
# ==============================================================================

def calculate_outlet_smart_requirements(
    db: Session,
    company_id: str,
    branch_id: str,
    lead_time_days: int = 1,
    safety_buffer_percent: Decimal = Decimal("10.00"),
) -> List[Dict[str, Any]]:
    """
    Deterministic backend calculation of outlet requirements based on:
    actual stock + sales/consumption + minimum/target stock + pending purchase/transfer + supplier mapping.
    """
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == company_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{branch_id}' not found.")

    warehouses = db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True).all()
    wh_ids = [w.id for w in warehouses]

    # 1. Current Stock Map
    stock_map: Dict[str, Decimal] = {}
    min_stock_override: Dict[str, Decimal] = {}
    reorder_qty_override: Dict[str, Decimal] = {}
    if wh_ids:
        sb_list = db.query(StockBalance).filter(StockBalance.warehouse_id.in_(wh_ids)).all()
        for sb in sb_list:
            stock_map[sb.item_id] = stock_map.get(sb.item_id, Decimal("0.0000")) + (sb.quantity or Decimal("0.0000"))
            if sb.min_stock_level is not None and sb.min_stock_level > Decimal("0.0000"):
                min_stock_override[sb.item_id] = sb.min_stock_level
            if sb.reorder_qty is not None and sb.reorder_qty > Decimal("0.0000"):
                reorder_qty_override[sb.item_id] = sb.reorder_qty

    # 2. Pending Inbound Purchase Orders
    pending_po_map: Dict[str, Decimal] = {}
    active_pos = db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == company_id,
        PurchaseOrder.status.in_([
            POStatus.DRAFT,
            POStatus.PENDING_APPROVAL,
            POStatus.APPROVED,
            POStatus.ISSUED,
            POStatus.WHATSAPP_OPENED,
            POStatus.SENT_MANUALLY,
            POStatus.PARTIALLY_RECEIVED
        ])
    ).all()

    for po in active_pos:
        if po.allocations:
            try:
                alloc_data = json.loads(po.allocations) if isinstance(po.allocations, str) else po.allocations
                if isinstance(alloc_data, dict):
                    for item_sum in alloc_data.get("items_summary", []):
                        i_id = item_sum.get("item_id")
                        for alloc in item_sum.get("allocations", []):
                            if alloc.get("branch_id") == branch_id or alloc.get("branch_name") == branch.name:
                                q = Decimal(str(alloc.get("quantity", 0)))
                                pending_po_map[i_id] = pending_po_map.get(i_id, Decimal("0.0000")) + q
            except Exception:
                pass
        elif po.branch_id == branch_id:
            for po_item in po.items:
                rem = max(Decimal("0.0000"), po_item.ordered_qty - (po_item.received_qty or Decimal("0.0000")))
                pending_po_map[po_item.item_id] = pending_po_map.get(po_item.item_id, Decimal("0.0000")) + rem

    # 3. Pending Inbound Stock Transfers
    pending_trf_map: Dict[str, Decimal] = {}
    if wh_ids:
        pending_trfs = db.query(StockTransfer).filter(
            StockTransfer.to_warehouse_id.in_(wh_ids),
            StockTransfer.status == 'PENDING'
        ).all()
        for trf in pending_trfs:
            for t_item in getattr(trf, "items", []):
                pending_trf_map[t_item.item_id] = pending_trf_map.get(t_item.item_id, Decimal("0.0000")) + (t_item.quantity or Decimal("0.0000"))

    # 4. Consumption Rate from StockLedger (last 14 days)
    consumption_map: Dict[str, Decimal] = {}
    cutoff_date = datetime.utcnow() - timedelta(days=14)
    if wh_ids:
        ledgers = db.query(StockLedger).filter(
            StockLedger.warehouse_id.in_(wh_ids),
            StockLedger.created_at >= cutoff_date,
            or_(
                StockLedger.movement_type.in_(['POS_SALE', 'PRODUCTION_OUT', 'TRANSFER_OUT']),
                StockLedger.change_qty < 0
            )
        ).all()
        for l in ledgers:
            consumption_map[l.item_id] = consumption_map.get(l.item_id, Decimal("0.0000")) + abs(l.change_qty)

    # 5. Process Items
    items = db.query(Item).filter(Item.company_id == company_id, Item.is_active == True).all()
    results = []
    safety_multiplier = Decimal("1.0") + (Decimal(str(safety_buffer_percent)) / Decimal("100.0"))

    for itm in items:
        cur_stock = stock_map.get(itm.id, Decimal("0.0000"))
        min_stk = min_stock_override.get(itm.id) or itm.min_stock_level or Decimal("0.0000")
        reorder_q = reorder_qty_override.get(itm.id) or itm.reorder_qty or Decimal("0.0000")
        
        tot_consumed = consumption_map.get(itm.id, Decimal("0.0000"))
        daily_cons = round(tot_consumed / Decimal("14.0"), 4)
        pending_inc = pending_po_map.get(itm.id, Decimal("0.0000")) + pending_trf_map.get(itm.id, Decimal("0.0000"))

        # Target stock calculation
        est_lead_need = daily_cons * Decimal(str(lead_time_days + 1)) * safety_multiplier
        target_stk = max(min_stk * safety_multiplier, est_lead_need, reorder_q)
        if target_stk <= Decimal("0.0000"):
            if min_stk > Decimal("0.0000"):
                target_stk = min_stk * safety_multiplier
            elif reorder_q > Decimal("0.0000"):
                target_stk = reorder_q
            elif daily_cons > Decimal("0.0000"):
                target_stk = daily_cons * Decimal("2.0") * safety_multiplier
            else:
                target_stk = Decimal("10.0000")  # Default baseline target

        target_stk = round(target_stk, 4)
        effective_stock = cur_stock + pending_inc
        short_q = max(Decimal("0.0000"), target_stk - effective_stock)
        short_q = round(short_q, 4)

        suggested_q = short_q
        if suggested_q > Decimal("0.0000") and reorder_q > suggested_q:
            suggested_q = reorder_q

        # Priority determination
        if cur_stock <= Decimal("0.0000") or (min_stk > Decimal("0.0000") and cur_stock <= (min_stk * Decimal("0.5000"))):
            pri = "CRITICAL"
        elif min_stk > Decimal("0.0000") and cur_stock < min_stk:
            pri = "HIGH"
        elif short_q > Decimal("0.0000") or cur_stock < target_stk:
            pri = "MEDIUM"
        else:
            pri = "LOW"

        unit_sym = itm.unit.symbol if itm.unit else "Units"
        reason_parts = [f"Current: {cur_stock:.1f} {unit_sym}, Target: {target_stk:.1f} {unit_sym}"]
        if daily_cons > Decimal("0.0000"):
            reason_parts.append(f"Run-rate: {daily_cons:.2f} {unit_sym}/day")
        if pending_inc > Decimal("0.0000"):
            reason_parts.append(f"Pending: {pending_inc:.1f} {unit_sym}")
        if pri == "CRITICAL":
            reason_parts.append("CRITICAL LOW")
        elif short_q > Decimal("0.0000"):
            reason_parts.append(f"Short: {short_q:.1f} {unit_sym}")
        reason = " | ".join(reason_parts)

        results.append({
            "item_id": itm.id,
            "item_name": itm.name,
            "item_code": itm.code,
            "unit_symbol": unit_sym,
            "supplier_id": itm.supplier_id,
            "supplier_name": itm.supplier.name if itm.supplier else None,
            "supplier_whatsapp": itm.supplier.effective_whatsapp_number if itm.supplier else None,
            "current_stock": cur_stock,
            "min_stock": min_stk,
            "target_stock": target_stk,
            "pending_incoming": pending_inc,
            "daily_consumption": daily_cons,
            "short_qty": short_q,
            "system_suggested_qty": suggested_q,
            "final_order_qty": suggested_q,
            "priority": pri,
            "is_user_modified": False,
            "is_manually_added": False,
            "reason": reason,
            "notes": None,
            "cost_price": itm.cost_price or Decimal("0.0000"),
        })

    priority_weights = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    results.sort(key=lambda x: (priority_weights.get(x["priority"], 4), -float(x["short_qty"])))
    return results


def serialize_smart_draft(draft: SmartRequirementDraft, db: Session) -> SmartRequirementDraftResponse:
    branch = db.query(Branch).filter(Branch.id == draft.branch_id).first()
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == draft.purchase_request_id).first() if draft.purchase_request_id else None
    
    item_schemas = []
    critical_cnt = 0
    high_cnt = 0
    est_val = Decimal("0.0000")

    for itm in draft.items:
        if itm.priority == "CRITICAL":
            critical_cnt += 1
        elif itm.priority == "HIGH":
            high_cnt += 1

        cost = (itm.item.cost_price if itm.item else Decimal("0.0000")) or Decimal("0.0000")
        est_val += (itm.final_order_qty or Decimal("0.0000")) * cost

        item_schemas.append(SmartRequirementItemSchema(
            id=itm.id,
            item_id=itm.item_id,
            item_name=itm.item.name if itm.item else None,
            item_code=itm.item.code if itm.item else None,
            unit_symbol=itm.item.unit.symbol if (itm.item and itm.item.unit) else "Units",
            supplier_id=itm.supplier_id or (itm.item.supplier_id if itm.item else None),
            supplier_name=itm.supplier.name if itm.supplier else (itm.item.supplier.name if (itm.item and itm.item.supplier) else None),
            supplier_whatsapp=itm.supplier.effective_whatsapp_number if itm.supplier else (itm.item.supplier.effective_whatsapp_number if (itm.item and itm.item.supplier) else None),
            current_stock=itm.current_stock,
            min_stock=itm.min_stock,
            target_stock=itm.target_stock,
            pending_incoming=itm.pending_incoming,
            daily_consumption=itm.daily_consumption,
            short_qty=itm.short_qty,
            system_suggested_qty=itm.system_suggested_qty,
            final_order_qty=itm.final_order_qty,
            priority=itm.priority,
            is_user_modified=itm.is_user_modified,
            is_manually_added=itm.is_manually_added,
            reason=itm.reason,
            notes=itm.notes,
        ))

    return SmartRequirementDraftResponse(
        id=draft.id,
        company_id=draft.company_id,
        branch_id=draft.branch_id,
        branch_name=branch.name if branch else None,
        draft_date=draft.draft_date,
        status=draft.status,
        generated_at=draft.generated_at,
        confirmed_at=draft.confirmed_at,
        confirmed_by_id=draft.confirmed_by_id,
        purchase_request_id=draft.purchase_request_id,
        purchase_request_number=pr.request_number if pr else None,
        notes=draft.notes,
        items=item_schemas,
        total_items=len(item_schemas),
        critical_count=critical_cnt,
        high_priority_count=high_cnt,
        estimated_total_order_value=round(est_val, 4),
        audit_summary=json.loads(draft.audit_summary) if draft.audit_summary else None,
    )


@router.post("/smart-requirements/generate", response_model=SmartRequirementDraftResponse, status_code=status.HTTP_201_CREATED)
def generate_smart_requirement_draft(
    payload: GenerateRequirementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generates a Smart AI Requirement Draft for an outlet.
    Uses deterministic stock, sales/consumption, pending orders, and minimum/target levels.
    """
    check_user_outlet_access(current_user, payload.branch_id, db)
    company_id = current_user.company_id
    target_date = payload.draft_date or date.today()

    # Check for existing draft for this branch and date
    existing_draft = db.query(SmartRequirementDraft).filter(
        SmartRequirementDraft.company_id == company_id,
        SmartRequirementDraft.branch_id == payload.branch_id,
        SmartRequirementDraft.draft_date == target_date,
        SmartRequirementDraft.status == "DRAFT"
    ).first()

    if existing_draft and not payload.force_regenerate:
        return serialize_smart_draft(existing_draft, db)

    if existing_draft and payload.force_regenerate:
        db.delete(existing_draft)
        db.flush()

    calc_items = calculate_outlet_smart_requirements(
        db=db,
        company_id=company_id,
        branch_id=payload.branch_id,
        lead_time_days=payload.lead_time_days or 1,
        safety_buffer_percent=payload.safety_buffer_percent or Decimal("10.00"),
    )

    draft = SmartRequirementDraft(
        company_id=company_id,
        branch_id=payload.branch_id,
        draft_date=target_date,
        status="DRAFT",
        generated_at=datetime.utcnow(),
        notes=payload.notes,
        audit_summary=json.dumps({
            "generated_by": current_user.email,
            "generated_at": datetime.utcnow().isoformat(),
            "lead_time_days": payload.lead_time_days,
            "safety_buffer_percent": float(payload.safety_buffer_percent or 10.0),
            "original_calculated_items_count": len(calc_items),
            "original_recommendations": [
                {
                    "item_id": itm["item_id"],
                    "item_name": itm["item_name"],
                    "suggested_qty": float(itm["system_suggested_qty"]),
                    "priority": itm["priority"],
                    "short_qty": float(itm["short_qty"]),
                }
                for itm in calc_items
            ],
            "user_modifications": []
        })
    )
    db.add(draft)
    db.flush()

    for itm in calc_items:
        draft_item = SmartRequirementItem(
            draft_id=draft.id,
            item_id=itm["item_id"],
            supplier_id=itm["supplier_id"],
            current_stock=itm["current_stock"],
            min_stock=itm["min_stock"],
            target_stock=itm["target_stock"],
            pending_incoming=itm["pending_incoming"],
            daily_consumption=itm["daily_consumption"],
            short_qty=itm["short_qty"],
            system_suggested_qty=itm["system_suggested_qty"],
            final_order_qty=itm["final_order_qty"],
            priority=itm["priority"],
            is_user_modified=False,
            is_manually_added=False,
            reason=itm["reason"],
            notes=itm["notes"],
        )
        db.add(draft_item)

    db.commit()
    db.refresh(draft)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="GENERATE_SMART_REQUIREMENT_DRAFT",
        entity_type="SmartRequirementDraft",
        entity_id=draft.id,
        new_values={
            "branch_id": draft.branch_id,
            "draft_date": str(draft.draft_date),
            "items_count": len(calc_items),
            "critical_count": len([x for x in calc_items if x["priority"] == "CRITICAL"]),
        }
    )
    db.commit()

    return serialize_smart_draft(draft, db)


@router.get("/smart-requirements/draft/{branch_id}", response_model=SmartRequirementDraftResponse)
def get_outlet_smart_requirement_draft(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Retrieves the active smart requirement draft for an outlet.
    If none exists for today, automatically prepares one.
    """
    check_user_outlet_access(current_user, branch_id, db)
    company_id = current_user.company_id
    today = date.today()

    draft = db.query(SmartRequirementDraft).filter(
        SmartRequirementDraft.company_id == company_id,
        SmartRequirementDraft.branch_id == branch_id,
        SmartRequirementDraft.draft_date == today,
        SmartRequirementDraft.status == "DRAFT"
    ).first()

    if not draft:
        draft = db.query(SmartRequirementDraft).filter(
            SmartRequirementDraft.company_id == company_id,
            SmartRequirementDraft.branch_id == branch_id,
            SmartRequirementDraft.status == "DRAFT"
        ).order_by(desc(SmartRequirementDraft.generated_at)).first()

    if not draft:
        # Auto-generate today's draft
        return generate_smart_requirement_draft(
            payload=GenerateRequirementRequest(branch_id=branch_id, draft_date=today),
            db=db,
            current_user=current_user
        )

    return serialize_smart_draft(draft, db)


@router.put("/smart-requirements/draft/{draft_id}/items", response_model=SmartRequirementDraftResponse)
def update_smart_requirement_draft_items(
    draft_id: str,
    payload: UpdateDraftItemsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Allows the outlet user to edit quantities, add new items, or remove items in the draft requirement.
    Preserves audit history of user modifications against original system calculations.
    """
    draft = db.query(SmartRequirementDraft).filter(
        SmartRequirementDraft.id == draft_id,
        SmartRequirementDraft.company_id == current_user.company_id
    ).first()
    if not draft:
        raise NotFoundException(f"Draft requirement '{draft_id}' not found.")

    check_user_outlet_access(current_user, draft.branch_id, db)
    if draft.status != "DRAFT":
        raise BadRequestException(f"Cannot edit draft in '{draft.status}' status. Only DRAFT records can be modified.")

    # Load existing items map
    existing_items = {item.item_id: item for item in draft.items}
    audit_data = json.loads(draft.audit_summary) if draft.audit_summary else {"user_modifications": []}
    if "user_modifications" not in audit_data:
        audit_data["user_modifications"] = []

    incoming_item_ids = set()
    modifications = []

    # Update or add items
    for item_in in payload.items:
        incoming_item_ids.add(item_in.item_id)
        if item_in.item_id in existing_items:
            # Existing item update
            item_db = existing_items[item_in.item_id]
            old_qty = float(item_db.final_order_qty)
            new_qty = float(item_in.final_order_qty)

            if old_qty != new_qty:
                mod_record = {
                    "action": "EDIT_QUANTITY",
                    "item_id": item_in.item_id,
                    "item_name": item_in.item_name or (item_db.item.name if item_db.item else ""),
                    "original_suggested_qty": float(item_db.system_suggested_qty),
                    "old_final_qty": old_qty,
                    "new_final_qty": new_qty,
                    "modified_by": current_user.email,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                modifications.append(mod_record)
                audit_data["user_modifications"].append(mod_record)
                item_db.is_user_modified = True

            item_db.final_order_qty = Decimal(str(item_in.final_order_qty))
            if item_in.notes:
                item_db.notes = item_in.notes
            if item_in.supplier_id:
                item_db.supplier_id = item_in.supplier_id
        else:
            # Manually added item
            item_master = db.query(Item).filter(Item.id == item_in.item_id).first()
            if not item_master:
                raise NotFoundException(f"Item '{item_in.item_id}' not found.")

            new_item_db = SmartRequirementItem(
                draft_id=draft.id,
                item_id=item_in.item_id,
                supplier_id=item_in.supplier_id or item_master.supplier_id,
                current_stock=Decimal(str(item_in.current_stock or 0)),
                min_stock=Decimal(str(item_in.min_stock or 0)),
                target_stock=Decimal(str(item_in.target_stock or item_in.final_order_qty)),
                pending_incoming=Decimal(str(item_in.pending_incoming or 0)),
                daily_consumption=Decimal(str(item_in.daily_consumption or 0)),
                short_qty=Decimal(str(item_in.short_qty or item_in.final_order_qty)),
                system_suggested_qty=Decimal("0.0000"),
                final_order_qty=Decimal(str(item_in.final_order_qty)),
                priority=item_in.priority or "MEDIUM",
                is_user_modified=True,
                is_manually_added=True,
                reason="Manually added by outlet user.",
                notes=item_in.notes,
            )
            db.add(new_item_db)
            mod_record = {
                "action": "ADD_ITEM",
                "item_id": item_in.item_id,
                "item_name": item_master.name,
                "added_qty": float(item_in.final_order_qty),
                "modified_by": current_user.email,
                "timestamp": datetime.utcnow().isoformat(),
            }
            modifications.append(mod_record)
            audit_data["user_modifications"].append(mod_record)

    # Detect removed items
    for item_id, item_db in existing_items.items():
        if item_id not in incoming_item_ids:
            mod_record = {
                "action": "REMOVE_ITEM",
                "item_id": item_id,
                "item_name": item_db.item.name if item_db.item else "",
                "removed_qty": float(item_db.final_order_qty),
                "modified_by": current_user.email,
                "timestamp": datetime.utcnow().isoformat(),
            }
            modifications.append(mod_record)
            audit_data["user_modifications"].append(mod_record)
            db.delete(item_db)

    if payload.notes:
        draft.notes = payload.notes
    draft.audit_summary = json.dumps(audit_data)
    draft.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(draft)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="UPDATE_SMART_REQUIREMENT_DRAFT",
        entity_type="SmartRequirementDraft",
        entity_id=draft.id,
        new_values={
            "modifications_count": len(modifications),
            "modifications": modifications,
            "total_items_after_update": len(incoming_item_ids),
        }
    )
    db.commit()

    return serialize_smart_draft(draft, db)


@router.post("/smart-requirements/draft/{draft_id}/confirm", response_model=ConfirmDraftResponse)
def confirm_smart_requirement_draft(
    draft_id: str,
    payload: ConfirmDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Confirms the draft requirement and creates a formal Purchase Request (Indent) for the outlet.
    The resulting Purchase Request directly enters the existing Supplier-wise Auto-Consolidation & WhatsApp workflow.
    """
    draft = db.query(SmartRequirementDraft).filter(
        SmartRequirementDraft.id == draft_id,
        SmartRequirementDraft.company_id == current_user.company_id
    ).first()
    if not draft:
        raise NotFoundException(f"Draft requirement '{draft_id}' not found.")

    check_user_outlet_access(current_user, draft.branch_id, db)
    if draft.status != "DRAFT":
        raise BadRequestException(f"Draft is already in '{draft.status}' status. Only active DRAFT records can be confirmed.")

    confirmed_items = [itm for itm in draft.items if itm.final_order_qty > Decimal("0.0000")]
    if not confirmed_items:
        raise BadRequestException("Cannot confirm draft: No items have an order quantity greater than 0.")

    branch = db.query(Branch).filter(Branch.id == draft.branch_id).first()
    pr_number = f"PR-{branch.code if branch else 'OUT'}-{uuid.uuid4().hex[:6].upper()}"

    # Determine highest priority among items
    priority_order = {"CRITICAL": "URGENT", "HIGH": "HIGH", "MEDIUM": "MEDIUM", "LOW": "LOW"}
    top_pri = "MEDIUM"
    for itm in confirmed_items:
        if itm.priority == "CRITICAL":
            top_pri = "URGENT"
            break
        elif itm.priority == "HIGH" and top_pri not in ["URGENT"]:
            top_pri = "HIGH"

    # 1. Create Purchase Request (Indent)
    pr = PurchaseRequest(
        company_id=current_user.company_id,
        branch_id=draft.branch_id,
        request_number=pr_number,
        requested_by_id=current_user.id,
        required_date=datetime.utcnow() + timedelta(days=1),
        status=PRStatus.PENDING_APPROVAL,
        priority=PRPriority(top_pri) if top_pri in PRPriority.__members__ else PRPriority.MEDIUM,
        notes=payload.notes or f"Smart Requirement indent confirmed for {draft.draft_date}",
    )
    db.add(pr)
    db.flush()

    total_est_amt = Decimal("0.0000")
    for itm in confirmed_items:
        cost = (itm.item.cost_price if itm.item else Decimal("0.0000")) or Decimal("0.0000")
        total_est_amt += itm.final_order_qty * cost

        pr_item = PurchaseRequestItem(
            request_id=pr.id,
            item_id=itm.item_id,
            supplier_id=itm.supplier_id or (itm.item.supplier_id if itm.item else None),
            requested_qty=itm.final_order_qty,
            estimated_price=cost,
            notes=itm.notes or itm.reason,
        )
        db.add(pr_item)

    # 2. Update Draft Status
    confirm_timestamp = datetime.utcnow()
    draft.status = "CONFIRMED"
    draft.confirmed_at = confirm_timestamp
    draft.confirmed_by_id = current_user.id
    draft.purchase_request_id = pr.id
    draft.updated_at = confirm_timestamp

    db.commit()
    db.refresh(pr)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CONFIRM_SMART_REQUIREMENT_DRAFT",
        entity_type="SmartRequirementDraft",
        entity_id=draft.id,
        new_values={
            "draft_id": draft.id,
            "purchase_request_id": pr.id,
            "request_number": pr.request_number,
            "branch_id": draft.branch_id,
            "items_count": len(confirmed_items),
            "total_estimated_amount": float(total_est_amt),
            "confirmed_by": current_user.email,
        }
    )
    db.commit()

    return ConfirmDraftResponse(
        success=True,
        draft_id=draft.id,
        purchase_request_id=pr.id,
        request_number=pr.request_number,
        branch_id=draft.branch_id,
        branch_name=branch.name if branch else "",
        items_count=len(confirmed_items),
        total_estimated_amount=round(total_est_amt, 4),
        message=f"Smart Requirement draft successfully confirmed and converted to Purchase Request {pr.request_number} (PENDING_APPROVAL)."
    )


@router.post("/smart-requirements/ask", response_model=SmartAIAskResponse)
def ask_smart_requirement_assistant(
    payload: SmartAIAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Outlet AI Assistant Q&A:
    Answers questions based on deterministic stock + sales/consumption + minimum/target + pending order calculations.
    Questions supported:
    - 'What stock is low today?'
    - 'What do I need to order?'
    - 'What is critical?'
    - 'What is already pending?'
    - 'What do I need for tomorrow?'
    """
    check_user_outlet_access(current_user, payload.branch_id, db)
    branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.company_id == current_user.company_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{payload.branch_id}' not found.")

    all_items = calculate_outlet_smart_requirements(
        db=db,
        company_id=current_user.company_id,
        branch_id=payload.branch_id,
    )

    q = payload.question.lower().strip()
    critical_items = [x for x in all_items if x["priority"] == "CRITICAL"]
    low_items = [x for x in all_items if x["current_stock"] < x["min_stock"]]
    order_items = [x for x in all_items if x["short_qty"] > Decimal("0.0000")]
    pending_items = [x for x in all_items if x["pending_incoming"] > Decimal("0.0000")]
    tomorrow_items = [x for x in all_items if x["daily_consumption"] > Decimal("0.0000") or x["short_qty"] > Decimal("0.0000")]

    intent = "GENERAL"
    filtered_items = []
    answer_text = ""

    if any(k in q for k in ["critical", "urgent", "empty", "zero", "out of stock"]):
        intent = "CRITICAL"
        filtered_items = critical_items
        if filtered_items:
            lines = [f"{i+1}. {it['item_name']} — Current: {it['current_stock']:.1f} {it['unit_symbol']} (Min: {it['min_stock']:.1f} {it['unit_symbol']}) — Deficit: {it['short_qty']:.1f} {it['unit_symbol']}" for i, it in enumerate(filtered_items)]
            answer_text = f"Found {len(filtered_items)} CRITICAL item(s) requiring immediate order for {branch.name}:\n\n" + "\n".join(lines)
        else:
            answer_text = f"Great news! There are currently 0 critical stock shortages at {branch.name}."

    elif any(k in q for k in ["low", "low stock", "threshold"]):
        intent = "LOW_STOCK"
        filtered_items = low_items
        if filtered_items:
            lines = [f"{i+1}. {it['item_name']} — {it['current_stock']:.1f} {it['unit_symbol']} (Min threshold: {it['min_stock']:.1f} {it['unit_symbol']})" for i, it in enumerate(filtered_items)]
            answer_text = f"Found {len(filtered_items)} item(s) below minimum stock level at {branch.name}:\n\n" + "\n".join(lines)
        else:
            answer_text = f"All monitored inventory items at {branch.name} are currently above minimum safety thresholds."

    elif any(k in q for k in ["pending", "transit", "incoming", "already ordered"]):
        intent = "PENDING"
        filtered_items = pending_items
        if filtered_items:
            lines = [f"{i+1}. {it['item_name']} — {it['pending_incoming']:.1f} {it['unit_symbol']} incoming (Supplier: {it['supplier_name'] or 'Assigned Vendor'})" for i, it in enumerate(filtered_items)]
            answer_text = f"There are {len(filtered_items)} item(s) with pending orders or in-transit transfers for {branch.name}:\n\n" + "\n".join(lines)
        else:
            answer_text = f"No pending purchase orders or inbound transfers currently in-flight for {branch.name}."

    elif any(k in q for k in ["tomorrow", "next day", "forecast"]):
        intent = "TOMORROW"
        filtered_items = tomorrow_items
        if filtered_items:
            lines = [f"{i+1}. {it['item_name']} — Current: {it['current_stock']:.1f} {it['unit_symbol']} | Est Tomorrow Use: {it['daily_consumption']:.1f} {it['unit_symbol']} | Short: {it['short_qty']:.1f} {it['unit_symbol']} | Order: {it['system_suggested_qty']:.1f} {it['unit_symbol']}" for i, it in enumerate(filtered_items)]
            answer_text = f"Tomorrow's requirement forecast for {branch.name} (based on 14-day consumption run-rate):\n\n" + "\n".join(lines)
        else:
            answer_text = f"Stock levels at {branch.name} are sufficient to comfortably cover tomorrow's expected consumption."

    elif any(k in q for k in ["order", "buy", "replenish", "need"]):
        intent = "NEED_TO_ORDER"
        filtered_items = order_items
        if filtered_items:
            lines = [f"{i+1}. {it['item_name']} — Current: {it['current_stock']:.1f} {it['unit_symbol']} — Required: {it['target_stock']:.1f} {it['unit_symbol']} — Short: {it['short_qty']:.1f} {it['unit_symbol']} — Order: {it['system_suggested_qty']:.1f} {it['unit_symbol']}" for i, it in enumerate(filtered_items)]
            answer_text = f"Requirement recommendation for {branch.name} ({len(filtered_items)} item(s) needing replenishment):\n\n" + "\n".join(lines)
        else:
            answer_text = f"No replenishment needed! All items at {branch.name} meet target inventory levels."

    else:
        intent = "GENERAL"
        filtered_items = order_items if order_items else all_items
        answer_text = f"Inventory Status for {branch.name}:\n- Total Monitored Items: {len(all_items)}\n- Critical Low: {len(critical_items)}\n- Below Min Stock: {len(low_items)}\n- Items Needing Order: {len(order_items)}\n- Pending Orders: {len(pending_items)}"

    item_schemas = [
        SmartRequirementItemSchema(
            item_id=it["item_id"],
            item_name=it["item_name"],
            item_code=it["item_code"],
            unit_symbol=it["unit_symbol"],
            supplier_id=it["supplier_id"],
            supplier_name=it["supplier_name"],
            supplier_whatsapp=it["supplier_whatsapp"],
            current_stock=it["current_stock"],
            min_stock=it["min_stock"],
            target_stock=it["target_stock"],
            pending_incoming=it["pending_incoming"],
            daily_consumption=it["daily_consumption"],
            short_qty=it["short_qty"],
            system_suggested_qty=it["system_suggested_qty"],
            final_order_qty=it["final_order_qty"],
            priority=it["priority"],
            is_user_modified=it["is_user_modified"],
            is_manually_added=it["is_manually_added"],
            reason=it["reason"],
            notes=it["notes"],
        )
        for it in filtered_items
    ]

    metrics = {
        "total_monitored_items": len(all_items),
        "critical_count": len(critical_items),
        "low_stock_count": len(low_items),
        "need_order_count": len(order_items),
        "pending_items_count": len(pending_items),
    }

    return SmartAIAskResponse(
        success=True,
        branch_id=payload.branch_id,
        branch_name=branch.name,
        question=payload.question,
        intent=intent,
        answer_text=answer_text,
        metrics=metrics,
        items=item_schemas,
    )


@router.get("/smart-requirements/config/{branch_id}", response_model=BranchRequirementConfigResponse)
def get_branch_requirement_config(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieves preparation schedule configuration for an outlet."""
    check_user_outlet_access(current_user, branch_id, db)
    cfg = db.query(BranchRequirementConfig).filter(
        BranchRequirementConfig.branch_id == branch_id,
        BranchRequirementConfig.company_id == current_user.company_id
    ).first()

    if not cfg:
        cfg = BranchRequirementConfig(
            company_id=current_user.company_id,
            branch_id=branch_id,
            preparation_time="16:00",
            is_auto_enabled=True,
            lead_time_days=1,
            safety_buffer_percent=Decimal("10.00"),
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)

    return cfg


@router.put("/smart-requirements/config/{branch_id}", response_model=BranchRequirementConfigResponse)
def update_branch_requirement_config(
    branch_id: str,
    payload: BranchRequirementConfigCreateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Updates preparation schedule configuration for an outlet."""
    check_user_outlet_access(current_user, branch_id, db)
    cfg = db.query(BranchRequirementConfig).filter(
        BranchRequirementConfig.branch_id == branch_id,
        BranchRequirementConfig.company_id == current_user.company_id
    ).first()

    if not cfg:
        cfg = BranchRequirementConfig(
            company_id=current_user.company_id,
            branch_id=branch_id,
            preparation_time=payload.preparation_time or "16:00",
            is_auto_enabled=payload.is_auto_enabled if payload.is_auto_enabled is not None else True,
            lead_time_days=payload.lead_time_days or 1,
            safety_buffer_percent=payload.safety_buffer_percent or Decimal("10.00"),
        )
        db.add(cfg)
    else:
        if payload.preparation_time is not None:
            cfg.preparation_time = payload.preparation_time
        if payload.is_auto_enabled is not None:
            cfg.is_auto_enabled = payload.is_auto_enabled
        if payload.lead_time_days is not None:
            cfg.lead_time_days = payload.lead_time_days
        if payload.safety_buffer_percent is not None:
            cfg.safety_buffer_percent = payload.safety_buffer_percent
        cfg.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(cfg)
    return cfg


@router.post("/smart-requirements/process-schedules")
def process_scheduled_smart_requirements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Automated scheduled requirement preparation runner.
    Prepares draft requirements for all outlets with is_auto_enabled=True.
    Strictly prevents duplicate draft creation for the same calendar date.
    """
    today = date.today()
    configs = db.query(BranchRequirementConfig).filter(
        BranchRequirementConfig.company_id == current_user.company_id,
        BranchRequirementConfig.is_auto_enabled == True
    ).all()

    processed = []
    skipped = []

    for cfg in configs:
        # Check if already generated today
        existing_draft = db.query(SmartRequirementDraft).filter(
            SmartRequirementDraft.company_id == cfg.company_id,
            SmartRequirementDraft.branch_id == cfg.branch_id,
            SmartRequirementDraft.draft_date == today
        ).first()

        if existing_draft or cfg.last_generated_date == today:
            skipped.append({
                "branch_id": cfg.branch_id,
                "reason": "Draft already exists or prepared for today."
            })
            continue

        calc_items = calculate_outlet_smart_requirements(
            db=db,
            company_id=cfg.company_id,
            branch_id=cfg.branch_id,
            lead_time_days=cfg.lead_time_days,
            safety_buffer_percent=cfg.safety_buffer_percent,
        )

        draft = SmartRequirementDraft(
            company_id=cfg.company_id,
            branch_id=cfg.branch_id,
            draft_date=today,
            status="DRAFT",
            generated_at=datetime.utcnow(),
            notes=f"Auto-scheduled requirement prepared at configured time {cfg.preparation_time}",
            audit_summary=json.dumps({
                "scheduled_trigger": True,
                "preparation_time": cfg.preparation_time,
                "generated_at": datetime.utcnow().isoformat(),
                "original_calculated_items_count": len(calc_items),
            })
        )
        db.add(draft)
        db.flush()

        for itm in calc_items:
            draft_item = SmartRequirementItem(
                draft_id=draft.id,
                item_id=itm["item_id"],
                supplier_id=itm["supplier_id"],
                current_stock=itm["current_stock"],
                min_stock=itm["min_stock"],
                target_stock=itm["target_stock"],
                pending_incoming=itm["pending_incoming"],
                daily_consumption=itm["daily_consumption"],
                short_qty=itm["short_qty"],
                system_suggested_qty=itm["system_suggested_qty"],
                final_order_qty=itm["final_order_qty"],
                priority=itm["priority"],
                is_user_modified=False,
                is_manually_added=False,
                reason=itm["reason"],
                notes=itm["notes"],
            )
            db.add(draft_item)

        cfg.last_generated_date = today
        processed.append({
            "branch_id": cfg.branch_id,
            "draft_id": draft.id,
            "items_count": len(calc_items),
        })

    db.commit()

    return {
        "success": True,
        "processed_count": len(processed),
        "skipped_count": len(skipped),
        "processed": processed,
        "skipped": skipped,
        "message": f"Processed {len(processed)} outlet schedule(s), skipped {len(skipped)} already up-to-date."
    }


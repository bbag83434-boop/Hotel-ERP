import os
import base64
import uuid
import json
import re
import urllib.parse
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple

# Local invoice OCR dependencies are imported defensively so the ERP can boot
# even before the OCR packages are installed. The OCR endpoints return a clear
# installation message until the packages are present.
try:
    import pytesseract
    from PIL import Image, ImageOps
    from io import BytesIO
except Exception:
    pytesseract = None
    Image = None
    ImageOps = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    from pdf2image import convert_from_bytes
except Exception:
    convert_from_bytes = None

from fastapi import APIRouter, Depends, Query, Path, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission, require_outlet_scope, require_head_office_role, HQ_APPROVER_ROLES
from app.core.exceptions import (
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
)
from app.models.user import User, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import (
    Item, Unit, StockBalance, StockLedger, StockTransfer, StockTransferItem,
    StockMovementType, StockBatch, OutletStockBalance, OutletStockBatch, OutletStockLedger,
)
from app.models.procurement import (
    Supplier,
    SupplierItem,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceiveNote,
    GoodsReceiveItem,
    PRStatus,
    POStatus,
    PRPriority,
    GRNStatus,
    SmartRequirementDraft,
    SmartRequirementItem,
    BranchRequirementConfig,
)
from app.models.closing import (
    OutletClosingRecord,
    ClosingStockItem,
    FoodCostCalculation,
    ClosingPeriodType,
    ClosingStatus,
)
from app.models.audit import AuditLog
from app.models.billing import VendorBill, Payment, BillStatus
from app.schemas.procurement import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierItemCreate,
    SupplierItemUpdate,
    SupplierItemResponse,
    PurchaseRequestCreate,
    PurchaseRequestUpdate,
    PurchaseRequestRejectRequest,
    PurchaseRequestReturnRequest,
    PurchaseRequestItemCreate,
    PurchaseRequestItemResponse,
    PurchaseRequestResponse,
    PurchaseOrderItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderCancelRequest,
    PurchaseOrderResponse,
    ConsolidateOrdersRequest,
    ConsolidateOrdersResponse,
    ApproveOrderRequest,
    RejectOrderRequest,
    WhatsAppLinkResponse,
    ConfirmSentRequest,
    ConfirmSentResponse,
    GoodsReceiveItemCreate,
    GoodsReceiveItemResponse,
    GoodsReceiveNoteCreate,
    GoodsReceiveFromPOCreate,
    GoodsReceiveNoteApproveRequest,
    GoodsReceiveNoteRejectRequest,
    SupplierInvoiceUploadRequest,
    SupplierInvoiceUploadResponse,
    GoodsReceiveNoteResponse,
    ThreeWayMatchLine,
    ThreeWayMatchResponse,
    ClosingItemSubmit,
    ClosingSubmitRequest,
    ClosingStockItemResponse,
    FoodCostBreakdownResponse,
    OutletClosingRecordResponse,
    ActiveClosingDraftResponse,
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
    CentralStoreRequirementCreate,
    CentralStoreVendorCatalogItem,
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
        raise BadRequestException("Vendor WhatsApp number is not available. Please update Vendor Master.")

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
    role = user.role
    if not role and user.role_id:
        role = db.query(User).filter(User.id == user.id).first()
        from app.models.user import Role as RoleModel
        role = db.query(RoleModel).filter(RoleModel.id == user.role_id).first()
    if role and role.name and role.name.strip().upper() in HQ_APPROVER_ROLES:
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


# Valid requisition classifications on the shared purchase_requests entity.
REQUISITION_TYPES = {"PURCHASE", "MAIN_KITCHEN", "CENTRAL_STORE"}


def normalize_requisition_type(value: Optional[str]) -> str:
    """
    Normalizes & validates the requisition_type classification used on the
    shared purchase_requests table. Accepts lowercase input, stores uppercase.
    """
    normalized = (value or "PURCHASE").strip().upper()
    if normalized not in REQUISITION_TYPES:
        raise BadRequestException("requisition_type must be one of 'PURCHASE', 'MAIN_KITCHEN' or 'CENTRAL_STORE'")
    return normalized


def resolve_default_item_vendor(db: Session, item: Item) -> Tuple[Optional[str], str]:
    """
    PART 3 — Auto-resolves the default vendor for an item from the existing
    Item/Vendor Master (supplier_items + items.supplierId). The Central Store
    user must NEVER manually choose the vendor:

    1. Active PREFERRED SupplierItem mapping (Item/Vendor Master) -> PREFERRED_VENDOR_MASTER
    2. Item Master default supplier (items.supplierId)            -> ITEM_MASTER_DEFAULT
    3. Nothing configured                                         -> NOT_CONFIGURED

    Returns (supplier_id, vendor_source).
    """
    if item is None:
        return None, "NOT_CONFIGURED"

    preferred = None
    try:
        preferred = db.query(SupplierItem).filter(
            SupplierItem.company_id == item.company_id,
            SupplierItem.item_id == item.id,
            SupplierItem.is_preferred == True,  # noqa: E712
            SupplierItem.is_active == True,  # noqa: E712
        ).order_by(SupplierItem.updated_at.desc()).first()
    except Exception:
        preferred = None

    if preferred:
        return preferred.supplier_id, "PREFERRED_VENDOR_MASTER"

    if item.supplier_id:
        return item.supplier_id, "ITEM_MASTER_DEFAULT"

    return None, "NOT_CONFIGURED"


def get_configured_supplier_item_price(db: Session, item: Item, supplier_id: str) -> Decimal:
    """Return the master-data price for an already-resolved supplier/item pair.

    This intentionally does not resolve a vendor.  Vendor routing stays in
    resolve_default_item_vendor(); this helper only prevents a client-side
    estimate from becoming the Direct Vendor PO amount.
    """
    supplier_mapping = db.query(SupplierItem).filter(
        SupplierItem.company_id == item.company_id,
        SupplierItem.item_id == item.id,
        SupplierItem.supplier_id == supplier_id,
        SupplierItem.is_active == True,  # noqa: E712
    ).order_by(SupplierItem.is_preferred.desc(), SupplierItem.updated_at.desc()).first()
    if supplier_mapping and supplier_mapping.purchase_price is not None:
        return Decimal(str(supplier_mapping.purchase_price))
    return Decimal(str(item.cost_price or Decimal("0.0000")))


def format_central_store_catalog_item(db: Session, item: Item) -> CentralStoreVendorCatalogItem:
    """Builds the catalog row with the auto-resolved vendor for a single item."""
    supplier_id, vendor_source = resolve_default_item_vendor(db, item)
    supplier_name = None
    if supplier_id:
        sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        supplier_name = sup.name if sup else None
    return CentralStoreVendorCatalogItem(
        item_id=item.id,
        item_name=item.name,
        item_code=item.code,
        unit_symbol=item.unit.symbol if item.unit else None,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        vendor_source=vendor_source,
        vendor_configured=bool(supplier_id),
    )


def format_whatsapp_message(
    supplier_name: str,
    po_number: str,
    po_id: str,
    supplier_id: str,
    items_summary: List[Dict[str, Any]],
    allocations_by_outlet: Dict[str, Any]
) -> str:
    # Determine all unique destinations and if Central Store is present
    destinations_set = set()
    has_cs = False
    
    for item in items_summary:
        for alloc in item.get("allocations", []):
            bname = alloc.get("branch_name", "UNKNOWN").strip()
            if "central store" in bname.lower():
                has_cs = True
            destinations_set.add(bname)

    lines = []
    lines.append(f"Hello {supplier_name},")
    lines.append("")
    if po_number:
        lines.append(f"Purchase Order: {po_number}")
        lines.append("")

    if len(destinations_set) == 1:
        dest_name = list(destinations_set)[0]
        if has_cs:
            lines.append("Please supply the following items to:")
            lines.append("")
            lines.append("Central Store")
            lines.append("")
            for idx, item in enumerate(items_summary, 1):
                qty = item.get('total_qty', 0)
                unit = item.get('unit_symbol', '').strip()
                qty_fmt = f"{qty:g}" if isinstance(qty, (int, float, Decimal)) else str(qty)
                lines.append(f"{idx}. {item['item_name']} — {qty_fmt} {unit}".strip())
            lines.append("")
            lines.append("Please deliver the above quantities to Central Store.")
        else:
            lines.append("Please supply the following items for:")
            lines.append("")
            lines.append(f"Outlet: {dest_name}")
            lines.append("")
            for idx, item in enumerate(items_summary, 1):
                qty = item.get('total_qty', 0)
                unit = item.get('unit_symbol', '').strip()
                qty_fmt = f"{qty:g}" if isinstance(qty, (int, float, Decimal)) else str(qty)
                lines.append(f"{idx}. {item['item_name']} — {qty_fmt} {unit}".strip())
            lines.append("")
            lines.append(f"Please deliver the above quantities to {dest_name}.")

    elif has_cs and len(destinations_set) > 1:
        # MIXED: CS + Outlets
        for item in items_summary:
            for alloc in item.get("allocations", []):
                bname = alloc.get("branch_name", "UNKNOWN").strip()
                if "central store" in bname.lower():
                    bname = "CENTRAL STORE"
                else:
                    bname = bname.upper()
                
                # We group by destination
                pass
                
        # Actually group by destination
        dest_map = {}
        for item in items_summary:
            for alloc in item.get("allocations", []):
                bname = alloc.get("branch_name", "UNKNOWN").strip()
                if "central store" in bname.lower():
                    bname = "CENTRAL STORE"
                else:
                    bname = bname.upper()
                
                if bname not in dest_map:
                    dest_map[bname] = []
                q = float(alloc.get("quantity", alloc.get("qty", 0)))
                q_fmt = f"{q:g}" if isinstance(q, (int, float)) else str(q)
                unit = item.get('unit_symbol', '').strip()
                dest_map[bname].append(f"{item['item_name']} → {q_fmt} {unit}".strip())
                
        for bname, items_list in dest_map.items():
            lines.append(bname)
            for it in items_list:
                lines.append(it)
            lines.append("")
            
        lines.append("Please deliver each quantity to the respective destination.")
        
    else:
        # MULTIPLE OUTLETS, NO CS
        lines.append("Please supply:")
        lines.append("")
        for item in items_summary:
            qty = item.get('total_qty', 0)
            unit = item.get('unit_symbol', '').strip()
            qty_fmt = f"{qty:g}" if isinstance(qty, (int, float, Decimal)) else str(qty)
            
            lines.append(f"{item['item_name']} — Total {qty_fmt} {unit}".strip())
            lines.append("")
            lines.append("Outlet-wise:")
            lines.append("")
            
            for alloc in item.get("allocations", []):
                bname = alloc.get("branch_name", "UNKNOWN").strip()
                q = float(alloc.get("quantity", alloc.get("qty", 0)))
                q_fmt = f"{q:g}" if isinstance(q, (int, float)) else str(q)
                lines.append(f"• {bname} → {q_fmt} {unit}".strip())
            lines.append("")
            
        lines.append("Please deliver each quantity to the respective Outlet.")
        
    lines.append("")
    lines.append("Thank you.")
    
    return "\n".join(lines).strip()


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


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_200_OK)
def delete_supplier(
    supplier_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Dependency-safe Vendor (Supplier) deletion.

    Hard deletion is blocked whenever the vendor is referenced by master or
    transactional records (vendor-item mappings, POS, POs, GRNs, bills,
    payments, requisition lines, smart-requirement lines, payable accounts,
    default item supplier links, ...). The caller is asked to use
    Active/Inactive instead.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise NotFoundException(f"Supplier '{supplier_id}' not found.")

    from app.models.billing import VendorBill, Payment
    from app.models.finance import AccountsPayable

    check_labels = [
        ("vendor-item mapping(s)", SupplierItem, supplier_id),
        ("purchase order(s)", PurchaseOrder, supplier_id),
        ("goods receive note(s)", GoodsReceiveNote, supplier_id),
        ("requisition line(s)", PurchaseRequestItem, supplier_id),
        ("smart requirement line(s)", SmartRequirementItem, supplier_id),
        ("vendor bill(s)", VendorBill, supplier_id),
        ("vendor payment(s)", Payment, supplier_id),
        ("payable account(s)", AccountsPayable, supplier_id),
        ("item master default supplier link(s)", Item, supplier_id),
    ]

    reasons: list[str] = []
    for label, model, value in check_labels:
        try:
            if hasattr(model, "supplier_id") and getattr(model, "supplier_id") is not None:
                count = db.query(func.count()).select_from(model).filter(getattr(model, "supplier_id") == value).scalar() or 0
                if count:
                    reasons.append(f"{count} {label}")
        except Exception:
            continue

    if reasons:
        raise BadRequestException(
            message="Vendor cannot be deleted because it is referenced by existing records.",
            details={"references": reasons, "deactivate_instead": True},
        )

    db.delete(supplier)
    db.commit()
    return {"message": "Vendor deleted successfully", "id": supplier_id}


# ==============================================================================
# Vendor-Item Mapping (SupplierItem) Endpoints
# ==============================================================================

def format_supplier_item_response(si: SupplierItem, db: Session) -> SupplierItemResponse:
    sup = si.supplier or db.query(Supplier).filter(Supplier.id == si.supplier_id).first()
    it = si.item or db.query(Item).filter(Item.id == si.item_id).first()
    pu = si.purchase_unit or (db.query(Unit).filter(Unit.id == si.purchase_unit_id).first() if si.purchase_unit_id else None)
    base_unit = it.unit if it else None

    return SupplierItemResponse(
        id=si.id,
        company_id=si.company_id,
        supplier_id=si.supplier_id,
        item_id=si.item_id,
        supplier_item_code=si.supplier_item_code,
        supplier_item_name=si.supplier_item_name,
        purchase_unit_id=si.purchase_unit_id,
        purchase_price=Decimal(str(si.purchase_price or 0)),
        conversion_rate=Decimal(str(si.conversion_rate or 1)),
        lead_time_days=si.lead_time_days or 1,
        is_preferred=bool(si.is_preferred),
        is_active=bool(si.is_active),
        supplier_name=sup.name if sup else None,
        supplier_code=sup.code if sup else None,
        item_name=it.name if it else None,
        item_code=it.code if it else None,
        purchase_unit_name=pu.name if pu else None,
        purchase_unit_symbol=pu.symbol if pu else None,
        base_unit_symbol=base_unit.symbol if base_unit else None,
        created_at=si.created_at,
        updated_at=si.updated_at,
    )


@router.get("/vendor-items", response_model=List[SupplierItemResponse])
def list_vendor_items(
    supplier_id: Optional[str] = Query(None, description="Filter by Supplier ID"),
    item_id: Optional[str] = Query(None, description="Filter by Item ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List vendor-item catalog mappings with supplier and item details."""
    query = db.query(SupplierItem)
    if current_user.company_id:
        query = query.filter(SupplierItem.company_id == current_user.company_id)
    if supplier_id:
        query = query.filter(SupplierItem.supplier_id == supplier_id)
    if item_id:
        query = query.filter(SupplierItem.item_id == item_id)
    if is_active is not None:
        query = query.filter(SupplierItem.is_active == is_active)

    mappings = query.order_by(SupplierItem.created_at.desc()).all()
    return [format_supplier_item_response(m, db) for m in mappings]


@router.post("/vendor-items", response_model=SupplierItemResponse, status_code=status.HTTP_201_CREATED)
def create_vendor_item(
    payload: SupplierItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new Vendor-to-Item mapping.
    Blocks duplicate active mappings and inactive supplier/item links.
    """
    company_id = payload.company_id or current_user.company_id
    if not company_id:
        comp = db.query(Company).first()
        company_id = comp.id if comp else "default-company"

    # 1. Validate Supplier
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise NotFoundException(f"Supplier '{payload.supplier_id}' not found")
    if not supplier.is_active:
        raise BadRequestException(f"Cannot map to inactive supplier '{supplier.name}'")

    # 2. Validate Item
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise NotFoundException(f"Item '{payload.item_id}' not found")
    if not item.is_active:
        raise BadRequestException(f"Cannot map to inactive item '{item.name}'")

    # 3. Check for existing mapping
    existing = db.query(SupplierItem).filter(
        SupplierItem.company_id == company_id,
        SupplierItem.supplier_id == payload.supplier_id,
        SupplierItem.item_id == payload.item_id,
    ).first()
    if existing:
        if existing.is_active:
            raise ConflictException(
                f"Active Vendor-Item mapping already exists between supplier '{supplier.name}' and item '{item.name}'"
            )
        else:
            # Reactivate and update existing mapping
            existing.is_active = True
            existing.purchase_price = payload.purchase_price
            existing.conversion_rate = payload.conversion_rate
            existing.lead_time_days = payload.lead_time_days
            existing.is_preferred = payload.is_preferred
            existing.supplier_item_code = payload.supplier_item_code
            existing.supplier_item_name = payload.supplier_item_name
            existing.purchase_unit_id = payload.purchase_unit_id
            db.commit()
            db.refresh(existing)
            return format_supplier_item_response(existing, db)

    # 4. If preferred, un-mark previous preferred mappings for this item
    if payload.is_preferred:
        db.query(SupplierItem).filter(
            SupplierItem.company_id == company_id,
            SupplierItem.item_id == payload.item_id,
            SupplierItem.is_preferred == True,
        ).update({"is_preferred": False})

    # 5. Create new mapping
    new_mapping = SupplierItem(
        id=str(uuid.uuid4()),
        company_id=company_id,
        supplier_id=payload.supplier_id,
        item_id=payload.item_id,
        supplier_item_code=payload.supplier_item_code,
        supplier_item_name=payload.supplier_item_name,
        purchase_unit_id=payload.purchase_unit_id,
        purchase_price=payload.purchase_price,
        conversion_rate=payload.conversion_rate,
        lead_time_days=payload.lead_time_days,
        is_preferred=payload.is_preferred,
        is_active=payload.is_active,
    )
    db.add(new_mapping)
    db.flush()

    from app.models.inventory import ItemRate
    initial_rate = ItemRate(
        id=str(uuid.uuid4()),
        company_id=new_mapping.company_id,
        item_id=new_mapping.item_id,
        supplier_id=new_mapping.supplier_id,
        rate=new_mapping.purchase_price,
        unit_id=new_mapping.purchase_unit_id,
        effective_from=datetime.utcnow(),
    )
    db.add(initial_rate)

    db.commit()
    db.refresh(new_mapping)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_VENDOR_ITEM_MAPPING",
        entity_type="SupplierItem",
        entity_id=new_mapping.id,
        company_id=company_id,
        new_values={
            "supplier_id": payload.supplier_id,
            "item_id": payload.item_id,
            "purchase_price": str(payload.purchase_price),
            "conversion_rate": str(payload.conversion_rate),
            "is_preferred": payload.is_preferred,
        },
    )
    db.commit()
    return format_supplier_item_response(new_mapping, db)


@router.get("/vendor-items/{mapping_id}", response_model=SupplierItemResponse)
def get_vendor_item(
    mapping_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve single vendor-item mapping details."""
    mapping = db.query(SupplierItem).filter(SupplierItem.id == mapping_id).first()
    if not mapping:
        raise NotFoundException(f"Vendor-Item mapping '{mapping_id}' not found")
    return format_supplier_item_response(mapping, db)


@router.put("/vendor-items/{mapping_id}", response_model=SupplierItemResponse)
def update_vendor_item(
    mapping_id: str = Path(...),
    payload: SupplierItemUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update vendor-item mapping attributes, prices, or conversion rates."""
    mapping = db.query(SupplierItem).filter(SupplierItem.id == mapping_id).first()
    if not mapping:
        raise NotFoundException(f"Vendor-Item mapping '{mapping_id}' not found")

    old_values = {
        "purchase_price": str(mapping.purchase_price),
        "conversion_rate": str(mapping.conversion_rate),
        "is_preferred": mapping.is_preferred,
        "is_active": mapping.is_active,
    }

    # If setting to preferred, un-mark previous preferred mappings
    if payload.is_preferred is True:
        db.query(SupplierItem).filter(
            SupplierItem.company_id == mapping.company_id,
            SupplierItem.item_id == mapping.item_id,
            SupplierItem.id != mapping.id,
            SupplierItem.is_preferred == True,
        ).update({"is_preferred": False})

    update_dict = payload.dict(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(mapping, k, v)

    db.flush()
    if payload.purchase_price is not None and old_values["purchase_price"] != str(payload.purchase_price):
        now = datetime.utcnow()
        from app.models.inventory import ItemRate
        old_rate_record = db.query(ItemRate).filter(
            ItemRate.item_id == mapping.item_id,
            ItemRate.supplier_id == mapping.supplier_id,
            ItemRate.is_active == True
        ).order_by(ItemRate.effective_from.desc()).first()
        
        if old_rate_record:
            old_rate_record.effective_to = now
            old_rate_record.is_active = False
            
        new_rate_record = ItemRate(
            id=str(uuid.uuid4()),
            company_id=mapping.company_id,
            item_id=mapping.item_id,
            supplier_id=mapping.supplier_id,
            rate=payload.purchase_price,
            unit_id=mapping.purchase_unit_id,
            effective_from=now,
        )
        db.add(new_rate_record)

    db.commit()
    db.refresh(mapping)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="UPDATE_VENDOR_ITEM_MAPPING",
        entity_type="SupplierItem",
        entity_id=mapping.id,
        old_values=old_values,
        new_values=update_dict,
    )
    db.commit()
    return format_supplier_item_response(mapping, db)


@router.delete("/vendor-items/{mapping_id}")
def delete_vendor_item(
    mapping_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Soft-delete / deactivate vendor-item mapping."""
    mapping = db.query(SupplierItem).filter(SupplierItem.id == mapping_id).first()
    if not mapping:
        raise NotFoundException(f"Vendor-Item mapping '{mapping_id}' not found")

    mapping.is_active = False
    db.commit()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="DEACTIVATE_VENDOR_ITEM_MAPPING",
        entity_type="SupplierItem",
        entity_id=mapping.id,
    )
    db.commit()
    return {"message": "Vendor-Item mapping deactivated successfully", "id": mapping_id}



def format_pr_response(req: PurchaseRequest, db: Session) -> PurchaseRequestResponse:
    branch = req.branch or db.query(Branch).filter(Branch.id == req.branch_id).first()
    branch_name = branch.name if branch else "Unknown Branch"
    
    btype = getattr(branch, "type", "RESTAURANT") if branch else "RESTAURANT"
    if btype == "CENTRAL_STORE":
        ptype = "CENTRAL_STORE_PURCHASE"
    elif btype == "DESSERT_KITCHEN":
        ptype = "DESSERT_KITCHEN_PURCHASE"
    else:
        ptype = "DIRECT_OUTLET_PURCHASE"

    items_res = []
    total_amount = Decimal("0.0000")
    for item in req.items:
        db_item = item.item or db.query(Item).filter(Item.id == item.item_id).first()
        unit_sym = db_item.unit.symbol if db_item and db_item.unit else "UNIT"
        sup_name = item.supplier.name if item.supplier else (db_item.supplier.name if db_item and db_item.supplier else None)
        items_res.append(
            PurchaseRequestItemResponse(
                id=item.id,
                request_id=item.request_id,
                item_id=item.item_id,
                item_name=db_item.name if db_item else "Unknown Item",
                item_code=db_item.code if db_item else "",
                unit_symbol=unit_sym,
                unit=item.unit or unit_sym,
                supply_source=(item.supply_source or (db_item.supply_source if db_item else None)) or "CENTRAL_STORE",
                supplier_id=item.supplier_id,
                supplier_name=sup_name,
                requested_qty=item.requested_qty,
                estimated_price=item.estimated_price,
                notes=item.notes,
            )
        )
        # The PR amount is derived from its own requested quantity and estimate;
        # it must never be substituted with a downstream PO, GRN, or invoice value.
        total_amount += Decimal(str(item.requested_qty or 0)) * Decimal(str(item.estimated_price or 0))
    return PurchaseRequestResponse(
        id=req.id,
        company_id=req.company_id,
        branch_id=req.branch_id,
        branch_name=branch_name,
        request_number=req.request_number,
        requested_by_id=req.requested_by_id,
        required_date=req.required_date,
        status=req.status,
        priority=str(req.priority.value if hasattr(req.priority, "value") else req.priority),
        purchase_type=ptype,
        requisition_type=req.requisition_type or "PURCHASE",
        notes=req.notes,
        approved_by_id=req.approved_by_id,
        approved_at=req.approved_at,
        rejection_reason=req.rejection_reason,
        total_amount=total_amount,
        items=items_res,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def format_po_response(po: PurchaseOrder, db: Session) -> PurchaseOrderResponse:
    branch = po.branch or (db.query(Branch).filter(Branch.id == po.branch_id).first() if po.branch_id else None)
    branch_name = branch.name if branch else ("Multi-Outlet Consolidated" if po.allocations else "Central Store")
    
    if po.allocations:
        # Check if it's a single destination Central Store allocation
        is_single_central_store = False
        if branch and getattr(branch, "type", "") == "CENTRAL_STORE":
            try:
                alloc_data = json.loads(po.allocations)
                if "outlets" in alloc_data and len(alloc_data["outlets"]) == 1:
                    is_single_central_store = True
            except Exception:
                pass
        
        if is_single_central_store:
            ptype = "CENTRAL_STORE_PURCHASE"
        else:
            ptype = "MULTI_DESTINATION_PURCHASE"
    elif branch and getattr(branch, "type", "") == "CENTRAL_STORE":
        ptype = "CENTRAL_STORE_PURCHASE"
    elif branch and getattr(branch, "type", "") == "DESSERT_KITCHEN":
        ptype = "DESSERT_KITCHEN_PURCHASE"
    else:
        ptype = "DIRECT_OUTLET_PURCHASE"

    items_res = []
    for item in po.items:
        db_item = item.item or db.query(Item).filter(Item.id == item.item_id).first()
        unit_sym = db_item.unit.symbol if db_item and db_item.unit else "UNIT"
        items_res.append(
            PurchaseOrderItemResponse(
                id=item.id,
                po_id=item.po_id,
                item_id=item.item_id,
                item_name=db_item.name if db_item else "Unknown Item",
                item_code=db_item.code if db_item else "",
                unit_symbol=unit_sym,
                ordered_qty=item.ordered_qty,
                received_qty=item.received_qty or Decimal("0.0000"),
                unit_price=item.unit_price,
                total_price=item.total_price,
                notes=item.notes,
                allocations=item.allocations,
            )
        )
    return PurchaseOrderResponse(
        id=po.id,
        company_id=po.company_id,
        branch_id=po.branch_id,
        branch_name=branch_name,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else None,
        supplier_phone=po.supplier.phone if po.supplier else None,
        supplier_whatsapp=po.supplier.whatsapp_number if po.supplier else None,
        po_number=po.po_number,
        status=po.status,
        purchase_type=ptype,
        order_date=po.order_date,
        expected_delivery_date=po.expected_delivery_date,
        total_amount=po.total_amount,
        tax_amount=po.tax_amount or Decimal("0.0000"),
        discount_amount=po.discount_amount or Decimal("0.0000"),
        net_amount=po.net_amount or po.total_amount,
        notes=po.notes,
        approved_by_id=po.approved_by_id,
        approved_at=po.approved_at,
        whatsapp_opened_at=po.whatsapp_opened_at,
        whatsapp_number=po.whatsapp_number,
        allocations=po.allocations,
        items=items_res,
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


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
    requisition_type = normalize_requisition_type(payload.requisition_type)

    # PART 3 — Central Store own requirement:
    # Pre-validate the whole requirement BEFORE creating any row so an invalid
    # purchase request (item without a configured vendor) can never proceed.
    if requisition_type == "CENTRAL_STORE":
        if (branch.type or "").upper() != "CENTRAL_STORE":
            raise BadRequestException(
                f"Central Store Requirement can only be raised for a CENTRAL_STORE location; "
                f"branch '{branch.name}' is type '{branch.type or 'UNKNOWN'}'."
            )
        missing_vendor: List[str] = []
        for item_in in payload.items:
            db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
            if not db_item:
                raise NotFoundException(f"Inventory Item '{item_in.item_id}' not found.")
            supplier_id, _ = resolve_default_item_vendor(db, db_item)
            if not supplier_id:
                missing_vendor.append(db_item.name)
        if missing_vendor:
            raise BadRequestException(
                "Vendor is not configured for this item: "
                + ", ".join(sorted(set(missing_vendor)))
                + ". Assign a preferred vendor in the Item/Vendor Master before creating the Central Store Requirement."
            )

    # DIRECT_VENDOR follows the same existing Item/Vendor Master resolver.  The
    # request payload is never a vendor-selection mechanism: every direct line
    # is validated and mapped before a PurchaseRequest row is persisted.
    missing_direct_vendor: List[str] = []
    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Inventory Item '{item_in.item_id}' not found.")
        if (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR":
            supplier_id, _ = resolve_default_item_vendor(db, db_item)
            if not supplier_id:
                missing_direct_vendor.append(db_item.name)
    if missing_direct_vendor:
        raise BadRequestException(
            "Vendor is not configured for Direct Vendor item(s): "
            + ", ".join(sorted(set(missing_direct_vendor)))
            + ". Assign an active preferred SupplierItem or Item Master supplier before submitting the request."
        )

    req_prefix = {"MAIN_KITCHEN": "MR-", "CENTRAL_STORE": "CR-"}.get(requisition_type, "PR-")
    req_number = f"{req_prefix}{datetime.utcnow().strftime('%Y%m%d')}-{abs(hash(str(datetime.utcnow()) + payload.branch_id + requisition_type)) % 100000:05d}"

    req = PurchaseRequest(
        company_id=company_id,
        branch_id=payload.branch_id,
        request_number=req_number,
        requested_by_id=current_user.id,
        required_date=payload.required_date or datetime.utcnow(),
        status=PRStatus.PENDING_APPROVAL,
        priority=payload.priority or "MEDIUM",
        requisition_type=requisition_type,
        notes=payload.notes,
    )
    db.add(req)
    db.flush()

    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Inventory Item '{item_in.item_id}' not found.")

        # Determine supplier: explicit -> item master -> None.
        # PART 3: Central Store own requirement NEVER carries a manually chosen
        # vendor — it is always auto-resolved from the Item/Vendor Master.
        if requisition_type == "CENTRAL_STORE":
            supplier_id, _ = resolve_default_item_vendor(db, db_item)
        elif (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR":
            # Ignore any supplier_id supplied by the outlet. Direct Vendor
            # routing is determined solely by Item/Vendor Master configuration.
            supplier_id, _ = resolve_default_item_vendor(db, db_item)
        else:
            supplier_id = item_in.supplier_id or db_item.supplier_id

        # Resolve unit & supply source automatically from the Item Master supply routing —
        # the Outlet Requirement NEVER carries a manually chosen source.

        item_unit = db_item.unit.symbol if db_item.unit else None
        item_supply_source = db_item.supply_source or "CENTRAL_STORE"

        pr_item = PurchaseRequestItem(
            request_id=req.id,
            item_id=item_in.item_id,
            supplier_id=supplier_id,
            unit=item_unit,
            supply_source=item_supply_source,
            requested_qty=item_in.requested_qty,
            estimated_price=(
                get_configured_supplier_item_price(db, db_item, supplier_id)
                if (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR" and supplier_id
                else item_in.estimated_price or db_item.cost_price or Decimal("0.0000")
            ),
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
    return format_pr_response(req, db)


@router.get("/requests", response_model=List[PurchaseRequestResponse])
def list_purchase_requests(
    branch_id: Optional[str] = None,
    status_filter: Optional[PRStatus] = None,
    priority: Optional[str] = None,
    requisition_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase requests with optional outlet, status, priority, and search filters."""
    query = db.query(PurchaseRequest)
    if current_user.company_id:
        query = query.filter(PurchaseRequest.company_id == current_user.company_id)
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(PurchaseRequest.branch_id == branch_id)
    if status_filter:
        query = query.filter(PurchaseRequest.status == status_filter)
    if priority:
        query = query.filter(PurchaseRequest.priority == priority)
    if requisition_type:
        query = query.filter(PurchaseRequest.requisition_type == normalize_requisition_type(requisition_type))
    if search:
        s_term = f"%{search}%"
        query = query.filter(or_(
            PurchaseRequest.request_number.ilike(s_term),
            PurchaseRequest.notes.ilike(s_term)
        ))

    requests = query.order_by(desc(PurchaseRequest.created_at)).all()
    return [format_pr_response(r, db) for r in requests]


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
    return format_pr_response(req, db)


@router.put("/requests/{request_id}", response_model=PurchaseRequestResponse)
def update_purchase_request(
    request_id: str = Path(...),
    payload: PurchaseRequestUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Central Purchase Control / Authorizer edits a PR (quantities, supplier, priority, notes).
    Permitted while PR is DRAFT or PENDING_APPROVAL.
    """
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)

    if req.status not in [PRStatus.DRAFT, PRStatus.PENDING_APPROVAL]:
        raise BadRequestException(f"Cannot edit PR with status '{req.status.value}'.")

    if payload.required_date:
        req.required_date = payload.required_date
    if payload.priority:
        req.priority = payload.priority
    if payload.notes is not None:
        req.notes = payload.notes

    if payload.items is not None:
        # PART 3 — Central Store own requirement update: validate vendor presence
        # BEFORE touching existing rows so an invalid PR can never be saved.
        if req.requisition_type == "CENTRAL_STORE":
            missing_vendor: List[str] = []
            for item_in in payload.items:
                db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
                if not db_item:
                    raise NotFoundException(f"Item '{item_in.item_id}' not found.")
                supplier_id, _ = resolve_default_item_vendor(db, db_item)
                if not supplier_id:
                    missing_vendor.append(db_item.name)
            if missing_vendor:
                raise BadRequestException(
                    "Vendor is not configured for this item: "
                    + ", ".join(sorted(set(missing_vendor)))
                    + ". Assign a preferred vendor in the Item/Vendor Master before updating this Central Store Requirement."
                )

        missing_direct_vendor: List[str] = []
        for item_in in payload.items:
            db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
            if not db_item:
                raise NotFoundException(f"Item '{item_in.item_id}' not found.")
            if (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR":
                supplier_id, _ = resolve_default_item_vendor(db, db_item)
                if not supplier_id:
                    missing_direct_vendor.append(db_item.name)
        if missing_direct_vendor:
            raise BadRequestException(
                "Vendor is not configured for Direct Vendor item(s): "
                + ", ".join(sorted(set(missing_direct_vendor)))
                + ". Assign an active preferred SupplierItem or Item Master supplier before updating the request."
            )

        # Replace items
        db.query(PurchaseRequestItem).filter(PurchaseRequestItem.request_id == req.id).delete()
        for item_in in payload.items:
            db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
            if not db_item:
                raise NotFoundException(f"Item '{item_in.item_id}' not found.")
            # PART 3: Central Store own requirement vendors are ALWAYS resolved
            # automatically from the Item/Vendor Master — no manual override.
            if req.requisition_type == "CENTRAL_STORE":
                supplier_id, _ = resolve_default_item_vendor(db, db_item)
            elif (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR":
                supplier_id, _ = resolve_default_item_vendor(db, db_item)
            else:
                supplier_id = item_in.supplier_id or db_item.supplier_id
            # Resolve unit & supply source automatically from the Item Master supply routing —
            # the Outlet Requirement NEVER carries a manually chosen source.


            item_unit = db_item.unit.symbol if db_item.unit else None
            item_supply_source = db_item.supply_source or "CENTRAL_STORE"

            pr_item = PurchaseRequestItem(
                request_id=req.id,
                item_id=item_in.item_id,
                supplier_id=supplier_id,
                unit=item_unit,
                supply_source=item_supply_source,
                requested_qty=item_in.requested_qty,
                estimated_price=(
                    get_configured_supplier_item_price(db, db_item, supplier_id)
                    if (db_item.supply_source or "CENTRAL_STORE").upper() == "DIRECT_VENDOR" and supplier_id
                    else item_in.estimated_price or db_item.cost_price or Decimal("0.0000")
                ),
                notes=item_in.notes,
            )
            db.add(pr_item)

    req.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="UPDATE_PURCHASE_REQUEST",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        new_values={"status": req.status.value, "priority": str(req.priority)}
    )
    db.commit()
    return format_pr_response(req, db)


# ==============================================================================
# PART 3 — Central Store Own Requirement
# Central Store is an independent stock location. It raises its OWN requirement
# for items it needs. This is NOT an outlet requirement. The vendor for every
# selected item is auto-resolved from the existing Item/Vendor Master.
# ==============================================================================

@router.get("/central-store-requirements/catalog", response_model=List[CentralStoreVendorCatalogItem])
def get_central_store_requirement_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns every active item with its AUTO-RESOLVED vendor from the existing
    Item/Vendor Master. The Central Store user never picks a vendor — the system
    reads the preferred SupplierItem mapping and falls back to the Item Master
    default supplier. Items without a configured vendor are flagged so the UI can
    show "Vendor is not configured for this item." and block them from submission.
    """
    items = (
        db.query(Item)
        .filter(Item.company_id == current_user.company_id, Item.is_active == True)  # noqa: E712
        .order_by(Item.name.asc())
        .all()
    )
    return [format_central_store_catalog_item(db, it) for it in items]


@router.post("/central-store-requirements", response_model=PurchaseRequestResponse, status_code=status.HTTP_201_CREATED)
def create_central_store_requirement(
    payload: CentralStoreRequirementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a CENTRAL_STORE requisition (own requirement of the Central Store).

    Vendor is NEVER accepted from the client — it is auto-resolved per line from
    the Item/Vendor Master. If ANY selected item has no configured vendor the
    whole requirement is rejected ("Vendor is not configured for this item.")
    and no purchase request row is created, so an invalid PR cannot proceed.
    """
    check_user_outlet_access(current_user, payload.branch_id, db)

    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise NotFoundException(f"Central Store branch '{payload.branch_id}' not found.")
    if (branch.type or "").upper() != "CENTRAL_STORE":
        raise BadRequestException(
            f"Central Store Requirement can only be created for a CENTRAL_STORE location; "
            f"branch '{branch.name}' is type '{branch.type or 'UNKNOWN'}'."
        )

    company_id = branch.company_id or current_user.company_id

    # 1) Auto-resolve vendors & validate ALL lines up-front (no partial saves).
    resolved_lines = []
    missing_vendor: List[str] = []
    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Inventory Item '{item_in.item_id}' not found.")
        supplier_id, vendor_source = resolve_default_item_vendor(db, db_item)
        if not supplier_id:
            missing_vendor.append(db_item.name)
            continue
        resolved_lines.append((item_in, db_item, supplier_id))

    if missing_vendor:
        raise BadRequestException(
            "Vendor is not configured for this item: "
            + ", ".join(sorted(set(missing_vendor)))
            + ". Assign a preferred vendor in the Item/Vendor Master before creating the Central Store Requirement."
        )

    # 2) Create the purchase request (requisition_type = CENTRAL_STORE).
    requisition_type = "CENTRAL_STORE"
    req_number = (
        f"CR-{branch.code.upper() if branch.code else 'CS'}-"
        f"{datetime.utcnow().strftime('%Y%m%d')}-"
        f"{abs(hash(str(datetime.utcnow()) + payload.branch_id + requisition_type)) % 100000:05d}"
    )
    req = PurchaseRequest(
        company_id=company_id,
        branch_id=payload.branch_id,
        request_number=req_number,
        requested_by_id=current_user.id,
        required_date=payload.required_date or datetime.utcnow(),
        status=PRStatus.PENDING_APPROVAL,
        priority=payload.priority or "MEDIUM",
        requisition_type=requisition_type,
        notes=payload.notes,
    )
    db.add(req)
    db.flush()

    for item_in, db_item, supplier_id in resolved_lines:
        pr_item = PurchaseRequestItem(
            request_id=req.id,
            item_id=item_in.item_id,
            supplier_id=supplier_id,
            unit=db_item.unit.symbol if db_item.unit else None,
            supply_source=db_item.supply_source or "CENTRAL_STORE",
            requested_qty=item_in.requested_qty,
            estimated_price=db_item.cost_price or Decimal("0.0000"),
            notes=item_in.notes,
        )
        db.add(pr_item)

    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_CENTRAL_STORE_REQUIREMENT",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        company_id=company_id,
        branch_id=payload.branch_id,
        new_values={"request_number": req.request_number, "items_count": len(resolved_lines)}
    )
    db.commit()
    return format_pr_response(req, db)


@router.post("/requests/{request_id}/approve", response_model=PurchaseRequestResponse)
def approve_purchase_request(
    request_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approves a Purchase Request, enabling it for supplier consolidation or direct PO issuance.
    Strictly restricted to authorized Head Office roles.
    """
    require_head_office_role(current_user, db)
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)

    if req.status not in [PRStatus.PENDING_APPROVAL, PRStatus.DRAFT]:
        raise BadRequestException(f"Cannot approve PR with status '{req.status.value}'.")
    # Top-level Admin/Owner roles may approve their own purchase requests.
    # Other approvers remain protected from self-approval.
    raw_role = getattr(current_user, "role", None)
    role_name = getattr(raw_role, "name", raw_role) or ""
    role_name = str(role_name).strip().upper().replace("-", "_").replace(" ", "_")
    admin_self_approval_roles = {
        "SUPER_ADMIN",
        "SUPERADMIN",
        "OWNER",
        "ADMIN",
        "HQ_ADMIN",
        "HEAD_OFFICE_ADMIN",
    }

    if req.requested_by_id == current_user.id and role_name not in admin_self_approval_roles:
        raise ForbiddenException("A Purchase Request creator cannot approve their own request.")

    previous_status = req.status.value

    req.status = PRStatus.APPROVED
    req.approved_by_id = current_user.id
    req.approved_at = datetime.utcnow()
    req.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="APPROVE_PURCHASE_REQUEST",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        old_values={"status": previous_status},
        new_values={
            "status": "APPROVED",
            "approved_by": current_user.email,
            "approved_at": req.approved_at.isoformat() if req.approved_at else None,
        }
    )
    db.commit()


    # Phase 6 & 7: Auto split downstream workflow
    if req.requisition_type == "CENTRAL_STORE":
        # Central Store own requirement -> auto-generate PO and treat the
        # already-approved requirement as the approval event for that PO.
        # This makes the approved PO immediately available in Central Store
        # Purchase Receiving, where the vendor bill/OCR flow starts.
        try:
            generated_orders = consolidate_outlet_orders(
                payload=ConsolidateOrdersRequest(
                    request_ids=[req.id],
                    auto_submit=False,
                    notes=f"Auto-generated PO from Central Store Requirement {req.request_number}"
                ),
                db=db,
                current_user=current_user
            )

            # The requirement approval is the PO approval for Central Store.
            # Prefer the returned PO objects, but also re-check the database
            # using the exact participating request id so legacy/consolidation
            # responses cannot leave the PO in DRAFT.
            now = datetime.utcnow()
            generated_ids = [getattr(po, "id", None) for po in (getattr(generated_orders, "orders", []) or [])]
            generated_ids = [x for x in generated_ids if x]

            candidate_pos = []
            if generated_ids:
                candidate_pos = db.query(PurchaseOrder).filter(PurchaseOrder.id.in_(generated_ids)).all()

            # Fallback: locate the exact PO using the structured participating_request_ids payload.
            fallback_pos = db.query(PurchaseOrder).filter(
                PurchaseOrder.company_id == req.company_id,
                PurchaseOrder.status.in_([
                    POStatus.DRAFT, POStatus.PENDING_APPROVAL, POStatus.ORDERED, POStatus.ISSUED
                ])
            ).all()
            for po in fallback_pos:
                allocation_text = getattr(po, "allocations", None) or ""
                if req.id in allocation_text and po not in candidate_pos:
                    candidate_pos.append(po)

            for generated_po in candidate_pos:
                generated_po.status = POStatus.APPROVED
                generated_po.approved_by_id = current_user.id
                generated_po.approved_at = generated_po.approved_at or now
                generated_po.updated_at = now
                db.add(generated_po)

            db.commit()
        except Exception as exc:
            # Keep the approved requirement, but do not silently turn a failed
            # PO-generation step into a fake receiving-ready order.
            db.rollback()
            log_procurement_audit(
                db=db,
                user=current_user,
                action="CENTRAL_STORE_PO_GENERATION_WARNING",
                entity_type="PurchaseRequest",
                entity_id=req.id,
                new_values={"error": str(exc)}
            )
            db.commit()
    else:
        # Outlet requirement -> Split based on Item Master supply routing
        has_direct_vendor = False
        has_central_store = False
        central_store_items = []
        for itm in req.items:
            db_item = db.query(Item).filter(Item.id == itm.item_id).first()
            supply = (itm.supply_source or (db_item.supply_source if db_item else "CENTRAL_STORE"))
            if str(supply).upper() == "DIRECT_VENDOR":
                has_direct_vendor = True
            else:
                has_central_store = True
                central_store_items.append(itm)

        if has_direct_vendor:
            direct_vendor_orders = consolidate_outlet_orders(
                payload=ConsolidateOrdersRequest(
                    request_ids=[req.id],
                    auto_submit=False,
                    supply_source_filter=["DIRECT_VENDOR"],
                    notes=f"Auto-generated PO from Outlet Requirement {req.request_number}"
                ),
                db=db,
                current_user=current_user
            )
            # Reuse the established submit lifecycle so every generated Direct
            # Vendor PO is PENDING_APPROVAL (never vendor-sendable on creation).
            for direct_vendor_po in direct_vendor_orders.orders:
                submit_order_for_approval(
                    order_id=direct_vendor_po.id,
                    db=db,
                    current_user=current_user,
                )
                
        if has_central_store and central_store_items:
            # Create a StockTransfer (REQUESTED state) for Central Store queue
            central_wh = db.query(Warehouse).filter(
                Warehouse.is_central == True, 
                Warehouse.company_id == req.company_id,
                Warehouse.is_active == True
            ).first()
            outlet_wh = db.query(Warehouse).filter(
                Warehouse.branch_id == req.branch_id,
                Warehouse.company_id == req.company_id,
                Warehouse.is_active == True
            ).first()
            
            if central_wh and outlet_wh and central_wh.id != outlet_wh.id:
                trf_num = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                transfer = StockTransfer(
                    company_id=req.company_id,
                    from_warehouse_id=central_wh.id,
                    to_warehouse_id=outlet_wh.id,
                    source_branch_id=central_wh.branch_id,
                    destination_branch_id=outlet_wh.branch_id,
                    transfer_number=trf_num,
                    status="REQUESTED",
                    transfer_date=datetime.utcnow(),
                    notes=f"Auto-generated transfer request from {req.request_number}",
                    created_by_id=current_user.id,
                    requested_by_id=req.requested_by_id,
                )
                db.add(transfer)
                db.flush()
                
                for pr_item in central_store_items:
                    db_item = db.query(Item).filter(Item.id == pr_item.item_id).first()
                    trf_item = StockTransferItem(
                        transfer_id=transfer.id,
                        item_id=pr_item.item_id,
                        requested_qty=pr_item.requested_qty,
                        quantity=pr_item.requested_qty,
                        unit_cost=db_item.cost_price if db_item else Decimal("0.0000"),
                        notes=pr_item.notes,
                    )
                    db.add(trf_item)
                db.commit()

    db.refresh(req)

    return format_pr_response(req, db)


@router.post("/requests/{request_id}/reject", response_model=PurchaseRequestResponse)
def reject_purchase_request(
    request_id: str = Path(...),
    payload: PurchaseRequestRejectRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Rejects a Purchase Request with required reason.
    Strictly restricted to authorized Head Office roles.
    """
    require_head_office_role(current_user, db)
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)

    req.status = PRStatus.REJECTED
    req.rejection_reason = payload.reason
    req.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="REJECT_PURCHASE_REQUEST",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        new_values={"status": "REJECTED", "reason": payload.reason}
    )
    db.commit()
    return format_pr_response(req, db)


@router.post("/requests/{request_id}/return", response_model=PurchaseRequestResponse)
def return_purchase_request(
    request_id: str = Path(...),
    payload: PurchaseRequestReturnRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Returns a Purchase Request to DRAFT status for outlet correction."""
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)

    req.status = PRStatus.DRAFT
    req.notes = f"{req.notes or ''} [Returned for Correction: {payload.reason}]".strip()
    req.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="RETURN_PURCHASE_REQUEST",
        entity_type="PurchaseRequest",
        entity_id=req.id,
        new_values={"status": "DRAFT", "reason": payload.reason}
    )
    db.commit()
    return format_pr_response(req, db)


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
        if (
            payload.supply_source_filter
            and "DIRECT_VENDOR" in {str(source).upper() for source in payload.supply_source_filter}
            and pr.status != PRStatus.APPROVED
        ):
            raise BadRequestException(
                f"Direct Vendor Purchase Order for '{pr.request_number}' requires approved Purchase Request status."
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

            # Identify Supply Source & apply filter
            effective_supply_source = (pr_item.supply_source or db_item.supply_source or "CENTRAL_STORE").upper()
            supply_source_filter = {str(source).upper() for source in (payload.supply_source_filter or [])}
            if supply_source_filter and effective_supply_source not in supply_source_filter:
                continue

            # DIRECT_VENDOR must always use the existing authoritative Item/Vendor
            # Master resolver; a stored or client-provided PR supplier cannot
            # override a preferred active SupplierItem mapping.
            if effective_supply_source == "DIRECT_VENDOR":
                effective_supplier_id, _ = resolve_default_item_vendor(db, db_item)
            else:
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
            # A direct-vendor delivery is physically received by the requesting
            # outlet, never by the Central Store.  Keep each outlet's vendor
            # lines in its own PO even when the vendor is shared.
            supplier_group_key = (
                f"{effective_supplier_id}:{pr.branch_id}"
                if effective_supply_source == "DIRECT_VENDOR"
                else effective_supplier_id
            )
            if supplier_group_key not in supplier_groups:
                supplier_groups[supplier_group_key] = {
                    "supplier": supplier,
                    "items": {},
                    "outlet_breakdown": {},
                    "participating_requests": set(),
                    "participating_branches": set(),
                }

            s_group = supplier_groups[supplier_group_key]
            s_group["participating_requests"].add(pr.id)
            s_group["participating_branches"].add(branch_name)

            unit_sym = db_item.unit.symbol if db_item.unit else "Units"
            qty = Decimal(str(pr_item.requested_qty))
            # A PR estimate is never a PO rate.  Resolve the actual supplier
            # price at PO creation, falling back to Item.cost_price only when
            # this supplier has no active SupplierItem price.
            price = get_configured_supplier_item_price(db, db_item, effective_supplier_id)

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

        unique_branch_ids = {r.branch_id for r in requests if r.id in s_data["participating_requests"]}
        assigned_branch_id = list(unique_branch_ids)[0] if len(unique_branch_ids) == 1 else None

        # Create PO
        po = PurchaseOrder(
            company_id=company_id,
            branch_id=assigned_branch_id,
            supplier_id=supplier.id,
            po_number=po_num,
            status=po_status,
            order_date=datetime.utcnow(),
            total_amount=total_amt,
            tax_amount=Decimal("0.0000"),
            discount_amount=Decimal("0.0000"),
            net_amount=total_amt,
            notes=payload.notes or f"Auto-consolidated order for outlets: {', '.join(s_data['participating_branches'])}",
            created_by_id=current_user.id,
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

    # Update participating Purchase Requests status.
    #
    # A PR must advance to ORDERED only when ALL its items have been consolidated
    # into a vendor PO.  When a supply_source_filter is active (e.g. DIRECT_VENDOR-only),
    # any item whose effective supply_source was excluded by that filter is still pending
    # fulfilment (e.g. a CENTRAL_STORE item whose StockTransfer is REQUESTED).
    # In that case the PR must stay at APPROVED — marking it ORDERED would incorrectly
    # hide its pending Central Store work from the CS fulfilment queue.
    for pr in requests:
        if payload.supply_source_filter:
            # Check whether this PR has any item that was excluded by the filter.
            # If it does, the PR has outstanding CENTRAL_STORE (or other) items
            # still awaiting fulfilment → keep status at APPROVED.
            has_excluded_items = any(
                (pri.supply_source or (
                    db.query(Item).filter(Item.id == pri.item_id).first()
                ).supply_source or "CENTRAL_STORE") not in payload.supply_source_filter
                for pri in pr.items
            )
            if not has_excluded_items:
                # All items matched the filter → every item was consolidated → ORDERED.
                pr.status = PRStatus.ORDERED
            # else: leave at APPROVED (mixed or pure-CS outlet PR)
        else:
            # No filter: all items were consolidated.
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

@router.post("/orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_direct_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a direct Purchase Order for a destination outlet, Central Store, or Dessert Kitchen.
    """
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise NotFoundException(f"Supplier '{payload.supplier_id}' not found.")

    if not supplier.is_active:
        raise BadRequestException(f"Supplier '{supplier.name}' is inactive.")

    if payload.branch_id:
        check_user_outlet_access(current_user, payload.branch_id, db)
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise NotFoundException(f"Branch '{payload.branch_id}' not found.")
        company_id = branch.company_id or current_user.company_id
    else:
        company_id = current_user.company_id or supplier.company_id

    po_number = f"PO-{datetime.utcnow().strftime('%Y%m%d%H%M')}-{abs(hash(str(payload.supplier_id) + str(datetime.utcnow()))) % 10000:04d}"

    total_amount = Decimal("0.0000")
    po_items_to_add = []
    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Item '{item_in.item_id}' not found.")
        # Ignore the client-supplied unit_price.  PO amounts are always derived
        # from SupplierItem master pricing (or the established item-cost fallback).
        authoritative_unit_price = get_configured_supplier_item_price(
            db, db_item, payload.supplier_id
        )
        line_total = item_in.ordered_qty * authoritative_unit_price
        total_amount += line_total
        po_items_to_add.append({
            "item_id": item_in.item_id,
            "ordered_qty": item_in.ordered_qty,
            "unit_price": authoritative_unit_price,
            "total_price": line_total,
            "notes": item_in.notes,
        })

    tax_amount = payload.tax_amount or Decimal("0.0000")
    discount_amount = payload.discount_amount or Decimal("0.0000")
    net_amount = total_amount + tax_amount - discount_amount

    po = PurchaseOrder(
        company_id=company_id,
        branch_id=payload.branch_id,
        supplier_id=payload.supplier_id,
        po_number=po_number,
        status=POStatus.DRAFT,
        order_date=datetime.utcnow(),
        expected_delivery_date=payload.expected_delivery_date,
        total_amount=total_amount,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        net_amount=net_amount,
        notes=payload.notes,
        created_by_id=current_user.id,
        whatsapp_number=supplier.effective_whatsapp_number,
    )
    db.add(po)
    db.flush()

    for item_data in po_items_to_add:
        po_item = PurchaseOrderItem(
            po_id=po.id,
            item_id=item_data["item_id"],
            ordered_qty=item_data["ordered_qty"],
            received_qty=Decimal("0.0000"),
            unit_price=item_data["unit_price"],
            total_price=item_data["total_price"],
            notes=item_data["notes"],
        )
        db.add(po_item)

    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_DIRECT_PURCHASE_ORDER",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        new_values={"po_number": po.po_number, "supplier_name": supplier.name, "total_amount": float(net_amount)}
    )
    db.commit()
    return format_po_response(po, db)


@router.get("/orders", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(
    branch_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    status_filter: Optional[POStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase orders with branch, supplier, status, and search filters."""
    query = db.query(PurchaseOrder)
    if current_user.company_id:
        query = query.filter(PurchaseOrder.company_id == current_user.company_id)
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(or_(PurchaseOrder.branch_id == branch_id, PurchaseOrder.allocations.ilike(f"%{branch_id}%")))
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)
    if search:
        s_term = f"%{search}%"
        query = query.filter(or_(
            PurchaseOrder.po_number.ilike(s_term),
            PurchaseOrder.notes.ilike(s_term)
        ))

    orders = query.order_by(desc(PurchaseOrder.created_at)).all()
    return [format_po_response(o, db) for o in orders]


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
    return format_po_response(po, db)


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
    return format_po_response(po, db)


@router.post("/orders/{order_id}/approve", response_model=PurchaseOrderResponse)
def approve_purchase_order(
    order_id: str = Path(...),
    payload: Optional[ApproveOrderRequest] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approves a Purchase Order for supplier issuance.
    Requires manager / approver authorization.
    """
    require_head_office_role(current_user, db)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status not in [POStatus.PENDING_APPROVAL, POStatus.DRAFT]:
        raise BadRequestException(f"Cannot approve order with status '{po.status.value}'. Must be PENDING_APPROVAL or DRAFT.")
    if po.created_by_id and po.created_by_id == current_user.id:
        raise ForbiddenException("A Purchase Order creator cannot approve their own order.")

    old_status = po.status.value
    po.status = POStatus.APPROVED
    po.approved_by_id = current_user.id
    po.approved_at = datetime.utcnow()
    if payload and payload.notes:
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
            "notes": payload.notes if payload else None,
        }
    )
    db.commit()
    return format_po_response(po, db)


@router.post("/orders/{order_id}/reject", response_model=PurchaseOrderResponse)
def reject_purchase_order(
    order_id: str = Path(...),
    payload: RejectOrderRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Rejects / cancels a purchase order with recorded reason."""
    require_head_office_role(current_user, db)
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
    return format_po_response(po, db)


@router.post("/orders/{order_id}/cancel", response_model=PurchaseOrderResponse)
def cancel_purchase_order(
    order_id: str = Path(...),
    payload: PurchaseOrderCancelRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Cancels a purchase order with recorded reason."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    if po.status in [POStatus.RECEIVED, POStatus.CANCELLED]:
        raise BadRequestException(f"Cannot cancel order with status '{po.status.value}'.")

    old_status = po.status.value
    po.status = POStatus.CANCELLED
    po.notes = f"{po.notes or ''} [Cancellation Reason: {payload.reason}]".strip()
    po.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(po)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CANCEL_PURCHASE_ORDER",
        entity_type="PurchaseOrder",
        entity_id=po.id,
        old_values={"status": old_status},
        new_values={"status": po.status.value, "reason": payload.reason, "po_number": po.po_number}
    )
    db.commit()
    return format_po_response(po, db)


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
                "allocations": json.loads(po_item.allocations) if po_item.allocations else []
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
        po_id=po.id,
        supplier_id=supplier.id,
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
# Central Store Fulfilment Queue
# ==============================================================================

@router.get("/central-store/queue")
def list_central_store_queue(
    status_filter: Optional[str] = Query("REQUESTED"),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Central Store fulfilment queue generated from approved outlet requirements."""
    query = db.query(StockTransfer).filter(
        StockTransfer.company_id == current_user.company_id,
        StockTransfer.from_warehouse_id.in_(
            db.query(Warehouse.id).filter(
                Warehouse.company_id == current_user.company_id,
                Warehouse.is_central == True,  # noqa: E712
                Warehouse.is_active == True,   # noqa: E712
            )
        ),
    )

    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(StockTransfer.destination_branch_id == branch_id)

    if status_filter:
        query = query.filter(StockTransfer.status == status_filter)

    transfers = query.order_by(desc(StockTransfer.created_at)).all()
    result = []

    for transfer in transfers:
        destination = db.query(Branch).filter(
            Branch.id == transfer.destination_branch_id
        ).first()
        source = db.query(Warehouse).filter(
            Warehouse.id == transfer.from_warehouse_id
        ).first()

        items = []
        for ti in getattr(transfer, "items", []) or []:
            item = db.query(Item).filter(Item.id == ti.item_id).first()
            unit_symbol = None
            if item and getattr(item, "unit", None):
                unit_symbol = getattr(item.unit, "symbol", None)

            qty = ti.quantity or ti.requested_qty or 0
            unit_cost = ti.unit_cost or 0
            amount = unit_cost * qty

            items.append({
                "id": ti.id,
                "item_id": ti.item_id,
                "item_name": item.name if item else "Unknown Item",
                "item_code": item.code if item else None,
                "requested_qty": float(ti.requested_qty or 0),
                "quantity": float(qty),
                "unit": unit_symbol,
                "unit_cost": float(unit_cost),
                "amount": float(amount),
            })

        result.append({
            "id": transfer.id,
            "transfer_number": transfer.transfer_number,
            "status": (
                transfer.status.value
                if hasattr(transfer.status, "value")
                else str(transfer.status)
            ),
            "source_warehouse_id": transfer.from_warehouse_id,
            "source_warehouse_name": source.name if source else "Central Store",
            "destination_branch_id": transfer.destination_branch_id,
            "destination_branch_name": destination.name if destination else None,
            "source_branch_id": transfer.source_branch_id,
            "notes": transfer.notes,
            "created_at": transfer.created_at,
            "transfer_date": transfer.transfer_date,
            "items": items,
            "total_amount": sum(x["amount"] for x in items),
        })

    return result

# ==============================================================================
# Goods Receive Note (GRN) & 3-Way Match Endpoints
# ==============================================================================

def format_grn_response(grn: GoodsReceiveNote, db: Session) -> GoodsReceiveNoteResponse:
    branch = grn.branch or db.query(Branch).filter(Branch.id == grn.branch_id).first()
    warehouse = grn.warehouse or db.query(Warehouse).filter(Warehouse.id == grn.warehouse_id).first()
    supplier = grn.supplier or (db.query(Supplier).filter(Supplier.id == grn.supplier_id).first() if grn.supplier_id else None)
    po = grn.po or (db.query(PurchaseOrder).filter(PurchaseOrder.id == grn.po_id).first() if grn.po_id else None)
    user = grn.received_by or (db.query(User).filter(User.id == grn.received_by_id).first() if grn.received_by_id else None)
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None

    items_res = []
    for gi in grn.items:
        db_item = gi.item or db.query(Item).filter(Item.id == gi.item_id).first()
        unit_sym = db_item.unit.symbol if db_item and db_item.unit else "UNIT"
        items_res.append(
            GoodsReceiveItemResponse(
                id=gi.id,
                grn_id=gi.grn_id,
                po_item_id=gi.po_item_id,
                item_id=gi.item_id,
                item_name=db_item.name if db_item else "Unknown Item",
                item_code=db_item.code if db_item else "",
                unit_symbol=unit_sym,
                received_qty=gi.received_qty,
                accepted_qty=gi.accepted_qty,
                rejected_qty=gi.rejected_qty or Decimal("0.0000"),
                unit_price=gi.unit_price,
                total_price=gi.total_price,
                batch_number=gi.batch_number,
                expiry_date=gi.expiry_date,
                qc_status=gi.qc_status,
                qc_notes=gi.qc_notes,
            )
        )
    return GoodsReceiveNoteResponse(
        id=grn.id,
        company_id=grn.company_id,
        branch_id=grn.branch_id,
        branch_name=branch.name if branch else None,
        warehouse_id=grn.warehouse_id,
        warehouse_name=warehouse.name if warehouse else None,
        supplier_id=grn.supplier_id,
        supplier_name=supplier.name if supplier else None,
        po_id=grn.po_id,
        po_number=po.po_number if po else None,
        grn_number=grn.grn_number,
        receive_date=grn.receive_date,
        supplier_invoice_number=grn.invoice_number,
        invoice_amount=getattr(grn, "invoice_amount", None) or grn.total_amount,
        total_amount=grn.total_amount or Decimal("0.0000"),
        status=grn.status.value if hasattr(grn.status, "value") else str(grn.status),
        notes=grn.notes,
        received_by_id=grn.received_by_id,
        received_by_name=user_name,
        items=items_res,
        created_at=grn.created_at,
        updated_at=grn.updated_at,
    )


def _uses_outlet_stock_for_grn(branch: Branch) -> bool:
    """Return True only for real restaurant/outlet destinations.

    Outlet Sales/Consumption uses branch-level outlet stock. Central Store and
    production/warehouse locations keep using the existing warehouse stock
    workflow.
    """
    branch_type = str(getattr(branch, "type", "") or "").upper()
    return branch_type in {
        "RESTAURANT",
        "RESTAURANT_OUTLET",
        "HOTEL",
        "HYBRID",
        "OUTLET",
    }


def post_stock_for_grn(grn: GoodsReceiveNote, db: Session, current_user: User):
    """
    Idempotently post an approved GRN.

    Central Store / production locations continue to post to the existing
    warehouse StockBalance + StockLedger.

    Real outlet destinations post ONLY to OutletStockBalance,
    OutletStockBatch and OutletStockLedger. No Central Store or warehouse stock
    is read or deducted for outlet receiving.
    """
    if grn.status in ["APPROVED", "RECEIVED", "QC_PASSED"]:
        return

    branch = db.query(Branch).filter(
        Branch.id == grn.branch_id,
        Branch.company_id == grn.company_id,
    ).first()
    if not branch:
        raise NotFoundException(f"Destination branch '{grn.branch_id}' not found.")

    outlet_stock = _uses_outlet_stock_for_grn(branch)

    warehouse_id = grn.warehouse_id
    if not outlet_stock:
        if not warehouse_id:
            wh = db.query(Warehouse).filter(
                Warehouse.branch_id == grn.branch_id,
                Warehouse.is_active == True,  # noqa: E712
            ).first()
            if not wh:
                raise NotFoundException(
                    f"No active warehouse found for branch '{branch.name}'."
                )
            warehouse_id = wh.id
            grn.warehouse_id = warehouse_id

    po = None
    if grn.po_id:
        po = db.query(PurchaseOrder).filter(
            PurchaseOrder.id == grn.po_id,
            PurchaseOrder.company_id == grn.company_id,
        ).first()

    for itm in grn.items:
        accepted_qty = Decimal(str(itm.accepted_qty or 0))
        if accepted_qty <= Decimal("0.0000"):
            continue

        master_item = db.query(Item).filter(
            Item.id == itm.item_id,
            Item.company_id == grn.company_id,
            Item.is_active == True,  # noqa: E712
        ).with_for_update().first()
        if not master_item:
            raise NotFoundException(f"Item '{itm.item_id}' not found.")

        received_cost = Decimal(str(itm.unit_price or 0))

        if outlet_stock:
            # --------------------------------------------------------------
            # OUTLET DIRECT/VENDOR RECEIVING
            # --------------------------------------------------------------
            balance = db.query(OutletStockBalance).filter(
                OutletStockBalance.company_id == grn.company_id,
                OutletStockBalance.branch_id == grn.branch_id,
                OutletStockBalance.item_id == itm.item_id,
            ).with_for_update().first()

            if balance:
                balance.quantity = (
                    Decimal(str(balance.quantity or 0)) + accepted_qty
                ).quantize(Decimal("0.0001"))
                balance.updated_at = datetime.utcnow()
            else:
                balance = OutletStockBalance(
                    id=str(uuid.uuid4()),
                    company_id=grn.company_id,
                    branch_id=grn.branch_id,
                    item_id=itm.item_id,
                    quantity=accepted_qty,
                    min_stock_level=Decimal(str(master_item.min_stock_level or 0)),
                    reorder_qty=Decimal(str(master_item.reorder_qty or 0)),
                    updated_at=datetime.utcnow(),
                )
                db.add(balance)
                db.flush()

            batch_number = (
                (itm.batch_number or "").strip()
                or f"GRN-{grn.grn_number}-{str(itm.id)[-8:]}"
            )

            outlet_batch = db.query(OutletStockBatch).filter(
                OutletStockBatch.company_id == grn.company_id,
                OutletStockBatch.branch_id == grn.branch_id,
                OutletStockBatch.item_id == itm.item_id,
                OutletStockBatch.batch_number == batch_number,
            ).with_for_update().first()

            if outlet_batch:
                outlet_batch.quantity = (
                    Decimal(str(outlet_batch.quantity or 0)) + accepted_qty
                ).quantize(Decimal("0.0001"))
                outlet_batch.unit_cost = received_cost
                outlet_batch.expiry_date = (
                    itm.expiry_date.date()
                    if hasattr(itm.expiry_date, "date")
                    else itm.expiry_date
                )
                outlet_batch.is_active = outlet_batch.quantity > 0
            else:
                outlet_batch = OutletStockBatch(
                    id=str(uuid.uuid4()),
                    company_id=grn.company_id,
                    branch_id=grn.branch_id,
                    item_id=itm.item_id,
                    batch_number=batch_number,
                    quantity=accepted_qty,
                    unit_cost=received_cost,
                    expiry_date=(
                        itm.expiry_date.date()
                        if hasattr(itm.expiry_date, "date")
                        else itm.expiry_date
                    ),
                    mfg_date=None,
                    is_active=True,
                )
                db.add(outlet_batch)

            db.add(
                OutletStockLedger(
                    id=str(uuid.uuid4()),
                    company_id=grn.company_id,
                    branch_id=grn.branch_id,
                    item_id=itm.item_id,
                    unit_id=master_item.unit_id,
                    batch_number=batch_number,
                    expiry_date=(
                        itm.expiry_date.date()
                        if hasattr(itm.expiry_date, "date")
                        else itm.expiry_date
                    ),
                    movement_type="GRN",
                    change_qty=accepted_qty,
                    balance_qty=balance.quantity,
                    unit_cost=received_cost,
                    total_cost=Decimal(str(itm.total_price or (accepted_qty * received_cost))),
                    reference_type="GRN",
                    reference_id=grn.id,
                    notes=f"Outlet receipt via GRN {grn.grn_number}",
                    created_by_id=current_user.id,
                    created_at=datetime.utcnow(),
                )
            )

        else:
            # --------------------------------------------------------------
            # EXISTING WAREHOUSE RECEIVING — PRESERVED
            # --------------------------------------------------------------
            old_qty = db.query(func.sum(StockBalance.quantity)).filter(
                StockBalance.item_id == itm.item_id
            ).scalar() or Decimal("0.0000")
            old_cost = Decimal(str(master_item.cost_price or 0))
            if old_qty <= 0:
                master_item.cost_price = received_cost
            else:
                total_val = (old_qty * old_cost) + (accepted_qty * received_cost)
                new_qty = old_qty + accepted_qty
                if new_qty > 0:
                    master_item.cost_price = (
                        total_val / new_qty
                    ).quantize(Decimal("0.0001"))

            sb = db.query(StockBalance).filter(
                StockBalance.warehouse_id == warehouse_id,
                StockBalance.item_id == itm.item_id,
            ).with_for_update().first()

            if sb:
                sb.quantity = (
                    Decimal(str(sb.quantity or 0)) + accepted_qty
                ).quantize(Decimal("0.0001"))
                sb.updated_at = datetime.utcnow()
            else:
                sb = StockBalance(
                    warehouse_id=warehouse_id,
                    item_id=itm.item_id,
                    quantity=accepted_qty,
                    min_stock_level=Decimal("0.0000"),
                    reorder_qty=Decimal("0.0000"),
                    updated_at=datetime.utcnow(),
                )
                db.add(sb)
                db.flush()

            db.add(
                StockLedger(
                    warehouse_id=warehouse_id,
                    item_id=itm.item_id,
                    batch_number=itm.batch_number,
                    expiry_date=itm.expiry_date,
                    movement_type="GRN",
                    change_qty=accepted_qty,
                    balance_qty=sb.quantity,
                    unit_cost=received_cost,
                    total_cost=Decimal(str(itm.total_price or (accepted_qty * received_cost))),
                    reference_type="GRN",
                    reference_id=grn.id,
                    notes=f"Receipt via GRN {grn.grn_number}",
                    created_by_id=current_user.id,
                    created_at=datetime.utcnow(),
                )
            )

        # PO received quantity is common to both stock destinations.
        if itm.po_item_id:
            po_query = db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.id == itm.po_item_id,
            )
            if po:
                po_query = po_query.filter(PurchaseOrderItem.po_id == po.id)
            po_itm = po_query.first()
            if po_itm:
                po_itm.received_qty = (
                    Decimal(str(po_itm.received_qty or 0)) + accepted_qty
                ).quantize(Decimal("0.0001"))
        elif po:
            po_itm = db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.po_id == po.id,
                PurchaseOrderItem.item_id == itm.item_id,
            ).first()
            if po_itm:
                po_itm.received_qty = (
                    Decimal(str(po_itm.received_qty or 0)) + accepted_qty
                ).quantize(Decimal("0.0001"))

    if po:
        db.flush()
        po_items = db.query(PurchaseOrderItem).filter(
            PurchaseOrderItem.po_id == po.id
        ).all()
        total_ord = sum(
            (Decimal(str(pi.ordered_qty or 0)) for pi in po_items),
            Decimal("0.0000"),
        )
        total_rec = sum(
            (Decimal(str(pi.received_qty or 0)) for pi in po_items),
            Decimal("0.0000"),
        )
        if total_rec >= total_ord:
            po.status = POStatus.RECEIVED
        elif total_rec > Decimal("0.0000"):
            po.status = POStatus.PARTIALLY_RECEIVED
        po.updated_at = datetime.utcnow()

    grn.status = "APPROVED"
    grn.updated_at = datetime.utcnow()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="APPROVE_GRN_POST_STOCK",
        entity_type="GoodsReceiveNote",
        entity_id=grn.id,
        company_id=grn.company_id,
        branch_id=grn.branch_id,
        new_values={
            "grn_number": grn.grn_number,
            "status": "APPROVED",
            "stock_destination": "OUTLET" if outlet_stock else "WAREHOUSE",
            "total_amount": float(grn.total_amount or 0),
        },
    )


@router.post("/grn", response_model=GoodsReceiveNoteResponse, status_code=status.HTTP_201_CREATED)
@router.post("/receiving", response_model=GoodsReceiveNoteResponse, status_code=status.HTTP_201_CREATED)
def create_goods_receive_note(
    payload: GoodsReceiveNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Records physical Goods Receipt at destination (Outlet, Central Store, Dessert Kitchen).
    If auto_approve is True or not specified and status is not PENDING_APPROVAL,
    posts stock balance and stock ledger directly at destination warehouse.
    """
    check_user_outlet_access(current_user, payload.branch_id, db)

    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{payload.branch_id}' not found.")

    warehouse_id = payload.warehouse_id
    if not warehouse_id:
        wh = db.query(Warehouse).filter(Warehouse.branch_id == payload.branch_id, Warehouse.is_active == True).first()
        if not wh:
            raise NotFoundException(f"No active warehouse found for branch '{branch.name}'.")
        warehouse_id = wh.id
    else:
        wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not wh:
            raise NotFoundException(f"Warehouse '{warehouse_id}' not found.")

    po = None
    supplier_id = payload.supplier_id
    if payload.po_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == payload.po_id).first()
        if not po:
            raise NotFoundException(f"Purchase Order '{payload.po_id}' not found.")
        if not supplier_id:
            supplier_id = po.supplier_id
        if po.branch_id and po.branch_id != payload.branch_id:
            raise BadRequestException("The destination branch must match the Purchase Order destination.")
        if po.branch_id and wh.branch_id != po.branch_id:
            raise BadRequestException("The receiving warehouse must match the Purchase Order destination.")

    company_id = branch.company_id or current_user.company_id
    grn_num = f"GRN-{datetime.utcnow().strftime('%Y%m%d%H%M')}-{abs(hash(str(payload.branch_id) + str(datetime.utcnow()))) % 10000:04d}"

    total_grn_amount = Decimal("0.0000")
    items_to_create = []

    for item_in in payload.items:
        db_item = db.query(Item).filter(Item.id == item_in.item_id).first()
        if not db_item:
            raise NotFoundException(f"Item '{item_in.item_id}' not found.")

        item_total = item_in.accepted_qty * item_in.unit_price
        total_grn_amount += item_total

        items_to_create.append({
            "item_id": item_in.item_id,
            "po_item_id": item_in.po_item_id,
            "received_qty": item_in.received_qty,
            "accepted_qty": item_in.accepted_qty,
            "rejected_qty": item_in.rejected_qty or Decimal("0.0000"),
            "unit_price": item_in.unit_price,
            "total_price": item_total,
            "batch_number": item_in.batch_number,
            "expiry_date": item_in.expiry_date,
            "qc_status": item_in.qc_status or "PASSED",
            "qc_notes": item_in.qc_notes,
        })

    is_pending = (payload.auto_approve is False) or (payload.status == "PENDING_APPROVAL")
    
    # Enforce approval for Central Store receiving to prevent self-approval bypass
    if branch and (branch.type or "").upper() == "CENTRAL_STORE":
        is_pending = True
        
    init_status = "PENDING_APPROVAL" if is_pending else "RECEIVED"

    grn = GoodsReceiveNote(
        company_id=company_id,
        branch_id=payload.branch_id,
        warehouse_id=warehouse_id,
        supplier_id=supplier_id,
        po_id=payload.po_id,
        grn_number=grn_num,
        receive_date=payload.receive_date or datetime.utcnow(),
        invoice_number=payload.supplier_invoice_number,
        total_amount=payload.invoice_amount if payload.invoice_amount is not None else total_grn_amount,
        status=init_status,
        notes=payload.notes,
        received_by_id=current_user.id,
    )
    db.add(grn)
    db.flush()

    for itm in items_to_create:
        grn_item = GoodsReceiveItem(
            grn_id=grn.id,
            po_item_id=itm["po_item_id"],
            item_id=itm["item_id"],
            received_qty=itm["received_qty"],
            accepted_qty=itm["accepted_qty"],
            rejected_qty=itm["rejected_qty"],
            unit_price=itm["unit_price"],
            total_price=itm["total_price"],
            batch_number=itm["batch_number"],
            expiry_date=itm["expiry_date"],
            qc_status=itm["qc_status"],
            qc_notes=itm["qc_notes"],
        )
        db.add(grn_item)

    if not is_pending:
        # Ensure newly-added GRN item rows are flushed before the shared
        # stock-posting function reads grn.items.
        db.flush()
        post_stock_for_grn(grn, db, current_user)

    db.commit()
    db.refresh(grn)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="CREATE_GRN",
        entity_type="GoodsReceiveNote",
        entity_id=grn.id,
        company_id=company_id,
        branch_id=payload.branch_id,
        new_values={"grn_number": grn.grn_number, "total_amount": float(total_grn_amount), "items_count": len(items_to_create), "status": grn.status}
    )
    db.commit()
    return format_grn_response(grn, db)


@router.post("/grn/from-po", response_model=GoodsReceiveNoteResponse, status_code=status.HTTP_201_CREATED)
@router.post("/receiving/from-po", response_model=GoodsReceiveNoteResponse, status_code=status.HTTP_201_CREATED)
def create_goods_receive_from_po(
    payload: GoodsReceiveFromPOCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a PO-based Goods Receive Note (GRN) directly from an approved PO.
    Line items and approved quantities are automatically loaded from PO items.
    Users cannot manually enter or alter item quantities.
    Flags invoice amount variance and queues GRN for Central/HO Approval.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == payload.po_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{payload.po_id}' not found.")

    if payload.branch_id and po.branch_id and payload.branch_id != po.branch_id:
        raise BadRequestException("The destination branch must match the Purchase Order destination.")
    branch_id = po.branch_id or payload.branch_id
    if not branch_id:
        branch_id = (current_user.branches[0].branch_id if getattr(current_user, 'branches', None) else None)
        if not branch_id:
            first_br = db.query(Branch).filter(Branch.is_active == True).first()
            branch_id = first_br.id if first_br else None

    if not branch_id:
        raise BadRequestException("A valid destination branch is required for receiving.")

    check_user_outlet_access(current_user, branch_id, db)
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{branch_id}' not found.")

    warehouse_id = payload.warehouse_id
    if not warehouse_id:
        wh = db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True).first()
        if not wh:
            raise NotFoundException(f"No active warehouse found for destination branch '{branch.name}'.")
        warehouse_id = wh.id
    else:
        wh = db.query(Warehouse).filter(
            Warehouse.id == warehouse_id,
            Warehouse.branch_id == branch_id,
            Warehouse.is_active == True,  # noqa: E712
        ).first()
        if not wh:
            raise BadRequestException("The receiving warehouse must be an active warehouse of the Purchase Order destination.")

    company_id = branch.company_id or current_user.company_id
    grn_num = f"GRN-{datetime.utcnow().strftime('%Y%m%d%H%M')}-{abs(hash(str(branch_id) + str(datetime.utcnow()))) % 10000:04d}"

    # Load PO items
    po_items = db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == po.id).all()
    if not po_items:
        raise BadRequestException("The linked purchase order has no items to receive.")

    total_po_amount = Decimal("0.0000")
    items_to_create = []
    po_items_by_id = {pi.id: pi for pi in po_items}
    requested_receipts = payload.items
    if requested_receipts:
        requested_ids = [line.po_item_id for line in requested_receipts]
        if len(requested_ids) != len(set(requested_ids)):
            raise BadRequestException("A PO line can only appear once in a Goods Receive Note.")
        receipt_lines = []
        for line in requested_receipts:
            pi = po_items_by_id.get(line.po_item_id)
            if not pi:
                raise BadRequestException("Every receiving line must belong to the linked Purchase Order.")
            if line.accepted_qty > line.received_qty:
                raise BadRequestException("Accepted quantity cannot exceed physically received quantity.")
            outstanding_qty = pi.ordered_qty - (pi.received_qty or Decimal("0.0000"))
            if line.accepted_qty > outstanding_qty:
                raise BadRequestException("Accepted quantity cannot exceed the outstanding Purchase Order quantity.")
            receipt_lines.append((pi, line, outstanding_qty))
    else:
        receipt_lines = []
        for pi in po_items:
            outstanding_qty = pi.ordered_qty - (pi.received_qty or Decimal("0.0000"))
            if outstanding_qty > Decimal("0.0000"):
                receipt_lines.append((pi, None, outstanding_qty))

    if not receipt_lines:
        raise BadRequestException("The linked purchase order has no outstanding quantities to receive.")

    for pi, receipt_line, outstanding_qty in receipt_lines:
        received_qty = receipt_line.received_qty if receipt_line else outstanding_qty
        accepted_qty = receipt_line.accepted_qty if receipt_line else outstanding_qty
        item_tot = accepted_qty * pi.unit_price
        total_po_amount += item_tot

        items_to_create.append({
            "item_id": pi.item_id,
            "po_item_id": pi.id,
            "received_qty": received_qty,
            "accepted_qty": accepted_qty,
            "rejected_qty": receipt_line.rejected_qty if receipt_line else Decimal("0.0000"),
            "unit_price": pi.unit_price,
            "total_price": item_tot,
            "batch_number": receipt_line.batch_number if receipt_line else None,
            "expiry_date": receipt_line.expiry_date if receipt_line else None,
            "qc_status": receipt_line.qc_status if receipt_line else "PASSED",
            "qc_notes": receipt_line.qc_notes if receipt_line else "PO-derived quantity locked",
        })

    # Variance detection
    entered_invoice_amt = payload.invoice_amount if payload.invoice_amount is not None else total_po_amount
    variance_note = ""
    if abs(entered_invoice_amt - total_po_amount) > Decimal("0.01"):
        diff = entered_invoice_amt - total_po_amount
        pct = (diff / total_po_amount * 100) if total_po_amount > 0 else Decimal("0.00")
        sign = "+" if diff > 0 else ""
        variance_note = f" [INVOICE VARIANCE FLAGGED: PO Total ${total_po_amount:.2f} vs Invoice ${entered_invoice_amt:.2f} ({sign}${diff:.2f} / {sign}{pct:.2f}%)]"

    combined_notes = (payload.notes or "") + variance_note
    if payload.invoice_file_name:
        combined_notes += f" [Invoice File: {payload.invoice_file_name}]"

    grn = GoodsReceiveNote(
        company_id=company_id,
        branch_id=branch_id,
        warehouse_id=warehouse_id,
        supplier_id=po.supplier_id,
        po_id=po.id,
        grn_number=grn_num,
        receive_date=datetime.utcnow(),
        invoice_number=payload.supplier_invoice_number,
        total_amount=entered_invoice_amt,
        status="PENDING_APPROVAL",
        notes=combined_notes.strip() or None,
        received_by_id=current_user.id,
    )
    db.add(grn)
    db.flush()

    for itm in items_to_create:
        grn_item = GoodsReceiveItem(
            grn_id=grn.id,
            po_item_id=itm["po_item_id"],
            item_id=itm["item_id"],
            received_qty=itm["received_qty"],
            accepted_qty=itm["accepted_qty"],
            rejected_qty=itm["rejected_qty"],
            unit_price=itm["unit_price"],
            total_price=itm["total_price"],
            batch_number=itm["batch_number"],
            expiry_date=itm["expiry_date"],
            qc_status=itm["qc_status"],
            qc_notes=itm["qc_notes"],
        )
        db.add(grn_item)

    db.commit()
    db.refresh(grn)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="SUBMIT_PO_RECEIVING",
        entity_type="GoodsReceiveNote",
        entity_id=grn.id,
        company_id=company_id,
        branch_id=branch_id,
        new_values={
            "po_number": po.po_number,
            "grn_number": grn.grn_number,
            "invoice_number": payload.supplier_invoice_number,
            "invoice_amount": float(entered_invoice_amt),
            "status": "PENDING_APPROVAL",
        }
    )
    db.commit()
    return format_grn_response(grn, db)


@router.post("/grn/{grn_id}/approve", response_model=GoodsReceiveNoteResponse)
@router.post("/receiving/{grn_id}/approve", response_model=GoodsReceiveNoteResponse)
def approve_goods_receive_note(
    grn_id: str = Path(...),
    payload: Optional[GoodsReceiveNoteApproveRequest] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    HO/Central Approval for a submitted GRN.
    Posts the PO items and received quantities to destination StockBalance and StockLedger.
    Updates linked PO status and marks GRN as APPROVED.
    Prevents duplicate stock posting.
    """
    grn = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.id == grn_id).first()
    if not grn:
        raise NotFoundException(f"Goods Receive Note '{grn_id}' not found.")

    check_user_outlet_access(current_user, grn.branch_id, db)

    if grn.status in ["APPROVED", "RECEIVED", "QC_PASSED"]:
        raise BadRequestException("Stock has already been posted for this Goods Receive Note.")

    if grn.received_by_id == current_user.id:
        raise ForbiddenException("A Goods Receive Note creator cannot approve their own receiving.")

    post_stock_for_grn(grn, db, current_user)
    
    grn.approved_by_id = current_user.id
    grn.approved_at = datetime.utcnow()
    
    if payload and payload.notes:
        grn.notes = (grn.notes or "") + f" [Approval Notes: {payload.notes}]"

    db.commit()
    db.refresh(grn)
    return format_grn_response(grn, db)


@router.post("/grn/{grn_id}/reject", response_model=GoodsReceiveNoteResponse)
@router.post("/receiving/{grn_id}/reject", response_model=GoodsReceiveNoteResponse)
def reject_goods_receive_note(
    grn_id: str = Path(...),
    payload: GoodsReceiveNoteRejectRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Rejects a submitted GRN. No stock is posted.
    """
    grn = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.id == grn_id).first()
    if not grn:
        raise NotFoundException(f"Goods Receive Note '{grn_id}' not found.")

    check_user_outlet_access(current_user, grn.branch_id, db)

    if grn.status in ["APPROVED", "RECEIVED"]:
        raise BadRequestException("Cannot reject a GRN that has already been approved and posted to stock.")

    grn.status = "REJECTED"
    grn.notes = (grn.notes or "") + f" [REJECTION REASON: {payload.reason}]"
    grn.updated_at = datetime.utcnow()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="REJECT_GRN",
        entity_type="GoodsReceiveNote",
        entity_id=grn.id,
        company_id=grn.company_id,
        branch_id=grn.branch_id,
        new_values={"grn_number": grn.grn_number, "reason": payload.reason}
    )
    db.commit()
    db.refresh(grn)
    return format_grn_response(grn, db)


@router.post("/grn/upload-invoice", response_model=SupplierInvoiceUploadResponse)
@router.post("/invoices/upload", response_model=SupplierInvoiceUploadResponse)
@router.post("/receiving/upload-invoice", response_model=SupplierInvoiceUploadResponse)
def upload_supplier_invoice(
    payload: SupplierInvoiceUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Validates and stores supplier invoice attachment (PDF or JPEG/PNG image).
    Validates magic byte signatures and returns storage reference.
    """
    allowed_types = ["application/pdf", "image/jpeg", "image/jpg", "image/png"]
    if payload.file_type not in allowed_types:
        raise BadRequestException(f"Unsupported file type '{payload.file_type}'. Supported: PDF, JPEG, PNG.")

    try:
        raw_bytes = base64.b64decode(payload.file_base64)
    except Exception:
        raise BadRequestException("Invalid base64 encoding for invoice file.")

    if len(raw_bytes) < 4:
        raise BadRequestException("Corrupted or empty file data.")

    if payload.file_type == "application/pdf":
        if not raw_bytes.startswith(b"%PDF-"):
            raise BadRequestException("Invalid PDF document signature.")
    elif payload.file_type in ["image/jpeg", "image/jpg"]:
        if not (raw_bytes.startswith(b"\xff\xd8\xff") or raw_bytes.startswith(b"\xff\xd8")):
            raise BadRequestException("Invalid JPEG image signature.")
    elif payload.file_type == "image/png":
        if not raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            raise BadRequestException("Invalid PNG image signature.")

    upload_dir = os.path.join(os.getcwd(), "uploads", "invoices")
    os.makedirs(upload_dir, exist_ok=True)

    ext = ".pdf" if "pdf" in payload.file_type else (".png" if "png" in payload.file_type else ".jpg")
    safe_name = f"{uuid.uuid4().hex[:12]}_{payload.file_name.replace(' ', '_')}"
    if not safe_name.endswith(ext):
        safe_name += ext

    file_path = os.path.join(upload_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(raw_bytes)

    storage_ref = f"uploads/invoices/{safe_name}"

    log_procurement_audit(
        db=db,
        user=current_user,
        action="UPLOAD_SUPPLIER_INVOICE",
        entity_type="SupplierInvoice",
        entity_id=payload.invoice_number,
        company_id=current_user.company_id,
        branch_id=payload.branch_id or (current_user.branches[0].branch_id if getattr(current_user, 'branches', None) else None),
        new_values={
            "invoice_number": payload.invoice_number,
            "invoice_amount": float(payload.invoice_amount),
            "file_name": payload.file_name,
            "storage_ref": storage_ref,
        }
    )
    db.commit()

    return SupplierInvoiceUploadResponse(
        id=str(uuid.uuid4()),
        file_name=payload.file_name,
        file_type=payload.file_type,
        storage_ref=storage_ref,
        invoice_number=payload.invoice_number,
        invoice_amount=payload.invoice_amount,
        created_at=datetime.utcnow(),
    )


@router.get("/grn", response_model=List[GoodsReceiveNoteResponse])
@router.get("/receiving", response_model=List[GoodsReceiveNoteResponse])
def list_goods_receive_notes(
    branch_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    po_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List Goods Receive Notes with optional branch, supplier, and PO filters."""
    query = db.query(GoodsReceiveNote)
    if current_user.company_id:
        query = query.filter(GoodsReceiveNote.company_id == current_user.company_id)
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(GoodsReceiveNote.branch_id == branch_id)
    if supplier_id:
        query = query.filter(GoodsReceiveNote.supplier_id == supplier_id)
    if po_id:
        query = query.filter(GoodsReceiveNote.po_id == po_id)
    if status_filter:
        query = query.filter(GoodsReceiveNote.status == status_filter)

    grns = query.order_by(desc(GoodsReceiveNote.created_at)).all()
    return [format_grn_response(g, db) for g in grns]


@router.get("/grn/{grn_id}", response_model=GoodsReceiveNoteResponse)
@router.get("/receiving/{grn_id}", response_model=GoodsReceiveNoteResponse)
def get_goods_receive_note(
    grn_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve details of a Goods Receive Note."""
    grn = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.id == grn_id).first()
    if not grn:
        raise NotFoundException(f"Goods Receive Note '{grn_id}' not found.")
    check_user_outlet_access(current_user, grn.branch_id, db)
    return format_grn_response(grn, db)


@router.get("/orders/{order_id}/3way-match", response_model=ThreeWayMatchResponse)
def get_order_3way_match(
    order_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    3-WAY MATCH ENGINE:
    Compares Purchase Order vs Goods Receive Notes vs Supplier Invoices.
    Calculates quantity, rate, and amount variances.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not po:
        raise NotFoundException(f"Purchase Order '{order_id}' not found.")

    branch_name = po.branch.name if po.branch else ("Multi-Outlet Consolidated" if po.allocations else "Central Store")
    # Pending/rejected receipts are not evidence of a confirmed delivery.
    grns = db.query(GoodsReceiveNote).filter(
        GoodsReceiveNote.po_id == order_id,
        GoodsReceiveNote.status == GRNStatus.APPROVED.value,
    ).all()

    grn_responses = [format_grn_response(g, db) for g in grns]

    # Aggregate received items
    received_map = {}
    for g in grns:
        for gi in g.items:
            if gi.item_id not in received_map:
                received_map[gi.item_id] = {
                    "received_qty": Decimal("0.0000"),
                    "accepted_qty": Decimal("0.0000"),
                    "rejected_qty": Decimal("0.0000"),
                    "total_actual_amount": Decimal("0.0000"),
                    "unit_prices": [],
                }
            received_map[gi.item_id]["received_qty"] += gi.received_qty
            received_map[gi.item_id]["accepted_qty"] += gi.accepted_qty
            received_map[gi.item_id]["rejected_qty"] += (gi.rejected_qty or Decimal("0.0000"))
            received_map[gi.item_id]["total_actual_amount"] += gi.total_price
            received_map[gi.item_id]["unit_prices"].append(gi.unit_price)

    lines = []
    has_variance = False
    total_ordered_amount = po.total_amount
    total_received_amount = Decimal("0.0000")

    for poi in po.items:
        db_item = poi.item or db.query(Item).filter(Item.id == poi.item_id).first()
        unit_sym = db_item.unit.symbol if db_item and db_item.unit else "UNIT"
        item_name = db_item.name if db_item else "Unknown Item"
        item_code = db_item.code if db_item else ""

        rec = received_map.get(poi.item_id, {
            "received_qty": Decimal("0.0000"),
            "accepted_qty": Decimal("0.0000"),
            "rejected_qty": Decimal("0.0000"),
            "total_actual_amount": Decimal("0.0000"),
            "unit_prices": [poi.unit_price],
        })

        avg_actual_rate = rec["unit_prices"][0] if rec["unit_prices"] else poi.unit_price
        if rec["accepted_qty"] > 0:
            avg_actual_rate = rec["total_actual_amount"] / rec["accepted_qty"]

        qty_var = rec["accepted_qty"] - poi.ordered_qty
        rate_var = avg_actual_rate - poi.unit_price
        amt_var = rec["total_actual_amount"] - poi.total_price

        total_received_amount += rec["total_actual_amount"]

        line_status = "MATCHED"
        if rec["accepted_qty"] == 0:
            line_status = "PENDING_DELIVERY"
            has_variance = True
        elif qty_var < 0:
            line_status = "SHORT_DELIVERY"
            has_variance = True
        elif qty_var > 0:
            line_status = "EXCESS_DELIVERY"
            has_variance = True
        elif rate_var != Decimal("0.0000"):
            line_status = "PRICE_VARIANCE"
            has_variance = True

        lines.append(
            ThreeWayMatchLine(
                item_id=poi.item_id,
                item_name=item_name,
                item_code=item_code,
                unit_symbol=unit_sym,
                po_qty=poi.ordered_qty,
                po_rate=poi.unit_price,
                po_total=poi.total_price,
                grn_qty=rec["received_qty"],
                accepted_qty=rec["accepted_qty"],
                rejected_qty=rec["rejected_qty"],
                actual_rate=avg_actual_rate,
                actual_total=rec["total_actual_amount"],
                qty_variance=qty_var,
                rate_variance=rate_var,
                amount_variance=amt_var,
                status=line_status,
            )
        )

    total_invoice_amt = sum([g.total_amount or Decimal("0.0000") for g in grns])

    overall_status = "PERFECT_MATCH"
    if not grns:
        overall_status = "PENDING_GRN"
    elif has_variance or abs(total_invoice_amt - total_ordered_amount) > Decimal("0.01"):
        overall_status = "VARIANCE_DETECTED"

    return ThreeWayMatchResponse(
        po_id=po.id,
        po_number=po.po_number,
        po_status=po.status.value,
        po_total=po.net_amount or po.total_amount,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else "Unknown Supplier",
        branch_name=branch_name,
        grn_count=len(grns),
        grns=grn_responses,
        lines=lines,
        total_ordered_amount=total_ordered_amount,
        total_received_amount=total_received_amount,
        total_invoice_amount=total_invoice_amt,
        overall_status=overall_status,
    )



# ==============================================================================
# ADVANCED CENTRAL STORE RECEIVING — BILL OCR + PO AUTO MATCH
# ==============================================================================

_OCR_NUMBER_RE = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?(?![\w.])")


def _normalise_ocr_text(value: str) -> str:
    value = value.replace("₹", " ").replace("—", "-").replace("–", "-")
    value = re.sub(r"[\t ]+", " ", value)
    return value.strip()


def _ocr_image_bytes(raw_bytes: bytes) -> str:
    if pytesseract is None or Image is None:
        raise BadRequestException("Invoice OCR packages are not installed. Install pytesseract, Pillow, pypdf and pdf2image.")
    try:
        image = Image.open(BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image) if ImageOps else image
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")
        width, height = image.size
        if width < 1600:
            scale = 1600 / max(width, 1)
            image = image.resize((int(width * scale), int(height * scale)))
        gray = ImageOps.grayscale(image) if ImageOps else image
        return pytesseract.image_to_string(gray, config="--oem 3 --psm 6")
    except Exception as exc:
        raise BadRequestException(f"Could not read invoice image: {exc}")


def _ocr_pdf_bytes(raw_bytes: bytes) -> str:
    text_parts: List[str] = []
    if PdfReader is not None:
        try:
            reader = PdfReader(BytesIO(raw_bytes))
            for page in reader.pages:
                text_parts.append(page.extract_text() or "")
        except Exception:
            pass
    text = "\n".join(text_parts).strip()
    if text:
        return text
    if pytesseract is None or convert_from_bytes is None:
        raise BadRequestException("This scanned PDF needs OCR. Install pytesseract, Pillow, pypdf and pdf2image.")
    try:
        pages = convert_from_bytes(raw_bytes, dpi=180, fmt="jpeg", first_page=1, last_page=5)
        results = []
        for page in pages:
            gray = ImageOps.grayscale(page) if ImageOps else page
            results.append(pytesseract.image_to_string(gray, config="--oem 3 --psm 6"))
        return "\n".join(results).strip()
    except Exception as exc:
        raise BadRequestException(f"Could not OCR PDF invoice: {exc}")


def _parse_invoice_header(text: str) -> Dict[str, Any]:
    compact = _normalise_ocr_text(text)
    invoice_number = None
    date_value = None
    amount = None

    m = re.search(r"(?:invoice|bill|tax\s*invoice|inv)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9./_-]{2,})", compact, re.I)
    if m:
        invoice_number = m.group(1).strip(".-")
    dm = re.search(r"(?:invoice|bill)?\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})", compact, re.I)
    if dm:
        date_value = dm.group(1)
    am = re.search(r"(?:grand\s*total|net\s*payable|total\s*amount|amount\s*payable|invoice\s*total)\D{0,12}(\d+(?:,\d{2,3})*(?:\.\d{1,2})?)", compact, re.I)
    if am:
        amount = float(am.group(1).replace(",", ""))
    return {"invoice_number": invoice_number, "invoice_date": date_value, "invoice_amount": amount}


def _token_set(text: str) -> set[str]:
    return {x for x in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(x) >= 2}


def _extract_line_numbers(line_text: str) -> List[float]:
    values = []
    for raw in _OCR_NUMBER_RE.findall(line_text):
        try:
            values.append(float(raw.replace(",", "")))
        except Exception:
            pass
    return values


def _match_po_lines_to_ocr(po: PurchaseOrder, text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    lines = [_normalise_ocr_text(x) for x in text.splitlines() if _normalise_ocr_text(x)]
    parsed_lines: List[Dict[str, Any]] = []
    warnings: List[str] = []
    for po_item in (po.items or []):
        item = po_item.item
        code = str(getattr(item, "code", "") or "").strip().lower()
        name = str(getattr(item, "name", "") or "").strip()
        wanted_tokens = _token_set(name)
        best = None
        best_score = 0.0
        for raw in lines:
            low = raw.lower()
            if any(word in low for word in ("grand total", "net payable", "invoice total", "tax total", "discount total")):
                continue
            numbers = _extract_line_numbers(raw)
            if not numbers:
                continue
            score = 0.0
            if code and code in low:
                score += 1.0
            tokens = _token_set(raw)
            if wanted_tokens:
                overlap = len(wanted_tokens & tokens) / max(len(wanted_tokens), 1)
                score += min(overlap, 1.0) * 0.9
            if score > best_score:
                best_score = score
                best = (raw, numbers)
        if not best or best_score < 0.45:
            continue
        raw, nums = best
        ordered = Decimal(str(getattr(po_item, "quantity", 0) or 0))
        if len(nums) >= 3:
            qty = Decimal(str(nums[-3])); rate = Decimal(str(nums[-2])); line_total = Decimal(str(nums[-1]))
        elif len(nums) == 2:
            qty = Decimal(str(nums[-2])); rate = Decimal(str(nums[-1])); line_total = qty * rate
        else:
            qty = Decimal(str(nums[-1])); rate = Decimal(str(getattr(po_item, "unit_price", 0) or 0)); line_total = qty * rate
        if qty <= 0:
            continue
        parsed_lines.append({
            "po_item_id": str(po_item.id),
            "item_id": str(po_item.item_id),
            "item_name": name,
            "item_code": code or None,
            "ordered_qty": float(ordered),
            "received_qty": float(qty),
            "accepted_qty": float(qty),
            "rejected_qty": 0.0,
            "invoice_rate": float(rate),
            "invoice_line_total": float(line_total),
            "match_confidence": round(min(1.0, best_score), 3),
            "ocr_line": raw,
        })
    if not parsed_lines:
        warnings.append("No PO item row could be confidently matched from the invoice. Scan a clear, full bill image/PDF.")
    seen = set(); unique = []
    for row in parsed_lines:
        if row["po_item_id"] not in seen:
            seen.add(row["po_item_id"]); unique.append(row)
    return unique, warnings


def _scan_invoice_file(storage_ref: str) -> Dict[str, Any]:
    safe_rel = str(storage_ref or "").replace("\\", "/").lstrip("/")
    if not safe_rel.startswith("uploads/invoices/") or ".." in safe_rel:
        raise BadRequestException("Invalid invoice storage reference.")
    file_path = os.path.join(os.getcwd(), safe_rel)
    if not os.path.isfile(file_path):
        raise NotFoundException("Invoice file was not found on the server.")
    with open(file_path, "rb") as f:
        raw = f.read()
    if file_path.lower().endswith(".pdf"):
        text = _ocr_pdf_bytes(raw)
    else:
        text = _ocr_image_bytes(raw)
    return {"text": text}


def _build_ocr_match_summary(po: PurchaseOrder, ocr: Dict[str, Any]) -> Dict[str, Any]:
    header = _parse_invoice_header(ocr["text"])
    matched_items, warnings = _match_po_lines_to_ocr(po, ocr["text"])
    outstanding_map = {
        str(x.id): max(Decimal("0"), Decimal(str(getattr(x, "quantity", 0) or 0)) - Decimal(str(getattr(x, "received_qty", 0) or 0)))
        for x in (po.items or [])
    }
    mismatches = []; lines_total = Decimal("0")
    for row in matched_items:
        received = Decimal(str(row["received_qty"])); outstanding = outstanding_map.get(row["po_item_id"], Decimal("0"))
        lines_total += Decimal(str(row["invoice_line_total"]))
        if received > outstanding + Decimal("0.0001"):
            mismatches.append({"type":"QUANTITY_OVER_PO","item_name":row["item_name"],"remaining_qty":float(outstanding),"invoice_qty":float(received)})
        po_item = next((x for x in (po.items or []) if str(x.id) == row["po_item_id"]), None)
        po_rate = Decimal(str(getattr(po_item, "unit_price", 0) or 0)) if po_item else Decimal("0")
        inv_rate = Decimal(str(row["invoice_rate"]))
        if po_rate > 0 and abs(po_rate - inv_rate) > max(Decimal("0.01"), po_rate * Decimal("0.05")):
            mismatches.append({"type":"RATE_VARIANCE","item_name":row["item_name"],"po_rate":float(po_rate),"invoice_rate":float(inv_rate)})
    if header.get("invoice_amount") is not None and lines_total > 0 and abs(Decimal(str(header["invoice_amount"])) - lines_total) > Decimal("2"):
        mismatches.append({"type":"INVOICE_TOTAL_VARIANCE","invoice_total":header["invoice_amount"],"ocr_lines_total":float(lines_total)})
    if not header.get("invoice_number"):
        warnings.append("Invoice/Bill number could not be read automatically.")
    return {**header,"items":matched_items,"mismatches":mismatches,"warnings":warnings,"ocr_text_preview":ocr["text"][:4000],"has_mismatch":bool(mismatches),"matched_line_count":len(matched_items),"po_line_count":len(po.items or [])}


@router.post("/receiving/scan-invoice")
def scan_central_store_invoice(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    branch_id = payload.get("branch_id"); po_id = payload.get("po_id"); file_name = str(payload.get("file_name") or "invoice"); file_type = str(payload.get("file_type") or ""); file_base64 = str(payload.get("file_base64") or "")
    if not branch_id or not po_id or not file_base64: raise BadRequestException("branch_id, po_id and bill file are required.")
    check_user_outlet_access(current_user, branch_id, db)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise NotFoundException(f"Purchase Order '{po_id}' not found.")
    allowed = {"application/pdf","image/jpeg","image/jpg","image/png","image/webp"}
    if file_type not in allowed: raise BadRequestException("Supported bill formats: PDF, JPG, PNG, WEBP.")
    try: raw_bytes = base64.b64decode(file_base64)
    except Exception: raise BadRequestException("Invalid bill file data.")
    if len(raw_bytes) < 16: raise BadRequestException("Bill file is empty or corrupted.")
    upload_dir = os.path.join(os.getcwd(),"uploads","invoices"); os.makedirs(upload_dir,exist_ok=True)
    ext = ".pdf" if file_type == "application/pdf" else ".webp" if "webp" in file_type else ".png" if "png" in file_type else ".jpg"
    safe_name = f"ocr_{uuid.uuid4().hex[:12]}_{re.sub(r'[^A-Za-z0-9_.-]','_',file_name)}"
    if not safe_name.lower().endswith(ext): safe_name += ext
    with open(os.path.join(upload_dir,safe_name),"wb") as f: f.write(raw_bytes)
    storage_ref = f"uploads/invoices/{safe_name}"
    summary = _build_ocr_match_summary(po,_scan_invoice_file(storage_ref))
    summary.update({"storage_ref":storage_ref,"file_name":file_name,"file_type":file_type,"po_id":str(po.id),"po_number":getattr(po,"po_number",None),"supplier_id":str(po.supplier_id) if getattr(po,"supplier_id",None) else None,"supplier_name":getattr(po.supplier,"name",None) if getattr(po,"supplier",None) else None})
    log_procurement_audit(db=db,user=current_user,action="SCAN_SUPPLIER_INVOICE_OCR",entity_type="PurchaseOrder",entity_id=po.id,company_id=po.company_id,branch_id=branch_id,new_values={"po_number":po.po_number,"file_name":file_name,"storage_ref":storage_ref,"invoice_number":summary.get("invoice_number"),"matched_line_count":summary.get("matched_line_count"),"mismatch_count":len(summary.get("mismatches") or [])})
    db.commit(); return summary


@router.post("/receiving/submit-ocr")
def submit_central_store_ocr_receiving(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    branch_id = payload.get("branch_id"); po_id = payload.get("po_id"); storage_ref = payload.get("storage_ref"); notes = str(payload.get("notes") or "").strip()
    if not branch_id or not po_id or not storage_ref: raise BadRequestException("branch_id, po_id and storage_ref are required.")
    check_user_outlet_access(current_user, branch_id, db)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po: raise NotFoundException(f"Purchase Order '{po_id}' not found.")
    summary = _build_ocr_match_summary(po,_scan_invoice_file(storage_ref))
    invoice_number = summary.get("invoice_number")
    if not invoice_number: raise BadRequestException("Bill number could not be read. Please scan a clearer bill; manual quantity entry is not required.")
    if not summary.get("items"): raise BadRequestException("No PO item quantity could be read from the bill. Please scan a clearer full bill.")
    duplicate = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.po_id == po.id, GoodsReceiveNote.invoice_number == invoice_number, GoodsReceiveNote.status != "REJECTED").first()
    if duplicate: raise ConflictException(f"Invoice '{invoice_number}' has already been used for this PO.")
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch: raise NotFoundException(f"Branch '{branch_id}' not found.")
    company_id = branch.company_id or current_user.company_id
    warehouse = db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True).first()
    warehouse_id = warehouse.id if warehouse else None
    if not warehouse_id: raise BadRequestException("No active warehouse is configured for this Central Store scope.")
    grn = GoodsReceiveNote(company_id=company_id,branch_id=branch_id,warehouse_id=warehouse_id,supplier_id=po.supplier_id,po_id=po.id,grn_number=f"GRN-OCR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",receive_date=datetime.utcnow(),invoice_number=invoice_number,total_amount=Decimal(str(summary.get("invoice_amount") or 0)),status="PENDING_APPROVAL",notes=f"{notes} [OCR_MISMATCHES={json.dumps(summary.get('mismatches') or [],ensure_ascii=False)}] [OCR_WARNINGS={json.dumps(summary.get('warnings') or [],ensure_ascii=False)}] [INVOICE_STORAGE={storage_ref}]".strip(),received_by_id=current_user.id)
    db.add(grn); db.flush()
    po_map={str(x.id):x for x in po.items or []}
    for row in summary.get("items") or []:
        po_item=po_map.get(str(row["po_item_id"])); qty=Decimal(str(row["received_qty"]))
        if not po_item or qty <= 0: continue
        rate=Decimal(str(row.get("invoice_rate") or getattr(po_item,"unit_price",0) or 0))
        db.add(GoodsReceiveItem(grn_id=grn.id,po_item_id=po_item.id,item_id=po_item.item_id,received_qty=qty,accepted_qty=qty,rejected_qty=Decimal("0"),unit_price=rate,total_price=qty*rate,batch_number=None,expiry_date=None,qc_status="PENDING",qc_notes=None))
    db.flush()
    log_procurement_audit(db=db,user=current_user,action="SUBMIT_OCR_PO_RECEIVING",entity_type="GoodsReceiveNote",entity_id=grn.id,company_id=company_id,branch_id=branch_id,new_values={"po_number":po.po_number,"grn_number":grn.grn_number,"invoice_number":invoice_number,"invoice_amount":summary.get("invoice_amount"),"status":"PENDING_APPROVAL","mismatches":summary.get("mismatches") or []})
    db.commit(); db.refresh(grn)
    return {"id":str(grn.id),"grn_number":grn.grn_number,"status":grn.status,"invoice_number":invoice_number,"invoice_amount":summary.get("invoice_amount"),"has_mismatch":summary.get("has_mismatch"),"mismatches":summary.get("mismatches") or [],"message":"OCR receiving submitted for Admin approval. Stock has not been posted yet."}


# ------------------------------------------------------------------------------
# OUTLET MY BILLS — DIRECT BILL OCR (NO PO / NO MANUAL ITEM ENTRY)
# ------------------------------------------------------------------------------
def _extract_direct_bill_vendor(text: str) -> Optional[str]:
    for raw in text.splitlines()[:12]:
        line = _normalise_ocr_text(raw)
        low = line.lower()
        if not line or len(line) < 3 or len(line) > 80:
            continue
        if any(token in low for token in ("invoice", "tax invoice", "bill no", "gstin", "date", "total", "amount", "qty")):
            continue
        if re.search(r"[a-zA-Z]", line):
            return line
    return None


def _match_direct_bill_items(db: Session, company_id: Optional[str], text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    lines = [_normalise_ocr_text(x) for x in text.splitlines() if _normalise_ocr_text(x)]
    items_query = db.query(Item).filter(Item.is_active == True)
    if company_id and hasattr(Item, "company_id"):
        items_query = items_query.filter(Item.company_id == company_id)
    catalog_items = items_query.all()
    matched: List[Dict[str, Any]] = []
    warnings: List[str] = []
    used_item_ids: set[str] = set()

    for raw in lines:
        low = raw.lower()
        if any(word in low for word in ("grand total", "net payable", "invoice total", "amount payable", "tax total", "discount total", "subtotal", "total amount")):
            continue
        numbers = _extract_line_numbers(raw)
        if len(numbers) < 2:
            continue

        best_item = None
        best_score = 0.0
        raw_tokens = _token_set(raw)
        for item in catalog_items:
            if str(item.id) in used_item_ids:
                continue
            name = str(getattr(item, "name", "") or "")
            code = str(getattr(item, "code", "") or "").strip().lower()
            name_tokens = _token_set(name)
            score = 0.0
            if code and code in low:
                score += 1.0
            if name_tokens:
                score += min(len(name_tokens & raw_tokens) / max(len(name_tokens), 1), 1.0) * 0.9
            if score > best_score:
                best_score = score
                best_item = item

        if not best_item or best_score < 0.55:
            continue

        if len(numbers) >= 3:
            qty, rate, line_total = numbers[-3], numbers[-2], numbers[-1]
        else:
            qty, rate = numbers[-2], numbers[-1]
            line_total = qty * rate
        if qty <= 0 or rate < 0:
            continue

        matched.append({
            "item_id": str(best_item.id),
            "item_name": best_item.name,
            "quantity": float(qty),
            "unit": best_item.unit.symbol if getattr(best_item, "unit", None) else "UNIT",
            "rate": float(rate),
            "line_total": float(line_total),
            "match_score": round(best_score, 3),
            "ocr_line": raw[:240],
        })
        used_item_ids.add(str(best_item.id))

    if not matched:
        warnings.append("No inventory item could be matched confidently from the bill OCR.")
    return matched, warnings


@router.post("/my-bills/submit-ocr")
def submit_outlet_my_bill_ocr(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    branch_id = payload.get("branch_id")
    file_name = str(payload.get("file_name") or "bill")
    file_type = str(payload.get("file_type") or "")
    file_base64 = str(payload.get("file_base64") or "")
    platform = str(payload.get("platform") or "Local Supplier").strip()
    purchase_date = str(payload.get("purchase_date") or "").strip()
    manual_invoice_number = str(payload.get("invoice_number") or "").strip()
    user_notes = str(payload.get("notes") or "").strip()

    if not branch_id or not file_base64:
        raise BadRequestException("branch_id and bill file are required.")
    check_user_outlet_access(current_user, branch_id, db)

    allowed = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}
    if file_type not in allowed:
        raise BadRequestException("Supported bill formats: PDF, JPG, PNG, WEBP.")
    try:
        raw_bytes = base64.b64decode(file_base64)
    except Exception:
        raise BadRequestException("Invalid bill file data.")
    if len(raw_bytes) < 16:
        raise BadRequestException("Bill file is empty or corrupted.")

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException(f"Outlet branch '{branch_id}' not found.")
    company_id = branch.company_id or current_user.company_id
    warehouse = db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True).first()
    if not warehouse:
        raise BadRequestException("No active outlet warehouse is configured for this branch.")

    upload_dir = os.path.join(os.getcwd(), "uploads", "invoices")
    os.makedirs(upload_dir, exist_ok=True)
    ext = ".pdf" if file_type == "application/pdf" else ".webp" if "webp" in file_type else ".png" if "png" in file_type else ".jpg"
    safe_name = f"mybill_{uuid.uuid4().hex[:12]}_{re.sub(r'[^A-Za-z0-9_.-]', '_', file_name)}"
    if not safe_name.lower().endswith(ext):
        safe_name += ext
    with open(os.path.join(upload_dir, safe_name), "wb") as f:
        f.write(raw_bytes)
    storage_ref = f"uploads/invoices/{safe_name}"

    ocr = _scan_invoice_file(storage_ref)
    header = _parse_invoice_header(ocr.get("text") or "")
    invoice_number = manual_invoice_number or header.get("invoice_number")
    invoice_amount = header.get("invoice_amount")
    if not invoice_number:
        raise BadRequestException("Bill / Invoice number could not be read. Please upload a clearer bill.")
    if invoice_amount is None or float(invoice_amount) <= 0:
        raise BadRequestException("Bill total could not be read. Please upload a clear bill showing the final amount.")

    duplicate = db.query(GoodsReceiveNote).filter(
        GoodsReceiveNote.branch_id == branch_id,
        GoodsReceiveNote.invoice_number == invoice_number,
        GoodsReceiveNote.status != "REJECTED",
    ).first()
    if duplicate:
        raise ConflictException(f"Bill / Invoice '{invoice_number}' has already been submitted for this outlet.")

    matched_items, warnings = _match_direct_bill_items(db, company_id, ocr.get("text") or "")
    if not matched_items:
        raise BadRequestException("OCR could not confidently identify any inventory items from this bill. Please upload a clearer full bill; manual item entry is disabled for My Bills.")

    vendor_name = _extract_direct_bill_vendor(ocr.get("text") or "") or platform
    grn_number = f"MYB-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    notes = (
        f"[MY_BILL] [Platform: {platform}] [Vendor: {vendor_name}] "
        f"[Invoice Date OCR: {header.get('invoice_date') or purchase_date or 'UNKNOWN'}] "
        f"[INVOICE_STORAGE={storage_ref}] "
        f"[OCR_WARNINGS={json.dumps(warnings, ensure_ascii=False)}] "
        f"{user_notes}"
    ).strip()

    grn = GoodsReceiveNote(
        company_id=company_id,
        branch_id=branch_id,
        warehouse_id=warehouse.id,
        supplier_id=None,
        po_id=None,
        grn_number=grn_number,
        receive_date=datetime.utcnow(),
        invoice_number=invoice_number,
        total_amount=Decimal(str(invoice_amount)),
        status="PENDING_APPROVAL",
        notes=notes,
        received_by_id=current_user.id,
    )
    db.add(grn)
    db.flush()

    for row in matched_items:
        qty = Decimal(str(row["quantity"]))
        rate = Decimal(str(row["rate"]))
        db.add(GoodsReceiveItem(
            grn_id=grn.id,
            po_item_id=None,
            item_id=row["item_id"],
            received_qty=qty,
            accepted_qty=qty,
            rejected_qty=Decimal("0"),
            unit_price=rate,
            total_price=qty * rate,
            batch_number=None,
            expiry_date=None,
            qc_status="PENDING",
            qc_notes="My Bill OCR - awaiting Head Office approval",
        ))

    log_procurement_audit(
        db=db, user=current_user, action="SUBMIT_MY_BILL_OCR",
        entity_type="GoodsReceiveNote", entity_id=grn.id,
        company_id=company_id, branch_id=branch_id,
        new_values={
            "grn_number": grn.grn_number,
            "invoice_number": invoice_number,
            "invoice_amount": float(invoice_amount),
            "platform": platform,
            "vendor_name": vendor_name,
            "items_count": len(matched_items),
            "status": "PENDING_APPROVAL",
        },
    )
    db.commit()
    db.refresh(grn)

    return {
        "id": str(grn.id),
        "grn_number": grn.grn_number,
        "status": grn.status,
        "invoice_number": invoice_number,
        "invoice_amount": float(invoice_amount),
        "vendor_name": vendor_name,
        "invoice_date": header.get("invoice_date") or purchase_date or None,
        "items": matched_items,
        "warnings": warnings,
        "message": "My Bill submitted for Head Office approval. Stock has not been posted yet.",
    }


# ==============================================================================
# Twice-Monthly Closing & Stock Valuation Endpoints
# ==============================================================================

def format_closing_response(rec: OutletClosingRecord, db: Session) -> OutletClosingRecordResponse:
    branch = rec.branch or db.query(Branch).filter(Branch.id == rec.branch_id).first()
    branch_name = branch.name if branch else None

    items_res = []
    for ci in rec.closing_items:
        db_item = getattr(ci, "item", None) or db.query(Item).filter(Item.id == ci.item_id).first()
        unit_sym = db_item.unit.symbol if db_item and db_item.unit else "UNIT"
        items_res.append(
            ClosingStockItemResponse(
                id=ci.id,
                item_id=ci.item_id,
                item_name=db_item.name if db_item else "Unknown Item",
                item_code=db_item.code if db_item else "",
                unit_symbol=unit_sym,
                opening_qty=ci.opening_qty,
                received_qty=ci.received_qty,
                theoretical_closing_qty=ci.theoretical_closing_qty,
                physical_closing_qty=ci.physical_closing_qty,
                variance_qty=ci.variance_qty,
                unit_cost=ci.unit_cost,
                total_valuation=ci.total_valuation,
                notes=ci.notes,
            )
        )

    fc_res = []
    for fc in rec.food_cost_breakdowns:
        fc_res.append(
            FoodCostBreakdownResponse(
                category_id=fc.category_id,
                sales_revenue=fc.sales_revenue,
                theoretical_cost=fc.theoretical_cost,
                actual_cost=fc.actual_cost,
                theoretical_cost_pct=fc.theoretical_cost_pct,
                actual_cost_pct=fc.actual_cost_pct,
                variance_cost=fc.variance_cost,
                variance_pct=fc.variance_pct,
            )
        )

    return OutletClosingRecordResponse(
        id=rec.id,
        company_id=rec.company_id,
        branch_id=rec.branch_id,
        branch_name=branch_name,
        period_type=rec.period_type.value if hasattr(rec.period_type, "value") else str(rec.period_type),
        year=rec.year,
        month=rec.month,
        start_date=rec.start_date,
        end_date=rec.end_date,
        status=rec.status.value if hasattr(rec.status, "value") else str(rec.status),
        opening_valuation=rec.opening_valuation,
        total_purchases=rec.total_purchases,
        closing_physical_valuation=rec.closing_physical_valuation,
        calculated_consumption=rec.calculated_consumption,
        theoretical_food_cost=rec.theoretical_food_cost or Decimal("0.0000"),
        actual_food_cost=rec.actual_food_cost or Decimal("0.0000"),
        variance_amount=rec.variance_amount or Decimal("0.0000"),
        variance_percentage=rec.variance_percentage or Decimal("0.0000"),
        notes=rec.notes,
        submitted_by_id=rec.submitted_by_id,
        submitted_at=rec.submitted_at,
        verified_by_id=rec.verified_by_id,
        verified_at=rec.verified_at,
        finalized_at=rec.finalized_at,
        closing_items=items_res,
        food_cost_breakdowns=fc_res,
        created_at=rec.created_at,
        updated_at=rec.updated_at,
    )


@router.get("/closings", response_model=List[OutletClosingRecordResponse])
def list_outlet_closings(
    branch_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List twice-monthly closing records.

    Scope rules:
    - A scoped outlet / Central Store user can only see their assigned branch records.
    - Head Office roles can query the full company closing queue.
    - status_filter is optional and is primarily used by the Approval Center.
    """
    query = db.query(OutletClosingRecord)

    if current_user.company_id:
        query = query.filter(OutletClosingRecord.company_id == current_user.company_id)

    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(OutletClosingRecord.branch_id == branch_id)
    else:
        # Do not leak company-wide closing records to a non-HQ user.
        role_name = ""
        if getattr(current_user, "role", None):
            raw_role = getattr(current_user, "role", None)
            if isinstance(raw_role, str):
                role_name = raw_role
            else:
                role_name = getattr(raw_role, "name", "") or ""
        if not role_name and getattr(current_user, "role_id", None):
            from app.models.user import Role as RoleModel
            role_obj = db.query(RoleModel).filter(RoleModel.id == current_user.role_id).first()
            role_name = getattr(role_obj, "name", "") if role_obj else ""

        is_hq = str(role_name or "").strip().upper().replace("-", "_").replace(" ", "_") in HQ_APPROVER_ROLES
        if not is_hq:
            assigned_branch_ids = [
                row[0]
                for row in db.query(UserBranch.branch_id)
                .filter(UserBranch.user_id == current_user.id)
                .all()
                if row[0]
            ]
            if not assigned_branch_ids:
                return []
            query = query.filter(OutletClosingRecord.branch_id.in_(assigned_branch_ids))

    if year:
        query = query.filter(OutletClosingRecord.year == year)
    if month:
        query = query.filter(OutletClosingRecord.month == month)

    if status_filter:
        normalized_status = str(status_filter).strip().upper()
        valid_statuses = {item.value for item in ClosingStatus}
        if normalized_status not in valid_statuses:
            raise BadRequestException(
                "status_filter must be one of DRAFT, SUBMITTED, VERIFIED, FINALIZED_LOCKED or REJECTED."
            )
        query = query.filter(
            OutletClosingRecord.status
            == getattr(ClosingStatus, normalized_status)
        )

    records = query.order_by(
        desc(OutletClosingRecord.year),
        desc(OutletClosingRecord.month),
        desc(OutletClosingRecord.period_type),
        desc(OutletClosingRecord.updated_at),
    ).all()
    return [format_closing_response(r, db) for r in records]


@router.get("/closings/active/{branch_id}", response_model=ActiveClosingDraftResponse)
def get_active_closing_draft(
    branch_id: str = Path(...),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    period_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns the active bi-monthly closing draft for the outlet.
    Determines period (1st-15th or 16th-MonthEnd) and pre-fills opening stock & purchases in period.
    """
    check_user_outlet_access(current_user, branch_id, db)
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{branch_id}' not found.")

    today = date.today()
    selected_year = int(year or today.year)
    selected_month = int(month or today.month)
    selected_period = str(period_type or ("FIRST_HALF" if today.day <= 15 else "SECOND_HALF")).upper()

    if selected_year < 2000 or selected_year > 2100:
        raise BadRequestException("year must be between 2000 and 2100.")
    if selected_month < 1 or selected_month > 12:
        raise BadRequestException("month must be between 1 and 12.")
    if selected_period not in {"FIRST_HALF", "SECOND_HALF"}:
        raise BadRequestException("period_type must be FIRST_HALF or SECOND_HALF.")

    year = selected_year
    month = selected_month
    period_type = selected_period

    if period_type == "FIRST_HALF":
        start_date = datetime(year, month, 1, 0, 0, 0)
        end_date = datetime(year, month, 15, 23, 59, 59)
        days_remaining = max(0, 15 - today.day) if (year == today.year and month == today.month) else 0
    else:
        start_date = datetime(year, month, 16, 0, 0, 0)
        if month == 12:
            next_m = datetime(year + 1, 1, 1)
        else:
            next_m = datetime(year, month + 1, 1)
        last_day = (next_m - timedelta(days=1)).day
        end_date = datetime(year, month, last_day, 23, 59, 59)
        days_remaining = max(0, last_day - today.day) if (year == today.year and month == today.month) else 0

    # Check if there is an existing closing record for this period
    existing = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.branch_id == branch_id,
        OutletClosingRecord.year == year,
        OutletClosingRecord.month == month,
        OutletClosingRecord.period_type == (ClosingPeriodType.FIRST_HALF if period_type == "FIRST_HALF" else ClosingPeriodType.SECOND_HALF)
    ).first()

    warehouses = db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_active == True).all()
    wh_ids = [w.id for w in warehouses]

    items = db.query(Item).filter(
        Item.company_id == (branch.company_id or current_user.company_id),
        Item.is_active == True
    ).all()

    # Calculate purchases in period
    purchases_map = {}
    if wh_ids:
        grns = db.query(GoodsReceiveNote).filter(
            GoodsReceiveNote.branch_id == branch_id,
            GoodsReceiveNote.receive_date >= start_date,
            GoodsReceiveNote.receive_date <= end_date
        ).all()
        for g in grns:
            for gi in g.items:
                purchases_map[gi.item_id] = purchases_map.get(gi.item_id, Decimal("0.0000")) + gi.accepted_qty

    # Calculate current stock balances
    stock_map = {}
    if wh_ids:
        sbs = db.query(StockBalance).filter(StockBalance.warehouse_id.in_(wh_ids)).all()
        for sb in sbs:
            stock_map[sb.item_id] = sb.quantity or Decimal("0.0000")

    closing_items_res = []
    total_opening_valuation = Decimal("0.0000")
    total_purchases_valuation = Decimal("0.0000")

    for itm in items:
        unit_sym = itm.unit.symbol if itm.unit else "UNIT"
        unit_cost = itm.cost_price or Decimal("0.0000")
        curr_stock = stock_map.get(itm.id, Decimal("0.0000"))
        rec_qty = purchases_map.get(itm.id, Decimal("0.0000"))

        # Opening qty = Current - Received in period (or from previous period)
        opening_qty = max(Decimal("0.0000"), curr_stock - rec_qty)
        theo_closing = opening_qty + rec_qty

        total_opening_valuation += opening_qty * unit_cost
        total_purchases_valuation += rec_qty * unit_cost

        closing_items_res.append(
            ClosingStockItemResponse(
                id=str(uuid.uuid4()),
                item_id=itm.id,
                item_name=itm.name,
                item_code=itm.code,
                unit_symbol=unit_sym,
                opening_qty=opening_qty,
                received_qty=rec_qty,
                theoretical_closing_qty=theo_closing,
                physical_closing_qty=curr_stock,
                variance_qty=Decimal("0.0000"),
                unit_cost=unit_cost,
                total_valuation=curr_stock * unit_cost,
                notes=None,
            )
        )

    return ActiveClosingDraftResponse(
        branch_id=branch_id,
        branch_name=branch.name,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
        status="DRAFT" if not existing else existing.status.value,
        days_remaining=max(0, days_remaining),
        opening_valuation=total_opening_valuation,
        total_purchases=total_purchases_valuation,
        items=closing_items_res,
    )


@router.post("/closings/submit", response_model=OutletClosingRecordResponse)
def submit_outlet_closing(
    payload: ClosingSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Submits physical closing stock count for an Outlet or Central Store.

    Workflow:
      DRAFT / REJECTED -> SUBMITTED -> HQ approval -> VERIFIED -> LOCKED
    """
    check_user_outlet_access(current_user, payload.branch_id, db)
    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise NotFoundException(f"Branch '{payload.branch_id}' not found.")

    if payload.year < 2000 or payload.year > 2100:
        raise BadRequestException("year must be between 2000 and 2100.")
    if payload.month < 1 or payload.month > 12:
        raise BadRequestException("month must be between 1 and 12.")
    if payload.period_type not in {"FIRST_HALF", "SECOND_HALF"}:
        raise BadRequestException("period_type must be FIRST_HALF or SECOND_HALF.")

    company_id = branch.company_id or current_user.company_id
    period_enum = (
        ClosingPeriodType.FIRST_HALF
        if payload.period_type == "FIRST_HALF"
        else ClosingPeriodType.SECOND_HALF
    )

    # Start & End dates
    if payload.period_type == "FIRST_HALF":
        start_date = datetime(payload.year, payload.month, 1, 0, 0, 0)
        end_date = datetime(payload.year, payload.month, 15, 23, 59, 59)
    else:
        start_date = datetime(payload.year, payload.month, 16, 0, 0, 0)
        if payload.month == 12:
            next_m = datetime(payload.year + 1, 1, 1)
        else:
            next_m = datetime(payload.year, payload.month + 1, 1)
        last_day = (next_m - timedelta(days=1)).day
        end_date = datetime(payload.year, payload.month, last_day, 23, 59, 59)

    # Check existing
    record = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.branch_id == payload.branch_id,
        OutletClosingRecord.year == payload.year,
        OutletClosingRecord.month == payload.month,
        OutletClosingRecord.period_type == period_enum
    ).first()

    if record:
        if record.status == ClosingStatus.FINALIZED_LOCKED:
            raise BadRequestException("This closing period is LOCKED against modifications.")
        if record.status == ClosingStatus.SUBMITTED:
            raise BadRequestException("This closing is already SUBMITTED and is waiting for approval.")
        if record.status == ClosingStatus.VERIFIED:
            raise BadRequestException("This closing is already APPROVED. Lock it from the Approval Center.")

        # REJECTED or DRAFT may be resubmitted.
        db.query(ClosingStockItem).filter(
            ClosingStockItem.closing_record_id == record.id
        ).delete(synchronize_session=False)
        record.start_date = start_date
        record.end_date = end_date
        record.company_id = company_id
        record.notes = payload.notes
        record.verified_by_id = None
        record.verified_at = None
        record.finalized_at = None
    else:
        record = OutletClosingRecord(
            company_id=company_id,
            branch_id=payload.branch_id,
            period_type=period_enum,
            year=payload.year,
            month=payload.month,
            start_date=start_date,
            end_date=end_date,
            status=ClosingStatus.DRAFT,
            opening_valuation=Decimal("0.0000"),
            total_purchases=Decimal("0.0000"),
            closing_physical_valuation=Decimal("0.0000"),
            calculated_consumption=Decimal("0.0000"),
            theoretical_food_cost=Decimal("0.0000"),
            actual_food_cost=Decimal("0.0000"),
            variance_amount=Decimal("0.0000"),
            variance_percentage=Decimal("0.0000"),
            notes=payload.notes,
        )
        db.add(record)
        db.flush()

    # Calculate purchases in period
    purchases_map: Dict[str, Decimal] = {}
    grns = db.query(GoodsReceiveNote).filter(
        GoodsReceiveNote.branch_id == payload.branch_id,
        GoodsReceiveNote.receive_date >= start_date,
        GoodsReceiveNote.receive_date <= end_date
    ).all()
    for g in grns:
        for gi in g.items:
            purchases_map[gi.item_id] = (
                purchases_map.get(gi.item_id, Decimal("0.0000"))
                + (gi.accepted_qty or Decimal("0.0000"))
            )

    total_opening_val = Decimal("0.0000")
    total_purchases_val = Decimal("0.0000")
    total_closing_val = Decimal("0.0000")

    for item_sub in payload.items:
        db_item = db.query(Item).filter(Item.id == item_sub.item_id).first()
        if not db_item:
            continue

        unit_cost = db_item.cost_price or Decimal("0.0000")
        rec_qty = purchases_map.get(item_sub.item_id, Decimal("0.0000"))

        opening_qty = max(
            Decimal("0.0000"),
            item_sub.physical_closing_qty - rec_qty
        )
        theo_closing = opening_qty + rec_qty
        variance_qty = item_sub.physical_closing_qty - theo_closing
        item_val = item_sub.physical_closing_qty * unit_cost

        total_opening_val += opening_qty * unit_cost
        total_purchases_val += rec_qty * unit_cost
        total_closing_val += item_val

        ci = ClosingStockItem(
            closing_record_id=record.id,
            item_id=item_sub.item_id,
            unit_id=db_item.unit_id,
            opening_qty=opening_qty,
            received_qty=rec_qty,
            theoretical_closing_qty=theo_closing,
            physical_closing_qty=item_sub.physical_closing_qty,
            variance_qty=variance_qty,
            unit_cost=unit_cost,
            total_valuation=item_val,
            notes=item_sub.notes,
        )
        db.add(ci)

    # Actual Consumption = Opening + Purchases - Closing
    calculated_consumption = max(
        Decimal("0.0000"),
        total_opening_val + total_purchases_val - total_closing_val
    )
    theoretical_cost = calculated_consumption * Decimal("0.95")
    variance_amt = calculated_consumption - theoretical_cost
    variance_pct = (
        variance_amt / calculated_consumption * Decimal("100.00")
        if calculated_consumption > 0
        else Decimal("0.00")
    )

    record.opening_valuation = total_opening_val
    record.total_purchases = total_purchases_val
    record.closing_physical_valuation = total_closing_val
    record.calculated_consumption = calculated_consumption
    record.theoretical_food_cost = theoretical_cost
    record.actual_food_cost = calculated_consumption
    record.variance_amount = variance_amt
    record.variance_percentage = variance_pct
    record.status = ClosingStatus.SUBMITTED
    record.submitted_by_id = current_user.id
    record.submitted_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="SUBMIT_OUTLET_CLOSING",
        entity_type="OutletClosingRecord",
        entity_id=record.id,
        company_id=company_id,
        branch_id=payload.branch_id,
        new_values={
            "period": f"{payload.year}-{payload.month} {payload.period_type}",
            "closing_valuation": float(total_closing_val),
            "calculated_consumption": float(calculated_consumption),
            "location_type": getattr(branch, "type", None),
        }
    )
    db.commit()
    return format_closing_response(record, db)


@router.post("/closings/{closing_id}/approve", response_model=OutletClosingRecordResponse)
def approve_outlet_closing(
    closing_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Approve a submitted Outlet or Central Store closing from the HQ Approval Center."""
    require_head_office_role(current_user, db)

    record = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.id == closing_id
    ).first()
    if not record:
        raise NotFoundException(f"Closing record '{closing_id}' not found.")

    if current_user.company_id and record.company_id != current_user.company_id:
        raise ForbiddenException("Access denied for this closing record.")

    if record.status != ClosingStatus.SUBMITTED:
        raise BadRequestException(
            f"Closing '{closing_id}' is not pending approval. Current status: {record.status.value}."
        )

    record.status = ClosingStatus.VERIFIED
    record.verified_by_id = current_user.id
    record.verified_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="APPROVE_OUTLET_CLOSING",
        entity_type="OutletClosingRecord",
        entity_id=record.id,
        company_id=record.company_id,
        branch_id=record.branch_id,
        new_values={
            "status": ClosingStatus.VERIFIED.value,
            "approved_by": current_user.email,
        }
    )
    db.commit()
    return format_closing_response(record, db)


@router.post("/closings/{closing_id}/reject", response_model=OutletClosingRecordResponse)
def reject_outlet_closing(
    closing_id: str = Path(...),
    payload: PurchaseRequestRejectRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Reject a submitted Outlet or Central Store closing with a mandatory reason."""
    require_head_office_role(current_user, db)

    record = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.id == closing_id
    ).first()
    if not record:
        raise NotFoundException(f"Closing record '{closing_id}' not found.")

    if current_user.company_id and record.company_id != current_user.company_id:
        raise ForbiddenException("Access denied for this closing record.")

    if record.status != ClosingStatus.SUBMITTED:
        raise BadRequestException(
            f"Closing '{closing_id}' is not pending approval. Current status: {record.status.value}."
        )

    record.status = ClosingStatus.REJECTED
    record.verified_by_id = None
    record.verified_at = None
    record.finalized_at = None
    record.notes = (
        f"{record.notes or ''} "
        f"[Rejected by {current_user.email}: {payload.reason}]"
    ).strip()
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="REJECT_OUTLET_CLOSING",
        entity_type="OutletClosingRecord",
        entity_id=record.id,
        company_id=record.company_id,
        branch_id=record.branch_id,
        new_values={
            "status": ClosingStatus.REJECTED.value,
            "rejected_by": current_user.email,
            "reason": payload.reason,
        }
    )
    db.commit()
    return format_closing_response(record, db)


@router.post("/closings/{closing_id}/lock", response_model=OutletClosingRecordResponse)
def lock_outlet_closing(
    closing_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Finalizes and LOCKS an APPROVED closing period.
    Only Head Office approval roles can lock a VERIFIED closing.
    """
    require_head_office_role(current_user, db)

    record = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.id == closing_id
    ).first()
    if not record:
        raise NotFoundException(f"Closing record '{closing_id}' not found.")

    if current_user.company_id and record.company_id != current_user.company_id:
        raise ForbiddenException("Access denied for this closing record.")

    if record.status != ClosingStatus.VERIFIED:
        raise BadRequestException(
            f"Only a VERIFIED closing can be locked. Current status: {record.status.value}."
        )

    record.status = ClosingStatus.FINALIZED_LOCKED
    record.finalized_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="LOCK_OUTLET_CLOSING",
        entity_type="OutletClosingRecord",
        entity_id=record.id,
        company_id=record.company_id,
        branch_id=record.branch_id,
        new_values={
            "status": ClosingStatus.FINALIZED_LOCKED.value,
            "locked_by": current_user.email,
        }
    )
    db.commit()
    return format_closing_response(record, db)


@router.post("/closings/{closing_id}/reopen", response_model=OutletClosingRecordResponse)
def reopen_outlet_closing(
    closing_id: str = Path(...),
    payload: PurchaseOrderCancelRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Reopens a LOCKED closing period for authorized HQ correction.
    The reason is mandatory and an audit trail is recorded.
    """
    require_head_office_role(current_user, db)

    record = db.query(OutletClosingRecord).filter(
        OutletClosingRecord.id == closing_id
    ).first()
    if not record:
        raise NotFoundException(f"Closing record '{closing_id}' not found.")

    if current_user.company_id and record.company_id != current_user.company_id:
        raise ForbiddenException("Access denied for this closing record.")

    if record.status != ClosingStatus.FINALIZED_LOCKED:
        raise BadRequestException(
            f"Only a LOCKED closing can be reopened. Current status: {record.status.value}."
        )

    record.status = ClosingStatus.DRAFT
    record.verified_by_id = None
    record.verified_at = None
    record.finalized_at = None
    record.notes = (
        f"{record.notes or ''} "
        f"[Reopened by {current_user.email}: {payload.reason}]"
    ).strip()
    record.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)

    log_procurement_audit(
        db=db,
        user=current_user,
        action="REOPEN_OUTLET_CLOSING",
        entity_type="OutletClosingRecord",
        entity_id=record.id,
        company_id=record.company_id,
        branch_id=record.branch_id,
        new_values={
            "status": ClosingStatus.DRAFT.value,
            "reopened_by": current_user.email,
            "reason": payload.reason,
        }
    )
    db.commit()
    return format_closing_response(record, db)


# ==============================================================================
# PART 27 — Smart Inventory / Purchase Intelligence
# ==============================================================================

@router.get("/smart-inventory/intelligence")
def get_smart_inventory_purchase_intelligence(
    branch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Part 27 read-only intelligence layer.

    Uses deterministic stock/consumption/pending-inbound calculations and existing
    SupplierItem mappings to produce purchase recommendations. No stock mutation,
    PO creation, or approval is performed here.
    """
    check_user_outlet_access(current_user, branch_id, db)
    company_id = current_user.company_id

    # Reuse the existing deterministic engine so Part 27 does not create a
    # duplicate calculation path.
    items = calculate_outlet_smart_requirements(
        db=db,
        company_id=company_id,
        branch_id=branch_id,
        lead_time_days=1,
        safety_buffer_percent=Decimal("10.00"),
    )

    # Existing supplier-item master is the source for purchase price, conversion,
    # lead time and preferred-supplier information.
    item_ids = [row["item_id"] for row in items]
    supplier_rows = []
    if item_ids:
        supplier_rows = (
            db.query(SupplierItem)
            .filter(
                SupplierItem.company_id == company_id,
                SupplierItem.item_id.in_(item_ids),
                SupplierItem.is_active == True,
            )
            .all()
        )

    supplier_map = {}
    for row in supplier_rows:
        supplier_map.setdefault(row.item_id, []).append(row)

    actionable = []
    for row in items:
        if row["system_suggested_qty"] <= Decimal("0.0000") and row["priority"] == "LOW":
            continue

        candidates = supplier_map.get(row["item_id"], [])
        preferred = next((x for x in candidates if x.is_preferred), None)
        chosen = preferred or (sorted(candidates, key=lambda x: (x.purchase_price or Decimal("0"), x.lead_time_days or 999))[0] if candidates else None)

        daily = row["daily_consumption"] or Decimal("0")
        days_cover = None
        if daily > Decimal("0"):
            days_cover = round(row["current_stock"] / daily, 2)

        purchase_price = chosen.purchase_price if chosen else row["cost_price"]
        estimated_value = (row["system_suggested_qty"] or Decimal("0")) * (purchase_price or Decimal("0"))

        actionable.append({
            "item_id": row["item_id"],
            "item_name": row["item_name"],
            "item_code": row["item_code"],
            "unit_symbol": row["unit_symbol"],
            "current_stock": row["current_stock"],
            "min_stock": row["min_stock"],
            "target_stock": row["target_stock"],
            "pending_incoming": row["pending_incoming"],
            "daily_consumption": row["daily_consumption"],
            "days_of_cover": days_cover,
            "short_qty": row["short_qty"],
            "recommended_order_qty": row["system_suggested_qty"],
            "priority": row["priority"],
            "supplier_id": chosen.supplier_id if chosen else row["supplier_id"],
            "supplier_name": chosen.supplier.name if chosen and chosen.supplier else row["supplier_name"],
            "supplier_price": purchase_price or Decimal("0"),
            "supplier_lead_time_days": chosen.lead_time_days if chosen else None,
            "supplier_is_preferred": bool(chosen.is_preferred) if chosen else False,
            "purchase_unit_id": chosen.purchase_unit_id if chosen else None,
            "conversion_rate": chosen.conversion_rate if chosen else Decimal("1"),
            "estimated_purchase_value": round(estimated_value, 4),
            "reason": row["reason"],
        })

    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    actionable.sort(key=lambda x: (priority_order.get(x["priority"], 9), -float(x["recommended_order_qty"])))

    return {
        "success": True,
        "branch_id": branch_id,
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "monitored_items": len(items),
            "actionable_items": len(actionable),
            "critical_items": sum(1 for x in actionable if x["priority"] == "CRITICAL"),
            "high_priority_items": sum(1 for x in actionable if x["priority"] == "HIGH"),
            "medium_priority_items": sum(1 for x in actionable if x["priority"] == "MEDIUM"),
            "estimated_purchase_value": round(sum((x["estimated_purchase_value"] for x in actionable), Decimal("0")), 4),
        },
        "recommendations": actionable,
        "safety": {
            "read_only": True,
            "no_stock_mutation": True,
            "no_po_creation": True,
            "requires_existing_purchase_approval_workflow": True,
        },
    }


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
            unit=(itm.item.unit.symbol if (itm.item and itm.item.unit) else None),
            supply_source=(itm.item.supply_source if itm.item else None) or "CENTRAL_STORE",
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



# ==============================================================================
# Part 22 — Supplier Performance & Procurement Intelligence
# ===============================================================================

@router.get('/supplier-performance')
def supplier_performance(
    days: int = Query(90, ge=1, le=3650),
    supplier_id: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission('procurement:read')),
):
    """Live supplier KPIs derived only from existing PO/GRN/Bill/Payment records."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = db.query(Supplier).filter(Supplier.is_active.is_(True))
    if current_user.company_id:
        q = q.filter(Supplier.company_id == current_user.company_id)
    if supplier_id:
        q = q.filter(Supplier.id == supplier_id)
    suppliers = q.order_by(Supplier.name.asc()).all()

    rows = []
    for supplier in suppliers:
        po_q = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier.id, PurchaseOrder.order_date >= cutoff)
        if current_user.company_id:
            po_q = po_q.filter(PurchaseOrder.company_id == current_user.company_id)
        if branch_id:
            po_q = po_q.filter(PurchaseOrder.branch_id == branch_id)
        pos = po_q.all()
        valid_pos = [po for po in pos if str(po.status) not in {POStatus.CANCELLED.value, POStatus.REJECTED.value, str(POStatus.CANCELLED), str(POStatus.REJECTED)}]

        ordered = Decimal('0'); received = Decimal('0'); rejected = Decimal('0'); damaged = Decimal('0')
        on_time = 0; delivery_checked = 0; delivery_days = []
        for po in valid_pos:
            for item in po.items:
                ordered += Decimal(str(item.approved_qty if item.approved_qty is not None else item.ordered_qty or 0))
                received += Decimal(str(item.received_qty or 0))
            grns = [g for g in po.grns if str(g.status) not in {GRNStatus.REJECTED.value, str(GRNStatus.REJECTED)}]
            if po.expected_delivery_date and grns:
                first = min(grns, key=lambda g: g.receive_date or datetime.max)
                if first.receive_date:
                    delivery_checked += 1
                    delta = (first.receive_date - po.expected_delivery_date).total_seconds() / 86400
                    delivery_days.append(delta)
                    if delta <= 0: on_time += 1
                for grn in grns:
                    for gi in grn.items:
                        rejected += Decimal(str(gi.rejected_qty or 0))
                        damaged += Decimal(str(gi.damaged_qty or 0))

        bills = db.query(VendorBill).filter(VendorBill.supplier_id == supplier.id, VendorBill.invoice_date >= cutoff)
        if current_user.company_id:
            bills = bills.filter(VendorBill.company_id == current_user.company_id)
        bills = bills.all()
        bill_net = sum((Decimal(str(b.net_amount or 0)) for b in bills if b.status != BillStatus.CANCELLED), Decimal('0'))
        bill_ids = {b.id for b in bills}
        payments = db.query(Payment).filter(Payment.supplier_id == supplier.id, Payment.status.in_(['POSTED','PAID']), Payment.payment_date >= cutoff).all()
        paid = sum((Decimal(str(p.amount or 0)) for p in payments if getattr(p, 'bill_id', None) in bill_ids), Decimal('0'))

        spend = sum((Decimal(str(po.grand_total or po.net_amount or po.total_amount or 0)) for po in valid_pos), Decimal('0'))
        fulfillment = (received / ordered * 100) if ordered > 0 else Decimal('0')
        quality_den = received + rejected + damaged
        quality_reject = ((rejected + damaged) / quality_den * 100) if quality_den > 0 else Decimal('0')
        on_time_pct = (Decimal(on_time) / Decimal(delivery_checked) * 100) if delivery_checked else Decimal('0')
        avg_delay = (sum(delivery_days) / len(delivery_days)) if delivery_days else 0.0
        rating = max(0.0, min(100.0, float(on_time_pct) * 0.4 + float(fulfillment) * 0.4 + max(0.0, 20.0 - float(quality_reject) * 2)))

        rows.append({
            'supplier_id': supplier.id, 'supplier_name': supplier.name, 'supplier_code': supplier.code,
            'po_count': len(valid_pos), 'purchase_spend': float(spend), 'ordered_qty': float(ordered),
            'received_qty': float(received), 'fulfillment_percent': round(float(fulfillment), 2),
            'on_time_delivery_percent': round(float(on_time_pct), 2), 'delivery_checked': delivery_checked,
            'average_delivery_delay_days': round(avg_delay, 2), 'rejected_qty': float(rejected),
            'damaged_qty': float(damaged), 'quality_issue_percent': round(float(quality_reject), 2),
            'bill_count': len(bills), 'billed_amount': float(bill_net), 'paid_amount': float(paid),
            'outstanding_amount': float(max(Decimal('0'), bill_net - paid)), 'rating': round(rating, 1),
        })
    rows.sort(key=lambda x: (-x['rating'], -x['purchase_spend'], x['supplier_name']))
    return {'days': days, 'supplier_count': len(rows), 'suppliers': rows}

# ==============================================================================
# RESTORED CENTRAL STORE TRANSFER / QUEUE ROUTES
# ==============================================================================

def resolve_outlet_item_supply_source(db: Session, item: Item) -> Tuple[str, Optional[str], str]:
    """Resolve effective routing for a normal outlet Purchase Requirement.

    An ACTIVE SupplierItem mapping is the strongest outlet-routing signal.
    Therefore an item with a configured Vendor-Item mapping is DIRECT_VENDOR
    even if an older Item Master row still says CENTRAL_STORE. If no active
    mapping exists, the explicit Item Master supply_source is respected.
    """
    if item is None:
        return "CENTRAL_STORE", None, "NOT_CONFIGURED"

    mapped = None
    try:
        mapped = db.query(SupplierItem).filter(
            SupplierItem.company_id == item.company_id,
            SupplierItem.item_id == item.id,
            SupplierItem.is_active == True,  # noqa: E712
        ).order_by(
            SupplierItem.is_preferred.desc(),
            SupplierItem.updated_at.desc(),
        ).first()
    except Exception:
        mapped = None

    if mapped and mapped.supplier_id:
        return "DIRECT_VENDOR", mapped.supplier_id, "VENDOR_ITEM_MASTER"

    item_source = (item.supply_source or "CENTRAL_STORE").upper()
    if item_source == "DIRECT_VENDOR":
        supplier_id, vendor_source = resolve_default_item_vendor(db, item)
        return "DIRECT_VENDOR", supplier_id, vendor_source

    return "CENTRAL_STORE", None, "ITEM_MASTER_SUPPLY_SOURCE"

def list_generated_vendor_pos_for_request(
    request_id: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return ONLY the vendor POs created from this exact Purchase Request.

    Matching is intentionally strict: participating_request_ids OR the exact
    auto-generated note containing this request number, plus at least one
    Direct Vendor line from the request. This prevents old/unrelated POs from
    leaking into the request history.
    """
    req = db.query(PurchaseRequest).filter(PurchaseRequest.id == request_id).first()
    if not req:
        raise NotFoundException(f"Purchase Request '{request_id}' not found.")
    check_user_outlet_access(current_user, req.branch_id, db)

    direct_request_items = [
        item for item in req.items
        if str((item.supply_source or "CENTRAL_STORE")).upper() == "DIRECT_VENDOR"
    ]
    if not direct_request_items:
        return []

    direct_item_ids = {str(item.item_id) for item in direct_request_items}
    request_number = str(req.request_number)
    matched: List[PurchaseOrder] = []

    pos = db.query(PurchaseOrder).order_by(desc(PurchaseOrder.created_at)).all()
    for po in pos:
        # Generated vendor POs are shown here even if an older lifecycle left
        # them DRAFT/PENDING_APPROVAL/ORDERED. They will be normalized to
        # APPROVED below once we prove they belong to this exact PR.
        if po.status not in [
            POStatus.DRAFT, POStatus.PENDING_APPROVAL,
            POStatus.APPROVED, POStatus.WHATSAPP_OPENED, POStatus.SENT_MANUALLY,
            POStatus.ISSUED, POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED,
        ]:
            continue

        try:
            allocation = json.loads(po.allocations) if po.allocations else {}
            if not isinstance(allocation, dict):
                allocation = {}
        except Exception:
            allocation = {}

        # Support both the current allocation key and legacy variants used by
        # older generated POs. The exact request number in notes is also a
        # strong linkage signal.
        participating = set()
        for key in ("participating_request_ids", "participating_requests", "request_ids"):
            values = allocation.get(key) or []
            if isinstance(values, (list, tuple, set)):
                participating.update(str(x) for x in values)
        exact_participation = str(req.id) in participating
        exact_request_note = request_number.lower() in str(po.notes or "").lower()

        # Verify the PO actually contains at least one Direct Vendor item from
        # this PR. Prefer exact allocation/note linkage; for legacy POs whose
        # allocation metadata was not persisted, use a conservative fallback:
        # same branch + same supplier + same direct item + created after the PR.
        po_item_ids = {str(line.item_id) for line in (po.items or [])}
        summary_items = allocation.get("items_summary") or []
        summary_item_ids = {
            str(x.get("item_id"))
            for x in summary_items
            if isinstance(x, dict) and x.get("item_id") is not None
        }
        item_match = bool((po_item_ids | summary_item_ids) & direct_item_ids)

        linked = exact_participation or exact_request_note
        if not linked:
            direct_supplier_ids = {str(item.supplier_id) for item in direct_request_items if item.supplier_id}
            same_supplier = str(po.supplier_id) in direct_supplier_ids
            same_branch = (po.branch_id is None or str(po.branch_id) == str(req.branch_id))
            created_after_pr = bool(po.created_at and req.created_at and po.created_at >= req.created_at)
            linked = same_supplier and same_branch and created_after_pr and item_match

        if not linked or not item_match:
            continue

        # A generated PO found through the exact PR linkage is downstream of
        # the already-approved Purchase Request. Normalize any legacy status so
        # the PR history can immediately send it through WhatsApp. Manual POs
        # cannot reach this branch because exact PR linkage is mandatory.
        if po.status in [POStatus.DRAFT, POStatus.PENDING_APPROVAL]:
            po.status = POStatus.APPROVED
            po.approved_by_id = current_user.id
            po.approved_at = po.approved_at or datetime.utcnow()
            po.updated_at = datetime.utcnow()
            db.add(po)

        matched.append(po)

    if matched:
        db.commit()
        for po in matched:
            db.refresh(po)

    # De-duplicate defensively and keep newest first.
    unique = {po.id: po for po in matched}
    ordered = sorted(unique.values(), key=lambda po: po.created_at or datetime.min, reverse=True)
    return [format_po_response(po, db) for po in ordered]

def list_central_store_queue(
    status_filter: Optional[str] = Query("REQUESTED"),
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Central Store fulfilment queue generated from approved outlet requirements."""
    query = db.query(StockTransfer).filter(
        StockTransfer.company_id == current_user.company_id,
        StockTransfer.from_warehouse_id.in_(
            db.query(Warehouse.id).filter(
                Warehouse.company_id == current_user.company_id,
                Warehouse.is_central == True,
                Warehouse.is_active == True,
            )
        ),
    )
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(StockTransfer.destination_branch_id == branch_id)
    if status_filter:
        query = query.filter(StockTransfer.status == status_filter)

    transfers = query.order_by(desc(StockTransfer.created_at)).all()
    result = []
    for transfer in transfers:
        destination = db.query(Branch).filter(Branch.id == transfer.destination_branch_id).first()
        source = db.query(Warehouse).filter(Warehouse.id == transfer.from_warehouse_id).first()
        items = []
        for ti in getattr(transfer, "items", []) or []:
            item = db.query(Item).filter(Item.id == ti.item_id).first()
            unit_symbol = None
            if item and getattr(item, "unit", None):
                unit_symbol = getattr(item.unit, "symbol", None)
            items.append({
                "id": ti.id,
                "item_id": ti.item_id,
                "item_name": item.name if item else "Unknown Item",
                "item_code": item.code if item else None,
                "requested_qty": float(ti.requested_qty or ti.quantity or 0),
                "quantity": float(ti.quantity or ti.requested_qty or 0),
                "dispatched_qty": float(getattr(ti, "dispatched_qty", 0) or 0),
                "accepted_qty": float(getattr(ti, "accepted_qty", 0) or 0),
                "unit": unit_symbol,
                "unit_cost": float(ti.unit_cost or 0),
                "amount": float((ti.unit_cost or 0) * (ti.quantity or ti.requested_qty or 0)),
            })
        result.append({
            "id": transfer.id,
            "transfer_number": transfer.transfer_number,
            "status": transfer.status.value if hasattr(transfer.status, "value") else str(transfer.status),
            "source_warehouse_id": transfer.from_warehouse_id,
            "source_warehouse_name": source.name if source else "Central Store",
            "destination_branch_id": transfer.destination_branch_id,
            "destination_branch_name": destination.name if destination else None,
            "source_branch_id": transfer.source_branch_id,
            "notes": transfer.notes,
            "created_at": transfer.created_at,
            "transfer_date": transfer.transfer_date,
            "items": items,
            "total_amount": sum(x["amount"] for x in items),
        })
    return result

def _central_store_user_allowed(current_user: User, db: Session) -> bool:
    raw_role = getattr(current_user, "role", None)
    role_name = getattr(raw_role, "name", raw_role) or ""
    role_name = str(role_name).strip().upper().replace("-", "_").replace(" ", "_")
    allowed_roles = {
        "SUPER_ADMIN", "SUPERADMIN", "OWNER", "ADMIN", "HQ_ADMIN",
        "HEAD_OFFICE_ADMIN", "CENTRAL_STORE_MANAGER",
    }
    return role_name in allowed_roles

def _resolve_transfer_for_company(db: Session, transfer_id: str, company_id: str) -> StockTransfer:
    transfer = (
        db.query(StockTransfer)
        .filter(StockTransfer.id == transfer_id, StockTransfer.company_id == company_id)
        .first()
    )
    if not transfer:
        raise NotFoundException(f"Stock Transfer '{transfer_id}' not found.")
    return transfer

def _apply_transfer_out_stock(
    db: Session,
    transfer: StockTransfer,
    current_user: User,
) -> None:
    """Atomically deduct the Central Store stock for the dispatched quantities."""
    for ti in getattr(transfer, "items", []) or []:
        qty = Decimal(str(getattr(ti, "dispatched_qty", 0) or 0))
        if qty <= 0:
            continue

        sb = (
            db.query(StockBalance)
            .filter(
                StockBalance.warehouse_id == transfer.from_warehouse_id,
                StockBalance.item_id == ti.item_id,
            )
            .with_for_update()
            .first()
        )
        available = Decimal(str(sb.quantity if sb else 0))
        if available < qty:
            item = db.query(Item).filter(Item.id == ti.item_id).first()
            name = item.name if item else ti.item_id
            raise BadRequestException(
                f"Insufficient Central Store stock for {name}. Available: {available}, Dispatch: {qty}."
            )

        sb.quantity = available - qty
        sb.updated_at = datetime.utcnow()

        unit_cost = Decimal(str(ti.unit_cost or (getattr(item, "cost_price", 0) if 'item' in locals() else 0) or 0))
        ledger = StockLedger(
            company_id=transfer.company_id,
            branch_id=transfer.source_branch_id,
            warehouse_id=transfer.from_warehouse_id,
            item_id=ti.item_id,
            unit_id=getattr(item, "unit_id", None) if 'item' in locals() else None,
            movement_type="TRANSFER_OUT",
            change_qty=-qty,
            balance_qty=sb.quantity,
            unit_cost=unit_cost,
            total_cost=qty * unit_cost,
            reference_type="STOCK_TRANSFER_DISPATCH",
            reference_id=transfer.id,
            idempotency_key=f"{transfer.id}:{ti.id}:TRANSFER_OUT",
            notes=f"Central Store dispatch for {transfer.transfer_number}",
            created_by_id=current_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(ledger)

@router.post("/central-store/transfers/{transfer_id}/dispatch")
def submit_central_store_dispatch(
    transfer_id: str = Path(...),
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Central Store submits the actual dispatch quantities for Admin approval.
    Stock is NOT reduced yet. The transfer becomes PENDING_APPROVAL.

    Payload:
    {"items": [{"transfer_item_id": "...", "dispatch_qty": 10}], "notes": "..."}
    """
    if not _central_store_user_allowed(current_user, db):
        raise ForbiddenException("Only Central Store or authorized Admin users can submit dispatches.")

    transfer = _resolve_transfer_for_company(db, transfer_id, current_user.company_id)
    if transfer.status not in {"REQUESTED", "APPROVED"}:
        raise BadRequestException(f"Transfer '{transfer.transfer_number}' cannot be dispatched from status '{transfer.status}'.")

    raw_items = payload.get("items") or []
    if not raw_items:
        raise BadRequestException("At least one dispatch item is required.")

    requested_map = {ti.id: ti for ti in (getattr(transfer, "items", []) or [])}
    seen = set()
    for row in raw_items:
        item_id = str(row.get("transfer_item_id") or row.get("id") or "").strip()
        if not item_id or item_id in seen:
            if not item_id:
                raise BadRequestException("transfer_item_id is required for every dispatch line.")
            raise BadRequestException(f"Duplicate dispatch line '{item_id}'.")
        seen.add(item_id)
        ti = requested_map.get(item_id)
        if not ti:
            raise BadRequestException(f"Transfer item '{item_id}' does not belong to this transfer.")

        dispatch_qty = Decimal(str(row.get("dispatch_qty") if row.get("dispatch_qty") is not None else 0))
        max_allowed = Decimal(str(ti.requested_qty or ti.quantity or 0))
        if dispatch_qty <= 0:
            raise BadRequestException(f"Dispatch quantity must be greater than zero for item '{item_id}'.")
        if dispatch_qty > max_allowed:
            raise BadRequestException(
                f"Dispatch quantity {dispatch_qty} exceeds requested quantity {max_allowed} for item '{item_id}'."
            )
        ti.dispatched_qty = dispatch_qty

    # Any transfer line omitted from the payload is not dispatched.
    for ti in requested_map.values():
        if ti.id not in seen:
            ti.dispatched_qty = Decimal("0.0000")

    transfer.dispatch_notes = payload.get("notes") or transfer.dispatch_notes
    # StockTransfer uses PENDING for the dispatch-awaiting-admin-approval state.
    transfer.status = "PENDING"
    transfer.updated_at = datetime.utcnow()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="SUBMIT_CENTRAL_STORE_DISPATCH_FOR_APPROVAL",
        entity_type="StockTransfer",
        entity_id=transfer.id,
        company_id=transfer.company_id,
        branch_id=transfer.destination_branch_id,
        new_values={
            "status": "PENDING_APPROVAL",
            "transfer_number": transfer.transfer_number,
            "dispatch_items": [
                {"transfer_item_id": ti.id, "dispatch_qty": float(ti.dispatched_qty or 0)}
                for ti in transfer.items
                if Decimal(str(ti.dispatched_qty or 0)) > 0
            ],
        },
    )
    db.commit()
    db.refresh(transfer)
    return {
        "success": True,
        "message": "Dispatch submitted to Admin for approval.",
        "transfer_id": transfer.id,
        "transfer_number": transfer.transfer_number,
        "status": transfer.status,
    }

@router.post("/central-store/transfers/{transfer_id}/approve-dispatch")
def approve_central_store_dispatch(
    transfer_id: str = Path(...),
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Admin approval: deduct Central Store stock and release the transfer to the outlet as IN_TRANSIT."""
    require_head_office_role(current_user, db)
    transfer = _resolve_transfer_for_company(db, transfer_id, current_user.company_id)
    if transfer.status != "PENDING":
        raise BadRequestException(f"Transfer '{transfer.transfer_number}' is not pending dispatch approval.")

    dispatched_lines = [ti for ti in transfer.items if Decimal(str(ti.dispatched_qty or 0)) > 0]
    if not dispatched_lines:
        raise BadRequestException("No dispatch quantity has been entered for this transfer.")

    # This helper validates stock and writes TRANSFER_OUT ledger movements.
    _apply_transfer_out_stock(db, transfer, current_user)

    transfer.status = "IN_TRANSIT"
    transfer.approved_by_id = current_user.id
    transfer.approved_at = datetime.utcnow()
    transfer.dispatched_by_id = transfer.dispatched_by_id or current_user.id
    transfer.dispatched_at = datetime.utcnow()
    if payload and payload.get("notes"):
        transfer.dispatch_notes = ((transfer.dispatch_notes or "") + f" [Admin Approval: {payload['notes']}]").strip()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="APPROVE_CENTRAL_STORE_DISPATCH",
        entity_type="StockTransfer",
        entity_id=transfer.id,
        company_id=transfer.company_id,
        branch_id=transfer.destination_branch_id,
        new_values={
            "status": "IN_TRANSIT",
            "approved_by": current_user.email,
            "dispatched_items": [
                {"transfer_item_id": ti.id, "dispatch_qty": float(ti.dispatched_qty or 0)}
                for ti in dispatched_lines
            ],
        },
    )
    db.commit()
    return {
        "success": True,
        "message": "Dispatch approved. Transfer is now visible to the outlet for receiving.",
        "transfer_id": transfer.id,
        "transfer_number": transfer.transfer_number,
        "status": transfer.status,
    }

def list_central_store_receiving(
    branch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Outlet receiving queue: only Admin-approved IN_TRANSIT Central Store transfers."""
    query = db.query(StockTransfer).filter(
        StockTransfer.company_id == current_user.company_id,
        StockTransfer.status == "IN_TRANSIT",
    )
    target_branch_id = branch_id or getattr(getattr(current_user, "branch", None), "id", None)
    if branch_id:
        check_user_outlet_access(current_user, branch_id, db)
        query = query.filter(StockTransfer.destination_branch_id == branch_id)
    else:
        # For a scoped outlet user, infer from UserBranch memberships when exactly one is present.
        memberships = db.query(UserBranch).filter(UserBranch.user_id == current_user.id).all()
        if len(memberships) == 1:
            target_branch_id = memberships[0].branch_id
            query = query.filter(StockTransfer.destination_branch_id == target_branch_id)
        elif not memberships and current_user.role and getattr(current_user.role, "name", "").upper() not in HQ_APPROVER_ROLES:
            return []

    transfers = query.order_by(desc(StockTransfer.created_at)).all()
    result = []
    for transfer in transfers:
        destination = db.query(Branch).filter(Branch.id == transfer.destination_branch_id).first()
        source = db.query(Warehouse).filter(Warehouse.id == transfer.from_warehouse_id).first()
        items = []
        for ti in transfer.items:
            item = db.query(Item).filter(Item.id == ti.item_id).first()
            items.append({
                "transfer_item_id": ti.id,
                "item_id": ti.item_id,
                "item_name": item.name if item else "Unknown Item",
                "item_code": item.code if item else None,
                "unit": item.unit.symbol if item and getattr(item, "unit", None) else "UNIT",
                "dispatch_qty": float(ti.dispatched_qty or 0),
                "received_qty": float(ti.accepted_qty or 0),
                "unit_cost": float(ti.unit_cost or 0),
                "amount": float((ti.unit_cost or 0) * (ti.dispatched_qty or 0)),
            })
        result.append({
            "id": transfer.id,
            "transfer_number": transfer.transfer_number,
            "status": transfer.status,
            "source_warehouse_name": source.name if source else "Central Store",
            "destination_branch_id": transfer.destination_branch_id,
            "destination_branch_name": destination.name if destination else None,
            "transfer_date": transfer.transfer_date,
            "items": items,
            "total_amount": sum(row["amount"] for row in items),
        })
    return result

def receive_central_store_transfer(
    transfer_id: str = Path(...),
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Outlet receives an Admin-approved Central Store transfer and stock is increased only here."""
    transfer = _resolve_transfer_for_company(db, transfer_id, current_user.company_id)
    if transfer.status != "IN_TRANSIT":
        raise BadRequestException(f"Transfer '{transfer.transfer_number}' is not ready for receiving.")

    check_user_outlet_access(current_user, transfer.destination_branch_id, db)

    raw_items = payload.get("items") or []
    if not raw_items:
        # Default to full receipt of all dispatched quantities.
        raw_items = [
            {"transfer_item_id": ti.id, "received_qty": float(ti.dispatched_qty or 0)}
            for ti in transfer.items if Decimal(str(ti.dispatched_qty or 0)) > 0
        ]

    receive_map = {str(row.get("transfer_item_id") or row.get("id")): Decimal(str(row.get("received_qty") or 0)) for row in raw_items}
    for ti in transfer.items:
        received_qty = receive_map.get(ti.id, Decimal("0.0000"))
        dispatched_qty = Decimal(str(ti.dispatched_qty or 0))
        if received_qty < 0 or received_qty > dispatched_qty:
            raise BadRequestException(
                f"Received quantity must be between 0 and dispatched quantity for transfer item '{ti.id}'."
            )

        if received_qty <= 0:
            continue

        sb = (
            db.query(StockBalance)
            .filter(
                StockBalance.warehouse_id == transfer.to_warehouse_id,
                StockBalance.item_id == ti.item_id,
            )
            .with_for_update()
            .first()
        )
        if sb:
            sb.quantity = (sb.quantity or Decimal("0")) + received_qty
            sb.updated_at = datetime.utcnow()
        else:
            sb = StockBalance(
                warehouse_id=transfer.to_warehouse_id,
                item_id=ti.item_id,
                quantity=received_qty,
                min_stock_level=Decimal("0.0000"),
                reorder_qty=Decimal("0.0000"),
                updated_at=datetime.utcnow(),
            )
            db.add(sb)
            db.flush()

        item = db.query(Item).filter(Item.id == ti.item_id).first()
        unit_cost = Decimal(str(ti.unit_cost or (getattr(item, "cost_price", 0) if item else 0) or 0))
        db.add(StockLedger(
            company_id=transfer.company_id,
            branch_id=transfer.destination_branch_id,
            warehouse_id=transfer.to_warehouse_id,
            item_id=ti.item_id,
            unit_id=getattr(item, "unit_id", None) if item else None,
            movement_type="TRANSFER_IN",
            change_qty=received_qty,
            balance_qty=sb.quantity,
            unit_cost=unit_cost,
            total_cost=received_qty * unit_cost,
            reference_type="STOCK_TRANSFER_RECEIVE",
            reference_id=transfer.id,
            idempotency_key=f"{transfer.id}:{ti.id}:TRANSFER_IN",
            notes=f"Outlet receiving for {transfer.transfer_number}",
            created_by_id=current_user.id,
            created_at=datetime.utcnow(),
        ))
        ti.accepted_qty = received_qty

    transfer.status = "FULLY_RECEIVED"
    transfer.received_by_id = current_user.id
    transfer.received_at = datetime.utcnow()
    transfer.reconciled_at = datetime.utcnow()

    log_procurement_audit(
        db=db,
        user=current_user,
        action="RECEIVE_CENTRAL_STORE_TRANSFER",
        entity_type="StockTransfer",
        entity_id=transfer.id,
        company_id=transfer.company_id,
        branch_id=transfer.destination_branch_id,
        new_values={
            "status": "FULLY_RECEIVED",
            "received_items": [
                {"transfer_item_id": ti.id, "received_qty": float(ti.accepted_qty or 0)}
                for ti in transfer.items
            ],
        },
    )
    db.commit()
    return {
        "success": True,
        "message": "Transfer received successfully. Outlet stock has been updated.",
        "transfer_id": transfer.id,
        "transfer_number": transfer.transfer_number,
        "status": transfer.status,
    }

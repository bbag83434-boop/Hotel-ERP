import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from app.models.user import User
from app.models.billing import VendorBill, VendorBillItem, VendorBillGRNLink, Payment, BillStatus
from app.models.procurement import Supplier, GoodsReceiveNote
from app.models.audit import AuditLog
from app.services.billing import BillingService

router = APIRouter()

class BillLineCreate(BaseModel):
    item_id: str
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    # Supplier-provided amounts are checked, never stored as authoritative values.
    line_total: Optional[Decimal] = Field(default=None, ge=0)

class BillCreate(BaseModel):
    supplier_id: str
    invoice_number: str = Field(..., min_length=1, max_length=100)
    invoice_date: datetime
    due_date: Optional[datetime] = None
    tax_amount: Decimal = Field(default=Decimal('0'), ge=0)
    invoice_total: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None
    grn_ids: List[str] = Field(default_factory=list)
    items: List[BillLineCreate] = Field(..., min_length=1)

class PaymentCreate(BaseModel):
    supplier_id: str
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., min_length=1, max_length=50)
    reference_number: Optional[str] = Field(default=None, max_length=100)
    bill_id: Optional[str] = None
    payment_date: Optional[datetime] = None
    notes: Optional[str] = None


def _company_filter(query, user):
    if user.company_id:
        return query.filter(Supplier.company_id == user.company_id)
    return query


def _audit_bill(db: Session, user: User, action: str, bill: VendorBill, old_status, new_status, details=None):
    """Keep bill workflow decisions in the same immutable audit log used by procurement."""
    db.add(AuditLog(
        user_id=user.id,
        action=action,
        entity_type="VendorBill",
        entity_id=bill.id,
        details=json.dumps({
            "old_values": {"status": old_status},
            "new_values": {"status": new_status, "details": details or {}},
        }, default=str),
    ))


def _audit_payment(db: Session, user: User, payment: Payment, bill: VendorBill, old_status, new_status):
    db.add(AuditLog(
        user_id=user.id,
        action="CREATE_VENDOR_BILL_PAYMENT",
        entity_type="Payment",
        entity_id=payment.id,
        details=json.dumps({
            "bill_id": bill.id,
            "supplier_id": bill.supplier_id,
            "amount": str(payment.amount),
            "old_values": {"bill_status": old_status},
            "new_values": {"bill_status": new_status, "payment_status": payment.status},
        }, default=str),
    ))


@router.get('/bills')
def list_bills(
    supplier_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(VendorBill, Supplier).join(Supplier, Supplier.id == VendorBill.supplier_id)
    if current_user.company_id:
        q = q.filter(VendorBill.company_id == current_user.company_id)
    if supplier_id:
        q = q.filter(VendorBill.supplier_id == supplier_id)
    if status_filter and status_filter != 'ALL':
        q = q.filter(VendorBill.status == status_filter)
    rows = []
    for bill, supplier in q.order_by(VendorBill.created_at.desc()).all():
        paid = db.query(Payment).filter(Payment.supplier_id == bill.supplier_id, Payment.status.in_(['POSTED', 'PAID'])).all()
        # Payments are allocated to bills when bill_id is available; legacy/unallocated payments stay supplier-level.
        allocated = Decimal('0')
        for p in paid:
            if getattr(p, 'bill_id', None) == bill.id:
                allocated += Decimal(str(p.amount))
        rows.append({
            'id': bill.id, 'supplier_id': bill.supplier_id, 'supplier_name': supplier.name,
            'invoice_number': bill.invoice_number, 'invoice_date': bill.invoice_date,
            'due_date': bill.due_date, 'status': bill.status.value if hasattr(bill.status, 'value') else bill.status,
            'total_amount': float(bill.total_amount), 'tax_amount': float(bill.tax_amount),
            'net_amount': float(bill.net_amount), 'paid_amount': float(allocated),
            'balance': float(max(Decimal('0'), Decimal(str(bill.net_amount)) - allocated)),
            'notes': bill.notes, 'approved_by_id': bill.approved_by_id,
            'grn_ids': [x.grn_id for x in bill.grn_links],
        })
    return rows


@router.post('/bills', status_code=status.HTTP_201_CREATED)
def create_bill(
    payload: BillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission('procurement:create')),
):
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier or (current_user.company_id and supplier.company_id != current_user.company_id):
        raise NotFoundException('Supplier not found')
    duplicate = db.query(VendorBill).filter(
        VendorBill.company_id == supplier.company_id,
        VendorBill.supplier_id == supplier.id,
        VendorBill.invoice_number == payload.invoice_number,
    ).first()
    if duplicate:
        raise BadRequestException('A bill with this invoice number already exists for this supplier.')
    total = sum((line.quantity * line.unit_price for line in payload.items), Decimal('0'))
    for line in payload.items:
        calculated_line_total = line.quantity * line.unit_price
        if line.line_total is not None and abs(line.line_total - calculated_line_total) > Decimal('0.01'):
            raise BadRequestException('Invoice line amount must equal quantity multiplied by unit price.')
    net = total + payload.tax_amount
    if payload.invoice_total is not None and abs(payload.invoice_total - net) > Decimal('0.01'):
        raise BadRequestException('Invoice total does not equal the sum of invoice lines plus tax.')
    bill = VendorBill(company_id=supplier.company_id, supplier_id=supplier.id, invoice_number=payload.invoice_number,
                      invoice_date=payload.invoice_date, due_date=payload.due_date, total_amount=total,
                      tax_amount=payload.tax_amount, net_amount=net, notes=payload.notes, status=BillStatus.DRAFT)
    db.add(bill); db.flush()
    for line in payload.items:
        db.add(VendorBillItem(bill_id=bill.id, item_id=line.item_id, quantity=line.quantity,
                              unit_price=line.unit_price, total_price=line.quantity * line.unit_price))
    linked_po_id = None
    seen_grn_ids = set()
    for grn_id in payload.grn_ids:
        if grn_id in seen_grn_ids:
            raise BadRequestException('The same GRN cannot be linked to a bill more than once.')
        seen_grn_ids.add(grn_id)
        grn = db.query(GoodsReceiveNote).filter(GoodsReceiveNote.id == grn_id).first()
        if not grn:
            raise NotFoundException(f'GRN not found: {grn_id}')
        if str(grn.supplier_id) != str(supplier.id):
            raise BadRequestException('Bill GRNs must belong to the selected supplier.')
        if grn.company_id != supplier.company_id:
            raise BadRequestException('Bill GRNs must belong to the selected company.')
        if not grn.po_id:
            raise BadRequestException('Bill GRNs must be linked to a purchase order.')
        if linked_po_id and grn.po_id != linked_po_id:
            raise BadRequestException('All GRNs on a bill must belong to the same purchase order.')
        linked_po_id = grn.po_id
        existing_link = db.query(VendorBillGRNLink).filter(VendorBillGRNLink.grn_id == grn.id).first()
        if existing_link:
            raise BadRequestException('A GRN may be counted on only one vendor bill.')
        db.add(VendorBillGRNLink(bill_id=bill.id, grn_id=grn.id))
    _audit_bill(db, current_user, 'CREATE_VENDOR_BILL', bill, None, BillStatus.DRAFT.value, {"invoice_number": bill.invoice_number, "grn_ids": payload.grn_ids})
    db.commit(); db.refresh(bill)
    return {'id': bill.id, 'invoice_number': bill.invoice_number, 'status': bill.status.value, 'net_amount': float(bill.net_amount)}


@router.post('/bills/{bill_id}/verify')
def verify_bill(bill_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_permission('procurement:create'))):
    bill = db.query(VendorBill).filter(VendorBill.id == bill_id).first()
    if not bill: raise NotFoundException('Bill not found')
    if current_user.company_id and bill.company_id != current_user.company_id: raise ForbiddenException('Access denied')
    old_status = bill.status.value if hasattr(bill.status, 'value') else bill.status
    result = BillingService(db).perform_three_way_match(bill_id)
    if not result.matched:
        _audit_bill(db, current_user, 'VENDOR_BILL_VARIANCE', bill, old_status, old_status, result.as_dict())
        db.commit()
        raise BadRequestException(f'3-Way match failed: {json.dumps(result.as_dict(), default=str)}')
    db.refresh(bill)
    _audit_bill(db, current_user, 'VERIFY_VENDOR_BILL', bill, old_status, bill.status.value, result.as_dict())
    db.commit()
    return {'id': bill.id, 'status': bill.status.value, 'three_way_match': result.as_dict()}


@router.post('/bills/{bill_id}/approve')
def approve_bill(bill_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_permission('procurement:create'))):
    bill = db.query(VendorBill).filter(VendorBill.id == bill_id).first()
    if not bill: raise NotFoundException('Bill not found')
    if current_user.company_id and bill.company_id != current_user.company_id: raise ForbiddenException('Access denied')
    old_status = bill.status.value if hasattr(bill.status, 'value') else bill.status
    BillingService(db).approve_bill(bill_id, current_user.id)
    db.refresh(bill)
    _audit_bill(db, current_user, 'APPROVE_VENDOR_BILL', bill, old_status, bill.status.value)
    db.commit()
    return {'id': bill.id, 'status': bill.status.value}


@router.get('/payments')
def list_payments(supplier_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    q = db.query(Payment, Supplier).join(Supplier, Supplier.id == Payment.supplier_id)
    if current_user.company_id: q = q.filter(Payment.company_id == current_user.company_id)
    if supplier_id: q = q.filter(Payment.supplier_id == supplier_id)
    return [{
        'id': p.id, 'supplier_id': p.supplier_id, 'supplier_name': s.name, 'amount': float(p.amount),
        'payment_date': p.payment_date, 'payment_method': p.payment_method, 'reference_number': p.reference_number,
        'status': p.status, 'bill_id': getattr(p, 'bill_id', None), 'notes': p.notes
    } for p, s in q.order_by(Payment.payment_date.desc()).limit(500).all()]


@router.post('/payments', status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_permission('procurement:update'))):
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier or (current_user.company_id and supplier.company_id != current_user.company_id): raise NotFoundException('Supplier not found')
    if not payload.bill_id:
        raise BadRequestException('A vendor-bill payment must reference an approved vendor bill.')
    bill = db.query(VendorBill).filter(
        VendorBill.id == payload.bill_id,
        VendorBill.supplier_id == supplier.id,
        VendorBill.company_id == supplier.company_id,
    ).first()
    if not bill: raise NotFoundException('Bill not found')
    # PARTIAL payments are part of the established allocation design.  The
    # authoritative bill total, not a client-side balance, controls the limit.
    if bill.status != BillStatus.APPROVED:
        raise BadRequestException('Only an approved bill can receive payment.')
    allocated = sum((Decimal(str(p.amount)) for p in db.query(Payment).filter(
        Payment.bill_id == bill.id,
        Payment.status.in_(['POSTED', 'PAID']),
    ).all()), Decimal('0'))
    remaining = Decimal(str(bill.net_amount)) - allocated
    if payload.amount > remaining:
        raise BadRequestException('Payment exceeds bill outstanding balance.')
    payment = Payment(company_id=supplier.company_id, supplier_id=supplier.id, amount=payload.amount,
                      payment_date=payload.payment_date or datetime.utcnow(), payment_method=payload.payment_method,
                      reference_number=payload.reference_number, status='POSTED', notes=payload.notes,
                      bill_id=bill.id)
    db.add(payment)
    # Payment, bill status, and audit entry commit together.  The existing
    # vendor ledger is derived from these same committed bill/payment records.
    old_status = bill.status.value if hasattr(bill.status, 'value') else bill.status
    db.flush()
    allocated += Decimal(str(payment.amount))
    if allocated >= Decimal(str(bill.net_amount)):
        bill.status = BillStatus.PAID
    new_status = bill.status.value if hasattr(bill.status, 'value') else bill.status
    _audit_payment(db, current_user, payment, bill, old_status, new_status)
    db.commit(); db.refresh(payment)
    return {'id': payment.id, 'status': payment.status, 'amount': float(payment.amount), 'bill_id': payload.bill_id}


@router.get('/vendor-ledger/{supplier_id}')
def vendor_ledger(supplier_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier or (current_user.company_id and supplier.company_id != current_user.company_id): raise NotFoundException('Supplier not found')
    bills = db.query(VendorBill).filter(
        VendorBill.supplier_id == supplier_id,
        VendorBill.company_id == supplier.company_id,
        VendorBill.status.in_([BillStatus.APPROVED, BillStatus.PAID]),
    ).order_by(VendorBill.invoice_date.asc()).all()
    bill_ids = {bill.id for bill in bills}
    payments = db.query(Payment).filter(
        Payment.supplier_id == supplier_id,
        Payment.company_id == supplier.company_id,
        Payment.status.in_(['POSTED', 'PAID']),
        Payment.bill_id.in_(bill_ids) if bill_ids else False,
    ).all()
    events = []
    for b in bills:
        events.append((b.invoice_date, b.created_at, 'INVOICE', b.id, b.invoice_number, Decimal(str(b.net_amount)), Decimal('0'), b.id))
    for p in payments:
        events.append((p.payment_date, p.created_at, 'PAYMENT', p.id, p.reference_number or p.payment_method, Decimal('0'), Decimal(str(p.amount)), p.bill_id))
    events.sort(key=lambda x: (x[0], x[1]))
    balance = Decimal('0'); rows=[]
    for dt, _, typ, rid, ref, debit, credit, bill_id in events:
        balance += debit - credit
        rows.append({'id': rid, 'supplier_id': supplier_id, 'transaction_type': typ, 'debit': float(debit), 'credit': float(credit),
                     'balance': float(balance), 'reference': ref, 'bill_id': bill_id, 'created_at': dt})
    return {'supplier_id': supplier_id, 'supplier_name': supplier.name, 'closing_balance': float(balance), 'entries': rows}

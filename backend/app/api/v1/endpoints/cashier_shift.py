from datetime import datetime
from decimal import Decimal
from typing import Optional
import secrets
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.auth import get_current_active_user
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.user import User
from app.models.organization import Branch
from app.models.cashier import CashSession, CashMovement, CashSessionStatus, CashMovementType
from app.models.restaurant import RestaurantOrder
from app.models.audit import AuditLog

router = APIRouter()

def branch_access(db, user, branch_id):
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == user.company_id, Branch.is_active.is_(True)).first()
    if not branch: raise NotFoundException('Outlet not found')
    role = (user.role.name if user.role else '').upper()
    if role in {'SUPER_ADMIN','OWNER','HQ_ADMIN','ADMIN','HEAD_OFFICE_ADMIN'}: return branch
    if branch_id not in {b.branch_id for b in user.branches}: raise ForbiddenException('Access denied for this outlet')
    return branch

def money(v): return Decimal(str(v or 0)).quantize(Decimal('0.01'))

def metrics(db, s):
    moves = db.query(CashMovement).filter(CashMovement.session_id == s.id).all()
    cash_sales = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.CASH_SALE.value), Decimal('0'))
    upi_sales = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.UPI_SALE.value), Decimal('0'))
    card_sales = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.CARD_SALE.value), Decimal('0'))
    cash_in = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.CASH_IN.value), Decimal('0'))
    cash_out = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.CASH_OUT.value), Decimal('0'))
    drops = sum((money(m.amount) for m in moves if m.movement_type == CashMovementType.CLOSING_DROP.value), Decimal('0'))
    expected = money(s.opening_float) + cash_sales + cash_in - cash_out - drops
    orders = db.query(CashMovement.order_id).filter(CashMovement.session_id == s.id, CashMovement.order_id.isnot(None)).distinct().count()
    return {'cashSales': float(cash_sales), 'upiSales': float(upi_sales), 'cardSales': float(card_sales), 'cashIn': float(cash_in), 'cashOut': float(cash_out), 'safeDrops': float(drops), 'expectedDrawerCash': float(expected), 'ordersCount': orders}

def serialize(db, s, include_movements=True):
    m = metrics(db, s)
    return {'id':s.id,'sessionNumber':s.session_number,'status':s.status,'companyId':s.company_id,'branchId':s.branch_id,'cashierId':s.cashier_id,'openingFloat':float(s.opening_float or 0),'openedAt':s.opened_at,'closedAt':s.closed_at,'closingCash':float(s.closing_cash) if s.closing_cash is not None else None,'expectedCash':float(s.expected_cash) if s.expected_cash is not None else m['expectedDrawerCash'],'cashVariance':float(s.cash_variance) if s.cash_variance is not None else None,'totalCashSales':m['cashSales'],'totalUpiSales':m['upiSales'],'totalCardSales':m['cardSales'],'notes':s.notes,'varianceReason':s.variance_reason,'reconciledById':s.reconciled_by_id,'reconciledAt':s.reconciled_at,'reconciliationNotes':s.reconciliation_notes,'liveMetrics':m,'movements':[{'id':x.id,'movementType':x.movement_type,'amount':float(x.amount),'reason':x.reason,'orderId':x.order_id,'createdAt':x.created_at,'createdById':x.created_by_id} for x in s.movements] if include_movements else []}

class OpenPayload(BaseModel):
    branch_id: str
    opening_float: Decimal = Field(default=Decimal('0'), ge=0)
    notes: Optional[str] = Field(None, max_length=500)
class MovementPayload(BaseModel):
    movement_type: str = Field(..., pattern='^(CASH_IN|CASH_OUT|CLOSING_DROP)$')
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., min_length=2, max_length=500)
class ClosePayload(BaseModel):
    closing_cash: Decimal = Field(..., ge=0)
    notes: Optional[str] = Field(None, max_length=500)
    variance_reason: Optional[str] = Field(None, max_length=1000)
class ReconcilePayload(BaseModel):
    notes: str = Field(..., min_length=2, max_length=1000)

@router.get('/active')
def active(branch_id: Optional[str]=None, db:Session=Depends(get_db), u:User=Depends(get_current_active_user)):
    if branch_id: branch_access(db,u,branch_id)
    else: branch_id=next((b.branch_id for b in u.branches if b.is_default), None)
    q=db.query(CashSession).filter(CashSession.company_id==u.company_id,CashSession.cashier_id==u.id,CashSession.status==CashSessionStatus.OPEN.value)
    if branch_id:q=q.filter(CashSession.branch_id==branch_id)
    s=q.order_by(CashSession.opened_at.desc()).first()
    return serialize(db,s) if s else None

@router.post('/open', status_code=201)
def open_shift(p:OpenPayload, db:Session=Depends(get_db), u:User=Depends(get_current_active_user)):
    branch_access(db,u,p.branch_id)
    if db.query(CashSession).filter(CashSession.company_id==u.company_id,CashSession.branch_id==p.branch_id,CashSession.cashier_id==u.id,CashSession.status==CashSessionStatus.OPEN.value).first(): raise BadRequestException('An open cashier shift already exists for this cashier and outlet.')
    now=datetime.utcnow(); n=f'CS-{now.strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(2).upper()}'
    s=CashSession(company_id=u.company_id,branch_id=p.branch_id,cashier_id=u.id,session_number=n,status=CashSessionStatus.OPEN.value,opening_float=p.opening_float,opened_at=now,notes=p.notes)
    db.add(s);db.flush();db.add(CashMovement(company_id=u.company_id,session_id=s.id,branch_id=p.branch_id,created_by_id=u.id,movement_type=CashMovementType.FLOAT_START.value,amount=p.opening_float,reason=p.notes or 'Opening cash float'))
    db.add(AuditLog(user_id=u.id,action='CASH_SHIFT_OPEN',entity_type='CashSession',entity_id=s.id,details=f'session={n};openingFloat={p.opening_float}'))
    db.commit();db.refresh(s);return serialize(db,s)

@router.post('/{session_id}/movement', status_code=201)
def movement(session_id:str,p:MovementPayload,db:Session=Depends(get_db),u:User=Depends(get_current_active_user)):
    s=db.query(CashSession).filter(CashSession.id==session_id,CashSession.company_id==u.company_id).first()
    if not s: raise NotFoundException('Cashier shift not found')
    branch_access(db,u,s.branch_id)
    if s.status!='OPEN': raise BadRequestException('Only an open shift can receive cash movements.')
    if p.movement_type in {'CASH_OUT','CLOSING_DROP'} and money(p.amount)>money(metrics(db,s)['expectedDrawerCash']): raise BadRequestException('Movement exceeds expected drawer cash.')
    m=CashMovement(company_id=u.company_id,session_id=s.id,branch_id=s.branch_id,created_by_id=u.id,movement_type=p.movement_type,amount=p.amount,reason=p.reason)
    db.add(m);db.add(AuditLog(user_id=u.id,action='CASH_MOVEMENT',entity_type='CashSession',entity_id=s.id,details=f'type={p.movement_type};amount={p.amount}'))
    db.commit();db.refresh(s);return serialize(db,s)

@router.post('/{session_id}/close')
def close(session_id:str,p:ClosePayload,db:Session=Depends(get_db),u:User=Depends(get_current_active_user)):
    s=db.query(CashSession).filter(CashSession.id==session_id,CashSession.company_id==u.company_id).first()
    if not s: raise NotFoundException('Cashier shift not found')
    branch_access(db,u,s.branch_id)
    if s.status!='OPEN': raise BadRequestException('Only an open shift can be closed.')
    pending_orders = db.query(RestaurantOrder.id).filter(
        RestaurantOrder.company_id == u.company_id,
        RestaurantOrder.branch_id == s.branch_id,
        RestaurantOrder.status.in_(['OPEN','SENT_TO_KITCHEN','IN_PREPARATION','READY','SERVED']),
        db.query(CashMovement.id).filter(
            CashMovement.session_id == s.id,
            CashMovement.order_id == RestaurantOrder.id,
        ).exists(),
    ).count()
    if pending_orders:
        raise BadRequestException(f'Cannot close shift while {pending_orders} linked order(s) remain open or pending.')
    # Also block outlet-wide open orders, because they can still create unaccounted cash after close.
    outlet_pending = db.query(RestaurantOrder.id).filter(
        RestaurantOrder.company_id == u.company_id,
        RestaurantOrder.branch_id == s.branch_id,
        RestaurantOrder.status.in_(['OPEN','SENT_TO_KITCHEN','IN_PREPARATION','READY','SERVED']),
    ).count()
    if outlet_pending:
        raise BadRequestException(f'Cannot close shift while {outlet_pending} outlet order(s) remain open or pending.')
    expected=money(metrics(db,s)['expectedDrawerCash']); variance=money(p.closing_cash)-expected
    s.status=CashSessionStatus.CLOSED.value;s.closed_at=datetime.utcnow();s.expected_cash=expected;s.closing_cash=p.closing_cash;s.cash_variance=variance;s.notes=p.notes or s.notes;s.variance_reason=p.variance_reason
    db.add(AuditLog(user_id=u.id,action='CASH_SHIFT_CLOSE',entity_type='CashSession',entity_id=s.id,details=f'expected={expected};counted={p.closing_cash};variance={variance}'))
    db.commit();db.refresh(s);return serialize(db,s)

@router.post('/{session_id}/reconcile')
def reconcile(session_id:str,p:ReconcilePayload,db:Session=Depends(get_db),u:User=Depends(get_current_active_user)):
    s=db.query(CashSession).filter(CashSession.id==session_id,CashSession.company_id==u.company_id).first()
    if not s: raise NotFoundException('Cashier shift not found')
    branch_access(db,u,s.branch_id)
    role=(u.role.name if u.role else '').upper()
    if role not in {'SUPER_ADMIN','OWNER','HQ_ADMIN','ADMIN','HEAD_OFFICE_ADMIN','MANAGER','SHIFT_SUPERVISOR'} and s.cashier_id==u.id: raise ForbiddenException('Manager-level reconciliation permission required.')
    if s.status!='CLOSED': raise BadRequestException('Only a closed shift can be reconciled.')
    s.status=CashSessionStatus.RECONCILED.value;s.reconciled_by_id=u.id;s.reconciled_at=datetime.utcnow();s.reconciliation_notes=p.notes
    db.add(AuditLog(user_id=u.id,action='CASH_SHIFT_RECONCILE',entity_type='CashSession',entity_id=s.id,details=p.notes))
    db.commit();db.refresh(s);return serialize(db,s)

@router.get('/history')
def history(branch_id:Optional[str]=None,status_filter:Optional[str]=Query(None,alias='status'),limit:int=Query(100,ge=1,le=500),db:Session=Depends(get_db),u:User=Depends(get_current_active_user)):
    if branch_id:branch_access(db,u,branch_id)
    q=db.query(CashSession).options(joinedload(CashSession.movements)).filter(CashSession.company_id==u.company_id)
    if branch_id:q=q.filter(CashSession.branch_id==branch_id)
    if status_filter:q=q.filter(CashSession.status==status_filter)
    role=(u.role.name if u.role else '').upper()
    if role not in {'SUPER_ADMIN','OWNER','HQ_ADMIN','ADMIN','HEAD_OFFICE_ADMIN'}:q=q.filter(CashSession.cashier_id==u.id)
    return [serialize(db,s) for s in q.order_by(CashSession.opened_at.desc()).limit(limit).all()]

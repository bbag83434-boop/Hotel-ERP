from datetime import datetime
import uuid
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_outlet_scope
from app.models.user import User
from app.models.customer import Customer, CustomerType, LoyaltyTransaction, LoyaltyTransactionType
from app.models.restaurant import RestaurantOrder
from app.models.customer_support import Complaint, ComplaintSeverity, ComplaintStatus
from app.schemas.customer_support import CustomerCreate, CustomerUpdate, CustomerResponse, LoyaltyAdjust, ComplaintCreate, ComplaintUpdate, ComplaintResponse

router = APIRouter()

def _customer_response(c):
    return CustomerResponse.model_validate(c)

def _complaint_response(c):
    return ComplaintResponse.model_validate(c)

@router.get('/customers', response_model=List[CustomerResponse])
def list_customers(q: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(Customer).filter(Customer.company_id == current_user.company_id)
    if q:
        like = f'%{q.strip()}%'
        query = query.filter(or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.email.ilike(like)))
    return query.order_by(Customer.updated_at.desc()).limit(200).all()

@router.post('/customers', response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    phone = payload.phone.strip()
    existing = db.query(Customer).filter(Customer.company_id == current_user.company_id, Customer.phone == phone).first()
    if existing:
        raise HTTPException(409, 'Customer with this phone already exists')
    try:
        ctype = CustomerType(payload.customer_type.upper())
    except ValueError:
        raise HTTPException(422, 'Invalid customer type')
    customer = Customer(company_id=current_user.company_id, phone=phone, name=payload.name.strip(), email=payload.email, customer_type=ctype, notes=payload.notes)
    db.add(customer); db.commit(); db.refresh(customer)
    return customer

@router.put('/customers/{customer_id}', response_model=CustomerResponse)
def update_customer(customer_id: str, payload: CustomerUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.company_id == current_user.company_id).first()
    if not c: raise HTTPException(404, 'Customer not found')
    data = payload.model_dump(exclude_unset=True)
    if 'customer_type' in data and data['customer_type']:
        try: data['customer_type'] = CustomerType(data['customer_type'].upper())
        except ValueError: raise HTTPException(422, 'Invalid customer type')
    for k,v in data.items(): setattr(c,k,v)
    db.commit(); db.refresh(c); return c

@router.get('/customers/{customer_id}/orders')
def customer_orders(customer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.company_id == current_user.company_id).first()
    if not c: raise HTTPException(404, 'Customer not found')
    return db.query(RestaurantOrder).filter(RestaurantOrder.company_id == current_user.company_id, RestaurantOrder.customer_phone == c.phone).order_by(RestaurantOrder.created_at.desc()).limit(100).all()

@router.post('/customers/{customer_id}/loyalty', response_model=CustomerResponse)
def adjust_loyalty(customer_id: str, payload: LoyaltyAdjust, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.company_id == current_user.company_id).first()
    if not c: raise HTTPException(404, 'Customer not found')
    new_balance = int(c.loyalty_points or 0) + payload.points
    if new_balance < 0: raise HTTPException(400, 'Insufficient loyalty points')
    tx_type = LoyaltyTransactionType.EARN if payload.points >= 0 else LoyaltyTransactionType.REDEEM
    tx = LoyaltyTransaction(company_id=current_user.company_id, customer_id=c.id, transaction_type=tx_type, points=payload.points, points_balance_after=new_balance, amount_equivalent=Decimal('0'), description=payload.description)
    c.loyalty_points = new_balance
    db.add(tx); db.commit(); db.refresh(c); return c

@router.get('/complaints', response_model=List[ComplaintResponse])
def list_complaints(status_filter: Optional[str] = Query(None, alias='status'), branch_id: str = Depends(require_outlet_scope), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    q = db.query(Complaint).filter(Complaint.company_id == current_user.company_id, Complaint.branch_id == branch_id)
    if status_filter:
        try: q = q.filter(Complaint.status == ComplaintStatus(status_filter.upper()))
        except ValueError: raise HTTPException(422, 'Invalid complaint status')
    return q.order_by(Complaint.created_at.desc()).limit(200).all()

@router.post('/complaints', response_model=ComplaintResponse, status_code=201)
def create_complaint(payload: ComplaintCreate, branch_id: str = Depends(require_outlet_scope), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if payload.customer_id and not db.query(Customer).filter(Customer.id == payload.customer_id, Customer.company_id == current_user.company_id).first(): raise HTTPException(404, 'Customer not found')
    try: sev = ComplaintSeverity(payload.severity.upper())
    except ValueError: raise HTTPException(422, 'Invalid severity')
    complaint_number = f'CMP-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}-{uuid.uuid4().hex[:6].upper()}'
    complaint = Complaint(company_id=current_user.company_id, branch_id=branch_id, complaint_number=complaint_number, customer_id=payload.customer_id, order_id=payload.order_id, category=payload.category.strip(), severity=sev, description=payload.description.strip(), assigned_to=payload.assigned_to)
    db.add(complaint); db.commit(); db.refresh(complaint); return complaint

@router.patch('/complaints/{complaint_id}', response_model=ComplaintResponse)
def update_complaint(complaint_id: str, payload: ComplaintUpdate, branch_id: str = Depends(require_outlet_scope), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    c = db.query(Complaint).filter(Complaint.id == complaint_id, Complaint.company_id == current_user.company_id, Complaint.branch_id == branch_id).first()
    if not c: raise HTTPException(404, 'Complaint not found')
    data = payload.model_dump(exclude_unset=True)
    if 'status' in data and data['status']:
        try: data['status'] = ComplaintStatus(data['status'].upper())
        except ValueError: raise HTTPException(422, 'Invalid complaint status')
        if data['status'] in [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]: c.resolved_at = datetime.utcnow()
    if 'compensation_amount' in data and data['compensation_amount'] is not None and data['compensation_amount'] < 0: raise HTTPException(422, 'Compensation cannot be negative')
    for k,v in data.items(): setattr(c,k,v)
    db.commit(); db.refresh(c); return c

@router.get('/complaints/stats')
def complaint_stats(branch_id: str = Depends(require_outlet_scope), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    rows = db.query(Complaint.status, func.count(Complaint.id)).filter(Complaint.company_id == current_user.company_id, Complaint.branch_id == branch_id).group_by(Complaint.status).all()
    counts = {str(s.value if hasattr(s,'value') else s): int(n) for s,n in rows}
    return {'open': counts.get('OPEN',0), 'in_progress': counts.get('IN_PROGRESS',0), 'resolved': counts.get('RESOLVED',0), 'closed': counts.get('CLOSED',0), 'total': sum(counts.values())}

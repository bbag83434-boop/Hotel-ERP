import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.models.user import User, Role, UserBranch
from app.models.organization import Branch
from app.models.maintenance import MaintenanceAsset, MaintenanceTicket, AssetStatus, MaintenanceStatus
from app.models.audit import AuditLog
from app.schemas.maintenance import AssetCreate, AssetResponse, TicketCreate, TicketUpdate, TicketResponse, MaintenanceSummary

router = APIRouter()

ADMIN_ROLES = {"ADMIN", "SUPER_ADMIN", "SUPERADMIN", "OWNER", "DIRECTOR", "HQ_ADMIN", "HEAD_OFFICE_ADMIN", "GENERAL_MANAGER", "AREA_MANAGER"}

def _admin(user: User) -> bool:
    return bool(user.role and user.role.name.upper() in ADMIN_ROLES)

def _branch_access(branch_id: str, user: User, db: Session) -> Branch:
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.company_id == user.company_id).first()
    if not branch:
        raise NotFoundException("Branch not found in company.")
    if not _admin(user):
        assigned = db.query(UserBranch).filter(UserBranch.user_id == user.id, UserBranch.branch_id == branch_id).first()
        if not assigned:
            raise ForbiddenException("Access denied for this outlet.")
    return branch

def _audit(db, user, action, entity, entity_id, details):
    db.add(AuditLog(id=str(uuid.uuid4()), user_id=user.id, action=action, entity=entity, entity_id=entity_id, details=details))

def _asset_response(asset, db):
    open_count = db.query(func.count(MaintenanceTicket.id)).filter(MaintenanceTicket.asset_id == asset.id, MaintenanceTicket.status.in_([MaintenanceStatus.OPEN.value, MaintenanceStatus.IN_PROGRESS.value, MaintenanceStatus.WAITING_PARTS.value])).scalar() or 0
    days = None
    if asset.warranty_expiry:
        days = (asset.warranty_expiry.date() - datetime.utcnow().date()).days
    return AssetResponse(id=asset.id, company_id=asset.company_id, branch_id=asset.branch_id, asset_code=asset.asset_code, name=asset.name, category=asset.category, location=asset.location, manufacturer=asset.manufacturer, model_number=asset.model_number, serial_number=asset.serial_number, purchase_date=asset.purchase_date, warranty_expiry=asset.warranty_expiry, service_contract_expiry=asset.service_contract_expiry, purchase_cost=asset.purchase_cost or 0, status=asset.status, is_active=asset.is_active, notes=asset.notes, open_ticket_count=open_count, warranty_days_remaining=days)

def _ticket_response(ticket, db):
    asset = db.query(MaintenanceAsset).filter(MaintenanceAsset.id == ticket.asset_id).first() if ticket.asset_id else None
    return TicketResponse(id=ticket.id, company_id=ticket.company_id, branch_id=ticket.branch_id, asset_id=ticket.asset_id, title=ticket.title, description=ticket.description, category=ticket.category, priority=ticket.priority, assigned_to_id=ticket.assigned_to_id, vendor_name=ticket.vendor_name, estimated_cost=ticket.estimated_cost or 0, due_at=ticket.due_at, ticket_number=ticket.ticket_number, status=ticket.status, actual_cost=ticket.actual_cost or 0, downtime_minutes=int(ticket.downtime_minutes or 0), opened_at=ticket.opened_at, completed_at=ticket.completed_at, asset_name=asset.name if asset else None, asset_code=asset.asset_code if asset else None)

@router.get('/summary', response_model=MaintenanceSummary)
def summary(branch_id: Optional[str] = Query(None), current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if branch_id: _branch_access(branch_id, current_user, db)
    asset_q = db.query(MaintenanceAsset).filter(MaintenanceAsset.company_id == current_user.company_id, MaintenanceAsset.is_active == True)
    ticket_q = db.query(MaintenanceTicket).filter(MaintenanceTicket.company_id == current_user.company_id)
    if branch_id:
        asset_q = asset_q.filter(MaintenanceAsset.branch_id == branch_id); ticket_q = ticket_q.filter(MaintenanceTicket.branch_id == branch_id)
    elif not _admin(current_user):
        ids = [x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id == current_user.id).all()]
        asset_q = asset_q.filter(MaintenanceAsset.branch_id.in_(ids)); ticket_q = ticket_q.filter(MaintenanceTicket.branch_id.in_(ids))
    now = datetime.utcnow(); thirty = now + timedelta(days=30); start = now - timedelta(days=30)
    open_status = [MaintenanceStatus.OPEN.value, MaintenanceStatus.IN_PROGRESS.value, MaintenanceStatus.WAITING_PARTS.value]
    overdue = ticket_q.filter(MaintenanceTicket.status.in_(open_status), MaintenanceTicket.due_at.isnot(None), MaintenanceTicket.due_at < now).count()
    warranty = asset_q.filter(MaintenanceAsset.warranty_expiry <= thirty, MaintenanceAsset.warranty_expiry >= now).count()
    return MaintenanceSummary(assets=asset_q.count(), active_assets=asset_q.filter(MaintenanceAsset.status == AssetStatus.ACTIVE.value).count(), open_tickets=ticket_q.filter(MaintenanceTicket.status.in_(open_status)).count(), critical_tickets=ticket_q.filter(MaintenanceTicket.status.in_(open_status), MaintenanceTicket.priority == 'CRITICAL').count(), overdue_tickets=overdue, warranty_expiring_30d=warranty, estimated_open_cost=ticket_q.filter(MaintenanceTicket.status.in_(open_status)).with_entities(func.coalesce(func.sum(MaintenanceTicket.estimated_cost),0)).scalar() or 0, actual_cost_30d=ticket_q.filter(MaintenanceTicket.completed_at >= start).with_entities(func.coalesce(func.sum(MaintenanceTicket.actual_cost),0)).scalar() or 0)

@router.get('/assets', response_model=list[AssetResponse])
def assets(branch_id: Optional[str] = Query(None), search: Optional[str] = Query(None), status: Optional[str] = Query(None), current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if branch_id: _branch_access(branch_id, current_user, db)
    q = db.query(MaintenanceAsset).filter(MaintenanceAsset.company_id == current_user.company_id)
    if branch_id: q=q.filter(MaintenanceAsset.branch_id==branch_id)
    elif not _admin(current_user):
        ids=[x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==current_user.id).all()]; q=q.filter(MaintenanceAsset.branch_id.in_(ids))
    if search: q=q.filter(or_(MaintenanceAsset.asset_code.ilike(f'%{search}%'), MaintenanceAsset.name.ilike(f'%{search}%'), MaintenanceAsset.serial_number.ilike(f'%{search}%')))
    if status: q=q.filter(MaintenanceAsset.status==status)
    return [_asset_response(x,db) for x in q.order_by(MaintenanceAsset.name).all()]

@router.post('/assets', response_model=AssetResponse, status_code=201)
def create_asset(payload: AssetCreate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    _branch_access(payload.branch_id,current_user,db)
    if db.query(MaintenanceAsset).filter(MaintenanceAsset.company_id==current_user.company_id, MaintenanceAsset.asset_code==payload.asset_code).first(): raise BadRequestException('Asset code already exists.')
    a=MaintenanceAsset(id=str(uuid.uuid4()), company_id=current_user.company_id, **payload.model_dump())
    db.add(a); db.flush(); _audit(db,current_user,'CREATE','MaintenanceAsset',a.id,f'Created asset {a.asset_code}'); db.commit(); db.refresh(a); return _asset_response(a,db)

@router.get('/tickets', response_model=list[TicketResponse])
def tickets(branch_id: Optional[str]=Query(None), status: Optional[str]=Query(None), priority: Optional[str]=Query(None), search: Optional[str]=Query(None), current_user: User=Depends(get_current_active_user), db: Session=Depends(get_db)):
    if branch_id: _branch_access(branch_id,current_user,db)
    q=db.query(MaintenanceTicket).filter(MaintenanceTicket.company_id==current_user.company_id)
    if branch_id:q=q.filter(MaintenanceTicket.branch_id==branch_id)
    elif not _admin(current_user):
        ids=[x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==current_user.id).all()];q=q.filter(MaintenanceTicket.branch_id.in_(ids))
    if status:q=q.filter(MaintenanceTicket.status==status)
    if priority:q=q.filter(MaintenanceTicket.priority==priority)
    if search:q=q.filter(or_(MaintenanceTicket.ticket_number.ilike(f'%{search}%'),MaintenanceTicket.title.ilike(f'%{search}%'),MaintenanceTicket.description.ilike(f'%{search}%')))
    return [_ticket_response(x,db) for x in q.order_by(desc(MaintenanceTicket.opened_at)).all()]

@router.post('/tickets', response_model=TicketResponse, status_code=201)
def create_ticket(payload: TicketCreate,current_user: User=Depends(get_current_active_user),db: Session=Depends(get_db)):
    _branch_access(payload.branch_id,current_user,db)
    if payload.asset_id:
        asset=db.query(MaintenanceAsset).filter(MaintenanceAsset.id==payload.asset_id,MaintenanceAsset.company_id==current_user.company_id,MaintenanceAsset.branch_id==payload.branch_id).first()
        if not asset: raise BadRequestException('Asset not found in selected outlet.')
    num=f"MNT-{datetime.utcnow().strftime('%Y%m%d')}-{db.query(func.count(MaintenanceTicket.id)).filter(MaintenanceTicket.company_id==current_user.company_id).scalar()+1:04d}"
    t=MaintenanceTicket(id=str(uuid.uuid4()),company_id=current_user.company_id,ticket_number=num,opened_at=datetime.utcnow(),**payload.model_dump())
    db.add(t); db.flush(); _audit(db,current_user,'CREATE','MaintenanceTicket',t.id,f'Created {t.ticket_number}'); db.commit(); db.refresh(t); return _ticket_response(t,db)

@router.patch('/tickets/{ticket_id}', response_model=TicketResponse)
def update_ticket(ticket_id:str,payload:TicketUpdate,current_user:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    t=db.query(MaintenanceTicket).filter(MaintenanceTicket.id==ticket_id,MaintenanceTicket.company_id==current_user.company_id).first()
    if not t: raise NotFoundException('Maintenance ticket not found.')
    _branch_access(t.branch_id,current_user,db)
    data=payload.model_dump(exclude_unset=True)
    if 'status' in data and data['status'] not in {x.value for x in MaintenanceStatus}: raise BadRequestException('Invalid maintenance status.')
    for k,v in data.items(): setattr(t,k,v)
    if t.status==MaintenanceStatus.COMPLETED.value and not t.completed_at: t.completed_at=datetime.utcnow()
    if t.status in {MaintenanceStatus.IN_PROGRESS.value,MaintenanceStatus.WAITING_PARTS.value,MaintenanceStatus.OPEN.value}:
        t.completed_at=None
    _audit(db,current_user,'UPDATE_STATUS' if 'status' in data else 'UPDATE','MaintenanceTicket',t.id,str(data)); db.commit(); db.refresh(t); return _ticket_response(t,db)

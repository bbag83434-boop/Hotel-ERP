import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, or_, desc
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_active_user
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.models.user import User, UserBranch
from app.models.organization import Branch
from app.models.audit import AuditLog
from app.models.beverage import BeverageItem, BeverageLedger, BeverageType
from app.schemas.beverage import *
router=APIRouter()
ADMIN={'ADMIN','SUPER_ADMIN','SUPERADMIN','OWNER','DIRECTOR','HQ_ADMIN','HEAD_OFFICE_ADMIN','GENERAL_MANAGER','AREA_MANAGER'}
def admin(u): return bool(u.role and u.role.name.upper() in ADMIN)
def access(branch_id,u,db):
 b=db.query(Branch).filter(Branch.id==branch_id,Branch.company_id==u.company_id).first()
 if not b: raise NotFoundException('Outlet not found in company.')
 if not admin(u) and not db.query(UserBranch).filter(UserBranch.user_id==u.id,UserBranch.branch_id==branch_id).first(): raise ForbiddenException('Access denied for this outlet.')
 return b
def stock(item,branch,db):
 return float(db.query(func.coalesce(func.sum(BeverageLedger.quantity),0)).filter(BeverageLedger.company_id==item.company_id,BeverageLedger.branch_id==branch,BeverageLedger.item_id==item.id).scalar() or 0)
def audit(db,u,action,e,eid,d): db.add(AuditLog(id=str(uuid.uuid4()),user_id=u.id,action=action,entity=e,entity_id=eid,details=d))
def item_resp(i,branch,db): return BeverageItemResponse(id=i.id,branch_id=i.branch_id,code=i.code,name=i.name,category=i.category,beverage_type=i.beverage_type,unit=i.unit,pack_size=float(i.pack_size or 1),cost_price=float(i.cost_price or 0),selling_price=float(i.selling_price or 0),notes=i.notes,active=i.active,stock=stock(i,branch,db))
@router.get('/summary',response_model=BeverageSummary)
def summary(branch_id:str|None=Query(None),u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
 if branch_id: access(branch_id,u,db)
 q=db.query(BeverageItem).filter(BeverageItem.company_id==u.company_id)
 l=db.query(BeverageLedger).filter(BeverageLedger.company_id==u.company_id)
 if branch_id:q=q.filter(BeverageItem.branch_id==branch_id);l=l.filter(BeverageLedger.branch_id==branch_id)
 elif not admin(u):
  ids=[x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==u.id).all()];q=q.filter(BeverageItem.branch_id.in_(ids));l=l.filter(BeverageLedger.branch_id.in_(ids))
 items=q.all(); stocks=[stock(i,i.branch_id,db) for i in items]
 today=datetime.utcnow().date();
 return BeverageSummary(items=len(items),alcohol_items=sum(i.beverage_type==BeverageType.ALCOHOL.value for i in items),total_stock=sum(stocks),low_stock_items=sum(x<=0 for x in stocks),today_sales=float(l.filter(BeverageLedger.txn_type=='SALE',BeverageLedger.created_at>=datetime.combine(today,datetime.min.time())).with_entities(func.coalesce(func.sum(BeverageLedger.quantity),0)).scalar() or 0),today_wastage=float(l.filter(BeverageLedger.txn_type.in_(['WASTAGE','BREAKAGE']),BeverageLedger.created_at>=datetime.combine(today,datetime.min.time())).with_entities(func.coalesce(func.sum(BeverageLedger.quantity),0)).scalar() or 0))
@router.get('/items',response_model=list[BeverageItemResponse])
def items(branch_id:str|None=Query(None),search:str|None=Query(None),u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
 if branch_id:access(branch_id,u,db)
 q=db.query(BeverageItem).filter(BeverageItem.company_id==u.company_id,BeverageItem.active==True)
 if branch_id:q=q.filter(BeverageItem.branch_id==branch_id)
 elif not admin(u):q=q.filter(BeverageItem.branch_id.in_([x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==u.id).all()]))
 if search:q=q.filter(or_(BeverageItem.code.ilike(f'%{search}%'),BeverageItem.name.ilike(f'%{search}%')))
 return [item_resp(i,i.branch_id,db) for i in q.order_by(BeverageItem.name).all()]
@router.post('/items',response_model=BeverageItemResponse,status_code=201)
def create_item(p:BeverageItemCreate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
 access(p.branch_id,u,db)
 if db.query(BeverageItem).filter(BeverageItem.company_id==u.company_id,BeverageItem.code==p.code).first():raise BadRequestException('Beverage code already exists.')
 i=BeverageItem(id=str(uuid.uuid4()),company_id=u.company_id,**p.model_dump());db.add(i);db.flush();audit(db,u,'CREATE','BeverageItem',i.id,f'Created {i.code}');db.commit();db.refresh(i);return item_resp(i,i.branch_id,db)
@router.post('/transactions',response_model=BeverageLedgerResponse,status_code=201)
def txn(p:BeverageTxnCreate,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
 access(p.branch_id,u,db);i=db.query(BeverageItem).filter(BeverageItem.id==p.item_id,BeverageItem.company_id==u.company_id,BeverageItem.branch_id==p.branch_id).first()
 if not i:raise NotFoundException('Beverage item not found.')
 allowed={'OPENING','PURCHASE','TRANSFER_IN','TRANSFER_OUT','SALE','COMPLIMENTARY','BREAKAGE','WASTAGE','ADJUSTMENT'}
 if p.txn_type not in allowed:raise BadRequestException('Invalid beverage transaction type.')
 delta=-p.quantity if p.txn_type in {'TRANSFER_OUT','SALE','COMPLIMENTARY','BREAKAGE','WASTAGE'} else p.quantity
 if stock(i,p.branch_id,db)+delta < -0.0001:raise BadRequestException('Insufficient beverage stock.')
 x=BeverageLedger(id=str(uuid.uuid4()),company_id=u.company_id,created_by=u.id,**p.model_dump());x.quantity=delta;db.add(x);db.flush();audit(db,u,'CREATE','BeverageLedger',x.id,f'{p.txn_type} {p.quantity} {i.code}');db.commit();db.refresh(x);return BeverageLedgerResponse(id=x.id,item_id=x.item_id,item_name=i.name,txn_type=p.txn_type,quantity=p.quantity,reference=x.reference,notes=x.notes,created_at=x.created_at)
@router.get('/ledger',response_model=list[BeverageLedgerResponse])
def ledger(branch_id:str|None=Query(None),item_id:str|None=Query(None),u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
 if branch_id:access(branch_id,u,db)
 q=db.query(BeverageLedger,BeverageItem.name).join(BeverageItem,BeverageItem.id==BeverageLedger.item_id).filter(BeverageLedger.company_id==u.company_id)
 if branch_id:q=q.filter(BeverageLedger.branch_id==branch_id)
 elif not admin(u):q=q.filter(BeverageLedger.branch_id.in_([x[0] for x in db.query(UserBranch.branch_id).filter(UserBranch.user_id==u.id).all()]))
 if item_id:q=q.filter(BeverageLedger.item_id==item_id)
 return [BeverageLedgerResponse(id=x.id,item_id=x.item_id,item_name=n,txn_type=x.txn_type,quantity=abs(float(x.quantity or 0)),reference=x.reference,notes=x.notes,created_at=x.created_at) for x,n in q.order_by(desc(BeverageLedger.created_at)).limit(500).all()]

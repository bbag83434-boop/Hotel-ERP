from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.user import User
from app.models.finance import ChartOfAccount, JournalEntry, JournalEntryLine, AccountType, JournalStatus, AccountsPayable
from app.models.organization import Branch

router = APIRouter()

def company_q(q, model, u):
    return q.filter(model.company_id == u.company_id)

def ensure_defaults(db, u):
    if not u.company_id: return
    if db.query(ChartOfAccount).filter(ChartOfAccount.company_id == u.company_id).count(): return
    defaults=[('1000','Cash','ASSET'),('1010','Bank','ASSET'),('1100','Accounts Receivable','ASSET'),('1200','Inventory','ASSET'),('2000','Accounts Payable','LIABILITY'),('3000','Owner Equity','EQUITY'),('4000','Sales Revenue','REVENUE'),('5000','Cost of Goods Sold','EXPENSE'),('6000','Operating Expenses','EXPENSE')]
    for code,name,typ in defaults: db.add(ChartOfAccount(company_id=u.company_id,code=code,name=name,type=AccountType(typ),balance=0,is_active=True))
    db.commit()

class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    type: AccountType

class JournalLineCreate(BaseModel):
    account_id: str
    debit: Decimal = Field(default=Decimal('0'), ge=0)
    credit: Decimal = Field(default=Decimal('0'), ge=0)
    narration: Optional[str]=None

class JournalCreate(BaseModel):
    date: datetime
    narration: str = Field(..., min_length=1, max_length=500)
    branch_id: Optional[str]=None
    reference_type: Optional[str]=None
    reference_id: Optional[str]=None
    lines: List[JournalLineCreate] = Field(..., min_length=2)

@router.get('/summary')
def summary(u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    ensure_defaults(db,u)
    accounts=company_q(db.query(ChartOfAccount),ChartOfAccount,u).all()
    journals=company_q(db.query(JournalEntry),JournalEntry,u).filter(JournalEntry.status==JournalStatus.POSTED).count()
    ap=company_q(db.query(AccountsPayable),AccountsPayable,u).all()
    outstanding=sum(Decimal(str(x.balance or 0)) for x in ap)
    return {'accounts':len(accounts),'posted_journals':journals,'payables':len(ap),'payables_outstanding':float(outstanding)}

@router.get('/accounts')
def accounts(u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    ensure_defaults(db,u)
    return [{'id':a.id,'code':a.code,'name':a.name,'type':a.type.value,'balance':float(a.balance or 0),'is_active':a.is_active} for a in company_q(db.query(ChartOfAccount),ChartOfAccount,u).order_by(ChartOfAccount.code).all()]

@router.post('/accounts',status_code=201)
def create_account(p:AccountCreate,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    if db.query(ChartOfAccount).filter(ChartOfAccount.company_id==u.company_id,ChartOfAccount.code==p.code).first(): raise BadRequestException('Account code already exists')
    a=ChartOfAccount(company_id=u.company_id,code=p.code,name=p.name,type=p.type,balance=0,is_active=True);db.add(a);db.commit();db.refresh(a)
    return {'id':a.id,'code':a.code,'name':a.name,'type':a.type.value,'balance':0}

@router.get('/journals')
def journals(limit:int=Query(100,ge=1,le=500),u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    rows=company_q(db.query(JournalEntry),JournalEntry,u).options(joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)).order_by(JournalEntry.date.desc()).limit(limit).all()
    return [{'id':j.id,'entry_number':j.entry_number,'date':j.date,'narration':j.narration,'status':j.status.value,'total_debit':float(j.total_debit),'total_credit':float(j.total_credit),'lines':[{'account_id':l.account_id,'account_code':l.account.code,'account_name':l.account.name,'debit':float(l.debit),'credit':float(l.credit)} for l in j.lines]} for j in rows]

@router.post('/journals',status_code=201)
def create_journal(p:JournalCreate,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    if p.branch_id and not db.query(Branch).filter(Branch.id==p.branch_id,Branch.company_id==u.company_id).first(): raise ForbiddenException('Invalid outlet scope')
    if any(l.debit>0 and l.credit>0 or (l.debit==0 and l.credit==0) for l in p.lines): raise BadRequestException('Each journal line must contain debit or credit, not both')
    debit=sum((l.debit for l in p.lines),Decimal('0'));credit=sum((l.credit for l in p.lines),Decimal('0'))
    if debit != credit: raise BadRequestException('Journal is not balanced: debit must equal credit')
    ids={l.account_id for l in p.lines};accounts=db.query(ChartOfAccount).filter(ChartOfAccount.company_id==u.company_id,ChartOfAccount.id.in_(ids),ChartOfAccount.is_active.is_(True)).all()
    if len(accounts)!=len(ids): raise BadRequestException('One or more accounts are invalid')
    n=f'JE-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}-{str(datetime.utcnow().microsecond)[-4:]}'
    j=JournalEntry(company_id=u.company_id,branch_id=p.branch_id,entry_number=n,date=p.date,reference_type=p.reference_type,reference_id=p.reference_id,narration=p.narration,status=JournalStatus.POSTED,total_debit=debit,total_credit=credit);db.add(j);db.flush()
    amap={a.id:a for a in accounts}
    for l in p.lines:
        db.add(JournalEntryLine(journal_entry_id=j.id,account_id=l.account_id,debit=l.debit,credit=l.credit,narration=l.narration)); a=amap[l.account_id]; a.balance=Decimal(str(a.balance or 0)) + l.debit-l.credit
    db.commit();db.refresh(j);return {'id':j.id,'entry_number':j.entry_number,'status':j.status.value,'total_debit':float(debit),'total_credit':float(credit)}

@router.get('/trial-balance')
def trial_balance(as_of:Optional[datetime]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    ensure_defaults(db,u); accounts=company_q(db.query(ChartOfAccount),ChartOfAccount,u).all(); rows=[];td=Decimal('0');tc=Decimal('0')
    for a in accounts:
        q=db.query(func.coalesce(func.sum(JournalEntryLine.debit),0),func.coalesce(func.sum(JournalEntryLine.credit),0)).join(JournalEntry).filter(JournalEntry.company_id==u.company_id,JournalEntry.status==JournalStatus.POSTED,JournalEntryLine.account_id==a.id)
        if as_of:q=q.filter(JournalEntry.date<=as_of)
        d,c=q.one();d=Decimal(str(d));c=Decimal(str(c));cd=max(d-c,Decimal('0'));cc=max(c-d,Decimal('0'));td+=cd;tc+=cc
        rows.append({'accountId':a.id,'code':a.code,'name':a.name,'type':a.type.value,'totalDebits':float(d),'totalCredits':float(c),'closingDebit':float(cd),'closingCredit':float(cc)})
    return {'asOfDate':(as_of or datetime.utcnow()).isoformat(),'isBalanced':td==tc,'totalDebit':float(td),'totalCredit':float(tc),'variance':float(td-tc),'accounts':rows}

@router.get('/profit-loss')
def profit_loss(start_date:datetime,end_date:datetime,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if end_date<start_date: raise BadRequestException('end_date must be after start_date')
    accounts=company_q(db.query(ChartOfAccount),ChartOfAccount,u).all(); groups={'revenue':[],'cogs':[],'expense':[]}; totals={'revenue':Decimal('0'),'cogs':Decimal('0'),'expense':Decimal('0')}
    for a in accounts:
        d,c=db.query(func.coalesce(func.sum(JournalEntryLine.debit),0),func.coalesce(func.sum(JournalEntryLine.credit),0)).join(JournalEntry).filter(JournalEntry.company_id==u.company_id,JournalEntry.status==JournalStatus.POSTED,JournalEntry.date>=start_date,JournalEntry.date<=end_date,JournalEntryLine.account_id==a.id).one();d=Decimal(str(d));c=Decimal(str(c));amount=(c-d) if a.type==AccountType.REVENUE else (d-c)
        if a.type==AccountType.REVENUE:key='revenue'
        elif a.code=='5000' or 'cost' in a.name.lower():key='cogs'
        elif a.type==AccountType.EXPENSE:key='expense'
        else:continue
        if amount: groups[key].append({'code':a.code,'name':a.name,'amount':float(amount)});totals[key]+=amount
    gross=totals['revenue']-totals['cogs'];net=gross-totals['expense']
    return {'period':{'startDate':start_date.isoformat(),'endDate':end_date.isoformat()},'revenue':{'items':groups['revenue'],'total':float(totals['revenue'])},'cogs':{'items':groups['cogs'],'total':float(totals['cogs'])},'grossProfit':float(gross),'operatingExpenses':{'items':groups['expense'],'total':float(totals['expense'])},'netIncome':float(net)}

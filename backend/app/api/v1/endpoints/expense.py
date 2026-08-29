from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_active_user, require_permission
from app.core.exceptions import BadRequestException, NotFoundException, ForbiddenException
from app.models.user import User
from app.models.organization import Branch
from app.models.finance import ChartOfAccount, JournalEntry, JournalEntryLine, JournalStatus, AccountType
from app.models.expense import Expense, Reconciliation
from app.models.audit import AuditLog

router=APIRouter()

def branch_ok(db,u,bid):
    if bid and not db.query(Branch).filter(Branch.id==bid,Branch.company_id==u.company_id).first(): raise ForbiddenException('Invalid outlet scope')

def serialize_exp(x):
    return {'id':x.id,'expenseNumber':x.expense_number,'expenseDate':x.expense_date,'branchId':x.branch_id,'category':x.category,'description':x.description,'amount':float(x.amount),'paymentMethod':x.payment_method,'accountId':x.account_id,'status':x.status,'notes':x.notes,'approvedById':x.approved_by_id,'approvedAt':x.approved_at,'journalId':x.journal_id}

def serialize_rec(x):
    return {'id':x.id,'reconciliationNumber':x.reconciliation_number,'branchId':x.branch_id,'accountId':x.account_id,'periodStart':x.period_start,'periodEnd':x.period_end,'bookBalance':float(x.book_balance),'statementBalance':float(x.statement_balance),'variance':float(x.variance),'status':x.status,'notes':x.notes,'reconciledById':x.reconciled_by_id,'reconciledAt':x.reconciled_at}

class ExpenseCreate(BaseModel):
    expense_date: datetime
    branch_id: Optional[str]=None
    category: str=Field(...,min_length=1,max_length=100)
    description: str=Field(...,min_length=1,max_length=1000)
    amount: Decimal=Field(...,gt=0)
    payment_method: str=Field(...,pattern='^(CASH|BANK|UPI|CARD)$')
    account_id: str
    notes: Optional[str]=None

class ReconciliationCreate(BaseModel):
    branch_id: Optional[str]=None
    account_id: str
    period_start: datetime
    period_end: datetime
    statement_balance: Decimal
    notes: Optional[str]=None

@router.get('/summary')
def summary(u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    q=db.query(Expense).filter(Expense.company_id==u.company_id)
    pending=q.filter(Expense.status=='PENDING').count(); approved=q.filter(Expense.status=='APPROVED').count(); total=sum((Decimal(str(x.amount)) for x in q.all()),Decimal('0'))
    rq=db.query(Reconciliation).filter(Reconciliation.company_id==u.company_id)
    open_count=rq.filter(Reconciliation.status=='OPEN').count(); variance=sum((abs(Decimal(str(x.variance))) for x in rq.filter(Reconciliation.status=='OPEN').all()),Decimal('0'))
    return {'expenseCount':q.count(),'pendingExpenses':pending,'approvedExpenses':approved,'expenseTotal':float(total),'openReconciliations':open_count,'openVariance':float(variance)}

@router.get('/expenses')
def expenses(status_filter:Optional[str]=Query(None,alias='status'),branch_id:Optional[str]=None,u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    if branch_id: branch_ok(db,u,branch_id)
    q=db.query(Expense).filter(Expense.company_id==u.company_id)
    if branch_id:q=q.filter(Expense.branch_id==branch_id)
    if status_filter:q=q.filter(Expense.status==status_filter)
    return [serialize_exp(x) for x in q.order_by(Expense.expense_date.desc()).limit(300).all()]

@router.post('/expenses',status_code=201)
def create_expense(p:ExpenseCreate,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    branch_ok(db,u,p.branch_id)
    account=db.query(ChartOfAccount).filter(ChartOfAccount.id==p.account_id,ChartOfAccount.company_id==u.company_id,ChartOfAccount.is_active.is_(True)).first()
    if not account: raise BadRequestException('Invalid expense account')
    n=f'EXP-{datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[-16:]}'
    x=Expense(company_id=u.company_id,branch_id=p.branch_id,expense_number=n,expense_date=p.expense_date,category=p.category,description=p.description,amount=p.amount,payment_method=p.payment_method,account_id=p.account_id,status='PENDING',notes=p.notes)
    db.add(x); db.add(AuditLog(user_id=u.id,action='EXPENSE_CREATE',entity_type='Expense',entity_id=x.id,details=p.description)); db.commit(); db.refresh(x); return serialize_exp(x)

@router.post('/expenses/{expense_id}/approve')
def approve_expense(expense_id:str,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    x=db.query(Expense).filter(Expense.id==expense_id,Expense.company_id==u.company_id).first()
    if not x: raise NotFoundException('Expense not found')
    if x.status!='PENDING': raise BadRequestException('Only pending expenses can be approved')
    cash=db.query(ChartOfAccount).filter(ChartOfAccount.company_id==u.company_id,ChartOfAccount.code=='1000').first()
    bank=db.query(ChartOfAccount).filter(ChartOfAccount.company_id==u.company_id,ChartOfAccount.code=='1010').first()
    credit={'CASH':cash,'BANK':bank,'UPI':bank,'CARD':bank}[x.payment_method]
    if not credit: raise BadRequestException('Default payment account is missing')
    je=JournalEntry(company_id=u.company_id,branch_id=x.branch_id,entry_number=f'JE-EXP-{datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[-16:]}',date=x.expense_date,reference_type='EXPENSE',reference_id=x.id,narration=f'{x.category}: {x.description}',status=JournalStatus.POSTED,total_debit=x.amount,total_credit=x.amount)
    db.add(je); db.flush(); db.add_all([JournalEntryLine(journal_entry_id=je.id,account_id=x.account_id,debit=x.amount,credit=0),JournalEntryLine(journal_entry_id=je.id,account_id=credit.id,debit=0,credit=x.amount)])
    acct=db.query(ChartOfAccount).filter(ChartOfAccount.id==x.account_id).first(); acct.balance=Decimal(str(acct.balance or 0))+x.amount-credit.balance*Decimal('0')
    credit.balance=Decimal(str(credit.balance or 0))-x.amount
    x.status='APPROVED';x.approved_by_id=u.id;x.approved_at=datetime.utcnow();x.journal_id=je.id
    db.add(AuditLog(user_id=u.id,action='EXPENSE_APPROVE',entity_type='Expense',entity_id=x.id,details=x.expense_number));db.commit();db.refresh(x);return serialize_exp(x)

@router.get('/reconciliations')
def reconciliations(u:User=Depends(get_current_active_user),db:Session=Depends(get_db)):
    return [serialize_rec(x) for x in db.query(Reconciliation).filter(Reconciliation.company_id==u.company_id).order_by(Reconciliation.period_end.desc()).limit(200).all()]

@router.post('/reconciliations',status_code=201)
def create_reconciliation(p:ReconciliationCreate,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    branch_ok(db,u,p.branch_id)
    if p.period_end<p.period_start: raise BadRequestException('Period end must be after period start')
    a=db.query(ChartOfAccount).filter(ChartOfAccount.id==p.account_id,ChartOfAccount.company_id==u.company_id,ChartOfAccount.is_active.is_(True)).first()
    if not a: raise BadRequestException('Invalid account')
    n=f'REC-{datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[-16:]}'
    r=Reconciliation(company_id=u.company_id,branch_id=p.branch_id,account_id=p.account_id,reconciliation_number=n,period_start=p.period_start,period_end=p.period_end,book_balance=a.balance or 0,statement_balance=p.statement_balance,variance=Decimal(str(p.statement_balance))-Decimal(str(a.balance or 0)),status='OPEN',notes=p.notes)
    db.add(r);db.add(AuditLog(user_id=u.id,action='ACCOUNT_RECONCILIATION_CREATE',entity_type='Reconciliation',entity_id=r.id,details=n));db.commit();db.refresh(r);return serialize_rec(r)

@router.post('/reconciliations/{rec_id}/close')
def close_reconciliation(rec_id:str,u:User=Depends(require_permission('procurement:create')),db:Session=Depends(get_db)):
    r=db.query(Reconciliation).filter(Reconciliation.id==rec_id,Reconciliation.company_id==u.company_id).first()
    if not r: raise NotFoundException('Reconciliation not found')
    if r.status!='OPEN': raise BadRequestException('Reconciliation is already closed')
    r.status='RECONCILED';r.reconciled_by_id=u.id;r.reconciled_at=datetime.utcnow();db.add(AuditLog(user_id=u.id,action='ACCOUNT_RECONCILIATION_CLOSE',entity_type='Reconciliation',entity_id=r.id,details=f'variance={r.variance}'));db.commit();db.refresh(r);return serialize_rec(r)

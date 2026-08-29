from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, Index
from app.models.base import BaseModel

class Expense(BaseModel):
    __tablename__ = 'expenses'
    company_id = Column('companyId', String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column('branchId', String(36), ForeignKey('branches.id', ondelete='SET NULL'), nullable=True, index=True)
    expense_number = Column('expenseNumber', String(60), unique=True, nullable=False, index=True)
    expense_date = Column('expenseDate', DateTime, nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Numeric(14,2), nullable=False)
    payment_method = Column('paymentMethod', String(20), nullable=False)
    account_id = Column('accountId', String(36), ForeignKey('chart_of_accounts.id'), nullable=False)
    status = Column(String(20), nullable=False, default='PENDING')
    approved_by_id = Column('approvedById', String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    approved_at = Column('approvedAt', DateTime, nullable=True)
    journal_id = Column('journalId', String(36), ForeignKey('journal_entries.id', ondelete='SET NULL'), nullable=True)
    notes = Column(Text, nullable=True)

Index('ix_expenses_company_date', Expense.company_id, Expense.expense_date)

class Reconciliation(BaseModel):
    __tablename__ = 'account_reconciliations'
    company_id = Column('companyId', String(36), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, index=True)
    branch_id = Column('branchId', String(36), ForeignKey('branches.id', ondelete='SET NULL'), nullable=True, index=True)
    account_id = Column('accountId', String(36), ForeignKey('chart_of_accounts.id'), nullable=False, index=True)
    reconciliation_number = Column('reconciliationNumber', String(60), unique=True, nullable=False, index=True)
    period_start = Column('periodStart', DateTime, nullable=False)
    period_end = Column('periodEnd', DateTime, nullable=False)
    book_balance = Column('bookBalance', Numeric(14,2), nullable=False)
    statement_balance = Column('statementBalance', Numeric(14,2), nullable=False)
    variance = Column(Numeric(14,2), nullable=False)
    status = Column(String(20), nullable=False, default='OPEN')
    notes = Column(Text, nullable=True)
    reconciled_by_id = Column('reconciledById', String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reconciled_at = Column('reconciledAt', DateTime, nullable=True)

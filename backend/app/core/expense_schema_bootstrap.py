from app.core.database import engine, Base
from app.models.expense import Expense, Reconciliation

def ensure_expense_schema():
    Base.metadata.create_all(bind=engine, tables=[Expense.__table__, Reconciliation.__table__])

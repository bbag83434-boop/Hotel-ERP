from sqlalchemy import text
from app.core.database import engine, Base
from app.models.finance import ChartOfAccount, JournalEntry, JournalEntryLine, AccountsPayable

def ensure_finance_schema():
    Base.metadata.create_all(bind=engine, tables=[ChartOfAccount.__table__, JournalEntry.__table__, JournalEntryLine.__table__, AccountsPayable.__table__])

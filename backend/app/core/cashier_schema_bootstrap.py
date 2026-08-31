from app.core.database import engine, Base
from app.models.cashier import CashSession, CashMovement

def ensure_cashier_schema():
    Base.metadata.create_all(bind=engine, tables=[CashSession.__table__, CashMovement.__table__])

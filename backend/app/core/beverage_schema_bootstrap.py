from app.core.database import engine, Base
from app.models.beverage import BeverageItem, BeverageLedger

def ensure_beverage_schema():
    Base.metadata.create_all(bind=engine, tables=[BeverageItem.__table__, BeverageLedger.__table__])

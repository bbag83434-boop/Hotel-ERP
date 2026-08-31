from sqlalchemy.orm import Session
from app.models.inventory import StockBalance, StockLedger, Item
from app.models.procurement import PurchaseRequest, PurchaseOrder, GoodsReceiveNote
from app.models.wastage import WastageEntry
from sqlalchemy import func

class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_stock_balance_report(self, company_id: str, branch_id: str = None):
        query = self.db.query(StockBalance).join(Item).filter(Item.company_id == company_id)
        if branch_id:
            query = query.filter(StockBalance.warehouse_id == branch_id) # Simplify mapping
        
        return query.all()

    def get_purchase_summary(self, company_id: str, start_date=None, end_date=None):
        query = self.db.query(PurchaseOrder).filter(PurchaseOrder.company_id == company_id)
        # Apply date filters
        return query.all()

    def get_wastage_report(self, company_id: str):
        return self.db.query(WastageEntry).filter(WastageEntry.company_id == company_id).all()

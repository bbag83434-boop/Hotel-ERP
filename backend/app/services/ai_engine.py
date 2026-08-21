from sqlalchemy.orm import Session
from sqlalchemy import join
from app.models.inventory import StockBalance
from app.models.organization import Warehouse
from app.models.organization import Branch

class AIEngine:
    def __init__(self, db: Session, outlet_id: str):
        self.db = db
        self.outlet_id = outlet_id

    def get_stock_recommendations(self):
        # Query stock balances filtered by branch/outlet through warehouse
        # Joining StockBalance with Warehouse to get branch_id
        stocks = (
            self.db.query(StockBalance)
            .join(Warehouse, StockBalance.warehouse_id == Warehouse.id)
            .filter(Warehouse.branch_id == self.outlet_id)
            .all()
        )
        
        # Simple recommendation logic: if stock <= min_stock_level, recommend reorder
        recommendations = []
        for stock in stocks:
            if stock.min_stock_level and stock.quantity <= stock.min_stock_level:
                recommendations.append({
                    "item_id": stock.item_id,
                    "item_name": stock.item.name,
                    "current_quantity": float(stock.quantity),
                    "min_stock_level": float(stock.min_stock_level),
                    "recommendation": "Reorder needed"
                })
        return recommendations

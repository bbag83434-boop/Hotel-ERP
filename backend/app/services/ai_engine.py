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
        
        # Enhanced recommendation logic:
        # If stock <= min_stock_level, recommend reorder
        recommendations = []
        for stock in stocks:
            if stock.min_stock_level and stock.quantity <= stock.min_stock_level:
                suggested_qty = stock.reorder_qty if stock.reorder_qty else stock.min_stock_level
                
                # Simple priority logic
                priority = "MEDIUM"
                if stock.min_stock_level and stock.quantity <= (float(stock.min_stock_level) * 0.5):
                    priority = "HIGH"
                
                recommendations.append({
                    "item_id": stock.item_id,
                    "item_name": stock.item.name,
                    "current_quantity": float(stock.quantity),
                    "min_stock_level": float(stock.min_stock_level),
                    "suggested_order_quantity": float(suggested_qty),
                    "priority": priority,
                    "recommendation": f"Order {float(suggested_qty)} {stock.item.unit.symbol} immediately"
                })
        return recommendations

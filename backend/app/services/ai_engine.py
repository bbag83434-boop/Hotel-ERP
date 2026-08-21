from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.inventory import StockBalance, StockLedger
from app.models.organization import Warehouse
from app.models.organization import Branch

class AIEngine:
    def __init__(self, db: Session, outlet_id: str):
        self.db = db
        self.outlet_id = outlet_id

    def get_stock_recommendations(self):
        # Query stock balances filtered by branch/outlet through warehouse
        stocks = (
            self.db.query(StockBalance)
            .join(Warehouse, StockBalance.warehouse_id == Warehouse.id)
            .filter(Warehouse.branch_id == self.outlet_id)
            .all()
        )
        
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recommendations = []
        
        for stock in stocks:
            # Calculate historical consumption
            consumption = self.db.query(func.sum(StockLedger.change_qty)).filter(
                and_(
                    StockLedger.item_id == stock.item_id,
                    StockLedger.warehouse_id == stock.warehouse_id,
                    StockLedger.movement_type.in_(['POS_SALE', 'WASTAGE', 'PRODUCTION_OUT']),
                    StockLedger.created_at >= seven_days_ago
                )
            ).scalar() or 0
            
            # Change is negative for consumption
            daily_usage = abs(float(consumption)) / 7
            
            # Determine base requirement
            if daily_usage > 0:
                expected_req = daily_usage * 7 # Forecast for 7 days
                suggested_qty = max(0.0, expected_req - float(stock.quantity))
                reason = f"7-day average consumption is {daily_usage:.1f} {stock.item.unit.symbol}/day; recommended order: {suggested_qty:.1f} {stock.item.unit.symbol}."
                priority = "HIGH" if float(stock.quantity) < daily_usage else "MEDIUM"
            else:
                # Fallback to static logic
                if not stock.min_stock_level or stock.quantity > stock.min_stock_level:
                    continue
                suggested_qty = float(stock.reorder_qty or stock.min_stock_level)
                reason = "Insufficient historical data; using min-stock/reorder fallback."
                priority = "MEDIUM"
                
            if suggested_qty > 0:
                recommendations.append({
                    "item_id": stock.item_id,
                    "item_name": stock.item.name,
                    "current_quantity": float(stock.quantity),
                    "min_stock_level": float(stock.min_stock_level or 0),
                    "suggested_order_quantity": suggested_qty,
                    "priority": priority,
                    "recommendation": reason
                })
        return recommendations

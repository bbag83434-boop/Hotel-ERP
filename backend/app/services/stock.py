from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.inventory import StockLedger, StockBalance, StockBatch
from app.models.wastage import WastageEntry, WastageItem
from app.models.recipe import ProductionOrder, ProductionConsumption
from app.core.exceptions import AppException
import uuid

class StockService:
    def __init__(self, db: Session):
        self.db = db

    def post_stock_movement(self, warehouse_id: str, item_id: str, change_qty: Decimal, movement_type: str, 
                            reference_type: str, reference_id: str, batch_number: str = None, 
                            expiry_date: str = None, user_id: str = None, idempotency_key: str = None):
        
        # Check idempotency
        if idempotency_key:
            existing = self.db.query(StockLedger).filter(StockLedger.notes == idempotency_key).first()
            if existing:
                return existing

        # Check negative stock
        balance = self.db.query(StockBalance).filter(
            StockBalance.warehouse_id == warehouse_id,
            StockBalance.item_id == item_id
        ).first()

        current_balance = balance.quantity if balance else Decimal("0.0000")
        new_balance = current_balance + change_qty

        if new_balance < 0:
            raise AppException(status_code=400, code="INSUFFICIENT_STOCK", message="Negative stock blocked.")

        # Update balance
        if not balance:
            balance = StockBalance(warehouse_id=warehouse_id, item_id=item_id, quantity=new_balance)
            self.db.add(balance)
        else:
            balance.quantity = new_balance

        # Create ledger entry
        ledger = StockLedger(
            warehouse_id=warehouse_id,
            item_id=item_id,
            batch_number=batch_number,
            movement_type=movement_type,
            change_qty=change_qty,
            balance_qty=new_balance,
            reference_type=reference_type,
            reference_id=reference_id,
            created_by_id=user_id,
            notes=idempotency_key
        )
        self.db.add(ledger)
        self.db.commit()
        return ledger

    def create_wastage(self, entry: WastageEntry):
        # Transactional logic:
        # 1. Update stock levels for each item
        # 2. Record ledger entries for each item
        # 3. Update entry status
        for item in entry.items:
            self.post_stock_movement(
                warehouse_id=entry.warehouse_id,
                item_id=item.item_id,
                change_qty=-item.quantity,
                movement_type="WASTAGE",
                reference_type="WASTAGE",
                reference_id=entry.id,
                batch_number=item.batch_number,
                user_id=entry.reported_by_id,
                idempotency_key=f"wastage_item_{item.id}"
            )
        entry.status = "APPROVED"
        self.db.commit()

    def create_production(self, order: ProductionOrder):
        # Transactional logic:
        # 1. Deduct raw materials based on consumption
        # 2. Add finished good
        # 3. Record all movements
        for cons in order.consumptions:
            self.post_stock_movement(
                warehouse_id=order.kitchen_warehouse_id,
                item_id=cons.raw_item_id,
                change_qty=-cons.actual_consumed_qty,
                movement_type="PRODUCTION_OUT",
                reference_type="PRODUCTION",
                reference_id=order.id,
                user_id=order.created_by_id,
                idempotency_key=f"prod_cons_{cons.id}"
            )
        
        self.post_stock_movement(
            warehouse_id=order.kitchen_warehouse_id,
            item_id=order.recipe.finished_item_id,
            change_qty=order.actual_yield_qty,
            movement_type="PRODUCTION_IN",
            reference_type="PRODUCTION",
            reference_id=order.id,
            user_id=order.created_by_id,
            idempotency_key=f"prod_in_{order.id}"
        )
        order.status = "COMPLETED"
        self.db.commit()


from decimal import Decimal
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.inventory import StockTransfer, StockTransferItem, TransferStatus, StockLedger
from app.services.stock import StockService
from app.core.exceptions import AppException
import uuid

class TransferService:
    def __init__(self, db: Session):
        self.db = db
        self.stock_service = StockService(db)

    def dispatch_transfer(self, transfer_id: str, user_id: str):
        transfer = self.db.query(StockTransfer).filter(StockTransfer.id == transfer_id).first()
        if not transfer or transfer.status != TransferStatus.APPROVED:
            raise AppException(status_code=400, message="Invalid transfer status for dispatch")

        # Dispatch items
        for item in transfer.items:
            # 1. Decrease source
            self.stock_service.post_stock_movement(
                warehouse_id=transfer.from_warehouse_id,
                item_id=item.item_id,
                change_qty=-item.dispatched_qty,
                movement_type="TRANSFER_OUT",
                reference_type="TRANSFER_DISPATCH",
                reference_id=transfer.id,
                batch_number=item.batch_number,
                user_id=user_id,
                idempotency_key=f"trans_out_{item.id}_{transfer.id}"
            )
            # 2. Increase In-Transit (Virtual Warehouse)
            in_transit_wh = self._get_in_transit_warehouse(transfer.company_id)
            self.stock_service.post_stock_movement(
                warehouse_id=in_transit_wh.id,
                item_id=item.item_id,
                change_qty=item.dispatched_qty,
                movement_type="TRANSFER_IN", # In-transit check-in
                reference_type="TRANSFER_DISPATCH",
                reference_id=transfer.id,
                batch_number=item.batch_number,
                user_id=user_id,
                idempotency_key=f"trans_in_transit_{item.id}_{transfer.id}"
            )
            
        transfer.status = TransferStatus.DISPATCHED
        transfer.dispatched_by_id = user_id
        transfer.dispatched_at = datetime.utcnow()
        self.db.commit()

    def receive_transfer(self, transfer_id: str, items_data: list, user_id: str):
        transfer = self.db.query(StockTransfer).filter(StockTransfer.id == transfer_id).first()
        if not transfer or transfer.status not in [TransferStatus.DISPATCHED, TransferStatus.IN_TRANSIT, TransferStatus.PARTIALLY_RECEIVED]:
            raise AppException(status_code=400, message="Invalid transfer status for receiving")

        # Process received items
        for item_data in items_data:
            item = next((i for i in transfer.items if i.id == item_data['item_id']), None)
            if not item: continue
            
            accepted_qty = Decimal(str(item_data['accepted_qty']))
            
            # 1. Decrease In-Transit
            in_transit_wh = self._get_in_transit_warehouse(transfer.company_id)
            self.stock_service.post_stock_movement(
                warehouse_id=in_transit_wh.id,
                item_id=item.item_id,
                change_qty=-accepted_qty,
                movement_type="TRANSFER_OUT", # Leave in-transit
                reference_type="TRANSFER_RECEIVE",
                reference_id=transfer.id,
                batch_number=item.batch_number,
                user_id=user_id,
                idempotency_key=f"trans_rec_out_{item.id}_{transfer.id}"
            )
            # 2. Increase Destination
            self.stock_service.post_stock_movement(
                warehouse_id=transfer.to_warehouse_id,
                item_id=item.item_id,
                change_qty=accepted_qty,
                movement_type="TRANSFER_IN",
                reference_type="TRANSFER_RECEIVE",
                reference_id=transfer.id,
                batch_number=item.batch_number,
                user_id=user_id,
                idempotency_key=f"trans_rec_in_{item.id}_{transfer.id}"
            )
            
            item.accepted_qty += accepted_qty
            item.damaged_qty += Decimal(str(item_data.get('damaged_qty', 0)))
            item.short_qty += Decimal(str(item_data.get('short_qty', 0)))
            
        transfer.status = TransferStatus.FULLY_RECEIVED # simplified
        transfer.received_by_id = user_id
        transfer.received_at = datetime.utcnow()
        self.db.commit()

    def _get_in_transit_warehouse(self, company_id: str):
        from app.models.inventory import Warehouse
        wh = self.db.query(Warehouse).filter(Warehouse.company_id == company_id, Warehouse.code == 'WH-INTRANSIT').first()
        if not wh:
            raise AppException(status_code=500, message="In-transit warehouse not found")
        return wh

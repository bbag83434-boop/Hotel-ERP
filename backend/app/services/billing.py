from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.billing import VendorBill, VendorBillItem, VendorBillGRNLink, BillStatus
from app.models.procurement import GoodsReceiveNote, GoodsReceiveItem, PurchaseOrderItem
from app.core.exceptions import AppException

class BillingService:
    def __init__(self, db: Session):
        self.db = db
        self.tolerance = Decimal("0.01") # 1% tolerance for rate/amount variance

    def perform_three_way_match(self, bill_id: str):
        bill = self.db.query(VendorBill).filter(VendorBill.id == bill_id).first()
        if not bill:
            raise AppException(status_code=404, message="Bill not found")

        # 1. Gather all items from linked GRNs that are APPROVED
        linked_grn_ids = [link.grn_id for link in bill.grn_links]
        grns = self.db.query(GoodsReceiveNote).filter(
            GoodsReceiveNote.id.in_(linked_grn_ids),
            GoodsReceiveNote.status == "APPROVED"
        ).all()
        
        # 2. Match Logic
        mismatch_found = False
        
        for bill_item in bill.items:
            # Aggregate accepted qty from linked APPROVED GRNs
            total_received = sum(
                gi.accepted_qty for grn in grns for gi in grn.items if gi.item_id == bill_item.item_id
            )
            
            print(f"DEBUG: item={bill_item.item_id}, bill_qty={bill_item.quantity}, received={total_received}")
            
            # Rule: Invoice quantity cannot exceed approved received quantity
            if bill_item.quantity > total_received:
                mismatch_found = True
                print(f"DEBUG: Mismatch due to qty: {bill_item.quantity} > {total_received}")
                continue
                
            # Check rate variance against PO items (linked via GRN)
            # Fetch GRN items first, then PO items linked to them
            grn_items = self.db.query(GoodsReceiveItem).filter(
                GoodsReceiveItem.item_id == bill_item.item_id,
                GoodsReceiveItem.grn_id.in_(linked_grn_ids)
            ).all()
            
            po_item_ids = [gi.po_item_id for gi in grn_items if gi.po_item_id]
            po_items = self.db.query(PurchaseOrderItem).filter(PurchaseOrderItem.id.in_(po_item_ids)).all()

            if po_items:
                po_rate = po_items[0].unit_price
                
                # Rule: Check rate variance within tolerance
                rate_diff = abs(bill_item.unit_price - po_rate)
                if rate_diff > (po_rate * self.tolerance):
                    mismatch_found = True
            
        if not mismatch_found:
            bill.status = BillStatus.VERIFIED
            self.db.commit()
            return True
        else:
            return False

    def approve_bill(self, bill_id: str, user_id: str):
        bill = self.db.query(VendorBill).filter(VendorBill.id == bill_id).first()
        if bill.status != BillStatus.VERIFIED:
            raise AppException(status_code=400, message="Bill must be verified before approval")
            
        bill.status = BillStatus.APPROVED
        bill.approved_by_id = user_id
        self.db.commit()



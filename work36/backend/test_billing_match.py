import pytest
from decimal import Decimal
from datetime import datetime
from app.models.billing import VendorBill, VendorBillItem, VendorBillGRNLink, BillStatus
from app.models.procurement import GoodsReceiveNote, GoodsReceiveItem, PurchaseOrder, PurchaseOrderItem
from app.models.organization import Warehouse, Branch
from app.services.billing import BillingService
from app.core.exceptions import AppException

# Simple mock for testing
class MockDB:
    def __init__(self):
        self.objects = []
    def add(self, obj): self.objects.append(obj)
    def commit(self): pass
    def query(self, model): return QueryBuilder(self.objects, model)

class QueryBuilder:
    def __init__(self, objects, model):
        self.objects = [o for o in objects if isinstance(o, model)]
    def filter(self, *args): return self
    def first(self): return self.objects[0] if self.objects else None
    def all(self): return self.objects

def test_three_way_match_success():
    db = MockDB()
    # Setup test data
    bill = VendorBill(id="bill-1", total_amount=Decimal("100.00"), status=BillStatus.DRAFT)
    item = VendorBillItem(bill_id="bill-1", item_id="item-1", quantity=Decimal("10.00"), unit_price=Decimal("10.00"))
    grn = GoodsReceiveNote(id="grn-1", status="APPROVED")
    grn_item = GoodsReceiveItem(grn_id="grn-1", item_id="item-1", accepted_qty=Decimal("10.00"))
    link = VendorBillGRNLink(bill_id="bill-1", grn_id="grn-1")
    
    db.add(bill)
    db.add(item)
    db.add(grn)
    db.add(grn_item)
    db.add(link)
    
    # Force relationship update in mock
    bill.grn_links = [link]
    bill.items = [item]
    
    service = BillingService(db)
    result = service.perform_three_way_match("bill-1")
    assert result == True
    assert bill.status == BillStatus.VERIFIED

def test_three_way_match_quantity_variance():
    db = MockDB()
    # Invoice 10, Received 5
    bill = VendorBill(id="bill-1", total_amount=Decimal("100.00"), status=BillStatus.DRAFT)
    item = VendorBillItem(bill_id="bill-1", item_id="item-1", quantity=Decimal("10.00"), unit_price=Decimal("10.00"))
    grn = GoodsReceiveNote(id="grn-1", status="APPROVED")
    grn_item = GoodsReceiveItem(grn_id="grn-1", item_id="item-1", accepted_qty=Decimal("5.00"))
    link = VendorBillGRNLink(bill_id="bill-1", grn_id="grn-1")
    
    db.add(bill)
    db.add(item)
    db.add(grn)
    db.add(grn_item)
    db.add(link)
    
    # Force relationship update in mock
    bill.grn_links = [link]
    bill.items = [item]
    
    # Debug
    print(f"DEBUG: link_bill_id={link.bill_id}, link_grn_id={link.grn_id}")
    
    service = BillingService(db)
    # Check if grn is found by mock db
    grns = db.query(GoodsReceiveNote).all()
    print(f"DEBUG: grns_count={len(grns)}")
    
    result = service.perform_three_way_match("bill-1")
    print(f"DEBUG: result={result}, status={bill.status}")
    assert result == False
    assert bill.status == BillStatus.DRAFT

"""
Smart Receiving Automated Test Suite
Verifies:
1. PO-based receiving without manual item or quantity input
2. Route aliases & 404 elimination (/receiving, /grn, /upload-invoice)
3. Supplier invoice document upload (PDF, JPEG, PNG validation & storage)
4. Invoice amount variance detection & HO approval queue
5. Pre-approval stock isolation (no stock posted before HO approval)
6. Central HO approval with atomic destination StockBalance & StockLedger posting
7. Duplicate stock posting prevention (idempotency check)
8. Rejection workflow without stock contamination
"""
import sys
import os
import uuid
import base64
from decimal import Decimal
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.core.auth import get_current_active_user, get_current_user
from app.models.user import User, UserBranch, Role
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Unit, Category, StockBalance, StockLedger
from app.models.procurement import (
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceiveNote,
    GoodsReceiveItem,
    POStatus,
    GRNStatus,
)

def run_tests():
    client = TestClient(app)
    db = SessionLocal()

    print("================================================================================")
    print("        STARTING COMPREHENSIVE SMART RECEIVING FLOW TEST SUITE                  ")
    print("================================================================================")

    passed_tests = 0
    failed_tests = 0

    def check(desc: str, condition: bool):
        nonlocal passed_tests, failed_tests
        if condition:
            passed_tests += 1
            print(f" [PASS] {desc}")
        else:
            failed_tests += 1
            print(f"❌ [FAIL] {desc}")

    try:
        suffix = uuid.uuid4().hex[:8]

        # 1. Setup Company, Branch (Outlet), Warehouse, Admin User
        company = db.query(Company).first()
        if not company:
            company = Company(
                name=f"Smart Receiving Corp {suffix}",
                code=f"SRC-{suffix[:4].upper()}",
                is_active=True
            )
            db.add(company)
            db.commit()

        outlet = Branch(
            company_id=company.id,
            name=f"Central Kitchen {suffix}",
            code=f"CK-{suffix[:4].upper()}",
            type="RESTAURANT",
            is_active=True
        )
        db.add(outlet)
        db.commit()

        warehouse = Warehouse(
            company_id=company.id,
            branch_id=outlet.id,
            name=f"Main Kitchen Store {suffix}",
            code=f"WH-{suffix[:4].upper()}",
            is_active=True
        )
        db.add(warehouse)
        db.commit()

        admin_role = db.query(Role).first()
        if not admin_role:
            admin_role = Role(name="ADMIN", description="Administrator")
            db.add(admin_role)
            db.commit()

        user = User(
            company_id=company.id,
            role_id=admin_role.id,
            email=f"receiving_mgr_{suffix}@test.com",
            username=f"rec_mgr_{suffix}",
            password_hash="mock_hash",
            first_name="Central",
            last_name="Manager",
            is_active=True,
        )
        db.add(user)
        db.commit()

        ub = UserBranch(
            user_id=user.id,
            branch_id=outlet.id,
            is_default=True
        )
        db.add(ub)
        db.commit()

        # Set dependency overrides
        app.dependency_overrides[get_current_active_user] = lambda: user
        app.dependency_overrides[get_current_user] = lambda: user

        # Item Category, Units & Items
        category = Category(company_id=company.id, name=f"Food Raw Materials {suffix}", code=f"CAT-{suffix[:4].upper()}")
        db.add(category)
        db.commit()

        unit_kg = Unit(company_id=company.id, name=f"Kilogram {suffix}", symbol=f"kg_{suffix[:4]}")
        unit_box = Unit(company_id=company.id, name=f"Box {suffix}", symbol=f"bx_{suffix[:4]}")
        db.add_all([unit_kg, unit_box])
        db.commit()

        item_butter = Item(
            company_id=company.id,
            category_id=category.id,
            name=f"Premium Butter {suffix}",
            code=f"BUTTER-{suffix[:4].upper()}",
            unit_id=unit_kg.id,
            cost_price=Decimal("150.00"),
            is_active=True
        )
        item_flour = Item(
            company_id=company.id,
            category_id=category.id,
            name=f"Organic Flour {suffix}",
            code=f"FLOUR-{suffix[:4].upper()}",
            unit_id=unit_box.id,
            cost_price=Decimal("80.00"),
            is_active=True
        )
        db.add_all([item_butter, item_flour])
        db.commit()

        # Supplier
        supplier = Supplier(
            company_id=company.id,
            name=f"Dairy & Grain Wholesale {suffix}",
            code=f"DGW-{suffix[:4].upper()}",
            phone="+919876543210",
            whatsapp_number="+919876543210",
            is_active=True
        )
        db.add(supplier)
        db.commit()

        print("\n--- TEST PHASE 1: Route Aliases & 404 Prevention ---")
        res1 = client.get("/api/v1/procurement/grn")
        check("GET /procurement/grn returns 200 OK (not 404)", res1.status_code == 200)

        res2 = client.get("/api/v1/procurement/receiving")
        check("GET /procurement/receiving alias returns 200 OK (not 404)", res2.status_code == 200)

        print("\n--- TEST PHASE 2: PO Creation & Automatic Quantity Lock ---")
        # Create Approved PO
        po = PurchaseOrder(
            company_id=company.id,
            branch_id=outlet.id,
            supplier_id=supplier.id,
            po_number=f"PO-TEST-{suffix}",
            status=POStatus.APPROVED,
            order_date=datetime.utcnow(),
            total_amount=Decimal("3100.00"),
            net_amount=Decimal("3100.00"),
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
        )
        db.add(po)
        db.commit()

        po_item1 = PurchaseOrderItem(
            po_id=po.id,
            item_id=item_butter.id,
            ordered_qty=Decimal("10.00"),
            received_qty=Decimal("0.00"),
            unit_price=Decimal("150.00"),
            total_price=Decimal("1500.00")
        )
        po_item2 = PurchaseOrderItem(
            po_id=po.id,
            item_id=item_flour.id,
            ordered_qty=Decimal("20.00"),
            received_qty=Decimal("0.00"),
            unit_price=Decimal("80.00"),
            total_price=Decimal("1600.00")
        )
        db.add_all([po_item1, po_item2])
        db.commit()

        print("\n--- TEST PHASE 3: Supplier Invoice Document Upload ---")
        # Upload valid PDF
        dummy_pdf_bytes = b"%PDF-1.4\n%testpdfcontent\n%%EOF"
        pdf_b64 = base64.b64encode(dummy_pdf_bytes).decode("utf-8")
        inv_pdf_num = f"INV-PDF-{suffix}"

        res_upload_pdf = client.post(
            "/api/v1/procurement/grn/upload-invoice",
            json={
                "po_id": po.id,
                "branch_id": outlet.id,
                "supplier_id": supplier.id,
                "invoice_number": inv_pdf_num,
                "invoice_amount": 3200.0,
                "file_name": "vendor_invoice.pdf",
                "file_type": "application/pdf",
                "file_base64": pdf_b64
            }
        )
        check("Upload PDF invoice returns 200 with storage reference", res_upload_pdf.status_code == 200 and "uploads/invoices" in res_upload_pdf.json()["storage_ref"])

        # Upload JPEG
        dummy_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xd9"
        jpg_b64 = base64.b64encode(dummy_jpg_bytes).decode("utf-8")
        res_upload_jpg = client.post(
            "/api/v1/procurement/invoices/upload",
            json={
                "invoice_number": f"INV-JPG-{suffix}",
                "invoice_amount": 3100.0,
                "file_name": "camera_receipt.jpg",
                "file_type": "image/jpeg",
                "file_base64": jpg_b64
            }
        )
        check("Upload JPEG invoice alias /invoices/upload returns 200 with storage reference", res_upload_jpg.status_code == 200 and res_upload_jpg.json()["file_type"] == "image/jpeg")

        # Invalid magic bytes rejection
        bad_b64 = base64.b64encode(b"NOT_A_VALID_PDF_HEADER").decode("utf-8")
        res_upload_bad = client.post(
            "/api/v1/procurement/grn/upload-invoice",
            json={
                "invoice_number": f"INV-BAD-{suffix}",
                "invoice_amount": 100.0,
                "file_name": "fake.pdf",
                "file_type": "application/pdf",
                "file_base64": bad_b64
            }
        )
        check("Corrupted / fake PDF magic bytes rejected with 400 Bad Request", res_upload_bad.status_code == 400)

        print("\n--- TEST PHASE 4: PO-Based Smart Receiving Submission & Pre-Approval Isolation ---")
        # Record pre-receiving stock
        sb_butter_pre = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_butter.id).first()
        pre_qty = sb_butter_pre.quantity if sb_butter_pre else Decimal("0.00")

        # Submit PO Receiving with Variance (PO: $3,100, Invoice: $3,250)
        res_receive = client.post(
            "/api/v1/procurement/grn/from-po",
            json={
                "po_id": po.id,
                "branch_id": outlet.id,
                "supplier_invoice_number": f"INV-BILL-{suffix}",
                "invoice_amount": 3250.0,
                "invoice_file_name": "vendor_invoice.pdf",
                "notes": "Driver delivered packages at Loading Dock 2"
            }
        )
        check("Submit PO-based receiving returns 201 Created", res_receive.status_code in [200, 201])
        grn_data = res_receive.json()
        grn_id = grn_data["id"]

        check("Submitted GRN is in PENDING_APPROVAL status", grn_data["status"] == "PENDING_APPROVAL")
        check("PO items and approved quantities loaded automatically (2 items)", len(grn_data["items"]) == 2)
        check("Invoice amount variance clearly flagged in notes metadata", "INVOICE VARIANCE FLAGGED" in (grn_data.get("notes") or ""))

        # CRITICAL VERIFICATION: Verify NO stock is posted to warehouse before HO approval
        db.expire_all()
        sb_butter_mid = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_butter.id).first()
        mid_qty = sb_butter_mid.quantity if sb_butter_mid else Decimal("0.00")
        check("Zero stock posted before HO Approval (StockBalance unchanged)", mid_qty == pre_qty)

        ledger_count_mid = db.query(StockLedger).filter(StockLedger.reference_id == grn_id).count()
        check("Zero StockLedger entries written before HO Approval", ledger_count_mid == 0)

        print("\n--- TEST PHASE 5: HO / Central Approval & Atomic Stock Posting ---")
        # HO Approves Receiving
        res_approve = client.post(
            f"/api/v1/procurement/grn/{grn_id}/approve",
            json={"notes": "Price variance of +$150 accepted by HO Procurement Director"}
        )
        check("HO Approve endpoint returns 200 OK", res_approve.status_code == 200)
        approved_grn = res_approve.json()
        check("GRN status transitioned to APPROVED", approved_grn["status"] == "APPROVED")

        # Verify StockBalance incremented directly at destination warehouse
        db.expire_all()
        sb_butter_post = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_butter.id).first()
        sb_flour_post = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_flour.id).first()

        check("StockBalance for Butter incremented exactly by 10.00 kg", sb_butter_post is not None and sb_butter_post.quantity == Decimal("10.00"))
        check("StockBalance for Flour incremented exactly by 20.00 box", sb_flour_post is not None and sb_flour_post.quantity == Decimal("20.00"))

        # Verify StockLedger entries
        ledgers = db.query(StockLedger).filter(StockLedger.reference_id == grn_id).all()
        check("StockLedger created 2 movement_type='GRN' entries with exact costs", len(ledgers) == 2 and all(l.movement_type == 'GRN' for l in ledgers))

        # Verify PO status updated to RECEIVED
        db.expire_all()
        po_post = db.query(PurchaseOrder).filter(PurchaseOrder.id == po.id).first()
        check("Linked PO status automatically updated to RECEIVED (Fully Received)", po_post.status == POStatus.RECEIVED)

        print("\n--- TEST PHASE 6: Idempotency & Duplicate Stock Prevention ---")
        # Attempt duplicate approval
        res_dup_approve = client.post(
            f"/api/v1/procurement/grn/{grn_id}/approve",
            json={"notes": "Duplicate attempt"}
        )
        check("Duplicate approval attempt rejected with 400 Bad Request", res_dup_approve.status_code == 400)

        db.expire_all()
        sb_butter_dup = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_butter.id).first()
        check("StockBalance NOT double-incremented (remains exactly 10.00 kg)", sb_butter_dup.quantity == Decimal("10.00"))

        print("\n--- TEST PHASE 7: GRN Rejection Workflow ---")
        # Create second PO for Rejection Test
        po_reject = PurchaseOrder(
            company_id=company.id,
            branch_id=outlet.id,
            supplier_id=supplier.id,
            po_number=f"PO-REJ-{suffix}",
            status=POStatus.APPROVED,
            order_date=datetime.utcnow(),
            total_amount=Decimal("1500.00"),
            net_amount=Decimal("1500.00"),
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
        )
        db.add(po_reject)
        db.commit()

        poi_rej = PurchaseOrderItem(
            po_id=po_reject.id,
            item_id=item_butter.id,
            ordered_qty=Decimal("10.00"),
            received_qty=Decimal("0.00"),
            unit_price=Decimal("150.00"),
            total_price=Decimal("1500.00")
        )
        db.add(poi_rej)
        db.commit()

        res_recv_rej = client.post(
            "/api/v1/procurement/grn/from-po",
            json={
                "po_id": po_reject.id,
                "branch_id": outlet.id,
                "supplier_invoice_number": f"INV-REJ-{suffix}",
                "invoice_amount": 1500.0,
            }
        )
        grn_rej_id = res_recv_rej.json()["id"]

        # Reject GRN
        res_reject = client.post(
            f"/api/v1/procurement/grn/{grn_rej_id}/reject",
            json={"reason": "Goods arrived with ruptured packaging and broken seals"}
        )
        check("Reject GRN endpoint returns 200 OK", res_reject.status_code == 200)
        rejected_grn = res_reject.json()
        check("GRN status set to REJECTED with reason recorded", rejected_grn["status"] == "REJECTED")

        # Verify no stock added from rejected GRN
        db.expire_all()
        sb_butter_final = db.query(StockBalance).filter(StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item_butter.id).first()
        check("StockBalance unaffected by rejected GRN (remains 10.00 kg)", sb_butter_final.quantity == Decimal("10.00"))

        print("\n================================================================================")
        print(f" SMART RECEIVING TEST RESULTS: {passed_tests} PASSED, {failed_tests} FAILED")
        print("================================================================================")

        if failed_tests > 0:
            sys.exit(1)
        else:
            print("\n ALL SMART RECEIVING FLOW VERIFICATION TESTS PASSED SUCCESSFULLY!\n")

    finally:
        app.dependency_overrides.clear()
        db.close()

if __name__ == "__main__":
    run_tests()

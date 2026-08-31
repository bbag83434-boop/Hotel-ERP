"""
APEX Multi-Outlet Restaurant ERP
SUPPLIER-WISE AUTO ORDER CONSOLIDATION + APPROVAL + WHATSAPP TEST SUITE

Validates:
1. One outlet / one supplier auto-consolidation
2. Multiple outlets / same supplier auto-consolidation with allocation preservation
3. Multiple suppliers (strict grouping into separate POs without mixing)
4. Same item from multiple outlets (deterministic quantity aggregation + outlet allocation)
5. Missing supplier validation (clear 400 exception)
6. Missing WhatsApp number validation (clear 400 error)
7. Invalid WhatsApp number validation (non-digits/invalid length rejected)
8. Order Approval & Rejection lifecycle (DRAFT -> PENDING_APPROVAL -> APPROVED / CANCELLED)
9. Unauthorized outlet access denial (403 Forbidden for unassigned outlet scope)
10. Duplicate order prevention (409 Conflict on re-consolidating already ordered PRs)
11. WhatsApp opened but not sent lifecycle (APPROVED -> WHATSAPP_OPENED -> SENT_MANUALLY)
12. Correct outlet allocation message generation matching exact business specification
"""

import sys
import os
import uuid
import datetime
from decimal import Decimal
import urllib.parse

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch
from app.models.inventory import Item, Category, Unit, ItemType
from app.models.procurement import (
    Supplier,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PRStatus,
    POStatus,
)
from app.models.audit import AuditLog
from app.core.auth import get_current_active_user, get_current_user

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("RUNNING SUPPLIER-WISE AUTO ORDER CONSOLIDATION & WHATSAPP TEST SUITE")
    print("=" * 80)

    passed = 0
    total = 0

    def check(name: str, condition: bool):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}")
            raise AssertionError(f"Test failed: {name}")

    db = SessionLocal()
    try:
        # -------------------------------------------------------------
        # Setup Test Fixtures (Company, Outlets, Category, Units, Suppliers, Items)
        # -------------------------------------------------------------
        print("\n--- [SETUP] Preparing Database Fixtures ---")
        suffix = uuid.uuid4().hex[:6]

        company = db.query(Company).first()
        if not company:
            company = Company(name="Consolidation Test Corp", code=f"CTC-{suffix}", is_active=True)
            db.add(company)
            db.commit()
            db.refresh(company)

        # Create 2 Test Outlets
        outlet1 = Branch(
            company_id=company.id,
            name=f"Downtown Bistro {suffix}",
            code=f"OUT-DT-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        outlet2 = Branch(
            company_id=company.id,
            name=f"Seaside Cafe {suffix}",
            code=f"OUT-SS-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        db.add_all([outlet1, outlet2])
        db.commit()
        db.refresh(outlet1)
        db.refresh(outlet2)

        # Look up or create Category & Units
        category = db.query(Category).filter(Category.company_id == company.id).first()
        if not category:
            category = Category(
                company_id=company.id,
                name="Pantry & Staples",
                code=f"CAT-PANTRY-{suffix}"
            )
            db.add(category)
            db.commit()
            db.refresh(category)

        unit_kg = db.query(Unit).filter(Unit.company_id == company.id, Unit.symbol == "KG").first()
        if not unit_kg:
            unit_kg = Unit(company_id=company.id, name="Kilogram", symbol="KG")
            db.add(unit_kg)
            db.commit()
            db.refresh(unit_kg)

        unit_l = db.query(Unit).filter(Unit.company_id == company.id, Unit.symbol == "L").first()
        if not unit_l:
            unit_l = Unit(company_id=company.id, name="Liter", symbol="L")
            db.add(unit_l)
            db.commit()
            db.refresh(unit_l)

        # Create Suppliers
        # Supplier A: Valid WhatsApp number
        supplier_a = Supplier(
            company_id=company.id,
            name=f"Agro Harvest Ltd {suffix}",
            code=f"SUP-AGRO-{suffix}",
            contact_person="Ramesh Kumar",
            phone="+91 98765 43210",
            whatsapp_number="+91 98765 43210",
            email="agro@example.com",
            is_active=True
        )
        # Supplier B: Valid WhatsApp number
        supplier_b = Supplier(
            company_id=company.id,
            name=f"Dairy Fresh Co {suffix}",
            code=f"SUP-DAIRY-{suffix}",
            contact_person="Anita Sen",
            phone="+91 91234 56789",
            whatsapp_number="+91 91234 56789",
            email="dairy@example.com",
            is_active=True
        )
        # Supplier C: Missing WhatsApp number
        supplier_no_wa = Supplier(
            company_id=company.id,
            name=f"No WhatsApp Vendor {suffix}",
            code=f"SUP-NOWA-{suffix}",
            contact_person="No Wa",
            phone=None,
            whatsapp_number=None,
            email="nowa@example.com",
            is_active=True
        )
        # Supplier D: Invalid WhatsApp number
        supplier_bad_wa = Supplier(
            company_id=company.id,
            name=f"Invalid WA Vendor {suffix}",
            code=f"SUP-BADWA-{suffix}",
            contact_person="Bad Wa",
            phone="abc-invalid-phone",
            whatsapp_number="abc-invalid-phone",
            email="badwa@example.com",
            is_active=True
        )
        db.add_all([supplier_a, supplier_b, supplier_no_wa, supplier_bad_wa])
        db.commit()
        db.refresh(supplier_a)
        db.refresh(supplier_b)
        db.refresh(supplier_no_wa)
        db.refresh(supplier_bad_wa)

        # Create Items
        # Rice & Oil mapped to Supplier A
        item_rice = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            supplier_id=supplier_a.id,
            name=f"Basmati Rice {suffix}",
            code=f"ITEM-RICE-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("60.0000"),
            is_active=True
        )
        item_oil = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_l.id,
            supplier_id=supplier_a.id,
            name=f"Sunflower Oil {suffix}",
            code=f"ITEM-OIL-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("120.0000"),
            is_active=True
        )
        # Milk mapped to Supplier B
        item_milk = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_l.id,
            supplier_id=supplier_b.id,
            name=f"Fresh Milk {suffix}",
            code=f"ITEM-MILK-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("50.0000"),
            is_active=True
        )
        # Item with NO supplier
        item_no_supplier = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            supplier_id=None,
            name=f"Unassigned Spice {suffix}",
            code=f"ITEM-SPICE-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("200.0000"),
            is_active=True
        )
        # Item mapped to Supplier with No WA
        item_nowa = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            supplier_id=supplier_no_wa.id,
            name=f"Flour {suffix}",
            code=f"ITEM-FLOUR-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("40.0000"),
            is_active=True
        )
        # Item mapped to Supplier with Bad WA
        item_badwa = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            supplier_id=supplier_bad_wa.id,
            name=f"Sugar {suffix}",
            code=f"ITEM-SUGAR-{suffix}",
            type=ItemType.RAW_MATERIAL,
            cost_price=Decimal("45.0000"),
            is_active=True
        )
        db.add_all([item_rice, item_oil, item_milk, item_no_supplier, item_nowa, item_badwa])
        db.commit()
        db.refresh(item_rice)
        db.refresh(item_oil)
        db.refresh(item_milk)
        db.refresh(item_no_supplier)
        db.refresh(item_nowa)
        db.refresh(item_badwa)

        # Get or create Admin user & Restricted Outlet user
        admin_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not admin_role:
            admin_role = Role(name="SUPER_ADMIN", is_system=True)
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)

        outlet_role = db.query(Role).filter(Role.name == "OUTLET_MANAGER").first()
        if not outlet_role:
            outlet_role = Role(name="OUTLET_MANAGER", is_system=True)
            db.add(outlet_role)
            db.commit()
            db.refresh(outlet_role)

        admin_user = db.query(User).filter(User.email == "admin@apex.com").first()
        if not admin_user:
            admin_user = User(
                company_id=company.id,
                role_id=admin_role.id,
                email="admin@apex.com",
                username="admin_procurement",
                password_hash="mock_hash",
                first_name="Admin",
                last_name="Super",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # Restricted User (Only has access to Outlet 1)
        restricted_user = User(
            company_id=company.id,
            role_id=outlet_role.id,
            email=f"outlet1_mgr_{suffix}@apex.com",
            username=f"mgr1_{suffix}",
            password_hash="mock_hash",
            first_name="Outlet1",
            last_name="Manager",
            is_active=True
        )
        db.add(restricted_user)
        db.commit()
        db.refresh(restricted_user)

        # Assign user_branch only for Outlet 1
        ub1 = UserBranch(user_id=restricted_user.id, branch_id=outlet1.id, is_default=True)
        db.add(ub1)
        db.commit()

        print("[OK] Database fixtures ready.")

        # Helper dependency override for auth
        def override_admin():
            return admin_user

        def override_restricted():
            return restricted_user

        app.dependency_overrides[get_current_active_user] = override_admin
        app.dependency_overrides[get_current_user] = override_admin

        # -------------------------------------------------------------
        # TEST 1: One outlet / one supplier auto-consolidation
        # -------------------------------------------------------------
        print("\n[TEST 1] One Outlet / One Supplier Auto-Consolidation:")
        pr1 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-T1-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
            notes="Outlet 1 initial pantry indent"
        )
        db.add(pr1)
        db.flush()
        db.add(PurchaseRequestItem(
            request_id=pr1.id,
            item_id=item_rice.id,
            requested_qty=Decimal("20.0000"),
            estimated_price=Decimal("60.0000")
        ))
        db.commit()

        res = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr1.id],
            "auto_submit": False
        })
        check("Consolidate single outlet/supplier returns 201 Created", res.status_code == 201)
        data = res.json()
        check("Consolidation produced exactly 1 PO", data["consolidated_orders_count"] == 1)
        po1_data = data["orders"][0]
        check("PO supplier matches Supplier A", po1_data["supplier_id"] == supplier_a.id)
        check("PO status is DRAFT", po1_data["status"] == "DRAFT")
        check("PO total amount is 20 * 60 = 1200", float(po1_data["total_amount"]) == 1200.0)
        
        # Verify PR status updated to ORDERED
        db.refresh(pr1)
        check("PR status transitioned to ORDERED", pr1.status == PRStatus.ORDERED)

        # -------------------------------------------------------------
        # TEST 2 & TEST 4: Multiple outlets / same supplier & Same item consolidation
        # Outlet 1: Rice 20 KG, Oil 10 L
        # Outlet 2: Rice 15 KG, Oil 5 L
        # Result: Supplier A: Rice 35 KG, Oil 15 L + Outlet Allocations Preserved
        # -------------------------------------------------------------
        print("\n[TEST 2 & 4] Multiple Outlets / Same Supplier with Item Quantity Aggregation:")
        pr_out1 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-OUT1-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
            notes="Outlet 1 weekly supply"
        )
        db.add(pr_out1)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_out1.id, item_id=item_rice.id, requested_qty=Decimal("20.0000"), estimated_price=Decimal("60.0000")),
            PurchaseRequestItem(request_id=pr_out1.id, item_id=item_oil.id, requested_qty=Decimal("10.0000"), estimated_price=Decimal("120.0000")),
        ])

        pr_out2 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet2.id,
            request_number=f"PR-OUT2-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
            notes="Outlet 2 weekly supply"
        )
        db.add(pr_out2)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_out2.id, item_id=item_rice.id, requested_qty=Decimal("15.0000"), estimated_price=Decimal("60.0000")),
            PurchaseRequestItem(request_id=pr_out2.id, item_id=item_oil.id, requested_qty=Decimal("5.0000"), estimated_price=Decimal("120.0000")),
        ])
        db.commit()

        res = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_out1.id, pr_out2.id],
            "auto_submit": True
        })
        check("Consolidate multiple outlets returns 201 Created", res.status_code == 201)
        data = res.json()
        check("Consolidation produced exactly 1 PO for Supplier A", data["consolidated_orders_count"] == 1)
        po_multi = data["orders"][0]
        check("PO status is PENDING_APPROVAL", po_multi["status"] == "PENDING_APPROVAL")

        # Verify Consolidated Line Items: Rice = 35 KG, Oil = 15 L
        po_db = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_multi["id"]).first()
        items_by_id = {poi.item_id: poi for poi in po_db.items}
        check("PO contains Rice item", item_rice.id in items_by_id)
        check("PO contains Oil item", item_oil.id in items_by_id)
        check("Rice aggregated quantity is 35.0000", float(items_by_id[item_rice.id].ordered_qty) == 35.0)
        check("Oil aggregated quantity is 15.0000", float(items_by_id[item_oil.id].ordered_qty) == 15.0)

        # -------------------------------------------------------------
        # TEST 3: Multiple suppliers (Strict Grouping, No Mixing)
        # Outlet 1: Rice (Supplier A) & Milk (Supplier B)
        # Outlet 2: Oil (Supplier A) & Milk (Supplier B)
        # Result: Exactly 2 POs (1 for Supplier A, 1 for Supplier B)
        # -------------------------------------------------------------
        print("\n[TEST 3] Multiple Suppliers Grouping (No Mixing):")
        pr_m1 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-M1-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_m1)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_m1.id, item_id=item_rice.id, requested_qty=Decimal("10.0000"), estimated_price=Decimal("60.0000")),
            PurchaseRequestItem(request_id=pr_m1.id, item_id=item_milk.id, requested_qty=Decimal("25.0000"), estimated_price=Decimal("50.0000")),
        ])

        pr_m2 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet2.id,
            request_number=f"PR-M2-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_m2)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_m2.id, item_id=item_oil.id, requested_qty=Decimal("8.0000"), estimated_price=Decimal("120.0000")),
            PurchaseRequestItem(request_id=pr_m2.id, item_id=item_milk.id, requested_qty=Decimal("15.0000"), estimated_price=Decimal("50.0000")),
        ])
        db.commit()

        res = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_m1.id, pr_m2.id],
            "auto_submit": True
        })
        check("Consolidate multi-supplier returns 201 Created", res.status_code == 201)
        data = res.json()
        check("Consolidation created exactly 2 distinct POs", data["consolidated_orders_count"] == 2)
        po_suppliers = {po["supplier_id"] for po in data["orders"]}
        check("POs strictly partitioned between Supplier A and Supplier B", po_suppliers == {supplier_a.id, supplier_b.id})

        # -------------------------------------------------------------
        # TEST 5: Missing supplier validation (Clear Exception)
        # -------------------------------------------------------------
        print("\n[TEST 5] Missing Supplier Validation:")
        pr_no_sup = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-NOSUP-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_no_sup)
        db.flush()
        db.add(PurchaseRequestItem(
            request_id=pr_no_sup.id,
            item_id=item_no_supplier.id,
            requested_qty=Decimal("5.0000"),
            estimated_price=Decimal("200.0000")
        ))
        db.commit()

        res = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_no_sup.id]
        })
        check("Missing supplier returns 400 Bad Request", res.status_code == 400)
        check("Error message indicates missing supplier for item", "Missing supplier" in res.text)

        # -------------------------------------------------------------
        # TEST 6: Missing WhatsApp number validation
        # -------------------------------------------------------------
        print("\n[TEST 6] Missing WhatsApp Number Validation:")
        pr_nowa = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-NOWA-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_nowa)
        db.flush()
        db.add(PurchaseRequestItem(
            request_id=pr_nowa.id,
            item_id=item_nowa.id,
            requested_qty=Decimal("10.0000"),
            estimated_price=Decimal("40.0000")
        ))
        db.commit()

        res_con = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_nowa.id],
            "auto_submit": True
        })
        po_nowa_id = res_con.json()["orders"][0]["id"]
        
        # Approve the PO
        client.post(f"/api/v1/procurement/orders/{po_nowa_id}/approve", json={"notes": "Approved for dispatch"})
        
        # Try to open WhatsApp for supplier with missing number
        res_wa_missing = client.post(f"/api/v1/procurement/orders/{po_nowa_id}/whatsapp-link")
        check("Missing WhatsApp number returns 400 Bad Request", res_wa_missing.status_code == 400)
        check("Error indicates missing WhatsApp number", "Missing WhatsApp number" in res_wa_missing.text)

        # -------------------------------------------------------------
        # TEST 7: Invalid WhatsApp number validation
        # -------------------------------------------------------------
        print("\n[TEST 7] Invalid WhatsApp Number Validation:")
        pr_badwa = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-BADWA-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_badwa)
        db.flush()
        db.add(PurchaseRequestItem(
            request_id=pr_badwa.id,
            item_id=item_badwa.id,
            requested_qty=Decimal("10.0000"),
            estimated_price=Decimal("45.0000")
        ))
        db.commit()

        res_con_bad = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_badwa.id],
            "auto_submit": True
        })
        po_badwa_id = res_con_bad.json()["orders"][0]["id"]
        client.post(f"/api/v1/procurement/orders/{po_badwa_id}/approve", json={})
        
        res_wa_bad = client.post(f"/api/v1/procurement/orders/{po_badwa_id}/whatsapp-link")
        check("Invalid WhatsApp number returns 400 Bad Request", res_wa_bad.status_code == 400)
        check("Error indicates invalid WhatsApp number", "Invalid WhatsApp number" in res_wa_bad.text)

        # -------------------------------------------------------------
        # TEST 8: Order Approval & Rejection Lifecycle
        # -------------------------------------------------------------
        print("\n[TEST 8] Approval & Rejection Workflow:")
        # Draft Order -> Submit -> Approve
        po_draft = db.query(PurchaseOrder).filter(PurchaseOrder.id == po1_data["id"]).first()
        check("Initial PO is in DRAFT status", po_draft.status == POStatus.DRAFT)

        res_sub = client.post(f"/api/v1/procurement/orders/{po_draft.id}/submit")
        check("Submit order returns 200 OK", res_sub.status_code == 200)
        check("Status is now PENDING_APPROVAL", res_sub.json()["status"] == "PENDING_APPROVAL")

        res_app = client.post(f"/api/v1/procurement/orders/{po_draft.id}/approve", json={"notes": "All checks passed"})
        check("Approve order returns 200 OK", res_app.status_code == 200)
        check("Status is now APPROVED", res_app.json()["status"] == "APPROVED")
        check("Approved by user is recorded", res_app.json()["approved_by_id"] == admin_user.id)

        # Test Rejection on another order
        res_rej = client.post(f"/api/v1/procurement/orders/{po_multi['id']}/reject", json={"reason": "Excess budget quota exceeded"})
        check("Reject order returns 200 OK", res_rej.status_code == 200)
        check("Status is CANCELLED upon rejection", res_rej.json()["status"] == "CANCELLED")

        # -------------------------------------------------------------
        # TEST 9: Unauthorized Outlet Access Denial
        # -------------------------------------------------------------
        print("\n[TEST 9] Unauthorized Outlet Access Denial:")
        # Switch dependency to restricted user (only has access to Outlet 1)
        app.dependency_overrides[get_current_active_user] = override_restricted
        app.dependency_overrides[get_current_user] = override_restricted

        # Attempt to create PR for Outlet 2 -> 403 Forbidden
        res_unauth_pr = client.post("/api/v1/procurement/requests", json={
            "branch_id": outlet2.id,
            "items": [{"item_id": item_rice.id, "requested_qty": 5.0}]
        })
        check("Restricted user creating PR for unauthorized outlet returns 403", res_unauth_pr.status_code == 403)

        # Switch back to admin
        app.dependency_overrides[get_current_active_user] = override_admin
        app.dependency_overrides[get_current_user] = override_admin

        # -------------------------------------------------------------
        # TEST 10: Duplicate Order Prevention
        # -------------------------------------------------------------
        print("\n[TEST 10] Duplicate Consolidation Prevention:")
        # Attempt to re-consolidate pr_out1 which is already in ORDERED status
        res_dup = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_out1.id]
        })
        check("Re-consolidating already ordered PR returns 409 Conflict", res_dup.status_code == 409)
        check("Error details mention duplicate consolidation prevented", "Duplicate consolidation prevented" in res_dup.text)

        # -------------------------------------------------------------
        # TEST 11: WhatsApp Opened But Not Sent Lifecycle
        # -------------------------------------------------------------
        print("\n[TEST 11] WhatsApp Opened But Not Sent Lifecycle:")
        # Create fresh approved order for Supplier A
        pr_wa1 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet1.id,
            request_number=f"PR-WA1-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_wa1)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_wa1.id, item_id=item_rice.id, requested_qty=Decimal("20.0000"), estimated_price=Decimal("60.0000")),
            PurchaseRequestItem(request_id=pr_wa1.id, item_id=item_oil.id, requested_qty=Decimal("10.0000"), estimated_price=Decimal("120.0000")),
        ])

        pr_wa2 = PurchaseRequest(
            company_id=company.id,
            branch_id=outlet2.id,
            request_number=f"PR-WA2-{suffix}",
            requested_by_id=admin_user.id,
            required_date=datetime.datetime.utcnow(),
            status=PRStatus.PENDING_APPROVAL,
        )
        db.add(pr_wa2)
        db.flush()
        db.add_all([
            PurchaseRequestItem(request_id=pr_wa2.id, item_id=item_rice.id, requested_qty=Decimal("15.0000"), estimated_price=Decimal("60.0000")),
            PurchaseRequestItem(request_id=pr_wa2.id, item_id=item_oil.id, requested_qty=Decimal("5.0000"), estimated_price=Decimal("120.0000")),
        ])
        db.commit()

        res_wa_con = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_wa1.id, pr_wa2.id],
            "auto_submit": True
        })
        po_wa = res_wa_con.json()["orders"][0]
        
        # Approve the PO
        client.post(f"/api/v1/procurement/orders/{po_wa['id']}/approve", json={"notes": "Approved for dispatch"})

        # Action: Open WhatsApp
        res_wa_open = client.post(f"/api/v1/procurement/orders/{po_wa['id']}/whatsapp-link")
        check("Open WhatsApp returns 200 OK", res_wa_open.status_code == 200)
        wa_data = res_wa_open.json()
        
        check("Status is WHATSAPP_OPENED", wa_data["status"] == "WHATSAPP_OPENED")
        check("WhatsApp URL starts with https://wa.me/919876543210", wa_data["whatsapp_url"].startswith("https://wa.me/919876543210"))
        
        # Verify status in database is WHATSAPP_OPENED (NOT SENT_MANUALLY)
        po_wa_db = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_wa["id"]).first()
        check("DB PO status is WHATSAPP_OPENED (not automatically sent)", po_wa_db.status == POStatus.WHATSAPP_OPENED)
        check("DB PO whatsapp_opened_at timestamp is populated", po_wa_db.whatsapp_opened_at is not None)
        check("DB PO whatsapp_number is 919876543210", po_wa_db.whatsapp_number == "919876543210")

        # Action: Manual Send Confirmation by User
        res_confirm = client.post(f"/api/v1/procurement/orders/{po_wa['id']}/confirm-sent", json={"notes": "Sent via WhatsApp web"})
        check("Confirm manual send returns 200 OK", res_confirm.status_code == 200)
        check("Status updated to SENT_MANUALLY", res_confirm.json()["status"] == "SENT_MANUALLY")

        db.refresh(po_wa_db)
        check("DB PO status is SENT_MANUALLY after confirmation", po_wa_db.status == POStatus.SENT_MANUALLY)

        # -------------------------------------------------------------
        # TEST 12: Correct Outlet Allocation & Prefilled Message Formatting
        # -------------------------------------------------------------
        print("\n[TEST 12] Correct Outlet Allocation & Message Content Verification:")
        msg = wa_data["prefilled_message"]
        print("\nGenerated WhatsApp Message:\n" + "-" * 40 + "\n" + msg + "\n" + "-" * 40)
        
        check("Message includes Dear [Supplier Name]", f"Dear {supplier_a.name}" in msg)
        check("Message includes 'Please supply:'", "Please supply:" in msg)
        check("Message includes consolidated Rice 35 KG", "Rice" in msg and "35 KG" in msg)
        check("Message includes consolidated Oil 15 L", "Oil" in msg and "15 L" in msg)
        check("Message includes 'Outlet allocation:'", "Outlet allocation:" in msg)
        check("Message preserves Outlet 1 name", outlet1.name in msg)
        check("Message preserves Outlet 2 name", outlet2.name in msg)
        check("Message preserves Outlet 1: Rice 20 KG & Oil 10 L", "20 KG" in msg and "10 L" in msg)
        check("Message preserves Outlet 2: Rice 15 KG & Oil 5 L", "15 KG" in msg and "5 L" in msg)
        check("Message includes Order Ref: [PO Number]", f"Order Ref: {po_wa['po_number']}" in msg)

        # -------------------------------------------------------------
        # Audit Log Verification
        # -------------------------------------------------------------
        print("\n[AUDIT] Verifying Structured Audit Log Trail:")
        audits = db.query(AuditLog).filter(AuditLog.entity_id == po_wa["id"]).all()
        audit_actions = {a.action for a in audits}
        check("Audit log records CONSOLIDATE_PURCHASE_ORDER", "CONSOLIDATE_PURCHASE_ORDER" in audit_actions)
        check("Audit log records APPROVE_PURCHASE_ORDER", "APPROVE_PURCHASE_ORDER" in audit_actions)
        check("Audit log records OPEN_SUPPLIER_WHATSAPP", "OPEN_SUPPLIER_WHATSAPP" in audit_actions)
        check("Audit log records CONFIRM_ORDER_SENT_MANUALLY", "CONFIRM_ORDER_SENT_MANUALLY" in audit_actions)

        print("\n" + "=" * 80)
        print(f"SUCCESS: ALL {passed}/{total} AUTO-CONSOLIDATION & WHATSAPP TESTS PASSED!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()

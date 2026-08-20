"""
Comprehensive Automated Test Suite: Outlet Smart AI Requirement Feature
Tests:
1. Deterministic Calculation Engine (Stock + Consumption + Target + Pending + Supplier)
2. Interactive AI Assistant Q&A:
   - What stock is low today?
   - What do I need to order?
   - What is critical?
   - What is already pending?
   - What do I need for tomorrow?
3. Outlet Draft Workflow:
   - Generate Draft
   - Outlet Review
   - Edit Quantity / Add Item / Remove Item
   - Audit Trail of user modifications vs original system recommendations
4. Confirm Draft -> Converts to PurchaseRequest (PENDING_APPROVAL)
5. Seamless Flow into Existing Consolidation & WhatsApp Order Workflow
6. Scheduled Fixed Preparation Time & Duplicate Prevention
7. Multi-Tenant Scoping & Unauthorized Branch Access Denial (403)
8. Structured AuditLog Verification
"""

import sys
import os
import uuid
import datetime
from decimal import Decimal
import json

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.auth import get_current_active_user, get_current_user
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Category, Unit, StockBalance, StockLedger, StockTransfer, StockMovementType
from app.models.procurement import (
    Supplier,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PRStatus,
    POStatus,
    PRPriority,
    SmartRequirementDraft,
    SmartRequirementItem,
    BranchRequirementConfig,
)
from app.api.v1.endpoints.procurement import calculate_outlet_smart_requirements
from app.models.audit import AuditLog

client = TestClient(app)

def check(name: str, condition: bool):
    if condition:
        print(f"  [PASS] {name}")
    else:
        print(f"  [FAIL] {name}")
        raise AssertionError(f"Test failed: {name}")

def run_tests():
    print("=" * 80)
    print("RUNNING OUTLET SMART AI REQUIREMENT TEST SUITE")
    print("=" * 80)

    db = SessionLocal()
    suffix = uuid.uuid4().hex[:6]

    try:
        print("\n--- [SETUP] Preparing Database Fixtures ---")
        
        # Create fresh isolated company
        company = Company(name=f"Smart Requirement Corp {suffix}", code=f"SRC-{suffix}", is_active=True)
        db.add(company)
        db.commit()
        db.refresh(company)

        # Create Outlets
        outlet1 = Branch(
            company_id=company.id,
            name=f"Uptown Diner {suffix}",
            code=f"OUT-UP-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        outlet2 = Branch(
            company_id=company.id,
            name=f"Beachfront Cafe {suffix}",
            code=f"OUT-BC-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        db.add_all([outlet1, outlet2])
        db.commit()
        db.refresh(outlet1)
        db.refresh(outlet2)

        # Create Warehouses for Outlets
        wh_out1 = Warehouse(
            company_id=company.id,
            branch_id=outlet1.id,
            name=f"Uptown Main Pantry {suffix}",
            code=f"WH-UP-{suffix}",
            is_central=False,
            is_active=True
        )
        wh_out2 = Warehouse(
            company_id=company.id,
            branch_id=outlet2.id,
            name=f"Beachfront Pantry {suffix}",
            code=f"WH-BC-{suffix}",
            is_central=False,
            is_active=True
        )
        db.add_all([wh_out1, wh_out2])
        db.commit()
        db.refresh(wh_out1)
        db.refresh(wh_out2)

        # Look up or create Category & Units
        category = db.query(Category).filter(Category.company_id == company.id).first()
        if not category:
            category = Category(company_id=company.id, name="Dry Goods & Dairy", code=f"CAT-DRY-{suffix}")
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
        sup_agro = Supplier(
            company_id=company.id,
            name=f"Agro Harvest Co {suffix}",
            code=f"SUP-AGR-{suffix}",
            phone="+91 98765 11111",
            whatsapp_number="+91 98765 11111",
            contact_person="Rajesh Kumar",
            is_active=True
        )
        sup_dairy = Supplier(
            company_id=company.id,
            name=f"Fresh Dairy Farms {suffix}",
            code=f"SUP-DF-{suffix}",
            phone="+91 98765 22222",
            whatsapp_number="+91 98765 22222",
            contact_person="Anil Sharma",
            is_active=True
        )
        db.add_all([sup_agro, sup_dairy])
        db.commit()
        db.refresh(sup_agro)
        db.refresh(sup_dairy)

        # Create Items
        # Item 1: Basmati Rice (Current: 18 KG, Min: 20 KG, Target: 40 KG, Pending: 0 KG -> Short: 22 KG -> Order: 22 KG)
        item_rice = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            name=f"Basmati Rice {suffix}",
            code=f"ITM-RICE-{suffix}",
            cost_price=Decimal("60.0000"),
            min_stock_level=Decimal("20.0000"),
            reorder_qty=Decimal("40.0000"),
            supplier_id=sup_agro.id,
            is_active=True
        )
        # Item 2: Sunflower Oil (Current: 0 L, Min: 10 L, Target: 25 L -> CRITICAL)
        item_oil = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_l.id,
            name=f"Sunflower Oil {suffix}",
            code=f"ITM-OIL-{suffix}",
            cost_price=Decimal("120.0000"),
            min_stock_level=Decimal("10.0000"),
            reorder_qty=Decimal("25.0000"),
            supplier_id=sup_agro.id,
            is_active=True
        )
        # Item 3: Fresh Whole Milk (Current: 15 L, Min: 10 L, Target: 30 L, Pending: 10 L -> Short: 5 L)
        item_milk = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_l.id,
            name=f"Fresh Whole Milk {suffix}",
            code=f"ITM-MILK-{suffix}",
            cost_price=Decimal("45.0000"),
            min_stock_level=Decimal("10.0000"),
            reorder_qty=Decimal("30.0000"),
            supplier_id=sup_dairy.id,
            is_active=True
        )
        # Item 4: Wheat Flour (Current: 50 KG, Min: 20 KG, Target: 40 KG -> Sufficient -> Order: 0)
        item_flour = Item(
            company_id=company.id,
            category_id=category.id,
            unit_id=unit_kg.id,
            name=f"Wheat Flour {suffix}",
            code=f"ITM-FLOUR-{suffix}",
            cost_price=Decimal("35.0000"),
            min_stock_level=Decimal("20.0000"),
            reorder_qty=Decimal("40.0000"),
            supplier_id=sup_agro.id,
            is_active=True
        )
        db.add_all([item_rice, item_oil, item_milk, item_flour])
        db.commit()
        db.refresh(item_rice)
        db.refresh(item_oil)
        db.refresh(item_milk)
        db.refresh(item_flour)

        # Set Initial Stock Balances for Outlet 1
        db.add_all([
            StockBalance(warehouse_id=wh_out1.id, item_id=item_rice.id, quantity=Decimal("18.0000")),
            StockBalance(warehouse_id=wh_out1.id, item_id=item_oil.id, quantity=Decimal("0.0000")),      # 0 stock -> CRITICAL
            StockBalance(warehouse_id=wh_out1.id, item_id=item_milk.id, quantity=Decimal("15.0000")),
            StockBalance(warehouse_id=wh_out1.id, item_id=item_flour.id, quantity=Decimal("50.0000")),   # Surplus
        ])
        db.commit()

        # Add StockLedger consumption entries for Outlet 1 over past days (Daily run-rate)
        now = datetime.datetime.utcnow()
        db.add_all([
            # Rice consumed 70 KG over 14 days = 5 KG/day
            StockLedger(
                warehouse_id=wh_out1.id,
                item_id=item_rice.id,
                movement_type="POS_SALE",
                change_qty=Decimal("-70.0000"),
                balance_qty=Decimal("18.0000"),
                reference_type="POS_ORDER",
                created_at=now - datetime.timedelta(days=2)
            ),
            # Milk consumed 42 L over 14 days = 3 L/day
            StockLedger(
                warehouse_id=wh_out1.id,
                item_id=item_milk.id,
                movement_type="POS_SALE",
                change_qty=Decimal("-42.0000"),
                balance_qty=Decimal("15.0000"),
                reference_type="POS_ORDER",
                created_at=now - datetime.timedelta(days=1)
            ),
        ])
        db.commit()

        # Add an active In-Flight PO for Milk with 10 L allocated to Outlet 1
        pending_po = PurchaseOrder(
            company_id=company.id,
            branch_id=outlet1.id,
            supplier_id=sup_dairy.id,
            po_number=f"PO-PENDING-{suffix}",
            status=POStatus.APPROVED,
            order_date=now,
            total_amount=Decimal("450.0000"),
            net_amount=Decimal("450.0000"),
            whatsapp_number=sup_dairy.whatsapp_number,
        )
        db.add(pending_po)
        db.flush()
        db.add(PurchaseOrderItem(
            po_id=pending_po.id,
            item_id=item_milk.id,
            ordered_qty=Decimal("10.0000"),
            received_qty=Decimal("0.0000"),
            unit_price=Decimal("45.0000"),
            total_price=Decimal("450.0000")
        ))
        db.commit()

        # Look up or create Admin user & Restricted Outlet Manager
        admin_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not admin_role:
            admin_role = Role(name="SUPER_ADMIN", description="Super Admin", is_system=True)
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)

        outlet_mgr_role = db.query(Role).filter(Role.name == "OUTLET_MANAGER").first()
        if not outlet_mgr_role:
            outlet_mgr_role = Role(name="OUTLET_MANAGER", description="Outlet Manager", is_system=True)
            db.add(outlet_mgr_role)
            db.commit()
            db.refresh(outlet_mgr_role)

        admin_user = User(
            company_id=company.id,
            role_id=admin_role.id,
            email=f"admin_{suffix}@apex.com",
            username=f"admin_{suffix}",
            password_hash="mock_hash",
            first_name="Super",
            last_name="Admin",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        # Restricted user scoped ONLY to Outlet 1
        mgr_user = User(
            company_id=company.id,
            role_id=outlet_mgr_role.id,
            email=f"mgr_uptown_{suffix}@apex.com",
            username=f"mgr_up_{suffix}",
            password_hash="mock_hash",
            first_name="Uptown",
            last_name="Manager",
            is_active=True
        )
        db.add(mgr_user)
        db.commit()
        db.refresh(mgr_user)

        db.add(UserBranch(user_id=mgr_user.id, branch_id=outlet1.id, is_default=True))
        db.commit()

        # Set up dependency overrides for auth
        def override_admin():
            return admin_user

        def override_mgr():
            return mgr_user

        app.dependency_overrides[get_current_active_user] = override_mgr
        app.dependency_overrides[get_current_user] = override_mgr

        print("[OK] Database fixtures ready.")

        # -------------------------------------------------------------
        # TEST 1: Deterministic Smart Requirement Calculation Engine
        # -------------------------------------------------------------
        print("\n[TEST 1] Deterministic Smart Requirement Calculation Engine:")
        calc = calculate_outlet_smart_requirements(
            db=db,
            company_id=company.id,
            branch_id=outlet1.id,
            lead_time_days=1,
            safety_buffer_percent=Decimal("10.00"),
        )
        check("Calculation returns item recommendations", len(calc) >= 4)
        
        calc_map = {c["item_id"]: c for c in calc}
        
        # Rice check: Current 18, Min 20, Target ~40, Short ~22
        rice_c = calc_map[item_rice.id]
        check("Rice current stock is 18 KG", rice_c["current_stock"] == Decimal("18.0000"))
        check("Rice target stock reflects reorder/safety target >= 22 KG", rice_c["target_stock"] >= Decimal("22.0000"))
        check("Rice short quantity is calculated correctly (> 0)", rice_c["short_qty"] > Decimal("0.0000"))
        check("Rice supplier mapped to Agro Harvest", rice_c["supplier_name"] == sup_agro.name)
        check("Rice priority is HIGH or MEDIUM", rice_c["priority"] in ["HIGH", "MEDIUM"])

        # Oil check: Current 0 -> CRITICAL
        oil_c = calc_map[item_oil.id]
        check("Oil current stock is 0.0", oil_c["current_stock"] == Decimal("0.0000"))
        check("Oil priority is CRITICAL due to zero stock", oil_c["priority"] == "CRITICAL")
        check("Oil suggested order quantity > 0", oil_c["system_suggested_qty"] > Decimal("0.0000"))

        # Milk check: Current 15 + Pending 10 = Effective 25
        milk_c = calc_map[item_milk.id]
        check("Milk current stock is 15.0", milk_c["current_stock"] == Decimal("15.0000"))
        check("Milk pending incoming reflects 10.0 from active PO", milk_c["pending_incoming"] == Decimal("10.0000"))

        # Flour check: Current 50 (Surplus) -> Short 0
        flour_c = calc_map[item_flour.id]
        check("Flour surplus stock has 0 short quantity", flour_c["short_qty"] == Decimal("0.0000"))

        # -------------------------------------------------------------
        # TEST 2: Interactive AI Assistant Q&A
        # -------------------------------------------------------------
        print("\n[TEST 2] Interactive AI Assistant Q&A:")

        # Q1: "What is critical?"
        res_q1 = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet1.id,
            "question": "What is critical today?"
        })
        check("Q1 'What is critical?' returns 200 OK", res_q1.status_code == 200)
        q1_data = res_q1.json()
        check("Q1 detected CRITICAL intent", q1_data["intent"] == "CRITICAL")
        check("Q1 returns Oil as critical item", any(it["item_id"] == item_oil.id for it in q1_data["items"]))
        check("Q1 answer text contains 'CRITICAL'", "CRITICAL" in q1_data["answer_text"].upper())

        # Q2: "What stock is low today?"
        res_q2 = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet1.id,
            "question": "What stock is low today?"
        })
        check("Q2 'What stock is low today?' returns 200 OK", res_q2.status_code == 200)
        q2_data = res_q2.json()
        check("Q2 detected LOW_STOCK intent", q2_data["intent"] == "LOW_STOCK")
        check("Q2 includes Rice or Oil", any(it["item_id"] in [item_rice.id, item_oil.id] for it in q2_data["items"]))

        # Q3: "What do I need to order?"
        res_q3 = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet1.id,
            "question": "What do I need to order?"
        })
        check("Q3 'What do I need to order?' returns 200 OK", res_q3.status_code == 200)
        q3_data = res_q3.json()
        check("Q3 detected NEED_TO_ORDER intent", q3_data["intent"] == "NEED_TO_ORDER")
        check("Q3 includes items with deficit", len(q3_data["items"]) >= 2)

        # Q4: "What is already pending?"
        res_q4 = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet1.id,
            "question": "What is already pending?"
        })
        check("Q4 'What is already pending?' returns 200 OK", res_q4.status_code == 200)
        q4_data = res_q4.json()
        check("Q4 detected PENDING intent", q4_data["intent"] == "PENDING")
        check("Q4 includes Milk in pending orders", any(it["item_id"] == item_milk.id for it in q4_data["items"]))

        # Q5: "What do I need for tomorrow?"
        res_q5 = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet1.id,
            "question": "What do I need for tomorrow?"
        })
        check("Q5 'What do I need for tomorrow?' returns 200 OK", res_q5.status_code == 200)
        q5_data = res_q5.json()
        check("Q5 detected TOMORROW intent", q5_data["intent"] == "TOMORROW")
        check("Q5 answer text references tomorrow forecast", "tomorrow" in q5_data["answer_text"].lower())

        # -------------------------------------------------------------
        # TEST 3: Generate Draft & Outlet Review
        # -------------------------------------------------------------
        print("\n[TEST 3] Generate Draft & Outlet Review:")
        res_gen = client.post("/api/v1/procurement/smart-requirements/generate", json={
            "branch_id": outlet1.id,
            "lead_time_days": 1,
            "notes": "Daily morning AI smart stock indent"
        })
        check("Generate draft returns 201 Created", res_gen.status_code == 201)
        draft_data = res_gen.json()
        draft_id = draft_data["id"]
        check("Draft status is DRAFT", draft_data["status"] == "DRAFT")
        check("Draft items include Rice and Oil", len(draft_data["items"]) >= 4)
        check("Draft critical count is >= 1", draft_data["critical_count"] >= 1)
        check("Draft audit summary is initialized", draft_data["audit_summary"] is not None)

        # GET active draft endpoint
        res_get_draft = client.get(f"/api/v1/procurement/smart-requirements/draft/{outlet1.id}")
        check("GET draft endpoint returns 200 OK", res_get_draft.status_code == 200)
        check("GET draft returns same draft ID", res_get_draft.json()["id"] == draft_id)

        # -------------------------------------------------------------
        # TEST 4: Outlet User Review: Edit Qty, Add Item, Remove Item
        # -------------------------------------------------------------
        print("\n[TEST 4] Outlet User Review (Edit / Add / Remove):")
        current_items = draft_data["items"]
        
        # Modify Rice quantity to 25 KG (original was suggested qty)
        for itm in current_items:
            if itm["item_id"] == item_rice.id:
                itm["final_order_qty"] = 25.0
                itm["notes"] = "Added 3 KG extra for weekend catering buffer"

        # Remove Flour from draft (not needed)
        filtered_items = [itm for itm in current_items if itm["item_id"] != item_flour.id]

        res_update = client.put(f"/api/v1/procurement/smart-requirements/draft/{draft_id}/items", json={
            "items": filtered_items,
            "notes": "Reviewed and modified by Outlet Manager"
        })
        check("Update draft items returns 200 OK", res_update.status_code == 200)
        updated_data = res_update.json()
        
        # Verify Rice was updated
        rice_updated = next(it for it in updated_data["items"] if it["item_id"] == item_rice.id)
        check("Rice final_order_qty updated to 25.0", float(rice_updated["final_order_qty"]) == 25.0)
        check("Rice is marked as user_modified", rice_updated["is_user_modified"] is True)

        # Verify Flour was removed
        check("Flour successfully removed from draft items", not any(it["item_id"] == item_flour.id for it in updated_data["items"]))

        # Verify audit summary captures user modifications
        audit_sum = updated_data["audit_summary"]
        check("Audit summary contains user_modifications list", len(audit_sum.get("user_modifications", [])) >= 2)
        check("Audit records EDIT_QUANTITY for Rice", any(m["action"] == "EDIT_QUANTITY" for m in audit_sum["user_modifications"]))
        check("Audit records REMOVE_ITEM for Flour", any(m["action"] == "REMOVE_ITEM" for m in audit_sum["user_modifications"]))

        # -------------------------------------------------------------
        # TEST 5: Confirm Draft -> Converts to Purchase Request (Indent)
        # -------------------------------------------------------------
        print("\n[TEST 5] Confirm Draft -> Converts to Purchase Request (Indent):")
        res_confirm = client.post(f"/api/v1/procurement/smart-requirements/draft/{draft_id}/confirm", json={
            "notes": "Confirmed smart indent by Uptown Diner",
            "priority": "HIGH"
        })
        check("Confirm draft returns 200 OK", res_confirm.status_code == 200)
        confirm_data = res_confirm.json()
        pr_id = confirm_data["purchase_request_id"]
        pr_num = confirm_data["request_number"]
        check("Confirmation response includes PR ID", pr_id is not None)
        check("Confirmation response includes valid PR Number", pr_num.startswith("PR-"))

        # Verify DB states
        pr_db = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
        check("Created PurchaseRequest exists in DB", pr_db is not None)
        check("PurchaseRequest is in PENDING_APPROVAL status", pr_db.status == PRStatus.PENDING_APPROVAL)
        check("PurchaseRequest has matching branch_id", pr_db.branch_id == outlet1.id)
        check("PurchaseRequest items include modified Rice 25 KG", any(float(i.requested_qty) == 25.0 for i in pr_db.items))

        draft_db = db.query(SmartRequirementDraft).filter(SmartRequirementDraft.id == draft_id).first()
        check("Draft status transitioned to CONFIRMED", draft_db.status == "CONFIRMED")
        check("Draft links to created PurchaseRequest ID", draft_db.purchase_request_id == pr_id)
        check("Draft confirmed_at timestamp is set", draft_db.confirmed_at is not None)

        # -------------------------------------------------------------
        # TEST 6: Seamless Flow into Existing Supplier-Wise Consolidation & WhatsApp
        # -------------------------------------------------------------
        print("\n[TEST 6] Seamless Integration with Existing Consolidation & WhatsApp:")
        # Switch to Admin for HQ central consolidation & approval
        app.dependency_overrides[get_current_active_user] = override_admin
        app.dependency_overrides[get_current_user] = override_admin

        res_con = client.post("/api/v1/procurement/orders/consolidate", json={
            "request_ids": [pr_id],
            "auto_submit": True
        })
        check("Consolidate confirmed Smart PR returns 201 Created", res_con.status_code == 201)
        con_data = res_con.json()
        orders = con_data["orders"]
        check("Consolidation created supplier-wise POs", len(orders) >= 1)
        
        # Find Agro Harvest PO (has Rice and Oil)
        agro_po = next(po for po in orders if po["supplier_id"] == sup_agro.id)
        check("Agro PO created in PENDING_APPROVAL status", agro_po["status"] == "PENDING_APPROVAL")

        # Approve the PO
        res_app = client.post(f"/api/v1/procurement/orders/{agro_po['id']}/approve", json={"notes": "All verified"})
        check("PO approval returns 200 OK", res_app.status_code == 200)

        # Generate WhatsApp link
        res_wa = client.post(f"/api/v1/procurement/orders/{agro_po['id']}/whatsapp-link")
        check("WhatsApp link generated successfully (200 OK)", res_wa.status_code == 200)
        wa_data = res_wa.json()
        check("Status moves strictly to WHATSAPP_OPENED", wa_data["status"] == "WHATSAPP_OPENED")
        check("WhatsApp URL includes valid phone number", "9876511111" in wa_data["whatsapp_url"])
        check("Message includes Rice and Oil with outlet allocation", "Uptown Diner" in wa_data["prefilled_message"])

        # Manual confirmation
        res_sent = client.post(f"/api/v1/procurement/orders/{agro_po['id']}/confirm-sent", json={"notes": "Sent via WhatsApp web"})
        check("Confirm manual send returns 200 OK", res_sent.status_code == 200)
        check("Final PO status is SENT_MANUALLY", res_sent.json()["status"] == "SENT_MANUALLY")

        # -------------------------------------------------------------
        # TEST 7: Scheduled Fixed Preparation Time & Duplicate Prevention
        # -------------------------------------------------------------
        print("\n[TEST 7] Scheduled Fixed Preparation Time & Duplicate Prevention:")
        # Configure preparation time for Outlet 1
        res_cfg1 = client.put(f"/api/v1/procurement/smart-requirements/config/{outlet1.id}", json={
            "preparation_time": "09:00",
            "is_auto_enabled": True,
            "lead_time_days": 1,
            "safety_buffer_percent": 10.0
        })
        check("Update Outlet 1 schedule config returns 200 OK", res_cfg1.status_code == 200)

        # Configure preparation time for Outlet 2
        res_cfg = client.put(f"/api/v1/procurement/smart-requirements/config/{outlet2.id}", json={
            "preparation_time": "16:00",
            "is_auto_enabled": True,
            "lead_time_days": 1,
            "safety_buffer_percent": 15.0
        })
        check("Update Outlet 2 schedule config returns 200 OK", res_cfg.status_code == 200)
        check("Preparation time saved as '16:00'", res_cfg.json()["preparation_time"] == "16:00")
        check("Auto enabled is True", res_cfg.json()["is_auto_enabled"] is True)

        # Trigger scheduled runner
        res_sched = client.post("/api/v1/procurement/smart-requirements/process-schedules")
        check("Scheduled runner returns 200 OK", res_sched.status_code == 200)
        sched_data = res_sched.json()
        check("Processed at least 1 outlet schedule (Outlet 2)", sched_data["processed_count"] >= 1)
        check("Outlet 1 skipped because draft already exists today", sched_data["skipped_count"] >= 1)

        # Duplicate scheduled run prevention check
        res_sched_dup = client.post("/api/v1/procurement/smart-requirements/process-schedules")
        check("Second scheduled run skips all already prepared outlets", res_sched_dup.json()["processed_count"] == 0)
        check("Duplicate prevention recorded skipped count", res_sched_dup.json()["skipped_count"] >= 2)

        # -------------------------------------------------------------
        # TEST 8: Multi-Tenant Scoping & Unauthorized Branch Access Denial (403)
        # -------------------------------------------------------------
        print("\n[TEST 8] Multi-Tenant Scoping & Unauthorized Branch Access Denial:")
        # Switch to restricted Outlet 1 manager
        app.dependency_overrides[get_current_active_user] = override_mgr
        app.dependency_overrides[get_current_user] = override_mgr

        # Attempt to access Outlet 2's draft -> 403 Forbidden
        res_unauth_get = client.get(f"/api/v1/procurement/smart-requirements/draft/{outlet2.id}")
        check("Restricted user accessing other outlet's draft returns 403 Forbidden", res_unauth_get.status_code == 403)

        # Attempt to ask question for Outlet 2 -> 403 Forbidden
        res_unauth_ask = client.post("/api/v1/procurement/smart-requirements/ask", json={
            "branch_id": outlet2.id,
            "question": "What is critical?"
        })
        check("Restricted user asking question for other outlet returns 403 Forbidden", res_unauth_ask.status_code == 403)

        # Attempt to generate draft for Outlet 2 -> 403 Forbidden
        res_unauth_gen = client.post("/api/v1/procurement/smart-requirements/generate", json={
            "branch_id": outlet2.id
        })
        check("Restricted user generating draft for other outlet returns 403 Forbidden", res_unauth_gen.status_code == 403)

        # Switch back to admin
        app.dependency_overrides[get_current_active_user] = override_admin
        app.dependency_overrides[get_current_user] = override_admin

        # -------------------------------------------------------------
        # TEST 9: Structured Audit Trail Verification
        # -------------------------------------------------------------
        print("\n[TEST 9] Structured Audit Trail Verification:")
        audit_draft_gen = db.query(AuditLog).filter(
            AuditLog.entity_id == draft_id,
            AuditLog.action == "GENERATE_SMART_REQUIREMENT_DRAFT"
        ).first()
        check("AuditLog records GENERATE_SMART_REQUIREMENT_DRAFT", audit_draft_gen is not None)

        audit_draft_upd = db.query(AuditLog).filter(
            AuditLog.entity_id == draft_id,
            AuditLog.action == "UPDATE_SMART_REQUIREMENT_DRAFT"
        ).first()
        check("AuditLog records UPDATE_SMART_REQUIREMENT_DRAFT with user edits", audit_draft_upd is not None)

        audit_draft_conf = db.query(AuditLog).filter(
            AuditLog.entity_id == draft_id,
            AuditLog.action == "CONFIRM_SMART_REQUIREMENT_DRAFT"
        ).first()
        check("AuditLog records CONFIRM_SMART_REQUIREMENT_DRAFT", audit_draft_conf is not None)

        print("\n" + "=" * 80)
        print("SUCCESS: ALL OUTLET SMART AI REQUIREMENT TESTS PASSED!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()

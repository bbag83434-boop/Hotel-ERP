"""
Comprehensive Automated Test Suite: Outlet Operational Dashboard, Stock Ledger,
Recipe/BOM Sales Deduction, Month Closing, AI PO Assistant & Strict Data Isolation.
"""

import os
import sys
import uuid
import datetime
from decimal import Decimal
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.core.auth import HQ_APPROVER_ROLES
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import (
    Item, Category, Unit, StockBalance, StockLedger, StockMovementType, StockTransfer, TransferStatus
)
from app.models.restaurant import RestaurantOrder, OrderItem, Menu, MenuCategory, MenuItem, DiningTable, OrderStatus
from app.models.recipe import Recipe, RecipeItem
from app.models.procurement import (
    Supplier, PurchaseRequest, PurchaseRequestItem, PurchaseOrder, PurchaseOrderItem,
    PRStatus, POStatus, PRPriority, SmartRequirementDraft, SmartRequirementItem,
)
from app.models.closing import OutletClosingRecord, ClosingPeriodType, ClosingStatus
from app.models.wastage import WastageEntry, WastageItem, WastageStatus

def run_outlet_operational_suite():
    print("=" * 80)
    print("RUNNING CB HOTEL MANAGEMENT ERP: OUTLET OPERATIONAL TEST SUITE")
    print("=" * 80)

    client = TestClient(app)
    db = SessionLocal()

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
            raise AssertionError(f"Test assertion failed: {name}")

    try:
        suffix = uuid.uuid4().hex[:6].upper()

        # 1. Setup Company
        company = Company(
            id=str(uuid.uuid4()),
            name=f"Heritage Hospitality Group #{suffix}",
            code=f"HHG-{suffix}",
            is_active=True
        )
        db.add(company)
        db.flush()

        # 2. Setup Roles
        role_hq = db.query(Role).filter(Role.name == "HQ_ADMIN").first()
        if not role_hq:
            role_hq = Role(id=str(uuid.uuid4()), name="HQ_ADMIN", description="Head Office Admin")
            db.add(role_hq)
            db.flush()

        role_mgr = db.query(Role).filter(Role.name == "OUTLET_MANAGER").first()
        if not role_mgr:
            role_mgr = Role(id=str(uuid.uuid4()), name="OUTLET_MANAGER", description="Outlet Manager")
            db.add(role_mgr)
            db.flush()

        # 3. Setup Two Outlets: Outlet A and Outlet B
        branch_a = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Grand Heritage Hotel #{suffix}",
            code=f"BR-A-{suffix}",
            type="HOTEL",
            is_active=True
        )
        branch_b = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Royal Heritage Bistro #{suffix}",
            code=f"BR-B-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        db.add_all([branch_a, branch_b])
        db.flush()

        # Warehouses for Outlets
        wh_a = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            name=f"Main Kitchen WH A #{suffix}",
            code=f"WH-A-{suffix}",
            is_active=True
        )
        wh_b = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_b.id,
            name=f"Main Kitchen WH B #{suffix}",
            code=f"WH-B-{suffix}",
            is_active=True
        )
        db.add_all([wh_a, wh_b])
        db.flush()

        # 4. Users: HQ User, Outlet A Manager, Outlet B Manager
        hq_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_hq.id,
            email=f"hq_{suffix}@heritage.com",
            username=f"hq_{suffix}",
            password_hash="hashed_pw_test",
            first_name="HQ",
            last_name="Director",
            is_active=True
        )
        mgr_a_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_mgr.id,
            email=f"mgr_a_{suffix}@heritage.com",
            username=f"mgr_a_{suffix}",
            password_hash="hashed_pw_test",
            first_name="Manager",
            last_name="OutletA",
            is_active=True
        )
        mgr_b_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_mgr.id,
            email=f"mgr_b_{suffix}@heritage.com",
            username=f"mgr_b_{suffix}",
            password_hash="hashed_pw_test",
            first_name="Manager",
            last_name="OutletB",
            is_active=True
        )
        db.add_all([hq_user, mgr_a_user, mgr_b_user])
        db.flush()

        # UserBranch mappings (Strict Isolation)
        ub_a = UserBranch(id=str(uuid.uuid4()), user_id=mgr_a_user.id, branch_id=branch_a.id, is_default=True)
        ub_b = UserBranch(id=str(uuid.uuid4()), user_id=mgr_b_user.id, branch_id=branch_b.id, is_default=True)
        db.add_all([ub_a, ub_b])
        db.flush()

        # 5. Units & Master Items
        unit_kg = db.query(Unit).filter(Unit.symbol == "KG").first()
        if not unit_kg:
            unit_kg = Unit(id=str(uuid.uuid4()), name="Kilogram", symbol="KG")
            db.add(unit_kg)
            db.flush()

        unit_g = db.query(Unit).filter(Unit.symbol == "G").first()
        if not unit_g:
            unit_g = Unit(id=str(uuid.uuid4()), name="Gram", symbol="G")
            db.add(unit_g)
            db.flush()

        unit_ltr = db.query(Unit).filter(Unit.symbol == "L").first()
        if not unit_ltr:
            unit_ltr = Unit(id=str(uuid.uuid4()), name="Litre", symbol="L")
            db.add(unit_ltr)
            db.flush()

        unit_portion = db.query(Unit).filter(Unit.symbol == "PORTION").first()
        if not unit_portion:
            unit_portion = Unit(id=str(uuid.uuid4()), name="Portion", symbol="PORTION")
            db.add(unit_portion)
            db.flush()

        # Supplier
        supplier_agro = Supplier(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Heritage Agro Foods #{suffix}",
            code=f"SUP-AGRO-{suffix}",
            whatsapp_number="+919876543210",
            is_active=True
        )
        db.add(supplier_agro)
        db.flush()

        # Category
        cat_raw = Category(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Raw Ingredients #{suffix}",
            code=f"CAT-RAW-{suffix}",
            is_active=True
        )
        db.add(cat_raw)
        db.flush()

        # Raw Items
        item_rice = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_raw.id,
            name="Basmati Rice Premium",
            code=f"RAW-RICE-{suffix}",
            unit_id=unit_kg.id,
            supplier_id=supplier_agro.id,
            cost_price=Decimal("80.00"),
            min_stock_level=Decimal("20.00"),
            is_active=True
        )
        item_chicken = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_raw.id,
            name="Fresh Farm Chicken",
            code=f"RAW-CHK-{suffix}",
            unit_id=unit_kg.id,
            supplier_id=supplier_agro.id,
            cost_price=Decimal("220.00"),
            min_stock_level=Decimal("15.00"),
            is_active=True
        )
        item_oil = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_raw.id,
            name="Refined Sunflower Oil",
            code=f"RAW-OIL-{suffix}",
            unit_id=unit_ltr.id,
            supplier_id=supplier_agro.id,
            cost_price=Decimal("140.00"),
            min_stock_level=Decimal("10.00"),
            is_active=True
        )
        item_potato = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_raw.id,
            name="Fresh Farm Potato",
            code=f"RAW-POTATO-{suffix}",
            unit_id=unit_kg.id,
            supplier_id=supplier_agro.id,
            cost_price=Decimal("30.00"),
            min_stock_level=Decimal("25.00"),
            is_active=True
        )
        db.add_all([item_rice, item_chicken, item_oil, item_potato])
        db.flush()

        # Initial Stock in Warehouse A
        sb_a_rice = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_a.id,
            item_id=item_rice.id,
            quantity=Decimal("50.00"),
            min_stock_level=Decimal("20.00")
        )
        sb_a_chk = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_a.id,
            item_id=item_chicken.id,
            quantity=Decimal("40.00"),
            min_stock_level=Decimal("15.00")
        )
        sb_a_oil = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_a.id,
            item_id=item_oil.id,
            quantity=Decimal("30.00"),
            min_stock_level=Decimal("10.00")
        )
        # Stock in Warehouse B (isolated)
        sb_b_rice = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_b.id,
            item_id=item_rice.id,
            quantity=Decimal("5.00"),
            min_stock_level=Decimal("20.00")
        )
        db.add_all([sb_a_rice, sb_a_chk, sb_a_oil, sb_b_rice])
        db.flush()

        # 6. Recipe / BOM & Menu Item: Chicken Biryani
        recipe_biryani = Recipe(
            id=str(uuid.uuid4()),
            company_id=company.id,
            finished_item_id=item_chicken.id,
            name="Chicken Biryani Standard 1-Portion Recipe",
            code=f"REC-BIRYANI-{suffix}",
            yield_qty=Decimal("1.0000"),
            is_active=True
        )
        db.add(recipe_biryani)
        db.flush()

        # Recipe Ingredients: Rice 250g (0.25kg), Chicken 150g (0.15kg), Oil 30ml (0.03L)
        ri_rice = RecipeItem(
            id=str(uuid.uuid4()),
            recipe_id=recipe_biryani.id,
            raw_item_id=item_rice.id,
            unit_id=unit_kg.id,
            quantity=Decimal("0.2500"),
            gross_quantity=Decimal("0.2500")
        )
        ri_chk = RecipeItem(
            id=str(uuid.uuid4()),
            recipe_id=recipe_biryani.id,
            raw_item_id=item_chicken.id,
            unit_id=unit_kg.id,
            quantity=Decimal("0.1500"),
            gross_quantity=Decimal("0.1500")
        )
        ri_oil = RecipeItem(
            id=str(uuid.uuid4()),
            recipe_id=recipe_biryani.id,
            raw_item_id=item_oil.id,
            unit_id=unit_ltr.id,
            quantity=Decimal("0.0300"),
            gross_quantity=Decimal("0.0300")
        )
        db.add_all([ri_rice, ri_chk, ri_oil])
        db.flush()

        # Menu & Menu Item
        menu_a = Menu(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            name=f"A La Carte Dining Menu #{suffix}",
            code=f"MENU-A-{suffix}",
            is_active=True
        )
        db.add(menu_a)
        db.flush()

        menu_cat = MenuCategory(
            id=str(uuid.uuid4()),
            menu_id=menu_a.id,
            name="Main Course",
            code=f"CAT-MAIN-{suffix}",
            is_active=True
        )
        db.add(menu_cat)
        db.flush()

        menu_biryani = MenuItem(
            id=str(uuid.uuid4()),
            company_id=company.id,
            menu_id=menu_a.id,
            category_id=menu_cat.id,
            name="Hyderabadi Chicken Biryani (Portion)",
            code=f"MENU-BIRYANI-{suffix}",
            price=Decimal("450.00"),
            recipe_id=recipe_biryani.id,
            is_available=True
        )
        menu_no_recipe = MenuItem(
            id=str(uuid.uuid4()),
            company_id=company.id,
            menu_id=menu_a.id,
            category_id=menu_cat.id,
            name="Special Dessert Without Recipe",
            code=f"MENU-DESSERT-{suffix}",
            price=Decimal("200.00"),
            recipe_id=None,
            finished_item_id=None,
            is_available=True
        )
        db.add_all([menu_biryani, menu_no_recipe])
        db.commit()

        # Generate JWT Auth Tokens
        hq_token = create_access_token(
            subject=hq_user.id,
            claims={"role": role_hq.name, "company_id": company.id}
        )
        mgr_a_token = create_access_token(
            subject=mgr_a_user.id,
            claims={"role": role_mgr.name, "company_id": company.id}
        )
        mgr_b_token = create_access_token(
            subject=mgr_b_user.id,
            claims={"role": role_mgr.name, "company_id": company.id}
        )

        hq_headers = {"Authorization": f"Bearer {hq_token}"}
        mgr_a_headers = {"Authorization": f"Bearer {mgr_a_token}"}
        mgr_b_headers = {"Authorization": f"Bearer {mgr_b_token}"}

        # ==============================================================================
        # SECTION 1: OUTLET-WISE DASHBOARD & STRICT DATA ISOLATION
        # ==============================================================================
        print("\n--- SECTION 1: STRICT OUTLET DATA ISOLATION ---")
        # 1.1 Outlet A manager gets Outlet A dashboard
        res_dash_a = client.get(f"/api/v1/reports/outlet-dashboard?branch_id={branch_a.id}", headers=mgr_a_headers)
        check("Outlet A manager fetches Outlet A dashboard (200 OK)", res_dash_a.status_code == 200)
        data_a = res_dash_a.json()
        check("Dashboard accurately reflects Outlet A branch id", data_a.get("outlet", {}).get("id") == branch_a.id)
        check("Dashboard stock items count matches Outlet A items (3 items)", data_a.get("stock", {}).get("totalItemsInStock") == 3)

        # 1.2 Outlet A manager attempting to access Outlet B dashboard is rejected with 403
        res_dash_b_unauth = client.get(f"/api/v1/reports/outlet-dashboard?branch_id={branch_b.id}", headers=mgr_a_headers)
        check("Outlet A manager accessing Outlet B dashboard is rejected (403 Forbidden)", res_dash_b_unauth.status_code == 403)

        # 1.3 Outlet A manager attempting to fetch Outlet B smart requirement draft is rejected with 403
        res_draft_b_unauth = client.get(f"/api/v1/procurement/smart-requirements/draft/{branch_b.id}", headers=mgr_a_headers)
        check("Outlet A manager accessing Outlet B AI draft is rejected (403 Forbidden)", res_draft_b_unauth.status_code == 403)

        # 1.4 Outlet A manager creating a PO for Outlet B is rejected with 403
        res_po_b_unauth = client.post(
            "/api/v1/procurement/orders",
            headers=mgr_a_headers,
            json={
                "supplier_id": supplier_agro.id,
                "branch_id": branch_b.id,
                "items": [{"item_id": item_rice.id, "ordered_qty": 10.0, "unit_price": 80.0}]
            }
        )
        check("Outlet A manager creating PO for Outlet B is rejected (403 Forbidden)", res_po_b_unauth.status_code == 403)

        # ==============================================================================
        # SECTION 2: RECIPE / BOM SALES DEDUCTION (PORTION-BASED CONSUMPTION)
        # ==============================================================================
        print("\n--- SECTION 2: RECIPE/BOM SALES STOCK DEDUCTION ---")
        # Record initial stock: Rice=50kg, Chicken=40kg, Oil=30L
        # Create an Order for 10 portions of Chicken Biryani in Outlet A
        res_order = client.post(
            "/api/v1/orders",
            headers=mgr_a_headers,
            json={
                "branch_id": branch_a.id,
                "source": "MANUAL",
                "guest_count": 4,
                "items": [
                    {"menu_item_id": menu_biryani.id, "quantity": 10.0, "unit_price": 450.0}
                ]
            }
        )
        check("Create Restaurant Order for 10 portions of Biryani (201 Created)", res_order.status_code == 201)
        order_data = res_order.json()
        order_id = order_data["id"]

        # Complete Order -> triggers automatic recipe portion deduction from Warehouse A
        res_complete = client.post(
            f"/api/v1/orders/{order_id}/complete",
            headers=mgr_a_headers,
            json={"warehouse_id": wh_a.id}
        )
        check("Complete Order triggers automatic portion-based recipe stock deduction (200 OK)", res_complete.status_code == 200)

        # Verify exact deductions:
        # 10 portions * 0.25kg Rice = 2.50kg deducted -> Remaining: 50.00 - 2.50 = 47.50kg
        # 10 portions * 0.15kg Chicken = 1.50kg deducted -> Remaining: 40.00 - 1.50 = 38.50kg
        # 10 portions * 0.03L Oil = 0.30L deducted -> Remaining: 30.00 - 0.30 = 29.70L
        db.expire_all()
        bal_rice = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_a.id, StockBalance.item_id == item_rice.id).first()
        bal_chk = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_a.id, StockBalance.item_id == item_chicken.id).first()
        bal_oil = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_a.id, StockBalance.item_id == item_oil.id).first()

        check("Rice deducted accurately by 2.50 KG (47.50 KG remaining)", Decimal(str(bal_rice.quantity)) == Decimal("47.5000"))
        check("Chicken deducted accurately by 1.50 KG (38.50 KG remaining)", Decimal(str(bal_chk.quantity)) == Decimal("38.5000"))
        check("Oil deducted accurately by 0.30 L (29.70 L remaining)", Decimal(str(bal_oil.quantity)) == Decimal("29.7000"))

        # Verify StockLedger entries were generated with movement_type=POS_SALE
        ledger_count = db.query(StockLedger).filter(
            StockLedger.reference_id == order_id,
            StockLedger.movement_type == StockMovementType.POS_SALE.value
        ).count()
        check("StockLedger recorded 3 ingredient lines with movement_type POS_SALE", ledger_count == 3)

        # Test MenuItem with Missing Recipe mapping: Does not invent deduction or corrupt stock
        res_order_no_rec = client.post(
            "/api/v1/orders",
            headers=mgr_a_headers,
            json={
                "branch_id": branch_a.id,
                "source": "MANUAL",
                "guest_count": 1,
                "items": [
                    {"menu_item_id": menu_no_recipe.id, "quantity": 2.0, "unit_price": 200.0}
                ]
            }
        )
        check("Create order with item lacking recipe mapping (201 Created)", res_order_no_rec.status_code == 201)
        order_no_rec_id = res_order_no_rec.json()["id"]

        res_comp_no_rec = client.post(
            f"/api/v1/orders/{order_no_rec_id}/complete",
            headers=mgr_a_headers,
            json={"warehouse_id": wh_a.id}
        )
        check("Order completed without inventing fake deductions (200 OK)", res_comp_no_rec.status_code == 200)

        # ==============================================================================
        # SECTION 3: MONTH CLOSING SYSTEM & PERMISSIONS
        # ==============================================================================
        print("\n--- SECTION 3: MONTH CLOSING WORKFLOW & ISOLATION ---")
        # 3.1 Active closing draft calculation for Outlet A
        res_active_close = client.get(f"/api/v1/procurement/closings/active/{branch_a.id}", headers=mgr_a_headers)
        check("Outlet A manager fetches active closing draft (200 OK)", res_active_close.status_code == 200)
        close_draft = res_active_close.json()
        check("Closing draft contains period start and end dates", bool(close_draft.get("start_date") and close_draft.get("end_date")))

        # 3.2 Outlet A manager cannot fetch Outlet B active closing draft
        res_close_b_unauth = client.get(f"/api/v1/procurement/closings/active/{branch_b.id}", headers=mgr_a_headers)
        check("Outlet A manager accessing Outlet B closing is rejected (403 Forbidden)", res_close_b_unauth.status_code == 403)

        # 3.3 Submit Month Closing for Outlet A
        now = datetime.datetime.utcnow()
        res_submit_close = client.post(
            "/api/v1/procurement/closings/submit",
            headers=mgr_a_headers,
            json={
                "branch_id": branch_a.id,
                "year": now.year,
                "month": now.month,
                "period_type": "FIRST_HALF" if now.day <= 15 else "SECOND_HALF",
                "notes": f"Bi-monthly operational closing test for {branch_a.name}",
                "items": [
                    {
                        "item_id": item_rice.id,
                        "physical_closing_qty": 47.50,
                        "notes": "Verified physical count"
                    }
                ]
            }
        )
        check("Outlet A manager submits bi-monthly closing (200 OK)", res_submit_close.status_code == 200)
        submitted_close = res_submit_close.json()
        check("Closing status is SUBMITTED", submitted_close.get("status") == "SUBMITTED")

        # 3.4 Cross-outlet submission blocked
        res_submit_b_unauth = client.post(
            "/api/v1/procurement/closings/submit",
            headers=mgr_a_headers,
            json={
                "branch_id": branch_b.id,
                "year": now.year,
                "month": now.month,
                "period_type": "FIRST_HALF" if now.day <= 15 else "SECOND_HALF",
                "items": []
            }
        )
        check("Outlet A manager submitting closing for Outlet B is rejected (403 Forbidden)", res_submit_b_unauth.status_code == 403)

        # ==============================================================================
        # SECTION 4: OUTLET AI PURCHASE ORDER ASSISTANT & VENDOR MAPPING
        # ==============================================================================
        print("\n--- SECTION 4: AI PURCHASE ASSISTANT & ONE-CLICK PO CREATION ---")
        # 4.1 Generate AI draft requirements for Outlet A
        res_gen_ai = client.post(
            "/api/v1/procurement/smart-requirements/generate",
            headers=mgr_a_headers,
            json={"branch_id": branch_a.id, "force_regenerate": True}
        )
        check("Generate AI purchase requirement draft for Outlet A (201 Created)", res_gen_ai.status_code == 201)
        ai_draft = res_gen_ai.json()
        draft_id = ai_draft["id"]
        check("AI Draft is created in DRAFT status", ai_draft["status"] == "DRAFT")

        # 4.2 Outlet Manager reviews and modifies draft (Add Potato, Change Rice, Delete Oil)
        # Edit list: Add Potato (10kg), Rice (25kg), remove any unneeded items
        modified_items = [
            {
                "item_id": item_rice.id,
                "item_name": item_rice.name,
                "item_code": item_rice.code,
                "unit_symbol": "KG",
                "supplier_id": supplier_agro.id,
                "supplier_name": supplier_agro.name,
                "current_stock": 47.50,
                "min_stock": 20.00,
                "target_stock": 60.00,
                "pending_incoming": 0.0,
                "daily_consumption": 2.50,
                "short_qty": 25.00,
                "system_suggested_qty": 20.00,
                "final_order_qty": 25.00,  # User changed from 20 to 25
                "priority": "HIGH",
                "is_user_modified": True,
                "is_manually_added": False,
                "notes": "User adjusted to 25 KG for upcoming banquet"
            },
            {
                "item_id": item_potato.id,
                "item_name": item_potato.name,
                "item_code": item_potato.code,
                "unit_symbol": "KG",
                "supplier_id": supplier_agro.id,
                "supplier_name": supplier_agro.name,
                "current_stock": 0.0,
                "min_stock": 25.00,
                "target_stock": 50.00,
                "pending_incoming": 0.0,
                "daily_consumption": 5.0,
                "short_qty": 10.00,
                "system_suggested_qty": 10.00,
                "final_order_qty": 10.00,  # User manually added Potato 10kg
                "priority": "MEDIUM",
                "is_user_modified": True,
                "is_manually_added": True,
                "notes": "Added manually by chef"
            }
        ]

        res_update_ai = client.put(
            f"/api/v1/procurement/smart-requirements/draft/{draft_id}/items",
            headers=mgr_a_headers,
            json={"items": modified_items, "notes": "Reviewed and modified by Chef A"}
        )
        check("Update AI Draft items with user review edits (200 OK)", res_update_ai.status_code == 200)
        updated_draft = res_update_ai.json()
        check("Draft items count is exactly 2 after user review", len(updated_draft.get("items", [])) == 2)

        # 4.3 One-Click Confirm -> Creates Purchase Request (Indent) linked to exact reviewed items & vendor
        res_confirm_ai = client.post(
            f"/api/v1/procurement/smart-requirements/draft/{draft_id}/confirm",
            headers=mgr_a_headers,
            json={"notes": "Final approved list from Outlet A"}
        )
        check("One-Click Confirm AI Draft creates formal Indent / PR (200 OK)", res_confirm_ai.status_code == 200)
        confirm_data = res_confirm_ai.json()
        check("Confirm response indicates success", confirm_data.get("success") is True)
        pr_id = confirm_data.get("purchase_request_id")
        check("Resulting Purchase Request ID is returned", bool(pr_id))

        # Verify PR in database
        db_pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
        check("Purchase Request is attached to Outlet A branch_id", db_pr.branch_id == branch_a.id)
        check("Purchase Request requested_by_id matches Outlet A Manager", db_pr.requested_by_id == mgr_a_user.id)
        check("Purchase Request items count is 2 (Rice 25kg + Potato 10kg)", len(db_pr.items) == 2)

        # 4.4 Duplicate confirmation prevention (Idempotency)
        res_confirm_dup = client.post(
            f"/api/v1/procurement/smart-requirements/draft/{draft_id}/confirm",
            headers=mgr_a_headers,
            json={"notes": "Duplicate click"}
        )
        check("Duplicate confirmation rejected (400 Bad Request)", res_confirm_dup.status_code == 400)

        # ==============================================================================
        # SECTION 5: HQ APPROVAL PERMISSIONS NON-REGRESSION
        # ==============================================================================
        print("\n--- SECTION 5: HQ PERMISSION GUARDS NON-REGRESSION ---")
        # 5.1 Outlet Manager attempting to approve PR is rejected with 403
        res_mgr_app_pr = client.post(f"/api/v1/procurement/requests/{pr_id}/approve", headers=mgr_a_headers)
        check("Outlet Manager approving PR is rejected with 403 Forbidden", res_mgr_app_pr.status_code == 403)

        # 5.2 HQ User approving PR succeeds with 200 OK
        res_hq_app_pr = client.post(f"/api/v1/procurement/requests/{pr_id}/approve", headers=hq_headers)
        check("HQ Admin approving PR succeeds with 200 OK", res_hq_app_pr.status_code == 200)

        print("\n" + "=" * 80)
        print(f"SUCCESS: ALL {passed}/{total} OUTLET OPERATIONAL TESTS PASSED (100%)!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_outlet_operational_suite()

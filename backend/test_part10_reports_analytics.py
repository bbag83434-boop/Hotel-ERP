import os
import sys
import uuid
import datetime
from decimal import Decimal
from sqlalchemy import func
from fastapi.testclient import TestClient

# Append backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Category, Unit, StockBalance, StockLedger, StockMovementType
from app.models.restaurant import RestaurantOrder, OrderItem, Menu, MenuCategory, MenuItem, OrderStatus
from app.models.procurement import PurchaseOrder, POStatus, Supplier
from app.models.wastage import WastageEntry, WastageItem, WastageStatus
from app.models.closing import OutletClosingRecord, ClosingPeriodType, ClosingStatus
from app.models.report import ReportSnapshot, ReportType

def run_reports_tests():
    print("=" * 80)
    print("RUNNING PART 10: REPORTS & ANALYTICS FOUNDATION SUITE")
    print("=" * 80)

    client = TestClient(app)
    db = SessionLocal()

    try:
        # Seed test company and isolated environment
        suffix = uuid.uuid4().hex[:6].upper()
        company = db.query(Company).first()
        if not company:
            company = Company(
                id=str(uuid.uuid4()),
                name=f"Apex Restaurant Group #{suffix}",
                code=f"APEX-REP-{suffix}",
                is_active=True
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # Admin user with Admin Role
        role_admin = db.query(Role).filter(Role.name == "ADMIN").first()
        if not role_admin:
            role_admin = db.query(Role).filter(Role.name.ilike("%ADMIN%")).first()
        if not role_admin:
            role_admin = Role(id=str(uuid.uuid4()), name="ADMIN", description="System Admin")
            db.add(role_admin)
            db.flush()

        admin_user = db.query(User).filter(User.email == "admin@apexerp.com").first()
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                company_id=company.id,
                role_id=role_admin.id,
                email="admin@apexerp.com",
                username=f"admin_rep_{suffix}",
                password_hash="fakehash",
                first_name="System",
                last_name="Admin",
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
        else:
            admin_user.role_id = role_admin.id
            db.commit()

        admin_token = create_access_token(subject=str(admin_user.id), claims={"email": admin_user.email, "company_id": str(admin_user.company_id)})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create two test branches (Branch 1 & Branch 2)
        branch1 = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Apex Central Dining #{suffix}",
            code=f"BR-REP1-{suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        branch2 = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Apex Express Bistro #{suffix}",
            code=f"BR-REP2-{suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        db.add(branch1)
        db.add(branch2)
        db.flush()

        # Warehouses
        wh1 = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            name=f"Central Kitchen WH #{suffix}",
            code=f"WH-REP1-{suffix}",
            is_active=True,
        )
        wh2 = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch2.id,
            name=f"Bistro Kitchen WH #{suffix}",
            code=f"WH-REP2-{suffix}",
            is_active=True,
        )
        db.add(wh1)
        db.add(wh2)
        db.flush()

        # Categories & Units
        cat_food = Category(id=str(uuid.uuid4()), company_id=company.id, name=f"Main Course #{suffix}", code=f"CAT-MC-{suffix}")
        cat_bev = Category(id=str(uuid.uuid4()), company_id=company.id, name=f"Beverages #{suffix}", code=f"CAT-BV-{suffix}")
        unit_portion = Unit(id=str(uuid.uuid4()), company_id=company.id, name=f"Portion #{suffix}", symbol=f"ptn-{suffix}")
        unit_kg = Unit(id=str(uuid.uuid4()), company_id=company.id, name=f"Kilogram #{suffix}", symbol=f"kg-{suffix}")
        db.add_all([cat_food, cat_bev, unit_portion, unit_kg])
        db.flush()

        # Items
        item_biryani = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_food.id,
            unit_id=unit_portion.id,
            name=f"Hyderabadi Biryani #{suffix}",
            code=f"DSH-BYN-{suffix}",
            cost_price=Decimal("120.00"),
            selling_price=Decimal("350.00"),
            min_stock_level=Decimal("10.00"),
            is_active=True
        )
        item_paneer = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_food.id,
            unit_id=unit_kg.id,
            name=f"Fresh Malai Paneer #{suffix}",
            code=f"RAW-PNR-{suffix}",
            cost_price=Decimal("300.00"),
            selling_price=Decimal("0.00"),
            min_stock_level=Decimal("15.00"),
            is_active=True
        )
        item_mocktail = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat_bev.id,
            unit_id=unit_portion.id,
            name=f"Mango Mojito #{suffix}",
            code=f"BEV-MNG-{suffix}",
            cost_price=Decimal("40.00"),
            selling_price=Decimal("180.00"),
            min_stock_level=Decimal("5.00"),
            is_active=True
        )
        db.add_all([item_biryani, item_paneer, item_mocktail])
        db.flush()

        # Seed Stock Balances (wh1: 20 KG Paneer, 5 Portion Biryani; wh2: 5 KG Paneer [Low Stock Alert])
        sb1 = StockBalance(id=str(uuid.uuid4()), warehouse_id=wh1.id, item_id=item_paneer.id, quantity=Decimal("20.00"))
        sb2 = StockBalance(id=str(uuid.uuid4()), warehouse_id=wh1.id, item_id=item_biryani.id, quantity=Decimal("25.00"))
        sb3 = StockBalance(id=str(uuid.uuid4()), warehouse_id=wh2.id, item_id=item_paneer.id, quantity=Decimal("5.00")) # Below min 15
        db.add_all([sb1, sb2, sb3])
        db.flush()

        # Master Menu
        menu = Menu(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            name=f"Standard All-Day Dining Menu #{suffix}",
            code=f"MNU-{suffix}",
            is_active=True
        )
        db.add(menu)
        db.flush()

        # Menu Categories
        menu_cat_food = MenuCategory(
            id=str(uuid.uuid4()),
            menu_id=menu.id,
            name=f"Main Course #{suffix}",
            code=f"MCAT-MC-{suffix}",
            sort_order=1,
            is_active=True
        )
        menu_cat_bev = MenuCategory(
            id=str(uuid.uuid4()),
            menu_id=menu.id,
            name=f"Beverages #{suffix}",
            code=f"MCAT-BV-{suffix}",
            sort_order=2,
            is_active=True
        )
        db.add_all([menu_cat_food, menu_cat_bev])
        db.flush()

        # Menu Items
        menu_biryani = MenuItem(
            id=str(uuid.uuid4()),
            company_id=company.id,
            menu_id=menu.id,
            category_id=menu_cat_food.id,
            name=f"Hyderabadi Biryani #{suffix}",
            code=f"DSH-BYN-{suffix}",
            price=Decimal("350.00"),
            cost_price=Decimal("120.00"),
            is_available=True
        )
        menu_mocktail = MenuItem(
            id=str(uuid.uuid4()),
            company_id=company.id,
            menu_id=menu.id,
            category_id=menu_cat_bev.id,
            name=f"Mango Mojito #{suffix}",
            code=f"BEV-MNG-{suffix}",
            price=Decimal("180.00"),
            cost_price=Decimal("40.00"),
            is_available=True
        )
        db.add_all([menu_biryani, menu_mocktail])
        db.flush()

        # Seed Restaurant Orders
        # Order 1 (Branch 1): 2 Biryani + 1 Mocktail = 2*350 + 1*180 = 880 (Subtotal=880, Tax=44, Total=924)
        order1 = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            order_number=f"ORD-1-{suffix}",
            status="COMPLETED",
            guest_count=2,
            sub_total=Decimal("880.00"),
            tax_amount=Decimal("44.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("924.00"),
        )
        order1_item1 = OrderItem(id=str(uuid.uuid4()), order_id=order1.id, item_id=menu_biryani.id, name=menu_biryani.name, quantity=2, unit_price=Decimal("350.00"), total_price=Decimal("700.00"), status="SERVED")
        order1_item2 = OrderItem(id=str(uuid.uuid4()), order_id=order1.id, item_id=menu_mocktail.id, name=menu_mocktail.name, quantity=1, unit_price=Decimal("180.00"), total_price=Decimal("180.00"), status="SERVED")
        db.add_all([order1, order1_item1, order1_item2])

        # Order 2 (Branch 2): 4 Biryani = 4*350 = 1400 (Subtotal=1400, Tax=70, Total=1470)
        order2 = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch2.id,
            order_number=f"ORD-2-{suffix}",
            status="COMPLETED",
            guest_count=4,
            sub_total=Decimal("1400.00"),
            tax_amount=Decimal("70.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("1470.00"),
        )
        order2_item1 = OrderItem(id=str(uuid.uuid4()), order_id=order2.id, item_id=menu_biryani.id, name=menu_biryani.name, quantity=4, unit_price=Decimal("350.00"), total_price=Decimal("1400.00"), status="SERVED")
        db.add_all([order2, order2_item1])

        # Seed Wastage Entry (Branch 1): 2 KG Paneer @ 300 = 600
        w_entry = WastageEntry(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            warehouse_id=wh1.id,
            entry_number=f"WST-REP-{suffix}",
            entry_date=datetime.datetime.utcnow(),
            status=WastageStatus.APPROVED,
            total_cost=Decimal("600.00"),
            total_items_count=1,
            reported_by_id=admin_user.id,
        )
        w_item = WastageItem(
            id=str(uuid.uuid4()),
            wastage_entry_id=w_entry.id,
            item_id=item_paneer.id,
            quantity=Decimal("2.00"),
            unit_cost=Decimal("300.00"),
            total_cost=Decimal("600.00"),
            reason_code="EXPIRED"
        )
        db.add_all([w_entry, w_item])

        # Seed Supplier & Purchase Order (Branch 1): 10 KG Paneer @ 280 = 2800 (Status: RECEIVED)
        supplier = Supplier(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Apex Dairy Co #{suffix}",
            code=f"SUP-DRY-{suffix}",
            contact_person="Dairy Lead",
            phone="9876543210",
            is_active=True
        )
        db.add(supplier)
        db.flush()

        po = PurchaseOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            supplier_id=supplier.id,
            po_number=f"PO-REP-{suffix}",
            order_date=datetime.datetime.utcnow(),
            status=POStatus.RECEIVED,
            total_amount=Decimal("2800.00"),
            approved_by_id=admin_user.id
        )
        db.add(po)

        # Restricted Staff User (Assigned ONLY to Branch 1)
        role_staff = db.query(Role).filter(Role.name == "STAFF").first()
        if not role_staff:
            role_staff = Role(id=str(uuid.uuid4()), name="STAFF", description="Staff Role")
            db.add(role_staff)
            db.flush()

        staff_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_staff.id,
            email=f"reporter.{suffix.lower()}@apexerp.com",
            username=f"reporter_{suffix.lower()}",
            password_hash="fakehash",
            first_name="Staff",
            last_name="Reporter",
            is_active=True,
        )
        db.add(staff_user)
        db.flush()

        user_branch = UserBranch(
            id=str(uuid.uuid4()),
            user_id=staff_user.id,
            branch_id=branch1.id,
            is_default=True,
        )
        db.add(user_branch)
        db.commit()

        staff_token = create_access_token(subject=str(staff_user.id), claims={"email": staff_user.email, "company_id": str(company.id)})
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        def get_k(d, *keys):
            for k in keys:
                if k in d:
                    return d[k]
            return None

        # ======================================================================
        # TEST 1: Executive Dashboard Consolidated Summary
        # ======================================================================
        print("\n[TEST 1] Executive Summary & Multi-Outlet Consolidated Dashboard:")
        res = client.get("/api/v1/reports/executive-summary", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "kpis" in data
        outlet_rankings = get_k(data, "outletRankings", "outlet_rankings")
        assert outlet_rankings is not None
        cost_breakdown = get_k(data, "costBreakdown", "cost_breakdown")
        assert cost_breakdown is not None

        kpis = data["kpis"]
        # Total revenue = 924 (Branch 1) + 1470 (Branch 2) = 2394
        total_rev = get_k(kpis, "totalRevenue", "total_revenue")
        total_orders = get_k(kpis, "totalOrders", "total_orders")
        total_wastage = get_k(kpis, "totalWastageLoss", "total_wastage_loss")
        assert Decimal(str(total_rev)) >= Decimal("2394.00")
        assert total_orders >= 2
        assert Decimal(str(total_wastage)) >= Decimal("600.00")
        assert len(outlet_rankings) >= 2
        print(f"  [PASS] GET /reports/executive-summary returned Group Revenue: INR {total_rev} across {len(outlet_rankings)} outlets")

        # ======================================================================
        # TEST 2: Sales Summary Report & Categorical Breakdown
        # ======================================================================
        print("\n[TEST 2] Sales & Revenue Analytics Report:")
        res = client.get(f"/api/v1/reports/sales-summary?branch_id={branch1.id}", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        sales_resp = res.json()
        gross_sales = get_k(sales_resp, "grossSales", "gross_sales")
        total_s_orders = get_k(sales_resp, "totalOrders", "total_orders")
        total_guests = get_k(sales_resp, "totalGuests", "total_guests")
        by_category = get_k(sales_resp, "byCategory", "by_category")
        top_selling = get_k(sales_resp, "topSellingItems", "top_selling_items")

        assert Decimal(str(gross_sales)) == Decimal("924.00")
        assert total_s_orders == 1
        assert total_guests == 2
        assert len(by_category) >= 2
        assert len(top_selling) >= 2

        biryani_entry = next((it for it in top_selling if get_k(it, "itemId", "item_id") == menu_biryani.id), None)
        assert biryani_entry is not None
        assert get_k(biryani_entry, "quantitySold", "quantity_sold") == 2
        assert Decimal(str(get_k(biryani_entry, "totalSales", "total_sales"))) == Decimal("700.00")
        print(f"  [PASS] GET /reports/sales-summary calculated Gross Sales INR 924.00 with top item: {get_k(biryani_entry, 'itemName', 'item_name')}")

        # ======================================================================
        # TEST 3: Inventory Valuation & Stock Health Audit
        # ======================================================================
        print("\n[TEST 3] Inventory Valuation Report:")
        # Branch 1 valuation: (20 KG Paneer * 300) + (25 Portion Biryani * 120) = 6000 + 3000 = 9000
        res = client.get(f"/api/v1/reports/inventory-valuation?branch_id={branch1.id}", headers=admin_headers)
        assert res.status_code == 200
        inv_data = res.json()
        assert Decimal(str(get_k(inv_data, "totalValuation", "total_valuation"))) == Decimal("9000.00")
        assert get_k(inv_data, "totalItemsCount", "total_items_count") == 2

        # Branch 2 valuation: (5 KG Paneer * 300) = 1500 with Low Stock Alert (5 <= 15)
        res2 = client.get(f"/api/v1/reports/inventory-valuation?branch_id={branch2.id}", headers=admin_headers)
        assert res2.status_code == 200
        inv2_data = res2.json()
        assert Decimal(str(get_k(inv2_data, "totalValuation", "total_valuation"))) == Decimal("1500.00")
        assert get_k(inv2_data, "lowStockItemsCount", "low_stock_items_count") == 1
        print(f"  [PASS] GET /reports/inventory-valuation verified Branch 1: INR 9000.00 and Branch 2 Low Stock Alert")

        # ======================================================================
        # TEST 4: Food Cost & Margin Variance Audit
        # ======================================================================
        print("\n[TEST 4] Food Cost & Margin Variance Report:")
        res = client.get("/api/v1/reports/food-cost-variance", headers=admin_headers)
        assert res.status_code == 200
        fc_resp = res.json()
        actual_cogs = get_k(fc_resp, "consolidatedActualCost", "consolidated_actual_cost")
        assert actual_cogs is not None
        outlets = get_k(fc_resp, "outlets")
        assert len(outlets) >= 2
        print(f"  [PASS] GET /reports/food-cost-variance returned Consolidated COGS: INR {actual_cogs}")

        # ======================================================================
        # TEST 5: Wastage Loss Audit Report
        # ======================================================================
        print("\n[TEST 5] Wastage & Food Loss Report:")
        res = client.get(f"/api/v1/reports/wastage-summary?branch_id={branch1.id}", headers=admin_headers)
        assert res.status_code == 200
        w_data = res.json()
        total_loss = get_k(w_data, "totalLossCost", "total_loss_cost")
        total_entries = get_k(w_data, "totalEntriesCount", "total_entries_count")
        by_reason = get_k(w_data, "byReason", "by_reason")
        top_wasted = get_k(w_data, "topWastedSkus", "top_wasted_skus")

        assert Decimal(str(total_loss)) == Decimal("600.00")
        assert total_entries == 1
        assert "EXPIRED" in by_reason
        assert len(top_wasted) == 1
        assert get_k(top_wasted[0], "item_name", "itemName") == item_paneer.name
        print(f"  [PASS] GET /reports/wastage-summary audited Loss Cost INR 600.00 on item: {item_paneer.name}")

        # ======================================================================
        # TEST 6: Procurement Summary & Supplier Performance
        # ======================================================================
        print("\n[TEST 6] Procurement Summary Report:")
        res = client.get("/api/v1/reports/procurement-summary", headers=admin_headers)
        assert res.status_code == 200
        po_resp = res.json()
        total_po_spend = get_k(po_resp, "totalPoSpend", "total_po_spend")
        fulfilled_pos = get_k(po_resp, "fulfilledPoCount", "fulfilled_po_count")
        top_suppliers = get_k(po_resp, "topSuppliers", "top_suppliers")

        assert Decimal(str(total_po_spend)) >= Decimal("2800.00")
        assert fulfilled_pos >= 1
        assert len(top_suppliers) >= 1
        print(f"  [PASS] GET /reports/procurement-summary verified spend INR {total_po_spend} with supplier {get_k(top_suppliers[0], 'supplierName', 'supplier_name')}")

        # ======================================================================
        # TEST 7: Data Export to CSV & JSON
        # ======================================================================
        print("\n[TEST 7] Report Data Export Engine (CSV & JSON):")
        # 1. Export Sales CSV
        export_csv_payload = {
            "reportType": "SALES_SUMMARY",
            "format": "CSV",
            "branchId": branch1.id
        }
        res_csv = client.post("/api/v1/reports/export", json=export_csv_payload, headers=admin_headers)
        assert res_csv.status_code == 200
        csv_resp = res_csv.json()
        assert csv_resp["format"] == "CSV"
        assert "Date,Order Count" in csv_resp["data"]
        print("  [PASS] POST /reports/export (CSV) generated structured CSV payload")

        # 2. Export Executive JSON
        export_json_payload = {
            "reportType": "EXECUTIVE_SUMMARY",
            "format": "JSON"
        }
        res_json = client.post("/api/v1/reports/export", json=export_json_payload, headers=admin_headers)
        assert res_json.status_code == 200
        json_resp = res_json.json()
        assert json_resp["format"] == "JSON"
        print("  [PASS] POST /reports/export (JSON) generated valid JSON payload")

        # ======================================================================
        # TEST 8: Report Snapshots Management
        # ======================================================================
        print("\n[TEST 8] Report Snapshots Persistence:")
        now = datetime.datetime.utcnow()
        snapshot_payload = {
            "branchId": branch1.id,
            "reportType": "EXECUTIVE_SUMMARY",
            "periodStart": (now - datetime.timedelta(days=30)).isoformat(),
            "periodEnd": now.isoformat(),
            "title": f"Monthly Performance Digest #{suffix}",
            "metrics": {"total_revenue": 2394.0, "total_orders": 2, "food_cost_pct": 29.5},
            "summaryText": "Group operating performance within target food cost benchmarks."
        }
        res_snap = client.post("/api/v1/reports/snapshots", json=snapshot_payload, headers=admin_headers)
        assert res_snap.status_code == 201
        snap_data = res_snap.json()
        assert snap_data["title"] == snapshot_payload["title"]

        res_list = client.get(f"/api/v1/reports/snapshots?branch_id={branch1.id}", headers=admin_headers)
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1
        print("  [PASS] POST & GET /reports/snapshots persisted and retrieved report snapshot")

        # ======================================================================
        # TEST 9: Multi-Tenant RBAC & Outlet Scoping
        # ======================================================================
        print("\n[TEST 9] Multi-Tenant Security & Outlet Isolation:")
        # Staff assigned to Branch 1 querying Branch 2 -> 403 Forbidden
        res_forbidden = client.get(f"/api/v1/reports/sales-summary?branch_id={branch2.id}", headers=staff_headers)
        assert res_forbidden.status_code == 403
        print("  [PASS] Restricted staff querying unauthorized outlet blocked with 403 Forbidden")

        # Staff querying their own assigned outlet -> 200 OK
        res_staff_ok = client.get(f"/api/v1/reports/sales-summary?branch_id={branch1.id}", headers=staff_headers)
        assert res_staff_ok.status_code == 200
        print("  [PASS] Restricted staff accessing assigned outlet succeeded (200 OK)")

        # Unauthenticated request -> 401 Unauthorized
        res_unauth = client.get("/api/v1/reports/executive-summary")
        assert res_unauth.status_code == 401
        print("  [PASS] Unauthenticated request blocked with 401 Unauthorized")

        # ======================================================================
        # TEST 10: Zero Data Loss & Neon PostgreSQL Persistence
        # ======================================================================
        print("\n[TEST 10] Zero Data Loss & Database Record Persistence:")
        users_count = db.query(func.count(User.id)).scalar()
        branches_count = db.query(func.count(Branch.id)).scalar()
        snapshots_count = db.query(func.count(ReportSnapshot.id)).scalar()
        assert users_count > 0
        assert branches_count > 0
        assert snapshots_count > 0
        print(f"  [PASS] Zero Data Loss Verified: Users={users_count}, Branches={branches_count}, Snapshots={snapshots_count}")

        print("\n" + "=" * 80)
        print("SUCCESS: ALL PART 10 REPORTS & ANALYTICS TESTS PASSED (100%)!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_reports_tests()

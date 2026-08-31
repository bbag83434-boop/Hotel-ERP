import os
import sys
import uuid
import datetime
from decimal import Decimal
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
from app.models.inventory import Item, Category, Unit, StockBalance, StockTransfer, TransferStatus
from app.models.restaurant import RestaurantOrder, DiningTable, OrderStatus
from app.models.procurement import PurchaseRequest, PurchaseOrder, PRStatus, POStatus, Supplier
from app.models.wastage import WastageEntry, WastageStatus
from app.models.recipe import Recipe, ProductionOrder

def run_outlet_dashboard_tests():
    print("=" * 80)
    print("RUNNING OUTLET DASHBOARD PRODUCTION TEST SUITE")
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

        # 1. Test Company
        company = db.query(Company).first()
        if not company:
            company = Company(
                id=str(uuid.uuid4()),
                name=f"Grand Heritage Resort Group #{suffix}",
                code=f"GHR-{suffix}",
                is_active=True
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # 2. Roles
        role_admin = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not role_admin:
            role_admin = db.query(Role).filter(Role.name == "ADMIN").first()
        if not role_admin:
            role_admin = Role(id=str(uuid.uuid4()), name="SUPER_ADMIN", description="Super Admin")
            db.add(role_admin)
            db.flush()

        role_mgr = db.query(Role).filter(Role.name == "OUTLET_MANAGER").first()
        if not role_mgr:
            role_mgr = Role(id=str(uuid.uuid4()), name="OUTLET_MANAGER", description="Outlet Manager")
            db.add(role_mgr)
            db.flush()

        # 3. Two Outlets (Branch A & Branch B for isolation test)
        branch_a = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Grand Heritage Resort & Palace #{suffix}",
            code=f"BR-HOTEL-{suffix}",
            type="HOTEL",
            is_active=True
        )
        branch_b = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Royal Heritage Bistro #{suffix}",
            code=f"BR-BISTRO-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        db.add_all([branch_a, branch_b])
        db.flush()

        # Warehouses for Branch A & B
        wh_a = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            name=f"Palace Main Kitchen WH #{suffix}",
            code=f"WH-A-{suffix}",
            is_central=False,
            is_active=True
        )
        wh_b = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_b.id,
            name=f"Bistro Kitchen WH #{suffix}",
            code=f"WH-B-{suffix}",
            is_central=False,
            is_active=True
        )
        db.add_all([wh_a, wh_b])
        db.flush()

        # 4. Users: Admin & Scoped Manager (assigned ONLY to Branch A)
        admin_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_admin.id,
            email=f"admin_test_{suffix.lower()}@grandheritage.com",
            username=f"admin_{suffix.lower()}",
            password_hash="$2b$12$DummyHashForTestingOnly12345678901234567890",
            first_name="Admin",
            last_name="Director",
            is_active=True
        )
        mgr_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_mgr.id,
            email=f"manager_palace_{suffix.lower()}@grandheritage.com",
            username=f"mgr_palace_{suffix.lower()}",
            password_hash="$2b$12$DummyHashForTestingOnly12345678901234567890",
            first_name="Palace",
            last_name="Manager",
            is_active=True
        )
        db.add_all([admin_user, mgr_user])
        db.flush()

        # Assign mgr_user ONLY to Branch A
        ub_mgr = UserBranch(
            id=str(uuid.uuid4()),
            user_id=mgr_user.id,
            branch_id=branch_a.id,
            is_default=True
        )
        db.add(ub_mgr)

        # 5. Populate Branch A with Real Operational Data
        # Category & Unit
        cat = Category(id=str(uuid.uuid4()), company_id=company.id, name=f"Dairy #{suffix}", code=f"CAT-{suffix}")
        unit = Unit(id=str(uuid.uuid4()), company_id=company.id, name=f"Kilogram #{suffix}", symbol=f"kg-{suffix}")
        db.add_all([cat, unit])
        db.flush()

        # Items
        item_paneer = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit.id,
            name=f"Fresh Malai Paneer #{suffix}",
            code=f"RAW-PNR-{suffix}",
            cost_price=Decimal("320.00"),
            min_stock_level=Decimal("20.00"),
            is_active=True
        )
        item_butter = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit.id,
            name=f"Amul Butter Block #{suffix}",
            code=f"RAW-BTR-{suffix}",
            cost_price=Decimal("450.00"),
            min_stock_level=Decimal("15.00"),
            is_active=True
        )
        db.add_all([item_paneer, item_butter])
        db.flush()

        # Stock Balance (Paneer is LOW stock: 8kg <= min 20kg; Butter is 25kg)
        sb_p = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_a.id,
            item_id=item_paneer.id,
            quantity=Decimal("8.00"),
            min_stock_level=Decimal("20.00")
        )
        sb_b = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=wh_a.id,
            item_id=item_butter.id,
            quantity=Decimal("25.00"),
            min_stock_level=Decimal("15.00")
        )
        db.add_all([sb_p, sb_b])

        # Dining Tables
        dt1 = DiningTable(id=str(uuid.uuid4()), company_id=company.id, branch_id=branch_a.id, table_number="T-01", capacity=4, section="Main Dining", status="OCCUPIED", is_active=True)
        dt2 = DiningTable(id=str(uuid.uuid4()), company_id=company.id, branch_id=branch_a.id, table_number="T-02", capacity=6, section="Courtyard Patio", status="AVAILABLE", is_active=True)
        db.add_all([dt1, dt2])

        # Today's Order
        order_1 = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            table_id=dt1.id,
            order_number=f"ORD-PALACE-{suffix}-01",
            status="COMPLETED",
            guest_count=4,
            sub_total=Decimal("2400.00"),
            tax_amount=Decimal("120.00"),
            total_amount=Decimal("2520.00"),
            created_at=datetime.datetime.utcnow()
        )
        db.add(order_1)

        # Purchase Request
        pr_1 = PurchaseRequest(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            request_number=f"PR-PALACE-{suffix}-01",
            priority="HIGH",
            status=PRStatus.PENDING_APPROVAL,
            requested_by_id=mgr_user.id,
            required_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
            notes="Urgent paneer replenishment"
        )
        db.add(pr_1)

        # Wastage Entry
        we_1 = WastageEntry(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_a.id,
            warehouse_id=wh_a.id,
            entry_number=f"WST-PALACE-{suffix}-01",
            entry_date=datetime.datetime.utcnow(),
            status=WastageStatus.PENDING_APPROVAL,
            total_cost=Decimal("450.00"),
            total_items_count=1,
            reported_by_id=mgr_user.id,
            notes="Expired packaging damage"
        )
        db.add(we_1)

        db.commit()

        # Generate JWT tokens
        admin_token = create_access_token(
            subject=admin_user.id,
            claims={"role": role_admin.name, "company_id": company.id}
        )
        mgr_token = create_access_token(
            subject=mgr_user.id,
            claims={"role": role_mgr.name, "company_id": company.id}
        )

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

        # ==============================================================================
        # [TEST 1] Authenticated Outlet Manager fetching Branch A Dashboard
        # ==============================================================================
        print("\n[TEST 1] Scoped Outlet Manager Dashboard (Branch A):")
        res_mgr = client.get(
            f"/api/v1/reports/outlet-dashboard?branch_id={branch_a.id}",
            headers=mgr_headers
        )
        check("Manager dashboard returns 200 OK", res_mgr.status_code == 200)
        data = res_mgr.json()

        # Validate Outlet Info
        check("Outlet ID matches Branch A", data.get("outlet", {}).get("id") == branch_a.id)
        check("Outlet Code is populated", data.get("outlet", {}).get("code") == branch_a.code)
        check("Outlet Type is HOTEL", data.get("outlet", {}).get("type") == "HOTEL")

        # Validate Today Sales
        today_sales = data.get("todaySales", {})
        check("Today sales equals 2520.00", Decimal(str(today_sales.get("todaySales", 0))) == Decimal("2520.00"))
        check("Today orders count equals 1", today_sales.get("todayOrdersCount") == 1)
        check("Active occupied tables equals 1", today_sales.get("activeTablesOccupied") == 1)
        check("Total dining tables equals 2", today_sales.get("totalDiningTables") == 2)

        # Validate Stock & Low Stock Items
        stock = data.get("stock", {})
        check("Total items in stock equals 2", stock.get("totalItemsInStock") == 2)
        expected_val = (Decimal("8.00") * Decimal("320.00")) + (Decimal("25.00") * Decimal("450.00")) # 2560 + 11250 = 13810
        check("Total stock value is accurately computed", Decimal(str(stock.get("totalStockValue", 0))) == expected_val)
        check("Low stock count is 1 (Paneer)", stock.get("lowStockCount") == 1)
        check("Low stock items list contains Paneer", len(stock.get("lowStockItems", [])) > 0)
        check("Low stock item code matches RAW-PNR", stock.get("lowStockItems", [])[0].get("code") == item_paneer.code)

        # Validate Procurement PRs
        proc = data.get("procurement", {})
        check("Pending PR count is 1", proc.get("pendingPrCount") == 1)

        # Validate Wastage
        wastage = data.get("wastage", {})
        check("Today wastage cost equals 450.00", Decimal(str(wastage.get("todayWastageCost", 0))) == Decimal("450.00"))
        check("Pending wastage approvals count equals 1", wastage.get("pendingWastageApprovals") == 1)

        # Validate Closing Cycle
        closing = data.get("closingCycle", {})
        check("Closing period label is present", bool(closing.get("periodLabel")))
        check("Closing days remaining is non-negative", closing.get("daysRemaining", -1) >= 0)

        # Validate Recent Activities Stream
        activities = data.get("recentActivities", [])
        check("Recent activities contain at least 3 events (Order, PR, Wastage)", len(activities) >= 3)
        activity_types = [a.get("type") for a in activities]
        check("Order event present in stream", "ORDER" in activity_types)
        check("PR event present in stream", "PURCHASE_REQUEST" in activity_types)
        check("Wastage event present in stream", "WASTAGE" in activity_types)

        # Validate Role-Based Allowed Modules
        allowed_mods = data.get("allowedModules", [])
        check("Inventory module allowed for Outlet Manager", "inventory" in allowed_mods)
        check("Purchase module allowed for Outlet Manager", "purchase" in allowed_mods)
        check("Production module allowed for Outlet Manager", "production" in allowed_mods)
        check("Transfers module allowed for Outlet Manager", "transfers" in allowed_mods)
        check("Wastage module allowed for Outlet Manager", "wastage" in allowed_mods)
        check("Telemetry module hidden from non-admin Outlet Manager", "telemetry" not in allowed_mods)

        # ==============================================================================
        # [TEST 2] Multi-Tenant & Outlet Isolation Security Guard (403 Forbidden)
        # ==============================================================================
        print("\n[TEST 2] Strict Outlet Isolation Security Guard:")
        res_cross_outlet = client.get(
            f"/api/v1/reports/outlet-dashboard?branch_id={branch_b.id}",
            headers=mgr_headers
        )
        check("Outlet Manager accessing unauthorized Branch B is rejected with 403 Forbidden", res_cross_outlet.status_code == 403)

        # ==============================================================================
        # [TEST 3] SuperAdmin Global Authority
        # ==============================================================================
        print("\n[TEST 3] SuperAdmin Global Authority:")
        res_admin_a = client.get(
            f"/api/v1/reports/outlet-dashboard?branch_id={branch_a.id}",
            headers=admin_headers
        )
        check("Admin accessing Branch A returns 200 OK", res_admin_a.status_code == 200)

        res_admin_b = client.get(
            f"/api/v1/reports/outlet-dashboard?branch_id={branch_b.id}",
            headers=admin_headers
        )
        check("Admin accessing Branch B returns 200 OK", res_admin_b.status_code == 200)
        data_b = res_admin_b.json()
        check("Branch B dashboard is scoped to Branch B code", data_b.get("outlet", {}).get("code") == branch_b.code)
        check("Branch B stock is isolated from Branch A", Decimal(str(data_b.get("stock", {}).get("totalStockValue", 0))) == Decimal("0.00"))

        # ==============================================================================
        # [TEST 4] Unauthenticated Requests Blocked (401 Unauthorized)
        # ==============================================================================
        print("\n[TEST 4] Unauthenticated Security Guard:")
        res_unauth = client.get(f"/api/v1/reports/outlet-dashboard?branch_id={branch_a.id}")
        check("Unauthenticated request blocked with 401 Unauthorized", res_unauth.status_code == 401)

        print("\n" + "=" * 80)
        print(f"SUCCESS: ALL {passed}/{total} OUTLET DASHBOARD TESTS PASSED (100%)!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_outlet_dashboard_tests()

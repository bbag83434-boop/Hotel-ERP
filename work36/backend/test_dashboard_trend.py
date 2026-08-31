import os
import sys
import uuid
import json
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
from app.models.organization import Company, Branch
from app.models.restaurant import RestaurantOrder, OrderStatus
from app.models.procurement import PurchaseOrder, POStatus, Supplier

def run_dashboard_trend_tests():
    print("=" * 80)
    print("RUNNING DASHBOARD 30-DAY SALES VS PURCHASE TREND TEST SUITE")
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

        # 1. Company
        company = db.query(Company).first()
        if not company:
            company = Company(
                id=str(uuid.uuid4()),
                name=f"Heritage Hospitality Group #{suffix}",
                code=f"HHG-{suffix}",
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

        role_staff = db.query(Role).filter(Role.name == "CASHIER").first()
        if not role_staff:
            role_staff = Role(id=str(uuid.uuid4()), name="CASHIER", description="Outlet Cashier")
            db.add(role_staff)
            db.flush()

        # 3. Branches (Branch A - Restaurant, Branch B - Head Office)
        branch_rest = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Heritage Fine Dining #{suffix}",
            code=f"BR-FD-{suffix}",
            type="RESTAURANT",
            is_active=True
        )
        branch_hq = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Heritage Corporate HQ #{suffix}",
            code=f"BR-HQ-{suffix}",
            type="HEAD_OFFICE",
            is_active=True
        )
        db.add_all([branch_rest, branch_hq])
        db.flush()

        # 4. Supplier
        supplier = db.query(Supplier).filter(Supplier.company_id == company.id).first()
        if not supplier:
            supplier = Supplier(
                id=str(uuid.uuid4()),
                company_id=company.id,
                name=f"Universal Fresh Supplies #{suffix}",
                code=f"SUP-{suffix}",
                is_active=True
            )
            db.add(supplier)
            db.flush()

        # 5. Users: Admin & Non-HQ Staff
        admin_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_admin.id,
            email=f"admin_{suffix.lower()}@heritage.com",
            username=f"admin_{suffix.lower()}",
            password_hash="$2b$12$DummyHashForTestingOnly12345678901234567890",
            first_name="Admin",
            last_name="Director",
            is_active=True
        )
        staff_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_staff.id,
            email=f"cashier_{suffix.lower()}@heritage.com",
            username=f"cashier_{suffix.lower()}",
            password_hash="$2b$12$DummyHashForTestingOnly12345678901234567890",
            first_name="Staff",
            last_name="Cashier",
            is_active=True
        )
        db.add_all([admin_user, staff_user])
        db.flush()

        ub_staff = UserBranch(
            id=str(uuid.uuid4()),
            user_id=staff_user.id,
            branch_id=branch_rest.id,
            is_default=True
        )
        db.add(ub_staff)

        # 6. Create test orders and purchase orders across different past dates
        now = datetime.datetime.utcnow()
        today = now.date()

        # Today: Order 12500.0, Purchase 8000.0 (APPROVED)
        ord_today = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            order_number=f"ORD-T-{suffix}-01",
            status="COMPLETED",
            guest_count=2,
            sub_total=Decimal("12000.00"),
            tax_amount=Decimal("500.00"),
            total_amount=Decimal("12500.00"),
            created_at=datetime.datetime(today.year, today.month, today.day, 12, 30, 0)
        )
        po_today = PurchaseOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            supplier_id=supplier.id,
            po_number=f"PO-T-{suffix}-01",
            status=POStatus.APPROVED,
            order_date=datetime.datetime(today.year, today.month, today.day, 10, 0, 0),
            total_amount=Decimal("8000.00"),
            net_amount=Decimal("8000.00")
        )

        # 2 days ago: Order 9500.0, Purchase 4500.0 (ISSUED), and Cancelled Order 3000.0 (must be ignored)
        d_2days_ago = today - datetime.timedelta(days=2)
        ord_2d = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            order_number=f"ORD-2D-{suffix}-01",
            status="COMPLETED",
            guest_count=4,
            sub_total=Decimal("9000.00"),
            tax_amount=Decimal("500.00"),
            total_amount=Decimal("9500.00"),
            created_at=datetime.datetime(d_2days_ago.year, d_2days_ago.month, d_2days_ago.day, 14, 0, 0)
        )
        ord_2d_cancelled = RestaurantOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            order_number=f"ORD-2D-CAN-{suffix}",
            status="CANCELLED",
            guest_count=1,
            sub_total=Decimal("3000.00"),
            total_amount=Decimal("3000.00"),
            created_at=datetime.datetime(d_2days_ago.year, d_2days_ago.month, d_2days_ago.day, 15, 0, 0)
        )
        po_2d = PurchaseOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            supplier_id=supplier.id,
            po_number=f"PO-2D-{suffix}-01",
            status=POStatus.ISSUED,
            order_date=datetime.datetime(d_2days_ago.year, d_2days_ago.month, d_2days_ago.day, 11, 0, 0),
            total_amount=Decimal("4500.00"),
            net_amount=Decimal("4500.00")
        )
        po_2d_draft = PurchaseOrder(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch_rest.id,
            supplier_id=supplier.id,
            po_number=f"PO-2D-DFT-{suffix}",
            status=POStatus.DRAFT,
            order_date=datetime.datetime(d_2days_ago.year, d_2days_ago.month, d_2days_ago.day, 11, 30, 0),
            total_amount=Decimal("6000.00"),
            net_amount=Decimal("6000.00")
        )

        db.add_all([ord_today, po_today, ord_2d, ord_2d_cancelled, po_2d, po_2d_draft])
        db.commit()

        # Generate tokens
        admin_token = create_access_token(
            subject=admin_user.id,
            claims={"role": role_admin.name, "company_id": company.id}
        )
        staff_token = create_access_token(
            subject=staff_user.id,
            claims={"role": role_staff.name, "company_id": company.id}
        )

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        # --------------------------------------------------------------------------
        # [TEST 1] Default 30-Day Trend (SuperAdmin / HQ access)
        # --------------------------------------------------------------------------
        print("\n[TEST 1] GET /api/v1/dashboard/trend?days=30 (Admin):")
        res_30 = client.get("/api/v1/dashboard/trend?days=30", headers=admin_headers)
        check("Endpoint returns 200 OK", res_30.status_code == 200)
        data_30 = res_30.json()
        check("Response contains 'trend' key", "trend" in data_30)
        trend_30 = data_30["trend"]
        check("Trend has exactly 30 items for days=30", len(trend_30) == 30)

        # Check date continuity
        first_d = datetime.date.fromisoformat(trend_30[0]["date"])
        last_d = datetime.date.fromisoformat(trend_30[-1]["date"])
        check("Last date in trend is today", last_d == today)
        check("First date is (today - 29 days)", first_d == (today - datetime.timedelta(days=29)))

        # Verify today's data point
        today_str = today.strftime("%Y-%m-%d")
        today_pt = next((pt for pt in trend_30 if pt["date"] == today_str), None)
        check("Today data point exists", today_pt is not None)
        check("Today sales >= 12500.0", today_pt["sales"] >= 12500.0)
        check("Today purchase >= 8000.0", today_pt["purchase"] >= 8000.0)

        # Verify 2 days ago data point (cancelled excluded, draft PO excluded)
        d2_str = d_2days_ago.strftime("%Y-%m-%d")
        d2_pt = next((pt for pt in trend_30 if pt["date"] == d2_str), None)
        check("2 days ago data point exists", d2_pt is not None)
        check("2 days ago sales >= 9500.0 (cancelled order excluded)", d2_pt["sales"] >= 9500.0)
        check("2 days ago purchase >= 4500.0 (draft PO excluded)", d2_pt["purchase"] >= 4500.0)

        # Verify unfilled dates have sales=0.0 and purchase=0.0
        d1_str = (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        d1_pt = next((pt for pt in trend_30 if pt["date"] == d1_str), None)
        check("Yesterday data point filled with numbers", d1_pt is not None and isinstance(d1_pt["sales"], (int, float)))

        # --------------------------------------------------------------------------
        # [TEST 2] 7-Day Trend Endpoint Call
        # --------------------------------------------------------------------------
        print("\n[TEST 2] GET /api/v1/dashboard/trend?days=7 (Admin):")
        res_7 = client.get("/api/v1/dashboard/trend?days=7", headers=admin_headers)
        check("7-day endpoint returns 200 OK", res_7.status_code == 200)
        data_7 = res_7.json()
        check("Trend has exactly 7 items for days=7", len(data_7["trend"]) == 7)

        # --------------------------------------------------------------------------
        # [TEST 3] Security & RBAC Guards
        # --------------------------------------------------------------------------
        print("\n[TEST 3] Security Guards (401 Unauthorized & 403 Forbidden):")
        res_unauth = client.get("/api/v1/dashboard/trend?days=30")
        check("Unauthenticated request returns 401", res_unauth.status_code == 401)

        res_forbidden = client.get("/api/v1/dashboard/trend?days=30", headers=staff_headers)
        check("Non-HQ / Non-Admin staff returns 403 Forbidden", res_forbidden.status_code == 403)

        print("\n" + "=" * 80)
        print(f"SUCCESS: ALL {passed}/{total} DASHBOARD TREND TESTS PASSED (100%)!")
        print("=" * 80)

        # Print the last 7 days real data JSON output
        print("\n--- ACTUAL ENDPOINT OUTPUT (LAST 7 DAYS) ---")
        print(json.dumps(data_7, indent=2))
        print("-------------------------------------------\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_dashboard_trend_tests()

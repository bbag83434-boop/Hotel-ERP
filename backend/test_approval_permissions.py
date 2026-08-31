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
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Category, Unit, StockBalance, StockLedger
from app.models.procurement import PurchaseRequest, PurchaseRequestItem, PRStatus, PRPriority
from app.models.wastage import WastageEntry, WastageItem, WastageStatus, WastageReasonCode
from app.core.security import create_access_token

def run_approval_permission_tests():
    print("=" * 80)
    print("RUNNING APPROVAL / REJECTION PERMISSION & SECURITY GUARD TEST SUITE")
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
                name=f"Hospitality Security Test Group #{suffix}",
                code=f"SEC-{suffix}",
                is_active=True
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # 2. Branch & Warehouse
        branch = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Downtown Bistro #{suffix}",
            code=f"DTB-{suffix}",
            is_active=True
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)

        warehouse = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch.id,
            name=f"Main Kitchen Warehouse #{suffix}",
            code=f"MKW-{suffix}",
            is_active=True
        )
        db.add(warehouse)
        db.commit()
        db.refresh(warehouse)

        # 3. Item
        cat = db.query(Category).filter(Category.company_id == company.id).first()
        if not cat:
            cat = Category(id=str(uuid.uuid4()), company_id=company.id, name=f"Food Ingredients #{suffix}", code=f"FOOD-{suffix}")
            db.add(cat)
            db.commit()
            db.refresh(cat)

        unit = db.query(Unit).filter(Unit.company_id == company.id).first()
        if not unit:
            unit = Unit(id=str(uuid.uuid4()), company_id=company.id, name="Kilogram", symbol="KG")
            db.add(unit)
            db.commit()
            db.refresh(unit)

        item = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit.id,
            name=f"Organic Salmon Fillet #{suffix}",
            code=f"SALMON-{suffix}",
            cost_price=Decimal("1200.0000"),
            min_stock_level=Decimal("10.0000"),
            is_active=True
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        # Initial Stock
        stock_bal = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity=Decimal("50.0000")
        )
        db.add(stock_bal)
        db.commit()

        # 4. Roles Setup
        def get_or_create_role(role_name: str) -> Role:
            r = db.query(Role).filter(Role.name == role_name).first()
            if not r:
                r = Role(id=str(uuid.uuid4()), name=role_name, description=f"{role_name} Role")
                db.add(r)
                db.commit()
                db.refresh(r)
            return r

        role_super_admin = get_or_create_role("SUPER_ADMIN")
        role_hq_admin = get_or_create_role("HQ_ADMIN")
        role_cpm = get_or_create_role("CENTRAL_PURCHASE_MANAGER")
        role_gm = get_or_create_role("GENERAL_MANAGER")
        role_director = get_or_create_role("DIRECTOR")
        role_outlet_manager = get_or_create_role("OUTLET_MANAGER")
        role_staff = get_or_create_role("KITCHEN_STAFF")
        role_fake_admin = get_or_create_role("KITCHEN_ADMIN")  # Substring match trap

        # 5. Users Setup
        def create_user(email_prefix: str, role_obj: Role, assign_branch: bool = True) -> Tuple[User, str]:
            u = User(
                id=str(uuid.uuid4()),
                company_id=company.id,
                role_id=role_obj.id,
                email=f"{email_prefix}_{suffix}@test.com",
                username=f"{email_prefix}_{suffix}",
                password_hash="test_password_hash",
                first_name="Test",
                last_name=role_obj.name,
                is_active=True
            )
            db.add(u)
            db.commit()
            db.refresh(u)

            if assign_branch:
                ub = UserBranch(
                    id=str(uuid.uuid4()),
                    user_id=u.id,
                    branch_id=branch.id,
                    is_default=True
                )
                db.add(ub)
                db.commit()

            tok = create_access_token(subject=u.id, claims={"email": u.email})
            return u, tok

        user_hq, tok_hq = create_user("hq_admin", role_hq_admin, assign_branch=True)
        user_cpm, tok_cpm = create_user("cpm", role_cpm, assign_branch=True)
        user_director, tok_director = create_user("director", role_director, assign_branch=True)
        user_outlet_mgr, tok_outlet_mgr = create_user("outlet_mgr", role_outlet_manager, assign_branch=True)
        user_staff, tok_staff = create_user("staff", role_staff, assign_branch=True)
        user_fake_admin, tok_fake_admin = create_user("fake_admin", role_fake_admin, assign_branch=True)
        user_unassigned, tok_unassigned = create_user("unassigned", role_staff, assign_branch=False)

        def auth_h(token: str) -> dict:
            return {"Authorization": f"Bearer {token}"}

        print("\n[SECTION A] PURCHASE REQUEST APPROVAL & REJECTION AUTHORIZATION TESTS")

        # Helper to create PR
        def create_test_pr(requester_id: str) -> PurchaseRequest:
            pr = PurchaseRequest(
                id=str(uuid.uuid4()),
                company_id=company.id,
                branch_id=branch.id,
                request_number=f"PR-TEST-{uuid.uuid4().hex[:6].upper()}",
                status=PRStatus.PENDING_APPROVAL,
                priority=PRPriority.MEDIUM,
                required_date=datetime.datetime.utcnow() + datetime.timedelta(days=2),
                requested_by_id=requester_id,
                notes="Automated Security Test PR"
            )
            db.add(pr)
            db.commit()
            db.refresh(pr)

            pri = PurchaseRequestItem(
                id=str(uuid.uuid4()),
                request_id=pr.id,
                item_id=item.id,
                requested_qty=Decimal("2.0000"),
                estimated_price=Decimal("1200.0000"),
                notes="Weekly restock"
            )
            db.add(pri)
            db.commit()
            return pr

        # A.1 HQ Role approve succeeds
        pr1 = create_test_pr(requester_id=user_staff.id)
        res_a1 = client.post(f"/api/v1/procurement/requests/{pr1.id}/approve", headers=auth_h(tok_hq))
        check("HQ_ADMIN can approve Purchase Request (200 OK)", res_a1.status_code == 200)

        # A.2 HQ Role reject succeeds
        pr2 = create_test_pr(requester_id=user_staff.id)
        res_a2 = client.post(f"/api/v1/procurement/requests/{pr2.id}/reject", json={"reason": "Excessive quantity"}, headers=auth_h(tok_cpm))
        check("CENTRAL_PURCHASE_MANAGER can reject Purchase Request (200 OK)", res_a2.status_code == 200)

        # A.3 OUTLET_MANAGER with branch assignment -> Approve returns 403
        pr3 = create_test_pr(requester_id=user_staff.id)
        res_a3 = client.post(f"/api/v1/procurement/requests/{pr3.id}/approve", headers=auth_h(tok_outlet_mgr))
        check("OUTLET_MANAGER with UserBranch assignment cannot approve PR (403 Forbidden)", res_a3.status_code == 403)

        # A.4 OUTLET_MANAGER with branch assignment -> Reject returns 403
        res_a4 = client.post(f"/api/v1/procurement/requests/{pr3.id}/reject", json={"reason": "Denied"}, headers=auth_h(tok_outlet_mgr))
        check("OUTLET_MANAGER with UserBranch assignment cannot reject PR (403 Forbidden)", res_a4.status_code == 403)

        # A.5 STAFF with branch assignment -> Approve returns 403
        res_a5 = client.post(f"/api/v1/procurement/requests/{pr3.id}/approve", headers=auth_h(tok_staff))
        check("STAFF with UserBranch assignment cannot approve PR (403 Forbidden)", res_a5.status_code == 403)

        # A.6 Fake admin with substring match ('KITCHEN_ADMIN') -> Approve returns 403
        res_a6 = client.post(f"/api/v1/procurement/requests/{pr3.id}/approve", headers=auth_h(tok_fake_admin))
        check("Substring role 'KITCHEN_ADMIN' cannot approve PR (403 Forbidden)", res_a6.status_code == 403)

        # A.7 Non-HQ user without branch assignment -> 403
        res_a7 = client.post(f"/api/v1/procurement/requests/{pr3.id}/approve", headers=auth_h(tok_unassigned))
        check("Non-HQ unassigned user cannot approve PR (403 Forbidden)", res_a7.status_code == 403)

        # A.8 Self-approval blocked: HQ user attempting to approve own created PR -> 403
        pr_self = create_test_pr(requester_id=user_hq.id)
        res_a8 = client.post(f"/api/v1/procurement/requests/{pr_self.id}/approve", headers=auth_h(tok_hq))
        check("HQ user cannot self-approve own Purchase Request (403 Forbidden)", res_a8.status_code == 403)

        print("\n[SECTION B] WASTAGE ENTRY APPROVAL & REJECTION AUTHORIZATION TESTS")

        # Helper to create Wastage
        def create_test_wastage(reporter_id: str) -> WastageEntry:
            w = WastageEntry(
                id=str(uuid.uuid4()),
                company_id=company.id,
                branch_id=branch.id,
                warehouse_id=warehouse.id,
                entry_number=f"WST-TEST-{uuid.uuid4().hex[:6].upper()}",
                status=WastageStatus.PENDING_APPROVAL,
                total_cost=Decimal("1200.0000"),
                total_items_count=1,
                reported_by_id=reporter_id,
                notes="Security Test Wastage"
            )
            db.add(w)
            db.commit()
            db.refresh(w)

            wi = WastageItem(
                id=str(uuid.uuid4()),
                wastage_entry_id=w.id,
                item_id=item.id,
                quantity=Decimal("1.0000"),
                unit_cost=Decimal("1200.0000"),
                total_cost=Decimal("1200.0000"),
                reason_code=WastageReasonCode.EXPIRED,
                notes="Expired batch"
            )
            db.add(wi)
            db.commit()
            return w

        # B.1 HQ Role approve wastage succeeds
        w1 = create_test_wastage(reporter_id=user_staff.id)
        res_b1 = client.post(f"/api/v1/wastage/entries/{w1.id}/approve", json={"notes": "HQ approved"}, headers=auth_h(tok_director))
        check("DIRECTOR can approve Wastage Entry (200 OK)", res_b1.status_code == 200)

        # B.2 HQ Role reject wastage succeeds
        w2 = create_test_wastage(reporter_id=user_staff.id)
        res_b2 = client.post(f"/api/v1/wastage/entries/{w2.id}/reject", json={"rejection_reason": "Not valid wastage"}, headers=auth_h(tok_hq))
        check("HQ_ADMIN can reject Wastage Entry (200 OK)", res_b2.status_code == 200)

        # B.3 OUTLET_MANAGER with branch assignment -> Approve returns 403
        w3 = create_test_wastage(reporter_id=user_staff.id)
        res_b3 = client.post(f"/api/v1/wastage/entries/{w3.id}/approve", json={"notes": "Manager attempt"}, headers=auth_h(tok_outlet_mgr))
        check("OUTLET_MANAGER with UserBranch assignment cannot approve Wastage (403 Forbidden)", res_b3.status_code == 403)

        # B.4 OUTLET_MANAGER with branch assignment -> Reject returns 403
        res_b4 = client.post(f"/api/v1/wastage/entries/{w3.id}/reject", json={"rejection_reason": "Denied"}, headers=auth_h(tok_outlet_mgr))
        check("OUTLET_MANAGER with UserBranch assignment cannot reject Wastage (403 Forbidden)", res_b4.status_code == 403)

        # B.5 STAFF with branch assignment -> Approve returns 403
        res_b5 = client.post(f"/api/v1/wastage/entries/{w3.id}/approve", json={"notes": "Staff attempt"}, headers=auth_h(tok_staff))
        check("STAFF with UserBranch assignment cannot approve Wastage (403 Forbidden)", res_b5.status_code == 403)

        # B.6 Substring role 'KITCHEN_ADMIN' -> Approve returns 403
        res_b6 = client.post(f"/api/v1/wastage/entries/{w3.id}/approve", json={"notes": "Admin attempt"}, headers=auth_h(tok_fake_admin))
        check("Substring role 'KITCHEN_ADMIN' cannot approve Wastage (403 Forbidden)", res_b6.status_code == 403)

        # B.7 Self-approval blocked: HQ user attempting to approve own reported Wastage -> 403
        w_self = create_test_wastage(reporter_id=user_hq.id)
        res_b7 = client.post(f"/api/v1/wastage/entries/{w_self.id}/approve", json={"notes": "Self approval"}, headers=auth_h(tok_hq))
        check("HQ user cannot self-approve own Wastage Entry (403 Forbidden)", res_b7.status_code == 403)

        print("\n[SECTION C] REGRESSION & PERMITTED OUTLET OPERATION TESTS")

        # C.1 Outlet user can still create PR
        res_c1 = client.post(
            "/api/v1/procurement/requests",
            json={
                "branch_id": branch.id,
                "priority": "MEDIUM",
                "notes": "Outlet staff regular PR creation",
                "items": [
                    {
                        "item_id": item.id,
                        "requested_qty": 3.0,
                        "estimated_price": 1200.0,
                        "notes": "Weekly restock"
                    }
                ]
            },
            headers=auth_h(tok_outlet_mgr)
        )
        check("OUTLET_MANAGER can create Purchase Request (201 Created)", res_c1.status_code == 201)

        # C.2 Outlet user can still list PRs
        res_c2 = client.get(f"/api/v1/procurement/requests?branch_id={branch.id}", headers=auth_h(tok_outlet_mgr))
        check("OUTLET_MANAGER can list Purchase Requests (200 OK)", res_c2.status_code == 200)

        # C.3 Outlet user can still create Wastage
        res_c3 = client.post(
            "/api/v1/wastage/entries",
            json={
                "branch_id": branch.id,
                "warehouse_id": warehouse.id,
                "auto_submit": False,
                "notes": "Outlet staff regular wastage logging",
                "items": [
                    {
                        "item_id": item.id,
                        "quantity": 1.0,
                        "unit_cost": 100.0,
                        "reason_code": "BURNT_DROPPED",
                        "notes": "Kitchen spill"
                    }
                ]
            },
            headers=auth_h(tok_staff)
        )
        check("STAFF can create Wastage Entry (201 Created)", res_c3.status_code == 201)
        created_w_id = res_c3.json().get("id")
        check("Entry created as DRAFT when below threshold", res_c3.json().get("status") == "DRAFT")

        # C.4 Outlet user can still submit Wastage Entry
        res_c4 = client.post(f"/api/v1/wastage/entries/{created_w_id}/submit", headers=auth_h(tok_staff))
        check("STAFF can submit draft Wastage Entry for approval (200 OK)", res_c4.status_code == 200)

        # C.5 Outlet user can still list Wastage Entries
        res_c5 = client.get(f"/api/v1/wastage/entries?branch_id={branch.id}", headers=auth_h(tok_staff))
        check("STAFF can list Wastage Entries for their assigned branch (200 OK)", res_c5.status_code == 200)

        print("\n" + "=" * 80)
        print(f"SUCCESS: ALL {passed}/{total} APPROVAL PERMISSION & SECURITY TESTS PASSED (100%)!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_approval_permission_tests()

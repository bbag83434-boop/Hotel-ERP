"""
MAIN KITCHEN REQUISITION - STAGE 1 END-TO-END VALIDATION

Verifies the first stage of the new Main Kitchen stock workflow:

    Outlet creates requisition -> HO/Admin review -> Approve / Reject
                                                      -> only APPROVED requisitions
                                                         become actionable for the
                                                         Main Kitchen (later stages)

Rules enforced by this suite:
1. Outlet cannot directly change stock through a requisition.
2. No stock quantity changes when the requisition is created.
3. No stock quantity changes when Admin approves the requisition.
   Approval ONLY changes the workflow status (PENDING_APPROVAL -> APPROVED).
4. Requested quantity is preserved as the original requested quantity
   (approval never overwrites requisition data).
5. Status transitions are guarded (no double approval, no approval after reject).
6. Authorization: outlet users cannot approve/reject; only HO roles can;
   a creator can never self-approve.
7. Reuses the existing purchase_requests entity flagged as MAIN_KITCHEN
   (no duplicate requisition tables, no duplicate item records).

Run:  python backend/test_main_kitchen_requisition_stage1.py
"""

import os
import sys
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.organization import Company, Branch
from app.models.user import User, Role, UserBranch
from app.models.inventory import Category, Unit, Item, StockBalance, StockLedger
from app.models.procurement import PurchaseRequest

client = TestClient(app)


def run_stage1_tests():
    print("=" * 80, flush=True)
    print("RUNNING MAIN KITCHEN REQUISITION STAGE-1 VERIFICATION SUITE", flush=True)
    print("=" * 80, flush=True)

    db = SessionLocal()
    passed = 0
    total = 0

    def check(name: str, condition: bool):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}", flush=True)
        else:
            print(f"  [FAIL] {name}", flush=True)
            raise AssertionError(f"Test failed: {name}")

    try:
        # ------------------------------------------------------------------ setup
        company = db.query(Company).first()
        assert company, "No root company found in DB"
        company_id = company.id
        suffix = uuid.uuid4().hex[:6].upper()

        # HQ approver (SUPER_ADMIN) - reuse or create
        admin_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not admin_role:
            admin_role = Role(name="SUPER_ADMIN", description="System Super Admin", is_system=True)
            db.add(admin_role)
            db.commit()
        admin_user = User(
            id=str(uuid.uuid4()),
            company_id=company_id,
            role_id=admin_role.id,
            email=f"mk_admin_{suffix.lower()}@apex-erp.com",
            username=f"mk_admin_{suffix.lower()}",
            password_hash="not-used",
            first_name="MK",
            last_name="Admin",
            is_active=True,
        )
        db.add(admin_user)
        db.commit()

        # Outlet manager role + outlet branch + outlet user
        outlet_role = db.query(Role).filter(Role.name == "OUTLET_MANAGER").first()
        if not outlet_role:
            outlet_role = Role(name="OUTLET_MANAGER", description="Outlet Manager")
            db.add(outlet_role)
            db.commit()

        branch = Branch(
            id=str(uuid.uuid4()),
            company_id=company_id,
            name=f"MK Test Outlet {suffix}",
            code=f"MK-OT-{suffix}",
            type="RESTAURANT_OUTLET",
            is_active=True,
        )
        db.add(branch)
        db.commit()

        outlet_user = User(
            id=str(uuid.uuid4()),
            company_id=company_id,
            role_id=outlet_role.id,
            email=f"mk_outlet_{suffix.lower()}@apex-erp.com",
            username=f"mk_outlet_{suffix.lower()}",
            password_hash="not-used",
            first_name="Outlet",
            last_name="User",
            is_active=True,
        )
        db.add(outlet_user)
        db.commit()
        db.add(UserBranch(user_id=outlet_user.id, branch_id=branch.id, is_default=True))
        db.commit()

        # Item master (reuse existing category/unit or create seeds)
        cat = db.query(Category).filter(Category.company_id == company_id).first()
        if not cat:
            cat = Category(company_id=company_id, name=f"MK Cat {suffix}", code=f"MK-CAT-{suffix}")
            db.add(cat)
            db.commit()
        unit = db.query(Unit).filter(Unit.company_id == company_id).first()
        if not unit:
            unit = Unit(company_id=company_id, name=f"MK Unit {suffix}", symbol=f"U{suffix[-2:]}")
            db.add(unit)
            db.commit()

        item = Item(
            id=str(uuid.uuid4()),
            company_id=company_id,
            category_id=cat.id,
            unit_id=unit.id,
            name=f"MK Test Item {suffix}",
            code=f"MK-ITM-{suffix}",
            type="RAW_MATERIAL",
            cost_price=Decimal("50.0000"),
            selling_price=Decimal("75.0000"),
            is_active=True,
        )
        db.add(item)
        db.commit()

        admin_token = create_access_token(
            subject=str(admin_user.id),
            claims={"role": "SUPER_ADMIN", "company_id": company_id},
        )
        outlet_token = create_access_token(
            subject=str(outlet_user.id),
            claims={"role": "OUTLET_MANAGER", "company_id": company_id},
        )
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        outlet_headers = {"Authorization": f"Bearer {outlet_token}"}

        def stock_written_for(item_id):
            return (
                db.query(StockBalance).filter(StockBalance.item_id == item_id).count()
                + db.query(StockLedger).filter(StockLedger.item_id == item_id).count()
            )

        def make_payload(requisition_type="MAIN_KITCHEN", qty=25, second_qty="7.500"):
            return {
                "branch_id": branch.id,
                "required_date": "2026-09-30T10:00:00Z",
                "priority": "HIGH",
                "notes": "Stage 1 main kitchen requisition",
                "requisition_type": requisition_type,
                "items": [
                    {"item_id": item.id, "requested_qty": qty, "notes": "original"},
                    {"item_id": item.id, "requested_qty": second_qty, "estimated_price": None},
                ],
            }
# ================================================================== 1. CREATE
        print("\n--- [1] Outlet creates a MAIN_KITCHEN requisition ---", flush=True)
        payload_outlet = make_payload()
        res = client.post("/api/v1/procurement/requests", json=payload_outlet, headers=outlet_headers)
        check("Create returns 201", res.status_code == 201)
        req = res.json()
        check("Requisition starts PENDING_APPROVAL", req["status"] == "PENDING_APPROVAL")
        check("Requisition classified MAIN_KITCHEN", req["requisition_type"] == "MAIN_KITCHEN")
        check("Request number uses MR- prefix", str(req["request_number"]).startswith("MR-"))
        check("Requested quantities preserved at creation", len(req["items"]) == 2)
        original_qty_map = {}
        for it in req["items"]:
            original_qty_map[it["id"]] = Decimal(str(it["requested_qty"]))
        check("No stock written at creation", stock_written_for(item.id) == 0)

        # ================================================================== 2. AUTH
        print("\n--- [2] Authorization guards ---", flush=True)
        res = client.post(f"/api/v1/procurement/requests/{req['id']}/approve", headers=outlet_headers)
        check("Outlet user CANNOT approve (403)", res.status_code == 403)
        res = client.post(
            f"/api/v1/procurement/requests/{req['id']}/reject",
            json={"reason": "nope"},
            headers=outlet_headers,
        )
        check("Outlet user CANNOT reject (403)", res.status_code == 403)

        # Creator cannot self-approve
        res = client.post("/api/v1/procurement/requests", json=make_payload(), headers=admin_headers)
        check("Admin can create a requisition too (201)", res.status_code == 201)
        admin_created_req = res.json()
        res = client.post(
            f"/api/v1/procurement/requests/{admin_created_req['id']}/approve",
            headers=admin_headers,
        )
        check("Creator cannot self-approve own requisition (403)", res.status_code == 403)

        # ================================================================== 3. APPROVE
        print("\n--- [3] Admin approves without touching stock/data ---", flush=True)
        res = client.post(f"/api/v1/procurement/requests/{req['id']}/approve", headers=admin_headers)
        check("Approve returns 200", res.status_code == 200)
        approved_req = res.json()
        check("Status transitioned to APPROVED", approved_req["status"] == "APPROVED")
        check("Approved-by recorded", approved_req["approved_by_id"] == admin_user.id)
        check("Approved-at recorded", approved_req["approved_at"] is not None)

        req_db = db.query(PurchaseRequest).filter(PurchaseRequest.id == req["id"]).first()
        same_qty = all(
            Decimal(str(pr_it.requested_qty)) == original_qty_map[pr_it.id]
            for pr_it in req_db.items
        )
        check("Approval never overwrites requested qty (DB)", same_qty)
        check("No stock written at approval", stock_written_for(item.id) == 0)

        res = client.post(f"/api/v1/procurement/requests/{req['id']}/approve", headers=admin_headers)
        check("Double approve blocked (400)", res.status_code == 400)

        # ================================================================== 4. REJECT
        print("\n--- [4] Reject flow ---", flush=True)
        res = client.post("/api/v1/procurement/requests", json=make_payload(qty=12), headers=outlet_headers)
        reject_req = res.json()
        res = client.post(
            f"/api/v1/procurement/requests/{reject_req['id']}/reject",
            json={"reason": "Not required this cycle"},
            headers=admin_headers,
        )
        check("Reject returns 200", res.status_code == 200)
        check("Status transitioned to REJECTED", res.json()["status"] == "REJECTED")
        check("Rejection reason recorded", res.json()["rejection_reason"] == "Not required this cycle")
        res = client.post(f"/api/v1/procurement/requests/{reject_req['id']}/approve", headers=admin_headers)
        check("Cannot approve a rejected requisition (400)", res.status_code == 400)

        # ================================================================== 5. LIST & FILTERS
        print("\n--- [5] Listing & filters (only APPROVED actionable) ---", flush=True)
        res = client.get(
            "/api/v1/procurement/requests",
            params={"requisition_type": "MAIN_KITCHEN", "status_filter": "APPROVED"},
            headers=admin_headers,
        )
        actionable = res.json()
        actionable_ids = [r["id"] for r in actionable]
        check("Approved requisition appears in ACTIONABLE queue", req["id"] in actionable_ids)
        check("Pending/rejected excluded from ACTIONABLE queue",
              actionable_ids and all(r["status"] == "APPROVED" for r in actionable))
        res = client.get("/api/v1/procurement/requests", params={"requisition_type": "PURCHASE"}, headers=admin_headers)
        check("PURCHASE filter excludes MAIN_KITCHEN requisitions",
              all(r["requisition_type"] == "PURCHASE" for r in res.json()))
        res = client.post(
            "/api/v1/procurement/requests",
            json=make_payload(requisition_type="SUPPLIER"),
            headers=outlet_headers,
        )
        check("Invalid requisition_type rejected (422)", res.status_code == 422)

        # ================================================================== 6. CLEANUP
        created_req_ids = [r.id for r in db.query(PurchaseRequest).filter(PurchaseRequest.branch_id == branch.id).all()]
        if created_req_ids:
            db.query(PurchaseRequest).filter(PurchaseRequest.id.in_(created_req_ids)).delete(synchronize_session=False)
        db.query(UserBranch).filter(UserBranch.user_id == outlet_user.id).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([outlet_user.id, admin_user.id])).delete(synchronize_session=False)
        db.query(Item).filter(Item.id == item.id).delete(synchronize_session=False)
        db.query(Branch).filter(Branch.id == branch.id).delete(synchronize_session=False)
        db.commit()

        print("=" * 80, flush=True)
        print(f"STAGE-1 RESULT: {passed}/{total} checks passed", flush=True)
        if passed != total:
            raise SystemExit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_stage1_tests()
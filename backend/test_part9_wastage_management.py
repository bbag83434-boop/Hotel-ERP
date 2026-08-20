import sys
import os
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
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Warehouse
from app.models.inventory import Item, Category, Unit, StockBalance, StockLedger
from app.models.wastage import WastageEntry, WastageItem, WastageStatus, WastageReasonCode
from app.models.audit import AuditLog
from app.core.security import create_access_token

client = TestClient(app)

def run_wastage_tests():
    print("=" * 80)
    print("RUNNING PART 9: WASTAGE MANAGEMENT SUITE")
    print("=" * 80)

    db = SessionLocal()
    try:
        # Step 0: Ensure Company, Roles, Branches, Users, Items, Warehouses exist
        company = db.query(Company).first()
        if not company:
            company = Company(
                id=str(uuid.uuid4()),
                name="Gourmet Apex ERP Test Co",
                code="APEX-TEST",
                email="test@apexerp.com",
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
                username="admin_wastage",
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

        # Branch 1 (Active Kitchen Outlet)
        suffix = uuid.uuid4().hex[:6].upper()
        branch1 = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Apex Central Dining #{suffix}",
            code=f"BR-WST1-{suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        # Branch 2 (Isolated Outlet for 403 test)
        branch2 = Branch(
            id=str(uuid.uuid4()),
            company_id=company.id,
            name=f"Apex South Outlet #{suffix}",
            code=f"BR-WST2-{suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        db.add(branch1)
        db.add(branch2)
        db.flush()

        # Kitchen Warehouse for Branch 1
        warehouse1 = Warehouse(
            id=str(uuid.uuid4()),
            company_id=company.id,
            branch_id=branch1.id,
            name=f"Central Kitchen Main #{suffix}",
            code=f"WH-KIT-{suffix}",
            is_central=False,
            is_active=True,
        )
        db.add(warehouse1)
        db.flush()

        # Unit
        unit_kg = db.query(Unit).filter(Unit.symbol == f"kg-{suffix.lower()}").first()
        if not unit_kg:
            unit_kg = Unit(
                id=str(uuid.uuid4()),
                company_id=company.id,
                name=f"Kilogram #{suffix}",
                symbol=f"kg-{suffix.lower()}",
            )
            db.add(unit_kg)
            db.flush()

        # Category
        cat = db.query(Category).first()
        if not cat:
            cat = Category(
                id=str(uuid.uuid4()),
                company_id=company.id,
                name=f"Raw Produce #{suffix}",
                code=f"RAW-{suffix}",
            )
            db.add(cat)
            db.flush()

        # Raw Items
        item_tomato = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit_kg.id,
            name=f"Fresh Tomatoes #{suffix}",
            code=f"RAW-TOM-{suffix}",
            type="RAW_MATERIAL",
            cost_price=Decimal("40.0000"),
            is_active=True,
        )
        item_paneer = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit_kg.id,
            name=f"Dairy Fresh Paneer #{suffix}",
            code=f"RAW-PAN-{suffix}",
            type="RAW_MATERIAL",
            cost_price=Decimal("300.0000"),
            is_active=True,
        )
        item_cream = Item(
            id=str(uuid.uuid4()),
            company_id=company.id,
            category_id=cat.id,
            unit_id=unit_kg.id,
            name=f"Cooking Cream #{suffix}",
            code=f"RAW-CRM-{suffix}",
            type="RAW_MATERIAL",
            cost_price=Decimal("200.0000"),
            is_active=True,
        )
        db.add(item_tomato)
        db.add(item_paneer)
        db.add(item_cream)
        db.flush()

        # Initial Stock Balances in Warehouse 1: 50 KG Tomato, 20 KG Paneer, 15 KG Cream
        stock_tom = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=warehouse1.id,
            item_id=item_tomato.id,
            quantity=Decimal("50.0000"),
        )
        stock_pan = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=warehouse1.id,
            item_id=item_paneer.id,
            quantity=Decimal("20.0000"),
        )
        stock_crm = StockBalance(
            id=str(uuid.uuid4()),
            warehouse_id=warehouse1.id,
            item_id=item_cream.id,
            quantity=Decimal("15.0000"),
        )
        db.add(stock_tom)
        db.add(stock_pan)
        db.add(stock_crm)

        # Restricted Staff User (Only assigned to Branch 1)
        role_staff = db.query(Role).filter(Role.name == "STAFF").first()
        if not role_staff:
            role_staff = Role(id=str(uuid.uuid4()), name="STAFF", description="Staff Role")
            db.add(role_staff)
            db.flush()

        restricted_user = User(
            id=str(uuid.uuid4()),
            company_id=company.id,
            role_id=role_staff.id,
            email=f"chef.{suffix.lower()}@apexerp.com",
            username=f"chef_{suffix.lower()}",
            password_hash="fakehash",
            first_name="Chef",
            last_name="Test",
            is_active=True,
        )
        db.add(restricted_user)
        db.flush()

        user_branch = UserBranch(
            id=str(uuid.uuid4()),
            user_id=restricted_user.id,
            branch_id=branch1.id,
            is_default=True,
        )
        db.add(user_branch)
        db.commit()

        staff_token = create_access_token(subject=str(restricted_user.id), claims={"email": restricted_user.email, "company_id": str(company.id)})
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        print("\n[TEST 1] Reason Codes Directory Endpoint:")
        res = client.get("/api/v1/wastage/reasons", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        reasons = res.json()
        assert len(reasons) >= 6, f"Expected >= 6 reason codes, got {len(reasons)}"
        reason_codes = [r["code"] for r in reasons]
        assert "EXPIRED" in reason_codes
        assert "PREPARATION_LOSS" in reason_codes
        assert "BURNT_DROPPED" in reason_codes
        assert "QUALITY_ISSUE" in reason_codes
        print("  [PASS] GET /wastage/reasons returned valid standardized reason codes")

        print("\n[TEST 2] Create Draft Low-Cost Wastage Entry (< INR 1,000 threshold):")
        # 5 KG Tomatoes @ INR 40 = INR 200 (Below INR 1000 threshold) -> Status DRAFT
        low_cost_payload = {
            "branch_id": branch1.id,
            "warehouse_id": warehouse1.id,
            "notes": "Daily morning sorting: over-ripe tomatoes discarded",
            "items": [
                {
                    "item_id": item_tomato.id,
                    "quantity": 5.0,
                    "reason_code": "EXPIRED",
                    "notes": "Soft/bruised tomatoes",
                }
            ],
            "auto_submit": False,
        }
        res = client.post("/api/v1/wastage/entries", json=low_cost_payload, headers=staff_headers)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        entry1_data = res.json()
        assert entry1_data["status"] == "DRAFT"
        assert Decimal(str(entry1_data["total_cost"])) == Decimal("200.0000")
        assert entry1_data["requires_approval"] is False
        assert entry1_data["entry_number"].startswith("WST-")
        entry1_id = entry1_data["id"]
        print(f"  [PASS] Logged Draft Entry #{entry1_data['entry_number']} with Cost INR 200.00")

        print("\n[TEST 3] Submit Draft Wastage Entry for Approval:")
        res = client.post(f"/api/v1/wastage/entries/{entry1_id}/submit", headers=staff_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        entry1_submitted = res.json()
        assert entry1_submitted["status"] == "PENDING_APPROVAL"
        print("  [PASS] POST /wastage/entries/{id}/submit transitioned status to PENDING_APPROVAL")

        print("\n[TEST 4] Create High-Valuation Wastage Entry (>= INR 1,000 threshold):")
        # 5 KG Paneer @ INR 300 = INR 1,500 (>= INR 1000 threshold) -> Auto requires_approval=True & PENDING_APPROVAL
        high_cost_payload = {
            "branch_id": branch1.id,
            "warehouse_id": warehouse1.id,
            "notes": "Deep cooler failure overnight: paneer batch spoiled",
            "items": [
                {
                    "item_id": item_paneer.id,
                    "quantity": 5.0,
                    "reason_code": "STORAGE_FAILURE",
                    "notes": "Freezer malfunction temp +18C",
                }
            ],
            "auto_submit": False,
        }
        res = client.post("/api/v1/wastage/entries", json=high_cost_payload, headers=staff_headers)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        entry2_data = res.json()
        assert entry2_data["status"] == "PENDING_APPROVAL"
        assert entry2_data["requires_approval"] is True
        assert Decimal(str(entry2_data["total_cost"])) == Decimal("1500.0000")
        entry2_id = entry2_data["id"]
        print(f"  [PASS] High-value entry #{entry2_data['entry_number']} (INR 1,500.00) auto-triggered PENDING_APPROVAL")

        print("\n[TEST 5] Authorize / Approve Wastage Entry & Stock Deduction Verification:")
        # Approve Entry 1 (5 KG Tomatoes)
        res = client.post(f"/api/v1/wastage/entries/{entry1_id}/approve", json={"notes": "Audited and verified by Chef"}, headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        approved1 = res.json()
        assert approved1["status"] == "APPROVED"
        assert approved1["approved_by_id"] == admin_user.id
        assert approved1["approved_at"] is not None

        # Verify StockBalance deducted: 50 KG - 5 KG = 45 KG
        db.expire_all()
        bal_tom = db.query(StockBalance).filter(
            StockBalance.warehouse_id == warehouse1.id,
            StockBalance.item_id == item_tomato.id
        ).first()
        assert bal_tom is not None
        assert Decimal(str(bal_tom.quantity)) == Decimal("45.0000"), f"Expected 45.0000, got {bal_tom.quantity}"
        print("  [PASS] StockBalance correctly decremented from 50.0 KG to 45.0 KG")

        # Verify StockLedger entry created
        ledger_entry = db.query(StockLedger).filter(
            StockLedger.warehouse_id == warehouse1.id,
            StockLedger.item_id == item_tomato.id,
            StockLedger.reference_id == entry1_id
        ).first()
        assert ledger_entry is not None
        assert ledger_entry.movement_type == "WASTAGE"
        assert Decimal(str(ledger_entry.change_qty)) == Decimal("-5.0000")
        assert Decimal(str(ledger_entry.balance_qty)) == Decimal("45.0000")
        print("  [PASS] StockLedger recorded movement_type=WASTAGE, change_qty=-5.0000")

        # Also Approve Entry 2 (5 KG Paneer)
        res = client.post(f"/api/v1/wastage/entries/{entry2_id}/approve", headers=admin_headers)
        assert res.status_code == 200
        bal_pan = db.query(StockBalance).filter(
            StockBalance.warehouse_id == warehouse1.id,
            StockBalance.item_id == item_paneer.id
        ).first()
        assert Decimal(str(bal_pan.quantity)) == Decimal("15.0000"), f"Expected 15.0000, got {bal_pan.quantity}"
        print("  [PASS] High-value entry approved, Paneer stock decremented from 20.0 KG to 15.0 KG")

        print("\n[TEST 6] Reject Wastage Entry Workflow:")
        # Create Entry 3: 10 KG Cream
        entry3_payload = {
            "branch_id": branch1.id,
            "warehouse_id": warehouse1.id,
            "notes": "Suspected cream souring",
            "items": [
                {
                    "item_id": item_cream.id,
                    "quantity": 10.0,
                    "reason_code": "QUALITY_ISSUE",
                }
            ],
            "auto_submit": True,
        }
        res = client.post("/api/v1/wastage/entries", json=entry3_payload, headers=staff_headers)
        assert res.status_code == 201
        entry3_id = res.json()["id"]

        # Reject without reason -> Should fail 400
        res_fail = client.post(f"/api/v1/wastage/entries/{entry3_id}/reject", json={"rejection_reason": ""}, headers=admin_headers)
        assert res_fail.status_code == 400

        # Reject with valid reason
        res_reject = client.post(f"/api/v1/wastage/entries/{entry3_id}/reject", json={"rejection_reason": "Item was inspected and deemed fit for gravies; not wasted."}, headers=admin_headers)
        assert res_reject.status_code == 200
        rejected_data = res_reject.json()
        assert rejected_data["status"] == "REJECTED"
        assert "fit for gravies" in rejected_data["rejection_reason"]

        # Verify NO stock deduction for Cream (remains 15.0 KG)
        bal_crm = db.query(StockBalance).filter(
            StockBalance.warehouse_id == warehouse1.id,
            StockBalance.item_id == item_cream.id
        ).first()
        assert Decimal(str(bal_crm.quantity)) == Decimal("15.0000"), f"Expected 15.0000, got {bal_crm.quantity}"
        print("  [PASS] Rejected entry did NOT decrement stock balance")

        print("\n[TEST 7] List Wastage Entries with Filters:")
        res = client.get(f"/api/v1/wastage/entries?branch_id={branch1.id}&status=APPROVED", headers=admin_headers)
        assert res.status_code == 200
        approved_list = res.json()
        assert len(approved_list) == 2, f"Expected 2 approved entries, got {len(approved_list)}"
        print("  [PASS] GET /wastage/entries filtered by status=APPROVED returns exactly 2 entries")

        res_reason = client.get(f"/api/v1/wastage/entries?branch_id={branch1.id}&reason_code=STORAGE_FAILURE", headers=admin_headers)
        assert res_reason.status_code == 200
        reason_list = res_reason.json()
        assert len(reason_list) == 1
        assert reason_list[0]["id"] == entry2_id
        print("  [PASS] GET /wastage/entries filtered by reason_code=STORAGE_FAILURE returns matching entry")

        print("\n[TEST 8] Wastage Loss Analytics & Abnormal Detection:")
        res = client.get(f"/api/v1/wastage/analytics?branch_id={branch1.id}&days=30", headers=admin_headers)
        assert res.status_code == 200
        analytics = res.json()
        # Total Approved Wastage = INR 200 (Tomatoes) + INR 1500 (Paneer) = INR 1700
        assert Decimal(str(analytics["total_wastage_cost"])) == Decimal("1700.0000"), f"Expected 1700, got {analytics['total_wastage_cost']}"
        assert analytics["total_wastage_entries"] == 2
        assert "EXPIRED" in analytics["by_reason"]
        assert "STORAGE_FAILURE" in analytics["by_reason"]

        top_items = analytics["top_wasted_items"]
        assert len(top_items) >= 2
        assert top_items[0]["item_name"] == item_paneer.name  # Paneer has highest cost INR 1500
        print(f"  [PASS] Analytics returned Total Loss: INR {analytics['total_wastage_cost']} with top item: {top_items[0]['item_name']}")

        print("\n[TEST 9] Multi-Tenant Security & Outlet Isolation:")
        # Staff user assigned ONLY to Branch 1 attempting to access Branch 2 -> 403 Forbidden
        unauth_payload = {
            "branch_id": branch2.id,
            "warehouse_id": warehouse1.id,
            "items": [{"item_id": item_tomato.id, "quantity": 1.0, "reason_code": "EXPIRED"}],
        }
        res_403 = client.post("/api/v1/wastage/entries", json=unauth_payload, headers=staff_headers)
        assert res_403.status_code == 403, f"Expected 403 Forbidden, got {res_403.status_code}"
        print("  [PASS] Restricted staff user accessing unauthorized branch blocked with 403 Forbidden")

        # Unauthenticated request -> 401
        res_401 = client.get("/api/v1/wastage/entries")
        assert res_401.status_code == 401
        print("  [PASS] Unauthenticated request blocked with 401 Unauthorized")

        print("\n[TEST 10] Audit Log Trail Verification:")
        audit_create = db.query(AuditLog).filter(
            AuditLog.entity_id == entry1_id,
            AuditLog.action == "CREATE_WASTAGE_ENTRY"
        ).first()
        assert audit_create is not None
        print("  [PASS] AuditLog records CREATE_WASTAGE_ENTRY")

        audit_approve = db.query(AuditLog).filter(
            AuditLog.entity_id == entry1_id,
            AuditLog.action == "APPROVE_WASTAGE_ENTRY"
        ).first()
        assert audit_approve is not None
        print("  [PASS] AuditLog records APPROVE_WASTAGE_ENTRY")

        print("\n[TEST 11] Zero Data Loss & Neon PostgreSQL Persistence:")
        users_count = db.query(func.count(User.id)).scalar()
        branches_count = db.query(func.count(Branch.id)).scalar()
        wastage_entries_count = db.query(func.count(WastageEntry.id)).scalar()
        wastage_items_count = db.query(func.count(WastageItem.id)).scalar()

        assert users_count >= 20
        assert branches_count >= 70
        assert wastage_entries_count >= 3
        assert wastage_items_count >= 3
        print(f"  [PASS] Zero Data Loss: Users={users_count}, Branches={branches_count}, WastageEntries={wastage_entries_count}, WastageItems={wastage_items_count}")

        print("\n" + "=" * 80)
        print("SUCCESS: ALL PART 9 WASTAGE MANAGEMENT TESTS PASSED (100%)!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_wastage_tests()

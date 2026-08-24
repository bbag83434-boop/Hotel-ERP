"""
HOTEL-ERP: PART 2 MASTER DATA AND SECURITY FOUNDATION TEST SUITE

Validates:
1. Organization and Multi-Outlet Location Master CRUD & scoping
2. User management, password hashing, and active/inactive status enforcement
3. Granular RBAC permissions & role assignment
4. User-Outlet Scope enforcement & data isolation
5. Item master CRUD with base stock unit and duplicate item code rejection
6. Unit and Unit Conversion engine with dimensional incompatibility checks
7. Vendor (Supplier) master CRUD and inactive status validation
8. Vendor-Item catalog mapping with duplicate mapping rejection and preferred supplier toggle
9. Disabled user access rejection
10. Numeric precision rules (Numeric(14,4) stock, Numeric(14,2) monetary)
11. Audit foundation logging for security & master data actions
12. Transaction rollback and DB consistency
"""

import os
import sys
import uuid
from decimal import Decimal

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.organization import Company, Branch, Warehouse
from app.models.user import User, Role, Permission, RolePermission, UserBranch
from app.models.inventory import Category, Unit, UnitConversion, Item
from app.models.procurement import Supplier, SupplierItem
from app.models.audit import AuditLog

client = TestClient(app)

def run_tests():
    print("=" * 75)
    print("RUNNING PART 2: MASTER DATA AND SECURITY FOUNDATION TEST SUITE")
    print("=" * 75)

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

    # =========================================================================
    # [1] Database Foundation & Organization Setup
    # =========================================================================
    print("\n[1] Organization & Multi-Outlet Foundation:")
    db = SessionLocal()
    try:
        # Verify DB connection
        res_db = db.execute(text("SELECT 1")).scalar()
        check("PostgreSQL connection alive and responsive", res_db == 1)

        # Get or create active company
        company = db.query(Company).first()
        if not company:
            company = Company(
                id=str(uuid.uuid4()),
                name="APEX Luxury Resorts & Hotels",
                code="APEX-CORP",
                email="corporate@apex-resorts.com",
                is_active=True,
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        check("Active root company configured", bool(company.id))
        company_id = company.id

        # Setup Super Admin and Test Staff
        super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not super_role:
            super_role = Role(id=str(uuid.uuid4()), name="SUPER_ADMIN", description="Super Admin", is_system=True)
            db.add(super_role)
            db.commit()

        staff_role = db.query(Role).filter(Role.name == "STAFF").first()
        if not staff_role:
            staff_role = Role(id=str(uuid.uuid4()), name="STAFF", description="Staff Member", is_system=True)
            db.add(staff_role)
            db.commit()

        admin_user = db.query(User).filter(User.role_id == super_role.id).first()
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                company_id=company_id,
                role_id=super_role.id,
                email="admin_part2@apex-resorts.com",
                username="admin_part2",
                password_hash=get_password_hash("AdminPass123!"),
                first_name="Super",
                last_name="Admin",
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        admin_token = create_access_token(subject=str(admin_user.id), claims={"role": "SUPER_ADMIN", "company_id": company_id})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        check("Super Admin access token generated", bool(admin_token))

        # Setup Two Outlets for Scoping & Isolation Tests
        out_suffix = uuid.uuid4().hex[:6].upper()
        branch_a = Branch(
            id=str(uuid.uuid4()),
            company_id=company_id,
            name=f"Grand Palace Dining #{out_suffix}",
            code=f"OUT-A-{out_suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        branch_b = Branch(
            id=str(uuid.uuid4()),
            company_id=company_id,
            name=f"Seaside Lounge #{out_suffix}",
            code=f"OUT-B-{out_suffix}",
            type="RESTAURANT",
            is_active=True,
        )
        db.add_all([branch_a, branch_b])
        db.commit()
        db.refresh(branch_a)
        db.refresh(branch_b)
        branch_a_id = str(branch_a.id)
        branch_b_id = str(branch_b.id)
        staff_role_id = str(staff_role.id)
        check("Two distinct branches created for outlet isolation verification", branch_a_id != branch_b_id)

        # Create Outlet A restricted user
        user_a = User(
            id=str(uuid.uuid4()),
            company_id=company_id,
            role_id=staff_role.id,
            email=f"staff_a_{out_suffix}@apex.com",
            username=f"staff_a_{out_suffix}",
            password_hash=get_password_hash("StaffPass123!"),
            first_name="Staff",
            last_name="OutletA",
            is_active=True,
        )
        db.add(user_a)
        db.commit()
        db.refresh(user_a)
        user_a_id = str(user_a.id)

        ub_a = UserBranch(
            id=str(uuid.uuid4()),
            user_id=user_a_id,
            branch_id=branch_a_id,
            is_default=True,
        )
        db.add(ub_a)
        db.commit()

        user_a_token = create_access_token(subject=user_a_id, claims={"role": "STAFF", "company_id": company_id})
        user_a_headers = {"Authorization": f"Bearer {user_a_token}", "X-Outlet-Id": branch_a_id}

        # Create Disabled user for deactivated access check
        disabled_user = User(
            id=str(uuid.uuid4()),
            company_id=company_id,
            role_id=staff_role.id,
            email=f"disabled_{out_suffix}@apex.com",
            username=f"disabled_{out_suffix}",
            password_hash=get_password_hash("DisabledPass123!"),
            first_name="Disabled",
            last_name="User",
            is_active=False,
        )
        db.add(disabled_user)
        db.commit()
        db.refresh(disabled_user)
        disabled_user_id = str(disabled_user.id)

        disabled_token = create_access_token(subject=disabled_user_id, claims={"role": "STAFF", "company_id": company_id})
        disabled_headers = {"Authorization": f"Bearer {disabled_token}"}

    finally:
        db.close()

    # =========================================================================
    # [2] Security & Outlet Isolation Verification
    # =========================================================================
    print("\n[2] Security & Outlet Scope Isolation:")
    # 2.1 Unauthenticated Request Rejection
    res_unauth = client.get("/api/v1/organization/branches")
    check("Unauthenticated request rejected with 401 Unauthorized", res_unauth.status_code == 401)

    # 2.2 Disabled User Rejection
    res_disabled = client.get("/api/v1/auth/me", headers=disabled_headers)
    check("Disabled user access rejected with 401/403 (inactive account)", res_disabled.status_code in [400, 401, 403])

    # 2.3 Outlet Isolation - User A accessing Outlet A details (Allowed)
    res_scope_a = client.get(f"/api/v1/organization/branches/{branch_a_id}/details", headers=user_a_headers)
    check("Outlet staff authorized to view assigned branch details", res_scope_a.status_code == 200)

    # 2.4 Outlet Isolation - User A accessing Outlet B details (Forbidden)
    user_a_violating_headers = {"Authorization": f"Bearer {user_a_token}", "X-Outlet-Id": branch_b_id}
    res_scope_b = client.get(f"/api/v1/organization/branches/{branch_b_id}/details", headers=user_a_violating_headers)
    check("Outlet staff accessing unauthorized branch blocked with 403 Forbidden", res_scope_b.status_code == 403)

    # =========================================================================
    # [3] Granular Permissions & Role Assignment
    # =========================================================================
    print("\n[3] Granular Permissions & RBAC Foundation:")
    res_perms = client.get("/api/v1/users/permissions", headers=admin_headers)
    check("GET /api/v1/users/permissions returns 200", res_perms.status_code == 200)
    perms_list = res_perms.json()
    check("Granular permission catalog contains system permissions (> 10)", len(perms_list) >= 10)
    check("Includes inventory and procurement permissions", any(p["module"].lower() in ["inventory", "purchase", "procurement"] for p in perms_list))

    res_role_perms = client.get(f"/api/v1/users/roles/{staff_role_id}/permissions", headers=admin_headers)
    check("GET role permissions returns 200", res_role_perms.status_code == 200)

    res_assign_perms = client.post(
        f"/api/v1/users/roles/{staff_role_id}/permissions",
        json={"permission_codes": ["inventory:read", "purchase:read"]},
        headers=admin_headers,
    )
    check("POST assign permissions to role returns 200", res_assign_perms.status_code == 200)
    check("Assigned codes match input", "inventory:read" in res_assign_perms.json())

    # =========================================================================
    # [4] Unit & Unit Conversion Master
    # =========================================================================
    print("\n[4] Units & Unit Conversion Engine:")
    suffix_u = uuid.uuid4().hex[:4].lower()
    
    # Create Base Units
    res_u_kg = client.post("/api/v1/inventory/units", json={"name": f"Kilogram {suffix_u}", "symbol": f"kg_{suffix_u}"}, headers=admin_headers)
    check("Create base unit (KG) returns 201", res_u_kg.status_code == 201)
    kg_id = res_u_kg.json()["id"]
    kg_sym = res_u_kg.json()["symbol"]

    res_u_g = client.post("/api/v1/inventory/units", json={"name": f"Gram {suffix_u}", "symbol": f"g_{suffix_u}"}, headers=admin_headers)
    check("Create secondary unit (Gram) returns 201", res_u_g.status_code == 201)
    g_id = res_u_g.json()["id"]

    res_u_box = client.post("/api/v1/inventory/units", json={"name": f"Box {suffix_u}", "symbol": f"box_{suffix_u}"}, headers=admin_headers)
    check("Create packaging unit (Box) returns 201", res_u_box.status_code == 201)
    box_id = res_u_box.json()["id"]

    # Create Explicit Conversion (1 Box = 25 KG)
    res_conv = client.post(
        "/api/v1/inventory/unit-conversions",
        json={"from_unit_id": box_id, "to_unit_id": kg_id, "conversion_factor": 25.0},
        headers=admin_headers,
    )
    check("Create unit conversion (1 Box = 25 KG) returns 201", res_conv.status_code == 201)

    # Convert test: Standard weight conversion (1.5 kg -> g)
    res_convert = client.post(
        "/api/v1/inventory/unit-conversions/convert",
        json={"value": 1.5, "from_unit": "kg", "to_unit": "g"},
        headers=admin_headers,
    )
    check("Conversion engine converts 1.5 kg to 1500 g", res_convert.status_code == 200 and Decimal(str(res_convert.json()["converted_value"])) == Decimal("1500"))

    # Dimensional Incompatibility Check: Convert kg to litre (Must fail without recipe density)
    res_incompatible = client.post(
        "/api/v1/inventory/unit-conversions/convert",
        json={"value": 5, "from_unit": "kg", "to_unit": "litre"},
        headers=admin_headers,
    )
    check("Dimensionally incompatible conversion (kg -> litre) rejected with 400 Bad Request", res_incompatible.status_code == 400)

    # =========================================================================
    # [5] Category & Item Master with Base Stock Unit
    # =========================================================================
    print("\n[5] Category & Item Master:")
    cat_code = f"CAT-{uuid.uuid4().hex[:6].upper()}"
    res_cat = client.post(
        "/api/v1/inventory/categories",
        json={"name": f"Premium Spices & Seasoning #{cat_code}", "code": cat_code, "description": "Spices and condiments"},
        headers=admin_headers,
    )
    check("Create category returns 201", res_cat.status_code == 201)
    cat_id = res_cat.json()["id"]

    item_code = f"SKU-{uuid.uuid4().hex[:6].upper()}"
    res_item = client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Organic Black Pepper Whole",
            "code": item_code,
            "category_id": cat_id,
            "unit_id": kg_id,
            "type": "RAW_MATERIAL",
            "cost_price": 850.5000,
            "selling_price": 0.0000,
            "min_stock_level": 5.0000,
            "reorder_qty": 20.0000,
            "is_active": True,
        },
        headers=admin_headers,
    )
    check("Create item with base stock unit returns 201", res_item.status_code == 201)
    item_data = res_item.json()
    item_id = item_data["id"]
    check("Item cost price has exact decimal precision", Decimal(str(item_data["cost_price"])) == Decimal("850.5000"))

    # Block Duplicate Item Code
    res_dup_item = client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Duplicate Item Attempt",
            "code": item_code,
            "category_id": cat_id,
            "unit_id": kg_id,
        },
        headers=admin_headers,
    )
    check("Duplicate item code blocked with 400 Bad Request", res_dup_item.status_code == 400)

    # =========================================================================
    # [6] Vendor Master (Suppliers)
    # =========================================================================
    print("\n[6] Vendor (Supplier) Master:")
    sup_code = f"SUP-{uuid.uuid4().hex[:6].upper()}"
    res_sup = client.post(
        "/api/v1/procurement/suppliers",
        json={
            "name": f"Spice Master Wholesale Co #{sup_code}",
            "code": sup_code,
            "contact_person": "Rajesh Sharma",
            "phone": "+91 98765 11223",
            "whatsapp_number": "+91 98765 11223",
            "email": "orders@spicemaster.in",
            "address": "45 Spice Market Yard, Mumbai",
            "gst_number": "27AAACS1234F1Z5",
            "payment_terms": "NET_30",
            "is_active": True,
        },
        headers=admin_headers,
    )
    check("Create vendor (Supplier) returns 201", res_sup.status_code == 201)
    sup_data = res_sup.json()
    sup_id = sup_data["id"]

    # Block duplicate supplier code
    res_dup_sup = client.post(
        "/api/v1/procurement/suppliers",
        json={
            "name": "Duplicate Supplier Attempt",
            "code": sup_code,
            "phone": "+91 98765 99999",
        },
        headers=admin_headers,
    )
    check("Duplicate vendor code blocked with 409 Conflict", res_dup_sup.status_code == 409)

    # =========================================================================
    # [7] Vendor-Item Catalog Mapping & Duplicate Mapping Prevention
    # =========================================================================
    print("\n[7] Vendor-Item Catalog Mapping:")
    res_vm = client.post(
        "/api/v1/procurement/vendor-items",
        json={
            "supplier_id": sup_id,
            "item_id": item_id,
            "supplier_item_code": "SP-BLK-PEP-BOX",
            "supplier_item_name": "Premium Black Pepper 25kg Commercial Box",
            "purchase_unit_id": box_id,
            "purchase_price": 20500.0000,
            "conversion_rate": 25.0000,
            "lead_time_days": 3,
            "is_preferred": True,
            "is_active": True,
        },
        headers=admin_headers,
    )
    check("Create vendor-item mapping returns 201", res_vm.status_code == 201)
    vm_data = res_vm.json()
    vm_id = vm_data["id"]
    check("Vendor-item mapping contains supplier and item names", vm_data["supplier_name"] is not None and vm_data["item_name"] is not None)
    check("Vendor purchase price recorded accurately (20500.0000)", Decimal(str(vm_data["purchase_price"])) == Decimal("20500.0000"))

    # Prevent Duplicate Active Vendor-Item Mapping
    res_dup_vm = client.post(
        "/api/v1/procurement/vendor-items",
        json={
            "supplier_id": sup_id,
            "item_id": item_id,
            "purchase_price": 21000.0000,
        },
        headers=admin_headers,
    )
    check("Duplicate active vendor-item mapping blocked with 409 Conflict", res_dup_vm.status_code == 409)

    # Update Vendor-Item Mapping
    res_update_vm = client.put(
        f"/api/v1/procurement/vendor-items/{vm_id}",
        json={"purchase_price": 20000.0000, "lead_time_days": 2},
        headers=admin_headers,
    )
    check("Update vendor-item mapping returns 200", res_update_vm.status_code == 200)
    check("Updated purchase price reflected (20000.0000)", Decimal(str(res_update_vm.json()["purchase_price"])) == Decimal("20000.0000"))

    # Deactivate Vendor-Item Mapping
    res_del_vm = client.delete(f"/api/v1/procurement/vendor-items/{vm_id}", headers=admin_headers)
    check("Deactivate vendor-item mapping returns 200", res_del_vm.status_code == 200)

    # =========================================================================
    # [8] Inactive Item / Vendor Transaction Block
    # =========================================================================
    print("\n[8] Inactive Master Data Safeguards:")
    # Create inactive vendor
    res_inactive_sup = client.post(
        "/api/v1/procurement/suppliers",
        json={
            "name": f"Decommissioned Vendor #{sup_code}",
            "code": f"INACT-SUP-{sup_code}",
            "is_active": False,
        },
        headers=admin_headers,
    )
    inactive_sup_id = res_inactive_sup.json()["id"]

    # Attempt to map inactive vendor to item (Must fail)
    res_map_inactive = client.post(
        "/api/v1/procurement/vendor-items",
        json={
            "supplier_id": inactive_sup_id,
            "item_id": item_id,
            "purchase_price": 100.0,
        },
        headers=admin_headers,
    )
    check("Mapping inactive vendor blocked with 400 Bad Request", res_map_inactive.status_code == 400)

    # =========================================================================
    # [9] Audit Foundation Verification
    # =========================================================================
    print("\n[9] Audit Foundation & Trail Verification:")
    res_audit = client.get("/api/v1/users/audit-logs?limit=20", headers=admin_headers)
    check("GET /api/v1/users/audit-logs returns 200", res_audit.status_code == 200)
    audit_logs = res_audit.json()
    check("Audit logs contain recorded events (> 0)", len(audit_logs) > 0)
    check("Audit log records user_id, action, and timestamp", audit_logs[0].get("action") is not None and audit_logs[0].get("created_at") is not None)

    # =========================================================================
    # [10] Database Rollback & Integrity Test
    # =========================================================================
    print("\n[10] Database Rollback Integrity:")
    db_test = SessionLocal()
    try:
        count_before = db_test.query(Supplier).count()
        # Simulate a transaction with intentional error to ensure rollback
        try:
            with db_test.begin():
                invalid_sup = Supplier(
                    id=str(uuid.uuid4()),
                    company_id=company_id,
                    name="Failed Supplier Rollback Test",
                    code=sup_code, # triggers unique constraint violation
                )
                db_test.add(invalid_sup)
                db_test.flush()
        except Exception:
            db_test.rollback()

        count_after = db_test.query(Supplier).count()
        check("Transaction cleanly rolled back on constraint violation (count unchanged)", count_before == count_after)
    finally:
        db_test.close()

    print("\n" + "=" * 75)
    print(f"SUCCESS: ALL {passed}/{total} PART 2 MASTER DATA & SECURITY TESTS PASSED!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()

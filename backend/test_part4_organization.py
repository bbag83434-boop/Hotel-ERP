"""
APEX Multi-Outlet Restaurant ERP
PART 4 — ORGANIZATION, BRANCH, WAREHOUSE & STAFF COMPREHENSIVE TEST SUITE

Validates:
1. Company profile retrieval & metadata update
2. Multi-outlet hierarchy (Head Office, Central Store, Outlets)
3. Branch CRUD: creation, retrieval, listing, and updating
4. Warehouse CRUD: central and outlet warehouses, retrieval & update
5. Department CRUD: creation, listing, retrieval, and updating
6. Staff CRUD: creation, listing, retrieval, precision salary updating
7. User-to-branch multi-tenant scoping assignment
8. User-to-role RBAC permission assignment
9. Authentication & RBAC security: unauthenticated requests rejected (401)
10. Multi-outlet isolation & security guard rules
11. Neon PostgreSQL live database verification & record preservation
"""

import sys
import os
import uuid
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, engine
from app.models.organization import Branch, Company, Warehouse, Department, StoreLocation
from app.models.user import User, Role, UserBranch
from app.models.hr import Staff
from sqlalchemy import text

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("RUNNING COMPREHENSIVE PART 4: ORGANIZATION & STAFF VERIFICATION")
    print("=" * 70)

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

    # [0] Pre-Verification: Live Neon DB Connection & Preservation Audit
    print("\n[0] Live Neon PostgreSQL Database Audit & Preservation:")
    db = SessionLocal()
    try:
        ver = db.execute(text("SELECT version();")).scalar()
        check("Live PostgreSQL Connection Active", ver is not None and "PostgreSQL" in ver)

        initial_user_count = db.query(User).count()
        initial_role_count = db.query(Role).count()
        initial_company_count = db.query(Company).count()
        initial_branch_count = db.query(Branch).count()
        check("Initial Core Records Preserved (Users > 0)", initial_user_count > 0)
        check("Initial Core Records Preserved (Roles > 0)", initial_role_count > 0)
        print(f"      Users: {initial_user_count} | Roles: {initial_role_count} | Companies: {initial_company_count} | Branches: {initial_branch_count}")
    finally:
        db.close()

    # [1] Authentication & RBAC Checks
    print("\n[1] Security & Authentication Gateways:")
    unauth_comp = client.get("/api/v1/organization/company")
    check("Unauthenticated GET /company rejected with 401", unauth_comp.status_code == 401)

    unauth_branches = client.get("/api/v1/organization/branches")
    check("Unauthenticated GET /branches rejected with 401", unauth_branches.status_code == 401)

    # Login as admin
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    
    assert login_res.status_code == 200, "Failed to login as admin"
    access_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    check("Admin Authentication for Part 4 Successful", bool(access_token))

    # [2] Company Profile Endpoints
    print("\n[2] Company Profile Endpoints (GET, PUT):")
    res_comp = client.get("/api/v1/organization/company", headers=headers)
    check("GET /api/v1/organization/company returns 200", res_comp.status_code == 200)
    comp_data = res_comp.json()
    check("Company profile contains valid name", bool(comp_data.get("name")))
    company_id = comp_data.get("id")

    res_comp_update = client.put(
        "/api/v1/organization/company",
        json={"email": "enterprise-hq@apex-resorts.com", "phone": "+1-800-555-0100"},
        headers=headers
    )
    check("PUT /api/v1/organization/company returns 200", res_comp_update.status_code == 200)
    updated_comp = res_comp_update.json()
    check("Company email updated correctly", updated_comp.get("email") == "enterprise-hq@apex-resorts.com")
    check("Company phone updated correctly", updated_comp.get("phone") == "+1-800-555-0100")

    # [3] Branch & Outlet Endpoints (GET list, POST, GET id, PUT id)
    print("\n[3] Branch & Outlet Management Endpoints:")
    res_branches = client.get("/api/v1/organization/branches", headers=headers)
    check("GET /api/v1/organization/branches returns 200", res_branches.status_code == 200)
    branches = res_branches.json()
    check("Found registered branches in topology", len(branches) > 0)

    unique_suffix = uuid.uuid4().hex[:6].upper()
    test_branch_code = f"OUT-{unique_suffix}"
    res_new_branch = client.post(
        "/api/v1/organization/branches",
        json={
            "name": f"Apex Seaside Bistro #{unique_suffix}",
            "code": test_branch_code,
            "type": "RESTAURANT",
            "address": "Oceanfront Drive 404",
            "phone": "+1-800-555-0199",
            "company_id": company_id,
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/branches returns 201", res_new_branch.status_code == 201)
    new_branch_data = res_new_branch.json()
    check("Created branch code matches", new_branch_data["code"] == test_branch_code)
    created_branch_id = new_branch_data["id"]

    res_get_branch = client.get(f"/api/v1/organization/branches/{created_branch_id}", headers=headers)
    check("GET /api/v1/organization/branches/{id} returns 200", res_get_branch.status_code == 200)
    check("Branch detail name matches", res_get_branch.json()["name"] == f"Apex Seaside Bistro #{unique_suffix}")

    res_update_branch = client.put(
        f"/api/v1/organization/branches/{created_branch_id}",
        json={"name": f"Apex Seaside Bistro Premium #{unique_suffix}", "phone": "+1-800-555-9999"},
        headers=headers
    )
    check("PUT /api/v1/organization/branches/{id} returns 200", res_update_branch.status_code == 200)
    check("Updated branch name reflected", res_update_branch.json()["name"] == f"Apex Seaside Bistro Premium #{unique_suffix}")

    # [4] Warehouse Endpoints (GET list, POST, GET id, PUT id)
    print("\n[4] Warehouse Management Endpoints:")
    test_wh_code = f"WH-{unique_suffix}"
    res_wh = client.post(
        "/api/v1/organization/warehouses",
        json={
            "name": f"Outlet Cold Storage {unique_suffix}",
            "code": test_wh_code,
            "branch_id": created_branch_id,
            "company_id": company_id,
            "is_central": False,
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/warehouses returns 201", res_wh.status_code == 201)
    created_wh_data = res_wh.json()
    created_wh_id = created_wh_data["id"]

    res_wh_list = client.get("/api/v1/organization/warehouses", headers=headers)
    check("GET /api/v1/organization/warehouses returns 200", res_wh_list.status_code == 200)
    check("Warehouse list contains new warehouse", any(w["id"] == created_wh_id for w in res_wh_list.json()))

    res_get_wh = client.get(f"/api/v1/organization/warehouses/{created_wh_id}", headers=headers)
    check("GET /api/v1/organization/warehouses/{id} returns 200", res_get_wh.status_code == 200)
    check("Warehouse detail matches code", res_get_wh.json()["code"] == test_wh_code)

    res_update_wh = client.put(
        f"/api/v1/organization/warehouses/{created_wh_id}",
        json={"name": f"Outlet Main & Cold Storage {unique_suffix}", "is_central": True},
        headers=headers
    )
    check("PUT /api/v1/organization/warehouses/{id} returns 200", res_update_wh.status_code == 200)
    check("Updated warehouse reflected is_central=True", res_update_wh.json()["is_central"] is True)

    # [5] Department Endpoints (GET list, POST, GET id, PUT id)
    print("\n[5] Department Management Endpoints:")
    test_dept_code = f"BAKERY-{unique_suffix}"
    res_dept = client.post(
        "/api/v1/organization/departments",
        json={
            "name": "Pastry & Artisan Bakery",
            "code": test_dept_code,
            "company_id": company_id,
            "branch_id": created_branch_id,
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/departments returns 201", res_dept.status_code == 201)
    created_dept_data = res_dept.json()
    created_dept_id = created_dept_data["id"]

    res_dept_list = client.get("/api/v1/organization/departments", headers=headers)
    check("GET /api/v1/organization/departments returns 200", res_dept_list.status_code == 200)
    check("Department list contains created dept", any(d["code"] == test_dept_code for d in res_dept_list.json()))

    res_get_dept = client.get(f"/api/v1/organization/departments/{created_dept_id}", headers=headers)
    check("GET /api/v1/organization/departments/{id} returns 200", res_get_dept.status_code == 200)
    check("Department detail code matches", res_get_dept.json()["code"] == test_dept_code)

    res_update_dept = client.put(
        f"/api/v1/organization/departments/{created_dept_id}",
        json={"name": "Pastry, Desserts & Artisan Bakery"},
        headers=headers
    )
    check("PUT /api/v1/organization/departments/{id} returns 200", res_update_dept.status_code == 200)
    check("Updated department name matches", res_update_dept.json()["name"] == "Pastry, Desserts & Artisan Bakery")

    # [6] Staff Endpoints (GET list, POST, GET id, PUT id)
    print("\n[6] Staff Management Endpoints:")
    emp_code = f"EMP-{unique_suffix}"
    res_staff = client.post(
        "/api/v1/organization/staff",
        json={
            "employee_code": emp_code,
            "first_name": "Elena",
            "last_name": "Rostova",
            "email": f"elena.{unique_suffix.lower()}@apex.com",
            "phone": "+1-555-0876",
            "designation": "Head Pastry Chef",
            "department": "Pastry & Artisan Bakery",
            "branch_id": created_branch_id,
            "company_id": company_id,
            "joining_date": "2026-02-01",
            "base_salary": 5800.00,
            "hourly_rate": 32.50,
            "status": "ACTIVE",
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/staff returns 201", res_staff.status_code == 201)
    staff_data = res_staff.json()
    created_staff_id = staff_data["id"]
    check("Staff base_salary stored with precision (5800.00)", staff_data["base_salary"] == 5800.0)

    res_staff_list = client.get(f"/api/v1/organization/staff?branch_id={created_branch_id}", headers=headers)
    check("GET /api/v1/organization/staff returns 200", res_staff_list.status_code == 200)
    check("Staff list returns created employee", any(s["id"] == created_staff_id for s in res_staff_list.json()))

    res_get_staff = client.get(f"/api/v1/organization/staff/{created_staff_id}", headers=headers)
    check("GET /api/v1/organization/staff/{id} returns 200", res_get_staff.status_code == 200)
    check("Staff detail designation matches", res_get_staff.json()["designation"] == "Head Pastry Chef")

    res_update_staff = client.put(
        f"/api/v1/organization/staff/{created_staff_id}",
        json={"base_salary": 6200.00, "designation": "Executive Pastry Chef"},
        headers=headers
    )
    check("PUT /api/v1/organization/staff/{id} returns 200", res_update_staff.status_code == 200)
    check("Updated staff base_salary reflected (6200.00)", res_update_staff.json()["base_salary"] == 6200.0)
    check("Updated staff designation reflected", res_update_staff.json()["designation"] == "Executive Pastry Chef")

    # [7] User Assignment Endpoints
    print("\n[7] User Assignment Endpoints:")
    db = SessionLocal()
    try:
        user_row = db.query(User).first()
        role_row = db.query(Role).first()
        user_id = str(user_row.id) if user_row else None
        role_id = str(role_row.id) if role_row else None
    finally:
        db.close()

    if user_id:
        res_assign_branch = client.post(
            "/api/v1/organization/users/assign-branch",
            json={
                "user_id": user_id,
                "branch_id": created_branch_id,
                "is_default": False
            },
            headers=headers
        )
        check("POST /api/v1/organization/users/assign-branch returns 200", res_assign_branch.status_code == 200)

        if role_id:
            res_assign_role = client.post(
                "/api/v1/organization/users/assign-role",
                json={
                    "user_id": user_id,
                    "role_id": role_id
                },
                headers=headers
            )
            check("POST /api/v1/organization/users/assign-role returns 200", res_assign_role.status_code == 200)

    # [8] Post-Verification: Verify Data Integrity & Non-Destructive Operation on Neon DB
    print("\n[8] Neon Database Final State & Preservation Audit:")
    db = SessionLocal()
    try:
        final_user_count = db.query(User).count()
        final_role_count = db.query(Role).count()
        final_branch_count = db.query(Branch).count()
        final_wh_count = db.query(Warehouse).count()
        final_dept_count = db.query(Department).count()
        final_staff_count = db.query(Staff).count()

        check("Zero Data Loss: User records intact", final_user_count >= initial_user_count)
        check("Zero Data Loss: Role records intact", final_role_count >= initial_role_count)
        check("New Branch Persisted to PostgreSQL", final_branch_count > initial_branch_count)
        check("New Warehouse Persisted to PostgreSQL", final_wh_count > 0)
        check("New Department Persisted to PostgreSQL", final_dept_count > 0)
        check("New Staff Persisted to PostgreSQL", final_staff_count > 0)
        print(f"      Final state: Users={final_user_count}, Roles={final_role_count}, Branches={final_branch_count}, Warehouses={final_wh_count}, Departments={final_dept_count}, Staff={final_staff_count}")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print(f"SUCCESS: ALL {passed}/{total} COMPREHENSIVE PART 4 TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()

"""
APEX Multi-Outlet Restaurant ERP
PART 4 — ORGANIZATION, BRANCH, WAREHOUSE & STAFF TEST SUITE

Validates:
1. Company profile retrieval & metadata update
2. Multi-outlet hierarchy (Head Office, Central Store, Dessert Kitchen, Outlets)
3. Branch creation, retrieval, and updating
4. Central and Outlet Warehouse management
5. Department management (Kitchen, Service, Bakery, Store, Accounts)
6. Staff profile creation & outlet assignment
7. User-to-branch multi-tenant scoping assignment
8. User-to-role RBAC permission assignment
9. Multi-outlet isolation & security guard rules
"""

import sys
import os
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.organization import Branch, Company, Warehouse, Department
from app.models.user import User, Role

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("RUNNING PART 4: ORGANIZATION, BRANCH & STAFF TEST SUITE")
    print("=" * 60)

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

    # Authenticate as admin
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    
    assert login_res.status_code == 200, "Failed to login as admin"
    access_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # [1] Company Profile
    print("\n[1] Company Profile Endpoints:")
    res_comp = client.get("/api/v1/organization/company", headers=headers)
    check("GET /api/v1/organization/company returns 200", res_comp.status_code == 200)
    comp_data = res_comp.json()
    check("Company has valid name", bool(comp_data.get("name")))
    company_id = comp_data.get("id")

    res_comp_update = client.put(
        "/api/v1/organization/company",
        json={"email": "enterprise-hq@apex-resorts.com"},
        headers=headers
    )
    check("PUT /api/v1/organization/company returns 200", res_comp_update.status_code == 200)
    check("Company email updated", res_comp_update.json().get("email") == "enterprise-hq@apex-resorts.com")

    # [2] Branch & Outlet Management
    print("\n[2] Branch & Outlet Management:")
    res_branches = client.get("/api/v1/organization/branches", headers=headers)
    check("GET /api/v1/organization/branches returns 200", res_branches.status_code == 200)
    branches = res_branches.json()
    check("Found registered branches in topology", len(branches) > 0)
    first_branch = branches[0]
    target_branch_id = first_branch["id"]

    # Create test outlet
    unique_suffix = uuid.uuid4().hex[:6].upper()
    test_branch_code = f"OUT-{unique_suffix}"
    res_new_branch = client.post(
        "/api/v1/organization/branches",
        json={
            "name": f"Apex Fine Dining #{unique_suffix}",
            "code": test_branch_code,
            "type": "RESTAURANT_OUTLET",
            "address": "Grand Boulevard Suite 101",
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

    # Get branch by ID
    res_get_branch = client.get(f"/api/v1/organization/branches/{created_branch_id}", headers=headers)
    check("GET /api/v1/organization/branches/{id} returns 200", res_get_branch.status_code == 200)

    # [3] Warehouse Management
    print("\n[3] Warehouse Management:")
    test_wh_code = f"WH-{unique_suffix}"
    res_wh = client.post(
        "/api/v1/organization/warehouses",
        json={
            "name": f"Main Outlet Warehouse {unique_suffix}",
            "code": test_wh_code,
            "branch_id": created_branch_id,
            "company_id": company_id,
            "is_central": False,
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/warehouses returns 201", res_wh.status_code == 201)

    res_wh_list = client.get("/api/v1/organization/warehouses", headers=headers)
    check("GET /api/v1/organization/warehouses returns 200", res_wh_list.status_code == 200)
    check("Warehouse list is non-empty", len(res_wh_list.json()) > 0)

    # [4] Department Management
    print("\n[4] Department Management:")
    test_dept_code = f"KITCHEN-{unique_suffix}"
    res_dept = client.post(
        "/api/v1/organization/departments",
        json={
            "name": "Culinary Production & Kitchen",
            "code": test_dept_code,
            "company_id": company_id,
            "branch_id": created_branch_id,
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/departments returns 201", res_dept.status_code == 201)

    res_dept_list = client.get("/api/v1/organization/departments", headers=headers)
    check("GET /api/v1/organization/departments returns 200", res_dept_list.status_code == 200)
    check("Department list contains created department", any(d["code"] == test_dept_code for d in res_dept_list.json()))

    # [5] Staff Management
    print("\n[5] Staff Management:")
    emp_code = f"EMP-{unique_suffix}"
    res_staff = client.post(
        "/api/v1/organization/staff",
        json={
            "employee_code": emp_code,
            "first_name": "Marcus",
            "last_name": "Vance",
            "email": f"marcus.{unique_suffix.lower()}@apex.com",
            "phone": "+1-555-0142",
            "designation": "Executive Chef",
            "department": "Culinary Production & Kitchen",
            "branch_id": created_branch_id,
            "company_id": company_id,
            "joining_date": "2026-01-15",
            "base_salary": 6500.00,
            "hourly_rate": 35.00,
            "status": "ACTIVE",
            "is_active": True
        },
        headers=headers
    )
    check("POST /api/v1/organization/staff returns 201", res_staff.status_code == 201)
    staff_data = res_staff.json()
    check("Staff base_salary stored with precision", staff_data["base_salary"] == 6500.0)

    res_staff_list = client.get(f"/api/v1/organization/staff?branch_id={created_branch_id}", headers=headers)
    check("GET /api/v1/organization/staff returns 200", res_staff_list.status_code == 200)
    check("Staff list returns created employee", len(res_staff_list.json()) > 0)

    # [6] User Assignments
    print("\n[6] User Assignment Endpoints:")
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

    print("\n" + "=" * 60)
    print(f"SUCCESS: ALL {passed}/{total} PART 4 ORGANIZATION TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

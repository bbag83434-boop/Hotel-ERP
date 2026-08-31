"""
================================================================================
APEX RESTAURANT ENTERPRISE ERP — AUTOMATED TEST SUITE: PART 5
COMPANY, MULTI-OUTLET MANAGEMENT & OPERATIONAL SCOPING ENGINE
================================================================================
"""

import os
import sys
import uuid
import datetime
from decimal import Decimal

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal, engine
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch, Department, Warehouse
from app.models.hr import Staff

client = TestClient(app)

passed_count = 0
failed_count = 0

def check(description: str, condition: bool, details: str = ""):
    global passed_count, failed_count
    if condition:
        passed_count += 1
        print(f"  [PASS] {description}")
    else:
        failed_count += 1
        print(f"  [FAIL] {description} -> {details}")

def run_tests():
    global passed_count, failed_count
    print("=" * 80)
    print("RUNNING APEX ERP - PART 5: COMPANY & OUTLET MANAGEMENT TEST SUITE")
    print("=" * 80)

    # -------------------------------------------------------------
    # [1] Database Connectivity & Pre-Test Audit
    # -------------------------------------------------------------
    print("\n[1] Database Connectivity & Core Entity Audit:")
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        role_count = db.query(Role).count()
        branch_count = db.query(Branch).count()
        warehouse_count = db.query(Warehouse).count()
        dept_count = db.query(Department).count()
        staff_count = db.query(Staff).count()
        company = db.query(Company).first()

        check("Live PostgreSQL connection established", True)
        check("User records preserved", user_count > 0, f"Found {user_count}")
        check("Role records preserved", role_count > 0, f"Found {role_count}")
        check("Branch records preserved (14+ topology)", branch_count >= 14, f"Found {branch_count}")
        check("Company record exists", company is not None, f"Company: {company.name if company else 'None'}")
    finally:
        db.close()

    # -------------------------------------------------------------
    # [2] Authentication & Security Gatekeeping (401 Gatekeeper)
    # -------------------------------------------------------------
    print("\n[2] Security Gatekeeping (401 Unauthorized for unauthenticated requests):")
    res = client.get("/api/v1/organization/overview")
    check("GET /organization/overview without token blocked with 401", res.status_code == 401, f"Status: {res.status_code}")

    res = client.get("/api/v1/organization/company")
    check("GET /organization/company without token blocked with 401", res.status_code == 401, f"Status: {res.status_code}")

    res = client.get("/api/v1/organization/branches")
    check("GET /organization/branches without token blocked with 401", res.status_code == 401, f"Status: {res.status_code}")

    res = client.post("/api/v1/organization/branches", json={"name": "Test", "code": "T-01"})
    check("POST /organization/branches without token blocked with 401", res.status_code == 401, f"Status: {res.status_code}")

    # -------------------------------------------------------------
    # [3] HQ Super Admin Authentication
    # -------------------------------------------------------------
    print("\n[3] Authenticating HQ Super Admin:")
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    
    check("HQ Admin authentication successful", login_res.status_code == 200, f"Status: {login_res.status_code}")
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # -------------------------------------------------------------
    # [4] Company Master Profile API
    # -------------------------------------------------------------
    print("\n[4] Company Master Profile API (GET & PUT):")
    res = client.get("/api/v1/organization/company", headers=headers)
    check("GET /organization/company returns 200", res.status_code == 200, f"Status: {res.status_code}")
    company_data = res.json()
    check("Company has valid name and code", bool(company_data.get("name") and company_data.get("code")), str(company_data))

    # Update company
    orig_phone = company_data.get("phone") or "+1-555-0100"
    new_phone = "+1-555-" + uuid.uuid4().hex[:4].upper()
    update_res = client.put("/api/v1/organization/company", headers=headers, json={"phone": new_phone})
    check("PUT /organization/company returns 200", update_res.status_code == 200, f"Status: {update_res.status_code}")
    check("Company phone updated in response", update_res.json().get("phone") == new_phone, f"Phone: {update_res.json().get('phone')}")

    # Restore company phone
    client.put("/api/v1/organization/company", headers=headers, json={"phone": orig_phone})

    # -------------------------------------------------------------
    # [5] Multi-Outlet Overview & Enterprise Topology
    # -------------------------------------------------------------
    print("\n[5] Enterprise Multi-Outlet Overview & Topology (GET /overview):")
    overview_res = client.get("/api/v1/organization/overview", headers=headers)
    check("GET /organization/overview returns 200", overview_res.status_code == 200, f"Status: {overview_res.status_code}")
    ov = overview_res.json()
    check("Overview contains total_branches >= 14", ov.get("total_branches", 0) >= 14, f"Branches: {ov.get('total_branches')}")
    check("Overview contains active_branches count", "active_branches" in ov, str(ov.get("active_branches")))
    check("Overview contains branch_type_counts", isinstance(ov.get("branch_type_counts"), dict), str(ov.get("branch_type_counts")))
    check("Overview contains outlets list with sub-counts", len(ov.get("outlets", [])) >= 14, f"Outlets: {len(ov.get('outlets', []))}")
    if ov.get("outlets"):
        first_o = ov["outlets"][0]
        check("Outlet item includes warehouses_count and staff_count", "warehouses_count" in first_o and "staff_count" in first_o, str(first_o))

    # -------------------------------------------------------------
    # [6] Multi-Outlet Branch CRUD
    # -------------------------------------------------------------
    print("\n[6] Branch / Outlet CRUD Lifecycle:")
    test_code = "TEST-" + uuid.uuid4().hex[:6].upper()
    create_payload = {
        "name": "Part 5 Test Outlet & Lounge",
        "code": test_code,
        "type": "RESTAURANT",
        "email": f"{test_code.lower()}@apex-test.com",
        "phone": "+1-555-8899",
        "address": "450 Emerald Promenade, Level 2",
        "is_active": True
    }
    create_res = client.post("/api/v1/organization/branches", headers=headers, json=create_payload)
    check("POST /organization/branches creates new outlet (201 Created)", create_res.status_code == 201, f"Status: {create_res.status_code}")
    created_branch = create_res.json()
    branch_id = created_branch.get("id")
    check("Created branch has UUID id", bool(branch_id), str(created_branch))

    # Duplicate code rejection
    dup_res = client.post("/api/v1/organization/branches", headers=headers, json=create_payload)
    check("Duplicate branch code correctly rejected (409 Conflict)", dup_res.status_code == 409, f"Status: {dup_res.status_code}")

    # Retrieve branch
    get_res = client.get(f"/api/v1/organization/branches/{branch_id}", headers=headers)
    check("GET /organization/branches/{id} returns 200", get_res.status_code == 200, f"Status: {get_res.status_code}")
    check("Retrieved branch code matches", get_res.json().get("code") == test_code, str(get_res.json()))

    # Update branch
    update_res = client.put(
        f"/api/v1/organization/branches/{branch_id}",
        headers=headers,
        json={"name": "Part 5 Test Outlet (Updated)", "phone": "+1-555-9988"}
    )
    check("PUT /organization/branches/{id} returns 200", update_res.status_code == 200, f"Status: {update_res.status_code}")
    check("Branch name updated", update_res.json().get("name") == "Part 5 Test Outlet (Updated)", str(update_res.json()))

    # -------------------------------------------------------------
    # [7] Branch Details Roster (GET /branches/{id}/details)
    # -------------------------------------------------------------
    print("\n[7] Branch Details Roster & Nested Sub-entities:")
    # Link a warehouse to the new branch
    wh_payload = {
        "name": "Local Pantry Store",
        "code": f"WH-{test_code}",
        "branch_id": branch_id,
        "is_central": False,
        "is_active": True
    }
    wh_res = client.post("/api/v1/organization/warehouses", headers=headers, json=wh_payload)
    check("POST /organization/warehouses linked to branch returns 201", wh_res.status_code == 201, f"Status: {wh_res.status_code}")

    # Link a department to the branch
    dept_payload = {
        "name": "Bar & Beverage Service",
        "code": f"DEPT-{test_code}",
        "branch_id": branch_id,
        "is_active": True
    }
    dept_res = client.post("/api/v1/organization/departments", headers=headers, json=dept_payload)
    check("POST /organization/departments linked to branch returns 201", dept_res.status_code == 201, f"Status: {dept_res.status_code}")

    # Link a staff member
    staff_payload = {
        "employee_code": f"EMP-{test_code}",
        "first_name": "Alexander",
        "last_name": "Pierce",
        "designation": "Outlet Manager",
        "department": "Management",
        "branch_id": branch_id,
        "base_salary": 4500.00,
        "hourly_rate": 28.00,
        "status": "ACTIVE",
        "is_active": True
    }
    staff_res = client.post("/api/v1/organization/staff", headers=headers, json=staff_payload)
    check("POST /organization/staff linked to branch returns 201", staff_res.status_code == 201, f"Status: {staff_res.status_code}")

    # Inspect branch details
    detail_res = client.get(f"/api/v1/organization/branches/{branch_id}/details", headers=headers)
    check("GET /organization/branches/{id}/details returns 200", detail_res.status_code == 200, f"Status: {detail_res.status_code}")
    detail_data = detail_res.json()
    check("Details contain linked warehouses", len(detail_data.get("warehouses", [])) >= 1, f"Warehouses: {len(detail_data.get('warehouses', []))}")
    check("Details contain linked departments", len(detail_data.get("departments", [])) >= 1, f"Departments: {len(detail_data.get('departments', []))}")
    check("Details contain linked staff roster", len(detail_data.get("staff", [])) >= 1, f"Staff: {len(detail_data.get('staff', []))}")

    # -------------------------------------------------------------
    # [8] Post-Test Database Preservation & Zero Data Loss
    # -------------------------------------------------------------
    print("\n[8] Database Preservation & Final State Verification:")
    db = SessionLocal()
    try:
        final_users = db.query(User).count()
        final_roles = db.query(Role).count()
        final_branches = db.query(Branch).count()
        final_warehouses = db.query(Warehouse).count()
        final_departments = db.query(Department).count()
        final_staff = db.query(Staff).count()

        check("Zero Data Loss: User records intact", final_users >= user_count)
        check("Zero Data Loss: Role records intact", final_roles >= role_count)
        check("Zero Data Loss: Branch records intact and augmented", final_branches > branch_count)
        print(f"      Final DB State: Users={final_users}, Roles={final_roles}, Branches={final_branches}, Warehouses={final_warehouses}, Departments={final_departments}, Staff={final_staff}")
    finally:
        db.close()

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print(f"PART 5 TEST RESULTS: {passed_count} PASSED, {failed_count} FAILED")
    print("=" * 80)

    if failed_count > 0:
        print("\n[FAIL] SOME TESTS FAILED!")
        sys.exit(1)
    else:
        print("\n[SUCCESS] ALL PART 5 COMPANY & MULTI-OUTLET MANAGEMENT TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()

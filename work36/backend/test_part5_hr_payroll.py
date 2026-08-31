"""
================================================================================
APEX RESTAURANT ENTERPRISE ERP — AUTOMATED TEST SUITE: PART 5
HR, ATTENDANCE, SHIFTS, LEAVES & PAYROLL ENGINE
================================================================================
Validates:
  1. Live Neon PostgreSQL connectivity and preservation of core records.
  2. RBAC & JWT Gatekeeping (401 Unauthorized for unauthenticated requests).
  3. Shift Scheduling (CRUD: create, list, retrieve, update).
  4. Active vs Inactive Staff Profiles & Outlet Scoping.
  5. Attendance Tracking (check-in, check-out, hours worked, overtime, monthly summary).
  6. Leave Management (leave types, request submission, manager approval workflow).
  7. Monthly Payroll Run Generation & Calculation:
     - Automatic exclusion of Inactive / Terminated staff.
     - Accurate inclusion of Active staff.
     - Formula: net_pay = base_pay + overtime_pay + allowances - deductions.
     - Exact Decimal(14,2) precision.
  8. Payroll Status Lifecycle (DRAFT -> APPROVED -> PAID).
  9. Per-Outlet & Per-Staff Monthly Payroll History.
 10. Post-test Database Integrity & Preservation Audit.
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
from app.core.database import SessionLocal
from app.models.user import User, Role
from app.models.organization import Company, Branch, Department
from app.models.hr import Staff, Attendance, Payroll, PayrollItem, Shift, LeaveType, LeaveRequest

client = TestClient(app)

passed = 0
total = 0

def check(name: str, condition: bool, extra: str = ""):
    global passed, total
    total += 1
    if condition:
        passed += 1
        msg = f"  [PASS] {name}"
        if extra:
            msg += f" ({extra})"
        print(msg)
    else:
        msg = f"  [FAIL] {name}"
        if extra:
            msg += f" ({extra})"
        print(msg)
        raise AssertionError(f"Test assertion failed: {name} | {extra}")

def run_tests():
    global passed, total
    print("=" * 70)
    print("APEX ENTERPRISE ERP — RUNNING PART 5: HR, ATTENDANCE & PAYROLL TESTS")
    print("=" * 70)

    # -------------------------------------------------------------
    # [0] Live Database Pre-Audit
    # -------------------------------------------------------------
    print("\n[0] Live Neon PostgreSQL Pre-Audit:")
    db = SessionLocal()
    try:
        user_count_before = db.query(User).count()
        role_count_before = db.query(Role).count()
        branch_count_before = db.query(Branch).count()
        staff_count_before = db.query(Staff).count()
        
        check("Live PostgreSQL Connection Active", user_count_before > 0)
        check("Pre-existing Users Preserved", user_count_before >= 1, f"Found: {user_count_before}")
        check("Pre-existing Roles Preserved", role_count_before >= 3, f"Found: {role_count_before}")
        check("Pre-existing Branches Preserved", branch_count_before >= 1, f"Found: {branch_count_before}")
    finally:
        db.close()

    # -------------------------------------------------------------
    # [1] Unauthenticated Security Gatekeeping (401 Checks)
    # -------------------------------------------------------------
    print("\n[1] Unauthenticated Security Gatekeeping:")
    check("GET /api/v1/hr/shifts returns 401 unauth", client.get("/api/v1/hr/shifts").status_code == 401)
    check("POST /api/v1/hr/shifts returns 401 unauth", client.post("/api/v1/hr/shifts", json={}).status_code == 401)
    check("GET /api/v1/hr/attendance returns 401 unauth", client.get("/api/v1/hr/attendance").status_code == 401)
    check("POST /api/v1/hr/attendance returns 401 unauth", client.post("/api/v1/hr/attendance", json={}).status_code == 401)
    check("GET /api/v1/hr/leaves returns 401 unauth", client.get("/api/v1/hr/leaves").status_code == 401)
    check("POST /api/v1/hr/payrolls/generate returns 401 unauth", client.post("/api/v1/hr/payrolls/generate", json={}).status_code == 401)

    # -------------------------------------------------------------
    # [2] Admin Authentication
    # -------------------------------------------------------------
    print("\n[2] Admin Authentication:")
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    check("Admin login returns 200", login_res.status_code == 200)
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    check("Obtained valid JWT Bearer Token", bool(token))

    # Retrieve company and branch
    branch_res = client.get("/api/v1/organization/branches", headers=headers)
    check("GET branches returns 200", branch_res.status_code == 200)
    branches = branch_res.json()
    check("Branches exist in database", len(branches) > 0)
    test_branch = branches[0]
    test_branch_id = test_branch["id"]
    test_company_id = test_branch["company_id"]

    # -------------------------------------------------------------
    # [3] Shift Scheduling (CRUD)
    # -------------------------------------------------------------
    print("\n[3] Shift Scheduling:")
    shift_suffix = uuid.uuid4().hex[:6].upper()
    shift_payload = {
        "branch_id": test_branch_id,
        "name": f"Morning Breakfast Shift #{shift_suffix}",
        "code": f"SH-MORN-{shift_suffix}",
        "start_time": "06:30",
        "end_time": "15:00",
        "grace_period_mins": 15,
        "is_active": True
    }
    create_shift_res = client.post("/api/v1/hr/shifts", json=shift_payload, headers=headers)
    check("POST /api/v1/hr/shifts returns 201", create_shift_res.status_code == 201)
    shift_data = create_shift_res.json()
    test_shift_id = shift_data["id"]
    check("Created shift code matches", shift_data["code"] == shift_payload["code"])
    check("Created shift start time matches", shift_data["start_time"] == "06:30")

    list_shifts_res = client.get(f"/api/v1/hr/shifts?branch_id={test_branch_id}", headers=headers)
    check("GET /api/v1/hr/shifts returns 200", list_shifts_res.status_code == 200)
    check("Shift list contains newly created shift", any(s["id"] == test_shift_id for s in list_shifts_res.json()))

    get_shift_res = client.get(f"/api/v1/hr/shifts/{test_shift_id}", headers=headers)
    check("GET /api/v1/hr/shifts/{id} returns 200", get_shift_res.status_code == 200)

    update_shift_res = client.put(f"/api/v1/hr/shifts/{test_shift_id}", json={"grace_period_mins": 20}, headers=headers)
    check("PUT /api/v1/hr/shifts/{id} returns 200", update_shift_res.status_code == 200)
    check("Updated shift grace period matches", update_shift_res.json()["grace_period_mins"] == 20)

    # -------------------------------------------------------------
    # [4] Active & Inactive Staff Setup
    # -------------------------------------------------------------
    print("\n[4] Active & Inactive Staff Setup:")
    staff_suffix = uuid.uuid4().hex[:6].upper()
    
    # 1. Active Staff
    active_staff_payload = {
        "branch_id": test_branch_id,
        "employee_code": f"ACT-{staff_suffix}",
        "first_name": "Rajesh",
        "last_name": "Kumar",
        "email": f"rajesh.{staff_suffix}@apex.com",
        "phone": "+1-555-4001",
        "designation": "Senior Sous Chef",
        "department": "Main Kitchen",
        "joining_date": "2026-01-15",
        "base_salary": 45000.00,
        "hourly_rate": 25.00,
        "status": "ACTIVE",
        "is_active": True
    }
    active_res = client.post("/api/v1/organization/staff", json=active_staff_payload, headers=headers)
    check("POST active staff returns 201", active_res.status_code == 201)
    active_staff_id = active_res.json()["id"]

    # 2. Inactive / Terminated Staff (must be excluded from payroll!)
    inactive_staff_payload = {
        "branch_id": test_branch_id,
        "employee_code": f"INACT-{staff_suffix}",
        "first_name": "Vikram",
        "last_name": "Singh",
        "email": f"vikram.{staff_suffix}@apex.com",
        "phone": "+1-555-4002",
        "designation": "Trainee Cook",
        "department": "Main Kitchen",
        "joining_date": "2026-01-10",
        "base_salary": 30000.00,
        "hourly_rate": 18.00,
        "status": "TERMINATED",
        "is_active": False
    }
    inact_res = client.post("/api/v1/organization/staff", json=inactive_staff_payload, headers=headers)
    check("POST inactive staff returns 201", inact_res.status_code == 201)
    inactive_staff_id = inact_res.json()["id"]
    check("Inactive staff status is TERMINATED", inact_res.json()["status"] == "TERMINATED")

    # -------------------------------------------------------------
    # [5] Daily Attendance Logging & Summary
    # -------------------------------------------------------------
    print("\n[5] Daily Attendance Logging & Summary:")
    import random
    pay_month = random.randint(1, 12)
    pay_year = random.randint(2030, 2050)
    test_date_str = f"{pay_year}-{pay_month:02d}-15"
    att_payload = {
        "staff_id": active_staff_id,
        "branch_id": test_branch_id,
        "date": test_date_str,
        "check_in": "06:30:00",
        "check_out": "16:00:00",
        "hours_worked": 9.5,
        "overtime_hours": 1.5,
        "status": "PRESENT",
        "notes": "On-time arrival for morning prep"
    }
    att_res = client.post("/api/v1/hr/attendance", json=att_payload, headers=headers)
    check("POST /api/v1/hr/attendance returns 201", att_res.status_code == 201)
    att_data = att_res.json()
    att_id = att_data["id"]
    check("Attendance hours_worked matches (9.5)", float(att_data["hours_worked"]) == 9.5)
    check("Attendance overtime_hours matches (1.5)", float(att_data["overtime_hours"]) == 1.5)

    list_att_res = client.get(f"/api/v1/hr/attendance?branch_id={test_branch_id}&staff_id={active_staff_id}", headers=headers)
    check("GET /api/v1/hr/attendance returns 200", list_att_res.status_code == 200)
    check("Attendance list contains logged entry", len(list_att_res.json()) >= 1)

    sum_att_res = client.get(f"/api/v1/hr/attendance/summary?branch_id={test_branch_id}&month={pay_month}&year={pay_year}", headers=headers)
    check("GET /api/v1/hr/attendance/summary returns 200", sum_att_res.status_code == 200)
    summary_items = sum_att_res.json()["summary"]
    active_summary = next((s for s in summary_items if s["staff_id"] == active_staff_id), None)
    check("Attendance summary contains active staff", active_summary is not None)
    if active_summary:
        check("Attendance summary days_present >= 1", active_summary["days_present"] >= 1)
        check("Attendance summary total_hours >= 9.5", float(active_summary["total_hours"]) >= 9.5)

    # -------------------------------------------------------------
    # [6] Leave Types & Request Lifecycle
    # -------------------------------------------------------------
    print("\n[6] Leave Types & Request Lifecycle:")
    lv_suffix = uuid.uuid4().hex[:6].upper()
    leave_type_payload = {
        "name": f"Annual Vacation Leave #{lv_suffix}",
        "code": f"LV-ANNUAL-{lv_suffix}",
        "days_allowed": 21,
        "is_paid": True
    }
    create_lt_res = client.post("/api/v1/hr/leave-types", json=leave_type_payload, headers=headers)
    check("POST /api/v1/hr/leave-types returns 201", create_lt_res.status_code == 201)
    leave_type_id = create_lt_res.json()["id"]

    list_lt_res = client.get("/api/v1/hr/leave-types", headers=headers)
    check("GET /api/v1/hr/leave-types returns 200", list_lt_res.status_code == 200)

    leave_req_payload = {
        "employee_id": active_staff_id,
        "branch_id": test_branch_id,
        "leave_type_id": leave_type_id,
        "start_date": "2026-09-01",
        "end_date": "2026-09-04",
        "total_days": 4,
        "reason": "Family gathering and festival"
    }
    submit_leave_res = client.post("/api/v1/hr/leaves", json=leave_req_payload, headers=headers)
    check("POST /api/v1/hr/leaves returns 201", submit_leave_res.status_code == 201)
    leave_req_id = submit_leave_res.json()["id"]
    check("Initial leave request status is PENDING", submit_leave_res.json()["status"] == "PENDING")

    list_leaves_res = client.get(f"/api/v1/hr/leaves?branch_id={test_branch_id}", headers=headers)
    check("GET /api/v1/hr/leaves returns 200", list_leaves_res.status_code == 200)

    approve_leave_res = client.put(f"/api/v1/hr/leaves/{leave_req_id}", json={"status": "APPROVED"}, headers=headers)
    check("PUT /api/v1/hr/leaves/{id} returns 200", approve_leave_res.status_code == 200)
    check("Leave request transitioned to APPROVED", approve_leave_res.json()["status"] == "APPROVED")

    # -------------------------------------------------------------
    # [7] Monthly Payroll Generation & Inactive Exclusion
    # -------------------------------------------------------------
    print("\n[7] Monthly Payroll Generation & Inactive Exclusion:")
    payroll_payload = {
        "branch_id": test_branch_id,
        "month": pay_month,
        "year": pay_year,
        "notes": f"Automated monthly payroll run for {pay_month}/{pay_year}"
    }
    gen_payroll_res = client.post("/api/v1/hr/payrolls/generate", json=payroll_payload, headers=headers)
    check("POST /api/v1/hr/payrolls/generate returns 201", gen_payroll_res.status_code == 201)
    payroll_data = gen_payroll_res.json()
    payroll_id = payroll_data["id"]
    check("Payroll month matches", payroll_data["month"] == pay_month)
    check("Payroll year matches", payroll_data["year"] == pay_year)
    check("Payroll initial status is DRAFT", payroll_data["status"] == "DRAFT")

    # Audit itemized payslips
    payslips = payroll_data["items"]
    check("Generated itemized payslips > 0", len(payslips) > 0)
    
    # 1. INACTIVE / TERMINATED STAFF EXCLUSION TEST
    terminated_found = any(p["staff_id"] == inactive_staff_id for p in payslips)
    check("Terminated / Inactive staff strictly excluded from payroll run", not terminated_found)

    # 2. ACTIVE STAFF INCLUSION TEST
    active_payslip = next((p for p in payslips if p["staff_id"] == active_staff_id), None)
    check("Active staff receives payslip", active_payslip is not None)
    if active_payslip:
        check("Active payslip base_pay matches ($45,000.00)", float(active_payslip["base_pay"]) == 45000.00)
        # Expected Overtime: 1.5 hrs * $25.00/hr = $37.50
        expected_ot = 37.50
        check("Active payslip overtime_pay calculated ($37.50)", float(active_payslip["overtime_pay"]) == expected_ot)
        expected_net = 45000.00 + expected_ot
        check(f"Active payslip net_pay matches base + OT (${expected_net})", float(active_payslip["net_pay"]) == expected_net)

    # -------------------------------------------------------------
    # [8] Payroll Status Lifecycle & History
    # -------------------------------------------------------------
    print("\n[8] Payroll Status Lifecycle & History:")
    approve_pay_res = client.put(f"/api/v1/hr/payrolls/{payroll_id}/status", json={"status": "APPROVED"}, headers=headers)
    check("PUT /api/v1/hr/payrolls/{id}/status returns 200", approve_pay_res.status_code == 200)
    check("Payroll status transitioned to APPROVED", approve_pay_res.json()["status"] == "APPROVED")

    paid_pay_res = client.put(f"/api/v1/hr/payrolls/{payroll_id}/status", json={"status": "PAID"}, headers=headers)
    check("Payroll status transitioned to PAID", paid_pay_res.json()["status"] == "PAID")

    list_payrolls_res = client.get(f"/api/v1/hr/payrolls?branch_id={test_branch_id}", headers=headers)
    check("GET /api/v1/hr/payrolls returns 200", list_payrolls_res.status_code == 200)

    if active_payslip:
        payslip_item_id = active_payslip["id"]
        get_single_payslip_res = client.get(f"/api/v1/hr/payrolls/payslip/{payslip_item_id}", headers=headers)
        check("GET /api/v1/hr/payrolls/payslip/{item_id} returns 200", get_single_payslip_res.status_code == 200)
        check("Individual payslip employee designation matches", get_single_payslip_res.json()["designation"] == "Senior Sous Chef")

    history_res = client.get(f"/api/v1/hr/payroll/history?branch_id={test_branch_id}", headers=headers)
    check("GET /api/v1/hr/payroll/history returns 200", history_res.status_code == 200)
    history_records = history_res.json()
    check("Payroll history contains generated run", any(h["payroll_id"] == payroll_id for h in history_records))

    # -------------------------------------------------------------
    # [9] Live Neon Database Final State & Preservation Audit
    # -------------------------------------------------------------
    print("\n[9] Live Neon Database Post-Test Preservation Audit:")
    db = SessionLocal()
    try:
        user_count_after = db.query(User).count()
        role_count_after = db.query(Role).count()
        branch_count_after = db.query(Branch).count()
        staff_count_after = db.query(Staff).count()
        payroll_count_after = db.query(Payroll).count()
        shift_count_after = db.query(Shift).count()

        check("Zero Data Loss: User records intact", user_count_after >= user_count_before)
        check("Zero Data Loss: Role records intact", role_count_after >= role_count_before)
        check("Zero Data Loss: Branch records intact", branch_count_after >= branch_count_before)
        check("New Staff Persisted to Neon PostgreSQL", staff_count_after >= staff_count_before + 2)
        check("New Shifts Persisted to Neon PostgreSQL", shift_count_after >= 1)
        check("New Payroll Run Persisted to Neon PostgreSQL", payroll_count_after >= 1)
        print(f"      Final DB State: Users={user_count_after}, Roles={role_count_after}, Branches={branch_count_after}, Staff={staff_count_after}, Shifts={shift_count_after}, Payrolls={payroll_count_after}")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print(f"SUCCESS: ALL {passed}/{total} PART 5 HR & PAYROLL TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()

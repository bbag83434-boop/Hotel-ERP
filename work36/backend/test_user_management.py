import sys
import os
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch
from app.core.security import create_access_token

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("TESTING USER & ADMIN MANAGEMENT ENDPOINTS")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Find Super Admin
        super_admin = db.query(User).filter(User.email == "bbag83434@gmail.com").first()
        if not super_admin:
            # Fallback to any super admin
            super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
            if super_role:
                super_admin = db.query(User).filter(User.role_id == super_role.id).first()

        assert super_admin is not None, "Super Admin user not found in database"
        print(f"[OK] Found Super Admin: {super_admin.email} (ID: {super_admin.id})")

        # Find or create a non-admin Staff user for RBAC negative testing
        staff_role = db.query(Role).filter(Role.name == "STAFF").first()
        if not staff_role:
            staff_role = Role(id=str(uuid.uuid4()), name="STAFF", description="Staff")
            db.add(staff_role)
            db.commit()

        staff_user = db.query(User).filter(User.role_id == staff_role.id).first()
        if not staff_user:
            staff_user = User(
                id=str(uuid.uuid4()),
                email="test_staff_unauthorized@example.com",
                username="test_staff_unauthorized",
                password_hash="test",
                first_name="Test",
                last_name="Staff",
                role_id=staff_role.id,
                is_active=True,
            )
            db.add(staff_user)
            db.commit()
            db.refresh(staff_user)

        # Generate tokens
        admin_token = create_access_token(subject=str(super_admin.id), claims={"role": "SUPER_ADMIN"})
        staff_token = create_access_token(subject=str(staff_user.id), claims={"role": "STAFF"})

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        # 1. Non-admin authorization test (Expect 403)
        print("\n[1] RBAC Security Check: Non-Admin Access Denial...")
        res = client.get("/api/v1/users", headers=staff_headers)
        assert res.status_code == 403, f"Expected 403 for STAFF, got {res.status_code}: {res.text}"
        print("    [PASS] Staff access blocked with 403 Forbidden")

        # 2. Get Roles
        print("\n[2] Fetch Available Roles for Dropdown...")
        res = client.get("/api/v1/users/roles", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        roles = res.json()
        assert len(roles) > 0, "Roles list is empty"
        print(f"    [PASS] Successfully fetched {len(roles)} roles: {[r['name'] for r in roles]}")

        # 3. Get User Summary KPI
        print("\n[3] Fetch User Management Summary KPI...")
        res = client.get("/api/v1/users/summary", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        summary = res.json()
        assert "total_users" in summary, "Summary missing total_users"
        print(f"    [PASS] Total users: {summary['total_users']}, Active: {summary['active_users']}, Super Admins: {summary['super_admins']}")

        # 4. List Users
        print("\n[4] List Users (with search/filter)...")
        res = client.get("/api/v1/users?limit=10", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        users_list = res.json()
        assert len(users_list) > 0, "Users list is empty"
        print(f"    [PASS] Successfully listed {len(users_list)} users")

        # 5. Create a New User (OAuth style, no password)
        test_email = f"test_chef_{uuid.uuid4().hex[:6]}@example.com"
        print(f"\n[5] Create New User: {test_email}...")
        
        manager_role = next((r for r in roles if "MANAGER" in r["name"]), roles[0])
        branches = db.query(Branch).all()
        branch_ids = [str(b.id) for b in branches[:2]]

        create_payload = {
            "email": test_email,
            "first_name": "TestChef",
            "last_name": "Kumar",
            "phone": "+91 98765 43210",
            "role_id": manager_role["id"],
            "branch_ids": branch_ids,
            "default_branch_id": branch_ids[0] if branch_ids else None,
            "is_active": True,
        }

        res = client.post("/api/v1/users", json=create_payload, headers=admin_headers)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        created_user = res.json()
        assert created_user["email"] == test_email.lower(), "Email mismatch"
        assert created_user["role_name"] == manager_role["name"], "Role mismatch"
        assert created_user["is_active"] is True, "Active mismatch"
        assert len(created_user["branches"]) == len(branch_ids), "Branches mismatch"
        print(f"    [PASS] User created successfully: ID {created_user['id']}, Role: {created_user['role_name']}, Branches: {len(created_user['branches'])}")

        new_user_id = created_user["id"]

        # 6. Duplicate Email Rejection
        print("\n[6] Duplicate Email Conflict Check...")
        res_dup = client.post("/api/v1/users", json=create_payload, headers=admin_headers)
        assert res_dup.status_code == 409, f"Expected 409 Conflict, got {res_dup.status_code}: {res_dup.text}"
        print("    [PASS] Duplicate email rejected with 409 Conflict")

        # 7. Edit User
        print(f"\n[7] Edit User {new_user_id}...")
        update_payload = {
            "first_name": "MasterChef",
            "last_name": "Sharma",
            "phone": "+91 91234 56789",
        }
        res = client.put(f"/api/v1/users/{new_user_id}", json=update_payload, headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        updated_user = res.json()
        assert updated_user["first_name"] == "MasterChef", "First name not updated"
        assert updated_user["last_name"] == "Sharma", "Last name not updated"
        print(f"    [PASS] User updated: Name is now {updated_user['first_name']} {updated_user['last_name']}")

        # 8. Soft-Delete / Deactivate User
        print(f"\n[8] Soft-Delete / Deactivate User {new_user_id}...")
        res = client.delete(f"/api/v1/users/{new_user_id}", headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        # Verify in DB that user is is_active=False (not deleted)
        user_in_db = db.query(User).filter(User.id == new_user_id).first()
        assert user_in_db is not None, "User was hard-deleted! Should be soft-deleted."
        assert user_in_db.is_active is False, "User is_active was not set to False"
        print(f"    [PASS] User soft-deactivated successfully (record preserved in DB, is_active=False)")

        # 9. Reactivate User via Status Update
        print(f"\n[9] Reactivate User {new_user_id}...")
        res = client.patch(f"/api/v1/users/{new_user_id}/status", json={"is_active": True}, headers=admin_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        assert res.json()["is_active"] is True, "User not reactivated"
        print(f"    [PASS] User reactivated successfully")

        # 10. Self-Deactivation Protection
        print(f"\n[10] Self-Deactivation Protection...")
        res = client.delete(f"/api/v1/users/{super_admin.id}", headers=admin_headers)
        assert res.status_code == 400, f"Expected 400 Bad Request when admin deactivates self, got {res.status_code}: {res.text}"
        print(f"    [PASS] Self-deactivation prevented with 400 Bad Request")

        print("\n" + "=" * 60)
        print("ALL 10 USER MANAGEMENT TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()

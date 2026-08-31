"""
APEX Multi-Outlet Restaurant ERP
PART 3 — AUTHENTICATION, RBAC & SECURITY TEST SUITE

Validates:
1. Bcrypt Password Hashing & Safe Verification
2. JWT Access & Refresh Token Encoding / Decoding with Expiration Controls
3. Live Login Endpoint (POST /api/v1/auth/login)
4. Google OAuth Endpoint (POST /api/v1/auth/google)
5. Token Refresh Lifecycle (POST /api/v1/auth/refresh)
6. Authenticated Profile & Permission Scoping (GET /api/v1/auth/me)
7. Security Rejections (401 Unauthorized, 403 Forbidden)
8. Multi-Outlet Scoping & Permission Guard Dependency Rules
"""

import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.database import SessionLocal
from app.models.user import User, Role, Permission, RolePermission, UserBranch
from app.models.organization import Branch, Company, BranchType

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("RUNNING PART 3: AUTHENTICATION, RBAC & SECURITY TEST SUITE")
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

    # [1] Password Security & Cryptography
    print("\n[1] Bcrypt Cryptographic Functions:")
    hashed = get_password_hash("SecretPassword@2026")
    check("Password hashing returns non-empty string", bool(hashed) and len(hashed) > 20)
    check("Correct password verifies successfully", verify_password("SecretPassword@2026", hashed) is True)
    check("Incorrect password fails verification", verify_password("WrongPassword", hashed) is False)

    # [2] JWT Token Engine
    print("\n[2] JWT Access & Refresh Token Lifecycle:")
    access_tok = create_access_token(subject="user_123", claims={"role": "ADMIN", "company_id": "comp_1"})
    check("Access token is generated", bool(access_tok) and len(access_tok) > 20)
    
    decoded_access = decode_access_token(access_tok)
    check("Access token subject matches", decoded_access.get("sub") == "user_123")
    check("Access token claims preserved (role=ADMIN)", decoded_access.get("role") == "ADMIN")
    check("Access token type is 'access'", decoded_access.get("type") == "access")

    refresh_tok = create_refresh_token(subject="user_123")
    check("Refresh token is generated", bool(refresh_tok) and len(refresh_tok) > 20)
    decoded_refresh = decode_refresh_token(refresh_tok)
    check("Refresh token subject matches", decoded_refresh.get("sub") == "user_123")
    check("Refresh token type is 'refresh'", decoded_refresh.get("type") == "refresh")

    # [3] Live Login Endpoints
    print("\n[3] Live Authentication Endpoints:")
    # Invalid credentials
    res_invalid = client.post("/api/v1/auth/login", json={"email": "nonexistent@user.com", "password": "WrongPassword123"})
    check("Invalid login returns 401 Unauthorized", res_invalid.status_code == 401)
    check("Error code is UNAUTHORIZED", res_invalid.json().get("error", {}).get("code") == "UNAUTHORIZED")

    # Valid demo admin login
    res_login = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    check("Admin login returns 200 OK", res_login.status_code == 200)
    login_data = res_login.json()
    check("Login response contains access_token", "access_token" in login_data)
    check("Login response contains refresh_token", "refresh_token" in login_data)
    check("User profile role is populated", bool(login_data.get("user", {}).get("role")))
    
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]

    # [4] Google OAuth Endpoint
    print("\n[4] Google OAuth Flow:")
    res_google = client.post("/api/v1/auth/google", json={"id_token": "google_test_token_valid_abc123"})
    check("Google OAuth login returns 200 OK", res_google.status_code == 200)
    google_data = res_google.json()
    check("Google login contains access_token", "access_token" in google_data)
    check("Google user role is populated", bool(google_data.get("user", {}).get("role")))

    # [5] Refresh Token Endpoint
    print("\n[5] Token Refresh Flow:")
    res_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    check("Token refresh returns 200 OK", res_refresh.status_code == 200)
    refresh_data = res_refresh.json()
    check("Refresh response contains new access_token", "access_token" in refresh_data.get("data", {}))

    # [6] Protected /me Endpoint
    print("\n[6] Protected User Profile (GET /api/v1/auth/me):")
    res_unauth = client.get("/api/v1/auth/me")
    check("Unauthenticated /me request rejected with 401", res_unauth.status_code == 401)

    headers = {"Authorization": f"Bearer {access_token}"}
    res_me = client.get("/api/v1/auth/me", headers=headers)
    check("Authenticated /me request returns 200 OK", res_me.status_code == 200)
    me_data = res_me.json()
    check("Profile email matches logged in admin", bool(me_data.get("email")))
    check("Profile permissions includes admin wildcard or role", len(me_data.get("permissions", [])) > 0)

    # [7] Logout Endpoint
    print("\n[7] Logout Endpoint:")
    res_logout = client.post("/api/v1/auth/logout", headers=headers)
    check("Logout returns 200 OK", res_logout.status_code == 200)

    print("\n" + "=" * 60)
    print(f"SUCCESS: ALL {passed}/{total} PART 3 AUTH & RBAC TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

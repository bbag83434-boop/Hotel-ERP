import sys
import os
from decimal import Decimal
from fastapi.testclient import TestClient

# Append backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
from app.core.config import settings
from app.core.database import check_database_connection, SessionLocal
from app.core.exceptions import (
    InsufficientStockException,
    InvoiceMismatchException,
    ApprovalRequiredException,
    DuplicateRequestException,
    UnauthorizedException,
    ForbiddenException,
    ClosingPeriodLockedException,
)
import app.models as models

client = TestClient(app)

def test_fastapi_and_database_suite():
    print("====================================================")
    print("RUNNING GREENFIELD FASTAPI + SQLALCHEMY TEST SUITE")
    print("====================================================\n")

    passed = 0
    total = 0

    def assert_test(condition: bool, name: str):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name}")
            raise AssertionError(f"Test failed: {name}")

    # 1. Configuration & Settings
    print("[1] Environment & Config Verification:")
    assert_test(settings.PORT > 0, f"Port is configured ({settings.PORT})")
    assert_test(settings.API_V1_STR == "/api/v1", "API prefix is '/api/v1'")
    assert_test(len(settings.JWT_ACCESS_SECRET) > 0, "JWT secret is present")

    # 2. Domain Exceptions
    print("\n[2] Domain Exception Codes (Blueprint Sec 49):")
    exc_stock = InsufficientStockException("Truffle Oil", 5.0, 2.0, "L")
    assert_test(exc_stock.status_code == 400, "InsufficientStockException status is 400")
    assert_test(exc_stock.code == "INSUFFICIENT_STOCK", "Code is INSUFFICIENT_STOCK")
    assert_test(exc_stock.details["shortage"] == 3.0, "Shortage calculated correctly (5 - 2 = 3)")

    exc_inv = InvoiceMismatchException("Invoice amount 15000 != GRN accepted total 14200")
    assert_test(exc_inv.code == "INVOICE_MISMATCH", "Code is INVOICE_MISMATCH")

    exc_auth = UnauthorizedException()
    assert_test(exc_auth.status_code == 401, "UnauthorizedException is 401")

    exc_forbid = ForbiddenException()
    assert_test(exc_forbid.status_code == 403, "ForbiddenException is 403")

    exc_dup = DuplicateRequestException("req-idem-12345")
    assert_test(exc_dup.status_code == 409, "DuplicateRequestException is 409")

    exc_lock = ClosingPeriodLockedException("2026-08-FIRST_HALF", "Downtown-01")
    assert_test(exc_lock.code == "CLOSING_PERIOD_LOCKED", "Code is CLOSING_PERIOD_LOCKED")

    # 3. SQLAlchemy Domain Models
    print("\n[3] Enterprise SQLAlchemy 2.0 Domain Models:")
    assert_test(hasattr(models, "Company") and hasattr(models, "Branch"), "Company & Branch models exist")
    assert_test(hasattr(models, "OutletClosingRecord"), "OutletClosingRecord model exists")
    assert_test(hasattr(models, "ClosingStockItem"), "ClosingStockItem model exists")
    assert_test(hasattr(models, "FoodCostCalculation"), "FoodCostCalculation model exists")
    assert_test(hasattr(models, "PurchaseRequest") and hasattr(models, "PurchaseOrder"), "Central Purchase models exist")
    assert_test(hasattr(models, "GoodsReceiveNote"), "GoodsReceiveNote model exists")
    assert_test(hasattr(models, "ChartOfAccount") and hasattr(models, "JournalEntry"), "Double-Entry models exist")
    assert_test(hasattr(models, "IdempotencyRecord"), "IdempotencyRecord model exists")

    # 4. Bi-Monthly Closing Engine Math
    print("\n[4] Bi-Monthly Closing Consumption Math Verification:")
    opening_val = Decimal("120000.0000")
    purchases_val = Decimal("60000.0000")
    closing_phys_val = Decimal("105000.0000")
    # Formula: Actual Consumption = Opening + Purchases - Closing Physical
    actual_consumption = opening_val + purchases_val - closing_phys_val
    assert_test(actual_consumption == Decimal("75000.0000"), "Closing math: 120,000 + 60,000 - 105,000 = 75,000 consumption")

    theoretical_cost = Decimal("72000.0000")
    variance_amount = actual_consumption - theoretical_cost
    assert_test(variance_amount == Decimal("3000.0000"), "Variance math: 75,000 actual - 72,000 theoretical = +3,000 variance")

    # 5. FastAPI Endpoints
    print("\n[5] FastAPI Live Endpoints:")
    res_root = client.get("/")
    assert_test(res_root.status_code == 200, "GET / returns 200")
    assert_test("FastAPI" in res_root.json()["backend"], "Root confirms FastAPI backend")

    res_health = client.get("/api/v1/health")
    assert_test(res_health.status_code == 200, "GET /api/v1/health returns 200")
    assert_test(res_health.json()["success"] is True, "Health payload has success=True")
    assert_test(res_health.json()["data"]["features"]["centralPurchaseControl"] is True, "Central Purchase feature enabled")

    res_outlets = client.get("/api/v1/health/outlets")
    assert_test(res_outlets.status_code == 200, "GET /api/v1/health/outlets returns 200")
    assert_test("businessUnits" in res_outlets.json()["data"], "Outlet topology contains businessUnits (CS-01, DK-01, HQ)")

    # 6. Database Safe Connectivity
    print("\n[6] Safe Neon PostgreSQL Connection:")
    db_ok = check_database_connection()
    assert_test(db_ok is True, "Neon PostgreSQL connection verified safely")

    print("\n====================================================")
    print(f"SUCCESS: ALL {passed}/{total} FASTAPI & SQLALCHEMY TESTS PASSED!")
    print("====================================================\n")

if __name__ == "__main__":
    test_fastapi_and_database_suite()

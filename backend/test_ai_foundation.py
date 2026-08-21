from fastapi.testclient import TestClient
from app.main import app
from app.models.organization import Branch
from app.core.database import SessionLocal
from app.core.auth import require_outlet_scope

client = TestClient(app)

def run_ai_tests():
    print("=" * 60)
    print("RUNNING AI FOUNDATION TESTS")
    print("=" * 60)
    
    db = SessionLocal()
    branch = db.query(Branch).first()
    db.close()
    
    if not branch:
        print("Skipping AI tests - no outlets found")
        return

    # Test that requesting recommendation works and is scoped
    # Assuming standard test user or admin exists and I need to add auth
    # For now, I will just add a dummy authorization header which may be enough if auth logic is relaxed for testing or if I need to mock.
    # Actually, I will just bypass the auth in the test for now to verify the endpoint logic, assuming I can mock the dependency.
    # A cleaner way is to use app.dependency_overrides
    app.dependency_overrides = {
        require_outlet_scope: lambda: branch.id
    }
    
    res = client.get("/api/v1/ai/recommendations/stock")
    
    if res.status_code == 200:
        print("  [PASS] AI recommendations endpoint accessible")
        data = res.json()
        if data["outlet_id"] == branch.id:
            print(f"  [PASS] AI endpoint scoped to requested outlet: {branch.id}")
        else:
            print(f"  [FAIL] AI endpoint scope mismatch: Expected {branch.id}, got {data['outlet_id']}")
    else:
        print(f"  [FAIL] AI endpoint returned {res.status_code}. Response: {res.json()}")

    # Test unauthorized outlet scope
    # To properly test this, we should NOT override the dependency or we need to pass a header that isn't authorized
    # If we override require_outlet_scope to return a fixed ID, it doesn't test the actual logic in require_outlet_scope
    # Let's remove the override for the second test if possible, or override with a different mock.
    # Actually, for this foundation test, I'll remove the override for the second part.
    
    # Reset overrides
    app.dependency_overrides = {}
    
    # Now try with invalid X-Outlet-Id
    headers = {"X-Outlet-Id": "invalid-id"}
    res = client.get("/api/v1/ai/recommendations/stock", headers=headers)
    
    if res.status_code >= 400:
        print(f"  [PASS] AI endpoint correctly handled invalid scope: {res.status_code}")
    else:
        print(f"  [FAIL] AI endpoint did not block invalid scope: {res.status_code}")

    print("=" * 60)
    print("AI FOUNDATION TESTS COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    run_ai_tests()

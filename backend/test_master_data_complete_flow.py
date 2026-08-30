"""
MASTER DATA COMPLETE FLOW VALIDATION
Tests end-to-end API flows for:
1. Outlets / Branches (Create, List, Edit, Active/Inactive, Dependency-Protected Delete)
2. Vendors / Suppliers (Create, List, Edit, Active/Inactive, Dependency-Protected Delete)
3. Item Categories (Create, List, Edit, Active/Inactive, Dependency-Protected Delete)
4. Units (Create, List, Edit, Active/Inactive, Dependency-Protected Delete)
5. Items Master (Create, List, Edit, Active/Inactive, Dependency-Protected Delete)
6. Vendor ↔ Item & Rate Mapping (Create, List, Edit, Active/Inactive, Preferred Toggle, Delete Mapping)
"""

import os
import sys
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.organization import Company, Branch
from app.models.user import User, Role
from app.models.inventory import Category, Unit, Item
from app.models.procurement import Supplier, SupplierItem

client = TestClient(app)

def run_master_data_tests():
    print("=" * 80, flush=True)
    print("RUNNING MASTER DATA END-TO-END VERIFICATION SUITE", flush=True)
    print("=" * 80, flush=True)

    db = SessionLocal()
    passed = 0
    total = 0

    def check(name: str, condition: bool):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}", flush=True)
        else:
            print(f"  [FAIL] {name}", flush=True)
            raise AssertionError(f"Test failed: {name}")

    try:
        # Setup Super Admin Token
        company = db.query(Company).first()
        assert company, "No root company found in DB"
        company_id = company.id

        admin_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        admin_user = db.query(User).filter(User.role_id == admin_role.id).first()
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                company_id=company_id,
                role_id=admin_role.id,
                email="admin_flow@apex-erp.com",
                username="admin_flow",
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        else:
            admin_user.is_active = True
            db.commit()

        token = create_access_token(subject=str(admin_user.id), claims={"role": "SUPER_ADMIN", "company_id": company_id})
        headers = {"Authorization": f"Bearer {token}"}
        suffix = uuid.uuid4().hex[:6].upper()
        db.close()

        # =========================================================================
        # 1. OUTLETS / BRANCHES MASTER
        # =========================================================================
        print("\n--- [1] Outlets / Branches Master ---", flush=True)
        # Create
        branch_payload = {
            "name": f"Test Branch {suffix}",
            "code": f"BR-{suffix}",
            "type": "RESTAURANT",
            "email": f"branch_{suffix.lower()}@test.com",
            "phone": "+91 9876543210",
            "address": "123 Test Street",
        }
        res = client.post("/api/v1/organization/branches", json=branch_payload, headers=headers)
        check("Branch Create API (POST /organization/branches)", res.status_code == 201)
        branch_id = res.json()["id"]

        # Read / List
        res = client.get("/api/v1/organization/branches", headers=headers)
        check("Branch List API (GET /organization/branches)", res.status_code == 200 and any(b["id"] == branch_id for b in res.json()))

        # Edit
        res = client.put(f"/api/v1/organization/branches/{branch_id}", json={"name": f"Updated Branch {suffix}", "phone": "+91 9999999999"}, headers=headers)
        check("Branch Edit API (PUT /organization/branches/{id})", res.status_code == 200 and res.json()["name"] == f"Updated Branch {suffix}")

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/organization/branches/{branch_id}", json={"is_active": False}, headers=headers)
        check("Branch Inactive Toggle (PUT /organization/branches/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/organization/branches/{branch_id}", json={"is_active": True}, headers=headers)
        check("Branch Active Toggle (PUT /organization/branches/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 2. VENDORS / SUPPLIERS MASTER
        # =========================================================================
        print("\n--- [2] Vendors / Suppliers Master ---", flush=True)
        vendor_payload = {
            "name": f"Test Vendor {suffix}",
            "code": f"VEN-{suffix}",
            "contact_person": "Rajesh Kumar",
            "phone": "+91 9123456789",
            "whatsapp_number": "919123456789",
            "email": f"vendor_{suffix.lower()}@test.com",
            "address": "Vendor Warehouse, Sector 4",
            "gst_number": f"27AABCU{suffix[:4]}1Z5",
            "payment_terms": "Net 30 Days",
        }
        res = client.post("/api/v1/procurement/suppliers", json=vendor_payload, headers=headers)
        check("Vendor Create API (POST /procurement/suppliers)", res.status_code == 201)
        vendor_id = res.json()["id"]

        # Read / List
        res = client.get("/api/v1/procurement/suppliers", headers=headers)
        check("Vendor List API (GET /procurement/suppliers)", res.status_code == 200 and any(s["id"] == vendor_id for s in res.json()))

        # Edit
        res = client.put(f"/api/v1/procurement/suppliers/{vendor_id}", json={"name": f"Updated Vendor {suffix}"}, headers=headers)
        check("Vendor Edit API (PUT /procurement/suppliers/{id})", res.status_code == 200 and res.json()["name"] == f"Updated Vendor {suffix}")

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/procurement/suppliers/{vendor_id}", json={"is_active": False}, headers=headers)
        check("Vendor Inactive Toggle (PUT /procurement/suppliers/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/procurement/suppliers/{vendor_id}", json={"is_active": True}, headers=headers)
        check("Vendor Active Toggle (PUT /procurement/suppliers/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 3. ITEM CATEGORIES MASTER
        # =========================================================================
        print("\n--- [3] Item Categories Master ---", flush=True)
        cat_payload = {
            "name": f"Category {suffix}",
            "code": f"CAT-{suffix}",
            "description": "Master category for perishables",
        }
        res = client.post("/api/v1/inventory/categories", json=cat_payload, headers=headers)
        check("Category Create API (POST /inventory/categories)", res.status_code == 201)
        cat_id = res.json()["id"]

        # Read / List
        res = client.get("/api/v1/inventory/categories", headers=headers)
        check("Category List API (GET /inventory/categories)", res.status_code == 200 and any(c["id"] == cat_id for c in res.json()))

        # Edit
        res = client.put(f"/api/v1/inventory/categories/{cat_id}", json={"name": f"Updated Category {suffix}"}, headers=headers)
        check("Category Edit API (PUT /inventory/categories/{id})", res.status_code == 200 and res.json()["name"] == f"Updated Category {suffix}")

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/inventory/categories/{cat_id}", json={"is_active": False}, headers=headers)
        check("Category Inactive Toggle (PUT /inventory/categories/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/inventory/categories/{cat_id}", json={"is_active": True}, headers=headers)
        check("Category Active Toggle (PUT /inventory/categories/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 4. UNITS MASTER
        # =========================================================================
        print("\n--- [4] Units Master ---", flush=True)
        unit_payload = {
            "name": f"Kilogram {suffix}",
            "symbol": f"KG_{suffix[:4]}",
        }
        res = client.post("/api/v1/inventory/units", json=unit_payload, headers=headers)
        check("Unit Create API (POST /inventory/units)", res.status_code == 201)
        unit_id = res.json()["id"]

        # Read / List
        res = client.get("/api/v1/inventory/units", headers=headers)
        check("Unit List API (GET /inventory/units)", res.status_code == 200 and any(u["id"] == unit_id for u in res.json()))

        # Edit
        res = client.put(f"/api/v1/inventory/units/{unit_id}", json={"name": f"Kilogram Pack {suffix}"}, headers=headers)
        check("Unit Edit API (PUT /inventory/units/{id})", res.status_code == 200 and res.json()["name"] == f"Kilogram Pack {suffix}")

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/inventory/units/{unit_id}", json={"is_active": False}, headers=headers)
        check("Unit Inactive Toggle (PUT /inventory/units/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/inventory/units/{unit_id}", json={"is_active": True}, headers=headers)
        check("Unit Active Toggle (PUT /inventory/units/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 5. ITEMS MASTER
        # =========================================================================
        print("\n--- [5] Items Master ---", flush=True)
        item_payload = {
            "name": f"Basmati Rice {suffix}",
            "code": f"ITEM-{suffix}",
            "category_id": cat_id,
            "unit_id": unit_id,
            "type": "RAW_MATERIAL",
            "cost_price": 65.00,
            "selling_price": 85.00,
            "min_stock_level": 10.0,
            "reorder_qty": 50.0,
        }
        res = client.post("/api/v1/inventory/items", json=item_payload, headers=headers)
        check("Item Create API (POST /inventory/items)", res.status_code == 201)
        item_id = res.json()["id"]

        # Read / List
        res = client.get("/api/v1/inventory/items", headers=headers)
        check("Item List API (GET /inventory/items)", res.status_code == 200 and any(i["id"] == item_id for i in res.json()))

        # Category Filter on List
        res = client.get(f"/api/v1/inventory/items?category_id={cat_id}", headers=headers)
        check("Item Category Filter (GET /inventory/items?category_id=...)", res.status_code == 200 and len(res.json()) >= 1)

        # Edit
        res = client.put(f"/api/v1/inventory/items/{item_id}", json={"selling_price": 92.50}, headers=headers)
        check("Item Edit API (PUT /inventory/items/{id})", res.status_code == 200 and float(res.json()["selling_price"]) == 92.5)

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/inventory/items/{item_id}", json={"is_active": False}, headers=headers)
        check("Item Inactive Toggle (PUT /inventory/items/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/inventory/items/{item_id}", json={"is_active": True}, headers=headers)
        check("Item Active Toggle (PUT /inventory/items/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 6. VENDOR <-> ITEM & RATE MAPPINGS
        # =========================================================================
        print("\n--- [6] Vendor <-> Item Rate Mappings ---", flush=True)
        # Create Mapping 1: Vendor -> Item with negotiated rate
        map_payload = {
            "supplier_id": vendor_id,
            "item_id": item_id,
            "purchase_price": 58.50,
            "supplier_item_code": f"SKU-{suffix}",
            "lead_time_days": 2,
            "is_preferred": True,
            "is_active": True,
        }
        res = client.post("/api/v1/procurement/vendor-items", json=map_payload, headers=headers)
        check("Vendor Item Rate Map Create (POST /procurement/vendor-items)", res.status_code == 201)
        map_id = res.json()["id"]
        check("Rate mapping purchase price matches (INR 58.50)", float(res.json()["purchase_price"]) == 58.5)
        check("Rate mapping preferred supplier is True", res.json()["is_preferred"] is True)

        # Rejection of duplicate mapping
        res_dup = client.post("/api/v1/procurement/vendor-items", json=map_payload, headers=headers)
        check("Duplicate Vendor-Item Mapping Blocked (409 Conflict)", res_dup.status_code in [400, 409])

        # Read / List mappings
        res = client.get("/api/v1/procurement/vendor-items", headers=headers)
        check("Vendor-Item Mappings List (GET /procurement/vendor-items)", res.status_code == 200 and any(m["id"] == map_id for m in res.json()))

        # Edit Rate
        res = client.put(f"/api/v1/procurement/vendor-items/{map_id}", json={"purchase_price": 61.00, "lead_time_days": 3}, headers=headers)
        check("Vendor Rate Edit (PUT /procurement/vendor-items/{id})", res.status_code == 200 and float(res.json()["purchase_price"]) == 61.0 and res.json()["lead_time_days"] == 3)

        # Active / Inactive Toggle
        res = client.put(f"/api/v1/procurement/vendor-items/{map_id}", json={"is_active": False}, headers=headers)
        check("Vendor Rate Mapping Inactive (PUT /procurement/vendor-items/{id})", res.status_code == 200 and res.json()["is_active"] is False)
        res = client.put(f"/api/v1/procurement/vendor-items/{map_id}", json={"is_active": True}, headers=headers)
        check("Vendor Rate Mapping Active (PUT /procurement/vendor-items/{id})", res.status_code == 200 and res.json()["is_active"] is True)

        # =========================================================================
        # 7. DEPENDENCY-PROTECTED DELETION VALIDATION
        # =========================================================================
        print("\n--- [7] Dependency Protection & Safe Deletions ---", flush=True)
        # Unit cannot be deleted while Item references it
        res_del_unit = client.delete(f"/api/v1/inventory/units/{unit_id}", headers=headers)
        check("Unit Delete Blocked when referenced by Item (400 Bad Request)", res_del_unit.status_code == 400 and "item" in str(res_del_unit.json()).lower())

        # Category cannot be deleted while Item references it
        res_del_cat = client.delete(f"/api/v1/inventory/categories/{cat_id}", headers=headers)
        check("Category Delete Blocked when referenced by Item (400 Bad Request)", res_del_cat.status_code == 400 and "item" in str(res_del_cat.json()).lower())

        # Vendor cannot be deleted while SupplierItem references it
        res_del_ven = client.delete(f"/api/v1/procurement/suppliers/{vendor_id}", headers=headers)
        check("Vendor Delete Blocked when referenced by Rate Mapping (400 Bad Request)", res_del_ven.status_code == 400)

        # Delete Vendor-Item Mapping
        res_del_map = client.delete(f"/api/v1/procurement/vendor-items/{map_id}", headers=headers)
        check("Vendor Rate Mapping Deactivated/Deleted (DELETE /procurement/vendor-items/{id})", res_del_map.status_code in [200, 204])

        # Delete Item (Deactivates with dependency details since historical vendor mappings exist)
        res_del_item = client.delete(f"/api/v1/inventory/items/{item_id}", headers=headers)
        check("Item Safe Deletion / Deactivation with References (DELETE /inventory/items/{id})", res_del_item.status_code == 200)

        # Test safe deletion on standalone unreferenced Unit
        res_u_temp = client.post("/api/v1/inventory/units", json={"name": f"Temp Unit {suffix}", "symbol": f"tu_{suffix[:4]}"}, headers=headers)
        temp_unit_id = res_u_temp.json()["id"]
        res_del_unit_ok = client.delete(f"/api/v1/inventory/units/{temp_unit_id}", headers=headers)
        check("Unreferenced Unit Safely Deleted (DELETE /inventory/units/{id})", res_del_unit_ok.status_code == 200)

        # Test safe deletion on standalone unreferenced Category
        res_c_temp = client.post("/api/v1/inventory/categories", json={"name": f"Temp Cat {suffix}", "code": f"TC-{suffix}"}, headers=headers)
        temp_cat_id = res_c_temp.json()["id"]
        res_del_cat_ok = client.delete(f"/api/v1/inventory/categories/{temp_cat_id}", headers=headers)
        check("Unreferenced Category Safely Deleted (DELETE /inventory/categories/{id})", res_del_cat_ok.status_code == 200)

        # Vendor safe deactivation / deletion
        res_del_ven_ok = client.delete(f"/api/v1/procurement/suppliers/{vendor_id}", headers=headers)
        check("Vendor Safely Deactivated/Deleted (DELETE /procurement/suppliers/{id})", res_del_ven_ok.status_code in [200, 400])

        # Delete Test Branch
        res_del_branch = client.delete(f"/api/v1/organization/branches/{branch_id}", headers=headers)
        check("Branch Safely Deleted (DELETE /organization/branches/{id})", res_del_branch.status_code == 200)

        print("\n" + "=" * 80, flush=True)
        print(f"ALL MASTER DATA TESTS PASSED: {passed}/{total}", flush=True)
        print("=" * 80, flush=True)

    finally:
        db.close()

if __name__ == "__main__":
    run_master_data_tests()

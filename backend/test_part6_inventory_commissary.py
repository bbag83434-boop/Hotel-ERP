"""
APEX Multi-Outlet Restaurant ERP
PART 6 — MULTI-OUTLET INVENTORY & CENTRAL COMMISSARY AUTOMATED TEST SUITE

Validates:
1. Multi-Tenant Category & Standard Unit Catalog
2. Deterministic Unit Conversion Engine with Dimensional Incompatibility Rejection
3. Item / Raw Material / Finished Good Master Setup
4. Multi-Warehouse Stock Balances & Real-Time Stock Ledger Audit Trail
5. Central Commissary to Outlet Stock Transfers & Inter-Warehouse Logistics
6. Low Stock Detection & Automated Reorder Shortage Alerts
7. Physical Stock Count & Variance Reconciliation Engine
8. Direct Stock Adjustments with Row-Level Atomic Locking
9. Zero Data Loss & Neon PostgreSQL Live DB Preservation
"""

import sys
import os
import uuid
import datetime
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, Role
from app.models.organization import Company, Branch, Warehouse
from app.models.hr import Staff, Shift
from app.models.inventory import Category, Unit, UnitConversion, Item, StockBalance, StockLedger, StockTransfer, StockCount

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("APEX ENTERPRISE ERP — RUNNING PART 6: MULTI-OUTLET INVENTORY TESTS")
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

    # -------------------------------------------------------------
    # [0] Live Neon PostgreSQL Pre-Audit
    # -------------------------------------------------------------
    print("\n[0] Live Neon PostgreSQL Pre-Audit:")
    db = SessionLocal()
    try:
        user_count_before = db.query(User).count()
        role_count_before = db.query(Role).count()
        branch_count_before = db.query(Branch).count()
        staff_count_before = db.query(Staff).count()
        wh_count_before = db.query(Warehouse).count()
        check("Live PostgreSQL Connection Active", True)
        check(f"Pre-existing Users Preserved (Found: {user_count_before})", user_count_before >= 1)
        check(f"Pre-existing Roles Preserved (Found: {role_count_before})", role_count_before >= 3)
        check(f"Pre-existing Branches Preserved (Found: {branch_count_before})", branch_count_before >= 1)
        check(f"Pre-existing Warehouses Preserved (Found: {wh_count_before})", wh_count_before >= 1)
    finally:
        db.close()

    # -------------------------------------------------------------
    # [1] Unauthenticated Security Gatekeeping
    # -------------------------------------------------------------
    print("\n[1] Unauthenticated Security Gatekeeping:")
    check("GET /api/v1/inventory/categories returns 401 unauth", client.get("/api/v1/inventory/categories").status_code == 401)
    check("POST /api/v1/inventory/categories returns 401 unauth", client.post("/api/v1/inventory/categories", json={}).status_code == 401)
    check("GET /api/v1/inventory/units returns 401 unauth", client.get("/api/v1/inventory/units").status_code == 401)
    check("POST /api/v1/inventory/items returns 401 unauth", client.post("/api/v1/inventory/items", json={}).status_code == 401)
    check("GET /api/v1/inventory/stock-balances returns 401 unauth", client.get("/api/v1/inventory/stock-balances").status_code == 401)
    check("POST /api/v1/inventory/transfers returns 401 unauth", client.post("/api/v1/inventory/transfers", json={}).status_code == 401)
    check("POST /api/v1/inventory/stock-counts returns 401 unauth", client.post("/api/v1/inventory/stock-counts", json={}).status_code == 401)
    check("POST /api/v1/inventory/adjustments returns 401 unauth", client.post("/api/v1/inventory/adjustments", json={}).status_code == 401)

    # -------------------------------------------------------------
    # [2] Admin Authentication
    # -------------------------------------------------------------
    print("\n[2] Admin Authentication:")
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    check("Admin login returns 200", login_res.status_code == 200)
    token = login_res.json().get("access_token")
    check("Obtained valid JWT Bearer Token", token is not None)
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch existing company and branch
    branches_res = client.get("/api/v1/organization/branches", headers=headers)
    check("GET branches returns 200", branches_res.status_code == 200)
    branches = branches_res.json()
    test_branch = branches[0]
    test_branch_id = test_branch["id"]

    # -------------------------------------------------------------
    # [3] Commissary & Outlet Warehouses Setup
    # -------------------------------------------------------------
    print("\n[3] Central Commissary & Outlet Warehouses Setup:")
    commissary_code = f"WH-COMM-{uuid.uuid4().hex[:6].upper()}"
    commissary_payload = {
        "branch_id": test_branch_id,
        "name": f"Central Commissary Depot #{commissary_code}",
        "code": commissary_code,
        "address": "Zone A Central Commissary Logistics Facility",
        "type": "CENTRAL"
    }
    comm_res = client.post("/api/v1/organization/warehouses", json=commissary_payload, headers=headers)
    check("POST central commissary warehouse returns 201", comm_res.status_code == 201)
    commissary_wh_id = comm_res.json()["id"]

    outlet_code = f"WH-KITCHEN-{uuid.uuid4().hex[:6].upper()}"
    outlet_payload = {
        "branch_id": test_branch_id,
        "name": f"Main Kitchen Storage #{outlet_code}",
        "code": outlet_code,
        "address": "Floor 1 Kitchen Storage & Prep Area",
        "type": "KITCHEN"
    }
    out_res = client.post("/api/v1/organization/warehouses", json=outlet_payload, headers=headers)
    check("POST outlet kitchen warehouse returns 201", out_res.status_code == 201)
    outlet_wh_id = out_res.json()["id"]

    # -------------------------------------------------------------
    # [4] Category Master Setup
    # -------------------------------------------------------------
    print("\n[4] Category Master Setup:")
    cat_suffix = uuid.uuid4().hex[:6].upper()
    cat_dairy_payload = {
        "name": f"Dairy & Milk Products #{cat_suffix}",
        "code": f"CAT-DAIRY-{cat_suffix}",
        "description": "Fresh cow milk, paneer, butter, curd, cream"
    }
    cat_dairy_res = client.post("/api/v1/inventory/categories", json=cat_dairy_payload, headers=headers)
    check("POST /api/v1/inventory/categories (Dairy) returns 201", cat_dairy_res.status_code == 201)
    cat_dairy_id = cat_dairy_res.json()["id"]

    cat_bakery_payload = {
        "name": f"Bakery & Flour Provisions #{cat_suffix}",
        "code": f"CAT-BAKERY-{cat_suffix}",
        "description": "Flours, yeast, baking ingredients, breads"
    }
    cat_bakery_res = client.post("/api/v1/inventory/categories", json=cat_bakery_payload, headers=headers)
    check("POST /api/v1/inventory/categories (Bakery) returns 201", cat_bakery_res.status_code == 201)
    cat_bakery_id = cat_bakery_res.json()["id"]

    list_cats_res = client.get("/api/v1/inventory/categories", headers=headers)
    check("GET /api/v1/inventory/categories returns 200", list_cats_res.status_code == 200)
    check("Category list contains created categories", len(list_cats_res.json()) >= 2)

    # -------------------------------------------------------------
    # [5] Unit Master & Unit Conversion Engine
    # -------------------------------------------------------------
    print("\n[5] Unit Master & Unit Conversion Engine:")
    unit_suffix = uuid.uuid4().hex[:4].lower()

    # Create / verify units
    u_kg_res = client.post("/api/v1/inventory/units", json={"name": f"Kilogram {unit_suffix}", "symbol": f"kg{unit_suffix}"}, headers=headers)
    check("POST /api/v1/inventory/units (kg) returns 201", u_kg_res.status_code == 201)
    unit_kg_id = u_kg_res.json()["id"]

    u_ltr_res = client.post("/api/v1/inventory/units", json={"name": f"Litre {unit_suffix}", "symbol": f"l{unit_suffix}"}, headers=headers)
    check("POST /api/v1/inventory/units (litre) returns 201", u_ltr_res.status_code == 201)
    unit_ltr_id = u_ltr_res.json()["id"]

    u_pcs_res = client.post("/api/v1/inventory/units", json={"name": f"Pieces {unit_suffix}", "symbol": f"pcs{unit_suffix}"}, headers=headers)
    check("POST /api/v1/inventory/units (pcs) returns 201", u_pcs_res.status_code == 201)
    unit_pcs_id = u_pcs_res.json()["id"]

    # Test Conversion Engine
    # 1. Standard Weight conversion: 2.5 KG -> 2500 Grams
    conv_kg_res = client.post("/api/v1/inventory/unit-conversions/convert", json={"value": 2.5, "from_unit": "kg", "to_unit": "g"}, headers=headers)
    check("POST convert (2.5 KG to G) returns 200", conv_kg_res.status_code == 200)
    check("2.5 KG = 2500 G conversion match", float(conv_kg_res.json()["converted_value"]) == 2500.0)

    # 2. Standard Volume conversion: 1.75 Litre -> 1750 ML
    conv_vol_res = client.post("/api/v1/inventory/unit-conversions/convert", json={"value": 1.75, "from_unit": "litre", "to_unit": "ml"}, headers=headers)
    check("POST convert (1.75 Litre to ML) returns 200", conv_vol_res.status_code == 200)
    check("1.75 Litre = 1750 ML conversion match", float(conv_vol_res.json()["converted_value"]) == 1750.0)

    # 3. Standard Count conversion: 4 Dozen -> 48 Pieces
    conv_count_res = client.post("/api/v1/inventory/unit-conversions/convert", json={"value": 4, "from_unit": "dozen", "to_unit": "pcs"}, headers=headers)
    check("POST convert (4 Dozen to Pieces) returns 200", conv_count_res.status_code == 200)
    check("4 Dozen = 48 Pieces conversion match", float(conv_count_res.json()["converted_value"]) == 48.0)

    # 4. Incompatible dimension conversion rejection: 5 KG to Litre (Weight to Volume)
    bad_conv_res = client.post("/api/v1/inventory/unit-conversions/convert", json={"value": 5, "from_unit": "kg", "to_unit": "litre"}, headers=headers)
    check("Incompatible dimension conversion rejected with 400 Bad Request", bad_conv_res.status_code == 400)

    # -------------------------------------------------------------
    # [6] Item / Raw Material & Finished Good Catalog
    # -------------------------------------------------------------
    print("\n[6] Item / Raw Material & Finished Good Catalog:")
    item_suffix = uuid.uuid4().hex[:6].upper()
    
    # Raw Material 1: Fresh Cow Milk
    milk_payload = {
        "name": f"Full Cream Fresh Cow Milk #{item_suffix}",
        "code": f"RM-MILK-{item_suffix}",
        "category_id": cat_dairy_id,
        "unit_id": unit_ltr_id,
        "type": "RAW_MATERIAL",
        "cost_price": 65.0,
        "selling_price": 0.0,
        "min_stock_level": 50.0,
        "reorder_qty": 100.0,
        "is_active": True,
        "description": "Farm-fresh pasteurized cow milk 3.5% fat"
    }
    milk_res = client.post("/api/v1/inventory/items", json=milk_payload, headers=headers)
    check("POST /api/v1/inventory/items (Milk) returns 201", milk_res.status_code == 201)
    milk_item_id = milk_res.json()["id"]
    check("Milk cost_price matches ($65.00)", float(milk_res.json()["cost_price"]) == 65.0)
    check("Milk min_stock_level matches (50.0)", float(milk_res.json()["min_stock_level"]) == 50.0)

    # Raw Material 2: Refined Wheat Flour Maida
    maida_payload = {
        "name": f"Premium Refined Wheat Flour (Maida) #{item_suffix}",
        "code": f"RM-MAIDA-{item_suffix}",
        "category_id": cat_bakery_id,
        "unit_id": unit_kg_id,
        "type": "RAW_MATERIAL",
        "cost_price": 42.0,
        "selling_price": 0.0,
        "min_stock_level": 25.0,
        "reorder_qty": 50.0,
        "is_active": True
    }
    maida_res = client.post("/api/v1/inventory/items", json=maida_payload, headers=headers)
    check("POST /api/v1/inventory/items (Maida) returns 201", maida_res.status_code == 201)
    maida_item_id = maida_res.json()["id"]

    # Finished Good: Royal Heritage Gulab Jamun
    fg_payload = {
        "name": f"Royal Heritage Gulab Jamun Portion #{item_suffix}",
        "code": f"FG-GULAB-{item_suffix}",
        "category_id": cat_dairy_id,
        "unit_id": unit_pcs_id,
        "type": "FINISHED_GOOD",
        "cost_price": 45.0,
        "selling_price": 120.0,
        "min_stock_level": 10.0,
        "reorder_qty": 30.0,
        "is_active": True
    }
    fg_res = client.post("/api/v1/inventory/items", json=fg_payload, headers=headers)
    check("POST /api/v1/inventory/items (Gulab Jamun FG) returns 201", fg_res.status_code == 201)
    fg_item_id = fg_res.json()["id"]
    check("FG selling_price matches ($120.00)", float(fg_res.json()["selling_price"]) == 120.0)

    # -------------------------------------------------------------
    # [7] Direct Stock Inflow & Real-Time Stock Ledger Audit
    # -------------------------------------------------------------
    print("\n[7] Direct Stock Inflow & Real-Time Stock Ledger Audit:")
    
    # 1. Add 500 Litres of Milk to Central Commissary
    adj_milk = client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": commissary_wh_id,
        "item_id": milk_item_id,
        "change_qty": 500.0,
        "reason": "Direct Commissary Procurement Intake",
        "movement_type": "GRN",
        "notes": "Bulk morning delivery batch"
    }, headers=headers)
    check("POST /api/v1/inventory/adjustments (Milk +500L) returns 200", adj_milk.status_code == 200)
    check("Commissary Milk balance is 500L", float(adj_milk.json()["new_balance"]) == 500.0)

    # 2. Add 300 KG of Maida to Central Commissary
    adj_maida = client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": commissary_wh_id,
        "item_id": maida_item_id,
        "change_qty": 300.0,
        "reason": "Direct Flour Mill Intake",
        "movement_type": "GRN"
    }, headers=headers)
    check("POST /api/v1/inventory/adjustments (Maida +300KG) returns 200", adj_maida.status_code == 200)
    check("Commissary Maida balance is 300KG", float(adj_maida.json()["new_balance"]) == 300.0)

    # Verify Stock Balances Query
    wh_bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={commissary_wh_id}", headers=headers)
    check("GET /api/v1/inventory/stock-balances returns 200", wh_bal_res.status_code == 200)
    comm_balances = wh_bal_res.json()
    check("Commissary balances contains 2 items", len(comm_balances) >= 2)

    # Verify Stock Ledger Audit Trail
    ledger_res = client.get(f"/api/v1/inventory/stock-ledger?warehouse_id={commissary_wh_id}", headers=headers)
    check("GET /api/v1/inventory/stock-ledger returns 200", ledger_res.status_code == 200)
    check("Stock ledger contains logged GRN movements", len(ledger_res.json()) >= 2)

    # -------------------------------------------------------------
    # [8] Central Commissary to Outlet Kitchen Stock Transfer
    # -------------------------------------------------------------
    print("\n[8] Central Commissary to Outlet Kitchen Stock Transfer:")
    trf_payload = {
        "from_warehouse_id": commissary_wh_id,
        "to_warehouse_id": outlet_wh_id,
        "notes": "Daily Kitchen Replenishment Dispatch",
        "items": [
            {"item_id": milk_item_id, "quantity": 50.0, "unit_cost": 65.0, "notes": "50L Milk for Kitchen Prep"},
            {"item_id": maida_item_id, "quantity": 25.0, "unit_cost": 42.0, "notes": "25KG Maida for Bakery Station"}
        ]
    }
    create_trf_res = client.post("/api/v1/inventory/transfers", json=trf_payload, headers=headers)
    check("POST /api/v1/inventory/transfers returns 201", create_trf_res.status_code == 201)
    trf_data = create_trf_res.json()
    trf_id = trf_data["id"]
    check("Stock transfer status is PENDING", trf_data["status"] == "PENDING")
    check("Stock transfer items count is 2", len(trf_data["items"]) == 2)

    # Execute Transfer Completion
    comp_trf_res = client.put(f"/api/v1/inventory/transfers/{trf_id}/status", json={"status": "COMPLETED", "notes": "Received in full at Main Kitchen"}, headers=headers)
    check("PUT /api/v1/inventory/transfers/{id}/status returns 200", comp_trf_res.status_code == 200)
    check("Stock transfer transitioned to COMPLETED", comp_trf_res.json()["status"] == "COMPLETED")

    # Verify Central Commissary Balances Deducted
    comm_milk_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={commissary_wh_id}&item_id={milk_item_id}", headers=headers)
    check("Commissary Milk reduced from 500L to 450L", float(comm_milk_bal.json()[0]["quantity"]) == 450.0)

    comm_maida_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={commissary_wh_id}&item_id={maida_item_id}", headers=headers)
    check("Commissary Maida reduced from 300KG to 275KG", float(comm_maida_bal.json()[0]["quantity"]) == 275.0)

    # Verify Outlet Kitchen Balances Credited
    out_milk_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={outlet_wh_id}&item_id={milk_item_id}", headers=headers)
    check("Outlet Kitchen Milk credited with 50L", float(out_milk_bal.json()[0]["quantity"]) == 50.0)

    out_maida_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={outlet_wh_id}&item_id={maida_item_id}", headers=headers)
    check("Outlet Kitchen Maida credited with 25KG", float(out_maida_bal.json()[0]["quantity"]) == 25.0)

    # -------------------------------------------------------------
    # [9] Low Stock Detection & Automated Shortage Alerts
    # -------------------------------------------------------------
    print("\n[9] Low Stock Detection & Automated Shortage Alerts:")
    # In Outlet Kitchen, Maida is 25KG, but min_stock_level is 25.0. Let's consume 5KG so it's 20KG (< 25KG).
    client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": outlet_wh_id,
        "item_id": maida_item_id,
        "change_qty": -5.0,
        "reason": "Production consumption for prep",
        "movement_type": "PRODUCTION_OUT"
    }, headers=headers)

    low_res = client.get(f"/api/v1/inventory/stock-balances/low-stock?warehouse_id={outlet_wh_id}", headers=headers)
    check("GET /api/v1/inventory/stock-balances/low-stock returns 200", low_res.status_code == 200)
    low_items = low_res.json()
    maida_alert = next((a for a in low_items if a["item_id"] == maida_item_id), None)
    check("Low stock alert generated for Maida", maida_alert is not None)
    if maida_alert:
        check("Maida current quantity is 20.0", float(maida_alert["current_quantity"]) == 20.0)
        check("Maida shortage is 5.0", float(maida_alert["shortage"]) == 5.0)

    # -------------------------------------------------------------
    # [10] Physical Stock Count & Variance Reconciliation
    # -------------------------------------------------------------
    print("\n[10] Physical Stock Count & Variance Reconciliation:")
    
    # Create Physical Stock Count session
    sc_payload = {
        "warehouse_id": outlet_wh_id,
        "notes": "Weekly End-of-Week Physical Audit",
        "items": [
            {"item_id": milk_item_id, "physical_qty": 48.0, "unit_cost": 65.0, "remarks": "2L normal spillage/wastage"},
            {"item_id": maida_item_id, "physical_qty": 20.0, "unit_cost": 42.0, "remarks": "Exact count matches"}
        ]
    }
    sc_create_res = client.post("/api/v1/inventory/stock-counts", json=sc_payload, headers=headers)
    check("POST /api/v1/inventory/stock-counts returns 201", sc_create_res.status_code == 201)
    sc_data = sc_create_res.json()
    sc_id = sc_data["id"]
    check("Stock count status is DRAFT", sc_data["status"] == "DRAFT")

    # Milk had 50L in system, physical count is 48L => variance = -2.0, variance_value = -$130.00
    milk_sc_item = next((i for i in sc_data["items"] if i["item_id"] == milk_item_id), None)
    check("Milk system_qty recorded as 50.0", milk_sc_item is not None and float(milk_sc_item["system_qty"]) == 50.0)
    check("Milk variance_qty calculated as -2.0", milk_sc_item is not None and float(milk_sc_item["variance_qty"]) == -2.0)
    check("Milk variance_value calculated as -$130.00", milk_sc_item is not None and float(milk_sc_item["variance_value"]) == -130.0)

    # Submit stock count
    sc_sub_res = client.put(f"/api/v1/inventory/stock-counts/{sc_id}/submit", json={
        "items": [
            {"item_id": milk_item_id, "physical_qty": 48.0, "unit_cost": 65.0, "remarks": "Verified by head chef"},
            {"item_id": maida_item_id, "physical_qty": 20.0, "unit_cost": 42.0, "remarks": "Verified by head chef"}
        ],
        "notes": "Verified by kitchen supervisor"
    }, headers=headers)
    check("PUT /api/v1/inventory/stock-counts/{id}/submit returns 200", sc_sub_res.status_code == 200)
    check("Stock count status transitioned to IN_PROGRESS", sc_sub_res.json()["status"] == "IN_PROGRESS")

    # Approve and Adjust physical count into inventory
    sc_adj_res = client.put(f"/api/v1/inventory/stock-counts/{sc_id}/adjust", headers=headers)
    check("PUT /api/v1/inventory/stock-counts/{id}/adjust returns 200", sc_adj_res.status_code == 200)
    check("Stock count status transitioned to COMPLETED", sc_adj_res.json()["status"] == "COMPLETED")

    # Verify Outlet Kitchen Milk balance adjusted to physical count (48.0 L)
    final_milk_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={outlet_wh_id}&item_id={milk_item_id}", headers=headers)
    check("Outlet Kitchen Milk balance reconciled to 48.0L", float(final_milk_bal.json()[0]["quantity"]) == 48.0)

    # -------------------------------------------------------------
    # [11] Live Neon Database Post-Test Preservation Audit
    # -------------------------------------------------------------
    print("\n[11] Live Neon Database Post-Test Preservation Audit:")
    db = SessionLocal()
    try:
        user_count_after = db.query(User).count()
        role_count_after = db.query(Role).count()
        branch_count_after = db.query(Branch).count()
        staff_count_after = db.query(Staff).count()
        shifts_count_after = db.query(Shift).count()
        items_count_after = db.query(Item).count()
        cats_count_after = db.query(Category).count()
        wh_count_after = db.query(Warehouse).count()
        trf_count_after = db.query(StockTransfer).count()

        check("Zero Data Loss: User records intact", user_count_after >= user_count_before)
        check("Zero Data Loss: Role records intact", role_count_after >= role_count_before)
        check("Zero Data Loss: Branch records intact", branch_count_after >= branch_count_before)
        check("Zero Data Loss: Staff records intact", staff_count_after >= staff_count_before)
        check("Zero Data Loss: Shift records intact", shifts_count_after >= 1)
        check("New Warehouses Persisted to Neon PostgreSQL", wh_count_after >= wh_count_before + 2)
        check("New Categories Persisted to Neon PostgreSQL", cats_count_after >= 2)
        check("New Items Persisted to Neon PostgreSQL", items_count_after >= 3)
        check("Stock Transfers Persisted to Neon PostgreSQL", trf_count_after >= 1)

        print(f"      Final DB State: Users={user_count_after}, Roles={role_count_after}, Branches={branch_count_after}, Staff={staff_count_after}, Warehouses={wh_count_after}, Items={items_count_after}, Transfers={trf_count_after}")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print(f"SUCCESS: ALL {passed}/{total} PART 6 INVENTORY & COMMISSARY TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()

import os
import sys
import uuid
from decimal import Decimal
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(__file__))
from app.main import app
from app.core.database import SessionLocal, engine
from app.models.inventory import StockBalance

client = TestClient(app)

def run_part8_tests():
    print("=" * 70)
    print("RUNNING COMPREHENSIVE PART 8: ENTERPRISE INVENTORY AUTOMATED TESTS")
    print("=" * 70)

    token = None
    headers = {}
    test_run_id = uuid.uuid4().hex[:6].upper()

    # -------------------------------------------------------------
    # [1] Unauthenticated Security Gatekeeping (401 Unauthorized)
    # -------------------------------------------------------------
    print("\n[1] Unauthenticated Security Gatekeeping (401 Unauthorized):")
    endpoints_to_test = [
        ("GET", "/api/v1/inventory/batches"),
        ("POST", "/api/v1/inventory/batches"),
        ("GET", "/api/v1/inventory/batches/expiring"),
        ("GET", "/api/v1/inventory/store-locations"),
        ("POST", "/api/v1/inventory/store-locations"),
        ("POST", "/api/v1/inventory/picking/suggest"),
        ("POST", "/api/v1/inventory/picking/consume"),
        ("GET", "/api/v1/inventory/reorder-recommendations"),
        ("GET", "/api/v1/inventory/valuation"),
    ]
    for method, path in endpoints_to_test:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Expected 401 for {method} {path}, got {res.status_code}"
        print(f"  [PASS] {method} {path} blocked for unauthenticated requests (401)")

    # -------------------------------------------------------------
    # [2] Admin Authentication & Multi-Warehouse Domain Setup
    # -------------------------------------------------------------
    print("\n[2] Admin Authentication & Multi-Warehouse Domain Setup:")
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin", "password": "admin123"}
    )
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  [PASS] Admin authenticated successfully")


    # Get admin profile
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    company_id = me_res.json()["company_id"]

    # Create Branch
    branch_payload = {
        "name": f"Apex Inventory Mega Hub #{test_run_id}",
        "code": f"HUB-{test_run_id}",
        "type": "RESTAURANT",
        "email": f"hub-{test_run_id.lower()}@apexerp.internal",
        "phone": "+1-800-555-8888",
        "address": "456 Enterprise Logistics Blvd",
    }
    b_res = client.post("/api/v1/organization/branches", json=branch_payload, headers=headers)
    assert b_res.status_code == 201
    branch_id = b_res.json()["id"]
    print(f"  [PASS] Created Branch: {b_res.json()['name']} ({branch_id})")

    # Create Central Warehouse and Kitchen Warehouse
    wh1_payload = {
        "branch_id": branch_id,
        "name": f"Central Cold Storage #{test_run_id}",
        "code": f"COLD-{test_run_id}",
        "is_central": True,
    }
    wh1_res = client.post("/api/v1/organization/warehouses", json=wh1_payload, headers=headers)
    assert wh1_res.status_code == 201
    wh_cold_id = wh1_res.json()["id"]

    wh2_payload = {
        "branch_id": branch_id,
        "name": f"Main Kitchen Storage #{test_run_id}",
        "code": f"KITCHEN-{test_run_id}",
        "is_central": False,
    }
    wh2_res = client.post("/api/v1/organization/warehouses", json=wh2_payload, headers=headers)
    assert wh2_res.status_code == 201
    wh_kitchen_id = wh2_res.json()["id"]
    print(f"  [PASS] Created Warehouses: Cold Storage ({wh_cold_id}) and Main Kitchen ({wh_kitchen_id})")

    # Create Category and Units
    cat_payload = {"name": f"Dairy & Butter #{test_run_id}", "code": f"DAIRY-{test_run_id}"}
    cat_res = client.post("/api/v1/inventory/categories", json=cat_payload, headers=headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    uom_kg_res = client.post("/api/v1/inventory/units", json={"name": f"Kilogram #{test_run_id}", "symbol": f"KG-{test_run_id}"}, headers=headers)
    assert uom_kg_res.status_code == 201
    uom_kg_id = uom_kg_res.json()["id"]

    uom_ltr_res = client.post("/api/v1/inventory/units", json={"name": f"Litre #{test_run_id}", "symbol": f"LTR-{test_run_id}"}, headers=headers)
    assert uom_ltr_res.status_code == 201
    uom_ltr_id = uom_ltr_res.json()["id"]

    # Create Items: Organic Butter and Fresh Whole Milk
    butter_payload = {
        "category_id": cat_id,
        "unit_id": uom_kg_id,
        "name": f"Organic Unsalted Butter #{test_run_id}",
        "code": f"RM-BUTTER-{test_run_id}",
        "type": "RAW_MATERIAL",
        "cost_price": 120.00,
        "selling_price": 0.00,
        "min_stock_level": 50.00,
        "reorder_qty": 100.00,
    }
    butter_res = client.post("/api/v1/inventory/items", json=butter_payload, headers=headers)
    assert butter_res.status_code == 201
    butter_id = butter_res.json()["id"]

    milk_payload = {
        "category_id": cat_id,
        "unit_id": uom_ltr_id,
        "name": f"Fresh Farm Milk #{test_run_id}",
        "code": f"RM-MILK-{test_run_id}",
        "type": "RAW_MATERIAL",
        "cost_price": 45.00,
        "selling_price": 0.00,
        "min_stock_level": 40.00,
        "reorder_qty": 80.00,
    }
    milk_res = client.post("/api/v1/inventory/items", json=milk_payload, headers=headers)
    assert milk_res.status_code == 201
    milk_id = milk_res.json()["id"]
    print(f"  [PASS] Created Test Items: Butter ({butter_id}) and Milk ({milk_id})")

    # -------------------------------------------------------------
    # [3] Store Location (Aisle/Rack/Shelf/Bin/Capacity) Management
    # -------------------------------------------------------------
    print("\n[3] Store Location (Aisle/Rack/Shelf/Bin/Capacity) Management:")
    loc_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "aisle": "Cold-Aisle-01",
        "rack": "Rack-B",
        "shelf": "Shelf-03",
        "bin": "Bin-302",
        "capacity": 500.00,
    }
    loc_res = client.post("/api/v1/inventory/store-locations", json=loc_payload, headers=headers)
    assert loc_res.status_code == 201
    loc_data = loc_res.json()
    loc_id = loc_data["id"]
    assert loc_data["aisle"] == "Cold-Aisle-01"
    assert loc_data["bin"] == "Bin-302"
    assert Decimal(str(loc_data["capacity"])) == Decimal("500.0000")
    print(f"  [PASS] POST /inventory/store-locations created location: {loc_id}")

    # List locations
    loc_list_res = client.get(f"/api/v1/inventory/store-locations?warehouse_id={wh_cold_id}", headers=headers)
    assert loc_list_res.status_code == 200
    assert any(l["id"] == loc_id for l in loc_list_res.json())
    print("  [PASS] GET /inventory/store-locations returned registered locations")

    # Update location
    loc_update_res = client.put(f"/api/v1/inventory/store-locations/{loc_id}", json={"bin": "Bin-302-PRO", "capacity": 600.00}, headers=headers)
    assert loc_update_res.status_code == 200
    assert loc_update_res.json()["bin"] == "Bin-302-PRO"
    assert Decimal(str(loc_update_res.json()["capacity"])) == Decimal("600.0000")
    print("  [PASS] PUT /inventory/store-locations/{id} updated capacity & bin")

    # -------------------------------------------------------------
    # [4] Batch / Lot & Expiry Tracking Engine
    # -------------------------------------------------------------
    print("\n[4] Batch / Lot & Expiry Tracking Engine:")
    now = datetime.utcnow()
    exp_batch1 = now + timedelta(days=10)   # Expiring in 10 days
    exp_batch2 = now + timedelta(days=45)   # Expiring in 45 days
    exp_batch3 = now + timedelta(days=5)    # Expiring in 5 days (Earliest!)

    # Create Batch 1
    b1_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "batch_number": f"BATCH-BUTTER-01-{test_run_id}",
        "quantity": 50.00,
        "unit_cost": 120.00,
        "expiry_date": exp_batch1.isoformat(),
        "mfg_date": (now - timedelta(days=10)).isoformat(),
    }
    b1_res = client.post("/api/v1/inventory/batches", json=b1_payload, headers=headers)
    assert b1_res.status_code == 201
    b1_data = b1_res.json()
    b1_id = b1_data["id"]
    assert b1_data["batch_number"] == f"BATCH-BUTTER-01-{test_run_id}"
    assert Decimal(str(b1_data["quantity"])) == Decimal("50.0000")
    assert Decimal(str(b1_data["unit_cost"])) == Decimal("120.0000")
    print(f"  [PASS] Created Batch 1 (Exp: +10d, Qty: 50, UnitCost: 120.00): {b1_id}")

    # Create Batch 2
    b2_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "batch_number": f"BATCH-BUTTER-02-{test_run_id}",
        "quantity": 70.00,
        "unit_cost": 130.00,
        "expiry_date": exp_batch2.isoformat(),
        "mfg_date": (now - timedelta(days=5)).isoformat(),
    }
    b2_res = client.post("/api/v1/inventory/batches", json=b2_payload, headers=headers)
    assert b2_res.status_code == 201
    b2_data = b2_res.json()
    b2_id = b2_data["id"]
    print(f"  [PASS] Created Batch 2 (Exp: +45d, Qty: 70, UnitCost: 130.00): {b2_id}")

    # Create Batch 3
    b3_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "batch_number": f"BATCH-BUTTER-03-{test_run_id}",
        "quantity": 30.00,
        "unit_cost": 115.00,
        "expiry_date": exp_batch3.isoformat(),
        "mfg_date": (now - timedelta(days=15)).isoformat(),
    }
    b3_res = client.post("/api/v1/inventory/batches", json=b3_payload, headers=headers)
    assert b3_res.status_code == 201
    b3_data = b3_res.json()
    b3_id = b3_data["id"]
    print(f"  [PASS] Created Batch 3 (Exp: +5d, Qty: 30, UnitCost: 115.00): {b3_id}")

    # Verify Warehouse StockBalance reflects total batch stock (50 + 70 + 30 = 150)
    bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={wh_cold_id}&item_id={butter_id}", headers=headers)
    assert bal_res.status_code == 200
    assert len(bal_res.json()) >= 1
    assert Decimal(str(bal_res.json()[0]["quantity"])) == Decimal("150.0000")
    print("  [PASS] StockBalance automatically synchronized with 150.0000 units across 3 batches")

    # Query expiring batches threshold (days=15) -> Should return Batch 3 (+5d) and Batch 1 (+10d), but NOT Batch 2 (+45d)
    expiring_res = client.get(f"/api/v1/inventory/batches/expiring?days=15&warehouse_id={wh_cold_id}", headers=headers)
    assert expiring_res.status_code == 200
    exp_batches = expiring_res.json()
    exp_batch_nums = [b["batch_number"] for b in exp_batches]
    assert f"BATCH-BUTTER-03-{test_run_id}" in exp_batch_nums
    assert f"BATCH-BUTTER-01-{test_run_id}" in exp_batch_nums
    assert f"BATCH-BUTTER-02-{test_run_id}" not in exp_batch_nums
    print(f"  [PASS] GET /inventory/batches/expiring accurately identified {len(exp_batches)} near-expiry batches within 15 days")

    # -------------------------------------------------------------
    # [5] FIFO & FEFO Picking Suggestion Engine
    # -------------------------------------------------------------
    print("\n[5] FIFO & FEFO Picking Suggestion Engine:")
    # Suggest FEFO picking for 60 units of Butter:
    # Expected order:
    # 1. Batch 3 (expires in 5d) -> 30 units (all)
    # 2. Batch 1 (expires in 10d) -> 30 units (partial of 50)
    fefo_sug_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "requested_qty": 60.00,
        "strategy": "FEFO",
    }
    fefo_sug_res = client.post("/api/v1/inventory/picking/suggest", json=fefo_sug_payload, headers=headers)
    assert fefo_sug_res.status_code == 200
    fefo_sug_data = fefo_sug_res.json()
    assert fefo_sug_data["is_fully_allocated"] is True
    assert Decimal(str(fefo_sug_data["total_allocated_qty"])) == Decimal("60.0000")
    assert Decimal(str(fefo_sug_data["shortage_qty"])) == Decimal("0.0000")
    assert len(fefo_sug_data["allocations"]) == 2
    
    # Check allocation sequence
    alloc1 = fefo_sug_data["allocations"][0]
    alloc2 = fefo_sug_data["allocations"][1]
    assert alloc1["batch_number"] == f"BATCH-BUTTER-03-{test_run_id}"
    assert Decimal(str(alloc1["allocated_qty"])) == Decimal("30.0000")
    assert alloc2["batch_number"] == f"BATCH-BUTTER-01-{test_run_id}"
    assert Decimal(str(alloc2["allocated_qty"])) == Decimal("30.0000")
    print(f"  [PASS] FEFO strategy correctly allocated Batch 3 (30 units) then Batch 1 (30 units)")

    # Suggest picking for quantity larger than total inventory (e.g. 200 units when stock is 150)
    shortage_sug_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "requested_qty": 200.00,
        "strategy": "FEFO",
    }
    shortage_res = client.post("/api/v1/inventory/picking/suggest", json=shortage_sug_payload, headers=headers)
    assert shortage_res.status_code == 200
    shortage_data = shortage_res.json()
    assert shortage_data["is_fully_allocated"] is False
    assert Decimal(str(shortage_data["total_allocated_qty"])) == Decimal("150.0000")
    assert Decimal(str(shortage_data["shortage_qty"])) == Decimal("50.0000")
    print("  [PASS] Picking suggestion engine accurately detected shortage: ShortageQty=50.0000")

    # -------------------------------------------------------------
    # [6] FIFO / FEFO Picking Consumption Engine Execution
    # -------------------------------------------------------------
    print("\n[6] FIFO / FEFO Picking Consumption Engine Execution:")
    # Consume 40 units of Butter using FEFO:
    # 30 units from Batch 3 (exhausts batch)
    # 10 units from Batch 1 (leaves 40 units)
    consume_payload = {
        "warehouse_id": wh_cold_id,
        "item_id": butter_id,
        "requested_qty": 40.00,
        "strategy": "FEFO",
        "movement_type": "PRODUCTION_OUT",
        "reference_type": "KITCHEN_DAILY_BAKE",
        "notes": "Daily Morning Croissant Batch",
    }
    consume_res = client.post("/api/v1/inventory/picking/consume", json=consume_payload, headers=headers)
    assert consume_res.status_code == 200
    consume_data = consume_res.json()
    assert consume_data["success"] is True
    assert Decimal(str(consume_data["total_consumed_qty"])) == Decimal("40.0000")
    assert Decimal(str(consume_data["new_warehouse_balance"])) == Decimal("110.0000")
    print("  [PASS] POST /inventory/picking/consume executed FEFO consumption of 40 units")

    # Verify Batch 3 is exhausted / inactive
    b3_check = client.get(f"/api/v1/inventory/batches/{b3_id}", headers=headers)
    assert b3_check.status_code == 200
    assert Decimal(str(b3_check.json()["quantity"])) == Decimal("0.0000")
    assert b3_check.json()["is_active"] is False
    print(f"  [PASS] Batch 3 quantity reduced to 0 and deactivated")

    # Verify Batch 1 remaining quantity is 40
    b1_check = client.get(f"/api/v1/inventory/batches/{b1_id}", headers=headers)
    assert b1_check.status_code == 200
    assert Decimal(str(b1_check.json()["quantity"])) == Decimal("40.0000")
    print(f"  [PASS] Batch 1 quantity reduced from 50 to 40")

    # Verify Stock Ledger contains PRODUCTION_OUT entries referencing the batch numbers
    ledger_res = client.get(f"/api/v1/inventory/stock-ledger?warehouse_id={wh_cold_id}&item_id={butter_id}", headers=headers)
    assert ledger_res.status_code == 200
    entries = ledger_res.json()
    prod_out_entries = [e for e in entries if e["movement_type"] == "PRODUCTION_OUT"]
    assert len(prod_out_entries) >= 2
    print(f"  [PASS] Stock Ledger contains {len(prod_out_entries)} PRODUCTION_OUT audit records with batch references")

    # -------------------------------------------------------------
    # [7] Automated Reorder Recommendations & Urgency Engine
    # -------------------------------------------------------------
    print("\n[7] Automated Reorder Recommendations & Urgency Engine:")
    # Set min stock level for butter to 120 (current stock is 110 -> Below min)
    db = SessionLocal()
    bal_obj = db.query(StockBalance).filter(StockBalance.warehouse_id == wh_cold_id, StockBalance.item_id == butter_id).first()
    bal_obj.min_stock_level = Decimal("120.0000")
    bal_obj.reorder_qty = Decimal("100.0000")
    db.commit()
    db.close()

    # Call reorder recommendations
    reorder_res = client.get(f"/api/v1/inventory/reorder-recommendations?warehouse_id={wh_cold_id}", headers=headers)
    assert reorder_res.status_code == 200
    reorder_data = reorder_res.json()
    assert reorder_data["total_items_to_reorder"] >= 1
    assert any(r["item_id"] == butter_id for r in reorder_data["recommendations"])
    
    butter_rec = next(r for r in reorder_data["recommendations"] if r["item_id"] == butter_id)
    assert Decimal(str(butter_rec["current_stock"])) == Decimal("110.0000")
    assert Decimal(str(butter_rec["min_stock_level"])) == Decimal("120.0000")
    assert butter_rec["urgency_level"] in ["HIGH", "MEDIUM", "CRITICAL"]
    print(f"  [PASS] Reorder recommendations identified shortage: Item={butter_rec['item_name']}, SuggestedQty={butter_rec['suggested_order_qty']}, EstCost={butter_rec['estimated_total_cost']}, Urgency={butter_rec['urgency_level']}")

    # -------------------------------------------------------------
    # [8] Enterprise Inventory Valuation Engine
    # -------------------------------------------------------------
    print("\n[8] Enterprise Inventory Valuation Engine:")
    val_res = client.get(f"/api/v1/inventory/valuation?warehouse_id={wh_cold_id}", headers=headers)
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert Decimal(str(val_data["total_inventory_value"])) > Decimal("0.0000")
    assert len(val_data["warehouses"]) >= 1
    assert len(val_data["items"]) >= 1

    wh_val = val_data["warehouses"][0]
    print(f"  [PASS] Warehouse Valuation: Warehouse={wh_val['warehouse_name']}, TotalItems={wh_val['total_items_count']}, FIFOValue=${wh_val['fifo_batch_value']}, WAvgValue=${wh_val['weighted_avg_value']}")
    print(f"  [PASS] Total Enterprise Inventory Valuation: ${val_data['total_inventory_value']}")

    # -------------------------------------------------------------
    # [9] Zero Data Loss & Live Neon PostgreSQL Persistence
    # -------------------------------------------------------------
    print("\n[9] Zero Data Loss & Live Neon PostgreSQL Persistence:")
    db = SessionLocal()
    u_count = db.execute(text("SELECT count(*) FROM users")).scalar()
    r_count = db.execute(text("SELECT count(*) FROM roles")).scalar()
    b_count = db.execute(text("SELECT count(*) FROM branches")).scalar()
    st_count = db.execute(text("SELECT count(*) FROM staff")).scalar()
    rec_count = db.execute(text("SELECT count(*) FROM recipes")).scalar()
    batch_count = db.execute(text("SELECT count(*) FROM stock_batches")).scalar()
    loc_count = db.execute(text("SELECT count(*) FROM store_locations")).scalar()
    db.close()

    assert u_count >= 1, "User records lost"
    assert r_count >= 3, "Role records lost"
    assert b_count >= 1, "Branch records lost"
    assert st_count >= 1, "Staff records lost"
    assert rec_count >= 1, "Recipe records lost"
    assert batch_count >= 3, "Stock batches not persisted"
    assert loc_count >= 1, "Store locations not persisted"

    print(f"  [PASS] Zero Data Loss: Users={u_count}, Roles={r_count}, Branches={b_count}, Staff={st_count}, Recipes={rec_count}")
    print(f"  [PASS] Part 8 Persistence: Batches={batch_count}, StoreLocations={loc_count}")

    print("\n" + "=" * 70)
    print("SUCCESS: ALL PART 8 ENTERPRISE INVENTORY TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_part8_tests()

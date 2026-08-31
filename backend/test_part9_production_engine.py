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

client = TestClient(app)

def run_part9_tests():
    print("=" * 70)
    print("RUNNING COMPREHENSIVE PART 9: PRODUCTION ENGINE AUTOMATED TESTS")
    print("=" * 70)

    token = None
    headers = {}
    test_run_id = uuid.uuid4().hex[:6].upper()
    dummy_uuid = str(uuid.uuid4())

    # -------------------------------------------------------------
    # [1] Unauthenticated Security Gatekeeping (401 Unauthorized)
    # -------------------------------------------------------------
    print("\n[1] Unauthenticated Security Gatekeeping (401 Unauthorized):")
    endpoints_to_test = [
        ("POST", "/api/v1/recipes/production/preview"),
        ("POST", "/api/v1/recipes/production/execute"),
        ("GET", "/api/v1/recipes/production/orders"),
        ("POST", "/api/v1/recipes/production/orders"),
        ("GET", f"/api/v1/recipes/production/orders/{dummy_uuid}"),
        ("POST", f"/api/v1/recipes/production/orders/{dummy_uuid}/check-sufficiency"),
        ("PUT", f"/api/v1/recipes/production/orders/{dummy_uuid}/status"),
        ("GET", f"/api/v1/recipes/production/orders/{dummy_uuid}/variance"),
        ("POST", f"/api/v1/recipes/production/orders/{dummy_uuid}/reverse"),
    ]
    for method, path in endpoints_to_test:
        if method == "GET":
            res = client.get(path)
        elif method == "POST":
            res = client.post(path, json={})
        elif method == "PUT":
            res = client.put(path, json={"status": "IN_PROGRESS"})
        assert res.status_code == 401, f"Expected 401 for {method} {path}, got {res.status_code}"
        print(f"  [PASS] {method} {path} blocked for unauthenticated requests (401)")

    # -------------------------------------------------------------
    # [2] Admin Authentication & Production Domain Foundation
    # -------------------------------------------------------------
    print("\n[2] Admin Authentication & Production Domain Foundation:")
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

    # Create Branch
    branch_payload = {
        "name": f"Apex Sweet Factory Hub #{test_run_id}",
        "code": f"SWEET-HUB-{test_run_id}",
        "type": "CENTRAL_KITCHEN",
        "email": f"sweethub-{test_run_id.lower()}@apexerp.internal",
        "phone": "+1-800-555-7799",
        "address": "789 Master Confectionery Way",
    }
    b_res = client.post("/api/v1/organization/branches", json=branch_payload, headers=headers)
    assert b_res.status_code == 201
    branch_id = b_res.json()["id"]

    # Create Kitchen Warehouse
    wh_payload = {
        "branch_id": branch_id,
        "name": f"Sweet Production Central Kitchen #{test_run_id}",
        "code": f"KITCHEN-SWEET-{test_run_id}",
        "is_central": True,
    }
    wh_res = client.post("/api/v1/organization/warehouses", json=wh_payload, headers=headers)
    assert wh_res.status_code == 201
    kitchen_wh_id = wh_res.json()["id"]

    # Create Category and Units
    cat_res = client.post("/api/v1/inventory/categories", json={"name": f"Desserts #{test_run_id}", "code": f"DESSERT-{test_run_id}"}, headers=headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    uom_kg_res = client.post("/api/v1/inventory/units", json={"name": f"Kilogram #{test_run_id}", "symbol": f"KG-{test_run_id}"}, headers=headers)
    assert uom_kg_res.status_code == 201
    uom_kg_id = uom_kg_res.json()["id"]

    uom_gm_res = client.post("/api/v1/inventory/units", json={"name": f"Gram #{test_run_id}", "symbol": f"GM-{test_run_id}"}, headers=headers)
    assert uom_gm_res.status_code == 201
    uom_gm_id = uom_gm_res.json()["id"]

    uom_box_res = client.post("/api/v1/inventory/units", json={"name": f"Box #{test_run_id}", "symbol": f"BOX-{test_run_id}"}, headers=headers)
    assert uom_box_res.status_code == 201
    uom_box_id = uom_box_res.json()["id"]

    # Create Raw Material Items: Dough Base, Sweet Syrup, Cardamom
    dough_res = client.post("/api/v1/inventory/items", json={
        "category_id": cat_id,
        "unit_id": uom_kg_id,
        "name": f"Gulab Jamun Dough Base #{test_run_id}",
        "code": f"SFG-DOUGH-{test_run_id}",
        "type": "SEMI_FINISHED",
        "cost_price": 60.00,
        "selling_price": 0.00,
    }, headers=headers)
    assert dough_res.status_code == 201
    dough_id = dough_res.json()["id"]

    syrup_res = client.post("/api/v1/inventory/items", json={
        "category_id": cat_id,
        "unit_id": uom_kg_id,
        "name": f"Rose Cardamom Sugar Syrup #{test_run_id}",
        "code": f"RAW-SYRUP-{test_run_id}",
        "type": "RAW_MATERIAL",
        "cost_price": 25.00,
        "selling_price": 0.00,
    }, headers=headers)
    assert syrup_res.status_code == 201
    syrup_id = syrup_res.json()["id"]

    cardamom_res = client.post("/api/v1/inventory/items", json={
        "category_id": cat_id,
        "unit_id": uom_gm_id,
        "name": f"Green Cardamom Powder #{test_run_id}",
        "code": f"RAW-CARDAMOM-{test_run_id}",
        "type": "RAW_MATERIAL",
        "cost_price": 2.50,
        "selling_price": 0.00,
    }, headers=headers)
    assert cardamom_res.status_code == 201
    cardamom_id = cardamom_res.json()["id"]

    # Create Finished Good Item: Gulab Jamun Master Box
    fg_item_res = client.post("/api/v1/inventory/items", json={
        "category_id": cat_id,
        "unit_id": uom_box_id,
        "name": f"Royal Gulab Jamun Box 1KG #{test_run_id}",
        "code": f"FG-GJ-BOX-{test_run_id}",
        "type": "FINISHED_GOOD",
        "cost_price": 0.00,
        "selling_price": 350.00,
    }, headers=headers)
    assert fg_item_res.status_code == 201
    fg_item_id = fg_item_res.json()["id"]

    # Create Master Recipe (Base Yield: 20 Boxes)
    # Standard batch requires: 10 KG Dough, 15 KG Syrup, 50 GM Cardamom
    recipe_payload = {
        "finished_item_id": fg_item_id,
        "name": f"Royal Gulab Jamun Master Formula #{test_run_id}",
        "code": f"RCP-GJ-MASTER-{test_run_id}",
        "description": "Standard production recipe for 20 master boxes",
        "yield_qty": 20.00,
        "preparation_minutes": 60,
        "instructions": "1. Knead dough base 2. Fry balls in pure ghee 3. Soak in warm syrup 4. Pack in 1KG boxes",
        "ingredients": [
            {"raw_item_id": dough_id, "unit_id": uom_kg_id, "quantity": 10.00},
            {"raw_item_id": syrup_id, "unit_id": uom_kg_id, "quantity": 15.00},
            {"raw_item_id": cardamom_id, "unit_id": uom_gm_id, "quantity": 50.00},
        ]
    }
    recipe_res = client.post("/api/v1/recipes", json=recipe_payload, headers=headers)
    assert recipe_res.status_code == 201
    recipe_id = recipe_res.json()["id"]
    print(f"  [PASS] Master Recipe Registered: {recipe_payload['name']} (Yield: 20 Boxes)")

    # -------------------------------------------------------------
    # [3] Pre-Production Availability Simulation & Strict Shortage Blocking
    # -------------------------------------------------------------
    print("\n[3] Pre-Production Availability Simulation & Strict Shortage Blocking:")
    # Current stock in Kitchen Warehouse is 0 for all ingredients
    preview_req = {
        "recipe_id": recipe_id,
        "planned_qty": 40.00,  # 2x batch (Requires 20 KG Dough, 30 KG Syrup, 100 GM Cardamom)
        "kitchen_warehouse_id": kitchen_wh_id,
    }
    preview_res = client.post("/api/v1/recipes/production/preview", json=preview_req, headers=headers)
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["all_ingredients_available"] is False
    assert Decimal(str(preview_data["planned_qty"])) == Decimal("40.0000")
    assert Decimal(str(preview_data["multiplier"])) == Decimal("2.0000")
    print(f"  [PASS] POST /recipes/production/preview correctly detected shortage: all_ingredients_available = False")

    # Verify line item shortages in preview
    for ing_prev in preview_data["ingredients"]:
        assert ing_prev["is_sufficient"] is False
        assert Decimal(str(ing_prev["shortage_qty"])) > Decimal("0.0000")
        print(f"    - {ing_prev['item_name']}: Required={ing_prev['required_qty']}, Available={ing_prev['available_qty']}, Shortage={ing_prev['shortage_qty']}")

    # Attempt direct execution with shortage -> MUST BE BLOCKED (400 Bad Request)
    direct_exec_req = {
        "branch_id": branch_id,
        "kitchen_warehouse_id": kitchen_wh_id,
        "recipe_id": recipe_id,
        "planned_qty": 40.00,
        "actual_yield_qty": 40.00,
        "notes": "Direct batch run without stock",
    }
    block_exec_res = client.post("/api/v1/recipes/production/execute", json=direct_exec_req, headers=headers)
    assert block_exec_res.status_code == 400
    assert "Production blocked" in block_exec_res.json()["detail"]
    print(f"  [PASS] POST /recipes/production/execute strictly blocked execution: {block_exec_res.json()['detail']}")

    # Create Draft Order and attempt transition to IN_PROGRESS -> MUST BE BLOCKED (400 Bad Request)
    draft_order_res = client.post("/api/v1/recipes/production/orders", json={
        "branch_id": branch_id,
        "kitchen_warehouse_id": kitchen_wh_id,
        "recipe_id": recipe_id,
        "planned_qty": 40.00,
        "notes": "Draft Order for Morning Sweet Run",
    }, headers=headers)
    assert draft_order_res.status_code == 201
    draft_order_id = draft_order_res.json()["id"]

    # Check sufficiency endpoint
    suff_res = client.post(f"/api/v1/recipes/production/orders/{draft_order_id}/check-sufficiency", headers=headers)
    assert suff_res.status_code == 200
    assert suff_res.json()["is_all_ingredients_sufficient"] is False
    assert suff_res.json()["can_start_production"] is False

    # Attempt PUT status to IN_PROGRESS with shortage
    block_start_res = client.put(f"/api/v1/recipes/production/orders/{draft_order_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
    assert block_start_res.status_code == 400
    assert "Production blocked" in block_start_res.json()["detail"]
    print(f"  [PASS] PUT /recipes/production/orders/{{id}}/status strictly blocked start on shortage")

    # -------------------------------------------------------------
    # [4] Raw Material Replenishment & Direct Production Execution
    # -------------------------------------------------------------
    print("\n[4] Raw Material Replenishment & Direct Production Execution:")
    # Replenish stock in Kitchen Warehouse:
    # Dough: 100 KG, Syrup: 100 KG, Cardamom: 500 GM
    adj1 = client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id,
        "item_id": dough_id,
        "change_qty": 100.00,
        "reason": "Production prep replenishment",
    }, headers=headers)
    assert adj1.status_code == 200

    adj2 = client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id,
        "item_id": syrup_id,
        "change_qty": 100.00,
        "reason": "Production prep replenishment",
    }, headers=headers)
    assert adj2.status_code == 200

    adj3 = client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id,
        "item_id": cardamom_id,
        "change_qty": 500.00,
        "reason": "Production prep replenishment",
    }, headers=headers)
    assert adj3.status_code == 200
    print("  [PASS] Kitchen Warehouse replenished with raw ingredients")

    # Verify Preview is now fully available
    preview_post_res = client.post("/api/v1/recipes/production/preview", json=preview_req, headers=headers)
    assert preview_post_res.status_code == 200
    assert preview_post_res.json()["all_ingredients_available"] is True
    print(f"  [PASS] Preview confirmed all ingredients available: EstTotalCost=${preview_post_res.json()['total_estimated_raw_cost']}, EstUnitCost=${preview_post_res.json()['estimated_unit_food_cost']}")

    # Execute direct production order:
    # Planned: 40 Boxes, Actual Yield: 38 Boxes, Wastage: 2 Boxes
    exp_dt = datetime.utcnow() + timedelta(days=30)
    exec_payload = {
        "branch_id": branch_id,
        "kitchen_warehouse_id": kitchen_wh_id,
        "recipe_id": recipe_id,
        "planned_qty": 40.00,
        "actual_yield_qty": 38.00,
        "wastage_qty": 2.00,
        "batch_number": f"BATCH-GJ-{test_run_id}",
        "mfg_date": datetime.utcnow().isoformat(),
        "expiry_date": exp_dt.isoformat(),
        "notes": "Morning Fresh Batch #01",
    }
    exec_res = client.post("/api/v1/recipes/production/execute", json=exec_payload, headers=headers)
    assert exec_res.status_code == 201
    exec_data = exec_res.json()
    exec_order_id = exec_data["id"]

    assert exec_data["status"] == "COMPLETED"
    assert Decimal(str(exec_data["planned_qty"])) == Decimal("40.0000")
    assert Decimal(str(exec_data["actual_yield_qty"])) == Decimal("38.0000")
    assert Decimal(str(exec_data["wastage_qty"])) == Decimal("2.0000")
    assert Decimal(str(exec_data["total_raw_cost"])) > Decimal("0.0000")
    assert Decimal(str(exec_data["unit_food_cost"])) > Decimal("0.0000")
    print(f"  [PASS] POST /recipes/production/execute executed order: #{exec_data['order_number']} (Yield: 38 Boxes, UnitCost: ${exec_data['unit_food_cost']})")

    # -------------------------------------------------------------
    # [5] Finished Goods Stock, Batch Generation & Item Cost Sync
    # -------------------------------------------------------------
    print("\n[5] Finished Goods Stock, Batch Generation & Item Cost Sync:")
    # Verify Finished Good StockBalance in Kitchen Warehouse is 38
    fg_bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={fg_item_id}", headers=headers)
    assert fg_bal_res.status_code == 200
    assert len(fg_bal_res.json()) >= 1
    assert Decimal(str(fg_bal_res.json()[0]["quantity"])) == Decimal("38.0000")
    print("  [PASS] Finished Good StockBalance in kitchen warehouse incremented to 38.0000 Boxes")

    # Verify Finished Good StockBatch was generated
    batches_res = client.get(f"/api/v1/inventory/batches?warehouse_id={kitchen_wh_id}&item_id={fg_item_id}", headers=headers)
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert any(b["batch_number"] == f"BATCH-GJ-{test_run_id}" for b in batches)
    batch_obj = next(b for b in batches if b["batch_number"] == f"BATCH-GJ-{test_run_id}")
    assert Decimal(str(batch_obj["quantity"])) == Decimal("38.0000")
    assert batch_obj["is_active"] is True
    print(f"  [PASS] StockBatch created: {batch_obj['batch_number']} (Qty: 38.0000, UnitCost: ${batch_obj['unit_cost']})")

    # Verify Item cost price is synchronized with unit_food_cost
    fg_item_check = client.get(f"/api/v1/inventory/items/{fg_item_id}", headers=headers)
    assert fg_item_check.status_code == 200
    assert Decimal(str(fg_item_check.json()["cost_price"])) == Decimal(str(exec_data["unit_food_cost"]))
    print(f"  [PASS] Finished Good Item costPrice synchronized: ${fg_item_check.json()['cost_price']}")

    # -------------------------------------------------------------
    # [6] Raw Material Deduction & Immutable Stock Ledger Audit
    # -------------------------------------------------------------
    print("\n[6] Raw Material Deduction & Immutable Stock Ledger Audit:")
    # Initial: Dough = 100 -> Deducted 20 -> Balance = 80
    dough_bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={dough_id}", headers=headers)
    assert dough_bal_res.status_code == 200
    assert Decimal(str(dough_bal_res.json()[0]["quantity"])) == Decimal("80.0000")

    # Initial: Syrup = 100 -> Deducted 30 -> Balance = 70
    syrup_bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={syrup_id}", headers=headers)
    assert syrup_bal_res.status_code == 200
    assert Decimal(str(syrup_bal_res.json()[0]["quantity"])) == Decimal("70.0000")

    # Initial: Cardamom = 500 -> Deducted 100 -> Balance = 400
    card_bal_res = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={cardamom_id}", headers=headers)
    assert card_bal_res.status_code == 200
    assert Decimal(str(card_bal_res.json()[0]["quantity"])) == Decimal("400.0000")
    print("  [PASS] All raw material inventory balances deducted by standard batch multipliers")

    # Verify Stock Ledger entries
    ledger_res = client.get(f"/api/v1/inventory/stock-ledger?warehouse_id={kitchen_wh_id}", headers=headers)
    assert ledger_res.status_code == 200
    ledgers = ledger_res.json()
    order_ledgers = [l for l in ledgers if l.get("reference_id") == exec_order_id]
    assert len(order_ledgers) >= 4  # 3 PRODUCTION_OUT + 1 PRODUCTION_IN

    prod_outs = [l for l in order_ledgers if l["movement_type"] == "PRODUCTION_OUT"]
    prod_ins = [l for l in order_ledgers if l["movement_type"] == "PRODUCTION_IN"]
    assert len(prod_outs) == 3
    assert len(prod_ins) == 1
    print(f"  [PASS] Double-entry Stock Ledger generated: {len(prod_outs)} PRODUCTION_OUT and {len(prod_ins)} PRODUCTION_IN entries")

    # -------------------------------------------------------------
    # [7] Production Yield & Raw Material Variance Analysis
    # -------------------------------------------------------------
    print("\n[7] Production Yield & Raw Material Variance Analysis:")
    var_res = client.get(f"/api/v1/recipes/production/orders/{exec_order_id}/variance", headers=headers)
    assert var_res.status_code == 200
    var_data = var_res.json()

    assert Decimal(str(var_data["planned_qty"])) == Decimal("40.0000")
    assert Decimal(str(var_data["actual_yield_qty"])) == Decimal("38.0000")
    assert Decimal(str(var_data["yield_variance_qty"])) == Decimal("-2.0000")
    assert Decimal(str(var_data["yield_variance_percent"])) == Decimal("-5.00")
    assert len(var_data["ingredient_variances"]) == 3
    print(f"  [PASS] Yield Variance: Qty={var_data['yield_variance_qty']} Boxes, Percent={var_data['yield_variance_percent']}%")
    print(f"  [PASS] Total Cost: Standard=${var_data['total_standard_cost']}, Actual=${var_data['total_actual_cost']}")

    # -------------------------------------------------------------
    # [8] Production Order Reversal & Inventory Rollback
    # -------------------------------------------------------------
    print("\n[8] Production Order Reversal & Inventory Rollback:")
    # Reversal of the completed production order:
    # 1. Deducts 38 Boxes of Finished Goods
    # 2. Restores 20 KG Dough, 30 KG Syrup, 100 GM Cardamom
    # 3. Marks order CANCELLED
    rev_payload = {"reason": "Quality check failed: Sugar crystallization issue"}
    rev_res = client.post(f"/api/v1/recipes/production/orders/{exec_order_id}/reverse", json=rev_payload, headers=headers)
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["status"] == "CANCELLED"
    assert "REVERSED" in rev_data["notes"]
    print(f"  [PASS] POST /recipes/production/orders/{{id}}/reverse rolled back order #{rev_data['order_number']}")

    # Verify Finished Good StockBalance is reduced back to 0
    fg_bal_after = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={fg_item_id}", headers=headers)
    assert fg_bal_after.status_code == 200
    assert Decimal(str(fg_bal_after.json()[0]["quantity"])) == Decimal("0.0000")
    print("  [PASS] Finished Good stock reversed to 0.0000 Boxes")

    # Verify Raw Material StockBalances restored to initial 100 KG, 100 KG, 500 GM
    dough_restored = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={dough_id}", headers=headers)
    assert Decimal(str(dough_restored.json()[0]["quantity"])) == Decimal("100.0000")

    syrup_restored = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={syrup_id}", headers=headers)
    assert Decimal(str(syrup_restored.json()[0]["quantity"])) == Decimal("100.0000")

    card_restored = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={cardamom_id}", headers=headers)
    assert Decimal(str(card_restored.json()[0]["quantity"])) == Decimal("500.0000")
    print("  [PASS] Raw material stock balances completely restored (100 KG Dough, 100 KG Syrup, 500 GM Cardamom)")

    # -------------------------------------------------------------
    # [9] Live Neon PostgreSQL Persistence & Zero Data Loss
    # -------------------------------------------------------------
    print("\n[9] Live Neon PostgreSQL Persistence & Zero Data Loss:")
    db = SessionLocal()
    u_count = db.execute(text("SELECT count(*) FROM users")).scalar()
    r_count = db.execute(text("SELECT count(*) FROM roles")).scalar()
    b_count = db.execute(text("SELECT count(*) FROM branches")).scalar()
    st_count = db.execute(text("SELECT count(*) FROM staff")).scalar()
    rec_count = db.execute(text("SELECT count(*) FROM recipes")).scalar()
    po_count = db.execute(text("SELECT count(*) FROM production_orders")).scalar()
    pc_count = db.execute(text("SELECT count(*) FROM production_consumptions")).scalar()
    batch_count = db.execute(text("SELECT count(*) FROM stock_batches")).scalar()
    loc_count = db.execute(text("SELECT count(*) FROM store_locations")).scalar()
    db.close()

    assert u_count >= 1, "User records lost"
    assert r_count >= 3, "Role records lost"
    assert b_count >= 1, "Branch records lost"
    assert st_count >= 1, "Staff records lost"
    assert rec_count >= 1, "Recipe records lost"
    assert po_count >= 2, "Production orders not persisted"
    assert pc_count >= 3, "Production consumptions not persisted"
    assert batch_count >= 1, "Stock batches not persisted"

    print(f"  [PASS] Zero Data Loss: Users={u_count}, Roles={r_count}, Branches={b_count}, Staff={st_count}, Recipes={rec_count}")
    print(f"  [PASS] Part 9 Persistence: ProductionOrders={po_count}, Consumptions={pc_count}, StockBatches={batch_count}")

    print("\n" + "=" * 70)
    print("SUCCESS: ALL PART 9 PRODUCTION ENGINE TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_part9_tests()

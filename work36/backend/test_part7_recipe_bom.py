import sys
import uuid
from decimal import Decimal
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.core.database import SessionLocal, engine

client = TestClient(app)
passed_assertions = 0
failed_assertions = 0

def check(description: str, condition: bool, details: str = ""):
    global passed_assertions, failed_assertions
    if condition:
        passed_assertions += 1
        print(f"  [PASS] {description}")
    else:
        failed_assertions += 1
        print(f"  [FAIL] {description} {details}")

def run_tests():
    global passed_assertions, failed_assertions
    print("=" * 70)
    print("RUNNING PART 7: RECIPE / BOM ENGINE AUTOMATED TEST SUITE")
    print("=" * 70)

    # -------------------------------------------------------------
    # [1] Security & Route Protection (401 Gatekeeping)
    # -------------------------------------------------------------
    print("\n[1] Security & Authentication Gatekeeping (401 Unauthorized):")
    res1 = client.get("/api/v1/recipes")
    check("GET /recipes requires authentication (401)", res1.status_code == 401)

    res2 = client.post("/api/v1/recipes", json={})
    check("POST /recipes requires authentication (401)", res2.status_code == 401)

    res3 = client.get(f"/api/v1/recipes/{uuid.uuid4()}")
    check("GET /recipes/{id} requires authentication (401)", res3.status_code == 401)

    res4 = client.post(f"/api/v1/recipes/{uuid.uuid4()}/clone")
    check("POST /recipes/{id}/clone requires authentication (401)", res4.status_code == 401)

    res5 = client.get(f"/api/v1/recipes/{uuid.uuid4()}/costing")
    check("GET /recipes/{id}/costing requires authentication (401)", res5.status_code == 401)

    res6 = client.post(f"/api/v1/recipes/{uuid.uuid4()}/explode", json={"target_yield_qty": 10})
    check("POST /recipes/{id}/explode requires authentication (401)", res6.status_code == 401)

    res7 = client.get("/api/v1/recipes/production/orders")
    check("GET /recipes/production/orders requires authentication (401)", res7.status_code == 401)

    res8 = client.post("/api/v1/recipes/production/orders", json={})
    check("POST /recipes/production/orders requires authentication (401)", res8.status_code == 401)

    res9 = client.put(f"/api/v1/recipes/production/orders/{uuid.uuid4()}/status", json={"status": "IN_PROGRESS"})
    check("PUT /recipes/production/orders/{id}/status requires authentication (401)", res9.status_code == 401)

    # -------------------------------------------------------------
    # [2] Admin Authentication
    # -------------------------------------------------------------
    print("\n[2] Admin Login & JWT Bearer Token Retrieval:")
    login_res = client.post("/api/v1/auth/login", json={"email": "admin", "password": "admin123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/google", json={"id_token": "valid_token_admin_123"})
    check("Admin login successful (200)", login_res.status_code == 200)
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    check("Access token retrieved", token is not None and len(token) > 20)

    # -------------------------------------------------------------
    # [3] Master Domain Foundation (Branch, Warehouse, Units, Items)
    # -------------------------------------------------------------
    print("\n[3] Master Domain Setup (Branch, Kitchen Warehouse, UOM & Items):")
    unique_suffix = uuid.uuid4().hex[:6].upper()

    # Create Branch
    branch_res = client.post("/api/v1/organization/branches", json={
        "name": f"Royal Kitchen Outlet {unique_suffix}",
        "code": f"BR-RKO-{unique_suffix}",
        "type": "RESTAURANT",
    }, headers=headers)
    check("Test Kitchen Branch created (201)", branch_res.status_code == 201)
    branch_id = branch_res.json()["id"]

    # Create Kitchen Warehouse
    wh_res = client.post("/api/v1/organization/warehouses", json={
        "branch_id": branch_id,
        "name": f"Central Pastry Kitchen WH {unique_suffix}",
        "code": f"WH-KITCHEN-{unique_suffix}",
        "is_central": False,
    }, headers=headers)
    check("Kitchen Warehouse created (201)", wh_res.status_code == 201)
    kitchen_wh_id = wh_res.json()["id"]

    # Create UOMs
    uom_kg = client.post("/api/v1/inventory/units", json={"name": f"Kilogram {unique_suffix}", "symbol": f"kg-{unique_suffix}"}, headers=headers).json()
    uom_l = client.post("/api/v1/inventory/units", json={"name": f"Liter {unique_suffix}", "symbol": f"L-{unique_suffix}"}, headers=headers).json()
    uom_pcs = client.post("/api/v1/inventory/units", json={"name": f"Portion {unique_suffix}", "symbol": f"platter-{unique_suffix}"}, headers=headers).json()
    check("UOMs (kg, l, portion) registered", uom_kg.get("id") is not None and uom_l.get("id") is not None)

    # Create Category
    cat = client.post("/api/v1/inventory/categories", json={
        "name": f"Desserts & Sweets {unique_suffix}",
        "code": f"CAT-SWT-{unique_suffix}",
    }, headers=headers).json()

    # Create Raw Materials
    item_maida = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Maida Flour {unique_suffix}", "code": f"RAW-FLOUR-{unique_suffix}",
        "type": "RAW_MATERIAL", "cost_price": 35.0000,
    }, headers=headers).json()

    item_khoya = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Khoya Mawa {unique_suffix}", "code": f"RAW-KHOYA-{unique_suffix}",
        "type": "RAW_MATERIAL", "cost_price": 320.0000,
    }, headers=headers).json()

    item_ghee = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Pure Desi Ghee {unique_suffix}", "code": f"RAW-GHEE-{unique_suffix}",
        "type": "RAW_MATERIAL", "cost_price": 550.0000,
    }, headers=headers).json()

    item_sugar = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Refined Sugar {unique_suffix}", "code": f"RAW-SUGAR-{unique_suffix}",
        "type": "RAW_MATERIAL", "cost_price": 42.0000,
    }, headers=headers).json()

    item_oil = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_l["id"],
        "name": f"Frying Oil {unique_suffix}", "code": f"RAW-OIL-{unique_suffix}",
        "type": "RAW_MATERIAL", "cost_price": 120.0000,
    }, headers=headers).json()

    # Create Semi-Finished Goods (Sub-Recipes)
    item_dough = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Gulab Jamun Dough Base {unique_suffix}", "code": f"SEMI-DOUGH-{unique_suffix}",
        "type": "SEMI_FINISHED", "cost_price": 0.0000,
    }, headers=headers).json()

    item_syrup = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_kg["id"],
        "name": f"Scented Sugar Syrup {unique_suffix}", "code": f"SEMI-SYRUP-{unique_suffix}",
        "type": "SEMI_FINISHED", "cost_price": 0.0000,
    }, headers=headers).json()

    # Create Finished Good
    item_platter = client.post("/api/v1/inventory/items", json={
        "category_id": cat["id"], "unit_id": uom_pcs["id"],
        "name": f"Royal Gulab Jamun Platter {unique_suffix}", "code": f"FG-GJAMUN-{unique_suffix}",
        "type": "FINISHED_GOOD", "cost_price": 0.0000, "selling_price": 250.0000,
    }, headers=headers).json()

    check("Raw material items created", item_maida.get("id") is not None and item_khoya.get("id") is not None)
    check("Semi-finished items created", item_dough.get("id") is not None and item_syrup.get("id") is not None)
    check("Finished good item created", item_platter.get("id") is not None)

    # -------------------------------------------------------------
    # [4] Sub-Recipe & Multi-Level BOM Definition
    # -------------------------------------------------------------
    print("\n[4] Multi-Level BOM / Sub-Recipe Creation & Validation:")

    # 1. Sub-Recipe 1: Dough Base
    dough_rec_res = client.post("/api/v1/recipes", json={
        "finished_item_id": item_dough["id"],
        "name": f"Dough Base Recipe {unique_suffix}",
        "code": f"REC-DOUGH-{unique_suffix}",
        "yield_qty": 1.0000,
        "preparation_minutes": 20,
        "instructions": "Mix maida, khoya and ghee until soft dough forms",
        "ingredients": [
            {"raw_item_id": item_maida["id"], "quantity": 0.2000, "notes": "Fine refined flour"},
            {"raw_item_id": item_khoya["id"], "quantity": 0.8000, "notes": "Fresh unsweetened khoya"},
            {"raw_item_id": item_ghee["id"], "quantity": 0.0500, "notes": "Desi ghee for softness"},
        ]
    }, headers=headers)
    check("Sub-Recipe 1 (Dough Base) created (201)", dough_rec_res.status_code == 201)
    dough_rec = dough_rec_res.json()
    # Expected Dough Cost: (0.2*35) + (0.8*320) + (0.05*550) = 7 + 256 + 27.5 = 290.50
    check("Dough Base total cost is ~290.50", abs(Decimal(str(dough_rec["total_recipe_cost"])) - Decimal("290.50")) < Decimal("0.01"))
    check("Dough Base unit cost is ~290.50/kg", abs(Decimal(str(dough_rec["unit_cost"])) - Decimal("290.50")) < Decimal("0.01"))

    # 2. Sub-Recipe 2: Sugar Syrup
    syrup_rec_res = client.post("/api/v1/recipes", json={
        "finished_item_id": item_syrup["id"],
        "name": f"Sugar Syrup Recipe {unique_suffix}",
        "code": f"REC-SYRUP-{unique_suffix}",
        "yield_qty": 1.5000,
        "preparation_minutes": 15,
        "instructions": "Boil sugar with water to single string consistency",
        "ingredients": [
            {"raw_item_id": item_sugar["id"], "quantity": 1.0000, "notes": "Sugar"},
        ]
    }, headers=headers)
    check("Sub-Recipe 2 (Sugar Syrup) created (201)", syrup_rec_res.status_code == 201)
    syrup_rec = syrup_rec_res.json()
    # Expected Syrup Cost: (1.0*42) = 42.00 / 1.5 yield = 28.00/kg
    check("Sugar Syrup total cost is 42.00", abs(Decimal(str(syrup_rec["total_recipe_cost"])) - Decimal("42.00")) < Decimal("0.01"))
    check("Sugar Syrup unit cost is 28.00/kg", abs(Decimal(str(syrup_rec["unit_cost"])) - Decimal("28.00")) < Decimal("0.01"))

    # 3. Master Recipe: Royal Gulab Jamun Platter
    master_rec_res = client.post("/api/v1/recipes", json={
        "finished_item_id": item_platter["id"],
        "name": f"Royal Gulab Jamun Platter Recipe {unique_suffix}",
        "code": f"REC-GJAMUN-{unique_suffix}",
        "yield_qty": 2.0000, # Yields 2 platters
        "preparation_minutes": 45,
        "instructions": "Fry dough balls and soak in hot sugar syrup",
        "ingredients": [
            {"raw_item_id": item_dough["id"], "quantity": 0.4000, "notes": "Sub-recipe dough"},
            {"raw_item_id": item_syrup["id"], "quantity": 0.5000, "notes": "Sub-recipe syrup"},
            {"raw_item_id": item_oil["id"], "quantity": 0.1000, "notes": "Frying oil absorption"},
        ]
    }, headers=headers)
    check("Master Finished Good Recipe created (201)", master_rec_res.status_code == 201)
    master_rec = master_rec_res.json()
    master_rec_id = master_rec["id"]

    # Expected Master Cost:
    # Dough: 0.4 * 290.50 = 116.20
    # Syrup: 0.5 * 28.00 = 14.00
    # Oil: 0.1 * 120.00 = 12.00
    # Total = 116.20 + 14.00 + 12.00 = 142.20
    # Unit Cost (per platter, yield=2): 142.20 / 2 = 71.10
    check("Recursive Sub-recipe Cost Rollup total is ~142.20", abs(Decimal(str(master_rec["total_recipe_cost"])) - Decimal("142.20")) < Decimal("0.01"))
    check("Master Recipe unit food cost per platter is ~71.10", abs(Decimal(str(master_rec["unit_cost"])) - Decimal("71.10")) < Decimal("0.01"))

    # -------------------------------------------------------------
    # [5] Recipe Costing & Food Cost % Simulation
    # -------------------------------------------------------------
    print("\n[5] Recipe Costing & Theoretical Food Cost Engine:")
    costing_res = client.get(
        f"/api/v1/recipes/{master_rec_id}/costing?wastage_percent=5.0&packaging_percent=2.0&overhead_percent=3.0",
        headers=headers,
    )
    check("GET /recipes/{id}/costing returns 200 OK", costing_res.status_code == 200)
    costing = costing_res.json()

    # Raw: 142.20
    # Wastage (5%): 7.11
    # Packaging (2%): 2.844
    # Overhead (3%): 4.266
    # Total Batch Cost = 142.20 + 7.11 + 2.844 + 4.266 = 156.42
    # Unit Recipe Cost (yield=2) = 156.42 / 2 = 78.21
    # Selling Price = 250.00
    # Theoretical Food Cost % = (78.21 / 250.00) * 100 = 31.28%
    # Gross Margin % = 100 - 31.28 = 68.72%
    check("Ingredient raw cost matches (142.20)", abs(Decimal(str(costing["ingredient_raw_cost"])) - Decimal("142.20")) < Decimal("0.01"))
    check("Wastage cost computed correctly (7.11)", abs(Decimal(str(costing["expected_wastage_cost"])) - Decimal("7.11")) < Decimal("0.01"))
    check("Packaging cost computed correctly (2.844)", abs(Decimal(str(costing["packaging_cost"])) - Decimal("2.844")) < Decimal("0.01"))
    check("Overhead cost computed correctly (4.266)", abs(Decimal(str(costing["production_overhead_cost"])) - Decimal("4.266")) < Decimal("0.01"))
    check("Total batch cost computed (~156.42)", abs(Decimal(str(costing["total_batch_cost"])) - Decimal("156.42")) < Decimal("0.05"))
    check("Unit recipe cost per platter (~78.21)", abs(Decimal(str(costing["unit_recipe_cost"])) - Decimal("78.21")) < Decimal("0.05"))
    check("Theoretical food cost % is ~31.28%", abs(Decimal(str(costing["theoretical_food_cost_percentage"])) - Decimal("31.28")) < Decimal("0.1"))
    check("Theoretical gross margin % is ~68.72%", abs(Decimal(str(costing["gross_margin_percentage"])) - Decimal("68.72")) < Decimal("0.1"))

    # -------------------------------------------------------------
    # [6] Recipe Versioning / Cloning
    # -------------------------------------------------------------
    print("\n[6] Recipe Versioning & Cloning:")
    clone_code = f"REC-GJAMUN-V2-{unique_suffix}"
    clone_res = client.post(
        f"/api/v1/recipes/{master_rec_id}/clone?new_version_code={clone_code}&new_version_name=Royal+Gulab+Jamun+V2",
        headers=headers,
    )
    check("Clone Recipe returns 201 Created", clone_res.status_code == 201)
    cloned_rec = clone_res.json()
    check("Cloned recipe has new version code", cloned_rec["code"] == clone_code)
    check("Cloned recipe has duplicate ingredients copied", len(cloned_rec["ingredients"]) == 3)
    check("Cloned recipe preserved total cost", abs(Decimal(str(cloned_rec["total_recipe_cost"])) - Decimal("142.20")) < Decimal("0.01"))

    # -------------------------------------------------------------
    # [7] Recipe BOM Explosion & Stock Sufficiency Engine
    # -------------------------------------------------------------
    print("\n[7] Recipe BOM Explosion & Warehouse Sufficiency Gate:")
    # Explode for 50 platters (multiplier = 25 since yield=2)
    explode_res = client.post(f"/api/v1/recipes/{master_rec_id}/explode", json={
        "target_yield_qty": 50.0000,
        "warehouse_id": kitchen_wh_id,
    }, headers=headers)
    check("POST /recipes/{id}/explode returns 200 OK", explode_res.status_code == 200)
    explosion = explode_res.json()
    check("Multiplier calculated correctly (25.0)", Decimal(str(explosion["multiplier"])) == Decimal("25.0"))
    check("Before stock intake: Sufficiency is False", explosion["is_all_ingredients_sufficient"] is False)

    # Check required quantities:
    # Dough: 0.4 * 25 = 10.0 kg
    # Syrup: 0.5 * 25 = 12.5 kg
    # Oil: 0.1 * 25 = 2.5 l
    ing_map = {i["raw_item_id"]: i for i in explosion["ingredients"]}
    check("Dough required qty is 10.0 kg", Decimal(str(ing_map[item_dough["id"]]["required_qty"])) == Decimal("10.0"))
    check("Syrup required qty is 12.5 kg", Decimal(str(ing_map[item_syrup["id"]]["required_qty"])) == Decimal("12.5"))
    check("Oil required qty is 2.5 l", Decimal(str(ing_map[item_oil["id"]]["required_qty"])) == Decimal("2.5"))

    # Direct stock intake to Kitchen Warehouse for ingredients
    client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id, "item_id": item_dough["id"],
        "change_qty": 20.0000, "movement_type": "GRN", "reason": "Stock prep for testing",
    }, headers=headers)
    client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id, "item_id": item_syrup["id"],
        "change_qty": 30.0000, "movement_type": "GRN", "reason": "Stock prep for testing",
    }, headers=headers)
    client.post("/api/v1/inventory/adjustments", json={
        "warehouse_id": kitchen_wh_id, "item_id": item_oil["id"],
        "change_qty": 10.0000, "movement_type": "GRN", "reason": "Stock prep for testing",
    }, headers=headers)

    # Re-explode after stock intake
    re_explode = client.post(f"/api/v1/recipes/{master_rec_id}/explode", json={
        "target_yield_qty": 50.0000,
        "warehouse_id": kitchen_wh_id,
    }, headers=headers).json()
    check("After stock intake: Sufficiency is True", re_explode["is_all_ingredients_sufficient"] is True)

    # -------------------------------------------------------------
    # [8] Production Order Lifecycle & Atomic Inventory Execution
    # -------------------------------------------------------------
    print("\n[8] Production Order Execution & Double-Entry Stock Movement:")

    # 1. Create Production Order for 10 platters (5 batches)
    po_res = client.post("/api/v1/recipes/production/orders", json={
        "branch_id": branch_id,
        "kitchen_warehouse_id": kitchen_wh_id,
        "recipe_id": master_rec_id,
        "planned_qty": 10.0000,
        "notes": f"Evening banquet production batch {unique_suffix}",
    }, headers=headers)
    check("POST /recipes/production/orders created order (201)", po_res.status_code == 201)
    po = po_res.json()
    po_id = po["id"]
    check("Production order initial status is 'DRAFT'", po["status"] == "DRAFT")
    check("Standard consumptions exploded (3 items)", len(po["consumptions"]) == 3)

    # 2. Check Order Sufficiency
    suff_res = client.post(f"/api/v1/recipes/production/orders/{po_id}/check-sufficiency", headers=headers)
    check("Check sufficiency endpoint returns 200 OK", suff_res.status_code == 200)
    suff_data = suff_res.json()
    check("Order sufficiency can_start_production is True", suff_data["can_start_production"] is True)

    # 3. Transition to IN_PROGRESS
    prog_res = client.put(f"/api/v1/recipes/production/orders/{po_id}/status", json={
        "status": "IN_PROGRESS",
    }, headers=headers)
    check("Transition to IN_PROGRESS successful (200)", prog_res.status_code == 200 and prog_res.json()["status"] == "IN_PROGRESS")

    # Record pre-completion stock levels
    pre_dough_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_dough['id']}", headers=headers).json()[0]["quantity"]
    pre_syrup_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_syrup['id']}", headers=headers).json()[0]["quantity"]
    pre_oil_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_oil['id']}", headers=headers).json()[0]["quantity"]

    # 4. Complete Production Order (Yield: 10 platters, Wastage: 0.5 platter)
    comp_res = client.put(f"/api/v1/recipes/production/orders/{po_id}/status", json={
        "status": "COMPLETED",
        "actual_yield_qty": 10.0000,
        "wastage_qty": 0.5000,
        "notes": "Completed with high kitchen quality score",
    }, headers=headers)
    check("Transition to COMPLETED successful (200)", comp_res.status_code == 200)
    comp_po = comp_res.json()
    check("Order status is 'COMPLETED'", comp_po["status"] == "COMPLETED")
    check("Completed date recorded", comp_po["completed_date"] is not None)

    # 5. Verify Automatic Stock Deduction (PRODUCTION_OUT) & Finished Good Addition (PRODUCTION_IN)
    post_dough_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_dough['id']}", headers=headers).json()[0]["quantity"]
    post_syrup_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_syrup['id']}", headers=headers).json()[0]["quantity"]
    post_oil_bal = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_oil['id']}", headers=headers).json()[0]["quantity"]
    fg_balances = client.get(f"/api/v1/inventory/stock-balances?warehouse_id={kitchen_wh_id}&item_id={item_platter['id']}", headers=headers).json()

    # For 10 platters (multiplier = 5):
    # Dough consumed: 0.4 * 5 = 2.0 kg -> (20 - 2 = 18.0)
    # Syrup consumed: 0.5 * 5 = 2.5 kg -> (30 - 2.5 = 27.5)
    # Oil consumed: 0.1 * 5 = 0.5 l -> (10 - 0.5 = 9.5)
    check("Raw Dough balance deducted by 2.0 kg", Decimal(str(pre_dough_bal)) - Decimal(str(post_dough_bal)) == Decimal("2.0"))
    check("Raw Syrup balance deducted by 2.5 kg", Decimal(str(pre_syrup_bal)) - Decimal(str(post_syrup_bal)) == Decimal("2.5"))
    check("Raw Oil balance deducted by 0.5 l", Decimal(str(pre_oil_bal)) - Decimal(str(post_oil_bal)) == Decimal("0.5"))
    check("Finished Good balance credited by 10 platters", len(fg_balances) > 0 and Decimal(str(fg_balances[0]["quantity"])) == Decimal("10.0"))

    # 6. Verify Double-Entry StockLedger Audit Entries
    ledger_res = client.get(f"/api/v1/inventory/stock-ledger?warehouse_id={kitchen_wh_id}", headers=headers)
    check("GET /inventory/stock-ledger returns 200 OK", ledger_res.status_code == 200)
    ledgers = ledger_res.json()
    prod_outs = [l for l in ledgers if l["movement_type"] == "PRODUCTION_OUT" and l["reference_id"] == po_id]
    prod_ins = [l for l in ledgers if l["movement_type"] == "PRODUCTION_IN" and l["reference_id"] == po_id]
    check("Stock Ledger contains 3 PRODUCTION_OUT entries for batch", len(prod_outs) == 3)
    check("Stock Ledger contains 1 PRODUCTION_IN entry for finished platter", len(prod_ins) == 1)

    # -------------------------------------------------------------
    # [9] Zero Data Loss & Database Integrity Verification
    # -------------------------------------------------------------
    print("\n[9] Zero Data Loss & Live Neon PostgreSQL Persistence:")
    with engine.connect() as conn:
        users_cnt = conn.execute(text("SELECT count(*) FROM users")).scalar()
        roles_cnt = conn.execute(text("SELECT count(*) FROM roles")).scalar()
        branches_cnt = conn.execute(text("SELECT count(*) FROM branches")).scalar()
        staff_cnt = conn.execute(text("SELECT count(*) FROM staff")).scalar()
        recipes_cnt = conn.execute(text("SELECT count(*) FROM recipes")).scalar()
        prod_cnt = conn.execute(text("SELECT count(*) FROM production_orders")).scalar()

        check("Zero Data Loss: User records intact", users_cnt >= 1)
        check("Zero Data Loss: Role records intact", roles_cnt >= 3)
        check("Zero Data Loss: Branch records intact", branches_cnt >= 1)
        check("Zero Data Loss: Staff records intact", staff_cnt >= 1)
        check("New Recipes persisted to Neon PostgreSQL", recipes_cnt >= 3)
        check("New Production Order persisted to Neon PostgreSQL", prod_cnt >= 1)

        print(f"      Final DB State: Users={users_cnt}, Roles={roles_cnt}, Branches={branches_cnt}, Staff={staff_cnt}, Recipes={recipes_cnt}, ProductionOrders={prod_cnt}")

    # -------------------------------------------------------------
    # Final Result
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    if failed_assertions == 0:
        print(f"SUCCESS: ALL {passed_assertions}/{passed_assertions} PART 7 RECIPE & BOM TESTS PASSED!")
    else:
        print(f"FAILURE: {failed_assertions} assertions failed ({passed_assertions} passed).")
    print("=" * 70)

    if failed_assertions > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()

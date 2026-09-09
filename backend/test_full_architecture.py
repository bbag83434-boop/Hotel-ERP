import os
import sys
import uuid
from decimal import Decimal
from datetime import datetime

from app.core.database import SessionLocal
from app.models.user import User
from app.models.organization import Company, Branch
from app.models.inventory import Item, ItemType, Unit, ItemRate
from app.models.procurement import Supplier, SupplierItem, PurchaseRequest, PurchaseRequestItem
from app.models.recipe import Recipe, RecipeItem

from app.schemas.inventory import ItemCreate, ItemUpdate
from app.schemas.recipe import RecipeCreate, RecipeItemCreate, RecipeUpdate
from app.schemas.procurement import PurchaseRequestCreate, PurchaseRequestItemCreate

from app.api.v1.endpoints.inventory import create_item, update_item, get_item_rate_history
from app.api.v1.endpoints.recipe import create_recipe, update_recipe, get_recipe_history
from app.api.v1.endpoints.procurement import create_purchase_request

def run_tests():
    db = SessionLocal()
    try:
        company = db.query(Company).first()
        user = db.query(User).filter(User.company_id == company.id).first()
        branch = db.query(Branch).filter(Branch.company_id == company.id).first()

        unit = db.query(Unit).filter(Unit.company_id == company.id).first()
        if not unit:
            unit = Unit(company_id=company.id, name="Kilogram", symbol="KG")
            db.add(unit)
            db.flush()

        rnd = uuid.uuid4().hex[:6]
        print(f"\n--- [TEST START] Run ID: {rnd} ---")

        # 1. Create Rice item at rate 50
        print("\n[RATE TEST] 1. Create Item at Rs.50")
        item_in = ItemCreate(
            category_id=db.query(Item).first().category_id if db.query(Item).first() else None,
            unit_id=unit.id,
            name=f"Rice_{rnd}",
            code=f"RICE_{rnd}",
            type="RAW_MATERIAL",
            cost_price=Decimal("50.00"),
        )
        # Note: If category doesn't exist, we might fail, so let's fetch any category or create one
        from app.models.inventory import Category
        cat = db.query(Category).first()
        if not cat:
            cat = Category(company_id=company.id, name="Test Cat", code=f"CAT_{rnd}")
            db.add(cat)
            db.flush()
        item_in.category_id = cat.id

        item_res = create_item(item_in, db, user)
        rice_id = item_res.id
        print(f"Created Item: {item_res.name} | Rate: Rs.{item_res.cost_price}")

        # 2. Create transaction at 50
        print("\n[RATE TEST] 2. Create Transaction (Purchase Request 1) at Rs.50")
        pr_in_1 = PurchaseRequestCreate(
            branch_id=branch.id,
            requisition_type="MAIN_KITCHEN",
            items=[PurchaseRequestItemCreate(item_id=rice_id, requested_qty=Decimal("10.00"))]
        )
        pr_1 = create_purchase_request(pr_in_1, db, user)
        pr_1_item = pr_1.items[0]
        print(f"Transaction 1 -> Qty: {pr_1_item.requested_qty}, Rate: Rs.{pr_1_item.estimated_price}, Total: Rs.{pr_1_item.requested_qty * pr_1_item.estimated_price}")
        assert pr_1_item.estimated_price == Decimal("50.00"), "Transaction 1 must have rate 50"

        # 3. Create new rate at 55
        print("\n[RATE TEST] 3. Update Item Rate to Rs.55")
        item_update = ItemUpdate(cost_price=Decimal("55.00"))
        updated_item = update_item(rice_id, item_update, db, user)
        print(f"Updated Item Rate: Rs.{updated_item.cost_price}")

        # 4. Create transaction at 55
        print("\n[RATE TEST] 4. Create Transaction (Purchase Request 2) at Rs.55")
        pr_in_2 = PurchaseRequestCreate(
            branch_id=branch.id,
            requisition_type="MAIN_KITCHEN",
            items=[PurchaseRequestItemCreate(item_id=rice_id, requested_qty=Decimal("10.00"))]
        )
        pr_2 = create_purchase_request(pr_in_2, db, user)
        pr_2_item = pr_2.items[0]
        print(f"Transaction 2 -> Qty: {pr_2_item.requested_qty}, Rate: Rs.{pr_2_item.estimated_price}, Total: Rs.{pr_2_item.requested_qty * pr_2_item.estimated_price}")
        assert pr_2_item.estimated_price == Decimal("55.00"), "Transaction 2 must have rate 55"

        # 5. Check old transaction
        print("\n[RATE TEST] 5. Verify Old Transaction remains Rs.50")
        pr_1_item_db = db.query(PurchaseRequestItem).filter(PurchaseRequestItem.id == pr_1_item.id).first()
        print(f"DB Transaction 1 Rate: Rs.{pr_1_item_db.estimated_price}")
        assert pr_1_item_db.estimated_price == Decimal("50.00"), "Old transaction mutated! FAULT."

        # 6. Check Rate History Endpoint
        print("\n[RATE TEST] 6. Verify Rate History")
        history = get_item_rate_history(rice_id, db, user)
        for h in history:
            print(f"History Record: Rate Rs.{h['rate']} | Active: {h['is_active']} | From: {h['effective_from']} | To: {h['effective_to']}")
        assert len(history) == 2, "Must have exactly 2 history records"

        # --- RECIPE TESTING ---
        print("\n=============================================")
        
        # 1. Create Recipe V1
        print("\n[RECIPE TEST] 1. Create Recipe V1")
        biryani = Item(company_id=company.id, category_id=cat.id, unit_id=unit.id, name=f"Biryani_{rnd}", code=f"BIR_{rnd}", type=ItemType.SEMI_FINISHED)
        db.add(biryani)
        db.flush()

        recipe_in = RecipeCreate(
            finished_item_id=biryani.id,
            name=f"Recipe_{rnd}",
            code=f"REC_{rnd}",
            yield_qty=Decimal("1.00"),
            ingredients=[RecipeItemCreate(raw_item_id=rice_id, unit_id=unit.id, quantity=Decimal("2.4"))]
        )
        recipe_v1 = create_recipe(recipe_in, db, user)
        print(f"Recipe V1 Created. Current Version: {recipe_v1.version}, Cost: Rs.{recipe_v1.total_recipe_cost}")
        # Rate is 55. 55 * 2.4 = 132
        assert recipe_v1.total_recipe_cost == Decimal("132.0000"), f"Expected 132, got {recipe_v1.total_recipe_cost}"
        
        # 2. Change Ingredient Item Rate (55 -> 60)
        print("\n[RECIPE TEST] 2. Change Ingredient Rate Rs.55 -> Rs.60")
        update_item(rice_id, ItemUpdate(cost_price=Decimal("60.00")), db, user)
        
        # 3. Verify Recipe V1 remains unchanged
        db.expire_all()
        r1_check = db.query(Recipe).filter(Recipe.id == recipe_v1.id).first()
        print(f"Recipe V1 Cost after Rate Change: Rs.{r1_check.total_recipe_cost}")
        assert r1_check.total_recipe_cost == Decimal("132.0000"), "Recipe V1 cost auto-mutated! FAULT."

        # 4. Manually edit/recalculate
        print("\n[RECIPE TEST] 4. Manually Edit/Recalculate Recipe (Create V2)")
        recipe_v2 = update_recipe(recipe_v1.id, RecipeUpdate(ingredients=None), db, user)
        print(f"Recipe V2 Created. Version: {recipe_v2.version}, Cost: Rs.{recipe_v2.total_recipe_cost}")
        # Rate is 60. 60 * 2.4 = 144
        assert recipe_v2.total_recipe_cost == Decimal("144.0000"), f"Expected 144, got {recipe_v2.total_recipe_cost}"

        # 5. Verify History
        print("\n[RECIPE TEST] 5. Verify Recipe History")
        rhist = get_recipe_history(recipe_v2.id, db, user)
        for r in rhist:
            print(f"Recipe Code: {r.code} | Version: {r.version} | Cost: Rs.{r.total_recipe_cost} | Active: {r.is_active}")
        assert len(rhist) == 2, "Recipe must have 2 history records"

        print("\nALL TESTS PASSED SUCCESSFULLY! [OK]")

    except Exception as e:
        print(f"\n[X] TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.rollback()
        db.close()

if __name__ == "__main__":
    run_tests()

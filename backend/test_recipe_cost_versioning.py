import os
import sys
from decimal import Decimal
from datetime import datetime

import os
import sys
from decimal import Decimal
from datetime import datetime

from app.core.database import SessionLocal
from app.models.user import User
from app.models.inventory import Item, ItemType, Category, Unit
from app.models.organization import Company
from app.models.recipe import Recipe, RecipeItem
from app.schemas.recipe import RecipeCreate, RecipeItemCreate, RecipeUpdate
from app.api.v1.endpoints.recipe import create_recipe, update_recipe, list_recipes, get_recipe_history

import uuid

def run_test():
    db = SessionLocal()
    try:
        company = db.query(Company).first()
        user = db.query(User).filter(User.company_id == company.id).first()
        
        # Use existing unit
        unit = db.query(Unit).filter(Unit.company_id == company.id).first()
        if not unit:
            unit = Unit(company_id=company.id, name="Kilogram", symbol=f"KG_{uuid.uuid4().hex[:4]}")
            db.add(unit)
            db.flush()
            
        rnd = uuid.uuid4().hex[:6]
        
        # Create Rice item
        rice = Item(company_id=company.id, name="Rice Test", code=f"RICE_{rnd}", type=ItemType.RAW_MATERIAL, cost_price=Decimal("50.00"), unit_id=unit.id)
        db.add(rice)
        
        # Create Finished Item
        biryani = Item(company_id=company.id, name="Biryani Test", code=f"BIRYANI_{rnd}", type=ItemType.SEMI_FINISHED, cost_price=Decimal("0.00"), unit_id=unit.id)
        db.add(biryani)
        db.flush()
        
        print(f"Initial Rice Rate: {rice.cost_price}")
        
        # Create Recipe
        recipe_in = RecipeCreate(
            finished_item_id=biryani.id,
            name="Biryani Recipe",
            code=f"REC_{rnd}",
            yield_qty=Decimal("1.00"),
            ingredients=[
                RecipeItemCreate(raw_item_id=rice.id, unit_id=unit.id, quantity=Decimal("2.4")) # 2.4 * 50 = 120
            ]
        )
        
        recipe_res = create_recipe(recipe_in=recipe_in, db=db, current_user=user)
        recipe_id = recipe_res.id
        print(f"Recipe Created. Total Cost: {recipe_res.total_recipe_cost}")
        assert recipe_res.total_recipe_cost == Decimal("120.0000"), f"Expected 120, got {recipe_res.total_recipe_cost}"
        
        # Now change Rice Rate
        rice.cost_price = Decimal("60.00")
        db.commit()
        print(f"Changed Rice Rate to: {rice.cost_price}")
        
        # Fetch recipe again from DB to verify it's still 120
        recipe_db = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        print(f"Recipe Cost after rate change (should be 120): {recipe_db.total_recipe_cost}")
        assert recipe_db.total_recipe_cost == Decimal("120.0000"), f"Expected 120, got {recipe_db.total_recipe_cost}"
        
        # Now manually edit/recalculate
        recipe_update = RecipeUpdate(ingredients=None) # no change to ingredients, just recalculate
        new_recipe_res = update_recipe(recipe_id=recipe_id, recipe_in=recipe_update, db=db, current_user=user)
        print(f"New Version Cost (should be 144): {new_recipe_res.total_recipe_cost}")
        assert new_recipe_res.total_recipe_cost == Decimal("144.0000"), f"Expected 144, got {new_recipe_res.total_recipe_cost}"
        
        # Check history
        history = get_recipe_history(recipe_id=new_recipe_res.id, db=db, current_user=user)
        print(f"History count: {len(history)}")
        for h in history:
            print(f"Version {h.version} - Cost {h.total_recipe_cost} - Active: {h.is_active}")
            
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.rollback()
        db.close()

if __name__ == "__main__":
    run_test()

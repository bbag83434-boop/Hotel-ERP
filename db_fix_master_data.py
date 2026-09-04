import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.inventory import Item, ItemType, ItemCategory, Unit
from app.models.recipe import Recipe, RecipeItem

def run():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "bbag83434@gmail.com").first()
        cid = user.company_id
        
        # 1. Gulab Jamun
        gul = db.query(Item).filter(Item.code == "GUL-01", Item.company_id == cid).first()
        if gul:
            gul.is_active = True
            print("Activated GUL-01")
            
        fg_gul = db.query(Item).filter(Item.code == "FG-GULAB-JAMUN-01", Item.company_id == cid).first()
        if fg_gul:
            fg_gul.is_active = True
            print("Activated FG-GULAB-JAMUN-01")
            
            recipe = db.query(Recipe).filter(Recipe.finished_item_id == fg_gul.id).first()
            if recipe:
                recipe.is_active = True
                recipe.is_current = True
                print("Activated recipe for FG-GULAB-JAMUN-01")
        
        # 2. Malpua
        malpua = db.query(Item).filter(Item.code == "MAL-01", Item.company_id == cid).first()
        if not malpua:
            cat = db.query(ItemCategory).filter(ItemCategory.company_id == cid).first()
            if not cat:
                cat = ItemCategory(company_id=cid, name="Sweets", is_active=True)
                db.add(cat)
                db.flush()
                
            unit = db.query(Unit).filter(Unit.company_id == cid).first()
            
            malpua = Item(
                company_id=cid,
                category_id=cat.id,
                type=ItemType.FINISHED_GOOD,
                code="MAL-01",
                name="Malpua (2 pcs)",
                unit_id=unit.id,
                cost_per_unit=50.0,
                is_active=True
            )
            db.add(malpua)
            db.flush()
            print("Created Malpua item")
            
            rm = db.query(Item).filter(Item.type == ItemType.RAW_MATERIAL, Item.company_id == cid).first()
            
            recipe = Recipe(
                company_id=cid,
                finished_item_id=malpua.id,
                code="REC-MAL-01",
                name="Malpua Recipe",
                expected_yield=1.0,
                is_active=True,
                is_current=True
            )
            db.add(recipe)
            db.flush()
            
            recipe_item = RecipeItem(
                recipe_id=recipe.id,
                item_id=rm.id,
                quantity=0.5,
                unit_id=rm.unit_id
            )
            db.add(recipe_item)
            print("Created Recipe for Malpua")
        else:
            malpua.is_active = True
            print("Activated Malpua")
            
        db.commit()
        print("Data fixed successfully")
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()

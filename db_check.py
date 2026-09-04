import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.inventory import Item, ItemType
from app.models.recipe import Recipe

def run():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "bbag83434@gmail.com").first()
        if not user:
            print("User not found")
            return
            
        print("Company ID:", user.company_id)
        
        items = db.query(Item).filter(Item.company_id == user.company_id).all()
        print("\n--- ITEMS ---")
        for i in items:
            print(f"[{i.id}] {i.code} - {i.name} | Type: {i.type} | Active: {i.is_active}")
            
        recipes = db.query(Recipe).filter(Recipe.company_id == user.company_id).all()
        print("\n--- RECIPES ---")
        for r in recipes:
            print(f"[{r.id}] FinishedItem: {r.finished_item_id} | Active: {r.is_active} | Current: {r.is_current}")
            
        # Try to find missing recipes
        finished_goods = [i for i in items if str(i.type) in ["ItemType.FINISHED_GOOD", "FINISHED_GOOD", "ItemType.SEMI_FINISHED", "SEMI_FINISHED"]]
        for fg in finished_goods:
            has_recipe = any(r.finished_item_id == fg.id and r.is_active and r.is_current for r in recipes)
            print(f"Finished Good {fg.code} has active/current recipe: {has_recipe}")
            
    finally:
        db.close()

if __name__ == "__main__":
    run()

import sys
from decimal import Decimal
import os
import uuid

sys.path.append(r"C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\backend")
from app.core.database import SessionLocal
from app.models.organization import Company, Warehouse, Branch
from app.models.inventory import Item, Category, Unit
from app.models.recipe import Recipe, RecipeItem

def run():
    db = SessionLocal()
    
    # 1. Setup Company and Central Warehouse
    company = db.query(Company).filter(Company.code == "COMP-001").first()
    if not company:
        print("Company COMP-001 not found by code, trying to find first active company.")
        company = db.query(Company).filter(Company.is_active == True).first()
        if not company:
            print("No company found.")
            return

    print(f"Using company: {company.name} ({company.id})")
    
    # Ensure one central warehouse exists
    central_wh = db.query(Warehouse).filter(Warehouse.company_id == company.id, Warehouse.is_central == True).first()
    if not central_wh:
        wh = db.query(Warehouse).filter(Warehouse.company_id == company.id).first()
        if wh:
            wh.is_central = True
            db.commit()
            central_wh = wh
            print(f"Set warehouse {wh.name} as Central.")
        else:
            print("No warehouses found in company!")
            return

    # 2. Cleanup old/wrong data
    wrong_names = ["Royal Heritage Gulab Jamun", "Sugar Syrup", "Dough Base", "Ghee", "2-pc portion", "2 pcs portion"]
    for w in wrong_names:
        items = db.query(Item).filter(Item.company_id == company.id, Item.name.ilike(f"%{w}%")).all()
        for it in items:
            it.is_active = False
            recipes = db.query(Recipe).filter(Recipe.company_id == company.id, Recipe.finished_item_id == it.id).all()
            for r in recipes:
                r.is_active = False
    
    # Also clean up any existing "Gulab Jamun" recipes so we can start fresh
    existing_gj = db.query(Item).filter(Item.company_id == company.id, Item.name == "Gulab Jamun").first()
    if existing_gj:
        old_recipes = db.query(Recipe).filter(Recipe.company_id == company.id, Recipe.finished_item_id == existing_gj.id).all()
        for r in old_recipes:
            db.query(RecipeItem).filter(RecipeItem.recipe_id == r.id).delete()
            db.delete(r)
        db.commit()

    # 3. Create EXACT Recipe
    def get_unit(sym, name):
        u = db.query(Unit).filter(Unit.company_id == company.id, Unit.symbol == sym).first()
        if not u:
            u = Unit(id=str(uuid.uuid4()), company_id=company.id, name=name, symbol=sym)
            db.add(u)
            db.commit()
        return u

    unit_kg = get_unit("KG", "Kilogram")
    unit_gm = get_unit("GM", "Gram")
    unit_pcs = get_unit("PCS", "Pieces")

    def get_item(name, u, type_val="RAW_MATERIAL", sp=0):
        it = db.query(Item).filter(Item.company_id == company.id, Item.name == name).first()
        if not it:
            cat = db.query(Category).filter(Category.company_id == company.id).first()
            it = Item(
                id=str(uuid.uuid4()),
                company_id=company.id,
                name=name,
                code=name[:3].upper() + "-01",
                unit_id=u.id,
                category_id=cat.id if cat else None,
                type=type_val,
                selling_price=Decimal(sp),
                cost_price=Decimal(10),
                is_active=True
            )
            db.add(it)
            db.commit()
        else:
            it.unit_id = u.id
            it.is_active = True
            if type_val == "FINISHED_GOOD":
                it.selling_price = Decimal(sp)
                it.type = type_val
            db.commit()
        return it

    gj = get_item("Gulab Jamun", unit_pcs, "FINISHED_GOOD", 20)

    ingredients = [
        ("Mawa", 1, unit_kg),
        ("Paneer", 100, unit_gm),
        ("Maida", 200, unit_gm),
        ("Corn Flour", 100, unit_gm),
        ("Elaichi", 1, unit_gm),
        ("Jaifal", 1, unit_gm),
        ("Joytri", 1, unit_gm),
        ("Sugar", 4, unit_kg),
        ("Refined Oil", 200, unit_gm)
    ]

    r = Recipe(
        id=str(uuid.uuid4()),
        company_id=company.id,
        name="Gulab Jamun",
        code="REC-GJ",
        finished_item_id=gj.id,
        yield_qty=Decimal(130),
        is_active=True
    )
    db.add(r)
    db.commit()

    for name, qty, u in ingredients:
        db_item = get_item(name, u, "RAW_MATERIAL")
        ri = RecipeItem(
            id=str(uuid.uuid4()),
            recipe_id=r.id,
            raw_item_id=db_item.id,
            unit_id=u.id,
            quantity=Decimal(qty)
        )
        db.add(ri)
    
    db.commit()
    print("Exact Gulab Jamun recipe seeded successfully!")

if __name__ == "__main__":
    run()

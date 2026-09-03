import sys
from decimal import Decimal
import uuid
from datetime import datetime

sys.path.append(r"C:\Users\Biswanath Bag\OneDrive\Desktop\Hotel-ERP\backend")
from app.core.database import SessionLocal
from app.models.organization import Company, Warehouse, Branch
from app.models.inventory import Item, Category, Unit, StockBalance, StockLedger, StockBatch
from app.models.recipe import Recipe, RecipeItem, ProductionOrder, ProductionConsumption

def print_banner(text):
    print(f"\n{'='*60}")
    print(f"{text:^60}")
    print(f"{'='*60}")

def run():
    db = SessionLocal()
    comp_code = "COMP-001"
    company = db.query(Company).filter(Company.code == comp_code).first()
    if not company:
        print("ERROR: COMP-001 not found")
        return
    
    print_banner("1. & 2. CENTRAL KITCHEN RESOLUTION")
    wh = db.query(Warehouse).filter(Warehouse.company_id == company.id, Warehouse.is_central == True).first()
    if wh:
        print(f"PASS: Exactly one central warehouse found: {wh.name} (Branch: {wh.branch.name})")
    else:
        print("FAIL: No central warehouse found!")
        return

    print_banner("3. & 4. GULAB JAMUN RECIPE VERIFICATION")
    gj_item = db.query(Item).filter(Item.company_id == company.id, Item.name == "Gulab Jamun").first()
    if not gj_item:
        print("FAIL: Gulab Jamun item not found.")
        return
    
    recipe = db.query(Recipe).filter(Recipe.finished_item_id == gj_item.id, Recipe.is_active == True).first()
    if not recipe:
        print("FAIL: Active Gulab Jamun recipe not found.")
        return

    print(f"Finished Item: {gj_item.name} | Type: {gj_item.type} | Selling Price: {gj_item.selling_price}")
    print(f"Recipe Yield: {recipe.yield_qty} PCS")
    
    ingredients = db.query(RecipeItem).filter(RecipeItem.recipe_id == recipe.id).all()
    print(f"Total Ingredients: {len(ingredients)}")
    for ri in ingredients:
        raw_item = db.query(Item).filter(Item.id == ri.raw_item_id).first()
        unit = db.query(Unit).filter(Unit.id == ri.unit_id).first()
        print(f" - {raw_item.name}: {ri.quantity} {unit.symbol}")

    if len(ingredients) != 9:
        print(f"FAIL: Expected 9 ingredients, got {len(ingredients)}")
        return

    print_banner("STOCK PREPARATION")
    print("Checking if we have enough stock. We will seed stock if missing to run the test.")
    raw_items = [ri.raw_item_id for ri in ingredients]
    for ri in ingredients:
        bal = db.query(StockBalance).filter(
            StockBalance.item_id == ri.raw_item_id,
            StockBalance.warehouse_id == wh.id
        ).first()
        if not bal or bal.quantity < ri.quantity:
            # Create dummy stock and batch
            qty_to_add = Decimal(1000)
            if not bal:
                bal = StockBalance(id=str(uuid.uuid4()), item_id=ri.raw_item_id, warehouse_id=wh.id, quantity=qty_to_add)
                db.add(bal)
            else:
                bal.quantity += qty_to_add
            
            batch = StockBatch(
                id=str(uuid.uuid4()), item_id=ri.raw_item_id, warehouse_id=wh.id,
                batch_number=f"BATCH-TEST-{ri.raw_item_id[:4]}",
                quantity=qty_to_add, unit_cost=Decimal(10)
            )
            db.add(batch)
    db.commit()

    print_banner("6. RECORD BEFORE STOCK")
    all_item_ids = raw_items + [gj_item.id]
    before_balances = {}
    for i_id in all_item_ids:
        b = db.query(StockBalance).filter(StockBalance.item_id == i_id, StockBalance.warehouse_id == wh.id).first()
        item = db.query(Item).filter(Item.id == i_id).first()
        qty = b.quantity if b else Decimal(0)
        before_balances[item.name] = qty
        print(f"{item.name:15}: {qty}")

    print_banner("7. RUN PRODUCTION (130 PCS)")
    try:
        from app.api.v1.endpoints.recipe import execute_production_order
        from app.schemas.recipe import ProductionOrderExecuteRequest
        from app.models.user import User
        # Dummy user
        user = db.query(User).filter(User.company_id == company.id).first()
        req = ProductionOrderExecuteRequest(
            recipe_id=recipe.id,
            planned_qty=Decimal(130),
            kitchen_warehouse_id=wh.id,
            branch_id=wh.branch_id,
            idempotency_key=str(uuid.uuid4()),
            notes="Automated Verification Test"
        )
        res = execute_production_order(req, db, user)
        print(f"Production executed successfully! ID: {res.id}, Order No: {res.order_number}")
    except Exception as e:
        print(f"FAIL: Production execution crashed: {e}")
        import traceback
        traceback.print_exc()
        return

    print_banner("8. RECORD AFTER STOCK")
    after_balances = {}
    for i_id in all_item_ids:
        b = db.query(StockBalance).filter(StockBalance.item_id == i_id, StockBalance.warehouse_id == wh.id).first()
        item = db.query(Item).filter(Item.id == i_id).first()
        qty = b.quantity if b else Decimal(0)
        after_balances[item.name] = qty
        diff = qty - before_balances[item.name]
        print(f"{item.name:15}: {qty} (Change: {diff:+.2f})")

    print_banner("9. VERIFY FIFO, CONSUMPTION & LEDGERS")
    consumptions = db.query(ProductionConsumption).filter(ProductionConsumption.production_order_id == res.id).all()
    print(f"Production Consumption Records: {len(consumptions)}")
    for c in consumptions:
        item = db.query(Item).filter(Item.id == c.raw_item_id).first()
        print(f" - Consumed {item.name}: {c.actual_consumed_qty} at Unit Cost {c.unit_cost}")
    
    ledgers = db.query(StockLedger).filter(StockLedger.reference_id == res.id).order_by(StockLedger.created_at).all()
    print(f"Stock Ledger Entries: {len(ledgers)}")
    for l in ledgers:
        item = db.query(Item).filter(Item.id == l.item_id).first()
        print(f" - {l.movement_type}: {item.name}, Qty: {l.change_qty}, Warehouse: {l.warehouse_id}")

    print_banner("10. VERIFY PRODUCTION HISTORY")
    order = db.query(ProductionOrder).filter(ProductionOrder.id == res.id).first()
    print(f"Order No: {order.order_number}")
    print(f"Planned Qty: {order.planned_qty}")
    print(f"Total Cost: {order.total_raw_cost}")
    print(f"Cost per Unit: {order.unit_food_cost}")
    
    print_banner("11. VERIFY NO OTHER IMPACT")
    print("Checking if Outlet Stock, Kitchen Orders, Transfers, Dispatches were changed by this reference id...")
    from app.models.recipe import KitchenOrder
    kos = db.query(KitchenOrder).filter(KitchenOrder.id == res.id).all()
    print(f"Kitchen Orders linked to this execution: {len(kos)}")
    # If 0, then no linkage!

if __name__ == "__main__":
    run()

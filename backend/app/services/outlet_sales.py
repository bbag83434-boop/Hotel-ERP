import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.inventory import Item, StockBalance, StockLedger, UnitConversion, Warehouse
from app.models.recipe import Recipe, RecipeItem
from app.models.outlet_sales import OutletSale, OutletSaleIngredient
from app.schemas.outlet_sales import (
    OutletSalePreviewRequest,
    OutletSalePreviewResponse,
    IngredientRequirementInfo,
    OutletSaleCreate
)
from app.core.exceptions import AppException

class OutletSalesService:
    def __init__(self, db: Session):
        self.db = db

    def get_unit_conversion_factor(self, company_id: str, from_unit_id: str, to_unit_id: str) -> Decimal:
        if from_unit_id == to_unit_id:
            return Decimal("1.0000")
        conversion = self.db.query(UnitConversion).filter(
            UnitConversion.company_id == company_id,
            UnitConversion.from_unit_id == from_unit_id,
            UnitConversion.to_unit_id == to_unit_id
        ).first()
        if conversion:
            return conversion.conversion_factor
        conversion = self.db.query(UnitConversion).filter(
            UnitConversion.company_id == company_id,
            UnitConversion.from_unit_id == to_unit_id,
            UnitConversion.to_unit_id == from_unit_id
        ).first()
        if conversion:
            return Decimal("1.0000") / conversion.conversion_factor
        raise AppException(400, "UNIT_ERROR", f"No unit conversion found between {from_unit_id} and {to_unit_id}")

    def get_outlet_warehouse(self, branch_id: str) -> Warehouse:
        # Get the first warehouse for the branch that is NOT central (or just the first one if there's only one)
        warehouse = self.db.query(Warehouse).filter(Warehouse.branch_id == branch_id, Warehouse.is_central == False).first()
        if not warehouse:
            warehouse = self.db.query(Warehouse).filter(Warehouse.branch_id == branch_id).first()
        if not warehouse:
            raise AppException(400, "WAREHOUSE_ERROR", "No warehouse found for this outlet.")
        return warehouse

    def preview_sale(self, company_id: str, req: OutletSalePreviewRequest) -> OutletSalePreviewResponse:
        item = self.db.query(Item).filter(Item.id == req.item_id).first()
        if not item:
            raise AppException(404, "NOT_FOUND", "Item not found")

        recipe = self.db.query(Recipe).filter(Recipe.finished_item_id == req.item_id, Recipe.is_active == True).first()
        if not recipe:
            raise AppException(400, "NO_RECIPE", "Item does not have an active recipe")

        warehouse = self.get_outlet_warehouse(req.branch_id)
        
        # Calculate proportionality
        # The quantity sold is in req.unit_id. We might need to convert it to recipe.unit_id if different.
        sale_qty_in_recipe_unit = req.quantity * self.get_unit_conversion_factor(company_id, req.unit_id, recipe.unit_id)
        
        ratio = sale_qty_in_recipe_unit / recipe.yield_quantity

        ingredients = []
        is_valid = True
        total_cost = Decimal("0.00")

        for r_item in recipe.items:
            ing_item = self.db.query(Item).filter(Item.id == r_item.item_id).first()
            required_qty = r_item.quantity * ratio
            
            # Check stock balance
            stock = self.db.query(StockBalance).filter(
                StockBalance.warehouse_id == warehouse.id,
                StockBalance.item_id == r_item.item_id
            ).first()
            
            available_qty = stock.quantity if stock else Decimal("0.0000")
            
            is_shortage = available_qty < required_qty
            shortage_qty = required_qty - available_qty if is_shortage else Decimal("0.0000")
            
            if is_shortage:
                is_valid = False

            # Calculate cost
            rate = ing_item.cost_price or Decimal("0.0000")
            cost = rate * required_qty
            total_cost += cost

            ingredients.append(IngredientRequirementInfo(
                ingredient_item_id=r_item.item_id,
                ingredient_name=ing_item.name,
                unit_id=r_item.unit_id,
                unit_symbol=ing_item.unit.symbol if ing_item.unit else "",
                required_qty=required_qty,
                available_qty=available_qty,
                rate=rate,
                cost=cost,
                is_shortage=is_shortage,
                shortage_qty=shortage_qty
            ))

        return OutletSalePreviewResponse(
            item_id=item.id,
            item_name=item.name,
            sold_qty=req.quantity,
            recipe_id=recipe.id,
            recipe_yield=recipe.yield_quantity,
            ingredients=ingredients,
            total_cost=total_cost,
            is_valid=is_valid,
            message="Ready to post" if is_valid else "Insufficient stock for one or more ingredients."
        )

    def post_sale(self, company_id: str, user_id: str, req: OutletSaleCreate) -> OutletSale:
        # Re-run preview to get exact numbers and validate again
        preview_req = OutletSalePreviewRequest(
            branch_id=req.branch_id,
            item_id=req.item_id,
            quantity=req.quantity,
            unit_id=req.unit_id
        )
        preview = self.preview_sale(company_id, preview_req)
        
        if not preview.is_valid:
            raise AppException(400, "STOCK_SHORTAGE", "Cannot post sale due to stock shortage. " + preview.message)

        warehouse = self.get_outlet_warehouse(req.branch_id)
        
        # Check idempotency
        existing = self.db.query(OutletSale).filter(OutletSale.notes == req.idempotency_key).first()
        if existing:
            return existing
            
        cost_per_unit = preview.total_cost / req.quantity if req.quantity > 0 else Decimal("0.0000")

        # Create Sale Record
        sale = OutletSale(
            id=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=req.branch_id,
            warehouse_id=warehouse.id,
            item_id=req.item_id,
            recipe_id=preview.recipe_id,
            transaction_date=req.transaction_date,
            quantity=req.quantity,
            unit_id=req.unit_id,
            total_cost=preview.total_cost,
            cost_per_unit=cost_per_unit,
            status="COMPLETED",
            created_by_id=user_id,
            notes=req.idempotency_key
        )
        self.db.add(sale)

        # Deduct ingredients and record ledger
        for ing in preview.ingredients:
            sale_ing = OutletSaleIngredient(
                id=str(uuid.uuid4()),
                sale_id=sale.id,
                ingredient_item_id=ing.ingredient_item_id,
                unit_id=ing.unit_id,
                required_qty=ing.required_qty,
                consumed_qty=ing.required_qty,
                rate=ing.rate,
                cost=ing.cost
            )
            self.db.add(sale_ing)
            
            # Stock deduction
            bal = self.db.query(StockBalance).filter(
                StockBalance.warehouse_id == warehouse.id, 
                StockBalance.item_id == ing.ingredient_item_id
            ).with_for_update().first()
            
            if not bal or bal.quantity < ing.required_qty:
                raise AppException(400, "STOCK_SHORTAGE", f"Insufficient stock for ingredient {ing.ingredient_item_id}")
                
            bal.quantity -= ing.required_qty
            
            # Ledger
            ledger = StockLedger(
                company_id=company_id,
                branch_id=req.branch_id,
                warehouse_id=warehouse.id,
                item_id=ing.ingredient_item_id,
                movement_type="OUTLET_CONSUMPTION",
                change_qty=-ing.required_qty,
                balance_qty=bal.quantity,
                reference_type="OUTLET_SALE",
                reference_id=sale.id,
                created_by_id=user_id,
                notes=f"Auto consumption for outlet sale {sale.id}"
            )
            self.db.add(ledger)

        self.db.commit()
        self.db.refresh(sale)
        return sale

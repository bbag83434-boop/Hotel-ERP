import uuid
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.models.inventory import (
    Item,
    ItemType,
    OutletStockBalance,
    OutletStockBatch,
    OutletStockLedger,
    Unit,
)
from app.models.recipe import Recipe
from app.models.outlet_sales import OutletSale, OutletSaleIngredient
from app.schemas.outlet_sales import (
    IngredientRequirementInfo,
    OutletSaleCreate,
    OutletSalePreviewRequest,
    OutletSalePreviewResponse,
)
from app.services.unit_conversion import convert_quantity
from app.core.exceptions import AppException


class OutletSalesService:
    """
    Admin-only Outlet Sales / Consumption service.

    Flow:
        Outlet -> Finished/Semi-Finished Item -> UOM -> Quantity
        -> Current Recipe -> Recursive Ingredient Explosion
        -> UOM Conversion to Outlet Stock UOM -> Outlet Stock Check
        -> Atomic deduction + OutletStockLedger + History

    Important rules:
        - Preview never changes stock.
        - Outlet Sales uses ONLY outlet-wise stock tables.
        - Central Store / warehouse stock is never read or deducted here.
        - Post locks outlet stock rows before the final shortage check.
        - If any ingredient is short, the complete transaction is blocked.
        - Company, outlet, item and recipe are always scoped.
        - Recipe BOM uses the current recipe version only.
        - Semi-finished sub-recipes are recursively exploded.
        - Existing warehouse inventory workflows remain outside this service.
    """

    STOCK_MOVEMENT_TYPE = "POS_SALE"
    REFERENCE_TYPE = "OUTLET_SALE"
    DECIMAL_ZERO = Decimal("0.0000")

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Common validation / lookup helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _decimal(value) -> Decimal:
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise AppException(400, "NUMBER_ERROR", "Invalid numeric value.") from exc

    def _get_company_item(self, company_id: str, item_id: str) -> Item:
        item = (
            self.db.query(Item)
            .filter(
                Item.id == item_id,
                Item.company_id == company_id,
                Item.is_active.is_(True),
            )
            .first()
        )
        if not item:
            raise AppException(404, "NOT_FOUND", "Item not found")
        return item

    def _get_unit(self, company_id: str, unit_id: str) -> Unit:
        unit = (
            self.db.query(Unit)
            .filter(
                Unit.id == unit_id,
                Unit.company_id == company_id,
                Unit.is_active.is_(True),
            )
            .first()
        )
        if not unit:
            raise AppException(404, "UNIT_NOT_FOUND", f"Unit not found: {unit_id}")
        return unit

    def _get_current_recipe(self, company_id: str, finished_item_id: str) -> Recipe:
        recipe = (
            self.db.query(Recipe)
            .filter(
                Recipe.company_id == company_id,
                Recipe.finished_item_id == finished_item_id,
                Recipe.is_active.is_(True),
                Recipe.is_current.is_(True),
            )
            .order_by(Recipe.version.desc())
            .first()
        )

        if not recipe:
            raise AppException(
                400,
                "NO_RECIPE",
                "Item does not have an active current recipe",
            )
        return recipe

    # ------------------------------------------------------------------
    # Legacy OutletSale model compatibility
    # ------------------------------------------------------------------

    def _validate_sale_model_compatibility(self) -> None:
        """
        Outlet Sales no longer use a warehouse for stock.

        Older OutletSale models may still carry a legacy warehouse_id column.
        That column must be nullable (or removed in a later schema migration)
        before a new outlet-only sale can be stored. We intentionally DO NOT
        resolve or invent an outlet warehouse here.
        """
        table = getattr(OutletSale, "__table__", None)
        if table is None:
            return

        warehouse_column = table.columns.get("warehouse_id")
        if warehouse_column is None:
            return

        if not warehouse_column.nullable:
            raise AppException(
                500,
                "OUTLET_SALE_MODEL_ERROR",
                "OutletSale.warehouse_id is still mandatory. "
                "For outlet-wise stock, make this legacy column nullable or remove it "
                "with a database migration. Outlet Sales will not use any warehouse.",
            )

    # ------------------------------------------------------------------
    # UOM conversion
    # ------------------------------------------------------------------

    def _convert(
        self,
        company_id: str,
        value: Decimal,
        from_unit_id: str,
        to_unit_id: str,
    ) -> Decimal:
        value = self._decimal(value)
        if value < 0:
            raise AppException(400, "UNIT_ERROR", "Quantity cannot be negative.")

        if from_unit_id == to_unit_id:
            return value.quantize(Decimal("0.0001"))

        # Validate both units belong to the same company before conversion.
        self._get_unit(company_id, from_unit_id)
        self._get_unit(company_id, to_unit_id)

        try:
            converted = convert_quantity(
                self.db,
                company_id,
                value,
                from_unit_id,
                to_unit_id,
            )
        except ValueError as exc:
            raise AppException(400, "UNIT_ERROR", str(exc)) from exc
        except Exception as exc:
            # The shared conversion helper may surface a configuration error
            # using a different exception type. Convert it to a module-level
            # business error instead of leaking an internal traceback.
            raise AppException(400, "UNIT_ERROR", str(exc)) from exc

        return self._decimal(converted).quantize(Decimal("0.0001"))

    # ------------------------------------------------------------------
    # Recipe explosion
    # ------------------------------------------------------------------

    def _recipe_line_quantity(self, recipe_item) -> Decimal:
        """
        Return the recipe quantity to consume per recipe yield.

        Existing production logic in this project uses RecipeItem.quantity as
        the operational BOM quantity. Gross/waste fields are kept for costing
        and recipe metadata, so this module intentionally stays aligned with
        the existing production consumption behavior.
        """
        qty = self._decimal(recipe_item.quantity or 0)
        if qty <= 0:
            raise AppException(
                400,
                "RECIPE_ERROR",
                f"Recipe ingredient {recipe_item.raw_item_id} has an invalid quantity.",
            )
        return qty

    def _expand_recipe(
        self,
        company_id: str,
        recipe: Recipe,
        output_qty: Decimal,
        output_unit_id: str,
        aggregate: Dict[str, Decimal],
        visited_recipe_ids: Set[str],
    ) -> None:
        """Recursively explode a recipe into outlet-stock UOM quantities."""
        if recipe.id in visited_recipe_ids:
            raise AppException(
                400,
                "RECIPE_CYCLE",
                f"Circular recipe dependency detected at recipe {recipe.id}.",
            )

        finished_item = self._get_company_item(company_id, recipe.finished_item_id)
        if not finished_item.unit_id:
            raise AppException(
                400,
                "UNIT_ERROR",
                f"Finished item {finished_item.name} has no base UOM configured.",
            )

        output_qty = self._decimal(output_qty)
        if output_qty <= 0:
            raise AppException(
                400,
                "QUANTITY_ERROR",
                "Recipe output quantity must be greater than zero.",
            )

        yield_qty = self._decimal(recipe.yield_qty or 0)
        if yield_qty <= 0:
            raise AppException(
                400,
                "RECIPE_ERROR",
                f"Recipe {recipe.id} has an invalid yield quantity.",
            )

        # Convert the requested finished quantity into the item's base UOM.
        requested_in_base = self._convert(
            company_id,
            output_qty,
            output_unit_id,
            finished_item.unit_id,
        )
        multiplier = requested_in_base / yield_qty

        next_visited = set(visited_recipe_ids)
        next_visited.add(recipe.id)

        for recipe_item in recipe.ingredients:
            ingredient_item = self._get_company_item(
                company_id,
                recipe_item.raw_item_id,
            )

            recipe_unit_id = recipe_item.unit_id or ingredient_item.unit_id
            if not recipe_unit_id:
                raise AppException(
                    400,
                    "UNIT_ERROR",
                    f"Recipe ingredient {ingredient_item.name} has no UOM configured.",
                )

            per_yield_qty = self._recipe_line_quantity(recipe_item)
            required_in_recipe_uom = (
                per_yield_qty * multiplier
            ).quantize(Decimal("0.0001"))

            # Semi-finished items with a current recipe are exploded into the
            # underlying stock ingredients. Otherwise the item itself is
            # consumed from outlet stock.
            is_semi_finished = ingredient_item.type == ItemType.SEMI_FINISHED
            if is_semi_finished:
                sub_recipe = (
                    self.db.query(Recipe)
                    .filter(
                        Recipe.company_id == company_id,
                        Recipe.finished_item_id == ingredient_item.id,
                        Recipe.is_active.is_(True),
                        Recipe.is_current.is_(True),
                    )
                    .order_by(Recipe.version.desc())
                    .first()
                )

                if sub_recipe:
                    if not ingredient_item.unit_id:
                        raise AppException(
                            400,
                            "UNIT_ERROR",
                            f"Semi-finished item {ingredient_item.name} has no base UOM.",
                        )

                    sub_output_qty = self._convert(
                        company_id,
                        required_in_recipe_uom,
                        recipe_unit_id,
                        ingredient_item.unit_id,
                    )

                    self._expand_recipe(
                        company_id=company_id,
                        recipe=sub_recipe,
                        output_qty=sub_output_qty,
                        output_unit_id=ingredient_item.unit_id,
                        aggregate=aggregate,
                        visited_recipe_ids=next_visited,
                    )
                    continue

            if not ingredient_item.unit_id:
                raise AppException(
                    400,
                    "UNIT_ERROR",
                    f"Ingredient {ingredient_item.name} has no stock UOM configured.",
                )

            stock_qty = self._convert(
                company_id,
                required_in_recipe_uom,
                recipe_unit_id,
                ingredient_item.unit_id,
            )

            aggregate[ingredient_item.id] = (
                aggregate.get(ingredient_item.id, self.DECIMAL_ZERO) + stock_qty
            ).quantize(Decimal("0.0001"))

    # ------------------------------------------------------------------
    # Cost / availability plan
    # ------------------------------------------------------------------

    def _build_plan(
        self,
        company_id: str,
        branch_id: str,
        item_id: str,
        quantity: Decimal,
        unit_id: str,
        lock_stock: bool,
        block_on_shortage: bool = False,
    ) -> Tuple[Item, Recipe, List[dict]]:
        sale_item = self._get_company_item(company_id, item_id)
        self._get_unit(company_id, unit_id)
        recipe = self._get_current_recipe(company_id, item_id)

        quantity = self._decimal(quantity)
        if quantity <= 0:
            raise AppException(
                400,
                "QUANTITY_ERROR",
                "Quantity must be greater than zero.",
            )

        aggregate: Dict[str, Decimal] = {}
        self._expand_recipe(
            company_id=company_id,
            recipe=recipe,
            output_qty=quantity,
            output_unit_id=unit_id,
            aggregate=aggregate,
            visited_recipe_ids=set(),
        )

        plans: List[dict] = []
        shortages: List[str] = []

        # Lock/order ingredients consistently to reduce concurrent deadlock risk.
        for ingredient_item_id in sorted(aggregate.keys()):
            required_qty = aggregate[ingredient_item_id]
            ingredient_item = self._get_company_item(company_id, ingredient_item_id)

            balance_query = self.db.query(OutletStockBalance).filter(
                OutletStockBalance.company_id == company_id,
                OutletStockBalance.branch_id == branch_id,
                OutletStockBalance.item_id == ingredient_item.id,
            )
            if lock_stock:
                balance_query = balance_query.with_for_update()
            balance = balance_query.first()

            available_qty = (
                self._decimal(balance.quantity)
                if balance is not None and balance.quantity is not None
                else self.DECIMAL_ZERO
            )

            batch_query = (
                self.db.query(OutletStockBatch)
                .filter(
                    OutletStockBatch.company_id == company_id,
                    OutletStockBatch.branch_id == branch_id,
                    OutletStockBatch.item_id == ingredient_item.id,
                    OutletStockBatch.quantity > 0,
                    OutletStockBatch.is_active.is_(True),
                )
                # OutletStockBatch does not inherit BaseModel and therefore has
                # no created_at column. Use manufacturing date as the available
                # chronological batch signal, then stable batch/id ordering.
                .order_by(
                    OutletStockBatch.mfg_date.asc().nulls_last(),
                    OutletStockBatch.batch_number.asc(),
                    OutletStockBatch.id.asc(),
                )
            )
            if lock_stock:
                batch_query = batch_query.with_for_update()
            batches = batch_query.all()

            shortage_qty = max(self.DECIMAL_ZERO, required_qty - available_qty)
            is_shortage = shortage_qty > 0
            if is_shortage:
                shortages.append(
                    f"{ingredient_item.name} "
                    f"(Required: {required_qty} "
                    f"{ingredient_item.unit.symbol if ingredient_item.unit else ''}, "
                    f"Available: {available_qty}, Shortage: {shortage_qty})"
                )

            # Estimate actual cost using FIFO outlet batch costs first, then item
            # cost price for any remainder not represented in a batch.
            remaining_for_cost = required_qty
            estimated_cost = self.DECIMAL_ZERO
            batch_cost_lines = []

            for batch in batches:
                if remaining_for_cost <= 0:
                    break

                batch_qty = self._decimal(batch.quantity)
                take = min(remaining_for_cost, batch_qty)
                batch_rate = self._decimal(
                    batch.unit_cost or ingredient_item.cost_price or 0
                )
                line_cost = (take * batch_rate).quantize(Decimal("0.0001"))
                estimated_cost += line_cost
                remaining_for_cost -= take
                batch_cost_lines.append(
                    {
                        "batch": batch,
                        "estimated_qty": take,
                        "unit_cost": batch_rate,
                    }
                )

            if remaining_for_cost > 0:
                fallback_rate = self._decimal(ingredient_item.cost_price or 0)
                estimated_cost += (
                    remaining_for_cost * fallback_rate
                ).quantize(Decimal("0.0001"))

            estimated_cost = estimated_cost.quantize(Decimal("0.0001"))
            rate = (
                estimated_cost / required_qty
                if required_qty > 0
                else self.DECIMAL_ZERO
            ).quantize(Decimal("0.0001"))

            plans.append(
                {
                    "item": ingredient_item,
                    "required_qty": required_qty,
                    "available_qty": available_qty,
                    "shortage_qty": shortage_qty,
                    "is_shortage": is_shortage,
                    "balance": balance,
                    "batches": batches,
                    "batch_cost_lines": batch_cost_lines,
                    "rate": rate,
                    "cost": estimated_cost,
                }
            )

        if shortages and block_on_shortage:
            raise AppException(
                400,
                "STOCK_SHORTAGE",
                "Insufficient outlet stock for one or more ingredients. "
                + " | ".join(shortages),
            )

        return sale_item, recipe, plans

    # ------------------------------------------------------------------
    # Preview
    # ------------------------------------------------------------------

    def preview_sale(
        self,
        company_id: str,
        req: OutletSalePreviewRequest,
    ) -> OutletSalePreviewResponse:
        quantity = self._decimal(req.quantity)
        if quantity <= 0:
            raise AppException(
                400,
                "QUANTITY_ERROR",
                "Quantity must be greater than zero.",
            )

        sale_item, recipe, plans = self._build_plan(
            company_id=company_id,
            branch_id=req.branch_id,
            item_id=req.item_id,
            quantity=quantity,
            unit_id=req.unit_id,
            lock_stock=False,
            block_on_shortage=False,
        )

        ingredients: List[IngredientRequirementInfo] = []
        total_cost = self.DECIMAL_ZERO

        for plan in plans:
            ingredient_item = plan["item"]
            line_cost = plan["cost"]
            total_cost += line_cost

            ingredients.append(
                IngredientRequirementInfo(
                    ingredient_item_id=ingredient_item.id,
                    ingredient_name=ingredient_item.name,
                    unit_id=ingredient_item.unit_id,
                    unit_symbol=(
                        ingredient_item.unit.symbol
                        if ingredient_item.unit
                        else ""
                    ),
                    required_qty=plan["required_qty"],
                    available_qty=plan["available_qty"],
                    rate=plan["rate"],
                    cost=line_cost,
                    is_shortage=plan["is_shortage"],
                    shortage_qty=plan["shortage_qty"],
                )
            )

        total_cost = total_cost.quantize(Decimal("0.0001"))
        has_shortage = any(plan["is_shortage"] for plan in plans)

        return OutletSalePreviewResponse(
            item_id=sale_item.id,
            item_name=sale_item.name,
            sold_qty=quantity,
            recipe_id=recipe.id,
            recipe_yield=self._decimal(recipe.yield_qty or 0),
            ingredients=ingredients,
            total_cost=total_cost,
            is_valid=not has_shortage,
            message=(
                "Ready to post"
                if not has_shortage
                else "Insufficient outlet stock for one or more ingredients."
            ),
        )

    # ------------------------------------------------------------------
    # Post / consume
    # ------------------------------------------------------------------

    def post_sale(
        self,
        company_id: str,
        req: OutletSaleCreate,
        user_id: Optional[str] = None,
    ) -> OutletSale:
        """
        Atomically post the outlet sale/consumption.

        Signature is intentionally compatible with the current router:
            post_sale(company_id, req)

        The optional user_id can be supplied by the router so the history and
        outlet ledger keep the actual creator when available.
        """
        quantity = self._decimal(req.quantity)
        if quantity <= 0:
            raise AppException(
                400,
                "QUANTITY_ERROR",
                "Quantity must be greater than zero.",
            )

        # Existing model does not have a dedicated idempotency_key column, so
        # notes is used as the existing storage location for the request key.
        existing = (
            self.db.query(OutletSale)
            .filter(
                OutletSale.company_id == company_id,
                OutletSale.notes == req.idempotency_key,
            )
            .first()
        )
        if existing:
            return existing

        try:
            # Never resolve an outlet warehouse in this flow. If the current
            # history model still requires warehouse_id, stop with an explicit
            # migration/configuration error rather than touching the wrong stock.
            self._validate_sale_model_compatibility()

            # The build plan uses SELECT ... FOR UPDATE for every OutletStockBalance
            # row before checking shortages. This is the important atomic
            # boundary: another concurrent outlet sale cannot reduce the same
            # stock after our availability check and before our deduction.
            sale_item, recipe, plans = self._build_plan(
                company_id=company_id,
                branch_id=req.branch_id,
                item_id=req.item_id,
                quantity=quantity,
                unit_id=req.unit_id,
                lock_stock=True,
                block_on_shortage=True,
            )

            total_cost = sum(
                (plan["cost"] for plan in plans),
                self.DECIMAL_ZERO,
            ).quantize(Decimal("0.0001"))
            cost_per_unit = (
                total_cost / quantity
                if quantity > 0
                else self.DECIMAL_ZERO
            ).quantize(Decimal("0.0001"))

            sale_kwargs = dict(
                id=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=req.branch_id,
                item_id=sale_item.id,
                recipe_id=recipe.id,
                transaction_date=req.transaction_date,
                quantity=quantity,
                unit_id=req.unit_id,
                total_cost=total_cost,
                cost_per_unit=cost_per_unit,
                status="COMPLETED",
                created_by_id=user_id,
                notes=req.idempotency_key,
            )

            # New outlet-only schema: warehouse_id is not populated. If the
            # legacy column still exists but is nullable, explicitly store NULL.
            if hasattr(OutletSale, "warehouse_id"):
                sale_kwargs["warehouse_id"] = None

            sale = OutletSale(**sale_kwargs)
            self.db.add(sale)

            for plan in plans:
                ingredient_item: Item = plan["item"]
                required_qty: Decimal = plan["required_qty"]
                balance: Optional[OutletStockBalance] = plan["balance"]

                if balance is None:
                    raise AppException(
                        400,
                        "STOCK_SHORTAGE",
                        f"Outlet stock balance missing for ingredient {ingredient_item.name}.",
                    )

                remaining = required_qty
                consumed_cost = self.DECIMAL_ZERO

                # Create the sale ingredient history line first. It is committed
                # together with the actual outlet stock movements at the end.
                sale_ing = OutletSaleIngredient(
                    id=str(uuid.uuid4()),
                    sale_id=sale.id,
                    ingredient_item_id=ingredient_item.id,
                    unit_id=ingredient_item.unit_id,
                    required_qty=required_qty,
                    consumed_qty=required_qty,
                    rate=plan["rate"],
                    cost=plan["cost"],
                )
                self.db.add(sale_ing)

                # FIFO deduction from outlet-specific batches.
                for batch in plan["batches"]:
                    if remaining <= 0:
                        break

                    batch_qty = self._decimal(batch.quantity)
                    balance_qty = self._decimal(balance.quantity)
                    if batch_qty <= 0 or balance_qty <= 0:
                        continue

                    take = min(remaining, batch_qty, balance_qty)
                    if take <= 0:
                        continue

                    batch_rate = self._decimal(
                        batch.unit_cost or ingredient_item.cost_price or 0
                    )
                    line_cost = (take * batch_rate).quantize(Decimal("0.0001"))

                    batch.quantity = (batch_qty - take).quantize(Decimal("0.0001"))
                    if batch.quantity <= 0:
                        batch.quantity = self.DECIMAL_ZERO
                        batch.is_active = False

                    balance.quantity = (
                        balance_qty - take
                    ).quantize(Decimal("0.0001"))

                    consumed_cost += line_cost
                    remaining -= take

                    self.db.add(
                        OutletStockLedger(
                            id=str(uuid.uuid4()),
                            company_id=company_id,
                            branch_id=req.branch_id,
                            item_id=ingredient_item.id,
                            unit_id=ingredient_item.unit_id,
                            batch_number=batch.batch_number,
                            movement_type=self.STOCK_MOVEMENT_TYPE,
                            change_qty=-take,
                            balance_qty=balance.quantity,
                            unit_cost=batch_rate,
                            total_cost=line_cost,
                            reference_type=self.REFERENCE_TYPE,
                            reference_id=sale.id,
                            created_by_id=user_id,
                            notes=f"Outlet consumption for sale {sale.id}",
                        )
                    )

                # If outlet stock contains quantity that is not represented by
                # active batches, consume the remaining quantity using the item
                # master cost. This keeps the module compatible with outlets
                # whose stock is not batch-tracked.
                if remaining > 0:
                    balance_qty = self._decimal(balance.quantity)
                    if balance_qty < remaining:
                        raise AppException(
                            400,
                            "STOCK_SHORTAGE",
                            f"Insufficient outlet stock for ingredient {ingredient_item.name}.",
                        )

                    fallback_rate = self._decimal(ingredient_item.cost_price or 0)
                    fallback_cost = (
                        remaining * fallback_rate
                    ).quantize(Decimal("0.0001"))
                    balance.quantity = (
                        balance_qty - remaining
                    ).quantize(Decimal("0.0001"))

                    consumed_cost += fallback_cost

                    self.db.add(
                        OutletStockLedger(
                            id=str(uuid.uuid4()),
                            company_id=company_id,
                            branch_id=req.branch_id,
                            item_id=ingredient_item.id,
                            unit_id=ingredient_item.unit_id,
                            batch_number=None,
                            movement_type=self.STOCK_MOVEMENT_TYPE,
                            change_qty=-remaining,
                            balance_qty=balance.quantity,
                            unit_cost=fallback_rate,
                            total_cost=fallback_cost,
                            reference_type=self.REFERENCE_TYPE,
                            reference_id=sale.id,
                            created_by_id=user_id,
                            notes=f"Outlet consumption for sale {sale.id}",
                        )
                    )

                    remaining = self.DECIMAL_ZERO

                if remaining > 0:
                    raise AppException(
                        400,
                        "STOCK_SHORTAGE",
                        f"Unable to consume complete outlet stock for ingredient {ingredient_item.name}.",
                    )

                # The sale's cost snapshot is based on the same FIFO estimate
                # used in preview. The ingredient line stores its snapshot too.
                if consumed_cost <= 0 and required_qty > 0:
                    # This can happen for zero-cost inventory. Keep history rate
                    # unchanged rather than inventing a value.
                    sale_ing.rate = plan["rate"]

            # Flush before commit so FK / DB-level validation happens inside the
            # same transaction. No stock-changing operation is committed early.
            self.db.flush()
            self.db.commit()
            self.db.refresh(sale)
            return sale

        except Exception:
            self.db.rollback()
            raise

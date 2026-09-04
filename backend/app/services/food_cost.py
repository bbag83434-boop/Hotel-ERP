"""
Food Cost Calculation Engine.

Single source of truth for every Food Cost calculation in the application.
All monetary arithmetic uses ``Decimal`` with one consistent currency
precision so floating-point and cumulative rounding errors are impossible.

Reused existing infrastructure (no duplicate systems):
  * Item Master             -> ``Item`` identity + applicable rate (cost_price)
  * Unit Master + Convert   -> ``Unit`` / ``UnitConversion`` normalisation via
                               ``app.services.unit_conversion.convert_quantity``
  * Food Cost config        -> ``FoodCostConfig`` / cost heads / markup options
  * Snapshots               -> immutable historical records

The engine is the ONLY place that computes Food Cost values. API and UI code
call this service and display exactly what it returns.
"""
import json
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.inventory import Item, Unit
from app.models.food_cost import (
    FoodCostConfig,
    FoodCostCostHead,
    FoodCostMarkupOption,
    FoodCostSnapshot,
)
from app.services.unit_conversion import convert_quantity

# ---------------------------------------------------------------------------
# Currency precision policy: every money value is carried to 4 decimal places
# (matches the Numeric(14,4) database columns). The API returns the exact
# backend value; the frontend only formats it for display.
# ---------------------------------------------------------------------------
MONEY_QUANT = Decimal("0.0001")
PCT_QUANT = Decimal("0.0001")

DEFAULT_COST_HEADS: List[Tuple[str, str]] = [
    ("Manpower", "5.00"),
    ("Gas & Fuel", "3.00"),
    ("Electricity", "2.00"),
    ("Water", "1.00"),
    ("Cleaning & Chemicals", "2.00"),
    ("Kitchen Operating Expense", "0.00"),
    ("Other Operational Expenses", "0.00"),
]

DEFAULT_MARKUP_OPTIONS: List[Tuple[int, str]] = [
    (50, "50%"),
    (70, "70%"),
    (100, "100%"),
    (150, "150%"),
    (200, "200%"),
]


def _dec(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------
def _seed_defaults(db: Session, config: FoodCostConfig) -> None:
    """Create the default management cost heads and markup options the first
    time a company gets a Food Cost configuration."""
    if not config.cost_heads:
        for i, (name, pct) in enumerate(DEFAULT_COST_HEADS):
            db.add(
                FoodCostCostHead(
                    config_id=config.id,
                    name=name,
                    percentage=Decimal(pct),
                    is_active=True,
                    display_order=i,
                )
            )
    if not config.markup_options:
        for i, (pct, label) in enumerate(DEFAULT_MARKUP_OPTIONS):
            db.add(
                FoodCostMarkupOption(
                    config_id=config.id,
                    percentage=Decimal(str(pct)),
                    label=label,
                    is_active=True,
                    display_order=i,
                )
            )


def _get_or_create_config(db: Session, company_id: str) -> FoodCostConfig:
    """Return the active configuration for a company, creating + seeding one
    (with defaults) when it does not yet exist."""
    config = (
        db.query(FoodCostConfig)
        .filter(
            FoodCostConfig.company_id == company_id,
            FoodCostConfig.is_active.is_(True),
        )
        .first()
    )
    if config is None:
        config = FoodCostConfig(company_id=company_id, version=1, is_active=True)
        db.add(config)
        db.flush()
        _seed_defaults(db, config)
        db.flush()
    return config


def _get_active_config(db: Session, company_id: str) -> Optional[FoodCostConfig]:
    return (
        db.query(FoodCostConfig)
        .filter(
            FoodCostConfig.company_id == company_id,
            FoodCostConfig.is_active.is_(True),
        )
        .first()
    )


def get_management_cost_percentage(config: FoodCostConfig) -> Decimal:
    """PRIVATE: total of active management cost-head percentages. The engine
    uses this internally and never exposes it outside the admin settings API."""
    total = Decimal("0")
    for head in config.cost_heads:
        if head.is_active:
            total += _pct(head.percentage)
    return _pct(total)

def _money(value: Any) -> Decimal:
    return _dec(value).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _pct(value: Any) -> Decimal:
    return _dec(value).quantize(PCT_QUANT, rounding=ROUND_HALF_UP)
# ---------------------------------------------------------------------------
# Existing ingredient rate infrastructure (Item Master / Recipe costing)
# ---------------------------------------------------------------------------
def get_item_rate(
    db: Session,
    item_id: str,
    company_id: str,
    calc_date: Optional[date] = None,
) -> Decimal:
    """Return the applicable ingredient rate.

    The existing Recipe/BOM costing engine prices a raw material with its Item
    Master ``cost_price``; this engine uses the SAME source so a Food Cost never
    disagrees with recipe costing. ``calc_date`` is accepted for parity with a
    date-aware rate infrastructure. This installation keeps a single
    identifiable Item Master rate (no separate date-wise rate table exists),
    therefore the rate used is always the current Item Master rate and is
    present verbatim in every result line / snapshot.

    If no valid rate exists the engine REFUSES to continue (never returns 0).
    """
    item = (
        db.query(Item)
        .filter(Item.id == item_id, Item.company_id == company_id)
        .first()
    )
    if item is None:
        raise ValueError("Ingredient item not found in Item Master.")
    rate = _dec(item.cost_price)
    if rate <= 0:
        raise ValueError("Rate unavailable for this ingredient/date.")
    return _money(rate)


def normalize_quantity(
    db: Session,
    company_id: str,
    quantity: Decimal,
    from_unit_id: str,
    to_unit_id: str,
) -> Decimal:
    """Normalize an entered quantity into the item's base unit using the
    existing Unit Master / UnitConversion rules. Raises for incompatible units."""
    return convert_quantity(
        db,
        company_id=company_id,
        value=quantity,
        from_unit_id=from_unit_id,
        to_unit_id=to_unit_id,
    )


# ---------------------------------------------------------------------------
# STEP 1 -> 3 : Ingredient Cost, Management Cost, Total Cost
# ---------------------------------------------------------------------------
def calculate_food_cost(
    db: Session,
    company_id: str,
    ingredients: List[Dict[str, Any]],
    calculation_date: Optional[date] = None,
) -> Dict[str, Any]:
    """Run the Food Cost calculation for one ingredient list.

    STEP 1  Ingredient Cost = SUM(normalized quantity x applicable rate)
    STEP 2  Management Cost = Ingredient Cost x (active management cost %)
    STEP 3  Total Cost      = Ingredient Cost + Management Cost

    Returns a plain dict; no management cost heads/percentages are included
    (those are private configuration).
    """
    if not ingredients:
        raise ValueError("At least one ingredient is required.")

    config = _get_or_create_config(db, company_id)
    calc_date = calculation_date or date.today()

    ingredient_rows: List[Dict[str, Any]] = []
    total_ingredient_cost = Decimal("0")

    for line in ingredients:
        item_id = line.get("item_id")
        quantity = line.get("quantity")
        unit_id = line.get("unit_id")

        if not item_id:
            raise ValueError("Each ingredient requires an item.")
        if not unit_id:
            raise ValueError("Each ingredient requires a unit.")

        qty = _dec(quantity)
        if qty <= 0:
            raise ValueError("Quantity must be greater than zero.")

        item = (
            db.query(Item)
            .filter(Item.id == item_id, Item.company_id == company_id)
            .first()
        )
        if item is None:
            raise ValueError("Ingredient not found in Item Master.")
        if not item.unit_id:
            raise ValueError(f"Item '{item.code}' has no base unit configured.")

        rate = get_item_rate(db, item_id, company_id, calc_date)
        normalized = normalize_quantity(
            db, company_id, qty, from_unit_id=unit_id, to_unit_id=item.unit_id
        )
        line_cost = _money(normalized * rate)

        user_unit = (
            db.query(Unit)
            .filter(Unit.id == unit_id, Unit.company_id == company_id)
            .first()
        )

        ingredient_rows.append(
            {
                "item_id": item.id,
                "item_name": item.name,
                "item_code": item.code,
                "quantity": _money(qty),
                "unit_id": unit_id,
                "unit_symbol": user_unit.symbol if user_unit else None,
                "normalized_quantity": normalized,
                "rate": rate,
                "ingredient_cost": line_cost,
            }
        )
        total_ingredient_cost += line_cost

    total_ingredient_cost = _money(total_ingredient_cost)

    # STEP 2 (management cost uses the PRIVATE configuration internally only)
    mgmt_pct = get_management_cost_percentage(config)
    management_cost = _money(total_ingredient_cost * mgmt_pct / Decimal("100"))

    # STEP 3
    total_cost = _money(total_ingredient_cost + management_cost)

    return {
        "ingredients": ingredient_rows,
        "ingredient_cost": total_ingredient_cost,
        "management_cost": management_cost,
        "management_cost_percentage": mgmt_pct,
        "total_cost": total_cost,
        "calculation_date": calc_date,
        "config_id": config.id,
    }


# ---------------------------------------------------------------------------
# STEP 4 : Selling cost + markup validation
# ---------------------------------------------------------------------------
def calculate_selling_cost(total_cost: Decimal, markup_percentage: Decimal) -> Decimal:
    """Final Selling Cost = Total Cost x (1 + Markup % / 100)."""
    multiplier = Decimal("1") + (markup_percentage / Decimal("100"))
    return _money(total_cost * multiplier)


def get_active_markup_options(db: Session, company_id: str) -> List[FoodCostMarkupOption]:
    """Enabled markup options (visible on the Main page), ordered by display."""
    config = _get_or_create_config(db, company_id)
    options = [mo for mo in config.markup_options if mo.is_active]
    options.sort(key=lambda mo: (mo.display_order, mo.percentage))
    return options


def validate_markup_percentage(
    db: Session, company_id: str, markup_percentage: Decimal
) -> FoodCostMarkupOption:
    """A mark-up is only valid when it is one of the ENABLED options."""
    config = _get_or_create_config(db, company_id)
    target = _pct(markup_percentage)
    for mo in config.markup_options:
        if mo.is_active and _pct(mo.percentage) == target:
            return mo
    raise ValueError(
        "Invalid mark-up. The selected mark-up percentage is not enabled."
    )


# ---------------------------------------------------------------------------
# Immutable snapshot persistence (history)
# ---------------------------------------------------------------------------
def save_food_cost_snapshot(
    db: Session,
    company_id: str,
    calculation_result: Dict[str, Any],
    selected_markup: Optional[Decimal] = None,
    idempotency_key: Optional[str] = None,
    created_by_id: Optional[str] = None,
) -> FoodCostSnapshot:
    """Persist a complete immutable snapshot of a calculation.

    Older snapshots are never modified when configuration changes later; only
    new calculations use the new configuration. Repeated saves with the same
    idempotency key return the existing record instead (duplicate protection).
    """
    if idempotency_key:
        existing = (
            db.query(FoodCostSnapshot)
            .filter(FoodCostSnapshot.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return existing

    final_selling_cost = None
    if selected_markup is not None:
        final_selling_cost = calculate_selling_cost(
            calculation_result["total_cost"], selected_markup
        )

    calc_date = calculation_result["calculation_date"]
    effective_date = (
        datetime.combine(calc_date, datetime.min.time())
        if isinstance(calc_date, date) and not isinstance(calc_date, datetime)
        else calc_date
    )

    snapshot = FoodCostSnapshot(
        company_id=company_id,
        config_id=calculation_result.get("config_id"),
        calculation_date=datetime.utcnow(),
        effective_date=effective_date,
        ingredient_cost=calculation_result["ingredient_cost"],
        management_cost_total=calculation_result["management_cost"],
        management_cost_percentage=calculation_result.get(
            "management_cost_percentage", Decimal("0")
        ),
        total_cost=calculation_result["total_cost"],
        selected_markup_percentage=selected_markup,
        final_selling_cost=final_selling_cost or Decimal("0"),
        ingredient_lines=json.dumps(calculation_result["ingredients"], default=str),
        idempotency_key=idempotency_key,
        created_by_id=created_by_id,
    )
    db.add(snapshot)
    db.flush()
    return snapshot
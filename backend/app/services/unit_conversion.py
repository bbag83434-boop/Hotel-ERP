from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from app.models.inventory import Unit, UnitConversion

# Canonical factors. Every calculation is performed with Decimal; only the
# final stock quantity is rounded to the ERP's 4-decimal precision.
STANDARD = {
    ('kg','g'): Decimal('1000'), ('g','kg'): Decimal('0.001'),
    ('kg','mg'): Decimal('1000000'), ('mg','kg'): Decimal('0.000001'),
    ('g','mg'): Decimal('1000'), ('mg','g'): Decimal('0.001'),
    ('ton','kg'): Decimal('1000'), ('tonne','kg'): Decimal('1000'),
    ('kg','ton'): Decimal('0.001'), ('kg','tonne'): Decimal('0.001'),
    ('l','ml'): Decimal('1000'), ('litre','ml'): Decimal('1000'), ('liter','ml'): Decimal('1000'),
    ('ml','l'): Decimal('0.001'), ('ml','litre'): Decimal('0.001'), ('ml','liter'): Decimal('0.001'),
    ('dozen','pcs'): Decimal('12'), ('dozen','pieces'): Decimal('12'),
    ('pcs','dozen'): Decimal('0.0833333333333333333333333333'),
    ('pieces','dozen'): Decimal('0.0833333333333333333333333333'),
}

ALIASES = {'gram':'g','grams':'g','kilogram':'kg','kilograms':'kg','milligram':'mg','milligrams':'mg',
           'liters':'l','litres':'litre','piece':'pcs','pieces':'pcs'}

def _symbol(unit):
    return (unit.symbol or unit.name or '').strip().lower()

def convert_quantity(db: Session, company_id: str, value: Decimal, from_unit_id: str | None, to_unit_id: str | None) -> Decimal:
    """Convert recipe/transaction quantity into the item's stock unit."""
    value = Decimal(str(value))
    if value < 0:
        raise ValueError('Quantity cannot be negative')
    if not from_unit_id or not to_unit_id or from_unit_id == to_unit_id:
        return value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    units = db.query(Unit).filter(Unit.company_id == company_id, Unit.id.in_([from_unit_id, to_unit_id])).all()
    by_id = {u.id: u for u in units}
    fu, tu = by_id.get(from_unit_id), by_id.get(to_unit_id)
    if not fu or not tu:
        raise ValueError('Recipe unit is invalid for this company')
    fs, ts = ALIASES.get(_symbol(fu), _symbol(fu)), ALIASES.get(_symbol(tu), _symbol(tu))
    if fs == ts:
        return value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    row = db.query(UnitConversion.conversion_factor).filter(
        UnitConversion.company_id == company_id,
        UnitConversion.from_unit_id == from_unit_id,
        UnitConversion.to_unit_id == to_unit_id,
    ).first()
    if row:
        factor = Decimal(str(row[0]))
    else:
        factor = STANDARD.get((fs, ts))
    if factor is None:
        raise ValueError(f'No conversion configured from {fu.symbol} to {tu.symbol}')
    return (value * factor).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

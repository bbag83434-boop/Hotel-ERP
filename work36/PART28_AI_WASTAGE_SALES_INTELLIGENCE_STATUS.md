# PART 28 — AI Wastage / Sales Intelligence

Implemented on the cumulative Part 1–27 codebase. Existing Parts were preserved; only the Part 28 intelligence slice was added.

## Implemented
- Outlet-scoped AI Wastage & Sales Intelligence API.
- Uses actual stored `RestaurantOrder` / `OrderItem` data for completed sales.
- Uses approved `WastageEntry` / `WastageItem` data only for loss intelligence.
- Period-over-period sales comparison.
- Average bill calculation.
- Top-selling products by actual revenue.
- Low-selling products by actual quantity.
- Peak-hour analysis from completed order timestamps.
- Wastage cost and period-over-period change.
- Wastage as a percentage of sales.
- Highest-loss wastage items.
- Deterministic abnormality signals for wastage surge, wastage-to-sales risk and sales decline.
- No AI-generated arithmetic, invented data, automatic stock mutation, purchase creation or approval.
- Frontend workspace added as `AI Wastage & Sales` using the existing design system and active outlet scope.
- 7/14/30/90-day analysis selector.
- No new database tables required.

## Verification
- Python `compileall` passed.
- Frontend source files/imports were checked.
- Full Next.js production build was not run because frontend dependencies are not included in the archive.
- Live database/integration execution requires the project's configured PostgreSQL environment.

## Next Part
PART 29 — Telegram Integration.

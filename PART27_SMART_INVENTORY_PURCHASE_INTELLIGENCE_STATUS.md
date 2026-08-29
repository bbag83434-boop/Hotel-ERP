# PART 27 — Smart Inventory / Purchase Intelligence

Implemented on the cumulative Part 1–26 codebase without rebuilding completed modules.

## Implemented
- Deterministic outlet inventory intelligence endpoint.
- Reuses the existing smart requirement calculation engine rather than creating a duplicate stock calculation path.
- Current stock, minimum/target stock, pending inbound, daily consumption and days-of-cover analysis.
- Critical/high/medium replenishment prioritization.
- Existing `SupplierItem` mappings used for preferred supplier, purchase price, purchase-unit conversion rate and lead time.
- Estimated purchase value calculation.
- Read-only recommendation boundary: no stock mutation, PO creation or approval from the intelligence endpoint.
- Existing Purchase Request approval workflow remains the action boundary.
- Frontend Smart Inventory / Purchase Intelligence panel added to the existing Purchase → Smart workspace.
- Outlet/company authorization is enforced before intelligence is calculated.
- No fake business data and no new database tables required.

## Verification
- Python syntax/AST validation performed after implementation.
- Existing deterministic smart requirement tests retained.
- Frontend source imports/routing inspected.
- Full Next.js production build requires installed frontend dependencies and was not available in the archive.

## Next Part
PART 28 — AI Wastage / Sales Intelligence.

# PART 19 — Cashier Shift & Payment Reconciliation

Implemented on top of Part 18 without rebuilding existing modules.

## Backend
- Cashier shift model with OPEN/CLOSED/RECONCILED lifecycle
- Opening float and generated session number
- Cash movement ledger: float start, cash sale, UPI sale, card sale, cash in, cash out, safe drop
- Live expected drawer calculation
- POS checkout integration for CASH/UPI/CARD when payment method is supplied
- Cash received validation for cash sales
- Physical closing count and variance calculation
- Manager reconciliation with audit log
- Outlet/company scope validation
- Shift history
- Idempotent schema bootstrap via SQLAlchemy metadata create_all

## Frontend
- Cashier Shift & Reconcile workspace
- Open shift
- Live cash/UPI/card metrics
- Cash in/out/safe drop
- Close shift and variance
- Manager reconciliation
- Shift history
- Added sidebar entry
- Existing Orders checkout now records payment method against the active cashier shift

## Validation
- Python backend compileall: PASS
- Frontend TypeScript check cannot be cleanly completed in this environment because the archive has no installed node_modules; existing project dependency/type errors remain.
- No fake business data or seed transactions added.

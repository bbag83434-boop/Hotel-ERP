# PART 20 — Expense Management & Cash/Bank Reconciliation

Implemented on top of Part 19 without rebuilding existing modules.

## Backend
- Expense master with pending/approved status
- Expense approval posts a balanced double-entry journal
- Cash/Bank/UPI/Card payment account mapping
- Account reconciliation records with book vs statement balance and variance
- Reconciliation close workflow
- Company and outlet scope validation
- Audit logs
- Schema bootstrap

## Frontend
- Expense & Reconciliation workspace
- Live summary cards
- Expense listing and approval
- Reconciliation listing and close action
- Expense creation form
- Reconciliation creation form
- Existing Finance and Cashier Shift workspaces preserved

## Safety
- No fake transaction/seed data added.
- Existing Parts 1–19 files were retained.
- Full production build was not run because dependencies are not bundled.

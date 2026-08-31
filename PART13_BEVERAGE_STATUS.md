# PART 13 — Beverage & Controlled Beverage Inventory

Added a dedicated beverage/alcohol inventory module without modifying existing inventory/order stock tables.

Backend:
- beverage_items and beverage_ledger schema bootstrap
- outlet/company scoped access
- beverage/alcohol item master
- opening/purchase/transfer/sale/complimentary/breakage/wastage/adjustment ledger transactions
- negative-stock protection
- summary and ledger endpoints
- audit logging

Frontend:
- Beverage Control workspace
- item master
- stock view
- beverage/alcohol type
- sale/in/wastage actions
- ledger view
- outlet scoped data

No fake data or seed records were added.

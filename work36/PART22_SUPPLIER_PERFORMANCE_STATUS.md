# Part 22 — Supplier Performance & Procurement Intelligence

## Implemented
- Live supplier performance endpoint derived from existing Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceiveNote/GoodsReceiveItem, VendorBill and Payment records.
- Company isolation and `procurement:read` permission.
- Optional outlet scope and 30/90/180/365-day window.
- PO spend, order/receipt quantities, fulfillment %, on-time delivery %, average delivery delay, rejection/damage quality issue %, bills, paid amount and outstanding amount.
- Deterministic supplier rating for comparative ranking; no persisted/fake rating data.
- Responsive frontend workspace with KPI cards, filters, supplier ranking table and scope indicator.
- Sidebar/AppContent integration.

## Definition notes
- On-time delivery is calculated for POs with an expected delivery date and at least one non-rejected GRN, using the first GRN receive date.
- Fulfillment compares received quantity against approved quantity where present, otherwise ordered quantity.
- Quality issue % = (rejected + damaged) / (received + rejected + damaged).
- Purchase spend excludes cancelled/rejected POs.
- Outstanding is bill net amount minus linked posted/paid supplier payments in the selected window.

## Verification
- Python syntax compilation: PASS.
- ZIP integrity: PASS after packaging.
- No fake business transactions inserted.
- Full Next.js build not guaranteed in this environment because dependencies are not bundled/installed.

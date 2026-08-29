# PART 12 — Maintenance & Asset Management

Implemented on top of the Part 11 codebase without rebuilding existing modules.

## Backend
- MaintenanceAsset master with outlet/company scope.
- MaintenanceTicket workflow: OPEN → IN_PROGRESS → WAITING_PARTS → COMPLETED/CANCELLED.
- Priority: LOW/MEDIUM/HIGH/CRITICAL.
- Estimated vs actual cost.
- Downtime minutes.
- Vendor and assignee fields.
- Warranty/service-contract dates.
- Overdue ticket calculation.
- Warranty expiry within 30 days calculation.
- Company/outlet authorization checks.
- Audit logs for create/update operations.
- Compatibility bootstrap creates only the two maintenance tables and indexes when absent.

## Frontend
- Maintenance Center workspace.
- Repair ticket queue.
- Asset register.
- KPI cards for open/critical/overdue/cost.
- Search.
- Create asset.
- Create ticket.
- Ticket status controls.
- Warranty-expiry warning.
- Mobile-responsive UI using the existing project components/theme.

## Data safety
- No fake/demo maintenance records are inserted.
- Existing Orders, Stock, Purchase, Recipe, Wastage, HR, CRM and KDS code is preserved.

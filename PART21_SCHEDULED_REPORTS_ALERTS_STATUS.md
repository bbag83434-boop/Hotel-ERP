# PART 21 — Scheduled Reports & Alerts

Implemented on top of Part 20.

## Backend
- Report schedule list/create/update endpoints.
- Daily/weekly/bi-weekly/monthly cadence validation.
- Due-schedule runner generates real ReportSnapshot records using existing report engines.
- Live alert endpoint for low stock, abnormal approved wastage, and due scheduled reports.
- Company and outlet authorization preserved.
- No fake data or external delivery credentials added.

## Frontend
- Scheduled Reports & Alerts workspace.
- Schedule creation, enable/disable, due-run, live alerts, counters and refresh.
- Existing UI components/design language reused.

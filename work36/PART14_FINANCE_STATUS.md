# Part 14 — Accounts & Finance

Added a live Finance workspace over the existing SQLAlchemy finance models.

Implemented: Chart of Accounts, deterministic double-entry journal posting with balance validation, journal history, trial balance, current-month P&L, finance summary, company isolation, existing RBAC permission checks, and finance schema bootstrap.

No fake transactions or seed journal data are created. Default chart-of-account records are created only when a company first opens Finance and has no accounts.

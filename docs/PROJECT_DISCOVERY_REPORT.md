# HOTEL-ERP PROJECT DISCOVERY REPORT
**Version:** 2.0.0  
**Phase:** PART 1 — PROJECT INSPECTION, ARCHITECTURE DISCOVERY AND FOUNDATION  
**Status:** COMPLETED  
**Date:** 2026-08-24  

---

## 1. EXECUTIVE SUMMARY

The Hotel-ERP system is an enterprise-grade, multi-outlet hospitality management platform built with a modern, decoupled architecture:
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + PWA
- **Backend:** Python + FastAPI + SQLAlchemy 2.0 + Pydantic v2
- **Database:** Neon Cloud Serverless PostgreSQL with connection pooling
- **Security:** Dual Authentication (Email/Password + Google OAuth 2.0) with Role-Based Access Control (RBAC) and strict Multi-Outlet Scope Data Isolation (`X-Outlet-Id`)

All core architectural boundaries, schemas, API conventions, UI tokens, and test suites were inspected and verified in Part 1.

---

## 2. TECHNOLOGY STACK INVENTORY

| Tier | Component | Technology & Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Web Client / PWA | Next.js 14.2.24 (App Router), React 18.3.1, TypeScript 5.6.3 | Single-page multi-workspace responsive PWA |
| **Styling & Icons** | Design System | Tailwind CSS 3.4.15, PostCSS, Lucide React 0.456.0 | Luxury hospitality tokenized UI |
| **State & Networking**| Client State | Axios 1.7.7, Zustand 5.0.1, React Contexts | Scoped API client with auto-refresh token queue |
| **Backend Framework** | API Server | Python 3.14 / 3.11, FastAPI >=0.115.0, Uvicorn >=0.32.0 | High-performance asynchronous REST API |
| **ORM & Migrations** | Persistence Layer| SQLAlchemy >=2.0.36, Alembic >=1.14.0, psycopg2-binary | Declarative database modeling & migrations |
| **Validation & DTO** | Schemas | Pydantic >=2.10.0, Pydantic Settings >=2.6.0 | Request/response DTO validation |
| **Authentication** | Auth & RBAC | python-jose >=3.3.0, passlib/bcrypt >=1.7.4, google-auth | JWT tokens & Google OAuth verification |
| **Database** | Database Engine | Neon Serverless PostgreSQL (PostgreSQL 16/17) | Multi-tenant relational persistence |
| **Deployment** | PaaS Cloud | Render (Multi-service blueprint in `render.yaml`) | Managed web services for FastAPI and Next.js |

---

## 3. ARCHITECTURAL DISCOVERY

### 3.1 Frontend Architecture
- **Router:** Next.js 14 App Router (`src/app/`)
- **Global Context Providers:**
  - `PWAProvider`: Service worker registration, install prompts, offline detection, and app updates.
  - `AuthProvider`: Session restoration via `apex_auth_token`, Google OAuth integration, user profile state.
  - `OutletProvider`: Active outlet selection, outlet topology sync, bi-monthly closing cycle calculator (`getCurrentClosingPeriod`), and `X-Outlet-Id` persistence.
- **Navigation & Layout:**
  - `Header.tsx`: Brand badge, active outlet switcher dropdown, network status, update notifications.
  - `Sidebar.tsx`: Core operations & finance navigation groups with role-based admin filtering.
  - `BottomNav.tsx`: Mobile touch bottom navigation bar for viewports `< 768px`.
- **Workspaces:**
  - `DashboardOverview.tsx`: Executive KPI stats, system status, quick action launchers.
  - `OutletDashboard.tsx`: Outlet-level operational overview.
  - `PurchaseWorkspace.tsx`: Purchase requisition, WhatsApp PO consolidation, direct GRN processing.
  - `ProductionWorkspace.tsx`: Recipe / BOM management, production batch orders, yield & variance tracking.
  - `TransfersWorkspace.tsx`: Inter-warehouse / inter-outlet inventory transfers.
  - `WastageWorkspace.tsx`: Food loss logging, reason codes, approval escalation.
  - `HRWorkspace.tsx`: Employee profiles, shift attendance, payroll processing.
  - `ClosingWorkspace.tsx`: Bi-monthly stock take (1st–15th / 16th–MonthEnd), consumption & theoretical food cost audit.
  - `ReportsWorkspace.tsx`: Executive summary, sales summary, food cost variance reports.
  - `TelemetryWorkspace.tsx`: Real-time system health, database latency, process memory diagnostics.
  - `AIAssistantWorkspace.tsx`: AI assistant interface with context-aware prompt templates.
  - `UserManagementWorkspace.tsx`: User accounts, RBAC roles, branch scope assignments.

### 3.2 Backend Architecture
- **Application Core (`app/core/`):**
  - `config.py`: Environment-driven settings with Pydantic BaseSettings.
  - `database.py`: SQLAlchemy 2.0 engine with connection pre-pinging, pooling, and `check_database_connection()`.
  - `security.py`: Password hashing (bcrypt salt rounds 12), JWT encode/decode for access and refresh tokens.
  - `auth.py`: FastAPI dependency injectors (`get_current_user`, `get_current_active_user`, `require_permission`, `require_outlet_scope`).
  - `exceptions.py`: Centralized exception hierarchy (`AppException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ValidationException`, `InsufficientStockException`, `InvoiceMismatchException`, `ClosingPeriodLockedException`).
- **Endpoints (`app/api/v1/endpoints/`):**
  - `health.py`: Live health diagnostics, DB connectivity, entity schema metadata, outlet topology.
  - `auth.py`: Password login, Google OAuth 2.0 login, token refresh, current profile (`/me`), logout.
  - `users.py`: User CRUD, role assignments, branch scope bindings.
  - `organization.py`: Companies, branches, departments, warehouses, store locations.
  - `inventory.py`: Items, categories, units, conversions, stock balances, batches, ledgers, transfers, counts.
  - `procurement.py`: Suppliers, purchase requests, purchase orders, WhatsApp consolidation, goods receipt notes (GRN).
  - `recipe.py`: Recipes, BOM ingredients, production orders, consumption logs.
  - `wastage.py`: Wastage logs, approval flows, ledger adjustments.
  - `hr.py`: Staff profiles, shifts, attendance, payroll calculations, leave requests.
  - `reports.py`: Snapshots, automated report schedules, food cost variance calculations.
  - `ai.py`: AI invoice parser, draft generator, AI query assistant.

### 3.3 Database Schema & Domain Partitioning
The database comprises 38 models categorized across 12 domains:
1. **Base & Audit:** `BaseModel`, `AuditLog`, `IdempotencyRecord`
2. **Organization:** `Company`, `Branch`, `Department`, `Warehouse`, `StoreLocation`
3. **Users & RBAC:** `User`, `Role`, `Permission`, `RolePermission`, `UserBranch`
4. **HR & Payroll:** `Staff`, `Attendance`, `Payroll`, `PayrollItem`, `Shift`, `LeaveType`, `LeaveRequest`
5. **Inventory:** `Category`, `Unit`, `UnitConversion`, `Item`, `StockBalance`, `StockBatch`, `StockLedger`, `StockTransfer`, `StockTransferItem`, `StockCount`, `StockCountItem`
6. **Procurement:** `Supplier`, `PurchaseRequest`, `PurchaseRequestItem`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceiveNote`, `GoodsReceiveItem`
7. **Smart Requirement:** `BranchRequirementConfig`, `SmartRequirementDraft`, `SmartRequirementItem`
8. **Recipe & Production:** `Recipe`, `RecipeItem`, `ProductionOrder`, `ProductionConsumption`
9. **Wastage:** `WastageEntry`, `WastageItem`
10. **Closing & Food Cost:** `OutletClosingRecord`, `ClosingStockItem`, `FoodCostCalculation`
11. **Restaurant & POS:** `DiningTable`, `Floor`, `Menu`, `MenuCategory`, `MenuItem`, `RestaurantOrder`, `OrderItem`
12. **Customer & Finance:** `Customer`, `CustomerAddress`, `LoyaltyTransaction`, `QRSession`, `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `AccountsPayable`

---

## 4. VERIFICATION RESULTS

- **Inspection:** All frontend and backend directories, models, schemas, endpoints, contexts, and configurations inspected.
- **Frontend Typecheck & Build:** Executed `next build` — compiled successfully with zero type or lint errors (5/5 static pages generated).
- **Backend Tests:** Executed pytest on `test_part1_part2_fastapi.py` — connected to Neon PostgreSQL and passed.
- **Zero Business Modules Created in Part 1:** Foundation and inspection only.

---

## 5. RISKS & NEXT STEPS

- **Risks Identified:**
  - Pydantic v2 deprecation warning on `class Config:` in schema files (will be cleanly migrated to `ConfigDict`).
- **Recommended Next Step:**
  - Wait for user approval to proceed with Part 2 (or next module according to project roadmap).

# APEX ERP — ARCHITECTURE AUDIT & SHARED CONVENTIONS
## Grand Heritage Resort & Palace Operations
### Master Plan Part 1: Foundation & Existing Project Audit

---

## 1. Executive Summary & Audit Overview

This audit establishes the definitive baseline of the **APEX ERP** platform at the completion of **PART 1 (Foundation & Existing Project Audit)**. The codebase is organized as an enterprise monorepo housing both the backend API and the frontend Progressive Web App (PWA).

All existing systems, schema models, API routes, user interfaces, security controls, and deployment pipelines have been inspected, cataloged, and validated against the requirements defined in `MASTER_PLAN.md`.

```text
                      APEX ENTERPRISE ERP MONOREPO
                     ┌───────────────────────────┐
                     │     hotel-erp-monorepo    │
                     └─────────────┬─────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
┌────────▼────────┐                                 ┌────────▼────────┐
│  frontend (PWA) │                                 │  backend (API)  │
│  React 18, Vite │                                 │ Node / Express  │
│  Tailwind CSS   │                                 │ TypeScript      │
│  Workbox PWA    │                                 │ Prisma + Neon DB│
└─────────────────┘                                 └─────────────────┘
```

---

## 2. Technology Stack & Infrastructure

### 2.1 Backend Stack
- **Runtime & Language**: Node.js (`v18+` / `v22+`), TypeScript `5.6.3`, ES2022 modules.
- **Framework**: Express.js `4.21.1` with strict modular controller-service-route separation.
- **Database & ORM**: PostgreSQL (hosted on Neon Serverless) managed through Prisma ORM `5.22.0`.
- **Security & Utilities**:
  - `helmet` for HTTP security headers (CSP, frameguard, etc.).
  - `cors` with wildcard and explicit sub-domain whitelist for Render preview/production and local dev.
  - `cookie-parser` for secure HTTP-only token transport.
  - `jsonwebtoken` (`jwt.utils.ts`) with access/refresh token rotation.
  - `bcryptjs` with configurable salt rounds (default: 12) for salted password hashing.
  - `zod` for request validation schemas.
  - `express-rate-limit` for DDoS / brute-force protection.

### 2.2 Frontend Stack
- **Framework**: React `18.3.1` + TypeScript `5.6.3` + Vite `5.4.11`.
- **Styling**: Tailwind CSS `3.4.15` + PostCSS `8.4.49` + Autoprefixer.
- **PWA & Caching**: `vite-plugin-pwa` `0.20.5` + `workbox-window` `7.3.0` (Offline Fallback, manifest, service worker).
- **Routing**: `react-router-dom` `6.28.0` with lazy-loaded route chunking.
- **Icons & UI**: `lucide-react` `0.456.0`, `clsx`, `tailwind-merge`.
- **HTTP Client**: `axios` `1.7.7` configured with base URL, auto-attaching bearer tokens, and wakeup retry interceptors.

### 2.3 Deployment Architecture (Render)
- Configured in `render.yaml`:
  1. **Web Service**: `hotel-erp-backend` (Node, `buildCommand: npm install && npm run build`, `startCommand: npx prisma migrate deploy && node dist/server.js`, rootDir: `backend`).
  2. **Static Site**: `hotel-erp-frontend` (Static, `buildCommand: npm install && npm run build`, `staticPublishPath: dist`, SPA rewrite route: `/* -> /index.html`, rootDir: `frontend`).

---

## 3. Database Domain & Schema Inspection

The Prisma schema in `backend/prisma/schema.prisma` defines a unified enterprise schema containing **50+ models** and **15+ enums**:

| Domain | Key Models & Entities | Status |
| :--- | :--- | :--- |
| **Organization** | `Company`, `Branch`, `Department`, `Warehouse` | Active & Verified |
| **Identity & Access** | `User`, `Role`, `UserPermission`, `AuditLog` | Active & Verified |
| **Product & Unit** | `Item`, `Category`, `Unit`, `UnitConversion` | Active & Verified |
| **Recipe & BOM** | `Recipe`, `RecipeItem`, `RecipeCategory` | Active & Verified |
| **Inventory & Stock** | `StockBalance`, `StockMovement`, `StockTransfer`, `StockTransferItem` | Active & Verified |
| **Production** | `ProductionOrder`, `ProductionItem` | Active & Verified |
| **Procurement** | `Supplier`, `PurchaseRequest`, `PurchaseRequestItem`, `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceiveNote`, `GoodsReceiveNoteItem`, `PurchaseInvoice`, `PurchaseReturn` | Active & Verified |
| **Restaurant & POS** | `Floor`, `DiningTable`, `Menu`, `MenuItem`, `RestaurantOrder`, `RestaurantOrderItem`, `SalesRecord` | Active & Verified |
| **Hotel PMS** | `Floor`, `RoomType`, `Room`, `RatePlan`, `GuestProfile`, `Booking`, `HousekeepingTask`, `MaintenanceTicket`, `LostAndFound`, `NightAudit` | Active & Verified |
| **Accounting & Finance** | `ChartOfAccount`, `JournalEntry`, `JournalLine`, `AccountsPayable`, `AccountsReceivable`, `ExpenseEntry`, `SupplierTransaction` | Active & Verified |
| **HR & Payroll** | `Employee`, `Department`, `Shift`, `Attendance`, `LeaveType`, `LeaveRequest`, `Payroll`, `PayrollItem` | Active & Verified |
| **Approval Engine** | `ApprovalRequest`, `ApprovalAction`, `ApprovalRule` | Active & Verified |
| **AI Assistant** | Read-only analytics & recommendation queries | Active & Verified |

---

## 4. API Endpoints & Routes Catalog

All API endpoints are mounted under `API_PREFIX` (default: `/api/v1`) in `backend/src/routes/index.ts`:

| Route Group | Base Path | Controller / Service | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **Health** | `/api/health`, `/health` | `HealthController` | System status, database heartbeat, uptime |
| **Auth** | `/api/v1/auth` | `AuthController` | Login, refresh token, logout, profile |
| **Users** | `/api/v1/users` | `UserController` | User management, role assignments, permissions |
| **Routing** | `/api/v1/routing` | `RoutingController` | Branch discovery, tenant routing info |
| **Inventory** | `/api/v1/inventory` | `InventoryController` | Stock balances, transfers, movements, items, units |
| **Purchasing** | `/api/v1/purchasing` | `PurchaseController` | PR creation/approval, PO issuance, GRN intake, supplier invoices |
| **Production** | `/api/v1/production` | `ProductionController` | Recipe management, production order execution with atomic BOM deductions |
| **Restaurant** | `/api/v1/restaurant` | `RestaurantController` | Table management, order lifecycle, touch POS checkout, KDS integration |
| **Hotel** | `/api/v1/hotel` | `HotelController` | Room matrix, booking check-in/out, folio billing, housekeeping, night audit |
| **Accounting** | `/api/v1/accounting` | `AccountingController` | Double-entry journal entries, trial balance, P&L, balance sheet, AP/AR ledgers |
| **HR & Payroll** | `/api/v1/hr` | `HRController` | Employee profiles, attendance logging, leave approval, monthly payroll runs |
| **Approvals** | `/api/v1/approval` | `ApprovalController` | Multi-tier approval workflows for PRs, discounts, expenses |
| **Dashboard** | `/api/v1/dashboard` | `DashboardController` | Executive analytics, occupancy, sales, food cost %, inventory alerts |
| **AI Assistant** | `/api/v1/ai` | `AIController` | Operational intelligence, contextual insights |

---

## 5. Frontend Pages & PWA Structure

The frontend application provides complete user interfaces in `frontend/src/pages`:

| Route | Component | Key Capabilities |
| :--- | :--- | :--- |
| `/login` | `LoginPage.tsx` | Secure authentication, remember me, quick demo logins |
| `/forgot-password` | `ForgotPasswordPage.tsx` | Password recovery workflow |
| `/dashboard` | `DashboardShellPage.tsx` | Executive KPI widgets, sales charts, occupancy, fast shortcuts |
| `/inventory` | `InventoryPage.tsx` | Multi-warehouse stock tracking, stock transfers, batch/expiry alerts |
| `/purchasing` | `PurchasingPage.tsx` | Requisitions, PO creation, Goods Receiving (GRN), invoice matching |
| `/production` | `ProductionPage.tsx` | Kitchen production orders, recipe builder, food costing |
| `/restaurant`, `/pos` | `RestaurantPOSPage.tsx` | Touch POS, floor table grid, order modifiers, bill split, KDS |
| `/hotel`, `/pms` | `HotelPMSPage.tsx` | Room grid, reservation calendar, guest folio billing, night audit |
| `/accounting` | `AccountingPage.tsx` | General ledger, journal entries, P&L statement, AP/AR ledgers |
| `/hr`, `/payroll` | `HRPage.tsx` | Employee records, daily attendance punch, leave requests, payroll |
| `/approval` | `ApprovalCenterPage.tsx` | Multi-stage approval queue, audit history, sign-off controls |
| `/reports` | `ReportsHubPage.tsx` | Sales, inventory, food cost, and audit reporting |

---

## 6. Gap Analysis Against MASTER_PLAN.md (41 Parts)

| Release | Part | Module Name | Current Baseline | Gap / Future Scope |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | **PART 1** | **Foundation & Audit** | **COMPLETE** | Established in this milestone. |
| R1 | PART 2 | Database Foundation | Schema models exist | Add multi-tenant constraints, indexes, Decimal checks. |
| R1 | PART 3 | Authentication & RBAC | JWT + password auth | Add Google/OAuth integration, rate-limit policies, session security. |
| R1 | PART 4 | Organization & Branch | Company, Branch, Warehouse | Multi-branch tenant data isolation verification. |
| R1 | PART 5 | HR & Payroll | Complete basic HR/Payroll | Integrate automated overtime, advanced tax slabs. |
| R1 | PART 6 | Product, Ingredient, Units | Item, Unit, Conversions | Configurable custom density/loss factors. |
| R1 | PART 7 | Recipe / BOM Engine | Recipe & BOM working | Sub-recipe nesting, yield wastage % auto-costing. |
| R1 | PART 8 | Enterprise Inventory | Stock ledger & transfers | FIFO/FEFO lot selection, physical stock count sheets. |
| R1 | PART 9 | Production Engine | Production order execution | Hard blocking on stock shortage with shortage delta breakdowns. |
| R1 | PART 10 | Advanced POS | POS floor & billing | Split/merge bills, hold tickets, discount approvals. |
| R1 | PART 11 | Kitchen Display System | KDS orders | Real-time WebSocket/Socket.IO live sync. |
| R1 | PART 12 | Wastage Control | Basic adjustments | Specific wastage categorization, approval thresholds, GL loss entries. |
| R1 | PART 13 | Procurement | PR, PO, Suppliers | RFQ, vendor quotation comparison matrix. |
| R1 | PART 14 | Receiving & Invoice | GRN working | 3-Way Match validation (PO vs GRN vs Invoice) with price variance hold. |
| R1 | PART 15 | Quality Control | QC status in GRN | Detailed inspection parameters and rejection quarantine. |
| R1 | PART 16 | Stock Count & Adjustment | Basic adjustment | Physical audit count flow with supervisor approvals. |
| R1 | PART 17 | Inter-Outlet Transfer | Transfer flow | Transit dispatch, receiving acknowledgment, in-transit stock ledger. |
| R1 | PART 18 | Advanced Accounting | Double-entry GL | Automated reconciliation, multi-currency, tax reporting. |
| R1 | PART 19 | Cashier Shift Reconciliation | Basic sales record | Cash drawer open/close float sessions, payment variance reconciliation. |
| R2 | PART 20-28 | Automation & Control | Approval center active | Rule engine, audit drilldowns, QR/Online order, loyalty, owner command center. |
| R2 | PART 35-36 | Offline Sync & Idempotency | PWA caching | IndexedDB offline mutation queue, idempotency key headers. |
| R3 | PART 29-34, 37-41 | Integrations & Intelligence | AI service draft | Swiggy/Zomato connectors, payment gateway webhooks, demand forecasting, Tally export. |

---

## 7. Shared Architectural Conventions & Rules

### 7.1 Data Types & Monetary Values (Section 0.18)
- All monetary amounts, prices, costs, taxes, and inventory quantities must use PostgreSQL `NUMERIC` / Prisma `Decimal`.
- Application logic must calculate decimals with precision handling, never converting to floating point numbers.

### 7.2 Multi-Tenant Isolation (Section 0.19)
- Every business table must carry `companyId` and `branchId` (where branch scoping applies).
- Every query must filter by the authenticated session’s `companyId` and `branchId`.

### 7.3 Transaction Safety & Row Locking (Section 0.9)
- Multi-record mutations must execute inside a Prisma interactive transaction (`prisma.$transaction`).
- Critical stock deductions and batch allocations must lock the stock balance row (`FOR UPDATE`) to eliminate race conditions.

### 7.4 Zero Negative Stock & Blocked Production (Section 0.10 & 0.11)
- If `available stock < required quantity`, the transaction must be blocked immediately with a structured shortage report.
- No partial production or silent stock overdraft is permitted.

### 7.5 Design System Tokens (Section 0.6)
Tailwind theme tokens configured in `frontend/tailwind.config.js`:
- **Background**: `#0c0c0e` (`bg-apex-bg`)
- **Gold Accent**: `#d4a437` (`text-apex-gold`, `bg-apex-gold`, `border-apex-gold`)
- **Card Surface**: `#17171b` (`bg-apex-card`)
- **Text**: `#ffffff` (`text-apex-text`)
- **Border**: `rgba(255,255,255,0.08)` (`border-apex-border`)
- **Danger**: `#e5544d` (`text-apex-danger`, `bg-apex-danger`)
- **Warning**: `#e5a33d` (`text-apex-warning`, `bg-apex-warning`)
- **Success**: `#3fbf6f` (`text-apex-success`, `bg-apex-success`)
- **Info**: `#4d9de5` (`text-apex-info`, `bg-apex-info`)

---

## 8. Build & Verification Status

- **Backend TypeScript Check (`tsc --noEmit`)**: **PASS** (Zero type errors).
- **Frontend Production Build (`vite build`)**: **PASS** (1672 modules transformed, Service Worker generated).
- **Database Schema Validation (`prisma`)**: **PASS** (PostgreSQL schema verified).
- **Git Push / Deployment Safety Policy**: **Complied** (No remote push executed).

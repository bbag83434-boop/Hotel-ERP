# Unified Enterprise Restaurant & Hotel ERP Platform (Apex ERP)

A modular, scalable, secure, and production-ready Enterprise ERP Monorepo designed for multi-branch, multi-company restaurant and hotel operations. Built strictly adhering to the architectural rules of `AI_CONTEXT.md`.

---

## 🏗️ Architecture & Technology Stack

- **Backend**: Node.js + Express.js + TypeScript + Prisma ORM + PostgreSQL (Neon DB)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + PWA (Workbox Service Worker, Web Manifest, Code-Splitting)
- **Database**: Serverless PostgreSQL via Neon DB
- **Deployment**: Render Blueprint (`render.yaml`) for backend web service & static frontend site

---

## 📦 Complete Integrated Enterprise Modules

### 1. Project Foundation & Multi-Tenant Core (Section 1–3, 17)
- Multi-company & multi-branch tenant structure with branch-switcher context.
- Super Admin, Admin, Manager, and Staff RBAC permission engine with 39 granular permissions.
- Immutable Audit Logging on every write operation capturing actor, IP, timestamp, and JSON delta snapshot.

### 2. Inventory, Procurement & Kitchen Production (Section 7, 8, 9)
- Master Item catalog, multi-warehouse stock balances, batch & expiry tracking.
- Automated Purchase Request -> PO -> Goods Receive Note (GRN) with weighted-average cost recalculation.
- Bill of Materials (BOM) Recipes with automatic stock deductions upon Production Order execution and POS checkout.

### 3. Restaurant Dining POS & Kitchen Display (Section 5, 10)
- Interactive Floor Table Management (Free, Occupied, Reserved, Billed).
- Fast Touch POS Terminal with modifier support, split bills, and automatic KDS ticket generation.
- Real-time stock decrement via BOM recipes and automated double-entry GL sales posting.

### 4. Hotel PMS & Front Desk (Section 6)
- Interactive Room Status Matrix (Available, Reserved, Occupied, Dirty Cleaning, Maintenance).
- Complete Guest Folio billing, room charges, advance deposits, and check-in / check-out workflows.
- Housekeeping task management, maintenance work-orders, and automated Night Audit daily rate posting.

### 5. Accounting & Financial Management (Section 11, 14)
- Double-Entry General Ledger (Debit = Credit balanced journal engine).
- Standard Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense).
- Dynamic real-time Profit & Loss (P&L) Statement, Statement of Cash Flows, and AP/AR sub-ledgers.
- Automated GL transaction hooks triggered on POS sales, Hotel folios, Purchases, and Payroll runs.

### 6. HR & Payroll Management (Section 12)
- Employee master profiles, departments, designation, and employment contracts.
- Shift management & daily check-in / check-out attendance tracker with work-hour computation.
- Leave request submission and managerial approval workflows.
- Automated Monthly Payroll Run: generates payslips and posts GL salary disbursement journal (`6010 Staff Salaries` -> `1020 Operating Bank`).

### 7. Real Approval Center Engine (Section 13)
- Multi-step authorization gatekeeper for Purchase Requests, high POS Discounts, and Expenses.
- Detailed audit trail capturing approver, role, timestamp, and review comments.

### 8. Unified Executive Dashboard & AI Assistant (Section 4, 15)
- Consolidated executive metrics computed with database-level aggregations (Total Revenue, Gross Margin, Occupancy %, ADR, RevPAR, Low Stock alerts).
- Enterprise AI Assistant operating strictly in Read-Only mode against financial data, guiding users to authorized approval workflows.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js `v18+` or `v24+`
- npm `v9+`
- Neon PostgreSQL Database

### 2. Environment Configuration
Copy `.env.example` to `.env` in the root and `/backend`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is set to your PostgreSQL connection string.

### 3. Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 4. Database Setup & Seeding
```bash
cd backend
npx prisma db push
npx prisma db seed
```
> **Default Super Admin Credentials**:
> - **Identifier**: `admin` or `admin@hotel-erp.com`
> - **Password**: `Admin@123456`

### 5. Run Development Servers
```bash
# Terminal 1 - Backend Server (Port 4000)
cd backend && npm run dev

# Terminal 2 - Frontend Vite Server (Port 5173)
cd frontend && npm run dev
```

### 6. Run Integration Test Suite
```bash
cd backend
npx tsx test-final-integration.ts
```

---

## 🌐 Production Deployment (Render)

1. Connect this GitHub repository to **Render**.
2. Render will automatically detect [`render.yaml`](file:///C:/Users/Biswanath%20Bag/OneDrive/Desktop/Hotel%20-ERP/render.yaml) and create both services:
   - `hotel-erp-backend` (Node Web Service)
   - `hotel-erp-frontend` (Static PWA Site)
3. Set environment variable `DATABASE_URL` in the backend service.
4. Set environment variable `VITE_API_URL` to your backend URL (e.g., `https://hotel-erp-backend.onrender.com/api/v1`) in the frontend service.

---

## 📋 Day-1 Go-Live Checklist

- [x] Verify Neon PostgreSQL connection & Prisma schemas.
- [x] Run `npx prisma db seed` to establish default Chart of Accounts, Departments, Shifts, and Permissions.
- [x] Login as Super Admin and change default password (`Admin@123456`).
- [x] Configure Branches, Central Warehouse, and Kitchen Production Stations.
- [x] Verify Restaurant Tables and Hotel Room Type masters.
- [x] Test POS sale transaction to confirm inventory decrement and GL journal posting.
- [x] Install PWA on desktop / tablet / mobile devices for offline-first resilience.

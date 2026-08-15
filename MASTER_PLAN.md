# APEX ERP — AUTONOMOUS ENTERPRISE DEVELOPMENT MASTER PLAN
## Grand Heritage Resort & Palace
### Unified Restaurant ERP + Central Kitchen + Multi-Outlet Operations + Finance + Intelligence + Hotel-Ready Architecture

> **MASTER DEVELOPMENT CONTRACT**
>
> This file is the single source of truth for the project.
> The AI coding agent must read this file before implementing any PART.
> The user will normally give only:
>
> `Read MASTER_PLAN.md. Implement PART X only.`
>
> The agent must determine the required files, dependencies, implementation details, tests, and acceptance criteria from this document without repeatedly asking for normal file-edit permissions.

---

# 0. AI AGENT OPERATING CONTRACT

## 0.1 Execution Mode

Operate in **Autonomous Development Mode**.

For normal development work, the agent is authorized to:

- Read repository files.
- Inspect directory structure.
- Search the entire codebase.
- Create required source files.
- Modify required source files.
- Refactor code directly related to the current PART.
- Create migrations required by the current PART.
- Install/add required project dependencies when technically necessary.
- Run local development commands.
- Run builds.
- Run tests.
- Run lint/type checks where configured.
- Fix errors caused by the current PART.
- Inspect database schema and existing implementation.
- Reuse existing working code.

### Do NOT repeatedly ask:

- "May I edit this file?"
- "May I create this component?"
- "May I inspect this folder?"
- "May I run the build?"
- "May I modify the related API?"

Normal repository development is already authorized.

---

# 0.2 Git Safety

The agent MUST NOT:

- `git push`
- push to GitHub
- create a remote branch
- merge a PR
- modify GitHub repository settings
- change Render deployment settings
- deploy production manually

The agent MAY:

- inspect `git status`
- inspect git history
- inspect branches
- create local commits ONLY if explicitly requested by the user

Default rule:

> **NO GIT PUSH. NO REMOTE DEPLOYMENT.**

The user will handle Git push/deployment.

---

# 0.3 Deployment Safety

Do not modify unless the current PART explicitly requires it:

- `render.yaml`
- production environment configuration
- Neon connection settings
- production secrets
- `.env`
- `.env.example` values
- deployment commands

Never hardcode:

- API keys
- OAuth secrets
- database passwords
- JWT secrets
- payment secrets
- cloud storage credentials

---

# 0.4 Database Safety

The existing Neon PostgreSQL database is the source database.

Never:

- create an unnecessary replacement database
- drop production tables
- truncate production data
- reset the database
- use destructive Prisma reset commands against production
- silently delete existing business data

Before changing existing schema:

1. Inspect current Prisma schema.
2. Inspect existing database/migrations.
3. Determine compatibility.
4. Preserve existing data.
5. Create safe migration.
6. Report migration impact.

If a destructive migration is genuinely unavoidable:

> STOP and report exactly what would be destroyed.

### Production Migration Rule — MANDATORY

Running a migration directly against the production database is prohibited.

Every migration destined for production must go through:

1. **Backup** — a verified, restorable backup of the affected tables/database taken immediately before migration.
2. **Impact report** — a written summary of exactly which tables, columns, and row counts are affected, and whether the change is additive, backward-compatible, or destructive.
3. **Rollback plan** — an explicit, tested down-migration or restore procedure, documented before the forward migration is run.

Order of operations:

```text
Draft migration
↓
Test on local/staging copy
↓
Write impact report
↓
Write rollback plan
↓
Take backup
↓
Apply to production (user-approved)
↓
Verify
```

No migration is applied to production without all three (backup, impact report, rollback plan) in place first.

---

# 0.5 Existing Project Safety

This is an existing active project.

Do NOT blindly delete and rebuild working modules.

Before replacing code:

- inspect it,
- understand its dependencies,
- identify reusable logic,
- preserve business rules,
- preserve API contracts where possible,
- preserve working UI,
- preserve existing data.

"Rebuild" means:

> improve/replace implementation where required, not destroy the project blindly.

---

# 0.6 UI Design Rule

The agent is authorized — and expected — to design and build a fresh, modern UI/UX for each PART, not just reuse or lightly restyle whatever screen already exists.

When implementing a PART:

- Treat the UI as open to redesign by default. A PART completing a module (e.g. Inventory, Transfers, Production) should ship a screen that looks and feels intentionally designed for that module, not a reused template with swapped labels.
- Prefer a clean, minimal, native-app-feeling interface — the kind of polish seen in modern consumer/social apps (clear hierarchy, generous spacing, purposeful motion/feedback on actions, no cluttered admin-panel look).
- New functionality must ship with UI that makes it usable and discoverable, not buried behind unlabeled icons or left as an unstyled form.
- It is acceptable, and often expected, for a later PART to visually improve or restructure a screen built in an earlier PART, as long as functionality/data from that earlier PART keeps working.

### Design System (baseline, not a cage)

```text
Background: #0c0c0e
Gold:       #d4a437
Card:       #17171b
Text:       #ffffff
Border:     rgba(255,255,255,.08)
Danger:     #e5544d
Warning:    #e5a33d
Success:    #3fbf6f
Info:       #4d9de5
```

This palette is the brand baseline for consistency across the app (so the product doesn't look like a patchwork of unrelated screens). Within it, the agent has freedom to:

- introduce new layout patterns, card styles, spacing, and micro-interactions per module,
- add new accent/status colors where the existing palette doesn't fit a new use case,
- restructure navigation or information architecture if it genuinely improves usability for that module.

Style baseline:

- Premium dark, gold accent
- Modern, minimal, professional
- Mobile-first, responsive
- Native-app feel over "admin dashboard" feel
- PWA-like experience

### Rule

Do not leave a PART's screen looking like an unstyled form or an untouched placeholder. If the user's instruction for a PART says to build new UI/new functionality, build it with real, deliberate design — don't just wire up logic behind the existing look.

---

# 0.7 Architecture Rule

Use:

## Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- PWA
- Workbox

## Backend

- Node.js
- Express.js
- TypeScript
- Prisma

## Database

- PostgreSQL
- Neon

## Deployment

- Render
- Existing Blueprint configuration

Do not introduce another frontend framework or CSS framework.

---

# 0.8 Business Logic Rule

The backend is the source of truth.

Frontend validation improves UX but MUST NOT replace backend validation.

Every critical operation must be validated server-side:

- stock
- production
- purchase
- receiving
- payment
- accounting
- refund
- discount
- permissions
- approvals

---

# 0.9 Transaction Rule

Any operation that changes multiple related records must use a database transaction.

Examples:

### Production

```text
Validate stock
↓
Lock/check required stock
↓
Deduct raw material
↓
Create finished stock
↓
Create production ledger
↓
Create cost
↓
Commit
```

Failure anywhere:

```text
ROLLBACK EVERYTHING
```

No half-completed transaction.

### Row Locking Rule — MANDATORY

Any stock mutation (production, POS sale, purchase receiving, transfer, adjustment, wastage) must acquire a row-level lock on the affected stock row(s) inside the same database transaction before reading the current quantity, using `SELECT ... FOR UPDATE` (or the Prisma/pg equivalent).

```text
BEGIN TRANSACTION
↓
SELECT stock_row FOR UPDATE
↓
Validate quantity against locked value
↓
Apply mutation
↓
COMMIT
```

This prevents two concurrent requests (e.g. two POS terminals, or an offline sync racing a live order) from reading stale stock and both passing validation. Reading stock without a row lock, then writing based on that read, is not acceptable inside a mutation path.

---

# 0.10 No Negative Stock

Negative inventory is prohibited by default.

If available stock < required stock:

```text
BLOCK TRANSACTION
```

Do not silently allow negative inventory.

---

# 0.11 Production Rule — CRITICAL

This is mandatory.

If a production order requests:

> Gulab Jamun = 500 pcs

and the active recipe requires:

```text
Milk   20 L
Sugar   8 KG
Maida   3 KG
Oil     5 L
```

but available stock is:

```text
Milk   25 L  ✓
Sugar  10 KG ✓
Maida   1 KG ✗
Oil      8 L ✓
```

then:

```text
PRODUCTION = BLOCKED
```

The system must show:

```text
Maida required: 3 KG
Available:      1 KG
Shortage:       2 KG
```

No stock may be deducted.

No finished product may be added.

No accounting entry may be finalized.

No automatic partial production.

---

# 0.12 Partial Production

Partial production is OFF by default.

Example:

Requested:

`500 pcs`

Stock supports:

`320 pcs`

Default result:

```text
BLOCKED
```

Never silently change the order to 320 pcs.

A future authorized partial-production workflow may be added only if explicitly implemented.

---

# 0.13 Audit Rule

Never silently delete important records.

For:

- financial records
- stock records
- production
- purchase
- sales
- refunds
- approvals

use:

- Cancel
- Void
- Reverse
- Adjustment
- Return

with audit history.

---

# 0.14 PART Execution Rule

The user will send one PART at a time.

When instructed:

`Implement PART 5 only`

the agent MUST:

1. Read this MASTER_PLAN.md.
2. Inspect the current repository.
3. Determine the current architecture.
4. Inspect dependencies relevant to PART 5.
5. Identify required files automatically.
6. Implement PART 5.
7. Test PART 5.
8. Run build/type/lint checks where available.
9. Fix issues caused by PART 5.
10. Verify acceptance criteria.
11. Report exactly what changed.
12. STOP.

Do NOT implement future PARTS.

---

# 0.15 Dependency Awareness

The agent may inspect future sections to understand dependencies, but MUST NOT implement future functionality.

Example:

If PART 8 requires the customer model created in PART 7:

- understand that dependency,
- do not implement PART 7 unless the current PART requires a missing foundation,
- if a prerequisite genuinely does not exist, report it clearly before proceeding.

---

# 0.16 Normal File Permission Policy

The agent is authorized to read/write project files required for the current PART without asking repeatedly.

However, STOP before:

- deleting the whole project,
- dropping production tables,
- resetting production database,
- changing deployment architecture,
- changing production secrets,
- pushing to GitHub.

---

# 0.17 Final Report Format

After every PART:

```text
PART COMPLETED: PART X

Implemented:
- ...

Files created:
- ...

Files modified:
- ...

Database changes:
- ...

API changes:
- ...

Tests:
- ...

Build:
- PASS / FAIL

Acceptance criteria:
- PASS / FAIL

Known issues:
- ...

Next dependency:
- ...
```

Then STOP.

---

# 0.18 Data Type Rule

All monetary values, stock quantities, and tax figures must use PostgreSQL `NUMERIC` (via Prisma `Decimal`), never `FLOAT`, `DOUBLE PRECISION`, or JavaScript `number` for storage or calculation.

Applies to:

- price, cost, MRP, discount, tax amount, tax rate
- stock quantity, recipe/BOM quantity, wastage quantity
- ledger debit/credit amounts, payment amounts, refund amounts

Rule:

```text
Never: FLOAT / DOUBLE for money, quantity, or tax
Always: NUMERIC(precision, scale) in schema, Decimal in application code
```

Floating-point rounding errors are not acceptable in financial or stock-quantity fields. Precision/scale must be defined explicitly per field (e.g. `NUMERIC(14,4)` for quantities, `NUMERIC(14,2)` for currency) and kept consistent across the schema.

---

# 0.19 Multi-Tenant Isolation Rule

`companyId` and `branchId` are mandatory on every tenant-scoped table and every query.

Rules:

- Every table that stores business data (products, stock, orders, production, purchases, ledger, staff, etc.) must carry `companyId`, and `branchId` where branch-level scoping applies.
- Every read and write query must filter by the authenticated user's `companyId`/`branchId` — never trust a client-supplied tenant ID without validating it against the authenticated session.
- Cross-branch or cross-company access is denied by default and only allowed where a permission explicitly grants it (e.g. HQ-level roles viewing all outlets).
- Permission checks and tenant-isolation checks are separate concerns and must both pass: a user can have the right *role permission* for an action but still be blocked if the target record belongs to a different `companyId`/`branchId` they aren't scoped to.
- API responses must never leak another tenant's data, even in error messages or aggregate counts.

### Acceptance

A user authenticated for Outlet A can never read, modify, or infer the existence of Outlet B's (or another company's) data, regardless of the permissions they hold within their own scope.

---

# 1. PRODUCT VISION

APEX ERP is not intended to be another basic:

> POS + Inventory + Accounting

application.

The target is a **Business Operating System for Restaurant and Hospitality Operations**.

The system must progress through:

```text
ERP CORE
   ↓
AUTOMATION
   ↓
REAL-TIME CONTROL
   ↓
ANALYTICS
   ↓
FORECASTING
   ↓
AI BUSINESS INTELLIGENCE
   ↓
HOTEL PMS
```

The system should not merely record what happened.

It should help the owner understand:

- what happened,
- why it happened,
- what is going wrong,
- what will likely happen next,
- what action should be considered.

---

# 2. BUSINESS STRUCTURE

```text
Company
│
├── Main HQ
│
├── Central Kitchen
│
├── Outlet A
│
├── Outlet B
│
├── Bakery / Sweet Shop
│
└── Future Hotel
```

Each branch/outlet may have:

- departments
- warehouses
- stores
- kitchens
- staff
- POS
- tables
- production
- inventory

---

# 3. CORE MODULE MAP

```text
1. Foundation
2. Database
3. Authentication
4. Organization & RBAC
5. HR
6. Product / Ingredient / Units
7. Recipe / BOM
8. Inventory
9. Production
10. POS
11. KDS
12. Wastage
13. Procurement
14. Receiving
15. 3-Way Match
16. Transfers
17. Accounting
18. Cash Management
19. Approvals
20. Audit
21. Online Ordering
22. CRM
23. Loyalty
24. Menu Engineering
25. Notifications
26. BI / Reporting
27. Forecasting
28. AI Intelligence
29. Owner Command Center
30. Hotel PMS Later
31. Delivery Aggregator Integration (Swiggy/Zomato/UrbanPiper)
32. Payment Gateway Depth
33. Offline-First Sync & Conflict Resolution
34. Idempotency & Duplicate Request Control
35. Multi-Language & Regional Support
36. Accounting Export / Tally Integration
37. AI Forecasting & Intelligence Engine
38. Customer-Facing CRM/Loyalty/QR UX Depth
39. Advanced BI & Reporting Visualization
```

---

# 4. DATABASE DOMAIN MODEL

## Organization

- Company
- Branch
- Department
- Warehouse
- StoreLocation

## Identity

- User
- Role
- Permission
- RolePermission
- UserPermission
- Session
- LoginAudit

## HR

- Staff
- Attendance
- Salary
- Payroll
- PayrollItem

## Product

- Product
- Ingredient
- MenuItem
- Category
- Modifier
- AddOn
- Unit
- UnitConversion

## Recipe

- Recipe
- RecipeItem
- RecipeVersion
- SubRecipe
- RecipeYield

## Inventory

- StockBalance
- StockLedger
- StockBatch
- StockReservation
- StockCount
- StockCountItem
- StockAdjustment
- StockTransfer
- StockTransferItem

## Production

- ProductionOrder
- ProductionItem
- ProductionConsumption
- ProductionOutput
- ProductionBatch
- ProductionWastage

## Procurement

- Supplier
- SupplierProduct
- MaterialRequest
- MaterialRequestItem
- RFQ
- RFQItem
- SupplierQuotation
- SupplierQuotationItem
- PurchaseOrder
- PurchaseOrderItem
- GoodsReceipt
- GoodsReceiptItem
- SupplierInvoice
- PurchaseReturn
- PurchaseReturnItem

## Restaurant

- Floor
- Table
- Order
- OrderItem
- OrderModifier
- KOT
- Payment
- Refund
- RefundItem
- Discount

## Online

- Customer
- CustomerAddress
- QRSession
- OnlineOrder

## CRM

- CustomerProfile
- LoyaltyAccount
- LoyaltyTransaction
- Coupon
- Promotion
- CustomerSegment

## Finance

- ChartOfAccount
- LedgerAccount
- LedgerEntry
- Expense
- Payable
- Receivable
- CashSession
- CashMovement
- BankTransaction
- Reconciliation
- TaxEntry

## Control

- Approval
- ApprovalRule
- AuditLog
- Notification
- SystemSetting

## Future Hotel

- Room
- RoomType
- Booking
- Guest
- CheckIn
- CheckOut
- HousekeepingTask
- RoomServiceOrder

---

# 5. PART 1 — FOUNDATION & EXISTING PROJECT AUDIT

## Goal

Safely establish the project foundation without destroying working code.

### Tasks

- Inspect repository.
- Inspect frontend.
- Inspect backend.
- Inspect Prisma.
- Inspect Render configuration.
- Inspect existing APIs.
- Inspect existing pages.
- Inspect PWA setup.
- Identify working modules.
- Identify incomplete modules.
- Establish/confirm React + TypeScript + Vite + Tailwind structure.
- Establish/confirm Express + TypeScript + Prisma structure.
- Create shared architectural conventions.

### Do NOT

- destroy working modules,
- reset database,
- change Render architecture,
- push Git.

### Acceptance

Project builds successfully and architecture is documented.

---

# 6. PART 2 — DATABASE FOUNDATION

## Goal

Create/confirm the enterprise Prisma schema safely.

### Required Domains

Use the database domain model defined above.

### Requirements

- correct relations
- indexes
- unique constraints
- status enums
- timestamps
- branch isolation
- warehouse isolation
- audit references
- transaction-safe design

### Acceptance

- Prisma validates.
- Migration is safe.
- Existing data is preserved.
- No unauthorized destructive change.

---

# 7. PART 3 — AUTHENTICATION, RBAC & SECURITY

## Login

Primary:

- Google/Gmail OAuth

Fallback:

- email/password

### Security

- secure session
- protected API
- protected routes
- role-based menus
- granular permissions
- logout
- rate limiting
- login protection
- session management
- optional 2FA-ready architecture

### Acceptance

Unauthorized users cannot access protected resources.

---

# 8. PART 4 — ORGANIZATION, BRANCH, WAREHOUSE & STAFF

## Features

- company
- branch
- outlet
- warehouse
- department
- staff
- user assignment
- role assignment
- permissions

### Rule

A user must not access another outlet's restricted data unless permission allows it.

---

# 9. PART 5 — HR, ATTENDANCE & PAYROLL

## Features

- staff profile
- outlet assignment
- department
- attendance
- shift
- salary
- payroll
- active/inactive staff
- payroll history

### Acceptance

Monthly payroll summary works per staff and outlet.

---

# 10. PART 6 — PRODUCT, INGREDIENT, UNIT & RECIPE FOUNDATION

## Product

- ingredient
- finished product
- menu item
- category
- modifier
- add-on

## Unit

Examples:

```text
KG
GRAM
LITRE
ML
PCS
BOX
PACK
```

## Unit Conversion

Example:

```text
1 KG = 1000 GM
1 L = 1000 ML
```

Business-specific conversions must be configurable.

---

# 11. PART 7 — RECIPE / BOM ENGINE

## Recipe must support

- ingredient
- quantity
- unit
- yield
- wastage %
- cost
- effective date
- version
- active/inactive
- sub-recipe

### Example

```text
Gulab Jamun
├── Dough
├── Sugar Syrup
└── Frying Oil
```

A sub-recipe may itself contain multiple ingredients.

### Recipe Cost

```text
Ingredient Cost
+
Expected Wastage
+
Yield Adjustment
+
Packaging
+
Configured Production Overhead
=
Recipe Cost
```

### Acceptance

Recipe versioning and costing work correctly.

---

# 12. PART 8 — ENTERPRISE INVENTORY ENGINE

This is a critical module.

## Features

- multi-warehouse
- stock balance
- stock ledger
- batch
- lot
- expiry
- FIFO-ready architecture
- FEFO
- minimum stock
- maximum stock
- reorder level
- low-stock alerts
- stock reservation
- physical count
- adjustment
- variance
- valuation

## Stock Movement Types

```text
PURCHASE
PRODUCTION_IN
PRODUCTION_OUT
SALE
TRANSFER_IN
TRANSFER_OUT
WASTAGE
ADJUSTMENT
RETURN
REFUND
```

Every stock movement must have:

- source type
- source ID
- user
- branch
- warehouse
- batch where applicable
- timestamp

---

# 13. PART 9 — PRODUCTION ENGINE

## Critical Requirement

Production must be recipe-driven.

### Before production

For every ingredient:

```text
Required Qty
vs
Available Qty
```

If ANY ingredient is insufficient:

```text
BLOCK
```

### Example

```text
Gulab Jamun = 500 pcs

Maida:
Required = 3 KG
Available = 1 KG

Result:
BLOCKED
Shortage = 2 KG
```

### No partial production by default.

### Transaction

```text
Validate
↓
Check stock
↓
Lock/check
↓
Deduct raw materials
↓
Create finished goods
↓
Create production cost
↓
Create stock ledger
↓
Commit
```

### Additional

- production batch
- MFG date
- expiry
- yield
- production wastage
- production variance
- cancellation
- reversal
- approval

---

# 14. PART 10 — ADVANCED RESTAURANT POS

## Features

- dine-in
- takeaway
- delivery
- table management
- floor plan
- modifier
- add-on
- combo
- multiple payment
- split bill
- merge bill
- hold bill
- KOT
- discount
- complimentary
- void
- refund
- partial refund
- reprint

### Stock

Sale completion must use recipe/BOM and modifier recipes.

---

# 15. PART 11 — KITCHEN DISPLAY SYSTEM

## Features

- real-time KOT
- preparing
- ready
- served
- cancelled
- priority
- delay timer

Use WebSocket/Socket.IO where appropriate.

---

# 16. PART 12 — WASTAGE & LOSS CONTROL

## Types

- expired
- spoiled
- damaged
- wrong preparation
- overproduction
- returned/discarded
- production loss

## Required

- reason
- quantity
- unit
- value
- branch
- warehouse
- batch
- user
- date

### Rules

- deduct stock
- create loss accounting entry
- approval threshold
- audit log

---

# 17. PART 13 — PROCUREMENT & SUPPLIER MANAGEMENT

## Supplier

- profile
- tax/GST
- contact
- address
- bank
- payment terms
- credit limit
- supplied products
- price history
- performance

## Lifecycle

```text
Material Request
↓
RFQ
↓
Quotation
↓
Comparison
↓
Purchase Order
↓
Goods Receipt
↓
Supplier Invoice
↓
3-Way Match
↓
Payable
↓
Payment
```

---

# 18. PART 14 — RECEIVING & INVOICE VERIFICATION

## Mandatory

Receiving submission requires invoice/bill evidence.

## Compare

```text
Purchase Order
+
Goods Receipt
+
Supplier Invoice
=
3-Way Match
```

Compare:

- item
- quantity
- price
- discount
- tax
- total

Mismatch:

```text
HOLD
↓
APPROVAL
```

---

# 19. PART 15 — QUALITY CONTROL

## Receiving QC

```text
Received
↓
Quality Check
↓
Accepted / Rejected / Partial
```

Check:

- quantity
- quality
- expiry
- packaging
- damage
- temperature where applicable

Rejected stock cannot become usable stock.

---

# 20. PART 16 — STOCK COUNT & ADJUSTMENT

## Flow

```text
System Stock
↓
Physical Count
↓
Variance
↓
Adjustment Request
↓
Approval
↓
Ledger Entry
↓
Audit
```

No direct stock quantity editing.

---

# 21. PART 17 — INTER-OUTLET TRANSFER

## Flow

```text
Request
↓
Approve
↓
Pick
↓
Dispatch
↓
In Transit
↓
Receive
↓
Reconcile
```

Track batches and quantities where applicable.

---

# 22. PART 18 — ADVANCED ACCOUNTING

## Inputs

- POS
- online order
- production
- wastage
- purchase
- supplier invoice
- expense
- refund
- payment
- cash
- bank

## Outputs

- general ledger
- outlet P&L
- consolidated P&L
- expense
- payable
- receivable
- tax/GST-ready breakup
- cash reconciliation
- bank reconciliation

Every financial entry must reference its source transaction.

---

# 23. PART 19 — CASHIER SHIFT & PAYMENT RECONCILIATION

## Flow

```text
Open Shift
↓
Opening Cash
↓
Sales
↓
Payments
↓
Refunds / Expenses
↓
Close Shift
↓
Expected
vs
Actual
↓
Variance
```

Variance requires reason and possibly approval.

---

# 24. PART 20 — APPROVAL ENGINE

Make approvals configurable.

Example:

```text
Wastage < ₹5,000
→ Manager

₹5,000–₹25,000
→ Admin

> ₹25,000
→ Super Admin
```

Apply to:

- purchases
- receiving mismatch
- production
- production cancellation
- wastage
- expense
- refund
- discount
- stock adjustment
- supplier return

---

# 25. PART 21 — AUDIT & COMPLIANCE

Audit:

- user
- action
- timestamp
- entity
- record
- old value
- new value
- reason

Track:

- stock changes
- production changes
- purchase changes
- invoice changes
- refunds
- discounts
- approvals
- permissions

---

# 26. PART 22 — ONLINE / QR ORDERING

## Flow

```text
QR / Online
↓
Menu
↓
Modifier
↓
Order
↓
Payment
↓
POS
↓
KDS
↓
Stock
↓
Accounting
```

No separate stock system.

---

# 27. PART 23 — CUSTOMER CRM

## Customer Profile

- name
- mobile
- email
- order history
- visit history
- favourite items
- total spend
- average order value
- last visit
- lifetime value

---

# 28. PART 24 — LOYALTY & PROMOTIONS

## Features

- loyalty points
- membership
- coupon
- promotion
- customer segment
- birthday offer
- inactive customer targeting

---

# 29. PART 25 — MENU ENGINEERING

For each item:

- sales quantity
- revenue
- food cost
- food cost %
- gross margin
- contribution margin
- popularity

Classification:

```text
STAR
High Sales + High Margin

PLOW HORSE
High Sales + Low Margin

PUZZLE
Low Sales + High Margin

DOG
Low Sales + Low Margin
```

---

# 30. PART 26 — NOTIFICATION CENTER

Notifications:

- low stock
- expiry
- production blocked
- pending approval
- invoice mismatch
- purchase mismatch
- high wastage
- cash shortage
- payment pending
- supplier payable due
- KDS delay
- failed payment

---

# 31. PART 27 — ADVANCED BI & REPORTING

## Reports

- daily sales
- outlet sales
- item sales
- category sales
- production
- production cost
- food cost
- purchase
- supplier performance
- purchase price variance
- stock valuation
- stock movement
- stock variance
- expiry
- wastage
- cash variance
- P&L
- payables
- receivables
- staff performance
- menu profitability

## Filters

- today
- yesterday
- 7 days
- 30 days
- month
- quarter
- year
- custom date
- outlet
- category
- item

---

# 32. PART 28 — OWNER COMMAND CENTER

Owner dashboard should show:

- total sales
- outlet sales
- stock value
- low stock
- wastage
- pending requests
- pending approvals
- received/pending money
- P&L
- food cost
- gross margin
- top items
- slow-moving items
- staff performance
- cash variance
- supplier payable

The dashboard must explain changes, not only display numbers.

---

# 33. PART 29 — DEMAND FORECASTING

Use historical data:

- sales
- weekday
- season
- holiday
- outlet
- item
- trend

Output:

```text
Expected Demand
↓
Required Ingredients
↓
Current Stock
↓
Shortage
↓
Purchase Recommendation
```

Forecast is decision support only.

It must never directly alter accounting or stock.

---

# 34. PART 30 — AI BUSINESS INTELLIGENCE

AI can analyze ERP data and produce:

- unusual wastage
- abnormal ingredient consumption
- margin decline
- supplier price increase
- slow-moving stock
- sales anomaly
- demand trend
- purchase recommendation
- outlet anomaly
- operational recommendations

### AI MUST NOT control the source of truth.

AI must never directly decide:

- stock quantity
- invoice total
- accounting balance
- tax amount
- payment balance
- production deduction

Deterministic backend/database logic remains authoritative.

---

# 35. PART 31 — DIGITAL BUSINESS TWIN / OPERATIONAL INTELLIGENCE

APEX should eventually understand the relationship between:

```text
Sales
↓
Demand
↓
Recipe
↓
Ingredients
↓
Inventory
↓
Production
↓
Purchase
↓
Cost
↓
Wastage
↓
Profit
```

The owner should be able to answer questions such as:

> Which outlet has the highest wastage today?

> Why did food cost increase this week?

> Which ingredients will run out soon?

> Which supplier's prices increased?

> Which menu items have high sales but low margin?

> What stock should be purchased for the next few days?

This layer differentiates APEX from a conventional ERP.

---

# 36. PART 32 — HOTEL PMS LATER PHASE

Do not implement until explicitly requested.

Future:

- rooms
- room types
- booking
- availability
- guest
- check-in
- check-out
- housekeeping
- room service
- occupancy
- ADR
- RevPAR
- hotel billing
- hotel revenue

The PMS must share:

- customer
- inventory
- finance
- payments
- users
- approval
- audit
- notifications
- reporting

with the existing ERP.

---

# 37. PART 33 — DELIVERY AGGREGATOR INTEGRATION (SWIGGY / ZOMATO / URBANPIPER)

## Goal

Bring APEX to feature parity with market leaders (Petpooja) on aggregator handling.

### Features

- Aggregator account linking per branch/outlet
- Real-time menu sync (push APEX menu changes to Swiggy/Zomato/UrbanPiper)
- Incoming order webhook receiver
- Auto-accept / manual-accept toggle per outlet
- Order status push back to aggregator (accepted, preparing, ready, dispatched)
- Aggregator order mapped into existing `OnlineOrder` + `Order`/`KOT` flow (no parallel order system)
- Commission/payout reconciliation against aggregator settlement reports
- Item availability auto-toggle (out-of-stock ingredient → auto mark item unavailable on aggregator)

### Rule

Aggregator orders must go through the same stock deduction, KDS, and accounting pipeline as in-house POS orders. No separate code path.

### Acceptance

An order placed on a connected aggregator appears in KDS within seconds, deducts stock correctly, and reflects in the same day's P&L as a dine-in order would.

---

# 38. PART 34 — PAYMENT GATEWAY DEPTH

## Goal

Move beyond a generic `Payment` record to real-world payment handling.

### Features

- Multiple gateway support (Razorpay, PhonePe, UPI intent/QR, card, cash)
- Split payment (part cash + part UPI + part card on one bill)
- Partial payment / advance payment (useful for banquet/hotel-style bookings)
- Tip handling (separate from bill amount, not taxed, staff-attributable)
- Refund-to-source vs refund-to-wallet distinction
- Payment failure / retry / webhook reconciliation (gateway says success, POS says pending → reconcile job)

### Rule

A bill is not marked `PAID` until the sum of all payment legs equals the bill total. Partial payment states must be explicit, not inferred.

### Acceptance

A bill can be split across 3 payment methods and still reconcile to ₹0 balance with correct ledger entries for each leg.

---

# 39. PART 35 — OFFLINE-FIRST SYNC & CONFLICT RESOLUTION

## Goal

Define what "offline-safe UI" (Section 51) actually does when connectivity returns.

### Features

- Local queue of offline-created orders/KOTs (client-side, not silently discarded)
- Sync-on-reconnect with server-side revalidation (stock is re-checked at sync time, not trusted from offline client)
- Conflict cases to handle explicitly:
  - Stock that was sufficient offline but is no longer sufficient at sync time → order flagged `NEEDS_REVIEW`, not silently completed
  - Same table/order edited from two devices while offline → last-write-wins is NOT allowed; conflicting edits are surfaced for manual resolution
- Visual indicator in UI: "Offline — will sync" vs "Synced"
- Financial/stock mutations are never marked final client-side; only server confirmation finalizes them

### Rule

Offline mode may queue an *intent* (e.g. "customer ordered X"). It must never simulate a *completed* stock or financial transaction.

### Acceptance

Two devices editing the same order offline, then reconnecting, never silently overwrite each other — the conflict is shown and resolved explicitly.

---

# 40. PART 36 — IDEMPOTENCY & DUPLICATE REQUEST CONTROL

## Goal

Give `DUPLICATE_REQUEST` (Section 49) a real implementation, not just an error name.

### Features

- Idempotency-Key header required on all mutation endpoints (order create, payment, production, purchase, transfer)
- Server stores recent idempotency keys with the resulting response; a repeated key returns the original result instead of re-executing
- Double-tap / network-retry submit protection on frontend (disable button + idempotency key together)
- Idempotency key expiry window (e.g. 24h) to bound storage growth

### Acceptance

Submitting the same POS order twice in a row (double-tap or network retry) creates exactly one order, one stock deduction, one ledger entry.

---

# 41. PART 37 — MULTI-LANGUAGE & REGIONAL SUPPORT

## Goal

Match Petpooja-style regional usability.

### Features

- UI language toggle (English + Bengali/Hindi as first targets)
- Bilingual receipt/KOT printing (item name in English + local language)
- Locale-aware number/date/currency formatting
- Menu item translation field (not a hardcoded string — a translatable field per item)

### Rule

Language support must not fork business logic. Only display-layer strings and printed output are localized; backend rules stay language-agnostic.

### Acceptance

Switching UI language changes labels and printed KOT/receipt text without affecting stock, pricing, or order logic.

---

# 42. PART 38 — ACCOUNTING EXPORT / TALLY INTEGRATION

## Goal

Give owners/accountants a path out of APEX into standard accounting tools, matching a known Restroworks differentiator.

### Features

- Export ledger entries in Tally-compatible format (XML or CSV per Tally import spec)
- Scheduled/manual export by date range and branch
- Chart of Accounts mapping (APEX `LedgerAccount` → Tally ledger group)
- GST-compliant invoice data included in export

### Rule

Export is read-only from APEX's perspective — APEX's ledger remains the source of truth (Section 52); Tally is a downstream consumer, not a second source of truth.

### Acceptance

A month's sales, purchases, and expenses export cleanly into Tally and the trial balance matches APEX's internal P&L.

---

# 43. PART 39 — AI FORECASTING & INTELLIGENCE ENGINE (APPROACH)

## Goal

Give Section 35 (Owner Command Center questions) and PART 28/29 a concrete technical approach instead of an open concept.

### Approach

- **Phase 1 (rule-based):** simple statistical forecasting (moving average, day-of-week seasonality) for stock reorder points and sales trend — no ML dependency, works from day one
- **Phase 2 (ML-assisted):** trained on APEX's own historical sales/stock/wastage data (per outlet) for demand forecasting — not a generic third-party model
- **Phase 3 (LLM-assisted insight layer):** natural-language Q&A over aggregated, already-computed BI metrics (e.g. "why did food cost increase this week") — the LLM explains and summarizes numbers the backend already calculated; it does not compute the numbers itself

### Rule

Per Section 52, AI is never the source of truth. Every AI-surfaced number must be traceable to a real ledger/stock/sales query, not generated or estimated by the model.

### Acceptance

Every AI insight shown to the owner links back to the underlying report/query that produced the number.

---

# 44. PART 40 — CUSTOMER-FACING CRM / LOYALTY / QR UX DEPTH

## Goal

Deepen the CRM/Loyalty/QR modules already listed in the domain model (Section 4) with real UX flows.

### Features

- QR-at-table ordering flow: scan → menu → cart → place order → KOT → pay (dine-in, no app install)
- Loyalty points earn/redeem rules configurable per branch (e.g. ₹100 spend = 1 point)
- Coupon/promotion engine with usage limits, date ranges, and item/category restrictions
- Customer order history and repeat-order shortcut
- Segment-based targeting data (e.g. "customers who haven't ordered in 30 days") exposed for future marketing use

### Acceptance

A customer can scan a table QR, order, pay, and earn loyalty points — all reflected instantly in their CustomerProfile without staff intervention.

---

# 45. PART 41 — ADVANCED BI & REPORTING VISUALIZATION

## Goal

Give the BI/Reporting module (Section 4, Section 35) real dashboard shape.

### Features

- Chart types per report: trend line (sales/food-cost over time), bar (outlet comparison), pie/donut (category mix)
- Real-time dashboard tiles (today's sales, live orders, low-stock alerts) vs. batch/scheduled reports (monthly P&L, payroll summary)
- Drill-down: dashboard tile → detailed report → single transaction
- Exportable reports (PDF/Excel) for offline sharing with stakeholders

### Rule

Real-time tiles query live/recent data with tight limits (Section 47 — no unbounded historical loads); heavy historical reports run as scheduled/paginated jobs, not on-demand full scans.

### Acceptance

Dashboard loads in under 2 seconds with live data; a 1-year historical report runs as a paginated/exportable job without freezing the UI.

---

# 46. CRITICAL BUSINESS FLOWS

## Purchase to Payment

```text
Request
↓
RFQ
↓
Quotation
↓
PO
↓
Receive
↓
QC
↓
Invoice
↓
3-Way Match
↓
Approval
↓
Payable
↓
Payment
```

## Ingredient to Production

```text
Ingredient Stock
↓
Recipe Validation
↓
Production Order
↓
Stock Check
↓
Raw Material Consumption
↓
Finished Goods
↓
Production Cost
```

## Production Blocking

```text
Requested Production
↓
Recipe Requirement
↓
Check ALL ingredients
↓
ANY shortage?
├── YES → BLOCK
└── NO  → Continue
```

## Sale to Accounting

```text
POS
↓
Payment
↓
Stock Deduction
↓
Revenue
↓
Ledger
↓
P&L
```

## Wastage

```text
Wastage Entry
↓
Approval if required
↓
Stock Deduction
↓
Loss Ledger
↓
P&L
```

---

# 47. PERFORMANCE REQUIREMENTS

The application should be designed for:

- multiple outlets
- concurrent users
- concurrent POS orders
- concurrent production
- large stock ledgers
- large sales history
- large audit logs

Use:

- indexed queries
- pagination
- server-side filtering
- transaction boundaries
- efficient Prisma queries
- proper database constraints
- caching only where appropriate

Do not load entire historical datasets into the browser unnecessarily.

---

# 48. API DESIGN RULES

APIs should:

- validate input
- authenticate
- authorize
- validate branch access
- validate business rules
- use transactions for mutations
- return predictable errors
- never expose secrets
- never trust frontend totals
- never trust frontend stock values

Example:

```text
POST /api/production
```

Backend calculates:

- recipe requirement
- stock availability
- production cost
- final ledger changes

Frontend cannot override these values.

---

# 49. ERROR HANDLING

Errors must be understandable.

Example:

```text
INSUFFICIENT_STOCK

Item: Maida
Required: 3 KG
Available: 1 KG
Shortage: 2 KG
```

Other examples:

```text
PERMISSION_DENIED
APPROVAL_REQUIRED
INVOICE_MISMATCH
INVALID_BATCH
EXPIRED_STOCK
PAYMENT_FAILED
DUPLICATE_REQUEST
CONCURRENT_UPDATE
```

Never expose stack traces or secrets to normal users.

---

# 50. TESTING STANDARD

Every important mutation must test:

### Success

- valid data
- correct permissions
- sufficient stock

### Failure

- insufficient stock
- wrong outlet
- invalid quantity
- expired batch
- duplicate submission
- unauthorized request
- approval rejection
- transaction failure
- concurrent request
- invalid invoice

### Production-specific test

```text
Requested = 500 pcs

Any recipe ingredient insufficient:
→ API rejects
→ no raw stock deducted
→ no finished stock created
→ no financial mutation finalized
→ no partial production
```

### Mandatory Test Coverage Per PART

A PART is not test-complete (see Section 57) until all five categories below are covered for its mutating endpoints:

| Category | Verifies |
|---|---|
| Unit | Business logic in isolation (calculations, validation rules, recipe/BOM math, ledger balancing) |
| Integration | API endpoint → database, including transaction commit/rollback behavior |
| Permission | Every role that should be allowed succeeds; every role that should be denied is rejected (Section 0.19 tenant isolation included) |
| Concurrency | Two simultaneous requests against the same row (e.g. same stock item, same order) resolve safely under row locking (Section 0.9) — no double-deduction, no lost update |
| End-to-end | Full user flow through UI (or API sequence standing in for UI) from initiating action to final state, matching the PART's Acceptance criteria |

No PART is marked complete with only unit and integration tests — permission, concurrency, and end-to-end coverage are required regardless of PART size.

---

# 51. MOBILE / PWA STANDARD

The application must remain:

- mobile-first
- responsive
- installable
- fast
- usable on small screens

PWA should support:

- manifest
- service worker
- update handling
- install experience
- loading state
- offline-safe UI where technically appropriate

Do not pretend financial/stock mutations succeeded while offline.

---

# 52. DATA INTEGRITY PRINCIPLES

The following must always remain true:

```text
Stock Ledger = Source of Inventory History
Accounting Ledger = Source of Financial History
Audit Log = Source of Administrative History
Database Constraints = Source of Structural Integrity
Backend Validation = Source of Business Rule Enforcement
```

AI is NOT the source of truth.

Frontend is NOT the source of truth.

### Double-Entry Rule — MANDATORY

Every accounting transaction must be recorded as a set of ledger entries where:

```text
Total Debit = Total Credit
```

Rules:

- No ledger entry may be created in isolation — every debit posting must have a matching credit posting (single or split across accounts) within the same database transaction.
- The application must reject (not silently correct) any attempt to commit an unbalanced entry.
- A scheduled/on-demand integrity check must confirm, per branch and per company, that `SUM(debit) = SUM(credit)` across the ledger at all times.
- This applies to all financial-impacting flows: sales, purchases, payments, refunds, payroll, expenses, and inter-branch transfers with a cost impact.

### Acceptance

For any date range and any branch, the trial balance derived from the ledger always nets to zero (total debit − total credit = 0).

---

# 53. SECURITY PRINCIPLES

Implement as appropriate:

- secure password hashing
- OAuth security
- session protection
- rate limiting
- CSRF protection where applicable
- secure cookies
- permission checks
- branch isolation
- audit logging
- input validation
- output sanitization
- secret management
- secure headers
- dependency updates

---

# 54. NO UNNECESSARY FEATURE DRIFT

Do not invent random modules.

If a feature is not in this specification:

1. determine whether it is necessary to complete the current PART,
2. if necessary, implement only the minimum dependency,
3. otherwise do not implement it.

Do not turn a PART into a full redesign.

---

# 55. NO REPEATED PERMISSION PROMPTS

The user does not want to repeatedly approve routine file operations.

Therefore:

> Normal source-file read/write, code generation, testing, local build, migration-file creation, and dependency updates required by the current PART are pre-authorized.

Only stop for high-risk actions such as:

- production database destruction,
- mass deletion,
- deployment changes,
- Git push,
- remote repository changes,
- production secret changes.

---

# 56. GIT POLICY

The user will handle GitHub operations.

The agent must NOT:

```text
git push
```

unless the user explicitly requests it.

Default:

```text
CODE → TEST → REPORT → STOP
```

Not:

```text
CODE → PUSH
```

---

# 57. PART COMPLETION STANDARD

A PART is not complete merely because code was written.

It is complete only when:

- implementation is done,
- relevant APIs work,
- relevant UI works,
- validation works,
- permissions work,
- database operations work,
- relevant tests pass,
- build passes,
- no known regression from that PART remains.

---

# 58. FINAL TARGET

The final APEX platform should become:

```text
                         APEX ERP
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       CENTRAL HQ        OUTLETS          FUTURE HOTEL
          │                 │                 │
      Production           POS              PMS
      Procurement          KDS              Rooms
      Inventory            QR               Booking
      Warehouse            Online           Housekeeping
      Finance              CRM              Room Service
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                         FINANCE
                            │
                 Accounting / P&L / Cash
                            │
                         CONTROL
                            │
                 Approval / RBAC / Audit
                            │
                      INTELLIGENCE
                            │
              BI / Forecast / AI Insights
                            │
                    OWNER COMMAND CENTER
```

The product target is:

**Transaction-safe + multi-outlet + inventory-aware + production-aware + procurement-integrated + accounting-integrated + permission-controlled + auditable + real-time + predictive + AI-assisted + hotel-ready.**

---

# 59. USER COMMAND TEMPLATE

The user should normally need only:

```text
Read MASTER_PLAN.md.

Implement PART 1 only.

Follow the Autonomous Development Contract.
Do not implement future PARTS.
Do not git push.
Test and build after completion.
Report changes and stop.
```

For the next step:

```text
Read MASTER_PLAN.md.

Implement PART 2 only.

Follow the Autonomous Development Contract.
Do not implement future PARTS.
Do not git push.
Test and build after completion.
Report changes and stop.
```

The same pattern applies to every PART.

---

# 60. RELEASE PLAN

PARTs are grouped into three releases. A release is shippable to production once every PART within it meets the PART Completion Standard (Section 57), including the mandatory test coverage in Section 50.

### Release 1 — Core ERP

Foundational operations required to run a single outlet or HQ day-to-day.

```text
PART 1  — Foundation & Existing Project Audit
PART 2  — Database Foundation
PART 3  — Authentication, RBAC & Security
PART 4  — Organization, Branch, Warehouse & Staff
PART 5  — HR, Attendance & Payroll
PART 6  — Product, Ingredient, Unit & Recipe Foundation
PART 7  — Recipe / BOM Engine
PART 8  — Enterprise Inventory Engine
PART 9  — Production Engine
PART 10 — Advanced Restaurant POS
PART 11 — Kitchen Display System
PART 12 — Wastage & Loss Control
PART 13 — Procurement & Supplier Management
PART 14 — Receiving & Invoice Verification
PART 15 — Quality Control
PART 16 — Stock Count & Adjustment
PART 17 — Inter-Outlet Transfer
PART 18 — Advanced Accounting
PART 19 — Cashier Shift & Payment Reconciliation
```

### Release 2 — Automation and Control

Approval, audit, customer-facing, and reliability layers built on top of Release 1.

```text
PART 20 — Approval Engine
PART 21 — Audit & Compliance
PART 22 — Online / QR Ordering
PART 23 — Customer CRM
PART 24 — Loyalty & Promotions
PART 25 — Menu Engineering
PART 26 — Notification Center
PART 27 — Advanced BI & Reporting
PART 28 — Owner Command Center
PART 35 — Offline-First Sync & Conflict Resolution
PART 36 — Idempotency & Duplicate Request Control
```

### Release 3 — Integrations and Intelligence

External integrations, forecasting/AI, hotel expansion, and depth features.

```text
PART 29 — Demand Forecasting
PART 30 — AI Business Intelligence
PART 31 — Digital Business Twin / Operational Intelligence
PART 32 — Hotel PMS Later Phase
PART 33 — Delivery Aggregator Integration (Swiggy / Zomato / UrbanPiper)
PART 34 — Payment Gateway Depth
PART 37 — Multi-Language & Regional Support
PART 38 — Accounting Export / Tally Integration
PART 39 — AI Forecasting & Intelligence Engine (Approach)
PART 40 — Customer-Facing CRM / Loyalty / QR UX Depth
PART 41 — Advanced BI & Reporting Visualization
```

### Rule

Do not begin a Release 2 PART before its Release 1 dependencies are complete, and do not begin a Release 3 PART before its Release 2 dependencies are complete, unless the user explicitly instructs otherwise for a specific PART.

---

# 61. SECURITY, BACKUP, RESTORE & DISASTER RECOVERY

## Security

- All endpoints require authentication except explicitly public ones (e.g. QR ordering menu view).
- All mutating endpoints enforce RBAC permission checks (Section 3 / PART 3) and tenant isolation (Section 0.19).
- Secrets (DB credentials, JWT secret, payment keys, OAuth secrets) are never committed to the repository and are only read from environment variables (Section 0.3).
- Passwords are hashed (bcrypt/argon2); tokens are short-lived with refresh rotation.
- Rate limiting on authentication and payment endpoints to reduce brute-force/abuse risk.

## Backup

- Automated daily database backup, retained for a defined window (e.g. 30 days), stored outside the primary database instance.
- Backups are verified periodically by performing an actual restore into a non-production environment — an unverified backup is treated as if it does not exist.
- A backup is always taken immediately before any production migration (Section 0.4).

## Restore Testing

- Restore procedure is documented step-by-step, not assumed.
- Restore is test-run on a schedule (e.g. quarterly) against a staging database to confirm the backup is actually usable and the procedure works end-to-end.
- Restore testing result (pass/fail, time taken) is logged.

## Monitoring

- Health check endpoint (already referenced by PWA splash/health checks) is monitored for uptime.
- Error-rate and latency monitoring on critical paths: order creation, payment, production, stock mutation.
- Alerting on: failed migrations, repeated authentication failures, payment webhook failures, stock-lock timeouts/deadlocks, unbalanced ledger detection (Section 52 double-entry check).

## Disaster Recovery

- Defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO), even if approximate at early stages (e.g. RPO ≤ 24h, RTO ≤ 4h for Release 1).
- A written runbook describing what to do if: the database becomes unreachable, a bad migration is applied, or the Render deployment fails — who is notified, what is checked first, and how service is restored.
- DR runbook is reviewed whenever the architecture changes materially (new database, new region, new critical integration).

### Acceptance

A restore-from-backup can be performed on a staging environment, producing a working database, without needing to reverse-engineer the procedure from memory.

---

# END OF MASTER PLAN
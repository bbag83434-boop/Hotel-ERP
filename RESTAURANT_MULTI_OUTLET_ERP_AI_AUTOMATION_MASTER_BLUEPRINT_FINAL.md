RESTAURANT MULTI-OUTLET ERP + AI AUTOMATION PLATFORM

MASTER BLUEPRINT --- PART 0

Project Type: Centralized Multi-Outlet Restaurant ERP + AI Automation + Business Control Platform
Development Model: Part-by-Part implementation
Primary Development AI: Gemini CLI / Gemini
Current Phase: Greenfield Architecture & Development Rules
Status: Master Blueprint — NEW PROJECT / GREENFIELD BUILD

CRITICAL PROJECT BOUNDARY

This blueprint describes a completely NEW project.

Existing project: the user's already-built project deployed on Render.
It must remain untouched.

New project: this blueprint's project, built from zero with a separate
directory/repository/environment/database.

Gemini CLI must never confuse the two projects.

1. PROJECT VISION

Build a production-oriented, mobile-first, centralized Restaurant ERP + AI Automation Platform for a multi-outlet restaurant company. The new project is a GREENFIELD build and must combine:

Restaurant ERP / operations management

Central Head Office management

Strict multi-outlet data isolation

POS / order / table / KOT operations

HR and employee management

Accounting and finance management

Customer and complaint management

Maintenance / asset management

Beverage and controlled alcohol inventory management

Inventory and stock control

Purchase management

Production / kitchen management

Wastage management

Supplier management

Multi-outlet management

Reports and analytics

AI assistant

AI-powered document/invoice extraction

Automation workflows

Scheduled alerts and reports

Telegram integration

WhatsApp integration

AI Agent with controlled tools

Approval workflows

Audit logging

Security and role-based permissions

The platform must be designed so that Head Office can control the entire business centrally, while outlet users can access only their authorized outlet data. AI assists with analysis, recommendations and controlled actions without unrestricted destructive access.

The project must support approximately 14 outlets from the first architecture design, while remaining scalable to additional outlets.

IMPORTANT: This is a NEW PROJECT. Do not reuse, modify, connect to, deploy, or disturb the user's existing live Render project unless the user explicitly requests it in a future task.

2. CORE PRINCIPLE

The system follows:

TRIGGER
   ↓
DATA
   ↓
AI / BUSINESS LOGIC
   ↓
VALIDATION
   ↓
APPROVAL (when required)
   ↓
ACTION
   ↓
AUDIT LOG
   ↓
RESULT / NOTIFICATION

AI must not replace deterministic business rules where exact validation
is required.

Example:

Invoice Photo
   ↓
AI extracts invoice data
   ↓
System validates amount / quantity / item
   ↓
PO comparison
   ↓
MATCH → approval workflow
MISMATCH → alert / manual review

3. DEVELOPMENT PHILOSOPHY

3.1 Build, do not rebuild

This is an active long-term project.

Never unnecessarily rebuild completed functionality.

3.2 Part-by-part development

The complete system will be developed in independent Parts.

Each Part must:

Inspect the existing project.

Understand dependencies.

Modify only required files.

Preserve existing working functionality.

Run tests.

Verify the result.

Report completed work.

Clearly state what the next Part requires.

3.3 No blind assumptions

If an existing file, API, database table or function is required but
unavailable:

Do not invent its implementation.

Identify the missing dependency.

Ask for or inspect the required file/context.

Do not silently replace working architecture.

3.4 UI preservation

When an existing UI is already approved:

Do not redesign it without explicit instruction.

Do not replace the design system.

Do not introduce an unrelated framework.

Preserve responsive behavior.

Preserve existing user flows.

4. MASTER SYSTEM ARCHITECTURE

4.1 Required technology stack

Frontend: Next.js + TypeScript

UI: Tailwind CSS v4 + custom design system

Mobile: PWA, mobile-first, app-like UX

Backend: Python + FastAPI

Database: PostgreSQL using the existing Neon PostgreSQL service

Automation: Python background worker/scheduler

Authentication: Google OAuth 2.0 + application-side RBAC + outlet scope

API: REST/JSON

Containerization: Docker

Reverse proxy: Nginx or equivalent where required

Version control: existing Git repository

Deployment: existing Render service/pipeline

AI provider/model: provider-agnostic

Do not introduce React/Vue/Angular separately from Next.js.
Do not introduce another frontend framework.
Tailwind CSS v4 is the UI component baseline.

4.2 High-level architecture

                         CENTRAL RESTAURANT ERP
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Next.js + PWA                Google OAuth
                    │                           │
                    └─────────────┬─────────────┘
                                  ↓
                         Python + FastAPI
                                  ↓
                    Authentication + RBAC
                                  ↓
                 Outlet Scope / Data Isolation
                                  ↓
                     Business Rules / Workflow
                                  ↓
               ┌──────────────────┼──────────────────┐
               ↓                  ↓                  ↓
          Neon PostgreSQL     Automation          AI Tools
               │                  │                  │
               └──────────────────┼──────────────────┘
                                  ↓
                         Central Business Data

        HEAD OFFICE → authorized access to all outlets
        OUTLET USER → authorized access to assigned outlet only

4.2.1 Modern Frontend Architecture Rule

The frontend must be built as a modern React application using the Next.js App Router.

Required:

Next.js

React

TypeScript

Tailwind CSS v4

PWA

Accessible, touch-first responsive UI

Server Components where appropriate

Client Components only where interactivity requires them

Strong TypeScript types

Reusable design-system components

Centralized design tokens

Consistent loading, error, empty and success states

Mobile-first performance

Do not build the new UI as a collection of legacy HTML pages.
Do not reproduce the old application's visual language.

Tailwind CSS v4 should be used with its modern CSS-first approach and design tokens.
Avoid unnecessary CSS preprocessors or duplicated styling systems.

4.2.2 PROFESSIONAL ERP UI / UX DESIGN SYSTEM

The new application must use a custom professional enterprise ERP interface.
Reference screenshots may be used only to understand layout quality, hierarchy,
spacing and usability. Do NOT copy another product's visual design, branding,
components, wording or exact layout.

Desktop Application Shell

┌─────────────────────────────────────────────────────────────────────┐
│ Top Header: Brand | Current Outlet/Scope | Search | Alerts | User   │
├───────────────┬─────────────────────────────────────────────────────┤
│ LEFT SIDEBAR  │                                                     │
│               │                 MAIN WORKSPACE                      │
│ Dashboard     │                                                     │
│ Operations    │                                                     │
│ Inventory     │                                                     │
│ Purchase      │                                                     │
│ Production    │                                                     │
│ HR            │                                                     │
│ Finance       │                                                     │
│ Reports       │                                                     │
│ Automation    │                                                     │
│ Settings      │                                                     │
│               │                                                     │
│ Collapse      │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘

The desktop sidebar is the primary navigation system. It must be collapsible,
clean and logically grouped. Major modules must not be duplicated as large
navigation blocks inside the Dashboard.

Mobile / PWA Application Shell

┌───────────────────────────────┐
│ Menu | Page Title | Alerts    │
├───────────────────────────────┤
│                               │
│       MAIN WORKSPACE          │
│                               │
├───────────────────────────────┤
│ Optional compact actions      │
└───────────────────────────────┘

Menu → Off-canvas / Drawer Navigation

Mobile must NOT use a permanent desktop sidebar. Navigation must open through a
clean touch-friendly drawer/off-canvas menu. The application must remain
mobile-first, responsive and PWA-friendly with no unnecessary horizontal
scrolling.

Dashboard Rule

The Dashboard is a management/control center, not a CRUD workspace.

It should contain only the information needed for quick decisions:

KPI / summary cards

Important alerts

Pending approvals

Quick actions

Useful charts / trends

Outlet or business summary

Recent important activity

Large CRUD tables, long forms and full module-management sections belong inside
their dedicated module pages, not on the main Dashboard.

Module Workspace Rule

Every major module must have its own dedicated workspace. Related functions
must be grouped logically rather than displayed as unrelated cards.

Recommended structure:

Page Header
   ↓
Module Summary / KPI
   ↓
Tabs or Module Navigation (when required)
   ↓
Search + Filters + Date/Outlet Scope
   ↓
Primary Data Table / Cards
   ↓
Create / Edit / View / Approve / Export Actions
   ↓
Details / Drawer / Dialog

Each module must provide consistent:

Loading state

Empty state

Error state

Success feedback

Validation feedback

Permission-aware actions

Responsive table/card behavior

Visual Quality Rules

The visual system must be:

Professional enterprise SaaS quality

Clean and spacious

High readability

Consistent typography hierarchy

Consistent spacing scale

Consistent buttons and form controls

Consistent cards, tables, dialogs and status badges

Subtle borders and restrained shadows

Clear primary/secondary/destructive action hierarchy

Accessible contrast and touch targets

Responsive on desktop, tablet and mobile

The design must feel custom-built for this restaurant ERP and must not look like
a copied template.

Design System Rules

Create reusable components and centralized design tokens for:

App shell

Sidebar / drawer

Header

Page header

KPI cards

Tabs

Buttons

Inputs / selects

Search / filters

Tables

Data cards

Status badges

Dialogs / drawers

Toast / feedback

Loading skeletons

Empty states

Error states

Confirmation dialogs

Do not create duplicate components when an existing shared component can be reused.

Frontend Architecture Requirement

Frontend implementation is explicitly:

Next.js App Router

React

TypeScript

Tailwind CSS v4

Custom reusable design system

PWA

Mobile-first responsive UI

Backend implementation is explicitly:

Python

FastAPI

REST/JSON APIs

PostgreSQL / Neon

Backend business rules remain the source of truth for financial, inventory,
authorization and outlet-scope calculations.

Backend + Frontend Part Rule

For a feature that requires both layers, the same Part must implement and verify:

Backend API / Business Logic
        ↓
Database
        ↓
Frontend API Integration
        ↓
Frontend UI
        ↓
End-to-End Verification

Do not build disconnected frontend screens with fake data when the backend
contract is available.

The project must target modern browsers supported by the selected Tailwind CSS v4 release.
If an older browser requirement appears later, document the compatibility tradeoff before changing the stack.

4.3 Infrastructure preservation rule

This is a rebuild of the product, NOT a rebuild of the hosting infrastructure.

The following existing infrastructure must remain:

Existing Git repository

Existing Render service/deployment pipeline

Existing Neon PostgreSQL service

Existing demo data, unless a future explicit task requests a controlled change

Do NOT delete, recreate, disconnect, reset, or replace these infrastructure resources.

The old application implementation is NOT the source of truth.
The Master Blueprint and the new requirements are the source of truth.

5. AUTOMATION ARCHITECTURE

Every automation should be represented conceptually as:

Trigger
  ↓
Condition
  ↓
Data Retrieval
  ↓
AI / Business Logic
  ↓
Validation
  ↓
Approval if required
  ↓
Action
  ↓
Audit Log
  ↓
Notification

Trigger examples

New invoice uploaded

New purchase created

Stock below minimum

Scheduled time reached

New Telegram message

New WhatsApp message

Sales anomaly detected

Wastage threshold exceeded

Supplier payment becoming due

Daily closing time reached

6. RESTAURANT CORE MODULES

The final platform must be organized into clear modules. Modules may be
implemented in separate Parts, but the architecture must reserve the
required boundaries from the beginning.

6.1 Head Office / Management

Central dashboard

14-outlet overview

Outlet performance

Sales comparison

Profitability

Food cost / beverage cost

Labour cost

Wastage

Purchase

Inventory

Cash and closing

Complaints

Customer feedback

Supplier performance

Management alerts

Cross-outlet reports

6.2 Outlet Operations

Each outlet must have its own scoped operational workspace:

Outlet dashboard

POS / sales

Orders

Tables

KOT / kitchen

Billing

Discounts

Refunds

Day closing

Cash management

Local expenses

Stock

Purchase requests

Transfers

Wastage

Staff

Complaints

Maintenance tickets

6.3 POS / Restaurant Operations

Dine-in

Takeaway

Delivery

Table management

Orders

KOT

Kitchen status

Billing

Payment modes

Discounts

Complimentary items

Cancelled items

Refunds

Shift / cashier closing

Order history

Menu management

Modifier / add-on support

6.4 HR

Employee master

Employee ID

Outlet assignment

Department

Designation

Joining / exit

Attendance

Leave

Shift

Overtime

Salary

Advance

Performance

Warning / disciplinary record

Employee documents

Transfer between outlets

HR reports

6.5 Accounts & Finance

Chart of accounts

Ledger

Journal

Cash

Bank

Petty cash

Expenses

Receivables

Payables

Supplier payments

Salary

Tax configuration

Daily closing

Cash reconciliation

Bank reconciliation

Trial balance

Profit & Loss

Balance Sheet

Outlet-wise finance

Company-wide finance

Financial calculations must be deterministic backend calculations, not AI-generated arithmetic.

6.6 Purchase

Suppliers

Purchase requests

Approval

Purchase orders

Goods received / GRN

Purchase invoices

Purchase returns

Supplier payments

Rate history

Supplier comparison

Quality issues

Delivery performance

6.7 Inventory

Items

Categories

Units

Unit conversion

Opening stock

Stock in

Stock out

Sales consumption

Closing stock

Minimum stock

Stock adjustment

Stock transfer

Stock history

Physical count

Variance

Batch / expiry where applicable

Slow / fast moving stock

6.8 Production / Kitchen Production

Recipes

Ingredients

BOM

Production planning

Production entries

Ingredient consumption

Yield

Production transfer

Finished goods

Production variance

6.9 Wastage

Wastage entry

Wastage reason

Approval

Cost

Outlet comparison

Trend

Abnormal wastage

6.10 Beverage / Alcohol Control

This is a separate controlled inventory area.

Beverage master

Alcohol item master

Bottle / unit size

Opening stock

Purchase

Transfer in/out

Sales

Complimentary

Breakage

Wastage

Closing stock

Physical count

Variance

Controlled permissions

Audit trail

Do not assume local alcohol licensing, tax, excise, or legal requirements. Such rules must be configurable and validated for the company's jurisdiction before production use.

6.11 Customer / CRM

Customer profile

Order history

Loyalty

Feedback

Complaints

Customer segmentation

Offers

Membership

6.12 Complaint / Customer Support

Complaint ID

Customer

Order

Outlet

Category

Severity

Assigned person

Investigation

Action

Resolution

Compensation / refund

Root cause

Resolution time

Management review

6.13 Maintenance / Asset Management

Equipment master

AC

Refrigerator

Freezer

Oven

POS equipment

Printer

CCTV

Electrical

Plumbing

Maintenance tickets

Technician assignment

Cost

Preventive maintenance

Repair history

Asset downtime

6.14 Supplier Management

Supplier master

Contact details

Purchase history

Rate history

Outstanding

Payment

Delivery performance

Quality score

Supplier issues

6.15 Reports & Analytics

Sales

Purchase

Stock

Production

Wastage

Supplier

Outlet

HR

Accounts

Cash

Alcohol / beverage

Complaints

Maintenance

Profitability

Management summary

AI insights

The final platform may contain:

Operations

Dashboard

Sales

Orders

Billing

Customers

Outlets / Branches

Staff

Inventory

Items

Categories

Units

Opening stock

Stock in

Stock out

Closing stock

Minimum stock

Stock adjustment

Stock transfer

Stock history

Purchase

Suppliers

Purchase requests

Purchase orders

Goods received

Purchase invoices

Purchase returns

Supplier payments

Production

Recipes

Ingredients

BOM

Production entries

Production consumption

Production transfer

Wastage

Wastage entry

Wastage reason

Wastage approval

Wastage analysis

Wastage cost

Finance / Business

Expenses

Payments

Receivables

Payables

Cost analysis

Profit analysis

Reports

Sales

Purchase

Inventory

Production

Wastage

Supplier

Outlet

Profitability

AI insights

AUTOMATION-FIRST PRODUCT RULE

Automation is a core product capability, not an optional add-on.

Every major module must be designed with:

event detection

business rules

workflow state

approval requirements

notification

audit log

retry/failure handling

automation history

optional AI analysis

Do not create isolated CRUD screens when a useful business workflow can be automated.

For example, low stock should not stop at "show low stock":
it should support alert → recommendation → approval → purchase workflow →
receiving → stock update → accounting impact → management visibility.

Automation must remain deterministic for critical financial/inventory operations.
AI should assist with interpretation, prediction, recommendations and controlled
actions, not become the source of truth for arithmetic or authorization.

6.15 PROCUREMENT, CENTRAL STORE & DIRECT OUTLET SUPPLY

The procurement architecture must support multiple legitimate supply paths.
Do NOT assume that every purchase goes through the Central Store.

6.15.1 Business Units / Locations

The system must distinguish:

CENTRAL_STORE

DESSERT_KITCHEN / PRODUCTION_KITCHEN

OUTLET_01 ... OUTLET_14

Future warehouses/distribution centres

These are operational locations/business units, not merely generic users.

6.15.2 Purchase Destination

Every purchase transaction must have an explicit destination.

Supported destinations:

Central Store

Dessert Kitchen / Production Kitchen

Any authorized Outlet

Future authorized warehouse/distribution centre

The destination determines where the received stock is added and which outlet/
business-unit accounts and reports are affected.

6.15.3 Central Procurement Flow

For items that are centrally purchased:

Outlet Requisition
        ↓
Central Store
        ↓
Stock Availability Check
        ↓
Available → Stock Issue / Transfer → Outlet
        ↓
Not Available
        ↓
Purchase Request
        ↓
Approval
        ↓
Supplier Purchase Order
        ↓
GRN / Receiving
        ↓
Central Store Stock
        ↓
Issue / Transfer to Outlet

The complete chain must be auditable.

6.15.4 Direct Outlet Purchase

Some suppliers deliver raw materials or supplies directly to specific outlets.

The system must support:

Supplier
   ↓
Direct Purchase Order
   ↓
Outlet 03
   ↓
Outlet 03 Receiving / GRN
   ↓
Outlet 03 Stock

The goods must NOT be added to Central Store stock when the purchase destination
is the outlet.

Example:

Purchase Type: DIRECT_OUTLET_PURCHASE
Supplier: ABC Dairy
Destination: Outlet 03
Item: Milk
Quantity: 100 L

The receiving transaction must update Outlet 03 stock and the corresponding
purchase/accounting records.

6.15.5 Dessert Kitchen / Production Kitchen Procurement

The Dessert Kitchen may receive raw materials directly from suppliers:

Supplier
   ↓
Purchase Order
   ↓
Dessert Kitchen
   ↓
GRN / Receiving
   ↓
Kitchen Raw Material Stock
   ↓
Production
   ↓
Finished Goods
   ↓
Distribution to Outlets

The system must keep kitchen procurement, kitchen inventory and production
consumption traceable.

6.15.6 Multi-Destination Purchase Order

One supplier may supply multiple destinations.

The system should support either:

one purchase order with destination-specific lines, or

separate purchase orders generated from one procurement request,

depending on the workflow and accounting requirements.

Example:

ABC Supplier
├── Outlet 01      → Milk 50 L
├── Outlet 02      → Milk 30 L
├── Central Store  → Milk 100 L
└── Dessert Kitchen → Milk 40 L

Each destination must have its own receiving/stock impact.

Never merge stock movements merely because the supplier is the same.

6.15.7 Purchase Types

At minimum support:

CENTRAL_STORE_PURCHASE

DIRECT_OUTLET_PURCHASE

DESSERT_KITCHEN_PURCHASE

OTHER_AUTHORIZED_LOCATION_PURCHASE

TRANSFER_BASED_REPLENISHMENT

The architecture must remain extensible.

6.15.8 Supplier Routing

The system should support supplier/location routing rules such as:

Supplier
   ↓
Allowed / Default Destinations
   ↓
Item Category
   ↓
Outlet / Location Requirement

Example:

ABC Dairy
├── Outlet 01
├── Outlet 03
└── Outlet 07

These are defaults/suggestions, not automatic authorization to bypass approval.

6.15.9 Procurement Approval

Purchase workflows must support:

Request

Approval

Rejection

Revision

Purchase Order

Partial receiving

Full receiving

Short/excess receiving

Invoice matching where applicable

Payment status

Cancellation

Audit history

Authorization must be based on role, amount, destination and company policy.

6.15.10 Purchase & Inventory Accounting

The system must maintain a traceable relationship:

Purchase Request
      ↓
Purchase Order
      ↓
Supplier
      ↓
Destination
      ↓
GRN / Receiving
      ↓
Stock Ledger
      ↓
Accounts Payable / Expense / Inventory Value

Reports must support:

Supplier-wise purchase

Destination-wise purchase

Outlet-wise purchase

Central Store purchase

Dessert Kitchen purchase

Category-wise purchase

Item-wise purchase

Direct vs Central procurement

Purchase-to-receiving variance

Purchase-to-stock variance

Supplier price variance

Pending purchase orders

Pending receiving

Pending invoices/payments

6.15.11 Automation Hooks

The procurement engine must expose automation events for:

Outlet stock minimum reached

Requisition created

Requisition approved

Central stock insufficient

Purchase request created

Purchase approval pending

Purchase order created

Supplier delivery due

GRN pending

Partial receiving

Price variance detected

Direct outlet purchase required

Supplier performance issue

Automation must never bypass required approvals.



6.15.12 CENTRAL PURCHASE CONTROL & OUTLET PURCHASE REQUEST QUEUE

All outlet purchase requirements must enter one centralized Purchase Control
workflow before being sent to suppliers.

Required flow:

OUTLET
  ↓
Purchase Request
  ↓
CENTRAL PURCHASE CONTROL
  ↓
Review / Verify / Approve / Reject / Edit
  ↓
Approved Purchase Order
  ↓
Supplier
  ↓
Delivery
  ↓
GRN / Invoice
  ↓
Destination Stock
  ↓
Accounts + Food Cost + Reports

The outlet must NOT directly send an unapproved purchase order to the supplier
unless a future company policy explicitly enables a controlled exception.

The Central Purchase Control screen must show all outlet purchase requests in
one place with filters for:

Outlet

Request date

Required date

Supplier

Item

Category

Quantity

Estimated amount

Priority

Approval status

Delivery status

Payment status

The purchase controller must be able to:

Review

Approve

Reject

Return for correction

Edit permitted fields

Consolidate compatible outlet requirements

Select/confirm supplier

Create/send the approved purchase order

Track delivery

Track receiving

Track invoice

Track payment

6.15.13 PURCHASE AMOUNT & INVOICE-WISE ACCOUNTING

Every purchase must be traceable from request amount through final invoice.

Required chain:

Request Amount
      ↓
Approved PO Amount
      ↓
Received Quantity × Actual Rate
      ↓
Invoice Amount
      ↓
Tax / Discount / Other Charges
      ↓
Net Payable
      ↓
Payment

The system must maintain both:

Estimated/requested amount

Actual invoice amount

Never overwrite the original request amount with the invoice amount.

Support:

Invoice number

Invoice date

Supplier

Purchase order

GRN

Destination

Item lines

Quantity

Unit rate

Tax

Discount

Other charges

Net amount

Payment status

Payment reference

Due date

Invoice-wise drill-down must be available.

A user must be able to open one invoice and trace:

Invoice
 ↓
Purchase Order
 ↓
Purchase Request(s)
 ↓
Outlet / Destination
 ↓
GRN
 ↓
Received Stock
 ↓
Stock Ledger
 ↓
Accounts
 ↓
Food Cost impact

6.15.14 FOOD COST — CENTRAL + OUTLET + SYSTEM TOTAL

Food Cost must be calculated as a system-wide financial/operational metric and
must also be drillable down to outlet and item/category level.

At minimum support:

Food Cost % =
Food / Food-Related Consumption Cost ÷ Applicable Food Sales × 100

The exact accounting definition must be configurable by company policy.

The system must support:

Outlet Food Cost

Central Store Food Cost impact

Dessert Kitchen / Production Food Cost

Category Food Cost

Item Food Cost

Daily Food Cost

Weekly Food Cost

Monthly Food Cost

Company-wide Total Food Cost

Food Cost %

Theoretical Food Cost

Actual Food Cost

Variance

Where inventory accounting is enabled, actual food consumption should be based
on the configured stock/consumption method rather than simply treating every
purchase as consumption.

For example:

Opening Stock
+ Purchases / Transfers In
- Transfers Out
- Closing Stock
= Consumption

The exact formula must be configurable to match the company's accounting policy.

6.15.15 ONE SYSTEM — TEN STAFF WORKFLOWS

The product goal is to consolidate repetitive work normally spread across many
staff roles into one controlled system.

The system should connect:

Outlet Operations
      ↓
Purchase Requests
      ↓
Central Purchase
      ↓
Supplier
      ↓
Receiving / GRN
      ↓
Inventory
      ↓
Production
      ↓
Sales / POS
      ↓
Accounts
      ↓
Food Cost
      ↓
HR
      ↓
Complaints
      ↓
Maintenance
      ↓
Management
      ↓
Automation + AI

Do not interpret "10 people in one software" as removing required human
approvals or controls.

The objective is to automate repetitive data entry, calculations, follow-ups,
reconciliation, alerts, reporting and workflow routing while preserving
appropriate human approval for sensitive operations.

Every major workflow must avoid duplicate manual data entry where the same
event can be generated from an existing transaction.

Example:

Approved Purchase
      ↓
PO
      ↓
GRN
      ↓
Stock Update
      ↓
Invoice Matching
      ↓
Accounts Payable
      ↓
Food Cost / Inventory Valuation
      ↓
Management Reports

The user should not have to enter the same purchase information separately into
Purchase, Stock, Accounts and Food Cost modules.

6.15.16 CENTRAL MANAGEMENT DASHBOARD

Head Office must have a consolidated view of:

All outlet purchase requests

Pending approvals

Approved purchases

Supplier orders

Pending deliveries

GRNs

Invoice totals

Payables

Outlet-wise purchase

Outlet-wise food cost

Company-wide food cost

Stock value

Wastage

Sales

Gross margin indicators

Purchase variance

Supplier performance

Exceptions requiring human attention

Outlet users must only see data allowed by their role and outlet scope.



6.15.17 TWICE-MONTHLY OUTLET CLOSING & STOCK VALUATION

The company closing cycle must support exactly two standard inventory closing
periods per month.

Closing Periods

Period 1

1st day of month → 15th day
Closing date: 15th

Period 2

16th day → Last day of month
Closing date: Last calendar day

For February, the second period ends on the actual last calendar day
(28 or 29).

The system must automatically create the next period after the previous period
is closed and locked.

Closing Workflow

At each closing, the outlet user will provide the physical closing quantity
for each applicable stock item.

The outlet should NOT manually calculate the monetary value.

The system calculates the value from the recorded quantity and the configured
inventory valuation method.

Opening Stock
     +
Received Purchases
     +
Other Authorized Receipts
     -
Closing Stock
     =
Consumption Value

Transfers are NOT part of the normal outlet replenishment workflow in this
model. Outlet supply is based on approved purchase requests and supplier
delivery/receiving.

Item-Wise Closing Value

Example:

Chicken    12 KG × ₹300/KG = ₹3,600
Milk       20 L  × ₹60/L   = ₹1,200
Sugar      15 KG × ₹50/KG  = ₹750
Oil         8 L  × ₹150/L  = ₹1,200
--------------------------------
Total Closing Stock Value    ₹6,750

The rate must come from the configured inventory valuation method and the
system's purchase/stock ledger. The user must not manually type an arbitrary
closing rate unless an authorized adjustment workflow permits it.

Period Lock

After the outlet submits closing:

Closing Submitted
      ↓
System Validation
      ↓
Reconciliation
      ↓
Approved
      ↓
Period LOCKED

A locked period must not allow ordinary edits or deletions.

Corrections must use an authorized reopen/adjustment workflow with:

reason

authorized user

timestamp

before value

after value

audit log

Automatic Next-Period Opening

When Period 1 closes:

1–15
 ↓
Closing Stock
 ↓
LOCK
 ↓
16th starts
 ↓
Opening Stock = Previous Closing Stock

When Period 2 closes:

16–Last Day
 ↓
Monthly Closing
 ↓
LOCK
 ↓
Next Month Period 1

The system must carry the previous period's closing quantity/value into the next
period according to the configured inventory valuation method.

Food Cost Integration

Each closing period must feed the Food Cost engine.

At minimum:

Opening Stock
+ Received Purchase Value
- Closing Stock Value
= Actual Consumption Value

Then compare:

Actual Consumption
        vs
Theoretical Recipe Consumption
        ↓
Variance
        ↓
Food Cost %

Food Cost must be available for:

Outlet

Item

Category

Period

Month

Company total

The company monthly report must combine both closing periods:

Period 1: 1–15
Period 2: 16–Month End
       ↓
Full Month Report

The two periods must remain separately drillable.

Amount Matching / Reconciliation

The system must maintain a single source of truth for monetary calculations.

Purchase amount, receiving amount, stock valuation, consumption value and food
cost must be linked through transaction IDs.

Do not manually re-enter the same amount in multiple modules.

Any mismatch must create an exception instead of silently changing a number.

Examples:

Purchase quantity vs received quantity mismatch

Purchase rate vs invoice rate mismatch

Expected stock vs physical closing mismatch

Actual food cost vs theoretical recipe cost variance

Invoice amount vs PO amount variance

Every exception must be traceable and auditable.

Closing Dashboard

The outlet closing screen should show:

Current closing period

Opening stock

Received purchases

Items requiring physical count

Item-wise closing quantity

System-calculated closing value

Expected consumption

Food Cost

Variance/exceptions

Submission status

Approval/lock status

The Head Office dashboard should show:

All outlets' closing status

Submitted / Pending / Approved / Locked

Outlet-wise closing value

Outlet-wise consumption

Outlet-wise Food Cost

Company total

Exception list

An outlet user must only see and submit data for its authorized outlet scope.
Head Office users with appropriate permission may see the consolidated view.

6.16 COMPLETE AUTOMATION SCOPE

Automation is part of the final product, but it will be implemented later in
dedicated Parts after the core ERP foundation is stable.

The Master Blueprint must reserve the complete automation scope from day one.

Operational Automation

Low-stock alerts

Minimum-stock alerts

Reorder suggestions

Purchase request generation

Purchase approval reminders

Purchase order follow-up

Supplier delivery reminders

GRN pending alerts

Stock variance alerts

Physical stock-count reminders

Expiry alerts

Batch/expiry monitoring where applicable

Wastage alerts

Abnormal wastage detection

Production reminders

Production shortage alerts

Transfer reminders

Transfer pending alerts

Outlet stock balancing suggestions

Daily opening reminders

Daily closing reminders

Cash closing reminders

Cash mismatch alerts

Payment reconciliation alerts

Outstanding supplier payment reminders

Expense approval reminders

Restaurant / POS Automation

Unpaid order alerts

Pending KOT alerts

Delayed kitchen-order alerts

Cancelled-order monitoring

Refund monitoring

Discount monitoring

Complimentary-order monitoring

Table/order status alerts

Abnormal sales pattern alerts

End-of-day sales summary

Outlet daily performance summary

HR Automation

Attendance anomaly alerts

Late attendance alerts

Missing attendance reminders

Leave approval reminders

Shift reminders

Overtime alerts

Employee document expiry reminders

Probation/review reminders

Salary processing reminders

Employee transfer workflow notifications

Accounts & Finance Automation

Daily financial summary

Cash reconciliation alerts

Bank reconciliation reminders

Payable reminders

Receivable reminders

Expense approval workflow

Unusual expense alerts

Budget variance alerts

Outlet profitability alerts

Month-end closing reminders

Financial report generation

Management finance alerts

Customer / Complaint Automation

New complaint notification

Complaint assignment

Complaint SLA reminder

Escalation when unresolved

Customer follow-up reminder

Refund/compensation approval reminder

Complaint trend summary

Repeated complaint detection

Maintenance Automation

New maintenance ticket notification

Technician assignment

Repair pending reminder

Preventive maintenance schedule

Equipment service reminder

Asset warranty/contract expiry reminder

High-cost repair alert

Repeated equipment failure alert

Management Automation

Morning management summary

Daily outlet summary

Weekly management report

Monthly management report

Outlet comparison

Sales trend alert

Food-cost alert

Beverage/alcohol variance alert

Labour-cost alert

Purchase-price variance alert

Supplier performance alert

Abnormal outlet-performance alert

Cross-outlet anomaly detection

AI Automation

AI may later provide:

Natural-language business queries

Daily business summary

Management insights

Sales analysis

Stock analysis

Purchase recommendations

Wastage analysis

Complaint analysis

Supplier analysis

Outlet performance analysis

Financial explanation

Document/invoice extraction

Anomaly explanation

Forecasting support

Action recommendations

Controlled workflow actions

AI must use approved application tools and real database results.
AI must never invent business numbers.

Notification Channels

The automation layer should be designed to support:

In-app notifications

Dashboard alerts

Email

Telegram

WhatsApp Business

Scheduled reports

Future additional channels through adapters

External messaging integrations must be implemented only in their dedicated Parts.

Automation Safety

Automation must have:

Permission checks

Outlet scope checks

Approval workflows where required

Audit logs

Retry handling

Failure logging

Idempotency where applicable

Duplicate-notification prevention

Configurable schedules

Enable/disable controls

Execution history

Manual retry where appropriate

Critical financial, inventory, HR and destructive actions must not be executed
automatically without the required authorization/approval workflow.

Automation Implementation Order

Automation is NOT required to be completed in Part 1.

Recommended implementation sequence:

PART 20 → Automation Engine
PART 21 → Scheduled Reports & Alerts
PART 22 → Multi-Outlet Management Intelligence
PART 23 → AI Provider Abstraction
PART 24 → AI Controlled Tools
PART 25 → AI Restaurant Assistant
PART 26 → AI Invoice / Document Processing
PART 27 → Smart Inventory / Purchase Intelligence
PART 28 → AI Wastage / Sales Intelligence
PART 29 → Telegram Integration
PART 30 → WhatsApp Business Integration

The implementation order may be adjusted only when dependencies require it.
The complete scope must not be omitted merely because implementation happens later.

6.15 MULTI-OUTLET CENTRAL CONTROL EXAMPLE

The system must support a central Head Office controlling all outlets.

Example:

                         HEAD OFFICE
                              │
                 ┌────────────┼────────────┐
                 ↓            ↓            ↓
              Outlet 01    Outlet 02    Outlet 14
                 │            │            │
                 └────────────┼────────────┘
                              ↓
                         PostgreSQL

Head Office may view:

All outlet sales

All outlet stock

All outlet purchases

All outlet production

All outlet wastage

All outlet complaints

All outlet maintenance

All outlet staff summaries

All outlet financial summaries

Cross-outlet comparisons

Company-wide reports

Outlet users may view only their authorized outlet data.

Example:

Outlet 03 Manager
    ↓
Outlet 03 Sales       ✓
Outlet 03 Stock       ✓
Outlet 03 Purchase    ✓
Outlet 03 Staff       ✓
Outlet 03 Complaints  ✓

Outlet 04 Sales       ✕
Outlet 05 Stock       ✕
Outlet 01 HR          ✕
Company P&L            ✕

This is a mandatory security requirement, not merely a UI preference.

7. AI LAYER

The AI layer should provide:

AI Assistant

Users can ask:

"Today's sales কত?"

"Which stock is low?"

"What should we purchase today?"

"Which supplier payment is pending?"

"Which item has high wastage?"

"Show yesterday's performance."

"Create today's report."

The AI should retrieve real data through controlled tools instead of
guessing.

8. AI AGENT ARCHITECTURE

User Request
     ↓
Intent Detection
     ↓
AI Agent
     ↓
Tool Selection
     ↓
Tool Execution
     ↓
Data Validation
     ↓
AI Reasoning
     ↓
Response / Action

Example:

"আজকে কোন item কিনতে হবে?"
          ↓
AI Agent
          ↓
get_stock()
          ↓
get_minimum_stock()
          ↓
get_recent_consumption()
          ↓
calculate_requirement()
          ↓
purchase recommendation

9. CONTROLLED AI TOOLS

Potential tools:

get_sales()
get_purchase()
get_stock()
get_item()
get_supplier()
get_wastage()
get_production()
get_outlet()
get_payment()
get_report()

create_purchase_draft()
create_report()
create_alert()
send_notification()

request_approval()

High-risk actions should require explicit approval.

Examples:

create_purchase_order → approval
supplier_payment → approval
stock_adjustment → approval
delete_transaction → restricted
financial action → restricted

AI must never have unrestricted database write/delete access.

10. AI INVOICE AUTOMATION

Target workflow:

Invoice Photo / PDF
        ↓
Document Processing
        ↓
AI Extraction
        ↓
Structured JSON
        ↓
Item Matching
        ↓
Quantity Validation
        ↓
Rate Validation
        ↓
Tax Validation
        ↓
Total Validation
        ↓
Purchase Order Comparison
        ↓
MATCH / MISMATCH
        ↓
Approval / Manual Review

Extractable fields may include:

Supplier

Invoice number

Invoice date

Item

Quantity

Unit

Rate

Discount

Tax

Total

The final financial calculation must be validated by deterministic
backend logic.

11. SMART INVENTORY AUTOMATION

The system should eventually calculate:

Current stock

Minimum stock

Average consumption

Recent consumption

Stock velocity

Reorder requirement

Excess stock

Slow-moving stock

Fast-moving stock

Stock anomaly

Example:

Current Stock = 8 kg
Minimum Stock = 15 kg
Average Daily Consumption = 5 kg

AI Recommendation:
Purchase approximately 20 kg

The exact purchase quantity must be controlled by configured business
rules.

12. AI PURCHASE AUTOMATION

Target flow:

Stock Data
   ↓
Consumption History
   ↓
Minimum Stock
   ↓
Forecast / Recommendation
   ↓
Supplier Information
   ↓
Purchase Draft
   ↓
Manager Approval
   ↓
Purchase Order

The system must not automatically spend money without configured
authorization.

13. AI WASTAGE INTELLIGENCE

AI should eventually identify:

High wastage items

High wastage outlets

Wastage trends

Abnormal wastage

Estimated financial loss

Repeated wastage patterns

Example:

Normal weekly wastage: ₹4,000
Current weekly wastage: ₹6,200

Deviation: +55%

Action:
Manager review required.

14. AI SALES INTELLIGENCE

Potential analysis:

Top-selling products

Low-selling products

Sales trends

Peak hours

Outlet comparison

Average bill

Product contribution

Sales anomalies

Period-over-period comparison

AI-generated insights must be based on actual stored data.

15. TELEGRAM AI ASSISTANT

Initial communication architecture:

Telegram User
     ↓
Telegram Bot
     ↓
Webhook / Bot API
     ↓
Backend
     ↓
Authentication / User Mapping
     ↓
AI Agent
     ↓
Controlled Tools
     ↓
Database
     ↓
Response
     ↓
Telegram

Example:

User:
"আজকের purchase কত?"

AI:
"আজকের total purchase ₹31,200.
Suppliers: 6
Invoices: 14"

16. WHATSAPP AI ASSISTANT

WhatsApp should be treated as a production integration.

Target architecture:

WhatsApp
   ↓
Approved Business API / Provider
   ↓
Webhook
   ↓
Backend
   ↓
AI Agent
   ↓
Controlled Tools
   ↓
Database
   ↓
Response

Do not assume unofficial WhatsApp automation methods are
production-safe.

17. SCHEDULED AUTOMATION

The platform should support scheduled tasks such as:

Daily

Morning stock alert

Daily purchase recommendation

Previous-day sales report

Outstanding payment alert

Weekly

Wastage analysis

Supplier performance

Outlet performance

Inventory summary

Monthly

Monthly sales report

Purchase analysis

Profitability

Inventory movement

Management summary

18. ALERT ENGINE

Possible alerts:

LOW_STOCK
HIGH_WASTAGE
INVOICE_MISMATCH
SALES_DROP
PAYMENT_DUE
UNUSUAL_STOCK_MOVEMENT
PURCHASE_ANOMALY
SYSTEM_ERROR

Each alert should have:

Type

Severity

Source

Timestamp

Recipient

Status

Resolution / acknowledgement

19. USER ROLES

The initial role model must support both Head Office and outlet-level access.

Potential roles:

SUPER_ADMIN
HEAD_OFFICE_ADMIN
MANAGEMENT
HR_ADMIN
ACCOUNTS_ADMIN
PURCHASE_MANAGER
INVENTORY_MANAGER
PRODUCTION_MANAGER
OPERATIONS_MANAGER
CUSTOMER_SUPPORT
MAINTENANCE_MANAGER

OUTLET_MANAGER
OUTLET_CASHIER
OUTLET_STORE_USER
OUTLET_PURCHASE_USER
OUTLET_KITCHEN_USER
OUTLET_STAFF
VIEW_ONLY

Permissions must be role-based AND scope-based.

19.1 Outlet isolation rule

An outlet user must never access another outlet's data.

Example:

User:
  role = OUTLET_MANAGER
  outlet_id = OUTLET_03

Allowed:
  OUTLET_03 sales
  OUTLET_03 stock
  OUTLET_03 purchase requests
  OUTLET_03 staff
  OUTLET_03 complaints
  OUTLET_03 closing

Denied:
  OUTLET_01
  OUTLET_02
  OUTLET_04 ... OUTLET_14
  Head Office financial data
  Other outlet HR

Head Office users with the appropriate permission may have ALL_OUTLETS scope.

This restriction must be enforced in the backend/database query layer. Hiding menu items in the frontend is NOT security.

19.2 Permission model

Use granular permissions such as:

sales.view
sales.create
sales.edit
sales.cancel
sales.refund
sales.approve

stock.view
stock.create
stock.adjust
stock.transfer
stock.approve

purchase.view
purchase.create
purchase.approve
purchase.receive

accounts.view
accounts.create
accounts.approve
accounts.payment

hr.view
hr.manage

reports.view
reports.export

Every protected endpoint must check both permission and data scope.

Potential roles:

SUPER_ADMIN
ADMIN
MANAGER
STORE_USER
PURCHASE_USER
PRODUCTION_USER
ACCOUNTS_USER
VIEW_ONLY

Permissions must be role-based.

Do not rely only on frontend hiding.

Backend authorization is mandatory.

20. APPROVAL SYSTEM

Sensitive actions should support:

DRAFT
   ↓
SUBMITTED
   ↓
UNDER_REVIEW
   ↓
APPROVED / REJECTED
   ↓
EXECUTED

Examples:

Purchase approval

Stock adjustment approval

Invoice mismatch approval

Payment approval

High-value transaction approval

21. AUDIT LOG

Every important action should record:

User

Role

Action

Entity

Entity ID

Old value where appropriate

New value where appropriate

Timestamp

Source

IP/device information where appropriate

AI action indicator

Example:

User: Manager
Action: APPROVED_PURCHASE
Purchase ID: 1024
Time: 2026-08-15 21:30
Source: Telegram

22. DATABASE PRINCIPLES

The database is the system of record.

The database must support:

Data integrity

Foreign keys / relationships

Unique constraints

Indexes

Transaction safety

Auditability

Soft-delete where appropriate

Historical records

Multi-outlet support

User-to-role relationships

User-to-outlet scope

Approval states

Financial records

Inventory movement history

22.1 Multi-outlet data model rule

Operational tables that belong to an outlet must have an explicit outlet/branch scope where appropriate.

Typical relationship:

Company
  ↓
Outlet
  ↓
Department / Users
  ↓
Transactions

Never rely on a frontend-selected outlet alone. The backend must derive or verify the user's allowed outlet scope.

22.2 Demo data rule

There must be NO live company data in development.

Create a dedicated deterministic demo/seed dataset for testing, such as:

14 demo outlets

Demo users for each major role

Demo menu items

Demo ingredients

Demo stock

Demo suppliers

Demo purchases

Demo sales/orders

Demo production

Demo wastage

Demo expenses

Demo employees

Demo complaints

Demo maintenance tickets

Demo beverage/alcohol records

Demo accounting transactions

All demo records must be clearly marked as demo/test data and must never be mixed with production data.

The seed must be repeatable and resettable.

Recommended commands conceptually:

seed demo
reset demo

Actual commands are finalized during implementation.

22.3 No fake success

A UI must not display successful transactions merely because demo data exists. CRUD operations, validations, permissions, calculations, and reports must execute against the development database and be tested end-to-end.

The database must be designed around:

Data integrity

Foreign keys / relationships

Unique constraints

Indexes

Transaction safety

Auditability

Soft-delete where appropriate

Historical records

Multi-outlet support

Do not store critical business information only inside AI conversation
history.

AI is not the system of record.

The database is the system of record.

23. API PRINCIPLES

Backend APIs should:

Validate input

Authenticate requests

Authorize actions

Validate business rules

Return predictable JSON

Handle errors consistently

Avoid exposing secrets

Log important failures

Protect sensitive operations

Potential API groups:

/api/auth
/api/users
/api/outlets
/api/items
/api/stock
/api/purchase
/api/suppliers
/api/production
/api/wastage
/api/sales
/api/reports
/api/automation
/api/ai
/api/telegram
/api/whatsapp

Actual routes will be finalized during implementation.

24. SECURITY RULES

Mandatory principles:

Never expose API keys in frontend code.

Store secrets in environment variables / secret management.

Never send database credentials to AI.

Validate all AI-generated structured data.

Authenticate external webhooks.

Authorize every sensitive backend operation.

Rate-limit public endpoints where appropriate.

Sanitize user input.

Log security-sensitive actions.

Never allow AI to bypass approval rules.

25. AI SAFETY RULES

AI must:

Never invent database results.

Never claim an action succeeded unless the backend confirms it.

Never fabricate financial numbers.

Never directly execute unrestricted SQL.

Never bypass user permissions.

Never bypass approval workflows.

Never delete critical records without explicit authorized action.

Clearly report uncertainty when data is incomplete.

Correct pattern:

AI decides which allowed tool is needed
        ↓
Backend executes the tool
        ↓
Backend returns actual result
        ↓
AI explains result

26. MOBILE-FIRST / PWA REQUIREMENTS

The finished application must feel like a professional mobile business app.

Required principles:

Mobile-first design

PWA installability

App icon

Splash/loading experience

Responsive layout

Fast navigation

Bottom navigation where appropriate

Touch-friendly controls

Loading skeletons

Empty states

Error states

Offline-friendly static shell where practical

Secure authenticated sessions

Maximum comfortable mobile content width

Desktop/tablet responsive layout for Head Office

The UI must remain clean and professional rather than looking like a generic admin template.

Do not add visual complexity merely for decoration.

25.5 FUTURE-READY ENGINEERING RULE

The implementation should follow current production-grade web engineering
practices rather than copying patterns from the old application.

Prefer:

modular architecture

typed contracts

API versioning where useful

background jobs for long-running work

idempotent workflows

observability

structured logs

health/readiness checks

automated tests

secure secrets handling

database migrations

audit trails

feature flags for risky rollouts

clear separation between domain logic and UI

provider adapters for AI/messaging integrations

Do not add technologies merely to make the stack look advanced.
Every dependency must have a clear engineering purpose.

26. TECHNOLOGY SELECTION RULE

Technology will be selected based on:

Reliability

Low operating cost

Beginner maintainability

API compatibility

Deployment simplicity

Security

Scalability

Do not add a technology merely because it is popular.

Every major dependency must have a reason.

27. COST STRATEGY

Development should start with free/local options wherever practical.

Preferred architecture must not force paid AI APIs.

AI should be provider-agnostic so the project can later use:

Local models

Free-tier APIs where appropriate

Paid APIs when needed

Potential future cost areas:

AI API usage

Cloud/server hosting

Managed database

WhatsApp Business API/provider

Storage

Monitoring

High-volume messaging

Domain

The application must be designed so infrastructure can move between:

Local development

Free cloud VM where available

Paid VPS

Managed cloud

without rewriting the business domain.

27.1 Deployment target

Initial deployment is NOT part of the early implementation.

The eventual deployment target is an always-on VPS/VM with:

Docker

Reverse proxy

HTTPS

PostgreSQL

Backup

Monitoring

Environment secrets

A free VM may be used for initial production-like testing if reliable enough. Do not assume any free provider is permanently available.

The existing live Render project is OUT OF SCOPE and MUST NOT be modified.

Development should start with free/local options wherever practical.

Expected future cost areas:

AI API usage

Cloud/server hosting

Managed database

WhatsApp Business API/provider

Storage

Monitoring

High-volume messaging

The project must be designed so paid services can be replaced or
upgraded later where practical.

28. DEVELOPMENT PART ROADMAP

This is a NEW GREENFIELD project. Build from zero in a clean project directory.

FOUNDATION

PART 0

Master Blueprint & Development Rules

PART 1

Project Foundation

Next.js + TypeScript

FastAPI

Docker development setup

Environment configuration

Project structure

Health checks

Basic PWA foundation

PART 2

Database Architecture

PostgreSQL

Core entities

Company / outlet

Users / roles / permissions

Migration system

Demo seed/reset

PART 3

Authentication & Authorization

Login

Session/token

RBAC

Outlet scope

Backend authorization

Security tests

PART 4

Design System & App Shell

Mobile-first UI

Tailwind CSS v4

Navigation

Head Office shell

Outlet shell

Loading/error/empty states

PWA install/update UX

RESTAURANT OPERATIONS

PART 5

Company / Outlet Management

PART 6

Menu / Items / Categories / Units

PART 7

POS / Orders / Tables / KOT / Billing

PART 8

Outlet Closing / Cash / Daily Operations

PART 9

Inventory & Stock

PART 10

Purchase & Supplier

PART 11

Production / Recipes / BOM

PART 12

Wastage

PART 13

Beverage & Alcohol Control

PART 14

Customer / CRM / Complaints

PART 15

Maintenance / Asset Management

PEOPLE & FINANCE

PART 16

HR / Employee / Attendance / Leave / Salary

PART 17

Accounts / Finance / Ledger / P&L / Balance Sheet

PART 18

Approval Workflows & Audit System

REPORTING & AUTOMATION

PART 19

Reports & Analytics

PART 20

Automation Engine

PART 21

Scheduled Reports & Alerts

PART 22

Multi-Outlet Management Intelligence

AI

PART 23

AI Provider Abstraction

PART 24

AI Controlled Tools

PART 25

AI Restaurant Assistant

PART 26

AI Invoice / Document Processing

PART 27

Smart Inventory / Purchase Intelligence

PART 28

AI Wastage / Sales Intelligence

PART 29

Telegram Integration

PART 30

WhatsApp Business Integration

QUALITY & RELEASE

PART 31

End-to-End Testing

PART 32

Security Hardening

PART 33

Performance / Mobile Optimization

PART 34

Deployment

PART 35

Backup / Recovery / Monitoring

PART 36

Final Production Audit

The exact sequence may be adjusted only when a dependency requires it.
Any change must be documented before implementation.

PART 0

Master Blueprint & Development Rules

PART 1

Project Foundation

PART 2

Database Architecture

PART 3

Backend / API Foundation

PART 4

Authentication & Role-Based Access

PART 5

Restaurant Core Modules

PART 6

Inventory & Stock Intelligence Foundation

PART 7

Purchase & Supplier System [FEATURES IMPLEMENTED / COMPLETED]
1. Feature: Supplier-Wise Auto Order Consolidation + Multi-Level Approval + WhatsApp Pre-filled Deep-Link Dispatch
- Auto Consolidation Engine: Identifies supplier per item across multiple outlet requests, aggregates identical item quantities, and preserves exact outlet-wise allocation JSON metadata.
- Status Lifecycle: DRAFT -> PENDING_APPROVAL -> APPROVED -> WHATSAPP_OPENED -> SENT_MANUALLY (with REJECTED/CANCELLED support). Never auto-marks as sent upon link generation.
- WhatsApp Integration: Validates supplier numbers (E.164 sanitization), generates formatted pre-filled `https://wa.me/{phone}?text={encoded}` order text with outlet breakdown and PO reference.
- Endpoints:
  - `POST /api/v1/procurement/orders/consolidate` (Auto consolidation)
  - `POST /api/v1/procurement/orders/{id}/submit`
  - `POST /api/v1/procurement/orders/{id}/approve`
  - `POST /api/v1/procurement/orders/{id}/reject`
  - `POST /api/v1/procurement/orders/{id}/whatsapp-link` (Generates pre-filled URL, sets WHATSAPP_OPENED)
  - `POST /api/v1/procurement/orders/{id}/confirm-sent` (User confirms manual send -> SENT_MANUALLY)
  - `GET/POST/PUT /api/v1/procurement/suppliers`
  - `GET/POST /api/v1/procurement/requests`
- Security & Audit: RBAC permission enforcement, outlet scope isolation, and immutable structured `AuditLog` logging.
- Verification: 12 comprehensive automated test cases (56 assertions) in `test_supplier_auto_consolidation_whatsapp.py` passing 100%.

2. Feature: Outlet Smart AI Requirement [FEATURE IMPLEMENTED / COMPLETED]
- Deterministic Requirement Engine: Backend logic calculating outlet requirements using real data: actual stock (`StockBalance`) + 14-day consumption run-rate (`StockLedger`) + target/min safety levels + in-flight pending purchase orders / inbound transfers + supplier catalog mapping.
- Structured Columns: `Item | Current Qty | Required Qty | Short Qty | Suggested Order Qty | Supplier | Priority` (e.g. Rice — 18 KG — Required 40 KG — Short 22 KG — Order 22 KG).
- Interactive Smart Assistant Q&A:
  - Supports queries: *"What stock is low today?"*, *"What do I need to order?"*, *"What is critical?"*, *"What is already pending?"*, *"What do I need for tomorrow?"*.
- Outlet Draft Workflow:
  - Auto Requirement Generation (`POST /api/v1/procurement/smart-requirements/generate`)
  - Outlet Review (`GET /api/v1/procurement/smart-requirements/draft/{branch_id}`)
  - User Edit/Add/Remove (`PUT /api/v1/procurement/smart-requirements/draft/{draft_id}/items`) with full audit history tracking user modifications vs system calculation
  - Confirm Requirement (`POST /api/v1/procurement/smart-requirements/draft/{draft_id}/confirm`) -> converts draft directly into `PurchaseRequest` (`PENDING_APPROVAL`) which seamlessly enters the Supplier Consolidation & WhatsApp pipeline.
- Scheduled Preparation Time & Duplicate Prevention:
  - Outlet schedule configuration (`GET/PUT /api/v1/procurement/smart-requirements/config/{branch_id}`).
  - Auto-scheduled runner (`POST /api/v1/procurement/smart-requirements/process-schedules`) preparing drafts at configured time while preventing duplicate generation for the same calendar date.
- Multi-Tenant Scoping & Security: Strict outlet isolation with 403 Forbidden enforcement on unauthorized branch access.
- Verification: Comprehensive test suite `test_outlet_smart_requirement.py` passing 100%.

PART 8

Production & Recipe System [COMPLETED]
- Recipe / Bill of Materials (BOM) Engine: Standardized dish recipes linking raw ingredients to finished goods/semi-finished goods with yield quantities, preparation times, and dynamic recursive costing rollups.
- Dynamic Sub-Recipe Explosion: Hierarchical multi-level BOM explosion calculating raw ingredient requirements based on target batch quantities.
- Interactive Production Batch Engine:
  - Batch preview with sufficiency checking against real-time kitchen warehouse stock.
  - One-click production batch execution: automatically generates finished goods, deducts raw ingredients via `PRODUCTION_OUT`, logs `PRODUCTION_IN` stock ledger entries, assigns batch numbers/expiry dates, and recalculates unit food cost.
  - Production status lifecycle (`DRAFT` -> `IN_PROGRESS` -> `COMPLETED` / `CANCELLED`).
  - Production reversals (`POST /recipes/production/orders/{id}/reverse`) restoring ingredient stock on quality check rejection.
- Endpoints:
  - `GET/POST /api/v1/recipes` (Recipe CRUD & directory)
  - `GET/PUT/DELETE /api/v1/recipes/{id}`
  - `POST /api/v1/recipes/{id}/clone`
  - `GET /api/v1/recipes/{id}/costing`
  - `POST /api/v1/recipes/{id}/explode`
  - `POST /api/v1/recipes/production/preview`
  - `POST /api/v1/recipes/production/execute`
  - `GET/POST /api/v1/recipes/production/orders`
  - `GET /api/v1/recipes/production/orders/{id}`
  - `POST /api/v1/recipes/production/orders/{id}/check-sufficiency`
  - `PUT /api/v1/recipes/production/orders/{id}/status`
  - `GET /api/v1/recipes/production/orders/{id}/variance`
  - `POST /api/v1/recipes/production/orders/{id}/reverse`
- Frontend Integration: `frontend/src/api/production.ts` and `frontend/src/components/workspaces/ProductionWorkspace.tsx` featuring standard recipe registry, batch run log, sufficiency checking tool, and one-click production execution.
- Verification: 68/68 automated tests in `test_part7_recipe_bom.py` and 100% test pass rate in `test_part9_production_engine.py`.

PART 9

Wastage Management [COMPLETED]
- Core Schema & ORM: `WastageEntry` and `WastageItem` models in `backend/app/models/wastage.py` with full Neon PostgreSQL migration.
- Standard Reason Codes: `EXPIRED`, `PREPARATION_LOSS`, `BURNT_DROPPED`, `QUALITY_ISSUE`, `STORAGE_FAILURE`, `CUSTOMER_RETURN`, `OTHER`.
- Lifecycle & Approval Workflow:
  - `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` / `REJECTED`.
  - Automatic threshold checking (entries $\ge$ ₹1,000 auto-trigger `PENDING_APPROVAL` and require manager sign-off).
  - On Approval: Deducts item quantity from warehouse `StockBalance`, writes structured `StockLedger` audit record with `movementType = 'WASTAGE'`, `referenceType = 'WASTAGE_ENTRY'`, and logs audit trail.
  - On Rejection: Mandatory rejection reason without inventory deduction.
- Analytics & Outlier Detection:
  - Aggregate loss valuation by date range and outlet.
  - Reason code breakdown with cost and percentage contributions.
  - Top high-loss items ranking.
  - Abnormal spoilage detection alerting on high-cost spikes (+50% surge over baseline).
- API Endpoints:
  - `GET /api/v1/wastage/reasons`
  - `GET /api/v1/wastage/entries`
  - `POST /api/v1/wastage/entries`
  - `GET /api/v1/wastage/entries/{id}`
  - `POST /api/v1/wastage/entries/{id}/submit`
  - `POST /api/v1/wastage/entries/{id}/approve`
  - `POST /api/v1/wastage/entries/{id}/reject`
  - `GET /api/v1/wastage/analytics`
- Frontend Integration:
  - TypeScript types in `frontend/src/types/wastage.types.ts`.
  - API client in `frontend/src/api/wastage.ts`.
  - Interactive `frontend/src/components/workspaces/WastageWorkspace.tsx` with KPI summary cards, filterable audit log table, inline/drawer multi-item log form with live valuation calculations, approval/rejection actions, and analytics charts.
- Verification: 100% test pass rate in `test_part9_wastage_management.py`.

PART 10

Reports & Analytics Foundation

PART 11

Automation Engine

PART 12

Telegram Bot Foundation

PART 13

AI Agent Foundation

PART 14

AI Controlled Tools

PART 15

AI Restaurant Assistant

PART 16

AI Invoice / Document Processing

PART 17

Smart Inventory Automation

PART 18

AI Purchase Recommendation

PART 19

AI Wastage Intelligence

PART 20

AI Sales Intelligence

PART 21

Scheduled Reports & Alerts

PART 22

WhatsApp Integration

PART 23

Multi-Outlet Intelligence

PART 24

Approval & Audit System Hardening

PART 25

Security Hardening

PART 26

End-to-End Testing

PART 27

Deployment

PART 28

Production Monitoring / Backup / Recovery

PART 29

Final AI Agent & Automation Optimization

The exact sequence may be adjusted if a dependency requires it, but
changes must be documented before implementation.

29. GEMINI CLI DEVELOPMENT RULES

Gemini CLI is the primary coding agent for this new project.

RULE 1 — GREENFIELD ONLY

This project starts from zero.

Do not connect to or modify the existing live Render project.

Do not import live production data.

Do not copy old production code unless the user explicitly provides it for reuse.

RULE 2 — CURRENT PART ONLY

Work only on the Part explicitly requested by the user.

Do not implement future Parts early.

RULE 3 — INSPECT BEFORE CODING

Before modifying or creating a shared component:

inspect the repository

inspect package/config files

inspect existing dependencies

inspect database migrations if present

identify affected files

state the plan

RULE 4 — DO NOT GUESS

If required context is missing:

do not invent APIs

do not invent database columns

do not invent credentials

do not silently replace architecture

report the blocker

RULE 5 — PRESERVE THE MASTER ARCHITECTURE

Use:

Next.js + TypeScript

Tailwind CSS v4

Python + FastAPI

PostgreSQL

PWA

Docker

A technology change requires justification before implementation.

RULE 6 — DEMO DATA ONLY

During development, use ONLY deterministic demo/seed data.

Never connect to:

live company database

existing Render production database

real employee records

real customer records

real financial records

real supplier records

unless the user explicitly requests a future controlled migration task.

RULE 7 — EXISTING LIVE PROJECT IS UNTOUCHED

The previously built project deployed on Render is a separate project.

Gemini CLI must not:

deploy to it

change its files

change its environment variables

change its database

change its Git branch

run destructive commands against it

The new project must have its own directory/repository/environment.

RULE 8 — BACKEND SECURITY FIRST

Never rely on frontend hiding.

Every protected API must validate:

authentication

permission

outlet/data scope

business rules

RULE 9 — FINANCIAL INTEGRITY

Never use AI to perform final arithmetic.

Use deterministic backend/database logic for:

totals

tax

stock

closing

payment

P&L

accounting

inventory variance

RULE 10 — AI CONTROL

AI may:

read through approved tools

analyse

recommend

create drafts

generate reports

trigger low-risk notifications

AI must not:

execute unrestricted SQL

bypass permissions

bypass approval

delete critical data

fabricate results

RULE 11 — NO UNNECESSARY PACKAGES

Install only packages required by the current Part.

RULE 12 — TEST EVERY PART

Run appropriate:

backend tests

API tests

database tests

frontend tests where applicable

authorization tests

outlet-isolation tests

calculation tests

automation tests

RULE 13 — TEST → COMMIT → PUSH

Do not deploy automatically.

Do not modify the production environment directly.

For a Part that has been explicitly started by the user:

Implement the current Part only.

Run the required backend/API/database/frontend tests.

Run the production build where applicable.

Fix failures caused by the current Part.

Review git diff and git status.

When all required tests/build checks pass, commit the completed Part.

Push the commit to the existing Git repository.

Stop. Do not start the next Part automatically.

If a destructive Git, database, infrastructure or production action is required, stop and ask first.

RULE 14 — NO MASSIVE BLIND REWRITES

Make small, traceable, reversible changes.

RULE 15 — DOCUMENT CHANGES

At the end of each Part, report:

files created

files modified

database changes

API changes

tests

known issues

next Part

RULE 16 — STOP ON BLOCKER

If a dependency prevents safe implementation, stop and report the exact blocker instead of creating a fake workaround.

RULE 17 — LOW-TOKEN EXECUTION

Gemini CLI must work efficiently:

Read only files relevant to the current Part.

Do not repeatedly reread the entire repository or Blueprint.

Do not repeat requirements already present in this Blueprint.

Do not produce long planning explanations.

Do not create unnecessary documentation.

Inspect → implement → test → fix → build → verify → commit → push → stop.

Report only concise completion information.



Gemini must follow these rules for every Part.

RULE 1

Work only on the current Part.

RULE 2

Do not implement future Parts early.

RULE 3

Do not redesign completed modules without explicit instruction.

RULE 4

Do not replace working architecture unnecessarily.

RULE 5

Inspect existing files before modifying them.

RULE 6

Do not assume missing files or APIs.

RULE 7

Preserve existing functionality.

RULE 8

Do not change database schema outside the current Part unless required
and documented.

RULE 9

Do not install unnecessary packages.

RULE 10

Never expose secrets or API keys in source code.

RULE 11

Run appropriate tests after implementation.

RULE 12

Do not use mock data where real project data is required for final
implementation.

RULE 13

Do not mark a Part complete if required functionality is not tested.

RULE 14

For every Part explicitly started by the user, once implementation, tests, build and verification pass, review the diff, commit the completed Part, and push to the existing Git repository. Do not push if tests/build fail or if the action would be destructive.

RULE 15

Do not deploy automatically unless explicitly instructed.

RULE 16

Before changing a shared file, identify which existing modules depend on
it.

RULE 17

Keep changes scoped and reversible.

30. PART EXECUTION FORMAT

Every Part prompt must contain:

PART NUMBER
PART NAME

OBJECTIVE

NEW PROJECT RULE
GREENFIELD / EXISTING PROJECT STATUS

CURRENT PROJECT CONTEXT

ARCHITECTURE CONSTRAINTS

TASKS

FILES TO INSPECT

FILES TO CREATE

FILES TO MODIFY

DATABASE CHANGES

API CHANGES

UI CHANGES

AI / AUTOMATION CHANGES

DEMO DATA REQUIREMENTS

SECURITY REQUIREMENTS

OUTLET ISOLATION REQUIREMENTS

DO NOT CHANGE

DO NOT CONNECT TO LIVE SYSTEM

TESTING REQUIREMENTS

COMPLETION CRITERIA

FINAL REPORT FORMAT

Gemini must not begin implementation until it has inspected the relevant repository context for the current Part.

Every Part prompt must contain:

PART NUMBER
PART NAME

OBJECTIVE

CURRENT PROJECT CONTEXT

TASKS

FILES TO INSPECT

FILES TO CREATE

FILES TO MODIFY

DATABASE CHANGES

API CHANGES

AI / AUTOMATION CHANGES

SECURITY REQUIREMENTS

DO NOT CHANGE

TESTING REQUIREMENTS

COMPLETION CRITERIA

FINAL REPORT FORMAT

31. COMPLETION CRITERIA

A Part is complete only when:

[ ] Required files inspected
[ ] Required implementation completed
[ ] Existing new-project functionality preserved
[ ] No existing Render project touched
[ ] No live company data used
[ ] Demo seed/reset verified where applicable
[ ] Database changes tested
[ ] API tested
[ ] UI tested where applicable
[ ] Outlet isolation tested where applicable
[ ] Permission tests passed
[ ] AI behavior tested where applicable
[ ] Automation tested where applicable
[ ] Error handling tested
[ ] Security requirements checked
[ ] Financial calculations verified deterministically
[ ] No unnecessary files changed
[ ] No secrets committed
[ ] No automatic deployment performed
[ ] Git diff reviewed
[ ] Commit created after all required checks passed
[ ] Commit pushed to the existing Git repository
[ ] Next Part NOT started automatically
[ ] Final status reported

A Part is complete only when:

[ ] Required files inspected
[ ] Required implementation completed
[ ] Existing functionality preserved
[ ] Database changes tested
[ ] API tested
[ ] UI tested where applicable
[ ] AI behavior tested where applicable
[ ] Automation tested where applicable
[ ] Error handling tested
[ ] Security requirements checked
[ ] No unnecessary files changed
[ ] No secrets committed
[ ] Final status reported

32. FINAL REPORT FORMAT FOR EACH PART

Gemini must finish each Part with:

PART STATUS:
COMPLETED / BLOCKED

WHAT WAS DONE:
- ...

FILES CREATED:
- ...

FILES MODIFIED:
- ...

DATABASE CHANGES:
- ...

API CHANGES:
- ...

TESTS RUN:
- ...

TEST RESULTS:
- ...

KNOWN ISSUES:
- ...

NOT CHANGED:
- ...

NEXT PART:
Part X — Name

DEPENDENCIES FOR NEXT PART:
- ...

33. GIT RULES

Git is used for version control.

For each Part:

Review changes.

Verify changed files.

Test.

Keep changes logically scoped.

Do not automatically:

push

merge

deploy

delete branches

unless explicitly requested.

34. DEPLOYMENT PRINCIPLE

Development environment:

Local Computer
   ↓
Git Repository
   ↓
Test Environment
   ↓
Production

Production should not be changed directly during experimentation.

35. PRODUCTION PRINCIPLES

Before production release:

Environment variables configured

Database backup strategy configured

Authentication tested

Authorization tested

Webhook security tested

AI API failure tested

External API failure tested

Database failure handling tested

Rate limits considered

Logging enabled

Monitoring available

Recovery procedure documented

36. FAILURE HANDLING

Every external dependency can fail.

Examples:

AI API DOWN
Telegram DOWN
WhatsApp DOWN
Database ERROR
Network ERROR
OCR FAILURE
Invalid Invoice
Invalid User Input
Webhook Failure

The system must fail safely.

For example:

AI unavailable
   ↓
Do not create false financial data
   ↓
Show "AI processing unavailable"
   ↓
Allow manual workflow

37. HUMAN-IN-THE-LOOP PRINCIPLE

AI should automate repetitive work but preserve human control over
high-risk decisions.

AI can generally:

Read

Analyse

Summarize

Recommend

Detect anomalies

Create drafts

Prepare reports

Trigger low-risk notifications

Human approval should normally be required for:

Payments

High-value purchases

Financial adjustments

Critical stock adjustments

Deletions

Irreversible operations

38. FINAL PRODUCT VISION

The finished system should allow a restaurant owner/manager to operate
much of the business through:

Dashboard
+
Mobile App / PWA
+
Telegram
+
WhatsApp
+
AI Assistant
+
Automations

Example:

Manager:
"Prepare today's purchase recommendation."

AI:
- Checks stock
- Checks minimum levels
- Checks recent consumption
- Checks pending purchase
- Checks supplier information
- Calculates requirement
- Creates purchase draft
- Reports the recommendation

Manager:
"Approve."

System:
- Executes only the authorized action
- Saves the transaction
- Creates audit log
- Sends confirmation

39. NON-NEGOTIABLE PROJECT RULE

The objective is not to create an impressive AI demo.

The objective is to build a reliable restaurant business system where
AI and automation solve real operational problems.

Therefore:

Accuracy > AI novelty

Data integrity > convenience

Security > automation speed

Human approval > unrestricted AI action

Stable architecture > unnecessary complexity

40. STARTING POINT

The existing Master Blueprint file is the single source of truth for this new project.
If the Blueprint needs correction or expansion, modify this existing file rather than creating a second competing Blueprint.
Do not rewrite the whole document for a small requirement; update only the relevant section.

This document is the MASTER BLUEPRINT only.

Do not implement the entire platform from this document.

The new project must start with:

PART 1 — PROJECT FOUNDATION

Part 1 must create the new project's foundation from zero and must NOT touch the existing live Render project.

Before Part 1 implementation:

Confirm the repository is the NEW project.

Inspect the empty/current project directory.

Confirm no live company database is configured.

Establish the technology stack.

Establish development environment.

Establish Docker/local PostgreSQL.

Establish the PWA foundation.

Establish a safe .env.example.

Establish health checks.

Establish the project documentation structure.

Only demo data may be introduced during development.

Each future Part must remain scoped to its own objective.

This document is PART 0 only.

Do not start implementing the entire platform from this document.

The next implementation document must be:

PART 1 — PROJECT FOUNDATION

Part 1 must inspect the existing development environment and establish
the foundation required for the remaining Parts.

Each future Part must remain scoped to its own objective.

41. GEMINI CLI MASTER OPERATING INSTRUCTION

When this blueprint is present in the NEW project repository, Gemini CLI must treat it as the project's controlling architecture document.

At the beginning of every Part:

Read this blueprint.

Identify the current Part.

Inspect the repository.

Determine what already exists for that Part.

List the files that will be created/changed.

Confirm that the existing Render project is not being touched.

Confirm that only demo/test data will be used.

Implement only the current Part.

Run tests.

Fix failures caused by the current Part.

Report the result using the required final report format.

Stop after the Part is complete.

Do not continue automatically to the next Part.

The user will explicitly request the next Part.

Required working principle

READ
 ↓
INSPECT
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
VERIFY
 ↓
REPORT
 ↓
STOP

Required demo environment separation

Use separate configuration concepts for:

DEVELOPMENT
STAGING
PRODUCTION

Development must use demo data.

Production must never be populated by demo seed commands accidentally.

Use explicit environment checks to prevent destructive seed/reset commands from running against production.

Required first demo scenario

The first complete end-to-end demo environment should eventually support:

14 demo outlets
10+ demo users with different roles
20+ demo menu/items
20+ inventory items
10+ suppliers
Demo purchase records
Demo sales/orders
Demo stock movements
Demo production records
Demo wastage records
Demo employees
Demo complaints
Demo maintenance tickets
Demo beverage/alcohol records
Demo accounting records

Exact quantities may be adjusted by the implementation Part, but the dataset must be sufficient to test:

central dashboard

outlet isolation

reports

inventory

purchase

restaurant operations

HR

accounts

complaints

maintenance

alcohol/balance calculations

automation

Required acceptance test for outlet isolation

At minimum, tests must prove:

HEAD OFFICE USER
→ can access authorized data for all 14 outlets

OUTLET 01 USER
→ can access Outlet 01
→ cannot access Outlet 02-14

OUTLET 07 USER
→ can access Outlet 07
→ cannot access Outlet 01-06 or 08-14

Attempting to change an outlet ID in a URL, request body, query string, or API parameter must not bypass authorization.

Required acceptance test for financial safety

At minimum:

Purchase total
    =
sum(line quantities × rates)
    - discounts
    + applicable taxes/charges

The backend must calculate and validate the final amount.

AI may explain or recommend, but cannot be the source of truth for the final financial value.

Required acceptance test for AI

If the database contains:

Stock = 8 kg
Minimum = 15 kg
Average daily consumption = 5 kg

AI may recommend a purchase, but the response must be generated from actual tool results.

If the database/tool fails, AI must not invent a number.

Required acceptance test for demo data

Demo data must be clearly identifiable and resettable.

A developer must be able to:

create demo data

test the system

reset demo data

recreate the same dataset

without touching production.

FINAL GREENFIELD REBUILD RULE

This project is a COMPLETE PRODUCT REBUILD.

The OLD APPLICATION IMPLEMENTATION is obsolete and must not be reused.

KEEP EXACTLY

Existing Git repository

Existing Render service/deployment infrastructure

Existing Neon PostgreSQL service

Existing demo data

These are infrastructure/data resources to preserve. They are NOT the design
or implementation source of truth.

DO NOT REUSE OR MODIFY THE OLD APPLICATION

Do not reuse, patch, refactor, debug, copy, or extend:

Old frontend code

Old backend code

Old UI/UX

Old CSS

Old components

Old pages

Old API implementations

Old business logic

Old database logic/schema as the design authority

Old PWA implementation

Old manifest.json

Old service worker

Old PWA install/update logic

Old loading/splash implementation

Old bugs

Old workarounds

Old architectural decisions

Do not spend development tokens investigating old bugs or understanding old
application behavior unless inspection is strictly required to preserve the
Git/Render/Neon infrastructure.

NEW APPLICATION

Build the new product from the Master Blueprint from zero:

New architecture

New database design

New backend

New APIs

New frontend

New UI/UX

New design system

New text/content

New PWA

New automation

New AI integration

New business workflows

The target stack is:

Next.js + React + TypeScript + Tailwind CSS v4 + PWA
Python + FastAPI
Neon PostgreSQL
Google OAuth 2.0
RBAC + Outlet Scope
AI + Automation

EXISTING DEMO DATA

The existing Neon database contains DEMO data only.

Do not allow the old demo schema/data to dictate the new architecture.
The new system must be designed from the Master Blueprint.

Do not blindly delete or reset the existing Neon database.
Do not run destructive database commands automatically.

If the new schema requires migrations or controlled data changes, implement
them only as part of the appropriate Part, with tests and clear reporting.

PWA RULE

The old PWA is completely obsolete.

Build the NEW PWA from zero.

Do not reuse:

old manifest

old service worker

old install prompt

old update flow

old splash/loading code

The new PWA must be tested as part of the appropriate implementation,
but Gemini must NOT claim final mobile/PWA acceptance on the user's behalf.

After Render deployment, STOP and allow the user to check the application
on their mobile device.

DEPLOYMENT RULE

Do not rebuild or replace the existing Render infrastructure.

Use the existing Git → Render deployment workflow.

After a Part is complete:

Test locally.

Run the required build checks.

Verify the changed files.

Verify no protected infrastructure was modified.

Review Git diff.

Commit the Part.

Push to the existing Git repository.

Allow the existing Render deployment pipeline to deploy.

STOP.

Do not automatically start the next Part.

The user will open the deployed application on mobile/desktop and verify it.

Only when the user explicitly says:

Next Part

may Gemini begin the next Part.

PERMISSION RULE

Use the required development/file/Git permissions so normal work does not stop
for repetitive permission prompts.

Never use permission to:

delete the Render service

recreate the Render service

destroy the Git repository

reset/destroy Neon

delete database data

expose secrets

bypass authorization

execute irreversible destructive operations

If a destructive infrastructure/database action becomes necessary, STOP and
request explicit confirmation.

END OF MASTER BLUEPRINT

BLUEPRINT REVISION NOTE

This version incorporates the agreed requirements from the new-project discussion:

New project from zero

Existing Render project completely untouched

Centralized 14-outlet restaurant control

Head Office vs outlet data isolation

Next.js + TypeScript frontend

Tailwind CSS v4 UI

PWA/mobile-native experience

Python + FastAPI backend

PostgreSQL database

HR

Accounts & Finance

Purchase & Supplier

Restaurant/POS/KOT/Orders/Tables

Inventory

Production

Wastage

Beverage/Alcohol control

Customer/CRM

Complaint management

Maintenance/Asset management

Reports & analytics

Approval workflows

Audit logging

AI assistant and controlled AI tools

Automation engine

Telegram/WhatsApp as later integrations

Demo-only data during development

Deterministic seed/reset

No live company data

No automatic deployment

Gemini CLI part-by-part execution

Explicit inspection, testing, verification and stop-after-Part workflow



GEMINI CLI — FAST START PROMPT

Use the RESTAURANT_MULTI_OUTLET_ERP_AI_AUTOMATION_MASTER_BLUEPRINT.md file in this repository as the controlling specification.

This is a GREENFIELD PRODUCT REBUILD.

IMPORTANT:

Keep the existing Git repository.

Keep the existing Render deployment/service.

Keep the existing Neon PostgreSQL service.

Keep the existing demo data.

Do NOT reuse or modify the old PWA, manifest, service worker, install/update flow, or splash/loading implementation.

Build the new PWA from zero.

After deployment, STOP so I can check the new app on my mobile device.

Keep the existing Neon PostgreSQL service.

Existing Neon data is DEMO data only.

Do NOT preserve or reuse the old application implementation.

Do NOT debug old bugs.

Do NOT copy old UI, CSS, components, APIs, business logic, or architecture.

Build the new product from the Master Blueprint from the beginning.

Use Next.js + TypeScript + Tailwind CSS v4 + PWA.

Use Python + FastAPI.

Use Neon PostgreSQL.

Use Google OAuth 2.0 for login, then enforce application RBAC + outlet scope.

Build the 14-outlet centralized restaurant ERP and automation platform described in the blueprint.

Use only demo/test data during development.

Never touch live company data.

Do not delete/recreate Render or Neon infrastructure.

Do not automatically deploy by any method other than the existing Git → Render workflow.

After each completed Part: test → build → verify → review diff → git commit → git push → STOP.

Do NOT start the next Part until I explicitly say Next Part.

FIRST TASK:
Start with PART 1 — PROJECT FOUNDATION only.

IMPORTANT AUTOMATION RULE:
Do not implement the complete automation/AI scope during Part 1.
Only establish the foundation required to support it later.
The complete automation scope is defined in the Master Blueprint and must be
implemented in its designated future Parts.

Before coding:

Read the Master Blueprint completely enough to understand the constraints.

Inspect the current repository and identify what is infrastructure versus obsolete application implementation.

Do not spend time debugging the old product.

Show me a concise implementation plan and the files you intend to create/replace.

Preserve the Git/Render/Neon infrastructure.

Then implement PART 1 only.

Test it.

Commit and push the completed Part.

Stop and give me the final Part report.

Do not continue beyond PART 1.
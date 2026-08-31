# PART 4 — Purchase Bills, Payments & Vendor Ledger

Implemented on top of PART 3 without rebuilding or deleting existing purchase functionality.

## Added
- Supplier Bill create flow from APPROVED GRN
- Duplicate supplier invoice protection
- Supplier Bill list and status filters
- 3-Way bill verification using existing BillingService
- Bill approval workflow
- Supplier payment posting
- Bill outstanding balance validation
- Automatic PAID status when bill is fully settled
- Vendor ledger with chronological invoice/payment running balance
- Purchase > Bills & Payments frontend workspace
- Vendor selector and bill status filters
- Payment modal with BANK/CASH/UPI/CHEQUE
- Vendor ledger drill-down
- Billing schema bootstrap for existing/new PostgreSQL deployments

## Preserved
- Purchase Request / Approval
- PO generation and consolidation
- PO approval/rejection/cancellation
- GRN and QC flow
- Existing 3-way match endpoint
- Supplier/vendor mapping
- WhatsApp dispatch workflow
- Smart procurement requirement workflow
- Closing workflow

## Permissions
Uses existing permission families:
- procurement:create for bill creation/verification
- procurement:update for payment posting
- Existing OWNER/SUPER_ADMIN/HQ_ADMIN bypass remains active

## Validation
- Python syntax checks passed for modified backend files.
- npm dependency installation could not complete within the execution environment timeout, so a full Next.js production build could not be completed here.

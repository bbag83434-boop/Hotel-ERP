# PART 16 — Approval Center

Implemented on top of Part 15 without rebuilding existing modules.

## Frontend
- Central Approval Center workspace
- Purchase Request approvals
- Purchase Order approvals
- GRN approvals
- Wastage approvals
- HR leave approvals
- Head Office vs outlet scope
- Type filters
- Pending counters
- Approve / Reject actions
- Refresh and empty/loading states

## Existing backend preserved
The workspace reuses existing approval endpoints and existing company/outlet authorization. No fake data or new approval database schema was introduced.

## Verification
- TypeScript source inspected for imports and workspace routing.
- Python backend was not changed in this part.

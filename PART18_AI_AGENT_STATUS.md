# PART 18 — Controlled AI Agent

Implemented on top of Part 17 without rebuilding existing modules.

## Added
- Controlled AI Agent workspace.
- Natural-language stock/purchase questions reuse the existing deterministic smart-requirement endpoint.
- Deterministic stock recommendations reuse `/ai/recommendations/stock`.
- User can select recommendations and create a Purchase Request through the existing procurement API.
- Purchase Request remains `PENDING_APPROVAL`; the agent cannot approve it or create a PO.
- Explicit safety boundary shown in UI: no direct stock adjustment, PO creation, approval, permission changes, or authorization bypass.
- Existing authentication, outlet scope, RBAC, procurement validation and audit logging are reused.
- No fake business data and no new database schema.

## Verification
- Existing backend was not modified.
- Frontend TypeScript source was checked for imports and workspace routing.
- ZIP integrity verified after packaging.

## Limitation
This Part is a controlled application-agent layer, not an unrestricted autonomous LLM. The current environment already contains deterministic AI/recommendation APIs; this part exposes only safe, user-confirmed application actions through existing validated endpoints.

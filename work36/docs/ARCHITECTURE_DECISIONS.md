# HOTEL-ERP ARCHITECTURE DECISIONS (ADRs)
**Version:** 2.0.0  
**Status:** Permanent Architecture Record  

---

## ADR 1: Decoupled Fullstack Monorepo Architecture
- **Decision:** Separate `frontend/` (Next.js 14 App Router + Tailwind CSS) and `backend/` (Python + FastAPI) within a unified monorepo.
- **Rationale:** Enables independent scaling, containerization, and static asset generation for PWA while allowing FastAPI to provide high-throughput async REST endpoints.
- **Enforcement:** No mixed server-rendering of Python templates; all communication flows via REST JSON API over `/api/v1`.

---

## ADR 2: Dual Authentication & RBAC Authorization
- **Decision:** Support both local bcrypt credentials (for branch staff & offline sync) and Google OAuth 2.0 (for management/executive access), protected by short-lived JWT access tokens (15m) and long-lived refresh tokens (7d).
- **Rationale:** Meets corporate security standards while offering resilient multi-outlet operations. Wildcard permissions (`*:*`) allow super-admin bypass.

---

## ADR 3: Multi-Tenant Outlet Scoping via Request Headers (`X-Outlet-Id`)
- **Decision:** Every data modification and query is scoped using an `X-Outlet-Id` header injected by the frontend Axios interceptor.
- **Rationale:** Guarantees strict multi-outlet data isolation. Head Office roles can toggle across all branches, while outlet staff are restricted to assigned branch UUIDs.

---

## ADR 4: Bi-Monthly Closing Cycles
- **Decision:** Enforce rigid bi-monthly stock closing cycles (1st–15th and 16th–MonthEnd) for physical inventory valuation and theoretical food cost calculations.
- **Rationale:** Ensures synchronized accounting periods across all resort kitchens, bars, and central stores. Once finalized, closing records are immutable (`FINALIZED_LOCKED`).

---

## ADR 5: Standardized API Error & Response Envelope
- **Decision:** All API responses adhere to `{ success: boolean, data?: T, error?: { code, message, details }, timestamp: string }`.
- **Rationale:** Deterministic error handling across web, mobile PWA, and background workers without unexpected runtime crashes.

---

## ADR 6: Luxury Hospitality Design Tokens & Component Reuse
- **Decision:** All UI surfaces must strictly adhere to the warm luxury palette (`#F5F3EE` Ivory, `#1C1C1C` Obsidian, `#B8862D` Heritage Gold) defined in `DESIGN_SYSTEM.md` and reuse atomic components in `components/ui/`.
- **Rationale:** Prevents fragmented styling and preserves high visual fidelity across all 12 operational workspaces.

# HOTEL-ERP APPLICATION UX & NAVIGATION FLOW SPECIFICATION
**Version:** 2.0.0  
**Status:** Permanent Source of Truth for UX Architecture & Interaction Flows  
**Target Audience:** Frontend Engineers, Fullstack Developers, UI/UX Designers

---

## 1. APPLICATION ARCHITECTURE & UX FOUNDATION

The Hotel-ERP application operates as a single-page, multi-workspace progressive web application (PWA) designed for resort managers, central purchase officers, head chefs, and executive administrators.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STICKY TOP HEADER                               │
│  [Logo/Brand]       [Active Outlet Context Dropdown]       [PWA/Status]│
├──────────────────┬─────────────────────────────────────────────────────┤
│                  │                                                     │
│     SIDEBAR      │                 WORKSPACE CANVAS                    │
│  (Desktop left   │  ┌───────────────────────────────────────────────┐  │
│   permanent nav; │  │ Workspace Hero / Scope Banner                 │  │
│   Mobile off-    │  ├───────────────────────────────────────────────┤  │
│   canvas drawer) │  │ Sub-Navigation Tabs / Search & Filters Toolbar│  │
│                  │  ├───────────────────────────────────────────────┤  │
│  - Core Ops      │  │ Dynamic Data Panels / Tables / Charts / Modals│  │
│  - People/Finance│  └───────────────────────────────────────────────┘  │
│                  │                                                     │
├──────────────────┴─────────────────────────────────────────────────────┤
│        MOBILE BOTTOM NAVIGATION (Touch Screens < 768px)                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. NAVIGATION & WORKSPACE FLOWS

### 2.1 Workspace Switching Flow
1. User clicks a navigation item in the Sidebar or Mobile Bottom Nav.
2. The `activeWorkspace` state updates synchronously (`'dashboard'`, `'purchase'`, `'inventory'`, etc.).
3. The URL hash / state retains the active workspace so browser refreshes stay on the same context.
4. The workspace initializes data fetching scoped to `activeOutlet.id`.
5. When switching workspaces, ongoing form edits prompt confirmation if unsaved changes exist.

### 2.2 Active Outlet Context Flow
1. **Outlet Selection:** Top Header contains the active outlet switcher.
2. **Context Propagation:** Changing the outlet updates `activeOutlet` in `OutletContext.tsx` and saves to `localStorage` (`apex_active_outlet_id`).
3. **Automatic API Scoping:** Axios client in `apiClient` automatically injects `X-Outlet-Id: {activeOutlet.id}` into all requests.
4. **Workspace Re-hydration:** Every open workspace detects the outlet change via `useEffect([activeOutlet.id])` and re-fetches fresh branch data.
5. **Head Office vs Outlet Scope:** If user selects Head Office, consolidated enterprise view is rendered; otherwise, restricted outlet view is rendered.

---

## 3. CRUD & INTERACTION FLOWS

### 3.1 Create / Add Item Flow
```
User clicks "+ Action" Button
  ➔ Modal Dialog Opens (Backdrop blur + focus trap)
  ➔ Form displays with default values & validation
  ➔ User inputs data
  ➔ Submit button clicked
  ➔ Button state transitions to "Saving..." (disabled + spinner)
  ➔ API POST request executed
  ➔ Success: Modal closes ➔ Feedback banner displays ➔ Workspace data refreshes
  ➔ Failure: Modal remains open ➔ Error message displays inline or top of modal
```

### 3.2 Edit / Update Flow
1. User clicks "Edit" or modifies an inline editable cell (e.g. quantity input in Smart Draft).
2. The UI validates input (e.g. non-negative quantity, valid dates).
3. The API PATCH/PUT request executes.
4. The change is audited and logged in the backend `AuditLog` table.
5. The UI shows an audit modification indicator (`"User Modified"`) with updated totals.

### 3.3 Destructive Action & Confirmation Flow (Reject, Void, Delete)
1. User clicks a destructive action (e.g., "Reject GRN", "Cancel PO", "Delete Item").
2. Standard browser `confirm()` is **strictly forbidden**.
3. Custom **Action Reason Modal** opens.
4. User must provide a mandatory reason / corrective feedback.
5. User clicks "Confirm Action" (Red destructive button).
6. Backend records the mandatory reason in the structured audit trail.
7. Workspace shows green success banner confirming status change.

---

## 4. FORM SUBMISSION, VALIDATION & FEEDBACK PATTERNS

### 4.1 Client-Side Validation
- Required fields are marked with a red asterisk `*`.
- Numeric fields validate positive bounds, min/max limits, and proper decimal increments.
- Date fields validate `requiredDate >= today`.
- If invalid, the submit button is disabled or highlights error fields with red borders (`border-red-500`).

### 4.2 Feedback Banner Lifecycle
```tsx
// Standard Feedback State Pattern
const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

// Success: Auto-dismiss after 6 seconds or manual close
// Error: Persistent until user acknowledges with 'X' button or retries
```

---

## 5. SEARCH & FILTER FLOWS

1. **Instant Debounced Search:** Text input in table headers filters rows instantaneously with a 200ms debounce.
2. **Multi-Dimension Filters:**
   - Status Filter (e.g., `ALL`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`)
   - Priority Filter (e.g., `ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
   - Branch Filter (available when in Head Office mode)
3. **Filter Reset:** When filters are active, a `"Clear Filters"` button appears to instantly reset to default state.
4. **Empty Filter Results:** Shows dedicated EmptyState with `"Clear Search"` button.

---

## 6. ASYNCHRONOUS LOADING & ERROR RECOVERY

1. **Initial Workspace Load:** Shows skeleton cards or central spinner with informative message.
2. **Network Disconnection:** PWA offline detection triggers `OfflineBanner.tsx` and informs user of cached read-only data.
3. **Telemetry & API Health:** Header displays live online/offline badge and backend service status.
4. **Error Recovery:** API errors display clear human-readable messages (e.g. extracting `err?.response?.data?.message`) with a `"Retry"` button.

---

## 7. NEW FEATURE INTEGRATION RULES (PERMANENT PROTOCOL)

Whenever a new module, workspace, or feature is added in the future, follow this 10-step protocol:

1. **Step 1 — Inspect `DESIGN_SYSTEM.md`:** Review colors, fonts, spacing, border radii, shadows, and status colors.
2. **Step 2 — Inspect `UI_COMPONENT_RULES.md`:** Check if an existing component (e.g., `Button`, `Modal`, `Table`, `Badge`, `StatCard`) can be reused.
3. **Step 3 — Inspect `UI_UX_FLOW.md`:** Follow established CRUD, modal, and confirmation interaction patterns.
4. **Step 4 — Connect to `OutletContext`:** Ensure all API calls and calculations are strictly scoped to `activeOutlet.id`.
5. **Step 5 — Use Standard Workspace Header:** Include title, icon, active outlet badge, and action buttons.
6. **Step 6 — Use Standard Sub-Nav Tabs:** Use the horizontal champagne pill tab bar for multi-tab features.
7. **Step 7 — Implement Structured Audit Logging:** Ensure all sensitive state changes log to `AuditLog`.
8. **Step 8 — Ensure Mobile Responsiveness:** Verify layout works seamlessly on mobile (< 768px), tablet, and desktop.
9. **Step 9 — Verify Feedback Banners:** Use standard success and error feedback banners for all async operations.
10. **Step 10 — Run Verification:** Execute TypeScript typechecks, Next.js build (`npm run build`), and test suites.

**Never create an isolated visual style or custom color scheme for a new feature.**

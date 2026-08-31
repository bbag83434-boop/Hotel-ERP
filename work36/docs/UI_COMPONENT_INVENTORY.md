# HOTEL-ERP REUSABLE UI COMPONENT INVENTORY
**Version:** 2.0.0  
**Design Baseline:** `DESIGN_SYSTEM.md` & `UI_COMPONENT_RULES.md`  

---

## 1. ATOMIC UI COMPONENTS (`frontend/src/components/ui/`)

### 1.1 `Button.tsx`
- **Variants:** `primary` (Obsidian `#1C1C1C`), `gold` (Heritage Gold `#B8862D`), `success` (SeaGreen `#2E8B57`), `secondary` (Outlined White), `danger` (Crimson `#DC2626`), `ghost` (Transparent slate).
- **Sizes:** `sm` (`px-3 py-1.5 text-xs`), `md` (`px-4 py-2 text-xs`), `lg` (`px-5 py-2.5 text-sm`).
- **Features:** Built-in loading spinner, disabled state scaling, icon slot.

### 1.2 `Badge.tsx`
- **Variants:** `success` (Emerald), `warning` (Amber), `danger` (Red), `info` (Blue), `purple` (Violet), `neutral` (Gray), `outlet` (Gold Monospace).
- **Features:** Optional pulse animation, icon prefix, rounded pill layout.

### 1.3 `Modal.tsx`
- **Props:** `isOpen`, `onClose`, `title`, `subtitle`, `icon`, `maxWidth` (`sm`, `md`, `lg`, `xl`, `2xl`).
- **Features:** Focus trapping, ESC key listener, backdrop blur (`bg-black/40 backdrop-blur-xs`), outside click detection.

### 1.4 `StatCard.tsx`
- **Props:** `title`, `value`, `subtitle`, `icon`, `iconBgColor`, `trend` (`{ value, isPositive }`), `onClick`.
- **Features:** Glassmorphic background, Outfit display font numbers, trend pill badge, hover lift.

### 1.5 `AlertBanner.tsx`
- **Props:** `feedback` (`{ type: 'success' | 'error', message: string }`), `onClose`.
- **Features:** Semantic status icons, auto-dismissible or acknowledged dismiss button.

### 1.6 `EmptyState.tsx`
- **Props:** `title`, `description`, `icon`, `action`.
- **Features:** Centered luxury icon box, Outfit heading, clear call-to-action button container.

### 1.7 `SearchInput.tsx`
- **Props:** `value`, `onChangeValue`, `placeholder`.
- **Features:** Left search icon, rounded-xl input, quick clear `X` button.

---

## 2. COMMON LAYOUT COMPONENTS (`frontend/src/components/common/`)

- **`Header.tsx`:** Sticky navigation bar containing brand identity, mobile hamburger toggle, active outlet switcher dropdown sheet, PWA update button, PWA install button, and live online/offline indicator.
- **`Sidebar.tsx`:** Left navigation rail with Core Operations and People & Finance navigation groups, role-based user management filter, active scope summary card, and responsive mobile drawer mode.
- **`BottomNav.tsx`:** Mobile touch bottom navigation bar for viewports `< 768px` with quick workspace tabs.
- **`OfflineBanner.tsx`:** Fixed banner alerting user when offline with read-only cached data mode.
- **`PWAInstallBanner.tsx`:** Non-intrusive mobile banner promoting home screen installation.

---

## 3. DOMAIN WORKSPACES (`frontend/src/components/workspaces/`)

| Workspace Component | File Path | Scope & Functions |
| :--- | :--- | :--- |
| **DashboardOverview** | `DashboardOverview.tsx` | Executive KPI stats, system topology summary, quick feature navigation |
| **OutletDashboard** | `OutletDashboard.tsx` | Outlet-specific sales, procurement, production, wastage, and closing overview |
| **PurchaseWorkspace** | `PurchaseWorkspace.tsx` | Requisition approval, WhatsApp PO vendor consolidation, direct GRN receive |
| **ProductionWorkspace** | `ProductionWorkspace.tsx` | Recipe BOM setup, production batch logs, yield/wastage tracking |
| **TransfersWorkspace** | `TransfersWorkspace.tsx` | Inter-outlet & inter-warehouse transfer creation, approval & dispatch |
| **WastageWorkspace** | `WastageWorkspace.tsx` | Wastage logging with standard reason codes, high-cost approval flows |
| **HRWorkspace** | `HRWorkspace.tsx` | Staff directory, shift schedules, daily attendance, payroll run summaries |
| **ClosingWorkspace** | `ClosingWorkspace.tsx` | Bi-monthly closing cycles (1st–15th / 16th–End), physical valuation, food cost % |
| **ReportsWorkspace** | `ReportsWorkspace.tsx` | Sales summary, inventory valuation, cost control variance analytics |
| **TelemetryWorkspace**| `TelemetryWorkspace.tsx` | Backend health diagnostics, DB latency, server process memory, uptime |
| **AIAssistantWorkspace**| `AIAssistantWorkspace.tsx` | Scoped conversational assistant with automated ERP query templates |
| **UserManagementWorkspace**| `UserManagementWorkspace.tsx` | RBAC user management, roles, branch access assignments |

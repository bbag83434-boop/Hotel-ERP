# HOTEL-ERP UI COMPONENT ARCHITECTURE & REUSE RULES
**Version:** 2.0.0  
**Status:** Permanent Source of Truth for Component Development  
**Framework:** React 18 / Next.js 14 (App Router) + Tailwind CSS + Lucide React

---

## 1. COMPONENT DIRECTORY ARCHITECTURE

All React components must be placed within structured folders under `frontend/src/components/`:

```
frontend/src/components/
├── common/             # Universal layout & UI primitives (Header, Sidebar, BottomNav, Modals, Banners)
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── BottomNav.tsx
│   ├── PWAInstallBanner.tsx
│   └── OfflineBanner.tsx
├── ui/                 # Reusable Atomic UI Components (Buttons, Badges, Cards, Table, Input, Modal, Alert)
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   ├── Table.tsx
│   ├── SearchInput.tsx
│   ├── StatCard.tsx
│   ├── EmptyState.tsx
│   └── AlertBanner.tsx
├── organization/       # Organization & Multi-outlet management components
│   └── OrganizationManager.tsx
├── inventory/          # Inventory catalog, stock balances, batches & recipe components
│   └── InventoryManager.tsx
└── workspaces/         # High-level feature domain workspaces
    ├── DashboardOverview.tsx
    ├── PurchaseWorkspace.tsx
    ├── ProductionWorkspace.tsx
    ├── TransfersWorkspace.tsx
    ├── WastageWorkspace.tsx
    ├── HRWorkspace.tsx
    ├── ClosingWorkspace.tsx
    ├── ReportsWorkspace.tsx
    ├── TelemetryWorkspace.tsx
    └── AIAssistantWorkspace.tsx
```

---

## 2. COMPONENT DESIGN SPECIFICATIONS & REUSE RULES

### 2.1 Workspace Layout & Shell
- **Rule:** Every workspace is rendered inside `<main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">`.
- **Top Shell Structure:** Top workspace header must always contain:
  1. Workspace title in `font-['Outfit'] font-bold text-xl md:text-2xl text-[#1C1C1C]` with an icon.
  2. Active Outlet Badge (e.g., `[{activeOutlet.code}] {activeOutlet.name}`).
  3. Action toolbar (e.g., Search, Filter dropdown, Primary Action button, Refresh button).

### 2.2 Buttons (`Button.tsx`)
Never write ad-hoc inline button styles with conflicting colors. Always use tokenized classes:

| Variant | Visual Pattern | Use Case |
| :--- | :--- | :--- |
| **`primary`** | `bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white` | Main submission, dark luxury actions |
| **`gold` / `brand`**| `bg-[#B8862D] hover:bg-[#9E7326] text-white shadow-xs` | Primary feature CTAs, Smart AI triggers |
| **`success`** | `bg-[#2E8B57] hover:bg-[#257247] text-white` | Approvals, Confirmations, Stock posting |
| **`secondary`** | `bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#1C1C1C]` | Cancel, Export, Filter toggles |
| **`danger`** | `bg-red-600 hover:bg-red-700 text-white` | Delete, Reject, Scrap, Void |
| **`ghost` / `icon`**| `p-1.5 text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] rounded-lg` | Row actions, close buttons, menu items |

### 2.3 Cards & Containers (`Card.tsx`)
- **Standard Luxury Card:**
  ```tsx
  <div className="luxury-card p-5 rounded-2xl bg-white/85 border border-[rgba(45,45,45,0.08)] shadow-[0_4px_20px_-2px_rgba(45,45,45,0.04)] space-y-4">
    {children}
  </div>
  ```
- **Interactive KPI Stat Card (`StatCard.tsx`):**
  - Displays Title, Icon pill, Primary KPI Number (in `Outfit` bold font), Subtitle / Variance trend indicator.
  - Hover state adds subtle gold border `hover:border-[#C79A3B]/40` and lift.

### 2.4 Form Controls & Inputs (`Input.tsx`, `Select.tsx`)
- Standard text input, number input, date input, and select fields MUST share:
  ```tsx
  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] focus:ring-1 focus:ring-[#C79A3B]/30 transition-all"
  ```
- Labels must always be placed above the input with `text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block`.

### 2.5 Tab Navigation Bars
- Workspace internal tab bars must use the unified horizontal pill container:
  ```tsx
  <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl shadow-xs overflow-x-auto">
    <button
      onClick={() => setActiveTab('tabKey')}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
        activeTab === 'tabKey'
          ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs'
          : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>Tab Label</span>
      {countBadge > 0 && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#B8862D] text-white">
          {countBadge}
        </span>
      )}
    </button>
  </div>
  ```

### 2.6 Data Tables (`Table.tsx`)
- Standard table wrapper with full horizontal scrolling and responsive borders:
  ```tsx
  <div className="overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white shadow-xs">
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] font-bold">
          <th className="p-3.5">Name & Code</th>
          <th className="p-3.5">Category</th>
          <th className="p-3.5 text-right">Quantity</th>
          <th className="p-3.5 text-right">Unit Rate</th>
          <th className="p-3.5 text-right">Total Amount</th>
          <th className="p-3.5">Status</th>
          <th className="p-3.5 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[rgba(45,45,45,0.06)]">
        {/* Table Rows */}
      </tbody>
    </table>
  </div>
  ```

### 2.7 Status Badges (`Badge.tsx`)
Always use standard semantic badge mappings:
- `PENDING` / `DRAFT` / `IN_PROGRESS` ➔ Amber badge (`bg-amber-100 text-amber-800 border-amber-200`)
- `APPROVED` / `ACTIVE` / `COMPLETED` / `PASSED` ➔ Emerald badge (`bg-[#2E8B57]/15 text-[#2E8B57] border-[#2E8B57]/30`)
- `REJECTED` / `CRITICAL` / `FAILED` / `CANCELLED` ➔ Crimson badge (`bg-red-100 text-red-700 border-red-200`)
- `SCHEDULED` / `ISSUED` / `INFO` ➔ Blue badge (`bg-blue-100 text-blue-700 border-blue-200`)

### 2.8 Modals & Action Reason Dialogs (`Modal.tsx`)
- All modal dialogs must use a fixed backdrop with blur:
  ```tsx
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
        <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2 font-['Outfit']">
          <Icon className="w-5 h-5 text-[#C79A3B]" />
          Modal Title
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-[#FAF8F5]">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modal Body */}
      <div className="space-y-4 text-xs">{children}</div>

      {/* Modal Footer */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5]">
          Cancel
        </button>
        <button onClick={onSubmit} className="px-5 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D]">
          Save Changes
        </button>
      </div>
    </div>
  </div>
  ```

### 2.9 Empty & Loading States (`EmptyState.tsx`, `LoadingSkeleton.tsx`)
- When a list or table is empty:
  ```tsx
  <div className="p-12 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] text-[#C79A3B] flex items-center justify-center mx-auto border border-[rgba(45,45,45,0.06)]">
      <Inbox className="w-6 h-6" />
    </div>
    <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">No Items Found</h4>
    <p className="text-xs text-[#707070] max-w-sm mx-auto">There are no records matching your current filter criteria.</p>
    {actionButton}
  </div>
  ```

---

## 3. STRICT REUSE & DUPLICATION PREVENTION RULES

1. **Rule of Three (3x):** If any UI element pattern (e.g. status badge, KPI box, date filter, action reason dialog) is needed in two or more workspaces, it MUST use a shared component or identical token set.
2. **No Custom Color Inventions:** Do not introduce arbitrary hex codes (e.g. `#4A90E2`, `#333333`, `#22C55E`, `#EF4444`). Always use the official design system tokens (`#1C1C1C`, `#707070`, `#B8862D`, `#C79A3B`, `#2E8B57`, `#D99625`, `#D9534F`).
3. **No Unstyled Alert / Confirms:** Never use browser `alert()` or `confirm()`. Use the custom luxury feedback banner or modal confirmation dialog with audit reason tracking.
4. **Deterministic Formatters:**
   - Currency: `$${Number(val).toFixed(2)}`
   - Percent: `${Number(val).toFixed(1)}%`
   - Quantities: `${Number(qty).toFixed(1)} ${unit}`
   - Dates: `new Date(date).toLocaleDateString()`

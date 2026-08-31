# HOTEL-ERP DESIGN SYSTEM & VISUAL SPECIFICATION
**Version:** 2.0.0  
**Status:** Permanent Source of Truth  
**Target Platform:** Web (Desktop, Tablet, Mobile PWA)

---

## 1. BRAND DIRECTION & VISUAL IDENTITY

The Hotel-ERP brand identity marries **Ultra-Luxury Hospitality Aesthetics** with **High-Performance Enterprise ERP Precision**. It embodies the prestige, elegance, and calm sophistication of a world-class luxury resort (e.g., Grand Heritage Resort) while maintaining dense, high-clarity data dashboards for multi-outlet operations.

### Core Philosophy
1. **Warm Luxury Baseline:** Soft Ivory (`#F5F3EE`) background instead of harsh sterile gray or blinding pure white.
2. **Champagne & Heritage Gold Accents:** Controlled use of warm gold (`#C79A3B`, `#B8862D`) and champagne highlights (`#F1E4C5`) signifying premium tier quality.
3. **Deep Charcoal Precision:** Text and structural elements use obsidian charcoal (`#1C1C1C`) and warm slate (`#707070`) for optimal optical contrast and readability.
4. **Frosted Glassmorphism Surfaces:** Card containers and headers feature crisp, semi-translucent backdrop blurs with subtle 1px border lines (`rgba(45, 45, 45, 0.08)`).
5. **Deterministic Cohesion:** Every button, table, badge, modal, input, and workspace follows an identical tokenized visual language.

---

## 2. COLOR SYSTEM & DESIGN TOKENS

### 2.1 Backgrounds & Surfaces
| Token Name | Hex / RGBA | Tailwind Class / CSS Var | Purpose |
| :--- | :--- | :--- | :--- |
| **Base Background** | `#F5F3EE` | `bg-[#F5F3EE]` / `--bg-base` | Main application background (Warm Ivory) |
| **Surface Subtle** | `#FAF8F5` | `bg-[#FAF8F5]` / `--bg-subtle` | Table headers, inset blocks, input background |
| **Surface Glass** | `rgba(255, 255, 255, 0.85)` | `bg-white/85 backdrop-blur-md` | Cards, panels, workspace containers |
| **Surface Solid White**| `#FFFFFF` | `bg-white` / `--bg-card` | Modal dialogs, dropdowns, pure white cards |
| **Sidebar Surface** | `#FFFFFF` (95% blur) | `bg-white/95 backdrop-blur-md` | Primary navigation sidebar |
| **Header Surface** | `rgba(255, 255, 255, 0.80)`| `bg-white/80 backdrop-blur-md` | Sticky top navigation bar |

### 2.2 Brand & Primary Hierarchy
| Token Name | Hex / RGBA | Tailwind Class | Purpose |
| :--- | :--- | :--- | :--- |
| **Deep Obsidian (Primary)** | `#1C1C1C` | `text-[#1C1C1C]`, `bg-[#1C1C1C]` | Main text, primary brand buttons, heavy headers |
| **Heritage Gold (Brand Premium)** | `#B8862D` | `text-[#B8862D]`, `bg-[#B8862D]` | Key highlights, primary CTA accents, active tab text |
| **Bright Gold (Accent)** | `#C79A3B` | `text-[#C79A3B]`, `bg-[#C79A3B]` | Icons, glowing badges, gradient endpoints |
| **Champagne Active** | `#F1E4C5` | `bg-[#F1E4C5]`, `border-[#F1E4C5]` | Active navigation background, selected items |
| **Slate Secondary** | `#707070` | `text-[#707070]` | Subtitles, helper text, table headers, labels |
| **Charcoal Medium** | `#505050` | `text-[#505050]` | Inactive nav links, secondary description |

### 2.3 Semantic Status & Feedback Colors
| Semantic Role | Primary Hex | Light BG Hex (10-15%) | Border RGBA | Tailwind Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Success / Approved / Active** | `#2E8B57` (SeaGreen) | `#EBF5F0` | `rgba(46, 139, 87, 0.25)` | `text-[#2E8B57] bg-[#2E8B57]/15 border-[#2E8B57]/30` |
| **Warning / Pending / High** | `#D99625` (Amber Gold)| `#FDF7EC` | `rgba(217, 150, 37, 0.25)` | `text-amber-800 bg-amber-100 border-amber-300` |
| **Danger / Critical / Rejected**| `#D9534F` (Crimson) | `#FDF2F2` | `rgba(217, 83, 79, 0.25)` | `text-red-700 bg-red-100 border-red-300` |
| **Info / Scheduled / General** | `#3978B8` (Royal Blue)| `#EFF5FB` | `rgba(57, 120, 184, 0.25)` | `text-blue-700 bg-blue-100 border-blue-300` |
| **Purple / Special / AI** | `#7C3AED` (Violet) | `#F5F3FF` | `rgba(124, 58, 237, 0.25)` | `text-purple-700 bg-purple-100 border-purple-300` |

### 2.4 Borders & Outlines
- **Default Subtle Border:** `rgba(45, 45, 45, 0.08)` (1px solid on all cards, tables, headers)
- **Active / Focused Border:** `rgba(199, 154, 59, 0.40)` or `#C79A3B`
- **Divider Line:** `rgba(45, 45, 45, 0.06)`

---

## 3. TYPOGRAPHY & TEXT HIERARCHY

### 3.1 Font Families
- **Display Font:** `'Outfit', 'Inter', -apple-system, sans-serif` — Used for workspace headings, hero numbers, executive KPI digits, brand logo.
- **Body & Interface Font:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` — Used for body copy, table text, buttons, form controls.
- **Monospace Font:** `'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace` — Used for codes (e.g. `[OUT-001]`), SKUs, batch numbers, currencies, dates, mathematical quantities.

### 3.2 Typography Scale
| Element | Font Size | Weight | Line Height | Font Family | Example Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Title / Hero** | `28px - 32px` (`text-2xl` - `text-3xl`) | 700 Bold | `1.2` | Outfit | Main Workspace Hero, Executive Banner |
| **Section Title** | `20px - 24px` (`text-xl` - `text-2xl`) | 700 Bold | `1.3` | Outfit | Modal Titles, Workspace Headers |
| **Card Heading** | `15px - 16px` (`text-sm` - `text-base`) | 700 Bold | `1.4` | Outfit / Inter | Card Titles, Panel Headers, Sub-sections |
| **Body Standard** | `13px - 14px` (`text-xs` - `text-sm`) | 400 Regular / 500 Med | `1.5` | Inter | General descriptions, table data cells |
| **Caption / Meta** | `11px - 12px` (`text-[11px]` - `text-xs`) | 500 Med / 600 Semi | `1.4` | Inter | Timestamps, table column headers, helper notes |
| **Micro Tag / Badge** | `9px - 10px` (`text-[9px]` - `text-[10px]`) | 700 Bold | `1.2` | Inter / Mono | Status badges, outlet code tags, role pills |

---

## 4. SPACING SCALE & ELEVATION (SHADOWS)

### 4.1 Spacing Units
- **`space-1` (4px):** Tight icon padding, badge horizontal padding.
- **`space-2` (8px):** Button internal padding, chip spacing, form field gap.
- **`space-3` (12px):** Card internal compact padding, list item separation.
- **`space-4` (16px):** Standard card padding, grid gap on mobile.
- **`space-6` (24px):** Main workspace block gap, modal padding, desktop grid spacing.
- **`space-8` (32px):** Major section dividers.

### 4.2 Border Radius Scale
- **Pills / Badges:** `rounded-full` (`9999px`)
- **Inputs / Dropdown Buttons / Action Buttons:** `rounded-xl` (`12px`)
- **Cards / Containers / Table Wrappers:** `rounded-2xl` (`16px`)
- **Modal Dialogs / Hero Banners:** `rounded-3xl` (`24px`)

### 4.3 Shadow System
- **Subtle (Cards):** `box-shadow: 0 4px 20px -2px rgba(45, 45, 45, 0.04), 0 2px 6px -1px rgba(45, 45, 45, 0.02)`
- **Hover Lift (Interactive Cards):** `box-shadow: 0 10px 30px -4px rgba(199, 154, 59, 0.12), 0 4px 12px -2px rgba(45, 45, 45, 0.04)`
- **Floating / Modal (Dialogs, Drawers):** `box-shadow: 0 20px 25px -5px rgba(45, 45, 45, 0.08), 0 8px 10px -6px rgba(45, 45, 45, 0.04)`

---

## 5. REUSABLE COMPONENT STYLING SPECIFICATIONS

### 5.1 Buttons
1. **Primary Button (Obsidian):**
   - Classes: `px-4 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98]`
2. **Brand Gold Button (CTA):**
   - Classes: `px-4 py-2 rounded-xl bg-[#B8862D] hover:bg-[#9E7326] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98]`
3. **Success Action Button (Approve / Confirm):**
   - Classes: `px-4 py-2 rounded-xl bg-[#2E8B57] hover:bg-[#257247] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98]`
4. **Secondary / Outlined Button:**
   - Classes: `px-4 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#1C1C1C] text-xs font-bold transition-all shadow-xs active:scale-[0.98]`
5. **Destructive / Danger Button:**
   - Classes: `px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98]`
6. **Icon Action Button (Table cell or tool button):**
   - Classes: `p-1.5 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] transition-colors`

### 5.2 Form Inputs & Controls
1. **Text Input / Number Input / Date Input:**
   - Background: `#FAF8F5` (Subtle off-white)
   - Border: `1px solid rgba(45, 45, 45, 0.12)`
   - Focus State: `border-[#C79A3B] ring-1 ring-[#C79A3B]/30 outline-none`
   - Typography: `text-xs font-medium text-[#1C1C1C]`
   - Padding: `px-3.5 py-2.5 rounded-xl`
2. **Select Dropdowns:**
   - Same base classes as text input with chevron indicator and background `#FAF8F5`.
3. **Search Input Bar:**
   - Left-positioned `<Search className="w-4 h-4 text-[#707070]" />` icon, rounded-xl container with clear button.

### 5.3 Data Tables
- **Container:** `overflow-x-auto rounded-2xl border border-[rgba(45,45,45,0.08)] bg-white shadow-xs`
- **Header Row (`<thead>`):** `bg-[#FAF8F5] border-b border-[rgba(45,45,45,0.08)] text-[#707070] text-[11px] font-bold uppercase tracking-wider`
- **Body Rows (`<tr>`):** `divide-y divide-[rgba(45,45,45,0.06)] hover:bg-[#FAF8F5]/60 transition-colors`
- **Data Cells (`<td>`):** `p-3.5 text-xs text-[#1C1C1C]`
- **Numeric / Code Cells:** `font-mono text-right`

### 5.4 Badges & Status Pills
- Standard structure: `px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1`
- **Pending:** `bg-amber-100 text-amber-800 border border-amber-200`
- **Approved / Active / Success:** `bg-[#2E8B57]/15 text-[#2E8B57] border border-[#2E8B57]/30`
- **Critical / Danger / Rejected:** `bg-red-100 text-red-700 border border-red-200`
- **Draft / Inactive:** `bg-gray-100 text-gray-700 border border-gray-200`
- **Outlet Code Tag:** `font-mono font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] border border-[rgba(45,45,45,0.08)]`

### 5.5 Modal Dialogs & Backdrops
- **Backdrop:** `fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4`
- **Modal Panel:** `bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto`
- **Header:** Title in Outfit font, subtle subtitle, top-right close icon button.
- **Footer:** Action buttons right-aligned (`Cancel` outlined + `Submit` brand/action filled).

---

## 6. STATES & FEEDBACK PATTERNS

### 6.1 Loading States
- **Card Skeleton:** `animate-pulse bg-[#FAF8F5] rounded-2xl h-28 border border-[rgba(45,45,45,0.06)]`
- **Spinner:** `<RefreshCw className="w-5 h-5 animate-spin text-[#C79A3B]" />`
- **Button Loading:** Disabled opacity 50% with spinning icon and label change (e.g., `"Submitting..."`).

### 6.2 Empty States
- Standard Empty Container: `p-12 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] space-y-3`
- Visual: Rounded icon badge in `#FAF8F5` with gold/gray icon, heading in Outfit font, clear actionable button (e.g., `"+ Create First Item"`).

### 6.3 Success & Error Alert Banners
- **Success Banner:** `p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20`
- **Error Banner:** `p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/20`

---

## 7. RESPONSIVE BREAKPOINTS & MOBILE RULES

| Breakpoint | Width | Navigation Mode | Main Padding | Grid Columns |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile (`sm` & below)** | `< 768px` | Bottom Navigation Bar + Hamburger Drawer | `p-4 pb-24` | 1 column / 2 col KPI |
| **Tablet (`md`)** | `768px - 1024px` | Permanent Mini/Full Sidebar | `p-6 pb-12` | 2 - 3 columns |
| **Desktop (`lg` - `xl`)** | `1024px - 1536px`| Permanent 64-width Left Sidebar | `p-8 max-w-7xl` | 3 - 4 columns |
| **Ultrawide (`2xl`)** | `> 1536px` | Full Sidebar + Expanded Content Area | `p-8 max-w-7xl` | 4 columns |

### Mobile Touch Guidelines
- Minimum touch target: 44px x 44px for primary buttons and navigation items.
- Full width tables wrapped in horizontal scroll container (`overflow-x-auto`) with subtle scroll indicator.
- Floating bottom nav pinned with `backdrop-blur-md` and active champagne gold indicator.

---

## 8. ACCESSIBILITY (a11y) STANDARDS
1. **Color Contrast:** All body text meets WCAG 2.1 AA minimum contrast ratio (4.5:1 against Ivory and White surfaces).
2. **Focus Indicators:** Interactive controls show prominent focus rings: `focus-visible:ring-2 focus-visible:ring-[#C79A3B] focus-visible:ring-offset-2`.
3. **Screen Readers:** All icon-only buttons include descriptive `aria-label` tags (e.g. `aria-label="Open Navigation Menu"`).
4. **Keyboard Nav:** Complete modal escape key trapping, enter key submission on search inputs, tab sequence focus.

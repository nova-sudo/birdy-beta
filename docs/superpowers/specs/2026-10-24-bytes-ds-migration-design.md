# Birdy → Bytes Dashboard design system migration

Date: 2026-10-24 · Status: draft for review

## Goal

Every page in `birdy-beta` uses the design system from the Paper file **"Bytes Dashboard · Design System"** (https://app.paper.design/file/01M5BG4N1KFFRRRD25FDQY3REJ), built from components ported from Bytes-Dashboard (`/Users/abdelrahman/Desktop/Bytes/bytes-dashboard`, `apps/dashboard/src/components`, source commit `aaefe2dd08`). The work is verified with screenshots in the browser pane.

## Decisions (agreed 2026-10-24)

| # | Decision | Choice |
|---|---|---|
| 1 | Brand accent | Bytes structure, **Birdy purple**. Everything in Paper is adopted except `--color-primary`: Birdy keeps `#5B3FD6` instead of `#FF4500`. |
| 2 | Sharing | **Port-copy as JS** into `src/components/ds/`. No package and no symlink. |
| 3 | Tokens | **New Paper-named tokens are the source of truth.** `--pd-*` and the shadcn vars become aliases of them, and each alias is removed once nothing uses it. |
| 4 | Page order | **Hubs first** (see Phases). |
| 5 | Birdy's voice | **Option A: the "Needs you" frame** (mock: `design_handoff_hubs/design_handoff_bytes_ds/hub-options.html`). |
| 6 | Dark mode | **Light only, with dark-ready tokens.** Components carry no hex values; a `.dark` block can be added later. |

What Paper is used for: Paper is the visual source of truth. The Bytes code is the starting implementation. Where the two differ (Paper notes, for example, that "one MetricCard replaces MetricCard, StatCard, BoardStat…"), Paper wins.

Pages that apply: 1 Foundations, 2 Primitives, 3 Surfaces, 4 Overlays, 5 Data, 6 Conversation, 7 Shell, 8 Pages, 9 Reports, 11 Settings, 13 Onboarding, 14 Do's and don'ts. Pages that are Bytes-only (Menu, Hostess, Website builder, Video feed and similar) are ignored.

## 1. Tokens

Everything goes in `src/app/globals.css`, in `:root` plus `@theme inline` (Tailwind v4). `tailwind.config.js` is dead; it gets deleted.

### New source-of-truth tokens (Paper names)

| Token | Value | Notes |
|---|---|---|
| `--color-background` | `#FFFFFF` | page surface |
| `--color-foreground` | `#0A0A0A` | ink |
| `--color-muted` | `#F7F7F7` | the "frame" (shell, frame headers) |
| `--color-muted-foreground` | `#737373` | secondary text |
| `--color-border` | `#E5E5E5` | hairlines |
| `--color-primary` | `#5B3FD6` | **Birdy purple** |
| `--color-primary-soft` | `#EFECFB` | Birdy addition: tint behind purple chips. Paper has no primary tint. |
| `--color-primary-foreground` | `#FFFFFF` | |
| `--color-{danger,warning,success,info}` | `#EF4444` · `#F59E0B` · `#16A34A` · `#3B82F6` | status base |
| `--color-{…}-soft` | `#FEF2F2` · `#FFFBEB` · `#F0FDF4` · `#EFF6FF` | status background |
| `--color-{…}-ink` | `#991B1B` · `#92400E` · `#166534` · `#1E40AF` | status text |
| `--color-neutral-soft` / `-ink` | `#F4F4F5` / `#52525B` | paused / muted state |
| `--font-sans` | Outfit (next/font) | tabular figures for numbers |
| `--font-mono` | Geist Mono (next/font) | IDs, axis labels, kbd |
| `--text-xs…2xl` | 13 / 14 / 16 / 18 / 20 / 32px | 16px body everywhere |
| `--spacing-control-sm/control/control-lg` | 32 / 40 / 48px | control heights |
| `--radius-sm/control/surface/frame/overlay` | 6 / 12 / 12 / 16 / 20px | |
| `--shadow-control`, `--shadow-surface`, `--shadow-floating`, `--shadow-overlay` | Paper "Elevation" (ring 1px /6–8 plus one soft lift) | values taken exactly with `get_computed_styles` |
| motion | press 90ms, edge slide 320ms `cubic-bezier(.32,.72,0,1)`, tab-thumb spring (damping 22, stiffness 260) | everything is off under `prefers-reduced-motion` |

### Alias layer (temporary)

- **shadcn vars** point at the tokens above: `--background`, `--foreground`, `--primary`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--card`, `--popover`, `--accent`, `--secondary`, `--sidebar-*`.
  - `--radius` changes from 18px to 12px.
  - These aliases stay: the ported shadcn-style components use them.
- **`--pd-*`** maps onto the closest new token:
  - `pd-ink` → foreground
  - `pd-body` → `#404040`, added as the new token `--color-body`
  - `pd-muted`/`pd-subtle`/`pd-faint` → muted-foreground
  - `pd-canvas` → muted
  - `pd-surface` → background
  - `pd-border`/`pd-divider` → border
  - `pd-primary*` → primary / primary-soft
  - status pairs → status base / soft
  - `pd-amber` → warning-ink
  - The whole app takes the new look the moment Phase 0 lands. Each later phase deletes the aliases it no longer needs. The last phase deletes `--pd-*` and `--font-pd-*`.
- **dashkit:**
  - `src/lib/dashkit/theme.js` (`DK_THEME_VARS`) and the mirrored `.dk-root` block are repointed to the new names.
  - The hardcoded `--dk-chart-2 #2E9E8F` becomes a token: `--color-chart-2`, part of a `--color-chart-1…5` series taken from the Paper charts ("series" in the Data page token strip, with the first series set to purple).
  - `--dk-radius` becomes `--radius-frame`.
  - The existing sync test stays green.
- **Fonts:** `src/lib/pd-fonts.js` changes from Bricolage + Inter to Outfit + Geist Mono, and is renamed to `src/lib/fonts.js`. The `--font-display` and `--font-pd-*` aliases point to Outfit until they are removed.

## 2. Components

### Location and porting rules

- `src/components/ds/` holds the ported kit as JS (`.jsx`):
  - `primitives/`
  - `surfaces/`
  - `overlays/`
  - `data/` (table, charts)
  - `shell/`
  - `birdy/` (Birdy-only components built on the kit)
- `src/components/ds/PORTED.md` records, for every file: its source path, source commit, what was stripped, and its local changes.
- Porting rules:
  - TS → JS, with types kept as JSDoc on props.
  - Remove `PermissionGate` (the `permissions` prop), `@bytes/*`, `@bytes/shared`, nuqs (URL state goes through Birdy's existing patterns), remixicon/react-icons (use lucide) and `next-intl`, if found.
  - Keep `"use client"`.
  - Use the existing `cn` from `@/lib/utils`.
  - Re-skin to Paper where the Bytes code differs: Outfit, not Geist Mono, as the sans font; Paper radii and elevation.
- New deps, only when a ported component needs them: `@tanstack/react-table` (data table), `motion` (press / slide / thumb), `vaul` (mobile sheet). Already present: Radix, cmdk, sonner, recharts 2.15, react-day-picker.

### Mapping: Birdy today → new kit

| Birdy today | Becomes | Source |
|---|---|---|
| `ui/button` | `ds/primitives/button` (variants: primary, outline as the default, ghost, secondary, destructive; sizes sm 32, md 40, lg 48) | bytes `ui/button.tsx` + Paper 2 · Primitives |
| `ui/input`, `textarea`, `select`, `checkbox`, `switch`, `label` | ds primitives of the same names | bytes `ui/*` |
| `ui/badge` + `portfolio/tones.js` | `ds/primitives/badge` (status tones: base / soft / ink) | bytes `ui/badge.tsx` + Paper status triples |
| `ui/card`, `portfolio/PdCard` | `ds/surfaces/frame` (muted frame + header) and `ds/surfaces/surface` (white body) | bytes `ui/frame.tsx`, `ui/card.tsx`, Paper 3 · Surfaces |
| `ui/tabs`, `portfolio/PageTabs`, `PdSegmented`, `UnderlineTabs` | `ds/primitives/segmented-tabs` (spring thumb) + `ds/primitives/tabs` | bytes `composed/segmented-tabs.tsx`, `ui/tabs.tsx` |
| `portfolio/PdMenu`, `ui/dropdown-menu`, `ui/popover`, `ui/tooltip` | ds overlays (floating elevation) | bytes `ui/*` (`animate-ui` flattened in) |
| `ui/dialog`, `alert-dialog`, `sheet` | `ds/overlays/dialog`, `sheet` (edge slide), `confirm` | bytes `ui/dialog`, `sheet`, `danger-dialog`, `confirmer` |
| `ui/table`, `table-container`, `pagination`, `Filterpanel` | `ds/data/data-table` (+ toolbar, faceted filter, pagination, cells) | bytes `table/*` |
| `portfolio/MetricTabsChart`, `TrendChart`, `TrendPlot`, `StatStrip`, `StatTile`, `DeltaPill`, `ui/sparkline` | `ds/data/metric-tabs-chart`, `metric-card`, `metric-group`, `delta` | bytes `charts/metric-card*`, `board-trend-chart`, `comparison-delta` + Paper 5 · Data |
| `portfolio/Leaderboard`, `FunnelStepper` | `ds/data/breakdown` (ranked list with share), `ds/data/bar-list`; FunnelStepper is re-skinned, with no Bytes equivalent | bytes `charts/bar-list`, `segmented-bar` + Paper "Breakdown" |
| `portfolio/BirdyBriefing`, `SuggestionCard`, `InsightCard`, `WinCard` | **`ds/birdy/birdy-read`**: decision 5, option A. A muted frame with a `BirdyAvatar` header and a count, plus a white surface of findings; each finding has a status icon, a title, a detail line and one action. `InsightCard` is retired. | Paper "Needs you" (8 · Pages) |
| `portfolio/ActivityRow`, `DiagnosticBanner`, `LoadError`, `LoadingPulse`, `ui/empty`, `ui/spinner`, `ui/skeleton` | `ds/surfaces/notice`, `empty-state`, `error-state`, `skeleton`, `spinner` | bytes `composed/notice`, `error-state`, `ui/empty-state` |
| `portfolio/SidePanel` | `ds/shell/side-panel` (adjacent panel, per Bytes PRODUCT.md) | bytes `composed/rail-shell` |
| `ui/sidebar` + the app sidebar/top bar | `ds/shell/app-sidebar`, `top-bar`, `page-header`, `system-banner` | Paper 7 · Shell; bytes `features/dashboard/components/*` used as reference only (feature-coupled) |
| Chat (`/ask-birdy`, ChatConversation) | re-skinned to Paper 6 · Conversation | Paper only; Bytes has no generic chat kit |
| `ui/command` | `ds/overlays/command` (search, ⌘K) | bytes `ui/command` + Paper shell search |
| `ui/sonner` | `ds/overlays/toaster` | bytes `ui/sonner` |
| dashkit widgets | stay in dashkit and are restyled only through the `--dk-*` map | n/a |

Rules carried over:
- The mascot appears only inside `BirdyAvatar`. Its frame tone changes to the new `primary-soft` / `border`.
- Colour means status, plus one primary action per view.
- Cost metrics invert their delta colour: falling is good.
- GBP £ with tabular figures.
- Destructive actions use the Paper confirm pattern, not loud red buttons.

When a page's last import moves over, the old file is deleted. `components/portfolio/` and the replaced `components/ui/*` files are gone by the end.

### Shell (Paper 7 · Shell, adapted)

- A muted frame around a white page surface.
- Sidebar:
  - agency switcher with the framed Birdy mark
  - **Browse / Ask Birdy** segmented toggle (Paper's Browse / Ask Bytes)
  - search with ⌘K
  - nav: Dashboard, Clients, Metrics, Contacts, Sales Hub, Campaigns, Alerts, Dashboards, Settings
  - footer user menu
- Top bar: breadcrumb, Export, Ask Birdy (⌘J).
- System banner slot: billing warnings move here.
- Mobile at 390: sidebar becomes a sheet, as in Paper "Switcher · 390 sheet".
- **BirdyHub compatibility:** the parked BirdyHub/agents redesign (`design_handoff_hubs/design_handoff_birdy_hub/birdyhub-options.html`) must slot in as a nav item plus a page that uses `ds/*` and `birdy-read`. The shell keeps nav items data-driven (an array config) so adding BirdyHub later is a one-line change.

## 3. Phases (one PR per phase, each verified before the next)

The work happens on branch `feat/bytes-ds-migration`, cut from `main`.

0. **Foundation:**
   - fonts and token layer with aliases
   - dashkit map
   - delete tailwind.config.js
   - port primitives, surfaces, overlays and data (table + metric tabs chart)
   - a `/_ds` showcase route (dev only) that mirrors the Paper Foundations, Primitives, Surfaces and Data pages, used for side-by-side screenshots against Paper
1. **Shell:** sidebar, top bar, page header, system banner, mobile sheet.
2. **Hubs:**
   - `/dashboard`, using the mock as its spec
   - `/clients`
   - `/clients/[id]` (+ `/tracking`)
   - `/metrics`
   - `/contacts`
   - `/Sales-Hub`
   - `/campaigns`
   - `/alerts`
3. **Conversation:** `/ask-birdy`.
4. **Custom dashboards:** `/dashboards`, `/dashboards/[id]` (dashkit theming).
5. **Settings & money:** `/settings`, `/billing` (+ 3 legal pages), `/credits`.
6. **Onboarding:** `/onboarding` (Paper 13 · Onboarding).
7. **Auth & install:** `/`, `/login`, `/register`, `/install/[siteId]`.
8. **Admin:** `/admin`, `/admin/agencies`, `/admin/ai-queries`, `/admin/credits`, `/admin/promo-codes`, `/admin/stats`.
9. **Leftovers & cleanup:**
   - `/changelog`, error, global-error and not-found pages
   - delete `components/portfolio/`, the replaced `ui/*`, `--pd-*`, the shadcn aliases nothing uses, and stale README/font references
   - update `Birdy Style Guide.md` to point at this system

Before any page that has no Paper equivalent is built (FunnelStepper, the onboarding ReportDesigner, admin tables), it gets a 2–3 option HTML mock, per standing preference.

## 4. Verification ("done" for each phase)

- Build with `NEXT_PUBLIC_API_URL` pointed at the local backend, and run the dev server through `.claude/launch.json` / preview_start.
- Crawl every route the phase touched in the browser pane at 1440 and 390, and screenshot each one. Compare against the matching Paper artboard (`get_screenshot`) for shell, header, metric tabs, tables and overlays.
- Run a code audit per phase:
  - grep that the migrated files contain no `pd-` classes, no `--pd-` vars and no raw hex (except brand or channel logos)
  - check that no page imports `components/portfolio`
  - run the existing tests (dashkit token sync, component tests) plus `next build`
- Console shows no errors and no hydration warnings on the crawled routes.
- Finished means: all 30 routes are crawled and screenshotted, the audit greps are empty across `src/`, and `components/portfolio` no longer exists.

## Out of scope

- Dark mode: only the tokens are made ready for it.
- The BirdyHub/agents redesign: parked, but the shell stays compatible with it.
- Backend changes.
- Changing what dashkit renders internally: theming only.
- Any copy rewrite beyond what the components need.

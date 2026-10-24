# Bytes DS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every birdy-beta page onto the Paper "Bytes Dashboard · Design System". Birdy keeps its purple primary. The components are ported from Bytes-Dashboard as JS.

**Architecture:**
- New Paper-named tokens in `globals.css` are the source of truth. The shadcn vars, `--pd-*` and `--dk-*` all become aliases of them, so the whole app shifts the moment Task 1 lands.
- A ported kit goes in `src/components/ds/`.
- Pages then move onto that kit one PR at a time, hubs first. Each phase deletes the aliases and old components it no longer needs.

**Tech Stack:**
- Next 16 (turbopack), React 19, JS only (`.jsx`)
- Tailwind v4 (`@theme` in CSS), Radix, cva
- recharts 2.15, dashkit 0.3.0
- vitest + jsdom + @testing-library/react
- lucide-react

**Spec:** `docs/superpowers/specs/2026-10-24-bytes-ds-migration-design.md`. Read it before starting; the decisions table and the component mapping table are referenced throughout.

**Sources:**
- Paper file id `01M5BG4N1KFFRRRD25FDQY3REJ` (Paper MCP). Load `get_guide("paper-mcp-instructions")` first. Take exact values with `get_jsx(includeNodeIds:false)` / `get_computed_styles`, never by eye from screenshots.
- Bytes kit: `/Users/abdelrahman/Desktop/Bytes/bytes-dashboard/apps/dashboard/src/components/` at commit `aaefe2dd08`. Read-only; never edit that repo.

## Global Constraints

- Primary is `#5B3FD6` and primary-soft is `#EFECFB`. Every other value is Paper's: bg `#FFFFFF`, fg `#0A0A0A`, muted `#F7F7F7`, muted-fg `#737373`, border `#E5E5E5`, plus the status base/soft/ink triples in spec §1.
- Fonts: Outfit (sans, `font-variant-numeric: tabular-nums` on figures) and Geist Mono. Text sizes 13/14/16/18/20/32px; body is 16px.
- Radii: sm 6, control 12, surface 12, frame 16, overlay 20. Control heights: 32 / 40 / 48.
- Elevation, exact from Paper Foundations › Elevation:
  - control: `0 0 0 1px #00000014, 0 1px 2px #0000000F, 0 2px 4px -2px #0000000D`
  - control focus: `0 0 0 1px color-mix(in srgb, var(--color-primary) 60%, transparent), 0 0 0 4px color-mix(in srgb, var(--color-primary) 14%, transparent), 0 1px 2px #0000000F`
  - surface: `0 0 0 1px #0000000F, 0 1px 2px #0000000A`
  - floating: `0 0 0 1px #0000000F, 0 4px 12px -2px #00000014, 0 12px 32px -8px #0000001F`
  - overlay: `0 0 0 1px #0000000F, 0 24px 64px -12px #0000003D`
  - scrim: `#0A0A0A2E`
- Motion. All of it goes inside `MotionConfig reducedMotion="user"` or `@media (prefers-reduced-motion)`, so it is off under reduced motion.
  - press: 90ms, translateY 1.5px + scale .98
  - release: 160ms `cubic-bezier(.2,0,0,1)`
  - edge slide: 320ms `cubic-bezier(.32,.72,0,1)`, with the backdrop fading over 200ms
  - tab thumb: spring with damping 22, stiffness 260
- Ported components: `.jsx` with JSDoc props, `"use client"` where they are interactive, `cn` from `@/lib/utils`, lucide icons only.
  - No `PermissionGate`, `@bytes/*`, `nuqs`, remixicon or react-icons.
  - No raw hex in `src/components/ds/**`; use tokens only (dark-ready).
- The mascot appears only via `BirdyAvatar`.
- Colour means status, plus one primary action per view. Cost metrics invert the delta colour (falling is good). Money is GBP `£`.
- Light mode only. No `.dark`, no ThemeProvider.
- Every ds component's root element carries `data-ds="<file-name>"` (for example `data-ds="birdy-read"`). Page tests find ds widgets by it.
- Builds and dev runs use `NEXT_PUBLIC_API_URL=http://localhost:8000` (the local birdy-backend), or the app hits the deployed API.
- Branch `feat/bytes-ds-migration` from `main`, in a worktree (superpowers:using-git-worktrees). The main checkout is on `feat/meta-campaign-scoping`; don't touch it.
- One PR per phase (Phases 0–9 below). Commit after every task.
- Any page or widget with no Paper equivalent gets a 2–3 option HTML mock in `design_handoff_hubs/design_handoff_bytes_ds/`, and the user picks one *before* it is built.

## Review Focus

1. **Overlays rendered in portals** (dialogs, toasts, popovers, the chat modal) must pick up Outfit and the tokens. Fonts and tokens must live on `<html>`/`:root`, not on a page wrapper. Test in Task 2.
2. **Long content in the shell at 390px.** Long agency or client names, and a nav badge over 99, must truncate rather than push the page sideways. Test in Task 9.
3. **Negative and inverted deltas.** Cost per lead falling has to render green with ↓. A zero delta is neutral grey with no arrow. Test in Task 6.
4. **Empty, loading and error states** on every hub (no clients, or the API down) must use the ds `empty-state`/`error-state`/`skeleton`, never blank space. Covered by the page checklist step "states".
5. **dashkit dashboards after the token swap.** `/dashboards/[id]` must still theme correctly, with `--dk-*` resolving to real values and none empty. Test in Task 1 plus the screenshot in Task 15.

---

## File Structure

```
src/app/globals.css                      tokens (@theme), alias layer (:root), dk-root block
src/app/__tests__/tokens.test.js         parses globals.css: token values, alias targets, no circular refs
src/lib/fonts.js                         Outfit + Geist Mono (replaces pd-fonts.js)
src/lib/dashkit/theme.js                 DK_THEME_VARS → new tokens
src/components/ds/PORTED.md              one row per ported file: source path@aaefe2dd08, stripped, local changes
src/components/ds/primitives/            button, input, textarea, select, checkbox, switch, label, badge, tabs, segmented-tabs, kbd
src/components/ds/surfaces/              frame, surface, notice, empty-state, error-state, skeleton, spinner
src/components/ds/overlays/              dialog, confirm, sheet, popover, dropdown-menu, tooltip, command, toaster
src/components/ds/data/                  data-table/*, metric-tabs-chart, metric-card, metric-group, delta, breakdown, bar-list
src/components/ds/shell/                 nav-config, app-sidebar, top-bar, page-header, system-banner, mobile-nav-sheet
src/components/ds/birdy/                 birdy-read
src/components/ds/index.js               barrel
src/app/_ds/page.jsx                     dev-only showcase (404 in production)
```

Each ds file has a test next to it in `__tests__/` within its folder, matching the repo's existing `__tests__` convention.

---

## Phase 0: Foundation (PR 1)

### Task 1: Token layer and aliases

**Files:**
- Modify: `src/app/globals.css` (the `.dk-root` block at lines ~15-44, `@layer base :root` at ~80-235, `@theme inline` at ~236-360, base `font-family` at ~484)
- Modify: `src/lib/dashkit/theme.js`
- Delete: `tailwind.config.js`
- Create: `src/app/__tests__/tokens.test.js`
- Test: `src/lib/__tests__/dashkit-adapters.test.jsx` (existing; must stay green)

**Interfaces:**
- Produces Tailwind utilities that later tasks use:
  - colours: `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-primary-soft`, `text-primary-foreground`, `text-body`
  - status: `{bg,text}-{danger,warning,success,info}`, `-soft`, `-ink`, plus `neutral-soft`, `neutral-ink`
  - charts: `chart-1…5`
  - size: `h-control-sm`, `h-control`, `h-control-lg`
  - radius: `rounded-sm`, `rounded-control`, `rounded-surface`, `rounded-frame`, `rounded-overlay`
  - shadow: `shadow-control`, `shadow-control-focus`, `shadow-surface`, `shadow-floating`, `shadow-overlay`
  - type: `text-xs` (13) … `text-2xl` (32), `font-sans`, `font-mono`
  - easing: `ease-press` and `ease-edge` (`--ease-press: cubic-bezier(.2,0,0,1)`, `--ease-edge: cubic-bezier(.32,.72,0,1)`)
  - scrim: `bg-scrim` (`--color-scrim: #0A0A0A2E`)
- Chart series: `--color-chart-1: var(--color-primary)`, `--color-chart-2: #3B82F6`, `--color-chart-3: #14B8A6`, `--color-chart-4: #F59E0B`, `--color-chart-5: #A3A3A3`. These are Paper Data's series with the orange swapped for primary. Confirm them via `find_nodes` on page `p-4-0` with the "Tokens" strip text.

- [ ] **Step 1: Write the failing test**

`tokens.test.js` reads `src/app/globals.css` with `fs.readFileSync` (same approach as `dashkit-adapters.test.jsx`) and asserts:

```js
it("declares Paper tokens with Birdy primary", () => {
  for (const [name, value] of Object.entries({
    "--color-background": "#FFFFFF", "--color-foreground": "#0A0A0A", "--color-muted": "#F7F7F7",
    "--color-muted-foreground": "#737373", "--color-border": "#E5E5E5", "--color-primary": "#5B3FD6",
    "--color-primary-soft": "#EFECFB", "--color-danger": "#EF4444", "--color-danger-soft": "#FEF2F2",
    "--color-danger-ink": "#991B1B", "--color-success-ink": "#166534", "--spacing-control": "40px",
    "--radius-control": "12px", "--radius-frame": "16px", "--radius-overlay": "20px", "--text-base": "16px",
  })) expect(decl(css, name)).toBe(value)
})
it("aliases shadcn and pd vars to tokens", () => {
  expect(decl(css, "--primary")).toBe("var(--color-primary)")
  expect(decl(css, "--background")).toBe("var(--color-background)")
  expect(decl(css, "--radius")).toBe("12px")
  expect(decl(css, "--pd-ink")).toBe("var(--color-foreground)")
  expect(decl(css, "--pd-canvas")).toBe("var(--color-muted)")
  expect(decl(css, "--pd-primary-tint")).toBe("var(--color-primary-soft)")
})
it("has no circular var references", () => { /* build name→value map; follow var() chains ≤10 hops; none revisit a name */ })
it("ships no dark mode", () => expect(css).not.toMatch(/\.dark\b|prefers-color-scheme/))
```

`decl(css, name)` returns the trimmed value of the **last** declaration of `name`. Put it in the test file.

Extend `dashkit-adapters.test.jsx` with:

```js
it("maps dashkit onto the new tokens", () => {
  expect(DK_THEME_VARS["--dk-accent"]).toBe("var(--color-primary)")
  expect(DK_THEME_VARS["--dk-chart-2"]).toBe("var(--color-chart-2)")
  expect(DK_THEME_VARS["--dk-radius"]).toBe("var(--radius-frame)")
  expect(Object.values(DK_THEME_VARS).join()).not.toMatch(/--pd-|#[0-9a-f]{3,8}/i)
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/app/__tests__/tokens.test.js src/lib/__tests__/dashkit-adapters.test.jsx`
Expected: FAIL on every new assertion.

- [ ] **Step 3: Implement**
  - Add a non-inline `@theme { … }` block that holds every source-of-truth token from Global Constraints and spec §1. Tailwind v4 emits these as `:root` vars and generates the utilities.
  - Add `--color-body: #404040`.
  - In `@theme inline`, **delete** the lines that map `--color-<shadcn>` → `var(--<shadcn>)`. They would now be circular.
  - Keep `--color-pd-*` → `var(--pd-*)` for now.
  - In `:root`, repoint each shadcn var to its token: `--primary: var(--color-primary)` and so on for the full list in spec §1. Set `--radius: 12px`.
  - Repoint each `--pd-*` var using the spec §1 alias list. Map `--pd-primary-light` and `--pd-primary-pale` to `var(--color-primary)` at 60% / 35% via `color-mix(in srgb, …)`. Keep the `--purple-*` / `--gray-*` scales as they are; Task 22 deletes them.
  - Point `--pd-shadow-popover` at `var(--shadow-floating)` and `--pd-shadow-tooltip` at `var(--shadow-floating)`.
  - Rewrite the `.dk-root` block and `DK_THEME_VARS` identically, onto the new tokens:
    - bg→muted, card→background, fg→foreground, body→body, muted/subtle→muted-foreground, border→border
    - border-strong → `color-mix(in srgb, var(--color-border), #000 8%)`
    - table-head→muted, accent→primary, accent-tint→primary-soft, accent-pale → the same color-mix as pd-primary-pale
    - status → base/soft
    - chart-1…4 → `--color-chart-1…4`
    - radius→radius-frame, shadow→shadow-surface, shadow-pop→shadow-floating
    - font → `var(--font-outfit)`, font-display → `var(--font-outfit)`
    - Update the theme.js comment to match.
  - Delete `tailwind.config.js` and check that nothing imports it: `grep -rn "tailwind.config" src next.config.mjs postcss.config.mjs` returns nothing.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run`
Expected: everything PASS, including the existing `.dk-root` sync tests.

- [ ] **Step 5: Commit**

`git commit -m "feat(ds): Paper token layer with pd/shadcn/dk aliases"`

### Task 2: Fonts

**Files:**
- Create: `src/lib/fonts.js`
- Delete: `src/lib/pd-fonts.js`
- Modify: every importer of `pd-fonts` (`grep -rln "pd-fonts" src`), `src/app/globals.css` (`--font-sans`, `--font-mono`, `--font-display`, `--font-pd-*`, the base `font-family`)
- Test: `src/lib/__tests__/fonts.test.js`

**Interfaces:**
- Produces `export const fontVariables` (string). It holds `--font-outfit` and `--font-geist-mono`, and goes on `<html>` exactly as today.
- `pdFontClass` is kept as an exported alias equal to `"font-sans"` until Task 22.

- [ ] **Step 1: Failing test.** Mock `next/font/google` (`vi.mock`) so it returns `{ variable: "--font-x" }`. Assert that `fontVariables` contains the variables for both `Outfit` and `Geist_Mono`, and that Outfit is requested with weights `["400","500","600","700"]` and `display: "swap"`. In `tokens.test.js` add: `decl(css,"--font-sans")` matches `/^var\(--font-outfit\)/`; `decl(css,"--font-mono")` matches `/^var\(--font-geist-mono\)/`; `decl(css,"--font-pd-display")` is `var(--font-outfit)`.
- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run src/lib/__tests__/fonts.test.js src/app/__tests__/tokens.test.js`
- [ ] **Step 3: Implement** `src/lib/fonts.js` using `Outfit` and `Geist_Mono` from `next/font/google`. Update the importers. Point the globals.css font tokens and the base `font-family` at `var(--font-outfit)`. Add `font-feature-settings: "tnum"` to a `.num` utility (`@utility num`).
- [ ] **Step 4: Run them and confirm they pass.** `npx vitest run`
- [ ] **Step 5: Smoke-test portals.** `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev` via preview_start `birdy-beta`. Open `/dashboard` and run `getComputedStyle(document.querySelector('[data-sonner-toaster], [role=dialog]') ?? document.body).fontFamily`; it should start with the Outfit next/font family. Then open the Ask Birdy modal and check the same on `[role=dialog]`.
- [ ] **Step 6: Commit.** `git commit -m "feat(ds): Outfit + Geist Mono"`

### Task 3: Primitives

**Files:**
- Create in `src/components/ds/primitives/`: `button.jsx`, `input.jsx`, `textarea.jsx`, `select.jsx`, `checkbox.jsx`, `switch.jsx`, `label.jsx`, `badge.jsx`, `tabs.jsx`, `segmented-tabs.jsx`, `kbd.jsx`, plus `__tests__/primitives.test.jsx`
- Create: `src/components/ds/PORTED.md`, `src/components/ds/index.js`
- Sources (bytes `apps/dashboard/src/components/`): `ui/button.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/select.tsx`, `ui/checkbox.tsx`, `ui/switch.tsx`, `ui/label.tsx`, `ui/badge.tsx`, `ui/tabs.tsx`, `composed/segmented-tabs.tsx`, `ui/coss/kbd.tsx`
- Visual reference: Paper page `p-2-0` (2 · Primitives)
- Modify `package.json`: add `motion` only if `framer-motion` (already present, v12) can't do the press and thumb animations. Prefer `framer-motion`.

**Interfaces (Produces):**
- `Button({ variant = "outline", size = "md", loading, asChild, ...props })`
  - variants: `primary | outline | ghost | secondary | destructive | link`
  - sizes: `sm` (`h-control-sm`), `md` (`h-control`), `lg` (`h-control-lg`), `icon-sm`, `icon`
  - `loading` shows a spinner and sets `aria-busy`
- `Badge({ tone = "neutral", variant = "soft" })`
  - tones: `neutral | primary | success | warning | danger | info`
  - variants: `soft` (bg `-soft`, text `-ink`) | `dot` (status dot + ink text)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`: Radix underline tabs
- `SegmentedTabs({ value, onValueChange, items: [{value,label,count?}], size = "md" })`: muted track with a white control-shadow thumb; spring per Global Constraints
- `Input`, `Textarea`, `Select*`, `Checkbox`, `Switch`, `Label`: same exports and APIs as the shadcn files in `src/components/ui/`, so later swaps are import-path-only
- `Kbd({ children })`

- [ ] **Step 1: Failing tests** in `primitives.test.jsx`:
  - `Button` defaults to the outline variant, and its class includes `h-control` and `shadow-control`.
  - `size="sm"` gives `h-control-sm`; `size="lg"` gives `h-control-lg`.
  - `variant="primary"` gives `bg-primary`.
  - `loading` sets `aria-busy="true"`, disables the button, and keeps its label for screen readers.
  - `Badge tone="danger"` includes `bg-danger-soft text-danger-ink`.
  - `SegmentedTabs`: clicking an item calls `onValueChange` with its value, and the active item has `aria-selected="true"` (role `tab`).
  - `Input` focus class includes `focus-visible:shadow-control-focus`.
  - A file-scan test reads every file in `src/components/ds/**` and asserts no `/#[0-9a-fA-F]{3,8}\b/`, no `@bytes/`, no `permission`, no `nuqs`, no `@remixicon`, no `react-icons`.
- [ ] **Step 2: Run** `npx vitest run src/components/ds` and confirm it FAILs.
- [ ] **Step 3: Port each source file** TS→JS, following the spec §2 porting rules, and re-skin with Task 1 utilities. Button keeps the Bytes cva structure. Its press motion is CSS `active:translate-y-[1.5px] active:scale-[.98] transition-[transform,box-shadow] duration-[90ms] ease-press` with `motion-reduce:transform-none`. Add one row per file to `PORTED.md`. Export everything from `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm everything PASSes.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): port primitives"`

### Task 4: Surfaces

**Files:**
- Create in `src/components/ds/surfaces/`: `frame.jsx`, `surface.jsx`, `notice.jsx`, `empty-state.jsx`, `error-state.jsx`, `skeleton.jsx`, `spinner.jsx`, plus `__tests__/surfaces.test.jsx`
- Sources: `ui/frame.tsx`, `ui/card.tsx`, `composed/notice.tsx`, `ui/empty-state.tsx`, `composed/error-state.tsx`, `ui/skeleton.tsx`, `ui/spinner.tsx`
- Reference: Paper `p-3-0` (3 · Surfaces)

**Interfaces (Produces):**
- `Frame({ title, meta, actions, children, className })`: `bg-muted rounded-frame` with a header row (title 16/600, meta in muted-foreground, actions on the right) above its children.
- `Surface({ as = "div", padded = true })`: `bg-background rounded-surface shadow-surface`.
- `Notice({ tone = "info", title, children, action })`: soft background and ink text per tone.
- `EmptyState({ icon, title, description, action })`
- `ErrorState({ title = "Couldn't load this", description, onRetry })`. It replaces `portfolio/LoadError`, and its copy defaults match LoadError's current text.
- `Skeleton`
- `Spinner({ size = 16 })`

- [ ] **Step 1: Failing tests**
  - `Frame` renders its title as a heading, with `bg-muted` and `rounded-frame` on the root.
  - `Surface` has `shadow-surface`.
  - `ErrorState` calls `onRetry` on button click.
  - `Notice tone="warning"` uses `bg-warning-soft text-warning-ink` and has `role="status"`.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Port** the files and update `PORTED.md` and `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): port surfaces"`

### Task 5: Overlays

**Files:**
- Create in `src/components/ds/overlays/`: `dialog.jsx`, `confirm.jsx`, `sheet.jsx`, `popover.jsx`, `dropdown-menu.jsx`, `tooltip.jsx`, `command.jsx`, `toaster.jsx`, plus `__tests__/overlays.test.jsx`
- Sources: `ui/dialog.tsx`, `ui/danger-dialog.tsx` + `ui/confirmer.tsx`, `ui/sheet.tsx`, `ui/popover.tsx`, `ui/dropdown-menu.tsx`, `ui/tooltip.tsx` (flatten their `animate-ui/` wrappers into plain Radix + framer-motion), `ui/command.tsx`, `ui/sonner.tsx`
- Reference: Paper `p-5-0` (4 · Overlays)

**Interfaces (Produces):**
- Dialog: same export names as `src/components/ui/dialog.jsx`. Content uses `rounded-overlay shadow-overlay`, the overlay uses `bg-scrim` (from Task 1).
- `Sheet`, with sides `right | bottom`. It slides in from its edge: 320ms `ease-edge`, backdrop 200ms. Below 768px it renders as a bottom sheet.
- `confirm({ title, description, confirmLabel, tone = "danger" }) → Promise<boolean>`, plus `<ConfirmHost/>`, which is mounted once in the layout (Task 10).
- Popover, DropdownMenu, Tooltip, Command and `Toaster` keep the same export names as the `src/components/ui/` equivalents. Floating surfaces use `shadow-floating`.

- [ ] **Step 1: Failing tests**
  - Dialog content has `rounded-overlay` and `shadow-overlay` when open.
  - `confirm()` resolves `true` on the confirm click and `false` on cancel or Escape.
  - `DropdownMenuContent` has `shadow-floating`.
  - `Sheet` content has `data-side="right"` by default.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Port.** Update `PORTED.md` and `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): port overlays"`

### Task 6: Data: metrics and deltas

**Files:**
- Create in `src/components/ds/data/`: `delta.jsx`, `metric-card.jsx`, `metric-group.jsx`, `metric-tabs-chart.jsx`, `breakdown.jsx`, `bar-list.jsx`, plus `__tests__/metrics.test.jsx`
- Sources: `charts/comparison-delta.tsx`, `charts/metric-card.tsx`, `charts/metric-card-group.tsx`, `charts/board-trend-chart.tsx`, `charts/chart-tooltip.tsx`, `charts/bar-list.tsx`, `ui/chart.tsx`
- Reference: Paper `p-4-0` › "Metrics + charts · Light". Pull the JSX of the "Metric tabs + chart", "MetricCard", "MetricGroup", "Breakdown" and "Capsule bars, bar list" sections.
- Behaviour to keep: read `src/components/portfolio/MetricTabsChart.jsx`, `TrendPlot.jsx` and `DeltaPill.jsx` for their props and behaviour (line-draw animation of 800ms, 120ms tooltip), so the hubs can swap over without data changes.

**Interfaces (Produces):**
- `Delta({ value, format = "percent", invert = false, suffix })`
  - `value > 0` shows ↑, `< 0` shows ↓
  - the good direction uses `text-success-ink`, the bad one `text-danger-ink`
  - `invert` flips which direction is good
  - `value === 0 || value == null` renders neutral `text-muted-foreground` with no arrow
- `MetricCard({ label, value, delta, invert, caption, spark })`
- `MetricGroup({ title, meta, action, items: MetricCard props[] })`
- `MetricTabsChart({ metrics: [{ key, label, value, delta, invert, caption, series: [{x, current, previous}] }], value, onValueChange, formatValue, xLabel })`
  - The active tab rises into the white chart surface.
  - Recharts area chart: current is `chart-1` (solid, with a 14%→0 fill), previous is muted-foreground (dashed 4 5).
  - The x-axis is in `font-mono`.
  - It accepts the same `metrics` shape `portfolio/MetricTabsChart` uses today; if that shape differs, add an adapter in this file and document it in JSDoc.
- `Breakdown({ title, total, rows: [{ key, label, color, delta, value, share }] })`
- `BarList({ title, meta, rows: [{ label, value, icon? }] })`

- [ ] **Step 1: Failing tests**

```js
it("Delta: positive is green up", () => { render(<Delta value={12.4} />); expect(screen.getByText(/12\.4%/)).toHaveClass("text-success-ink"); expect(screen.getByText("↑")).toBeInTheDocument() })
it("Delta: inverted falling cost is green down", () => { render(<Delta value={-6.1} invert />); expect(screen.getByText(/6\.1%/)).toHaveClass("text-success-ink"); expect(screen.getByText("↓")).toBeInTheDocument() })
it("Delta: zero is neutral without arrow", () => { render(<Delta value={0} />); expect(screen.getByText(/0%/)).toHaveClass("text-muted-foreground"); expect(screen.queryByText(/[↑↓]/)).toBeNull() })
it("MetricTabsChart: tabs are a tablist; clicking selects", async () => { /* 4 metrics → 4 role=tab; click 2nd → onValueChange(key2), aria-selected */ })
it("Breakdown: shares render as tabular figures", () => { /* row value cell has class num */ })
```

- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Port and implement.** Update `PORTED.md` and `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): metrics, deltas, metric tabs chart"`

### Task 7: Data table

**Files:**
- Create in `src/components/ds/data/data-table/`: `data-table.jsx`, `toolbar.jsx`, `faceted-filter.jsx`, `pagination.jsx`, `column-header.jsx`, `view-options.jsx`, `skeleton.jsx`, `cells.jsx`, plus `__tests__/data-table.test.jsx`
- Sources: `table/data-table.tsx`, `data-table-toolbar.tsx`, `data-table-faceted-filter.tsx`, `data-table-pagination.tsx`, `data-table-column-header.tsx`, `data-table-view-options.tsx`, `data-table-skeleton.tsx`, `table/cells/*`
- Dependencies: `npm i @tanstack/react-table`. Add `@tanstack/react-virtual` only if a Birdy table exceeds 500 rows (`/contacts`); decide in Task 13.
- Reference: Paper `p-4-0` › "Table · Light" and "Table · 390", "Filters · 390"

**Interfaces (Produces):**
- `DataTable({ columns, data, loading, empty, toolbar, pageSize = 25, onRowClick, getRowId })`. Columns are TanStack `ColumnDef`s. Filter state is local `useState`; a URL is synced only when the page passes `state` / `onStateChange`, never through nuqs.
- Cells: `MoneyCell({ value, currency = "GBP" })`, `StatusCell({ tone, label })` (uses Badge dot), `TwoLineCell({ primary, secondary })`.
- At 390px, rows collapse to the stacked card layout from "Table · 390".

- [ ] **Step 1: Failing tests**
  - Renders header and rows.
  - `loading` shows the skeleton rows.
  - Empty data renders the `empty` node.
  - A faceted filter narrows rows.
  - Clicking a sortable header toggles `aria-sort`.
  - `MoneyCell` renders `£1,234.50` with class `num`.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Port.** Update `PORTED.md` and `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): data table"`

### Task 8: birdy-read and the `/_ds` showcase

**Files:**
- Create: `src/components/ds/birdy/birdy-read.jsx`, `src/components/ds/birdy/__tests__/birdy-read.test.jsx`
- Create: `src/app/_ds/page.jsx`
- Modify: `src/components/birdy/BirdyAvatar.jsx`. In `TONES`, `tint` becomes `"border-primary/20 bg-primary-soft"` and `white` becomes `"border-border bg-background"`.
- Reference: the mock `design_handoff_hubs/design_handoff_bytes_ds/hub-options.html` (option A) and Paper `p-8-0` › "Overview · Light" › "Needs you"

**Interfaces (Produces):**
- `BirdyRead({ title = "Birdy's read", findings, prompt, empty, className })`
  - `findings: [{ id, tone: "danger"|"warning"|"success"|"info"|"neutral", title, detail, action?: { label, onClick } | { label, href } }]`
  - It is a `Frame` whose header holds `<BirdyAvatar size={28}/>`, the title and a count badge (`bg-primary`, shown when `findings.length > 0`), above a `Surface` of rows.
  - Each row has a fixed 28px icon slot (tone soft background with the tone's lucide icon), the title (15/500) and detail (13, muted), and a fixed-width trailing action slot (`Button size="sm"`).
  - `prompt` renders an "Ask Birdy about this →" footer link that calls `askBirdy(prompt)` from `@/lib/ask-birdy`.
  - With no findings, it renders `empty` or the default line "Nothing needs you right now."
  - It takes at most 5 rows.

`src/app/_ds/page.jsx` calls `notFound()` when `process.env.NODE_ENV === "production"`. Otherwise it renders sections that mirror Paper Foundations, Primitives, Surfaces, Overlays (trigger buttons), Data (metric tabs chart, table) and birdy-read, using realistic Birdy data (GBP, client names from the mock).

- [ ] **Step 1: Failing tests**
  - Renders the title and the `BirdyAvatar` (query the mascot `svg` or the BirdyAvatar wrapper).
  - The count badge shows `findings.length`.
  - An action button fires `onClick`.
  - A `href` action renders a link.
  - Empty findings render "Nothing needs you right now."
  - With 7 findings, 5 rows render.
  - `prompt` click calls the mocked `askBirdy` with the prompt.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Implement** `birdy-read.jsx`, the `/_ds` page and the BirdyAvatar tones.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Visual check against Paper.** Run the dev server (preview_start `birdy-beta`, with `NEXT_PUBLIC_API_URL` set) and open `/_ds` at 1440 and 390. Screenshot each section, and screenshot the matching Paper nodes with `get_screenshot`: Foundations `1-0`, Primitives page `p-2-0` artboards, Data `53X-0` and `4GT-0`. Fix any mismatch in radius, shadow, type size or spacing.
- [ ] **Step 6: Phase gate.**
  - `npx vitest run` passes.
  - `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build` succeeds.
  - Crawl every route in the app in the browser pane (Phase 0 restyles everything through the aliases): screenshot each one at 1440. Note regressions in `docs/superpowers/plans/bytes-ds-regressions.md` (a list of route, problem and the phase that fixes it). Fix only those caused by broken tokens, such as invisible text or a missing border; layout redesign waits for its phase.
- [ ] **Step 7: Commit and open PR 1.** `git commit -m "feat(ds): birdy-read + /_ds showcase"`, then push and `gh pr create --base main --title "Bytes DS phase 0: tokens, fonts, ds kit"`.

---

## Phase 1: Shell (PR 2)

### Task 9: Shell components

**Files:**
- Create in `src/components/ds/shell/`: `nav-config.js`, `app-sidebar.jsx`, `top-bar.jsx`, `page-header.jsx`, `system-banner.jsx`, `mobile-nav-sheet.jsx`, plus `__tests__/shell.test.jsx`
- Reference: Paper `p-7-0`: "Shell · Light" `8G5-0`, "System banner · 390" `OTP-0`, "Switcher · 390 sheet" `24RE-0`. The Bytes `features/dashboard/components/` files are reading reference only (they are feature-coupled).
- Behaviour to keep, read first: `src/components/app-sidebar.jsx` (credits via `SidebarCredits`, jobs via `SidebarJobs`, logout `AlertDialog`, `useBirdy`), `src/components/page-header.jsx` and `dashboard-controls.jsx` (pages publish their title and controls into the bar through context), and `src/components/ImpersonationBar.jsx`.

**Interfaces (Produces):**
- `NAV_ITEMS` in `nav-config.js`: `[{ key, label, href, icon, badge?: () => number | null, match?: (pathname) => boolean }]`, in this order: Dashboard `/dashboard`, Clients `/clients`, Metrics `/metrics`, Contacts `/contacts`, Sales Hub `/Sales-Hub`, Campaigns `/campaigns`, Alerts `/alerts`, Dashboards `/dashboards`, Settings `/settings`. BirdyHub will later be one more entry.
- `AppSidebar({ items = NAV_ITEMS })`:
  - agency header with `BirdyAvatar size={32}` and the agency name (truncate)
  - `SegmentedTabs` Browse / Ask Birdy; Ask Birdy calls `openBirdyChat()` from `@/lib/ask-birdy`
  - search button with `Kbd ⌘K`
  - nav with the active item as a white control-shadow pill and its icon in `text-primary`
  - footer: SidebarCredits and SidebarJobs re-skinned in place, and a user menu with Logout via `confirm()`
- `TopBar({ title, actions })`:
  - breadcrumb (the title from `PageHeaderTitle` / `DashboardHeaderTitle` context)
  - Ask Birdy button with `Kbd ⌘J`
  - NotificationsDropdown, plus the current page's actions
- `PageHeader({ eyebrow, title, description, actions, period })`: 32/600 title, 16 muted description, actions on the right.
- `SystemBanner({ tone, children, action, onDismiss })`: full-width strip above the shell, soft tones per Paper.
- `MobileNavSheet`: below 768px the sidebar renders inside the ds `Sheet` (`side="left"`), and the top bar shows a menu button.

- [ ] **Step 1: Failing tests**
  - `AppSidebar` renders 9 links in `NAV_ITEMS` order.
  - With `usePathname` mocked to `/clients/abc`, Clients has `aria-current="page"`.
  - A badge of 120 renders as "99+".
  - A long agency name has the class `truncate`.
  - The Ask Birdy segment calls the mocked `openBirdyChat`.
  - `PageHeader` renders an `h1` with `text-2xl`.
  - `SystemBanner tone="danger"` has `role="status"` and calls `onDismiss`.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Implement.** Update `PORTED.md` (marked "Paper-only, no Bytes source" where that applies) and `index.js`.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(ds): shell components"`

### Task 10: Wire the shell into the layout

**Files:**
- Modify: `src/app/layout.jsx`. Replace the old header block (around lines 150-200) and `<AppSidebar/>` from `@/components/app-sidebar` with the ds shell: an `bg-muted` frame grid (sidebar 236px, then main), and the page inside `bg-background rounded-frame shadow-surface`. Mount `<ConfirmHost/>` and the ds `Toaster`.
  - Keep `hideSidebar` routes, the `ASK_BIRDY_EVENT` listener, `⌘K` (now opens the ds `command` search), `⌘J` (opens chat), `ImpersonationBar` (rendered as a `SystemBanner`), `CreditsProvider`, `DashboardControlsProvider` and `PageHeaderProvider` exactly as they behave today.
- Delete: `src/components/app-sidebar.jsx`, once nothing imports it (`grep -rn "components/app-sidebar" src` returns empty).
- Modify: `src/app/admin/layout.jsx`. Re-skin its rail and top bar with the ds shell pieces (`AppSidebar items={ADMIN_NAV}`), keeping its own nav.

- [ ] **Step 1: Failing test** `src/app/__tests__/layout-shell.test.jsx`. Render `RootLayout` with `usePathname` mocked:
  - `/dashboard` shows the `navigation` landmark and a `main` inside a `rounded-frame` element.
  - `/login` shows no `navigation` landmark.
  - Dispatching `ASK_BIRDY_EVENT` with `{ message: "hi" }` opens the chat dialog. Mock `next/dynamic` to return a stub with `role="dialog"`.
- [ ] **Step 2: Run** and confirm FAIL.
- [ ] **Step 3: Implement** the layout changes.
- [ ] **Step 4: Run** `npx vitest run` and confirm PASS.
- [ ] **Step 5: Verify in the browser.**
  - At 1440: compare `/dashboard` and `/clients` against Paper `8G5-0`.
  - At 390: sidebar sheet open and closed, compared against `24RE-0`.
  - `/admin` at 1440.
  - `/login`: no shell.
  - Open and close ⌘K, ⌘J, and the logout confirm. Check the console for no errors or hydration warnings.
  - Screenshot each.
- [ ] **Step 6: Commit and open PR 2.** `git commit -m "feat(ds): new app shell"` and `gh pr create --title "Bytes DS phase 1: shell"`.

---

## Page migration procedure (used by every task from 11 on)

Every page task runs these steps in order. The page's own notes say what is specific to it.

- [ ] **Mock gate.** If the page has a widget with no Paper equivalent (listed in its notes), build `design_handoff_hubs/design_handoff_bytes_ds/<route>-options.html` with 2–3 options, open it in the browser pane, and stop until the user picks one.
- [ ] **Baseline.** Screenshot the route at 1440 and 390 *before* the change, into `docs/superpowers/plans/screens/<route>/before-*.png` (screenshots are kept on disk, not committed). Note the data states: loaded, empty, error.
- [ ] **Failing tests.** Update or add the page's `__tests__`: it renders `PageHeader` with the expected title, and its key widgets render from ds. Find them by `data-ds` (Global Constraints). Then run it and confirm it fails.
- [ ] **Swap.** Change imports from `components/portfolio/*` and the replaced `components/ui/*` to `components/ds`, following the spec §2 mapping table. Replace hand-rolled markup with ds components. Remove `pd-*` classes, `text-[Npx]` arbitrary sizes and raw hex. Keep data hooks and copy unchanged.
- [ ] **States.** Loading uses `Skeleton` or `MetricTabsChart loading`, empty uses `EmptyState`, and an API failure uses `ErrorState onRetry`. Force each one: stop the backend for error, and use a test agency with no clients for empty.
- [ ] **Audit grep**, which must print nothing:

  ```bash
  grep -nE "pd-|--pd-|#[0-9a-fA-F]{3,8}\b|components/portfolio|text-\[[0-9.]+px\]" <page files>
  ```

  Brand and channel logo colours (Meta `#1877F2`, GHL and similar) are the one exception. Move them to `src/lib/brand-colors.js` and import them from there.
- [ ] **Tests.** `npx vitest run` passes.
- [ ] **Visual verify.** With the dev server and local API, screenshot 1440 and 390 for loaded, empty and error, and compare against the named Paper reference. Check the console for no errors.
- [ ] **Commit.** `git commit -m "feat(ds): migrate <route>"`

At the end of each phase: run `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build`, crawl that phase's routes once more, delete any `components/portfolio/*` or `components/ui/*` file with zero importers (`grep -rln "<name>" src`), delete the `--pd-*` aliases with zero users, then commit and open the phase PR.

---

## Phase 2: Hubs (PR 3)

### Task 11: `/dashboard`
Files: `src/app/dashboard/page.jsx`, `presentation.js`, `useDashboardData.js`, `usePortfolioData.js`, `src/components/dashboard-controls.jsx`.
- Spec: the mock, option A. Paper reference: `p-8-0` › `9F5-0`.
- Layout:
  - `PageHeader` with a greeting plus a one-sentence summary from `presentation.js`, and the period (`SegmentedTabs` Today / 7 days / 30 days, wired to the existing dashboard-controls period).
  - `MetricTabsChart`: Leads, Booked calls, Cost per lead (`invert`), Ad spend.
  - Grid 1.35fr / 1fr with a 40px gap: `Breakdown` "By client" on the left, `BirdyRead` on the right.
- `BirdyRead` findings come from the generators that feed `BirdyBriefing` and `SuggestionCard` today. Add an adapter `toFindings(briefing, suggestions)` in `presentation.js`, with a unit test covering tone mapping, `action` from a suggestion's "Do it", and a cap of 5.
- Retire `InsightCard` from this page.

### Task 12: `/clients`, then `/clients/[id]` and `/clients/[id]/tracking`
- `/clients`: a `DataTable` (client, status via `StatusCell`, leads, CPL via `MoneyCell` and `Delta invert`, spend) inside a plain section. Paper reference: `4GT-0`.
- `/clients/[id]`: `PageHeader` with back crumb, underline `Tabs` (replacing `UnderlineTabs`), `MetricTabsChart`, `BirdyRead` (client-scoped), and `SidePanel` → `Sheet`, or an adjacent panel per spec.
- **Mock gate:** `FunnelStepper` has no Paper equivalent. Mock it re-skinned in 2–3 forms (a chip row, a segmented bar, a capsule bar list).
- Tracking: `Frame` + `Surface` blocks; code snippets in `font-mono`.

### Task 13: `/metrics`
`MetricGroup` and `MetricCard` grids, plus `Breakdown`. Replace `MetricPicker` (ui) with `DropdownMenu` + `Checkbox` items. Paper reference: `53X-0`.

### Task 14: `/contacts`, `/Sales-Hub`, `/campaigns`
- `/contacts`: `DataTable`, with the virtualisation decision from Task 7. Paper reference: `4GT-0`.
- `/Sales-Hub` (SalesHubShell): call-history pattern from Paper `p-8-0` › `9TM-0` and `p-J-0` (19 · Call details).
- `/campaigns` (MarketingContent): `DataTable` plus `MetricTabsChart`.
- **Mock gate** for any channel-specific widget with no Paper equivalent. List those widgets during the Baseline step.

### Task 15: `/alerts` (1536 lines)
- First split the page by responsibility into `src/app/alerts/` files: `AlertsList.jsx`, `AlertRuleEditor.jsx`, `AlertDetail.jsx`. Do it as a separate behaviour-preserving commit, with tests passing both before and after the split.
- Then migrate: list as `DataTable`, editor as `Sheet` + ds form primitives, status via `Badge dot`, `confirm()` for delete. The trash icon stays icon-only, per the style guide.
- Also screenshot `/dashboards/[id]` here as an early dashkit check (Review Focus 5).

## Phase 3: Conversation (PR 4)

### Task 16: `/ask-birdy` and the chat modal
Files: `src/app/ask-birdy/page.jsx`, `src/components/chat/*` (ChatConversation, BirdyChatModal).
- Paper reference: `p-6-0` (6 · Conversation). Pull its JSX for bubbles, composer and suggestion chips.
- The mascot appears only via `BirdyAvatar`. Inline recharts charts use `--color-chart-*`.
- Test: the composer submits on Enter and not on Shift+Enter, matching current behaviour.

## Phase 4: Custom dashboards (PR 5)

### Task 17: `/dashboards`, `/dashboards/[id]`
- The page chrome moves to ds (PdCard → `Frame` / `Surface`, PageHeader).
- dashkit itself is themed only through `--dk-*` (Task 1).
- Verify: every widget type in the dashkit registry renders on a test dashboard. Screenshot it, with no empty `--dk-*` values (`getComputedStyle(el).getPropertyValue('--dk-accent')` is non-empty).
- Keep `src/app/dashboards/__tests__/workspace.test.jsx` green.

## Phase 5: Settings and money (PR 6)

### Task 18: `/settings`, `/billing` (+ 3 legal pages), `/credits`
- Paper reference: `p-B-0` (11 · Settings) and `p-8-0` › `A7I-0`.
- Split `/settings` (1325 lines) the same way as `/alerts` first, into one file per settings section.
- Settings layout: Paper settings nav plus sections as `Frame`s, with forms using ds primitives.
- The legal pages' 125 legacy `gray-*` / `purple-*` classes are replaced with tokens; prose uses `text-body` at 16/1.6.
- Billing warnings move to `SystemBanner`.

## Phase 6: Onboarding (PR 7)

### Task 19: `/onboarding` (2069 lines)
- Split it by step first: `ReviewStep`, `BillingStep`, `ReportDesigner`, and so on, one file per step.
- Paper reference: `p-D-0` (13 · Onboarding).
- **Mock gate:** `ReportDesigner` has no Paper equivalent.
- The onboarding mascot images stay inside `BirdyAvatar`.

## Phase 7: Auth and install (PR 8)

### Task 20: `/`, `/login`, `/register`, `/install/[siteId]`
- No shell. A centred `Surface` on `bg-muted`, with ds `Input`, `Button lg` and `Label`.
- **Mock gate** for `/` (the landing / Ask Birdy entry): no Paper equivalent.
- Login error states use `Notice tone="danger"`.

## Phase 8: Admin (PR 9)

### Task 21: `/admin`, `/admin/agencies`, `/admin/ai-queries`, `/admin/credits`, `/admin/promo-codes`, `/admin/stats`
- Tables become `DataTable`; stats become `MetricGroup`; the shell is the admin variant from Task 10.
- **Mock gate:** the admin tables have no Paper equivalent beyond "Table". Show one mock covering all six.

## Phase 9: Leftovers and cleanup (PR 10)

### Task 22: Cleanup
- Migrate `/changelog`, `src/app/error.jsx`, `global-error.jsx`, `not-found.jsx` and `template.jsx` (`ErrorState`, `EmptyState`).
- Delete `src/components/portfolio/` (whole folder, including `tones.js` and its tests) and every `src/components/ui/*` with zero importers.
- Delete these from `globals.css`: all `--pd-*`, `--color-pd-*`, `--shadow-pd-*`, `--font-pd-*`, `--font-display`, `--purple-*`/`--gray-*` scales, and the shadcn aliases with zero users. Also delete `pdFontClass`.
- Update the existing tests that assert pd aliases so they now assert the aliases are absent.
- Delete `src/app/dashboard/README.md`'s stale `fonts.js` reference, and the Poppins comment in `onboarding/parts.jsx`.
- Rewrite `design_handoff_hubs/Birdy Style Guide.md` to describe this system: the tokens table, the `ds/` component list, birdy-read, the rules from Global Constraints.
- **Final audit**, which must print nothing:

  ```bash
  grep -rnE "pd-|--pd-|components/portfolio|font-pd|text-\[[0-9.]+px\]" src
  grep -rnE "#[0-9a-fA-F]{3,8}\b" src --include=*.jsx --include=*.js | grep -v "src/lib/brand-colors.js" | grep -v __tests__
  ```

- **Final crawl:** all 30 routes at 1440 and 390 in the browser pane, with screenshots, console clean, `npx vitest run` and `npm run build` green.

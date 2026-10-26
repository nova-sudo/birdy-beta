# Birdy Style Guide

How Birdy's frontend looks and how to build it. The system is the design system
in `src/components/ds/`, ported from Bytes main (`d5bed4a4dd`) with Birdy's
violet primary. Every value is defined once as a token in `src/app/globals.css`
(`@theme`). If a value is not in this guide or in that file, it is not in the
system: ask before inventing one.

Live reference: the `/_ds` route (source in `src/app/%5Fds/`) renders every
component. `src/components/ds/PORTED.md` records where each file came from,
what was stripped and what changed.

## The rules

1. **Tokens only.** Colours, radii, shadows, control heights and type sizes come
   from the token utilities below. No raw hex, no `purple-*` / `gray-*`, no
   `text-[13px]`, no arbitrary radii or shadows in a page or component.
2. **Brand hex lives in one file.** Third-party marks (Slack, Meta), the Slack
   preview replica, the shader colour for Silk and the mascot's artwork palette
   are in `src/lib/brand-colors.js`. Nothing else may contain a hex colour
   outside `globals.css`.
3. **Light mode only.** There is no dark theme and no `dark:` classes.
4. **Motion goes through `@/components/motion`** (`Reveal`, `Stagger`,
   `StaggerItem`, `Pop`, `CountUp`). Reduced motion is respected: the root
   layout wraps the app in `<MotionConfig reducedMotion="user">`, and CSS
   animations use `motion-safe:` / `motion-reduce:`.
5. **Every ds component's root carries `data-ds="<file-name>"`.** Tests and
   crawls find components by that marker.
6. **Hook and context modules start with `"use client"`.** A server route that
   imports the barrel breaks otherwise; a hygiene test guards it.
7. **Import from the barrel:** `import { Button, Frame } from "@/components/ds"`.
8. **The mascot only appears via `BirdyAvatar`** (see below).
9. **New UI gets HTML mocks first.** Build two or three HTML options, let the
   owner pick one, then port the pick into ds components.

## Tokens

Utilities are named after the `@theme` variable: `--color-primary` gives
`bg-primary`, `text-primary`, `border-primary`.

### Colours

| Token | Value | Use |
|---|---|---|
| `background` | #FFFFFF | Surfaces, page card, inputs, popovers |
| `foreground` | #0A0A0A | Headings, primary text |
| `body` | #404040 | Running text |
| `muted-foreground` | #737373 | Secondary text, icons |
| `ink-secondary` | #3F3F46 | Quiet icons and inactive figures |
| `border` | #E5E5E5 | Hairlines that must be a border |
| `divider` | #F0F0F1 | Seams between cells and rows |
| `primary` | #5B3FD6 | Brand violet: actions, links, focus |
| `primary-hover` / `-held` / `-edge` | #6A50DC / #5338CC / #4A30BC | Primary button states and its 1px ring |
| `primary-soft`, `primary-ink` | #EFECFB, #4A2FB5 | Tinted backgrounds and the text on them |
| `primary-foreground` | #FFFFFF | Text on primary |
| `danger` / `warning` / `success` / `info` | #EF4444 / #F59E0B / #16A34A / #3B82F6 | Status fills and icons |
| `{status}-soft` | #FEF2F2 / #FFFBEB / #F0FDF4 / #EFF6FF | Status backgrounds |
| `{status}-ink` | #991B1B / #92400E / #166534 / #1E40AF | Status text on a soft background |
| `purple`, `muted` (`subdued`), `neutral` tones | `-soft` / `-ink` pairs | Badge tones beside the four statuses |
| `delta-good` / `delta-bad` (`-ink`, `-soft`) | #16A34A / #DC2626 | A change coloured by whether it is good, not by its direction |
| `destructive` (`-hover`, `-held`, `-edge`) | #DC2626 | Destructive buttons, a step stronger than danger |
| `chart-1` .. `chart-8` | primary, #3B82F6, #14B8A6, #F59E0B, #A3A3A3, #2F6FD0, #CF4A3A, #8F5FC2 | Series colours, in order, never repeated |
| `scrim` | #0A0A0A at 40% | Dialog and sheet backdrop |

### Greys: canvas, frame, muted

Three greys do three jobs. Don't swap them.

| Token | Value | Use |
|---|---|---|
| `frame` | #F7F7F8 | The app canvas (sidebar, top bar, the area round the page card) and every Frame shell: the grey around a white surface. Dashkit's `--dk-bg` and `--dk-table-head` map here too |
| `muted` | #F4F4F5 | Menu-row highlight, neutral fills, drag-over |
| `rail` / `rail-frame` | #F4F4F5 / #EBEBED | Tab tracks on a white surface / on the frame |
| `raised` | #FFFFFF | Controls, fields and the active nav row |
| `ghost-hover` / `ghost-held` | #F2F2F2 / #EAEAEA | Ghost buttons |
| `row-hover` / `row-selected` / `row-child` | #FAFAFA / #F5F5F6 / muted at 40% | Table rows |
| `skeleton` / `skeleton-shine` | #F0F0F1 / #F8F8F9 | Loading sweep |

### Type

The root is the browser's 16px, so `1rem` is 16. Fonts: **Outfit**
(`font-sans`, everything) and **Geist Mono** (`font-mono`, code and readouts),
loaded in `src/lib/fonts.js` and set on `<html>`. Use `tabular-nums` (or the
`num` utility) on any figure that must line up.

| Utility | Size / line | Typical use |
|---|---|---|
| `text-xs` | 13 / 16 | Captions, deltas, table meta, badges |
| `text-sm` | 14 | Small controls, labels, table cells, helper text |
| `text-base` | 16 | Body, controls, Frame titles, inputs |
| `text-lg` | 18 | Dialog and sheet titles |
| `text-xl` | 20 | Admin section headings |
| `text-2xl` | 24 / 32 | Metric and funnel values, auth headings |
| `text-figure` | 28 / 34 | MetricTabsChart figures |
| `text-title-sm` / `text-title` | 26 / 32, 32 / 36 | Page titles (PageHeader uses 26 on a phone, 32 from md); use these for a title outside PageHeader |

### Radius

| Utility | Value | Use |
|---|---|---|
| `rounded-badge` | 7px | Badges and count pills |
| `rounded-control-sm` | 10px | `sm` controls, icon chips |
| `rounded-control` | 12px | `md` buttons and inputs, menu rows |
| `rounded-control-lg` | 14px | `lg` buttons and inputs |
| `rounded-surface` | 12px | Toasts and small cards |
| `rounded-frame` | 16px | Frames, surfaces, the page card |
| `rounded-overlay` | 20px | Dialog frames and sheets |
| `rounded-bezel` | 27px | The glass bezel round a dialog |

`rounded-sm` .. `rounded-3xl` are offsets from `--radius` (10px). Avoid them in
new code; the named steps say what the shape is for.

### Shadows, heights, easing

Frames, surfaces, tables and cards are flat (a 1px ring). Only controls lift and
only overlays float.

| Utility | Use |
|---|---|
| `shadow-frame` | The hairline ring round a Frame |
| `shadow-surface` | The ring round a white surface or the page card |
| `shadow-control` (`-hover`, `-held`) | Resting, hovered and pressed outline buttons and fields |
| `shadow-primary`, `shadow-destructive` | Filled buttons |
| `shadow-focus` / `shadow-control-focus` | Focus rings (buttons / fields) |
| `shadow-control-invalid`, `shadow-field-error` | Invalid field |
| `shadow-floating` | Popovers, menus, the command palette |
| `shadow-overlay-frame`, `shadow-bezel` | Dialog frame and its bezel |
| `shadow-sheet` (`-left`, `-bottom`, `-top`) | A sheet on its edge |
| `shadow-toast`, `shadow-tooltip` | Toasts, tooltips |
| `h-control-sm` / `h-control` / `h-control-lg` | 32 / 40 / 48 control heights |
| `ease-press` | Press and hover transitions |
| `ease-edge` | Panels sliding from an edge |
| `ease-thumb` | The tab thumb's slide |

## Components (`src/components/ds/`)

### Buttons and fields
- **`Button`**: variants `primary` (filled violet), `outline` (default: white,
  1px ring, lifts on hover), `secondary` (alias of `outline`, the Bytes name),
  `ghost`, `destructive`, `dashed`, `link`. Sizes `sm` 32, `md` 40, `lg` 48,
  `icon-sm`, `icon`, `icon-lg`. `loading` keeps the width; `asChild` for links.
- **`Input`**, **`Textarea`**, **`Select`**: one field look from
  `fieldVariants` with `size` sm / md / lg (32 / 40 / 48). Use `size="lg"` for
  auth and onboarding fields, not a height override.
- **`SearchInput`**: search icon on the right, swapped for a "Clear search"
  button once there is a query; `debounceMs={0}` for a local filter. It is the
  one way to clear a search: don't add a second Clear button beside it or in
  the empty state.
- **`Checkbox`**, **`Switch`**, **`Label`**.

### Tabs
- **`Tabs`** (`TabsList`, `TabsTrigger`, `TabsContent`): `variant="framed"`
  (default: a rail with a sliding white thumb), `underline`, or `chips`.
  `surface` says what the rail sits on (`surface` / `frame`); `size`, `fill`;
  triggers take a `count` pill and `attention`.
- **`SegmentedTabs`**: the framed Tabs as data (`items`, `value`,
  `onValueChange`), for filters and scope switches.

### Badge and StateBadge
- **`Badge`**: `tone` success / warning / danger / info / purple / primary /
  muted / neutral on its soft fill and ink, `size` md (28) or sm (24), `icon`.
  Birdy's `variant="dot"` is a status dot and ink with no fill.
- **`StateBadge state="paused"`**: tone, icon and label from `BADGE_STATES`
  (Bytes' full table, plus `queued`, `refunded`, `selected`, `sending` in
  info). `badgeStateOf("In Stock")` normalises a raw status word; unknown words
  fall back to `unknown`.

### Frame and MetricGroup
- **`Frame`**: the panel everything is grouped in. A grey `frame` shell with a
  header strip (`title`, `description`, `leading`, `action` / `actions`,
  `href`), a white surface flush to its sides, and an optional `footer` strip.
  `padded` for forms and prose; `toolbar` replaces the title with a 56 tool
  row. A table or list inside a Frame draws only its rows.
- **`Surface`**: a free-standing white card (`rounded-frame shadow-surface`)
  for the rare thing that isn't in a Frame.
- **`MetricGroup`**: a titled row of figures on the Frame. Each item has a
  label (with an info tooltip), value, `Delta` and caption; columns follow the
  container (1 to 4 across, 5 as 2/3/5, 6 as 2/3, 7-8 as 2/4).
  `MetricCard` is one cell on its own.
- **`MetricTabsChart`**: hub trend; metric tabs that rise into the chart panel.
- **`Delta`**: `change`, `format` (percent / points / count), `goodWhen` (up /
  down / neither) colours it by whether it is good. Zero, null or a change that
  rounds to 0 reads "No change" in the neutral look.

### FunnelGroup
A funnel shaped like a MetricGroup (mock A, "Stage cells"): one cell per stage
with a 32 icon chip in the stage's tone, label, 24 value, `Delta` and a 13px
caption, and a pill on the seam into each stage with the step conversion
(hidden on narrow widths, and where a stage isn't a narrowing of the one
before). The frame's footer takes the diagnosis `Notice`. Pass `empty` for a
period with no data: the frame stays with a muted line and no diagnosis. Used
on `/dashboard`.

### DataTable
- **`DataTable`**: owns its TanStack table. A Frame-like shell (`rounded-frame
  bg-frame shadow-frame`) with the toolbar, heads on the grey, a white body and
  a pagination footer strip; bare inside a Frame. Rows 60 (`dense` 52). Loading
  keeps the heads with skeleton rows; empty shows under the heads. Below 576 of
  table width it folds to a label/value list. `onColumnReorder` +
  `lockedColumnIds` for drag-to-reorder, `stickyFirstColumn`, `getSubRows`.
- **Toolbar pieces**: `DataTableToolbar`, `SearchInput`, one
  `DataTableFilterButton` for every facet, `DataTableFacetedFilter` for a
  standalone filter, `DataTableViewOptions`, `DataTablePagination`,
  `DataTableColumnHeader`, `DataTableSkeleton`.
- **Cells**: `MoneyCell`, `StatusCell` (a small soft Badge), `TwoLineCell`.

### Shell and PageHeader
- **Canvas pattern**: the app sits on the `frame` canvas. `AppSidebar` (256, or
  the 56 rail when collapsed) on the left; on the right a borderless, unfilled
  52 **`TopBar`** on the canvas, then **`PageCard`**: the white page card with
  an 8px gutter right and bottom (sheet-like on a phone) and `main` holding the
  page in the 1360 column (16 side gutters on a phone, 40 from md, and 36 above
  the content from md).
  `data-main-fill` on a page root holds it to main's height (panes that scroll
  themselves); `data-main-bleed` also drops the gutters.
- **`TopBar`**: sidebar toggle, the title the page published, then the page's
  controls, Ask Birdy (⌘J) and the bell. `minimal` (the admin console) keeps
  only the menu button, title and `actions`.
- **AdminShell** (`src/components/admin/AdminShell.jsx`) is the same pattern:
  minimal AppSidebar, minimal TopBar ("Admin", Internal badge, Back to Birdy),
  PageCard.
- **`MobileNavSheet`**: the sidebar in a left sheet below md.
- **`PageHeader`**: the page's h1 (26 / 32), description, optional eyebrow,
  back button, `period` and `actions`. One per page, first in the card.
- **`SystemBanner`**, **`SidebarCredits`**, **`SidebarJobs`**,
  **`CommandSearch`** (⌘K).

### Dialog and Sheet
- **`Dialog`**: a glass bezel round a grey frame holding a header strip
  (`DialogHeader`: title 18/600, description 14), a flush white `DialogBody`
  that scrolls, and a `DialogFooter` strip with actions right-aligned. Sizes
  sm 400 (confirm), md 520 (short form, default), lg 720, xl 880, 2xl 1120.
- **`Sheet`**: the same strips (`SheetHeader`, `SheetBody`, `SheetFooter`) on a
  panel attached to its edge; right sheets are 440 (`lg` 720) and become bottom
  sheets below 768.
- Loose children between the strips are gathered into the body. Strips are
  recognised on direct children only, by component or by a `data-slot` prop
  ending `-header` / `-footer` / `-body`. A `<form>` wrapping the strips (so
  Enter submits) works as the frame's only child.
- **`confirm({ title, description, tone })`** returns a promise; `<ConfirmHost/>`
  renders it. Destructive deletes use `tone="danger"`.

### Menus and lists (`list-variants`)
`Popover`, `DropdownMenu`, `Select` content and `Command` share one list
recipe from `overlays/list-variants.js`: `LIST_SURFACE` (r14 white,
`shadow-floating`, 6 padding), `LIST_MOTION` (200 in, 140 out, a 4px slide),
`listItemVariants` rows sm 32 / md 40 / lg, `LIST_LABEL`, `LIST_SEPARATOR`
(edge to edge), `LIST_SEARCH`, `LIST_EMPTY`. A menu's `size` reaches its rows
through `ListSizeContext`. `Tooltip` is an ink pill; `Toaster` / `toast` are
Sonner on tokens.

### Other surfaces
`Notice` (an inline callout in a status tone, optional icon), `EmptyState`
(icon tile, title, description, action), `ErrorState` (with retry),
`Skeleton` (a sweep under motion-safe), `Spinner`, `Breakdown`, `BarList`,
`FunnelBar`, `Sparkline`, `ProgressBar`.

### birdy/
`BirdyRead`: Birdy's short list of findings on the Frame shell, up to five rows
with an icon chip, detail, action and optional dismiss, plus an "Ask Birdy
about this" footer link.

## birdy-read and BirdyAvatar

`BirdyRead` is the standard "what needs your attention" block. Hubs pair it with
`MetricTabsChart` at the top of the page. Findings are data-backed: each row
states a number or a fact from the account, never generic advice.

```jsx
<BirdyRead
  findings={[{ id: "cpl", tone: "warning", title: "CPL up 18%", detail: "Meta, last 7 days",
               action: { label: "Review", href: "/campaigns" } }]}
  prompt="Why did CPL rise this week?"
/>
```

The mascot is shown only through `BirdyAvatar` (`src/components/birdy/BirdyAvatar.jsx`):
Birdy seated in a round frame, cropped by the circle. Never render a bare
`<Birdy>`. `tone` is `tint` (primary-soft frame) or `white` (for surfaces that
are already tinted); `size` is the frame diameter in px.

## Building a page

1. Page title with `PageHeader`; content in `Frame`s (tables in `DataTable`,
   figures in `MetricGroup`).
2. Data from the API, formatted before it reaches ds components (they take
   strings and numbers, not raw API shapes).
3. Loading with `Skeleton` or the component's `loading`, failures with
   `ErrorState`, empty with `EmptyState` (or the component's `empty`). Every
   list and chart has all three. Missing data never reads as healthy.
4. Entry motion with `Reveal` or `Stagger`; numbers with `CountUp` where the
   figure is the point of the page.
5. Verify in the browser at desktop and 375px, not just in tests.

## What was removed

The previous `pd-*` Portfolio Dashboard layer, the purple and gray scales, the
shadcn alias variables and `components/portfolio` no longer exist. A test
(`src/app/__tests__/tokens.test.js`) asserts the legacy variables stay absent.
The shadcn `sidebar`, `sheet`, `separator`, `tooltip`, `button`, `dialog`,
`input`, `label` and `textarea` wrappers, `use-mobile`, `@radix-ui/react-separator`
and the root `SidebarProvider` are gone. Three shadcn-era files remain in
`src/components/ui/` because callers still import them: `alert-dialog`
(alerts), `skeleton` (dashboards, page skeleton) and `MetricPicker`. They are
retokened and should not gain new users; use the ds equivalents.

# Birdy Style Guide

How Birdy's frontend looks and how to build it. The system is the Bytes-derived
design system in `src/components/ds/`, with every value defined once as a token
in `src/app/globals.css` (`@theme`). If a value is not in this guide, it is not
in the system: ask before inventing one.

Live reference: the `/_ds` route (source in `src/app/%5Fds/`) renders every component. `src/components/ds/PORTED.md`
records where each file came from and what changed.

## The rules

1. **Tokens only.** Colours, radii, shadows, control heights and type sizes come
   from the token utilities below. No raw hex, no `purple-*` / `gray-*`, no
   `text-[13px]`, no arbitrary radii or shadows in a page or component.
2. **Brand hex lives in one file.** Third-party marks (Slack, Meta), the Slack
   preview replica, the shader colour for Silk and the mascot's artwork palette
   are in `src/lib/brand-colors.js`. Nothing else may contain a hex colour.
3. **Light mode only.** There is no dark theme and no `dark:` classes.
4. **Motion goes through `@/components/motion`** (`Reveal`, `Stagger`,
   `StaggerItem`, `Pop`, `CountUp`). Reduced motion is respected: the root layout wraps the app in
   `<MotionConfig reducedMotion="user">`, and CSS animations use `motion-reduce:`.
5. **Every ds component's root carries `data-ds="<file-name>"`.** Tests and
   crawls find components by that marker.
6. **Import from the barrel:** `import { Button, Surface } from "@/components/ds"`.
7. **The mascot only appears via `BirdyAvatar`** (see below).
8. **New UI gets HTML mocks first.** Build two or three HTML options, let the
   owner pick one, then port the pick into ds components.

## Tokens

Utilities are named after the `@theme` variable: `--color-primary` gives
`bg-primary`, `text-primary`, `border-primary`.

### Colours

| Token | Value | Use |
|---|---|---|
| `background` | #FFFFFF | Surfaces, inputs, popovers |
| `foreground` | #0A0A0A | Headings, primary text |
| `body` | #404040 | Running text |
| `muted` | #F7F7F7 | Page canvas, frames, hover fills |
| `muted-foreground` | #737373 | Secondary text, icons |
| `border` | #E5E5E5 | Hairlines, dividers |
| `primary` | #5B3FD6 | Brand violet: actions, links, focus |
| `primary-soft` | #EFECFB | Tinted backgrounds for primary |
| `primary-foreground` | #FFFFFF | Text on primary |
| `danger` / `warning` / `success` / `info` | #EF4444 / #F59E0B / #16A34A / #3B82F6 | Status fills and icons |
| `{status}-soft` | #FEF2F2 / #FFFBEB / #F0FDF4 / #EFF6FF | Status backgrounds |
| `{status}-ink` | #991B1B / #92400E / #166534 / #1E40AF | Status text on a soft background |
| `neutral-soft`, `neutral-ink` | #F4F4F5, #52525B | Neutral badges and chips |
| `chart-1` .. `chart-8` | primary, #3B82F6, #14B8A6, #F59E0B, #A3A3A3, #2F6FD0, #CF4A3A, #8F5FC2 | Series colours, in order, never repeated |
| `scrim` | #0A0A0A at 18% | Dialog and sheet backdrop |

### Type

Fonts: **Outfit** (`font-sans`, everything) and **Geist Mono** (`font-mono`,
code and readouts). Both are loaded in `src/lib/fonts.js` and set on `<html>`.
Use the `num` utility on any figure that must line up in columns (tabular
figures).

| Utility | Size | Typical use |
|---|---|---|
| `text-xs` | 13px | Captions, table meta, badges |
| `text-sm` | 14px | Controls, table cells, helper text |
| `text-base` | 16px | Body, card titles, inputs |
| `text-lg` | 18px | Dialog titles, section titles |
| `text-xl` | 20px | Large section headings |
| `text-2xl` | 32px | Page titles |
| `text-figure` | 28px / 34px | Metric values |

### Radius

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 6px | Small chips, kbd |
| `rounded-control` | 12px | Buttons, inputs, menus items |
| `rounded-surface` | 12px | Cards and popovers |
| `rounded-frame` | 16px | Muted frames that hold surfaces |
| `rounded-overlay` | 20px | Dialogs and sheets |

`rounded-md` .. `rounded-3xl` are offsets from `--radius` (12px). Avoid them in
new code; the named steps above say what the shape is for.

### Shadows, heights, easing

| Utility | Use |
|---|---|
| `shadow-control` | Resting inputs and buttons |
| `shadow-control-focus` | Focus ring on any control |
| `shadow-control-invalid` | Invalid input |
| `shadow-surface` | Cards |
| `shadow-floating` | Popovers, menus, tooltips, toasts |
| `shadow-overlay` | Dialogs and sheets |
| `h-control-sm` / `h-control` / `h-control-lg` | 32 / 40 / 48px control heights |
| `ease-press` | Press and hover transitions |
| `ease-edge` | Panels sliding from an edge |

## Components (`src/components/ds/`)

### primitives/
- `Button`, `buttonVariants`: variants primary, outline (default), ghost, secondary, destructive, link; sizes sm/md/lg, icon-sm, icon; `loading`; `asChild` for links.
- `Input`, `Textarea`: control height, `shadow-control`, invalid state in danger.
- `Select` (and parts): Radix select on tokens.
- `Checkbox`, `Switch`, `Label`: form controls, primary when on.
- `Badge`: `tone` (neutral/primary/success/warning/danger/info) by `variant` (soft/dot).
- `Tabs`: underline tabs. `SegmentedTabs`: muted track with a sliding white thumb.
- `Kbd`, `KbdGroup`: keyboard hints.

### surfaces/
- `Frame`: muted panel with a title/meta/actions header; holds `Surface` cards.
- `Surface`: white card with `shadow-surface`.
- `Notice`: inline callout in a status tone.
- `EmptyState`: icon, title (`titleAs` for headings), description, action.
- `ErrorState`: load-failure block with retry.
- `Skeleton`, `Spinner`: loading placeholders.

### data/
- `MetricCard`, `MetricGroup`: headline figure with delta and sparkline; titled row of them.
- `MetricTabsChart`: metric tabs that rise into a chart panel (hub trend).
- `Delta`: signed change with arrow, `invert` for cost metrics.
- `Breakdown`, `BarList`, `FunnelBar`: share-of-total, ranked bars, segmented funnel.
- `Sparkline`, `ProgressBar`: tiny trend line; threshold-aware progress.
- `DataTable` family (`data-table/`): `DataTable`, `DataTableToolbar`, `DataTableFacetedFilter`, `DataTablePagination`, `DataTableColumnHeader`, `DataTableViewOptions`, `DataTableSkeleton`, and the cells `MoneyCell`, `StatusCell`, `TwoLineCell`.

### overlays/
- `Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`: Radix wrappers on overlay tokens.
- `Command`, `CommandDialog`: cmdk palette.
- `confirm()` and `ConfirmHost`: imperative confirm dialog.
- `Toaster`, `toast`: Sonner on tokens.

### shell/
- `AppSidebar`, `MobileNavSheet`, `NAV_ITEMS`: navigation rail and its mobile sheet.
- `TopBar`, `PageHeader`: global header and in-page heading block.
- `SystemBanner`: full-width system-state strip.
- `SidebarCredits`, `SidebarJobs`: sidebar footer blocks.
- `CommandSearch`, `useModKey`: the Cmd/Ctrl+K palette and its key label.

### birdy/
- `BirdyRead`: Birdy's short list of findings, up to five rows with an icon chip, detail, action and optional dismiss, plus an "Ask Birdy about this" link.

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

1. Page title with `PageHeader`; content in `Frame` plus `Surface`.
2. Data from the API, formatted before it reaches ds components (they take
   strings and numbers, not raw API shapes).
3. Loading with `Skeleton`/`DataTableSkeleton`, failures with `ErrorState`,
   empty with `EmptyState`. Every list and chart has all three.
4. Entry motion with `Reveal` or `Stagger`; numbers with `CountUp` where the
   figure is the point of the page.
5. Verify in the browser at desktop and 375px, not just in tests.

## What was removed

The previous `pd-*` Portfolio Dashboard layer, the purple and gray scales, the
shadcn alias variables and `components/portfolio` no longer exist. A test
(`src/app/__tests__/tokens.test.js`) asserts the legacy variables stay absent.
The shadcn `sidebar`, `sheet`, `separator` and `tooltip` wrappers and the root
`SidebarProvider` are gone, along with its Ctrl/Cmd+B shortcut and
`sidebar_state` cookie. A few shadcn-era files remain in `src/components/ui/`
only because the dashboards feature still imports them (button, dialog,
alert-dialog, input, label, textarea, skeleton, MetricPicker). They are
retokened and should not gain new users; use the ds equivalents.

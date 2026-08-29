# Handoff: Birdy — Client Hub (variant 1b)

## Overview

The Client Hub is the portfolio-level table view inside **Birdy**, an AI-powered support and operations layer for service-based local lead-gen agencies. It lists every connected client with health, status, lead volume, spend and ROI metrics side by side, so an agency owner can scan the whole book of business and spot who needs attention.

Variant **1b** is the table-first version: the chart + Birdy Insights row used in variant 1a is removed entirely. The page goes straight from the header to the status tabs and the client table.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established component library, styling approach, and data layer. If no environment exists yet, choose the most appropriate framework for the project and implement there.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state and data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction behaviour are final and should be matched closely. All values are documented under **Design Tokens**, and `Birdy Style Guide.md` in this bundle carries the full product-wide design system for anything this screen doesn't cover.

---

## Screen: Client Hub (1b)

**File:** `Client Hub.dc.html`

**Frame:** 1600 × 1040 px, background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px, `overflow: hidden`.

### Top-level layout

Horizontal flex:

1. **Icon rail** — `flex: 0 0 68px`, `#fff`, right border 1px `#ECECF2`.
2. **Main column** — `flex: 1`, vertical flex: header bar (64px), then one scrolling content area (padding `22px 24px`).

There is no right rail and no chart card on this variant — the content area goes directly from the tabs/controls row into the table.

### 1. Icon rail

- **Logo** — Birdy mascot, 38 × 38, radius 10px, 1px `#E3E3EC` border, `object-fit: cover`, `margin-bottom: 14px`. Asset: `uploads/birdy-mascot.png`.
- **Nav items** — 44 × 44, radius 12px, centred 20 × 20 stroke icons. Active: `#F1EEFC` bg, `#6B4EE6` icon (Clients tab is active here). Inactive: transparent, `#9A9AAB`.
- **Rail footer**, in order: settings → green support icon (with an online dot) → 28 × 1px `#ECECF2` divider → red logout icon → 28 × 1px divider → `Beta 1.7` pill.

### 2. Header bar

Height 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 16px`.

- **Title block** — `Client Hub` Poppins 700 19px `#1F1B33`; sub `Health and performance across every connected client` Inter 400 12px `#9A9AAB`.
- **Ask Birdy field** (centred, `flex: 1`, `max-width: 420px`) — height 38px, `#F4F4F8`, 1px `#ECECF2`, radius 10px, sparkle icon, placeholder `Ask Birdy about your marketing data…`, trailing `⌘K` chip.
- **Right cluster** (`margin-left: auto`, `gap: 10px`): date-range dropdown (clock icon, options Today / Last 7 days / Last 30 days / This quarter, menu right-aligned) · notification bell with a red count badge `9` · avatar (gradient `#7B5FE6 → #6B4EE6`).

### 3. Status tabs + table controls

`margin-bottom: 14px`, `gap: 12px`.

- **Tabs** (left) — container `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`; items `gap: 7px`, padding `7px 14px`, radius 8px, Poppins 600 13px, each with a count badge. Selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`; unselected `#6B6480` on transparent.
- Order and counts: **Active** `36` (default) · **Healthy** `26` · **Warning** `8` · **Critical** `2` · **Inactive** `5` · **All Clients** `41`.
- **Right controls** — search field (magnifier icon, placeholder `Search clients…`, 200px) · `Columns` chip (sliders icon + chevron) · a filled purple "+" button (add client), 38 × 38, radius 10px, `#6B4EE6`.

### 4. Client table

Card `#fff`, 1px `#ECECF2`, radius 16px, `overflow: hidden`, inner region `overflow-x: auto` with `min-width: 1420px`.

- **Header row** — padding `13px 22px`, bottom border 1px `#ECECF2`, background `#FAFAFC`, Inter 700 11.5px `#9A9AAB`, `letter-spacing: .03em`.
- **Body rows** — padding `12px 22px`, bottom border 1px `#F5F5F8`. Rows **zebra-stripe** alternating `#fff` and `#FCFCFD`.

Thirteen columns, in order, with flex weights:

| # | Column | Weight | Notes |
|---|---|---|---|
| 1 | *(row select)* | `0 0 26px` | Checkbox — 15 × 15, 1.5px border (`#CFCFDA` header, `#DFDFE8` rows), radius 4px, unchecked |
| 2 | `BUSINESS NAME` | 1.9 (`min-width: 190px`) | Inter 600 13.5px `#1F1B33`, ellipsis, `padding-right: 12px` |
| 3 | `STATUS` | 0.8 | Pill: 6px leading dot + label, Inter 600 11px, padding `3px 9px`, radius 6px. **Active** `#25A55F`/`#EDF8F1`, **Inactive** presumably a neutral pair (see *Data needed*) |
| 4 | `HEALTH` | 0.85 | Pill, same sizing, no dot. **Healthy** `#25A55F`/`#EDF8F1` · **Warning** `#E0920A`/`#FDF6EC` · **Critical** `#E5484D`/`#FEF1F1` |
| 5 | `GHL LEADS` | 0.8 | Inter 400 13.5px `#5A5A6E` |
| 6 | `META LEADS` | 0.85 | Inter 400 13.5px `#5A5A6E` |
| 7 | `BOOKINGS` | 0.8 | Inter 400 13.5px `#5A5A6E` |
| 8 | `CPL` | 0.7 | Inter 500 13.5px `#1F1B33` normally |
| 9 | `AD SPEND ↓` | 1 | **Active sort column** — header label plus a `↓` arrow in `#1F1B33`; cells Inter 500 13.5px `#1F1B33` |
| 10 | `CPA` | 0.8 | Inter 400 13.5px `#5A5A6E` |
| 11 | `REVENUE` | 1 | Inter 500 13.5px `#1F1B33` |
| 12 | `ROAS` | 0.7 | Inter 500 13.5px, colour varies (see below) |
| 13 | `ANSWER %` | 0.8 | Inter 400 13.5px `#5A5A6E` |

Sample data (17 rows, all `Active` status this period): Cameron's Aesthetics (Warning), Glow Lab MedSpa, Amy's Lashes & Brows, Silhouettes Beauty, Revive Med Aesthetics, Luxe Skin Clinic (Warning), Radiance Beauty Studio, Elite Face & Body, Pure Glow Aesthetics, Velvet Touch Spa, Diamond Skin Care (Warning), Serenity MedSpa, Contour Aesthetics (Critical), Thee Vision Studio (Inactive status, Critical health, all-zero metrics) — the rest are Healthy. Full figures (GHL leads, Meta leads, bookings, CPL, spend, CPA, revenue, ROAS, answer %) are in the source `raw` array.

**CPL colour rule:** not overridden per row in the current data (`cplColor` isn't set by the `mk()` helper in this sample) — confirm with design/backend whether CPL should redden past a threshold, matching the CPL-colouring pattern used on Marketing Hub and Client Detail.

**ROAS colour rule:** likewise not explicitly overridden in the sample rows — check whether ROAS should colour green above a target multiple (e.g. ≥ 4x) and red below, consistent with other Birdy screens' "good vs bad" metric colouring.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| **Date range dropdown** | Click toggles the menu. Selecting updates the range label; in production this should filter every metric on the page to that window. |
| **Dropdown option clicks** | Must `stopPropagation` — otherwise the click bubbles to the trigger's toggle and reopens the menu immediately. |
| **Status tabs** | Filter the table to that status/health bucket; counts come from the same query. "All Clients" shows everyone. |
| **Row select checkbox** | Selects clients for bulk actions. The header checkbox should select all visible rows; a selection should reveal a bulk action bar. Not wired in the prototype. |
| **Column sort** | Sorted by AD SPEND descending by default, shown by the `↓` beside the header label. Clicking a header should re-sort and move the indicator. Not wired. |
| **Row click** | Should open the Client Detail screen for that client. Not wired. |
| **Search / Columns / "+"** | Not wired — search should filter rows live by name; Columns opens a column-visibility menu; "+" opens the add-client / onboarding flow. |
| **Menus** | Should also close on outside click and `Escape` in production. |

## State Management

```
tab:        'Active' | 'Healthy' | 'Warning' | 'Critical' | 'Inactive' | 'All Clients'  // default 'Active'
range:      'Today' | 'Last 7 days' | 'Last 30 days' | 'This quarter'   // default 'Last 30 days'
rangeMenu:  boolean
```

**Data the real implementation needs:**
- Per-client aggregates for the selected range — status, health classification, GHL leads, Meta leads, bookings, CPL, ad spend, CPA, revenue, ROAS, answer rate.
- Status/health bucket counts for the six tabs.
- The health classification logic (what makes a client Healthy vs Warning vs Critical) and the status logic (Active vs Inactive) — currently static sample data, needs a real rule engine.
- Confirmation of the CPL/ROAS good-vs-bad colour thresholds referenced above.

## Design Tokens

Inherits the full Birdy palette, type scale, spacing, radius and shadow tokens from `Birdy Style Guide.md`. Screen-specific usage:

| Token | Hex | Use |
|---|---|---|
| Primary | `#6B4EE6` | Brand, active nav, selected tab, "+" button |
| Primary tint | `#F1EEFC` | Active nav bg |
| Ink | `#1F1B33` | Headings, primary values, sort arrow |
| Body | `#5A5A6E` | Secondary table cells, control labels |
| Muted | `#6B6480` | Inactive tab text |
| Faint | `#9A9AAB` | Meta text, table headers, inactive icons |
| Divider soft | `#F5F5F8` | Table row borders |
| Divider | `#F1F1F5` | Segmented tab bg |
| Field | `#F4F4F8` | Ask Birdy field, bell button |
| Border | `#ECECF2` | Cards, controls |
| Border strong | `#E3E3EC` | Frame border, mascot border |
| Table head | `#FAFAFC` | Table header row |
| Row zebra | `#FCFCFD` | Alternate table row |
| Success | `#25A55F` / bg `#EDF8F1` | Active status, Healthy pill |
| Danger | `#E5484D` / bg `#FEF1F1` | Critical pill, logout icon, notification badge |
| Warning | `#E0920A` / bg `#FDF6EC` | Warning pill |
| Placeholder | `#CFCFDA` / `#DFDFE8` | Unchecked checkboxes |

**Typography** — Poppins 700 page title, 13px 600 tab labels; Inter 400/500/600 for table content, controls and meta. Full scale in the style guide.

**Motion** — none specific to this screen beyond the shared dropdown/menu conventions.

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38 × 38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, 24 × 24 viewBox, Feather/Lucide-style, stroke-width 2. Substitute the codebase's existing icon library.
- **Fonts** — Poppins and Inter via Google Fonts.

## Files

- **`Client Hub.dc.html`** — variant 1b, extracted as a standalone page. **This is the reference to build from.**
- **`Client Hub Options (all variants).dc.html`** — the exploration whiteboard: 1a (chart + Birdy Insights + six KPI tiles above the table) and 1b (this table-first variant). Useful for context; not a build target.
- **`Birdy Style Guide.md`** — the product-wide design system for anything this screen doesn't define itself.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

**Sibling screens:** Client Hub shares its shell, header, and table conventions with **Sales Hub**, **Marketing Hub**, and **Lead Hub** — if those are being built in the same codebase, extract the shell, dropdown, tab strip, and table as shared components.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Client Hub.dc.html` — opening straight from the filesystem may block the local script and image.

# Handoff: Birdy — Metrics Hub

## Overview

A workspace-level admin screen for **Birdy** listing every metric available across the platform — where it comes from, which dashboards use it, and controls to show/hide standard metrics or edit/duplicate/delete custom formulas.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour, not production code to copy directly. Recreate this design in the target codebase's existing environment (React, Vue, etc.) using its established component library, styling approach, and data layer.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state/data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing and interaction behaviour are final. `Birdy Style Guide.md` in this bundle carries the full product-wide design system for shared chrome (rail, header, Ask Birdy bar) this screen inherits.

---

## Screen: Metrics Hub

**File:** `Metrics Hub.dc.html`

**Frame:** 1600 × 1000 px, background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px.

### Layout

Standard Birdy shell — icon rail (68px) + main column: header bar (64px) → scrolling content (padding `22px 24px`) containing a tab strip + search/add row, a data table, and pagination.

### Header bar

Title `Metrics Hub` (Poppins 700 19px `#1F1B33`) with subtitle `Every metric powering your dashboards and formulas` sits directly in the header, next to the Ask Birdy search field, notification bell and avatar — same pattern as every other Birdy hub page.

### Tab strip + toolbar

Segmented control (`#F1F1F5` track, `#fff`/shadow active pill), tabs in order:

1. **All Metrics**
2. **GoHighLevel Metrics** (tab label shown as **"GHL Metrics"** — shortened for the tab only; the underlying source name stays "GoHighLevel Metrics" everywhere else, e.g. row source badges)
3. **Meta Metrics**
4. **Sales Metrics**
5. **Birdy Metrics**
6. **Tag Metrics**
7. **Custom Formulas**

To the right: a search input (`Search metrics…`) and a purple "add metric" (+) button. No filter icon on this screen.

### Table

Columns: **METRIC NAME** (flex 1) · **NOTES** (flex 1.4, shows `–` when empty) · **SOURCE** (fixed 200px, centered pill badge with brand-coloured icon) · a controls column (fixed 160px, centered) whose header reads **SHOW / HIDE** on every source tab or **CONTROLS** on Custom Formulas.

Row padding `12px 22px` (matches the ~47px row height used on Lead Hub and other hub tables in this system — kept intentionally lower than a first draft that used 14px padding + 32px icon buttons, which read as too thick).

**Row controls, two variants:**
- **Standard/source rows** (GHL, Meta, Sales, Birdy, Tag): a 26×26 eye icon (toggles visible/hidden — swaps to eye-off when hidden) + a 26×26 pencil icon (edit), both plain icon buttons (1px `#ECECF2` border, 8px radius).
- **Custom Formula rows**: a pencil icon button (edit, purple), a duplicate icon button, and a trash icon button — same 26×26 sizing as the standard-row icons for visual consistency.

**Source badge colours:**

| Source | Text | Background | Border |
|---|---|---|---|
| Meta Ads | `#3B7DD6` | `#EAF1FD` | `#D6E6FA` |
| GoHighLevel | `#25A55F` | `#EDF8F1` | `#D5EEDF` |
| Sales | `#B4530A` | `#FDF1E7` | `#F5DDC0` |
| Birdy | `#6B4EE6` | `#F1EEFC` | `#E3DAFB` |
| Tags | `#C93B8C` | `#FCEDF6` | `#F5D6EA` |
| Custom Formula | `#6B4EE6` | `#F1EEFC` | `#E3DAFB` |

### Pagination

Centered below the table: `‹ Previous` · page numbers (active page gets `#fff` bg + shadow, matching tab-active styling) · an ellipsis when the current page is not near the end · last page number · `Next ›`. In this prototype it's a simple numeric state (no real data paging), 20 total pages hardcoded — wire to your actual metrics list/page size.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| **Tab click** | Filters the table to that source's metrics (or all, or custom formulas). |
| **Eye icon (standard rows)** | Toggles that metric's visibility flag; icon swaps eye ↔ eye-off. Should persist to the metric's `visible`/`enabled` flag server-side. |
| **Pencil icon (standard rows)** | Should open an edit view for that standard metric (e.g. rename/label override) — not wired in this prototype. |
| **Pencil / duplicate / trash (custom formula rows)** | Should open the formula editor, clone the formula as a new row, and delete (with confirm) respectively — not wired in this prototype. |
| **Search field** | Should filter the currently active tab's rows by metric name — not wired in this prototype. |
| **+ button** | Should open a "new custom formula" flow. |
| **Pagination** | Functional locally (updates active page state); needs to be wired to real paged data. |

## State Management

```
tab:    'All Metrics' | 'GoHighLevel Metrics' | 'Meta Metrics' | 'Sales Metrics'
      | 'Birdy Metrics' | 'Tag Metrics' | 'Custom Formulas'   // default 'All Metrics'
hidden: { [metricName]: boolean }   // per-metric show/hide flag, standard metrics only
page:   number                       // 1-20 in this prototype
```

**Data the real implementation needs:**
- A metrics catalogue per source (GHL, Meta, Sales, Birdy, Tags) with name, visibility flag, and which dashboards reference it.
- Custom formulas: name, optional note/description, formula definition, dashboard usage — plus edit/duplicate/delete endpoints.
- Search/filter across the active tab's metric set.
- Real pagination (page size, total count) once metric lists are data-driven rather than the ~15-25 hardcoded sample rows here.

## Design Tokens

Inherits the shared Birdy palette, type scale, spacing and radius tokens from `Birdy Style Guide.md`. Screen-specific:

- **Card/section title**: Poppins 600 16px `#1F1B33` (n/a on this screen — title lives in the header bar).
- **Table header labels**: Inter 700 11.5px, letter-spacing 0.03em, `#9A9AAB`, uppercase, on `#FAFAFC`.
- **Metric name**: Inter 600 13.5px `#1F1B33`.
- **Notes column**: Inter 400 12.5px `#8A8A9A`.
- **Source badge**: Inter 600 12px, pill (999px radius), 1px border — see colour table above.

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38 × 38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, 24×24 viewBox (scaled to context), Feather/Lucide-style, stroke-width 2.
- **Fonts** — Poppins and Inter via Google Fonts.

## Files

- **`Metrics Hub.dc.html`** — the design, extracted as a standalone page. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system referenced throughout.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Metrics Hub.dc.html` — opening straight from the filesystem may block the local script and image.

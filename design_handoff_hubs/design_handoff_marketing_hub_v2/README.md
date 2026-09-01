# Handoff: Birdy — Marketing Hub v2

## Overview

The finalized **Marketing Hub** page for Birdy — campaign performance across all connected Meta ad accounts, with an integrated view-builder ("Columns" menu) and, on the **Ads** tab specifically, a table/gallery toggle with fully reorderable, shared column ordering and per-ad active/inactive status.

This supersedes the earlier Marketing Hub build: same overall page shell (chart, Birdy Insights, KPI tiles, tab strip) but with the Columns menu upgraded to the finalized saved-views experience, and new Ads-tab-only functionality (gallery view, drag-to-reorder metrics, status toggle).

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour, not production code to copy directly. Recreate this design in the target codebase's existing environment (React, Vue, etc.) using its established component library, styling approach, and data layer.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state/data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing and interaction behaviour are final and should be matched closely. `Birdy Style Guide.md` in this bundle carries the full product-wide design system for anything not covered below.

---

## Screen: Marketing Hub v2

**File:** `Marketing Hub v2.dc.html`

**Frame:** 1600 × 1040px, `#F7F7FB` background, 1px `#E3E3EC` border, 16px radius.

### Layout

Icon rail (68px) → main column: header (64px) → scrollable content (`padding: 22px 24px`):
1. Chart card (flex 1.65) + Birdy Insights card & 6 KPI tiles (flex 0.85), side by side.
2. Tab strip (Campaigns / Ad Sets / Ads / Leads) + right-aligned controls row.
3. One of: legacy table (non-Ads tabs), Ads-tab table, or Ads-tab gallery grid.

### 1. Chart card

Title + subtitle, a 4-way metric switch (Ad spend / Leads / CPL / Impressions) top-right, big total + delta pill, animated SVG line+area chart with hoverable data points showing a tooltip (value + month/year). Re-draws (fresh stroke animation) each time the metric switches.

### 2. Birdy Insights + KPI tiles

Purple gradient insight card with an AI-written recommendation sentence and an "Ask Birdy about this" link. Below it, a 2×3 grid of compact KPI tiles (icon chip, big number, label, up/down delta pill): Active campaigns, Total ad spend, Total leads, Average CPL, Impressions, Average CTR.

### 3. Tab strip + controls row

Segmented tab control: **Campaigns** (default) / **Ad Sets** / **Ads** / **Leads**. To the right:
- **Table/Gallery view switch** — two icon buttons, visible **only on the Ads tab**.
- Campaign search field (styled only in this build — not wired to filter).
- **Columns** button opening the view-builder dropdown (see below).

### 4. Columns / view-builder dropdown

480×560px popover, split rail (160px) + content pane — identical to the finalized Marketing Hub Columns component:
- **Saved Views** list — click anywhere on a row to select; hover-only pencil (rename inline) and trash (delete with confirm) appear **only when that row is both selected and hovered**; "Default" is protected (no rename/delete). Whole row clickable.
- **Metric Filter** list (All/Meta/GHL/Tags/Custom) — same row styling, single-select, no edit.
- Footer: **Save New View** (outlined) always visible; **Update View** (solid purple, with a momentary "Updated ✓" flash) shown only when an existing non-Default view is selected.
- Right pane: select-all checkbox row, scrollable metric checklist (checkbox + label + coloured source badge), search field pinned at the bottom.

*(Full interaction spec for this dropdown is documented in the separate "Marketing Hub Columns menu" handoff — this page reuses it verbatim.)*

### 5. Legacy table (Campaigns / Ad Sets / Leads tabs)

Fixed-column table: checkbox · STATUS (toggle) · NAME · SPEND · CPL · RESULTS · IMPRESSIONS · REACH · CLICKS · CTR · SOCIAL SPEND. Not affected by the Ads-tab features below.

### 6. Ads tab — table view

Same visual style as the legacy table, but:
- **STATUS** is a fixed, non-draggable first column with a working on/off toggle per row.
- **NAME** is a fixed second column.
- All remaining columns (Revenue, ROAS, Spend, Results, CPL, Impressions, Reach, Clicks, CTR, Social Spend) are **draggable headers** — drag one to reorder it. A dashed purple line appears on the column you're currently hovering over while dragging, showing exactly where it will land.
- Column visibility still respects the Columns-menu checkboxes (Spend/Results/CPL/Impressions/Clicks/Social Spend are togglable there; Revenue/ROAS/Reach/CTR are always shown).

### 7. Ads tab — gallery view

4-column card grid. Each card:
- Grey placeholder thumbnail (190px) with a centred play icon — swap for the real creative thumbnail/video poster in production.
- Card body: **Ad Name** (label above, truncates with `…` + native tooltip on overflow — never wraps) and **Status** toggle, side by side on one fixed header row, separated from the metrics by a divider.
- Below that: the **same reorderable metric list** as the table's columns (Revenue, ROAS, Spend, Results, CPL, Impressions, Reach, Clicks, CTR, Social Spend), one per row, each individually draggable.

### Shared column order (table ⟷ gallery)

**Critical behaviour:** table column order and gallery metric-row order are driven by **one shared state array** (`cardMetricOrder`). Dragging "ROAS" below "Revenue" in the gallery instantly reorders the table's ROAS column to match, and vice versa. Drag state (`dragLabel`/`dragOverLabel`) is scoped per-card in the gallery (`dragCardIdx`) so the drop-target indicator only highlights the card actually being interacted with, not all cards at once.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| Chart metric switch | Re-animates the line/area chart with new values. |
| Chart point hover | Shows a tooltip with the exact value and month/year. |
| Tab click | Switches the row dataset; "Ads" swaps to ad-creative names instead of campaign names and reveals the table/gallery switch. |
| Table/Gallery switch (Ads only) | Toggles between the two Ads-tab layouts described above. |
| Columns button | Opens/closes the view-builder popover (click again to close). |
| Drag a table column header or gallery metric row | Reorders that metric across **both** views; a dashed purple line shows the live drop target, scoped to the single card/table being dragged in. |
| Status toggle (table or gallery) | Flips that row's active/inactive state; persisted per-tab, per-row-index in `activeToggles`. |
| Column checkboxes (Columns menu) | Show/hide Spend, Results, CPL, Impressions, Clicks, Social Spend in both the Ads table and gallery (Revenue/ROAS/Reach/CTR always show). |

## State Management

```
tab: 'Campaigns' | 'Ad Sets' | 'Ads' | 'Leads'
metric: 'spend' | 'leads' | 'cpl' | 'impressions'   // chart series
adsView: 'table' | 'gallery'                         // Ads-tab layout
cardMetricOrder: string[]                            // shared drag order, both views
dragLabel / dragOverLabel / dragCardIdx              // live drag state
activeToggles: { [`active_${tab}_${rowIndex}`]: boolean }  // per-row status overrides
checks: { [metricLabel]: boolean }                   // Columns-menu visibility
view / savedList / recentList / source / searchValue // Columns-menu view-builder state (see Columns handoff)
```

**Data the real implementation needs:**
- Real campaign/ad-set/ad/lead datasets per tab, replacing the mocked `rawCampaigns`/`rawAds` arrays (this build derives Revenue/ROAS deterministically from spend for demo purposes only — replace with real revenue attribution).
- Real ad creative thumbnails/video posters for the gallery view.
- Persisting `cardMetricOrder`, `activeToggles`, and saved views server-side per user/workspace.
- Wiring the campaign/ad search field (currently decorative).

## Design Tokens

Inherits the full Birdy palette/type scale from `Birdy Style Guide.md`. Page-specific:
- **Chart line/fill**: `#6B4EE6`, area fill fades to transparent.
- **KPI tile icon chips**: purple `#F1EEFC`/`#6B4EE6`, green `#EDF8F1`/`#25A55F`, blue `#EAF1FD`/`#3B7DD6`, orange `#FDF1E7`/`#B4530A` — rotate per tile.
- **Status toggle**: on = `#6B4EE6` fill + knob right; off = `#DFDFE8` fill + knob left.
- **Drop-target indicator**: `2px dashed #6B4EE6`, straight edges (no border-radius) — top border on gallery rows, left border on table headers.
- **CPL colour coding**: red `#E5484D` for underperforming rows, else default text colour.

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38×38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, Feather/Lucide-style, stroke-width 2.
- **Fonts** — Poppins (headings/buttons) and Inter (body) via Google Fonts.

## Files

- **`Marketing Hub v2.dc.html`** — the design, ready to open standalone. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Marketing Hub v2.dc.html` — opening straight from the filesystem may block the local script and image.

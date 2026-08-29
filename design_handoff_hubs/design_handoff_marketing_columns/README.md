# Handoff: Birdy — Marketing Hub "Columns" Menu

## Overview

The finalized **Columns** control for Marketing Hub's campaign table — lets a user save/switch between named column configurations ("views"), filter which metric source a view pulls from, and toggle individual columns on/off. This is the winning concept ("5C" — split rail of saved/recent views + a customise panel) from a three-way exploration; the other two directions were dropped.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour, not production code to copy directly. Recreate this design in the target codebase's existing environment (React, Vue, etc.) using its established component library, styling approach, and data layer.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state/data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing and interaction behaviour are final. `Birdy Style Guide.md` in this bundle carries the full product-wide design system for the surrounding chrome (rail, header, chart, table) this screen inherits — only the Columns menu itself is new.

---

## Component: the Columns menu

**File:** `Marketing Hub - Columns.dc.html` (Marketing Hub page with the menu pre-opened so it's visible without a click)

Opened via the "Columns" button in the table toolbar (next to the campaign search field). A 480×560px popover, positioned bottom-right of the button, split into two panes:

### Left rail (160px, `#FAFAFC` background)

- **SAVED VIEWS** — a vertical list, each row the full width of the rail is clickable to select that view (not just the label). Selected row: `#F1EEFC` background, `#6B4EE6` left border (3px) and text. Unselected rows get a light grey (`#F1F1F5`) hover background — **except** the selected row, which does not show a hover state (it's already highlighted).
  - **"Default"** is a protected view: never shows rename/delete affordances and its handlers no-op even if triggered.
  - Every other row shows a pencil (rename) and trash (delete) icon, both hidden by default, fading in only when that row is **both selected AND hovered** — not on hover alone, and not just because it's selected.
  - **Rename**: clicking the pencil swaps the row for an inline text input (pre-filled with the current name) + a small check (confirm, purple) and X (cancel, outlined) button. Confirming updates the name everywhere it appears (saved list, recent list, active selection if it was selected).
  - **Delete**: clicking the trash swaps the row for a confirmation panel (`#FEF6F6` background): `Delete "{name}"?` + full-width red **Delete** / outlined **Cancel** buttons. Deleting removes it from saved + recent lists; if it was the active view, falls back to the first remaining saved view (or "Default").
- **METRIC FILTER** — a second vertical list directly below, visually identical to Saved Views (same row/hover treatment) but **read-only** — no rename or delete, just single-select. Options: All, Meta, GHL, Tags, Custom. This filters which columns the right pane's list shows.
- **Footer** (pinned to the rail's bottom via `margin-top:auto`):
  - **"Save New View"** — outlined white button, always visible.
  - **"Update View"** — solid purple button, visible only when the active view is an existing saved view *and* isn't "Default" (since Default can't be overwritten). Clicking it saves in place with a brief green "Updated" + check-icon confirmation flash (~1.2s), no dialog.
  - Clicking **Save New View** replaces both buttons with a full-width name input + 50/50 **Save** / **Cancel** buttons; the Save button is disabled-looking (`#C9BEF3`) until text is entered.

### Right pane (flex:1)

- **Header row**: a checkbox (functions as "select all" — click anywhere on the row toggles every visible column; reflects "all checked" state), **METRIC NAME**, **SOURCE** column labels. Border-bottom separates it from the scrollable list below.
- **Scrollable column list**: each row — checkbox, metric label, and a source badge (pill, colour-coded per source: Meta blue, GHL green, Custom purple) right-aligned under the SOURCE header. Checking/unchecking is per-metric.
- **Search field**, fixed at the **bottom** of the pane (not the top) with a top border separating it from the list — filters the visible column list by name as you type, combined with whatever Metric Filter source is active.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| Click a Saved View row (anywhere on it) | Switches the active view. |
| Hover a Saved View row | Non-selected: light grey background. Selected: no hover background change (pencil/trash fade in instead). |
| Click pencil (non-Default view, must be selected+hovered to be visible) | Row becomes an inline rename field with confirm/cancel. |
| Click trash (same visibility rule) | Row becomes a delete confirmation with Delete/Cancel. |
| Click a Metric Filter row | Filters the right pane's column list to that source; single-select, no edit affordances. |
| Type in the bottom search field | Filters the (already source-filtered) column list by name, live. |
| Click a column checkbox | Toggles that column on/off for the active view (not yet persisted until Update/Save). |
| Click the header checkbox | Selects/deselects every currently-visible (filtered) column. |
| Click "Update View" | Persists current column selection to the active view in place; shows a momentary "Updated ✓" state. Hidden for "Default" or for a not-yet-saved state. |
| Click "Save New View" | Opens a name field; confirming adds a new saved view (or renames-in-place if invoked via the pencil's flow) and makes it active. |

## State Management

```
cView:        string                 // active view name, default 'Default'
cChecks:      { [metricLabel]: boolean }   // per-metric visibility overrides
cSource:      string                 // active Metric Filter, default 'All'
cSearchValue: string                 // free-text filter on metric name
cSavedList:   string[]               // saved view names, seeded ['Default','Meta Only','Compact']
cRecentList:  string[]               // most-recently-used view names (unused in the final 5C footer, kept for future use)
cEditTarget / cEditValue             // which view is mid-rename, and its draft text
cDeleteTarget                        // which view is mid-delete-confirm
cHoverView / cHoverSource            // which row is currently hovered (drives the conditional hover/pencil/trash logic)
cSaving / cNewName                   // "Save New View" compose state
```

**Data the real implementation needs:**
- Per-workspace (or per-user) saved column views: name + the set of visible columns + which source they were scoped to.
- The actual column/metric catalogue per source (Meta, GHL, Tags, Custom) — this prototype hardcodes ~12 sample columns; wire to the real Meta/GHL/Custom-formula metric registry (see the separate Metrics Hub handoff for that data model).
- Persisting "Update View" and "Save New View" server-side; the prototype only mutates local state.
- Deciding what "Default" actually means for a real user (all columns visible? a fixed baseline set?) since it's protected from edits.

## Design Tokens

Inherits the full Birdy palette/type scale from `Birdy Style Guide.md`. Menu-specific:

- **Popover**: `#fff`, 1px `#ECECF2` border, 14px radius, shadow `0 14px 34px -12px rgba(30,25,60,.28)`.
- **Section labels** (SAVED VIEWS / METRIC FILTER / METRIC NAME / SOURCE): Inter 700 10px, letter-spacing 0.04em, `#9A9AAB`, uppercase.
- **Selected row**: bg `#F1EEFC`, left border `#6B4EE6` (3px), text `#6B4EE6` weight 700.
- **Hover row** (non-selected only): bg `#F1F1F5`.
- **Delete confirm surface**: bg `#FEF6F6`, Delete button `#E5484D`.
- **Primary action** (Update View / Save button): `#6B4EE6`, disabled state `#C9BEF3`.
- **Source badges**: Meta `#3B7DD6`/`#EAF1FD`; GHL `#25A55F`/`#EDF8F1`; Custom `#6B4EE6`/`#F1EEFC`.

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38×38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, Feather/Lucide-style, stroke-width 2, scaled per context.
- **Fonts** — Poppins (headings/buttons) and Inter (body) via Google Fonts.

## Files

- **`Marketing Hub - Columns.dc.html`** — the design, extracted as a standalone page with the Columns menu pre-opened. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system for the surrounding page chrome.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Marketing Hub - Columns.dc.html` — opening straight from the filesystem may block the local script and image.

# Handoff: Birdy — Client Detail (variant 1d)

## Overview

Client Detail is the single-client workspace inside **Birdy**, an AI-powered support and operations layer for service-based local lead-gen agencies. It's where a media buyer or agency owner drills into one client to see performance against monthly goals, diagnose exactly where the funnel is breaking, chat with Birdy about that client's data, review Marketing/Call Centre/Leads detail, and manage settings.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established component library, styling approach, and data layer. If no environment exists yet, choose the most appropriate framework for the project and implement there.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state and data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction behaviour are final and should be matched closely. All values are documented under **Design Tokens**, and `Birdy Style Guide.md` in this bundle carries the full product-wide design system for anything this screen doesn't cover.

---

## Screen: Client Detail (1d)

**File:** `Client Detail.dc.html`

**Frame:** 1600 × 1180 px, `position: relative` (hosts the settings modal), background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px, `overflow: hidden`.

### Top-level layout

Horizontal flex: **icon rail** (`flex: 0 0 68px`) → **main column** (`flex: 1`): a client header bar (64px), a page-tab bar, then one scrolling content area (padding `20px 24px`) that swaps between four panels. A **settings modal** overlays the whole frame when open.

### 1. Icon rail

Same as every Birdy screen — mascot logo, nav icons (Clients active here), a green "support" icon with an online dot, a divider, a red logout icon, another divider, and the `Beta 1.7` pill. See `Birdy Style Guide.md` for exact metrics.

### 2. Client header bar

Height 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 14px`.

- **Back button** — 32 × 32, radius 9px, `#F4F4F8`, chevron-left icon (returns to Client Hub).
- **Client identity** — `Aura` Poppins 700 19px `#1F1B33` next to a **health pill** (6px dot + label, Inter 600 11px, padding `3px 9px`, radius 6px — `Healthy` is `#25A55F`/`#EDF8F1`; use `#E0920A`/`#FDF6EC` for Warning and `#E5484D`/`#FEF1F1` for Critical). Sub-line: `Emma T. · client since Mar 2025` (Inter 400 12px `#9A9AAB`).
- **Right cluster** (`margin-left: auto`) — date-range dropdown (Today / Last 7 days / **Last 30 days** default / This quarter) and a settings gear button (38 × 38, `#F4F4F8`) that opens the settings modal.

### 3. Page tabs

Padding `12px 26px 0`, `gap: 24px`, bottom border 1px `#ECECF2`. Five tabs, each with a 14–16px leading icon: **Overview** (grid, default) · **Ask Birdy** (sparkle) · **Marketing** (megaphone) · **Call Centre** (phone) · **Leads** (user-check). Selected tab: Poppins 700 13.5px `#1F1B33` with a 2px `#6B4EE6` bottom border; unselected: Poppins 500 13.5px `#6B6480`, transparent border.

**Content switching:** exactly one of four panels shows at a time — Overview, Ask Birdy, or a shared Marketing/Call Centre/Leads table panel (that panel's chart metrics, KPI tiles, sub-tabs and table columns change based on which of the three parent tabs is active).

### 4. Overview panel

#### 4a. Goals strip
Single card, `#fff`, 1px `#ECECF2`, radius 16px, `margin-bottom: 14px`. `display: flex; align-items: stretch`, 5 equal cells, each padding `16px 18px` with a right divider (last cell has none). Cell anatomy: 32 × 32 radius 9px icon chip, then a value block — Poppins 700 18px value + `/ target` (Inter 10.5px `#9A9AAB`), then a second row with the label (Inter 11px `#8A8A9A`, ellipsis) and a state pill (Inter 700 10px, padding `2px 7px`, radius 5px — e.g. `On track` green, `Behind` amber/red).

Five goals: **Revenue**, **Monthly closes**, **Cost per lead**, **Close rate**, **Number of leads** — each with a live value, a target, and a state pill. No progress bar — deliberately removed since a bar doesn't read sensibly for ratio-style metrics like CPL or close rate.

#### 4b. Chart + History book + Diagnostics engine row
`display: flex; gap: 18px; align-items: flex-start`. Two columns:

- **Left column** (`flex: 1`, vertical stack, `gap: 18px`):
  - **Trend chart card** — identical pattern to Sales/Marketing/Lead Hub: title + subtitle, a metric segmented control (4 tabs), a big total + delta, then the SVG line/area chart with hover tooltips. See the Style Guide's *Line chart* component spec for the geometry rule and the 800ms redraw animation. Gradient id in this file: `cdFill_1d`.
  - **History book + Diagnostics engine grid** — `display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 18px`:
    - **History book** (left cell) — `#fff` card, padding `20px 22px`, flex column. Header: icon + title. **Scrollable entry list** (`max-height: 330px`, `overflow-y: auto`) — each entry is its own bordered card (1px `#ECECF2`, radius 10px, padding `12px 13px`) with a 26px circular kind-icon, a kind tag pill + `who · when` meta, and the note body. Footer: a pinned "Add a note about {client}…" input row with a purple send button.
    - **Diagnostics engine** (right cell) — `#fff` card, `overflow: hidden`, flex column, **no header timestamp badge** (removed — didn't add value). Body: a **vertical funnel list with a connecting spine** — a 2px `#F1F1F5` line at `left: 15px` running the list's height, and exactly **4 stages**: each row is icon circle (30 × 30, sits on top of the spine) → stage name → a light conversion-percent label (`flex: 1`, pushes the rest right) → a pill-shaped delta badge (arrow + %, fully rounded, coloured by good/bad) → the stage count right-aligned. Below the list, a **merged "Problem found" panel** in the *same card* — `#FEF6F6` background, top border `#F8DEDE`, a red icon chip + title, a body sentence with the driving numbers bolded, and "View calls" (primary) / "Dismiss" (secondary) actions.

- **Right column** (`flex: 0 0 340px`, vertical stack, `gap: 18px`):
  - **Birdy Insights card** — the standard purple gradient card with client-specific generated copy.
  - **Suggestions / Activity tabbed card** — a 2-item segmented control (`Suggestions` badge 4, `Activity` badge 12) toggles which list renders in the same scroll area below (no stacked scrollbars).

### 5. Ask Birdy panel

`display: flex; gap: 18px; height: 660px`. **Left** (`flex: 0 0 260px`): a filled "New conversation" button, then a `RECENT` thread list (most recent highlighted). **Right** (`flex: 1`): a chat card — header, a scrollable message thread (user bubbles right-aligned purple; Birdy replies left-aligned with a numbered-insight structure and `Create suggestion`/`Save to history book` quick actions), and a composer bar.

### 6. Marketing / Call Centre / Leads panel

Shares the chart + Birdy Insights + KPI-tiles row from 4b's chart card and right-column pattern (same composition used on Sales Hub, Marketing Hub and Lead Hub, scoped to one client). Below that: a sub-tab row (tabs differ per parent tab), search + Columns controls, and a data table whose column set is driven per-tab by a shared `cols`/`tableRows` structure. Each tab supplies its own Birdy Insights paragraph naming that domain's headline movement and worst offender.

### 7. Settings modal

Triggered by the header gear icon. `position: absolute; inset: 0`, a `rgba(30,25,60,.42)` scrim, centred **1040px**-wide white card (radius 18px, shadow `0 30px 70px -20px rgba(30,25,60,.5)`, `max-height: 100%`, internal scroll). Header: `{Client} settings` + a close (×) button — no subtitle line. Body: a **3-tab segmented control, in this order: Details → Targets → Integrations**.

- **Details tab:**
  - `CLIENT DETAILS` — a 2-column field grid with exactly four read-only-styled fields: **Client name**, **Primary contact**, **Location**, **Client since**.
  - Below a divider, a **3-column row** of equal-width bordered boxes (`border: 1px solid #ECECF2`, radius 9px, padding `12px 14px`):
    1. **Client status** — small-caps label, a one-line description ("Set the status of this client."), and a dropdown trigger (coloured dot + value + chevron) below. Options: **Active** (green dot) / **Inactive** (grey dot).
    2. **Client health** — same anatomy, description "Manually set this client's health.", dropdown options **Healthy** (green) / **Warning** (amber) / **Critical** (red).
    3. **Danger zone** — the existing red-tinted "Remove client group" box (title, one-line description, full-width red "Remove" button pinned to the bottom via `margin-top: auto` so all three boxes align regardless of content height).
  - Both dropdown popovers open **upward** (`bottom: 44px` instead of `top: 44px`, shadow flipped to `0 -14px 34px -12px …`) so opening them never grows the modal or requires scrolling — this matters because these boxes sit near the bottom of the Details tab.
  - The "Services & Packages" chip list that originally sat between Client Details and this row has been **removed for now**.
- **Targets tab:** the six monthly-target numeric fields (cost per lead, monthly closes, monthly revenue, close rate, monthly spend, average order value), each with a help line. *(Alert Thresholds and Birdy Automation, which briefly lived on their own "Birdy" tab, have been removed from this build — reintroduce them on Targets or their own tab if the product still needs that configuration surface.)*
- **Integrations tab:** three connected-service tiles (GHL, Meta Ads, HotProspector) in an equal-width flex row (`flex: 1` each) that already spans the modal's full width — each shows a coloured mark, name, "Connected" badge, a key/value pair, last-refresh timestamp, and an "Invalidate & refresh" action.

Footer bar: "Changes apply to {client} only" + Cancel / Save changes.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| **Page tabs** | Click sets `tab`; exactly one of the four content panels shows. |
| **Date range dropdown** | Toggles a popover; selecting closes it and should refetch the page for that window. |
| **Chart metric tabs** | Swap title/subtitle/total/delta/series/points; trigger the 800ms line-redraw animation. |
| **Chart point hover** | Shows a dark tooltip with the formatted value + period. |
| **Suggestions/Activity toggle** | Switches the panel shown in the right-column card; single shared scroll area. |
| **Settings gear** | Opens the modal; the × button (and an outside-click-catcher, recommended for production) closes it. |
| **Settings tabs** | Switch between Details / Targets / Integrations. |
| **Client status / Client health dropdowns** | Click toggles the popover (opens upward); picking a value closes it and updates the coloured dot + label. Opening one should close the other. |
| **"Do it" / "Dismiss" on suggestions** | Execute the change or drop it, logging to History book either way. |
| **History book composer** | Should append a new manually-authored entry to the scrollable list. |
| **Ask Birdy composer** | Sends a message; Birdy's reply should be generated from that client's real ads/calls/CRM data. |

## State Management

```
tab:        'Overview' | 'Ask Birdy' | 'Marketing' | 'Call Centre' | 'Leads'  // default 'Overview'
range:      'Today' | 'Last 7 days' | 'Last 30 days' | 'This quarter'         // default 'Last 30 days'
rangeMenu:  boolean
metrics:    { [tab]: metricKey }
hovers:     { [tab]: pointIndex }
anim:       number
settings:   boolean
sTab:       'Details' | 'Targets' | 'Integrations'                            // default 'Targets' in the prototype's initial state — set to 'Details' if Details should open first
panel:      'sug' | 'act'
clientStatus:      'Active' | 'Inactive'        // default 'Active'
clientStatusMenu:  boolean
clientHealth:      'Healthy' | 'Warning' | 'Critical'  // default 'Healthy'
clientHealthMenu:  boolean
```

**Data the real implementation needs:**
- Per-client monthly goals (revenue, closes, CPL, close rate, lead count) with live values, targets and an on-track/behind classification.
- Per-client time series for each chart metric, per parent tab.
- The diagnostics funnel's 4 stages with counts and period deltas, plus the rule that decides the "Problem found" verdict.
- Birdy Insights and tabInsight copy generation per tab, per client.
- History book entries and a way to add new ones.
- Real chat wiring for Ask Birdy scoped to this client's connected data sources.
- The client's settings: the four detail fields, status, health, monthly targets, and connected integrations with live refresh timestamps.
- Persisting `clientStatus`/`clientHealth` writes back to the client record (and presumably driving the health pill shown in the header).

## Design Tokens

Inherits the full Birdy palette, type scale, spacing, radius, shadow and motion tokens from `Birdy Style Guide.md`. Notable screen-specific choices:

- Health/status colours: Active/Healthy `#25A55F`, Inactive `#9A9AAB`, Warning `#E0920A`, Critical `#E5484D` — shown as a small dot next to the value in both the header pill and the settings dropdowns.
- Diagnostics delta pills use the same green/red pair as everywhere else, but as a fully rounded (`999px`) badge to fit the funnel row's compact horizontal layout.
- The "Problem found" panel is always the danger surface pair (`#FEF6F6`/`#F8DEDE`/`#E5484D`) — build a mirrored "All looking good" success-surface state (`#F3FAF6`/`#D5EEDF`/`#25A55F`) for when no stage is behind.
- Settings dropdown popovers use the standard dropdown styling (radius 12px, shadow, `#F1EEFC` selected row) but anchor from the **bottom** of the trigger rather than the top.

## Assets

- **`uploads/birdy-mascot.png`** — rail logo.
- **Icons** — inline SVG, 24 × 24 viewBox, Feather/Lucide-style, stroke-width 2 (2.2–2.4 on a few emphasis icons, 3 on delta arrows).
- **Fonts** — Poppins and Inter via Google Fonts.

## Files

- **`Client Detail.dc.html`** — the design in this handoff (variant 1d), extracted as a standalone page with a single flat state object. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system for shared components referenced throughout this screen.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

**Sibling screens:** the Marketing/Call Centre/Leads panel and its chart+insights+tiles row are shared compositions with **Sales Hub**, **Marketing Hub** and **Lead Hub** — extract those as common components if building all of these in the same codebase.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Client Detail.dc.html` — opening straight from the filesystem may block the local script and image.

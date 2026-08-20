# Handoff: Birdy — Sales Hub & Marketing Hub

## Overview

**Birdy** is an AI-powered support and operations system for service-based local lead-gen agencies. It connects Meta Ads data, GoHighLevel (GHL) lead data, and sales CRM / dialler data (Hot Prospector), then acts as a central brain — surfacing recommendations the team can approve, or let Birdy execute automatically.

This handoff covers **two sibling screens** that share one layout pattern:

- **Sales Hub** — call-centre performance across every client. *Is the outreach happening, and is it working?*
- **Marketing Hub** — paid-media performance across every client. *Where is the spend going, and what is it returning?*

They are deliberately near-identical in structure so an agency owner can move between them without relearning the page. **Build them as one component with two data configurations**, not two screens.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour. They are **not production code to copy directly**.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established component library, styling approach, and data layer. If no environment exists yet, choose the most appropriate framework for the project and implement there.

The prototypes use a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state and data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction behaviour are final and should be matched closely. Full token tables are in **`Birdy Style Guide.md`**, included in this bundle — treat that as the source of truth for anything not specified here.

---

## The shared layout

Both screens use the same shell and the same composition. Everything in this section applies to **both**; the differences are listed afterwards.

**Frame:** 1600 × 1040 px, background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px, `overflow: hidden`, horizontal flex.

```
┌────┬───────────────────────────────────────────────────┐
│rail│ header bar (64px): title · Ask Birdy · date · bell│
│68px├───────────────────────────────────────────────────┤
│    │ ┌───────────────────────┬───────────────────────┐ │
│    │ │ trend chart  flex 1.65│ Birdy insights (0.85) │ │
│    │ │                       │ 6 compact KPI tiles   │ │
│    │ └───────────────────────┴───────────────────────┘ │
│    │ section tabs ················· search · columns   │
│    │ ┌───────────────────────────────────────────────┐ │
│    │ │ data table                                    │ │
│    │ └───────────────────────────────────────────────┘ │
└────┴───────────────────────────────────────────────────┘
```

### 1. Icon rail

`flex: 0 0 68px`, `#fff`, right border 1px `#ECECF2`, vertical flex, `align-items: center`, padding `20px 0`, `gap: 8px`.

- **Logo** — Birdy mascot, 38 × 38, radius 10px, 1px `#E3E3EC`, `object-fit: cover`, `margin-bottom: 14px`. Asset: `uploads/birdy-mascot.png`.
- **Nav items** — 44 × 44, radius 12px, centred 20 × 20 stroke icon (stroke-width 2, round caps/joins). Active: `#F1EEFC` background, `#6B4EE6` icon. Inactive: transparent, `#9A9AAB`.
- Order: Dashboard (home) · Clients (users) · Birdy AI (sparkle) · Reports (line chart) · Call centre (phone) · Leads (list) · [spacer `margin-top: auto`] Settings (gear).
- **Active item differs per screen** — Call centre on Sales Hub, Reports on Marketing Hub.
- **Rail footer**, beneath settings: a support/status icon (`#25A55F`, with an 8px online dot, 2px white border) → 28 × 1px `#ECECF2` divider → logout icon (`#E5484D`) → 28 × 1px divider → `Beta 1.7` pill (Inter 600 10.5px `#8A8A9A` on `#F1F1F5`, padding `4px 7px`, radius 6px). The version tag belongs here, **not** in the header.

### 2. Header bar

Height 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 16px`, `align-items: center`.

- **Title block** — page name Poppins 700 19px `#1F1B33`; sub-line Inter 400 12px `#9A9AAB`, `margin-top: 1px`.
- **Ask Birdy field** — centred, `flex: 1`, `max-width: 420px`, height 38px, `#F4F4F8`, 1px `#ECECF2`, radius 10px, padding `0 13px`, `gap: 9px`. 15px sparkle icon `#6B4EE6`, placeholder `Ask Birdy about your marketing data…` Inter 400 13.5px `#9A9AAB`, trailing `⌘K` chip (Inter 11px on `#EAEAF0`, padding `2px 7px`, radius 5px).
- **Right cluster** (`margin-left: auto`, `gap: 10px`):
  1. **Date range dropdown** — height 38px, `#fff`, 1px `#ECECF2`, radius 10px, padding `0 13px`, label Inter 600 13px `#5A5A6E`, leading 14px clock icon `#6B4EE6`, trailing 12px chevron. Options: Today / **Last 7 days** (default) / Last 30 days / This quarter. Menu: absolute, `top: 44px`, width 170px, `#fff`, 1px `#ECECF2`, radius 12px, shadow `0 14px 34px -12px rgba(30,25,60,.28)`, padding 6px, `z-index: 20`; rows padding `9px 11px`, radius 8px, Inter 500 13px, selected `#6B4EE6` on `#F1EEFC`, else `#5A5A6E` on transparent.
  2. **Notification bell** — 38 × 38, radius 10px, `#F4F4F8`, red count badge (`#E5484D`, white Inter 700 10px, 18px circle, offset `-4px`).
  3. **Avatar** — 38 × 38, radius 10px, `linear-gradient(135deg, #7B5FE6, #6B4EE6)`, white user icon.

There is **no separate filters row** — the date control lives in the header and content starts immediately below.

### 3. Content area

`flex: 1`, `overflow-y: auto`, padding `22px 24px`, `min-width: 0`. Custom scrollbar: 9px, thumb `#DEDCE8`, radius 5px.

### 4. Chart + insights row

`display: flex`, `gap: 18px`, `align-items: stretch`, `margin-bottom: 18px`.

#### 4a. Trend chart — `flex: 1.65`

Card `#fff`, 1px `#ECECF2`, radius 16px, padding `20px 22px`.

- **Header** — left: title Poppins 600 15px `#1F1B33`, subtitle Inter 400 12px `#9A9AAB` reading `"<Date range> · <metric sub>"`. Right: segmented control — `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`; items padding `7px 13px`, radius 8px, Poppins 600 12.5px; selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`, else `#6B6480`.
- **Total row** — `margin: 14px 0 16px`, baseline aligned, `gap: 10px`: total Poppins 700 28px `#1F1B33`; delta Inter 600 12.5px, `#25A55F` when the movement is good, `#E5484D` when bad.
- **Plot** — `position: relative`, height 190px. SVG layer inset `0 0 22px 0`; axis labels pinned bottom as equal-width flex cells, Inter 400 10.5px `#9A9AAB`.
  - SVG `viewBox="0 0 1000 200"`, `preserveAspectRatio="none"`, absolute, 100% × 100%.
  - Area: `linearGradient` `#6B4EE6` 0.18 → 0. Line: `#6B4EE6`, `stroke-width: 3`, round caps/joins, `vector-effect: non-scaling-stroke`.
  - Dots: 10 × 10, radius 50%, 2px white border, `margin: -5px 0 0 -5px`. Latest point `#6B4EE6` with glow `0 0 0 4px rgba(107,78,230,.18)`; others `#A98BF5`.

**Chart geometry — match this exactly or the dots drift off the line.** With `n` points, `halfCol = 100 / (2n)`; point *i* sits at `x% = halfCol + i * (100 - 2·halfCol) / (n - 1)` — centred over its axis label, not spanning edge to edge. Values normalise between the series min and max with **14 units of padding** top and bottom in the 200-unit viewBox. The area path closes to the baseline at the **first and last data points**, not the frame edges.

Axis labels: `Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul` (Aug–Dec = 2025, Jan–Jul = 2026).

**Every metric must have its own shape** — flat or duplicated series read as fake. Monthly can trend upward; weekly and daily should be choppy with genuine peaks and dips.

#### 4b. Right column — `flex: 0.85`

Vertical flex, `gap: 14px`.

**Birdy insights card** — the only saturated surface on the page; it marks Birdy's own voice. `linear-gradient(135deg, #6B4EE6, #8B6BF0)`, 1px `#5A3FD6`, radius 16px, padding `16px 18px`, shadow `0 10px 26px -12px rgba(107,78,230,.6)`.

- Header (`gap: 8px`, `margin-bottom: 9px`): 26 × 26 radius 8px chip `rgba(255,255,255,.2)` with a white 14px sparkle · `Birdy Insights` Poppins 600 13.5px `#fff` · `AI` badge (`margin-left: auto`, Inter 700 10.5px `#fff` on `rgba(255,255,255,.22)`, padding `2px 8px`, radius 5px).
- Body Inter 400 12.5px `rgba(255,255,255,.88)`, `line-height: 1.5`, with figures and client names in `<strong style="color:#fff">`.
- Footer link `Ask Birdy about this` + 13px chevron, Inter 600 12px `#fff`, `margin-top: 11px`.

This copy is **generated per period from the underlying data** — name the biggest movement, then the single most actionable anomaly. It is not static text.

**KPI tiles** — `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 10px`. Six tiles, each a **single row** so the column matches the chart's height (a stacked icon/value/label layout made the section too tall): `display: flex`, `align-items: center`, `gap: 9px`, `#fff`, 1px `#ECECF2`, radius 12px, padding `11px 12px`, `min-width: 0`.

- Icon chip 28 × 28, radius 8px, centred 14px icon.
- Value Poppins 700 17px `#1F1B33` (`line-height: 1`); label Inter 400 11px `#8A8A9A`, `margin-top: 3px`, ellipsis.
- Delta pill (`margin-left: auto`): Inter 700 10.5px, padding `3px 6px`, radius 6px, 10px arrow at stroke-width 3. Positive `#25A55F` on `#EDF8F1`; negative `#E5484D` on `#FEF1F1`.

### 5. Section tabs + table controls

`margin-bottom: 14px`, `gap: 12px`.

- **Tabs** — container `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`; items `gap: 7px`, padding `7px 15px`, radius 8px, Poppins 600 13px, each with a 14px leading icon. Selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`; unselected `#6B6480`.
- **Right controls** — search field (38px, `#fff`, 1px `#ECECF2`, radius 10px, 220px, magnifier icon) and a `Columns` chip (sliders icon + chevron) for column visibility.

### 6. Data table

Card `#fff`, 1px `#ECECF2`, radius 16px, `overflow: hidden`, inner region `overflow-x: auto` with an explicit `min-width`.

- **Header row** — padding `13px 22px`, bottom border 1px `#ECECF2`, background `#FAFAFC`, Inter 700 11.5px `#9A9AAB`, `letter-spacing: .03em`, uppercase.
- **Body rows** — padding `12px 22px`, bottom border 1px `#F5F5F8`. Primary column Inter 600 14px `#1F1B33` with ellipsis; numeric cells Inter 400 13.5px `#5A5A6E`, with one or two key figures emphasised at Inter 500 `#1F1B33`.
- Columns are **flex weights**, not fixed widths; give the name column a `min-width`.

---

## Screen: Sales Hub

**File:** `Sales Hub.dc.html`

**Purpose:** monitor call-centre output across all clients, spot where outreach is under-worked, and drill into individual clients.

- **Title:** `Sales Hub` · sub `Call-centre performance across your Hot Prospector clients`
- **Active rail item:** Call centre (phone)

### Chart metrics

| Tab | Title | Subtitle | Total | Delta | Series | ×mult |
|---|---|---|---|---|---|---|
| Total calls (default) | Total calls | Call volume across your Hot Prospector clients | 17,687 | ▲ 9.1% | `48,55,62,58,66,72,64,78,70,84,80,90` | 196 |
| Leads called | Leads called | Leads contacted across the period | 8,260 | ▲ 7.4% | `52,61,58,70,66,74,69,80,86,79,92,100` | 83 |
| Inbound | Inbound calls | Calls received from leads | 1,322 | ▼ 2.6% | `70,64,78,58,82,66,74,60,86,71,63,80` | 15 |
| Talk time | Total talk time | Minutes spent on the phone | 4,073 | ▲ 11.8% | `44,50,47,56,61,55,64,58,72,68,80,88` | 46 |

Series are placeholders; the multipliers exist only so tooltips read as plausible figures.

### Birdy insight copy

> Call volume is up **9.1%** and outbound is driving it, but inbound has slipped **2.6%**. **Thee Vision Studio** has called only 7 of 235 leads — the biggest untouched pool in the portfolio.

### KPI tiles

| Tile | Value | Delta | Chip bg / icon colour | Icon |
|---|---|---|---|---|
| Leads called | 8,260 | ▲ 7.4% | `#F1EEFC` / `#6B4EE6` | users |
| Total calls | 17,687 | ▲ 9.1% | `#EAF1FD` / `#3B7DD6` | phone |
| Inbound | 1,322 | ▼ 2.6% | `#EDF8F1` / `#25A55F` | phone-incoming |
| Outbound | 16,365 | ▲ 10.3% | `#FDF1E7` / `#B4530A` | phone-outgoing |
| Transfers | 5,481 | ▲ 4.2% | `#EAF1FD` / `#3B7DD6` | shuffle |
| Talk time (min) | 4,073 | ▲ 11.8% | `#F1EEFC` / `#6B4EE6` | clock |

### Section tabs

**Overview** (grid, default) · Leads (user) · Members (users) · Calls (phone). Only Overview's table is designed; the others follow the same table pattern with their own columns.

### Table — columns and weights

`CLIENT` 2.2 (`min-width: 190px`) · `TOTAL LEADS` 1 · `LEADS CALLED` 1 · `TOTAL CALLS` 1 · `INBOUND` 0.9 · `OUTBOUND` 1 · `TRANSFERS` 1 · `TALK TIME (MIN)` 1.1. Emphasise **Total calls** and **Talk time**. Inner `min-width: 1200px`.

Sample data (15 rows):

| Client | Total leads | Leads called | Total calls | Inbound | Outbound | Transfers | Talk time |
|---|---|---|---|---|---|---|---|
| Aura | 766 | 194 | 454 | 25 | 429 | 454 | 347 |
| Bbl Body Confidence | 755 | 178 | 389 | 37 | 352 | 389 | 251.7 |
| V Rejuvederm Aesthetic Clinic | 530 | 53 | 176 | 20 | 156 | 176 | 207.8 |
| Tylaesthetics | 1,305 | 328 | 721 | 54 | 667 | 721 | 435.6 |
| Thee Vision Studio | 235 | 7 | 14 | 0 | 14 | 14 | 5 |
| The Cosmetic Clinic Mcr | 594 | 146 | 278 | 19 | 259 | 278 | 163.6 |
| Beauty Hub Mcr | 812 | 227 | 532 | 63 | 469 | 532 | 535.7 |
| The Contour Co | 1,080 | 378 | 780 | 52 | 728 | 780 | 559.6 |
| The Body Room | 843 | 326 | 583 | 36 | 547 | 583 | 372.3 |
| Casey Beauty And Aesthetics | 339 | 16 | 55 | 7 | 48 | 55 | 46.5 |
| The Bodi Genie | 811 | 217 | 481 | 37 | 444 | 481 | 335.8 |
| Cf Sculpting | 443 | 54 | 129 | 16 | 113 | 129 | 109.6 |
| Cloud Nine Beauty | 583 | 89 | 148 | 3 | 145 | 148 | 67.1 |
| Contoured Body Bedford | 1,017 | 166 | 358 | 25 | 333 | 358 | 329.9 |
| Elle Amour | 781 | 159 | 383 | 51 | 332 | 383 | 306.2 |

### Data needed

- Call aggregates for the selected range — leads called, total calls, inbound, outbound, transfers, talk time, each with a period-over-period delta.
- Time series per metric for the chart.
- A generated Birdy insight for the period.
- Per-client rows: total leads, leads called, total calls, inbound, outbound, transfers, talk time (minutes).

---

## Screen: Marketing Hub

**File:** `Marketing Hub.dc.html`

**Purpose:** monitor paid-media output and efficiency across all clients, spot overspend or underperformance, and drill into individual campaigns.

- **Title:** `Marketing Hub` · sub describing Meta Ads coverage across clients
- **Active rail item:** Reports (line chart)

The shell, header, chart geometry, insight card and tile anatomy are **identical to Sales Hub** — see *The shared layout*. What differs is the metrics, the tile set, and — importantly — **the table, which is a campaign table with two interactive controls Sales Hub does not have.**

### Chart metrics

| Tab | Title | Subtitle | Total | Delta | Good? | Series | ×mult |
|---|---|---|---|---|---|---|---|
| Ad spend (default) | Total ad spend | Combined spend across all connected ad accounts | £4,898.73 | ▲ 6.8% | green | `60,64,58,72,68,76,71,82,78,88,84,95` | 52 |
| Leads | Total leads | Lead volume across all campaigns | 1,632 | ▲ 4.1% | green | `52,61,58,70,66,74,69,80,86,79,92,100` | 16 |
| CPL | Average CPL | Blended cost per lead across all campaigns | £3.00 | ▲ 2.6% | **red** | `74,66,81,58,88,63,77,70,84,60,90,72` | 0.034 |
| Impressions | Impressions | Total impressions served | 1.42M | ▲ 8.2% | green | `48,55,62,58,66,72,64,78,70,84,80,90` | 15800 |

There is **no CTR chart tab**. Note CPL: the delta arrow points up but the colour is red, because rising cost is bad — see *Inverted metrics* below.

Series are placeholders; the multipliers exist only so hover tooltips read as plausible figures.

### Birdy insight copy

> Spend is up **6.8%** but CPL has climbed to **£3.00**. **Soup – No Leak Seat** is the worst offender at **£9.64** CPL with only 12 results — pausing it would free £115 for your £1.79 CPL winner.

Generated per period: state the headline movement, then name the single worst offender with the numbers and the trade it implies.

### KPI tiles

Six tiles, same compact single-row anatomy as Sales Hub (28 × 28 chip, Poppins 700 17px value, Inter 400 11px label, delta pill right):

| Tile | Value | Delta | Chip bg / icon colour | Icon |
|---|---|---|---|---|
| Active campaigns | 707 | ▲ 3.4% green | `#F1EEFC` / `#6B4EE6` | megaphone |
| Total ad spend | £4,898.73 | ▲ 6.8% green | `#EDF8F1` / `#25A55F` | pound |
| Total leads | 1,632 | ▲ 4.1% green | `#EAF1FD` / `#3B7DD6` | user-check |
| Average CPL | £3.00 | ▲ 2.6% **red** | `#FDF1E7` / `#B4530A` | target |
| Impressions | 1.42M | ▲ 8.2% green | `#EAF1FD` / `#3B7DD6` | eye |
| Average CTR | 3.62% | ▲ 2.1% green | `#F1EEFC` / `#6B4EE6` | mouse-pointer |

There is **no clicks tile** — clicks appear only as a table column.

### Section tabs

**Campaigns** (grid icon, default) · **Ad Sets** (layout icon) · **Ads** (file icon) · **Leads** (user icon). Only the Campaigns table is designed; the others follow the same table pattern with their own columns.

### Table — campaign performance

**This is not a client table.** The primary column is the **campaign name** (e.g. `Soup – Body Sculpting – 091225 – Cbo`), and each row carries two interactive controls.

Eleven columns, in order, with flex weights:

| # | Column | Weight | Notes |
|---|---|---|---|
| 1 | *(row select)* | `flex: 0 0 26px` | Checkbox — 15 × 15, 1.5px border (`#CFCFDA` in the header, `#DFDFE8` in rows), radius 4px, unchecked |
| 2 | `STATUS` | `flex: 0 0 62px` | **Toggle switch**, not a status pill — see below |
| 3 | `NAME` | 2.4 (`min-width: 210px`) | Campaign name, Inter 600 13.5px `#1F1B33`, ellipsis, `padding-right: 12px` |
| 4 | `SPEND ↓` | 1 | **Active sort column** — header label plus a `↓` arrow in `#1F1B33`; cells Inter 500 13.5px `#1F1B33` |
| 5 | `CPL` | 0.85 | Inter 500 13.5px; **`#E5484D` when the campaign is over its CPL threshold**, otherwise `#1F1B33` |
| 6 | `RESULTS` | 0.85 | Lead count — the column is labelled RESULTS, not "leads" |
| 7 | `IMPRESSIONS` | 1 | |
| 8 | `REACH` | 1 | |
| 9 | `CLICKS` | 0.85 | |
| 10 | `CTR` | 0.8 | |
| 11 | `SOCIAL SPEND` | 0.9 | Inter 400 13.5px `#9A9AAB`; renders `–` when absent |

Columns 6–10 are Inter 400 13.5px `#5A5A6E`. Rows **zebra-stripe**: alternating `#fff` and `#FCFCFD`.

**Status toggle** — 34 × 19 pill, radius 999px, padding 2px, containing a 15px white knob. Active: background `#6B4EE6`, knob right (`justify-content: flex-end`). Paused: background `#CFCFDA`, knob left. This is a **functional per-campaign pause/activate control**, not a status indicator — wire it to the ad platform.

Sample data (14 rows, sorted by spend descending; ✱ marks rows whose CPL renders red):

| Campaign | Spend | CPL | Results | Impressions | Reach | Clicks | CTR |
|---|---|---|---|---|---|---|---|
| Soup – Body Sculpting – 091225 – Cbo | £177.74 | £2.78 | 64 | 13,103 | 10,089 | 598 | 4.56% |
| Soup – Body Sculpting – 111225 – Cbo | £172.33 | £4.79 | 36 | 24,210 | 11,335 | 628 | 2.59% |
| Soup – Body Sculpting – 041025 – Cbo | £146.84 | £2.72 | 54 | 27,602 | 15,437 | 1,245 | 4.51% |
| Soup – Body Sculpting – 160426 – Cbo ✱ | £131.27 | £7.72 | 17 | 17,310 | 9,416 | 524 | 3.03% |
| Soup – Body Sculpting Packages ✱ | £125.46 | £6.60 | 19 | 14,785 | 8,934 | 539 | 3.65% |
| Soup – Body Sculpting – 111225 – Cbo | £123.88 | £4.96 | 25 | 16,621 | 7,996 | 447 | 2.69% |
| Soup – Body Sculpting – 270825 – Cbo | £120.40 | £2.08 | 58 | 24,572 | 14,876 | 957 | 3.89% |
| Soup – Lymphatic Body Sculpt & Drainage ✱ | £118.48 | £6.58 | 18 | 9,568 | 5,937 | 265 | 2.77% |
| Soup – Body Sculpting – 091225 – Cbo | £117.83 | £2.51 | 47 | 22,033 | 15,921 | 1,070 | 4.86% |
| Soup – Face Sculpting (phase 1) | £116.66 | £3.65 | 32 | 10,014 | 6,565 | 286 | 2.86% |
| Soup – Body Sculpting – 09/02/26 – Cbo | £116.51 | £1.79 | 65 | 18,607 | 11,054 | 1,152 | 6.19% |
| Soup – Body Sculpting – 201125 – Cbo | £116.23 | £3.75 | 31 | 19,596 | 10,042 | 583 | 2.98% |
| Soup (new) – No Leak Seat – 170326 ✱ | £115.64 | £9.64 | 12 | 15,651 | 8,370 | 296 | 1.89% |
| Soup – Body Sculpting – 120126 – Cbo | £114.02 | £2.94 | 39 | 16,880 | 9,721 | 702 | 4.16% |

Social spend is `–` on every sample row.

### Inverted metrics — important

**Cost metrics behave the opposite way to volume metrics.** CPL is **red when rising, green when falling**; spend, leads, impressions and CTR are green when rising. This applies to the chart delta, the KPI tile pill, *and* the red CPL cell in the table. Colour by *meaning*, never by arrow direction.

### Data needed

- Paid-media aggregates for the selected range — active campaign count, spend, leads, average CPL, impressions, average CTR, each with a period-over-period delta.
- Time series per chart metric (spend, leads, CPL, impressions).
- A generated Birdy insight naming the headline movement plus the worst-performing campaign and the trade it implies.
- Per-campaign rows: name, active/paused state, spend, CPL (plus a threshold flag driving the red text), results, impressions, reach, clicks, CTR, social spend.
- The CPL threshold per client/campaign that decides when a CPL cell turns red.

## Interactions & Behaviour

Applies to both screens.

| Interaction | Behaviour |
|---|---|
| **Date range dropdown** | In the header. Click toggles the menu; selecting updates the chart subtitle prefix and, in production, every figure on the page. |
| **Dropdown option clicks** | Must `stopPropagation` — otherwise the click bubbles to the trigger's toggle and reopens the menu immediately. This was a real bug in the prototype. |
| **Menus** | Should also close on outside click and `Escape`. |
| **Chart metric tabs** | Swap title, subtitle, total, delta, series and point values; trigger the redraw animation. |
| **Chart point hover** | `mouseenter` stores the hovered index in state, `mouseleave` clears it — **state, not CSS `:hover`** (a CSS-variable approach failed in the prototype). Tooltip: `#1F1B33`, white text, padding `6px 10px`, radius 8px, shadow `0 6px 16px -6px rgba(30,25,60,.5)`, `pointer-events: none`, 15px above the dot, horizontally centred — formatted value (Poppins 700 12.5px) over month + year (Inter 400 10.5px `#C9BEF3`). |
| **Chart redraw** | Line animates `stroke-dasharray: 2400` with `stroke-dashoffset: 2400 → 0` over **800ms `cubic-bezier(.4, 0, .2, 1)` forwards**; area fades `opacity: 0 → 1` over **800ms ease-out**. The prototype alternates two keyframe names to force a restart — in a real framework, key the chart on the selected metric and range (or re-run imperatively) so it replays. |
| **Section tabs** | Switch the table beneath. |
| **Campaign status toggle** (Marketing Hub) | Per-row switch in the STATUS column — pauses or activates that campaign on the ad platform. Optimistic UI with rollback on failure; confirm before pausing a high-spend campaign. |
| **Row select checkbox** (Marketing Hub) | Selects campaigns for bulk actions. The header checkbox selects all visible rows; a selection should reveal a bulk action bar (pause, duplicate, adjust budget). |
| **Column sort** (Marketing Hub) | Sorted by SPEND descending by default, shown by a `↓` beside the header label. Clicking a header re-sorts and moves the indicator. |
| **Search / Columns** | Not wired in the prototype — search should filter table rows live; Columns opens a visibility menu. |
| **Ask Birdy / Ask Birdy about this** | Opens the Birdy assistant seeded with the current period and summary context. Not wired. |

## State Management

Both screens use the same shape:

```
tab:        <section tab name>          // 'Overview' (Sales) / 'Campaigns' (Marketing)
range:      'Today' | 'Last 7 days' | 'Last 30 days' | 'This quarter'   // default 'Last 7 days'
rangeMenu:  boolean                     // header date-range menu open
metric:     <chart metric key>          // 'calls' (Sales) / 'spend' (Marketing)
hover:      number | null               // hovered chart point index
anim:       number                      // increments to restart the chart animation
```

Everything else is derived: chart series, labels, total, delta, tile figures, tooltip visibility, animation names.

## Assets

- **`uploads/birdy-mascot.png`** — Birdy mascot, the rail logo at 38 × 38 with a 1px `#E3E3EC` border and 10px radius. Client-supplied; included.
- **Icons** — all inline SVG on a 24 × 24 viewBox, `fill: none`, `stroke: currentColor`, `stroke-width: 2` (3 for delta arrows), round caps and joins, in the Feather/Lucide vocabulary. **Substitute the equivalent from the codebase's existing icon library** rather than pasting these paths.
- **Fonts** — Poppins (500/600/700) for headings, numerals and control labels; Inter (400/500/600/700) for body and meta, both via Google Fonts. Use whatever font loading the codebase already has.

## Files

| File | Purpose |
|---|---|
| **`Sales Hub.dc.html`** | Sales Hub (variant 1d) as a standalone page — **build target** |
| **`Marketing Hub.dc.html`** | Marketing Hub (variant 1a) as a standalone page — **build target** |
| **`Birdy Style Guide.md`** | Full design system — colour, type, spacing, radius, elevation, motion, every component spec, content rules, interaction principles, anti-patterns. **Read this alongside the build targets.** |
| `Sales Hub Options (all variants).dc.html` | Exploration whiteboard: KPI strip above chart, stacked KPI column, larger tiles, and the chosen 1d. Context only. |
| `Marketing Hub Options (all variants).dc.html` | Marketing Hub exploration whiteboard. Context only. |
| `support.js` | Prototype template runtime — needed only to open the HTML locally. **Do not port it.** |
| `uploads/birdy-mascot.png` | Mascot asset |

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open either `.dc.html` — opening straight from the filesystem may block the local script and image.

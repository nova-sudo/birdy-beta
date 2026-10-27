# Birdy — Design System / Style Guide

A single reference for styling any new Birdy screen so it matches the existing product. Written for another designer or AI to follow without seeing the original files.

---

## 1. What Birdy is

Birdy is an **AI-powered support and operations system for service-based local lead-gen agencies**. It connects Meta Ads data, GoHighLevel (GHL) lead data, and sales CRM / dialler data, then acts as a central brain: surfacing recommendations the team can approve — or let Birdy execute automatically.

Two audiences:
- **In-app (the tool)** — media buyers and agency owners. Dense, data-heavy, action-first.
- **Public pages** (e.g. changelog) — same visual language, no left tool rail, marketing-style top nav instead.

**Product voice:** direct and operational. Birdy tells you what to do and why, in one sentence, with the numbers in it. Never chirpy, never vague. "Pause 2 underperforming ads — £48 CPL vs £22 target, 0 leads in 5 days."

---

## 2. Foundations

### Typography

Two families, both Google Fonts:

- **Poppins** (500 / 600 / 700) — headings, all numerals, control labels, tab labels. Everything that should feel like a *figure* or a *title*.
- **Inter** (400 / 500 / 600 / 700) — body copy, table cells, meta, labels.

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Type scale in use (px / weight / family):

| Size | Weight | Family | Use |
|---|---|---|---|
| 30 | 700 | Poppins | Page title when it sits in the body (`letter-spacing: -.02em`) |
| 28 | 700 | Poppins | Big chart total |
| 22 | 700 | Poppins | KPI value (roomy), funnel stage count |
| 20 | 700 | Poppins | Metric value in a compact cell |
| 19 | 700 | Poppins | Page title in the header bar |
| 18 | 700 | Poppins | Section / release heading |
| 17 | 700 | Poppins | KPI value in a compact tile |
| 16–17 | 600 | Poppins | Card heading, entry title |
| 15 | 600 | Poppins | Card title (standard) |
| 14 | 600 | Inter | Primary table cell (names) |
| 13.5 | 600 | Inter | Control labels, rail titles |
| 13.5 | 400 | Inter | Table cells, body copy |
| 13 | 600 | Poppins | Section tabs |
| 12.5 | 600 | Poppins | Chart metric tabs |
| 12.5 | 400 | Inter | Supporting body copy |
| 12 | 400 | Inter | Labels, subtitles |
| 11.5 | 700 | Inter | Table column headers (`letter-spacing: .03em`) |
| 11 | 700 | Inter | Severity labels, small tags |
| 11 | 400 | Inter | Tile labels, timestamps |
| 10.5 | 700 | Inter | Delta pills, count badges |
| 10.5 | 400 | Inter | Chart axis labels |

Line height: 1 for large numerals, 1.35 for tight UI text, 1.45–1.5 for body copy. Use `text-wrap: pretty` on paragraphs.

### Colour

**Brand**

| Token | Hex | Use |
|---|---|---|
| Primary | `#6B4EE6` | Brand, active nav, primary buttons, chart line |
| Primary deep | `#5A3FD6` | Link hover, insight-card border |
| Primary gradient | `#7B5FE6 → #6B4EE6` | Avatar, small accents (135deg) |
| Insight gradient | `#6B4EE6 → #8B6BF0` | Birdy AI card only (135deg) |
| Primary tint | `#F1EEFC` | Active nav bg, chips, badges |
| Primary light | `#A98BF5` | Secondary chart dots |
| Primary pale | `#C9BEF3` | Tooltip subtext, muted bar fills |
| Primary faint | `#E4DDF9` / `#E7E1FA` | Tinted card borders |

**Neutrals**

| Token | Hex | Use |
|---|---|---|
| Ink | `#1F1B33` | Headings, values, tooltip background |
| Body | `#5A5A6E` | Body copy, table cells, control labels |
| Muted | `#6B6480` | Inactive tabs, secondary copy |
| Subtle | `#8A8A9A` | Labels |
| Faint | `#9A9AAB` | Meta, inactive icons, axis labels, table headers |
| Chevron | `#CFCFDA` | Decorative arrows, unchecked boxes |
| Border input | `#DFDFE8` | Secondary button / checkbox borders |
| Scrollbar | `#DEDCE8` | Custom scrollbar thumb |
| Divider soft | `#F5F5F8` | Table row borders |
| Divider | `#F1F1F5` | Internal dividers, segmented-control bg |
| Field | `#F4F4F8` | Inputs, icon buttons |
| Border | `#ECECF2` | Cards, controls — the default border |
| Border strong | `#E3E3EC` | Frame border, image borders |
| Table head | `#FAFAFC` | Table header row |
| Row zebra | `#FCFCFD` | Alternate table row (optional) |
| Surface | `#fff` | Cards, rails, rows |
| Canvas | `#F7F7FB` | App background inside the frame |
| Desk | `#EEEDF3` | Page behind the frame (canvas mode) |

**Semantic** — always as a *pair* (text colour + tint background):

| Meaning | Text | Background | Use |
|---|---|---|---|
| Success / positive | `#25A55F` | `#EDF8F1` | Rising good metrics, wins, approved, healthy |
| Danger / negative | `#E5484D` | `#FEF1F1` | Falling metrics, high severity, alerts |
| Danger surface | `#E5484D` | `#FEF6F6` + border `#F8DEDE` | Problem banner |
| Warning | `#E0920A` | `#FDF6EC` | Medium severity, mid-funnel |
| Amber | `#B4530A` | `#FDF1E7` | Cost metrics, spicy-lead tags |
| Info | `#3B7DD6` | `#EAF1FD` | Neutral counts, platform chips |
| Neutral | `#8A8A9A` | `#F1F1F5` / `#E7E7ED` | Inactive counts, version tags |

Rules:
- Max **one saturated purple surface per screen** — reserved for the Birdy AI card. Everything else is white on `#F7F7FB`.
- Never invent new hues. If you need another accent, reuse Info or Amber.
- **Inverted metrics matter.** Cost-style metrics (CPL, speed to lead, calls per close) are **green when falling, red when rising**. Volume metrics are the opposite. Colour by *meaning*, never by arrow direction.

### Spacing

Scale: **3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 32**.

Conventions:
- Content area padding `22px 24px` (dense) or `28px 32px` (roomy).
- Card padding `20px 22px`; compact cell `11px 13px`; table row `12px 22px`.
- Gap between cards in a row **18px**; between tiles in a grid **10–14px**; inside a control **7–10px**.
- Header bar padding `0 26px`.

**Always use flex/grid with `gap`.** Never space siblings with margins or source whitespace.

### Radius

| Value | Use |
|---|---|
| 4–5px | Tiny badges, checkboxes |
| 6px | Version pills, small tags |
| 7px | Small buttons, delta pills |
| 8px | Icon chips, segmented items, menu rows |
| 9px | Rank badges, form fields, secondary buttons |
| 10px | Controls, buttons, logo, small cards |
| 11px | Popovers, chip groups |
| 12px | Nav items, inner cells, tiles, banners |
| 14px | KPI strip |
| 16px | Cards, frame |
| 999px / 50% | Pills, dots, avatars, toggles |

### Elevation

| Shadow | Use |
|---|---|
| `0 20px 50px -20px rgba(30,25,60,.25)` | The app frame on the desk |
| `0 2px 8px -2px rgba(107,78,230,.35)` | Selected segmented-control item |
| `0 14px 34px -12px rgba(30,25,60,.28)` | Dropdown / popover |
| `0 6px 16px -6px rgba(30,25,60,.5)` | Dark tooltip |
| `0 10px 26px -12px rgba(107,78,230,.6)` | Birdy AI card glow |
| `0 0 0 4px rgba(107,78,230,.18)` | Focus ring / active chart point |

Cards themselves are **flat** — 1px `#ECECF2` border, no shadow. Shadow signals *floating* or *selected*, never decoration.

### Motion

- Chart line draw: `stroke-dasharray: 2400` + `stroke-dashoffset: 2400 → 0`, **800ms `cubic-bezier(.4, 0, .2, 1)` forwards**.
- Area fade: `opacity: 0 → 1`, **800ms ease-out**.
- Tooltip / small state: **120ms**.
- Chevron rotate on expand: **150ms**.

Re-animate a chart whenever its metric or timeframe changes.

### Iconography

All icons are **inline SVG, 24 × 24 viewBox, `fill: none`, `stroke: currentColor`, round caps and joins**, in the Feather/Lucide vocabulary. Stroke widths: **2** standard, **2.2** on small emphasis icons, **3** on delta arrows.

Rendered sizes: 20px (nav rail) · 19px (funnel chip) · 17px (KPI chip) · 15px (control leading) · 14px (compact chip, tab) · 13px (inline button) · 12px (chevron, delta arrow) · 10–11px (micro).

**Emoji:** avoid, with one narrow exception — the ⚡ / ✓ glyphs used as activity-feed mode markers. Never in headings or body copy.

**Never draw illustrations or logos in SVG.** Use the supplied mascot image; use placeholders for other imagery.

---

## 3. Layout

### The app shell (in-tool screens)

```
┌────┬──────────────────────────────────────────────┐
│rail│ header bar (64px)                            │
│68px├──────────────────────────────────┬───────────┤
│    │ scrolling content                │ right rail│
│    │ 22px 24px                        │ 340px     │
└────┴──────────────────────────────────┴───────────┘
```

- **Frame** — fixed 1600 × 1040 (or 1440 × 940 for narrower pages), background `#F7F7FB`, 1px `#E3E3EC`, radius 16px, `overflow: hidden`.
- **Icon rail** — `flex: 0 0 68px`, `#fff`, right border 1px `#ECECF2`, vertical flex, `align-items: center`, padding `20px 0`, `gap: 8px`.
  - Mascot logo 38 × 38, radius 10px, 1px `#E3E3EC` border, `object-fit: cover`, `margin-bottom: 14px`.
  - Nav items 44 × 44, radius 12px, centred 20px icon. Active: `#F1EEFC` bg + `#6B4EE6` icon. Inactive: transparent + `#9A9AAB`.
  - Footer (`margin-top: auto`): settings → optional support/logout icons separated by a 28 × 1px `#ECECF2` divider → `Beta 1.7` pill (Inter 600 10.5px `#8A8A9A` on `#F1F1F5`, padding `4px 7px`, radius 6px).
- **Header bar** — 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 16px`. Page title (Poppins 700 19px) with a 12px `#9A9AAB` sub-line on the left; optional centred Ask Birdy field; controls, notification bell and avatar right-aligned via `margin-left: auto`.
- **Content** — `flex: 1`, `overflow-y: auto`, padding `22px 24px`, `min-width: 0`.
- **Right rail** (optional) — `flex: 0 0 340px`, `#fff`, left border 1px `#ECECF2`, vertical flex, `min-height: 0`.

**One scroll region per column.** Never stack two scrollable panes in the same rail — use a toggle instead.

### Public pages

Same tokens, but: no left rail; a 66px top nav (mascot 34 × 34 + wordmark, nav links Inter 13.5px `#8A8A9A` with the active one `#1F1B33` 600, log-in text link and a filled `Book a demo` button right-aligned). Content is centred with a max width (620–780px for reading, wider for grids).

### Presenting options

When exploring alternatives, put each in a `<section>` on a pan/zoom canvas: `<meta name="design_doc_mode" content="canvas">`, `display: flex; gap: 64px; padding: 72px`. Every option gets a stable `{turn}{letter}` id (`1a`, `1b`, `2a`…) on its wrapper plus a visible pill badge (Poppins 600 15px white on `#6B4EE6`, padding `5px 14px`, radius 999px) with a short name and one-line description. Newest turn goes at the top.

---

## 4. Components

### Card
`background: #fff; border: 1px solid #ECECF2; border-radius: 16px; padding: 20px 22px;`
Title Poppins 600 15px `#1F1B33`; optional subtitle Inter 400 12px `#9A9AAB` (`margin-top: 2px`); header row `margin-bottom: 16–18px` with any action right-aligned.

### KPI cell — three variants

All three share: coloured icon chip, Poppins 700 value, Inter 400 label, semantic delta pill.

1. **Unified strip** — one card, `display: flex`, four cells `flex: 1`, padding `16px 20px`, `border-right: 1px solid #F1F1F5` on all but the last. Icon chip 36 × 36 radius 10px, value 22px, label 12px, delta pill right-aligned.
2. **Compact tile** (grid) — `#fff` card, radius 12px, padding `11px 12px`, single row: chip 28 × 28 radius 8px, value 17px, label 11px, delta pill `margin-left: auto`. Use in a `1fr 1fr` grid with `gap: 10px` to fit six in a narrow column.
3. **Roomy card** — icon chip top-left, label above a 26–30px value, trend line beneath. For four-across hero rows.

Delta pill: `gap: 3–5px`, Inter 700 10.5–12px, padding `3px 6px` → `5px 9px`, radius 6–8px, with a 10–12px arrow at stroke-width 3. Colour by *meaning* (see Colour rules).

### Segmented control
Container `#F1F1F5`, 1px `#ECECF2`, radius 10–12px, padding 4–5px, `gap: 5px`. Items padding `7px 13px` (or `9px` for full-width), radius 8px, Poppins 600 12.5–13.5px. Selected: `#1F1B33` on `#fff` + `0 2px 8px -2px rgba(107,78,230,.35)`. Unselected: `#6B6480` on transparent. Counts ride as badges inside the item (`#6B4EE6` on `#F1EEFC` when selected, `#8A8A9A` on `#E7E7ED` otherwise).

### Dropdown
Trigger: height 38px, `#fff`, 1px `#ECECF2`, radius 10px, padding `0 13px`, Inter 600 13px `#5A5A6E`, leading 14px icon `#6B4EE6`, trailing 12px chevron.
Menu: `position: absolute; top: 44px`, width 160–250px, `#fff`, 1px `#ECECF2`, radius 12px, shadow `0 14px 34px -12px rgba(30,25,60,.28)`, padding 6px, `z-index: 20`. Rows padding `9px 11px`, radius 8px, Inter 500 13px; selected `#6B4EE6` on `#F1EEFC`.
**Option clicks must `stopPropagation`** or they bubble to the trigger and reopen the menu. Close on outside click and Escape too.

### Buttons
- **Primary** — `#fff` on `#6B4EE6`, Inter 600 13px, padding `9px 16px`, radius 9px. With a leading 14px lightning bolt when it's a Birdy action ("Do it for me").
- **Secondary** — `#5A5A6E` on `#fff`, 1px `#DFDFE8` or `#ECECF2`, same metrics.
- **Tint** — `#6B4EE6` on `#F1EEFC`, no border.
- **Icon-only** — 28–38px square, radius 7–10px, 1px `#ECECF2` or `#F4F4F8` fill, 13–17px icon `#9A9AAB` / `#5A5A6E`. Always give it a `title`.
- **Destructive/dismiss** — icon-only trash; never a red filled button.

### Input / search
Height 38–40px, `#fff` or `#F4F4F8`, 1px `#ECECF2`, radius 10px, padding `0 13px`, `gap: 9px`, 15px magnifier `#9A9AAB`, placeholder Inter 13–13.5px `#9A9AAB`. Field labels sit above: Inter 400 11.5–12px `#9A9AAB`, `margin-bottom: 5px`.

### Table
Card wrapper radius 16px, `overflow: hidden`, inner region `overflow-x: auto` with an explicit `min-width`.
- Header row: padding `13px 22px`, bottom border 1px `#ECECF2`, background `#FAFAFC`, Inter 700 11.5px `#9A9AAB`, `letter-spacing: .03em`, uppercase labels. Sticky (`position: sticky; top: 0; z-index: 1`) when the body scrolls.
- Body rows: padding `12px 22px`, bottom border 1px `#F5F5F8`. Primary column Inter 600 14px `#1F1B33` with ellipsis; numeric cells Inter 400 13.5px `#5A5A6E`; emphasise the one or two key figures at Inter 500 `#1F1B33`.
- Columns are `flex` weights, not fixed widths; give the name column `min-width`.
- Status belongs in **its own column** as a pill — never crammed next to the name.

### Status pill
`display: inline-flex; gap: 5px;` Inter 600 11px, padding `3px 9px`, radius 6px, with a 6–7px dot in the same colour. Semantic pairing (Active green, Inactive amber, etc.).

### Tag / chip
Inter 400 11.5–12px `#5A5A6E` on `#F4F4F8`, 1px `#ECECF2`, padding `4px 9px` → `5px 10px`, radius 6–7px. Emphasised tags use a semantic pair. Overflow becomes a dashed `+7 more` chip in `#6B4EE6` with a `#C9BEF3` dashed border.

### Line chart
- Container `position: relative`, height 190px. SVG layer inset `0 0 22px 0`; axis labels pinned bottom as equal-width flex cells.
- SVG `viewBox="0 0 1000 200"`, `preserveAspectRatio="none"`, absolutely positioned at 100% × 100%.
- Area: `linearGradient` `#6B4EE6` 0.18 → 0. Line: `#6B4EE6`, `stroke-width: 3`, round caps, `vector-effect: non-scaling-stroke`.
- Dots 10 × 10, radius 50%, 2px white border, `margin: -5px 0 0 -5px`. Latest point `#6B4EE6` with the focus glow; others `#A98BF5`.
- **Geometry (so dots line up with labels):** with `n` points, `halfCol = 100 / (2n)`; point *i* at `x% = halfCol + i * (100 - 2·halfCol) / (n - 1)`. Normalise y between series min and max with 14 units of padding in the 200-unit viewBox. Close the area path at the **first and last data points**, not the frame edges.
- Hover: store the hovered index in state (not CSS `:hover`) and render a dark tooltip 15px above the dot — `#1F1B33`, radius 8px, padding `6px 10px`, `pointer-events: none`, value Poppins 700 12.5px over period Inter 400 10.5px `#C9BEF3`.
- Every metric/timeframe needs its **own shape** — monthly can trend upward, but weekly and daily must be choppy with real peaks and dips. Flat or identical series look fake.

### Bar chart
Columns `flex: 1` in a flex row with `gap`, each with an inner flex track (`flex: 1; align-items: flex-end`) so percentage heights resolve. Bars radius `5px 5px 0 0`, `#C9BEF3` with the latest in `#6B4EE6`. Label beneath, Inter 10.5–11px `#9A9AAB`.

### Progress / funnel bar
Track height 6–9px, `#F1F1F5`, radius 3–5px; fill a semantic or brand colour. Funnel stages step from `#6B4EE6` through `#8B6BF0`, `#A98BF5`, `#3B7DD6` to `#25A55F`.

### Horizontal funnel stepper
Steps `flex: 1`, centred: 42 × 42 radius 12px icon chip (`margin: 0 auto 9px`) → stage label Inter 12px `#9A9AAB` → count Poppins 700 22px → delta Inter 600 12px semantic. Between steps a 15px `#CFCFDA` chevron with `padding-top: 52px` so it aligns with the chips. No chevron after the last step.

### Diagnostic banner
`align-items: center; gap: 11px;` radius 12px, padding `14px 16px`, tinted surface + matching border. 30 × 30 radius 9px chip with a 15px icon. Title Poppins 600 13.5px in the state colour; body Inter 400 12px `#5A5A6E` `line-height: 1.45`.
- Problem: `#FEF6F6` / border `#F8DEDE` / `#E5484D`, warning triangle, "Problem found: <stage>".
- Healthy: `#F3FAF6` / border `#D5EEDF` / `#25A55F`, check, "All looking good".
Always name the stage and quote the two numbers that prove it.

### Birdy AI insight card
The one saturated surface. `linear-gradient(135deg, #6B4EE6, #8B6BF0)`, 1px `#5A3FD6`, radius 16px, padding `16px 18px`, shadow `0 10px 26px -12px rgba(107,78,230,.6)`.
Header: 26 × 26 radius 8px chip `rgba(255,255,255,.2)` with a white sparkle · `Birdy Insights` Poppins 600 13.5px `#fff` · `AI` badge `rgba(255,255,255,.22)`.
Body Inter 400 12.5px `rgba(255,255,255,.88)`, `line-height: 1.5`, with figures and client names in `<strong style="color:#fff">`.
Footer link `Ask Birdy about this` + chevron, Inter 600 12px `#fff`.
Copy is **generated per period** — name the biggest movement, then the single most actionable anomaly.

### Recommendation card
1px `#ECECF2`, radius 10px, padding `11px 12px`.
1. Meta row: 7px severity dot · severity label Inter 700 10.5px in the severity colour · client name Inter 400 11px `#9A9AAB` (ellipsis).
2. Title Poppins 600 13px `#1F1B33`, `line-height: 1.3`.
3. Bottom row, `align-items: flex-end`: reason Inter 400 11.5px `#6B6480` on the left (`flex: 1`); actions right — primary **Do it** (bolt icon) + icon-only dismiss.

Severity: `HIGH` `#E5484D` · `OPPORTUNITY` `#25A55F` · `MEDIUM` `#E0920A`.
Actions are exactly two: execute, or dismiss. No "done manually", no auto-approve checkbox.

### Activity row
`display: flex; gap: 11px;` 26 × 26 mode circle (⚡ auto-run `#6B4EE6`/`#F1EEFC`, ✓ approved `#25A55F`/`#EDF8F1`) · action Inter 600 12.5px `#1F1B33` · client Inter 400 11.5px `#8A8A9A` · mode tag + timestamp Inter 11px `#9A9AAB`. **Action, client, and mode each on their own line.**

### Timeline (vertical)
2px `#F1F1F5` spine with the content column offset from it. Nodes 14–18px circles, 2–3px white border; current node filled `#6B4EE6` with the focus glow, past nodes white with a `#CFCFDA` border. Dates hang to the left of the spine; cards sit right. Keep the card column optically centred in the frame.

### Expandable entry
Header row `display: flex; gap: 11px;` padding `13px 15px`, `cursor: pointer`: tag pill · title Inter 600 14px (`flex: 1`) · 15px chevron rotating 180° over 150ms. Body divided by a 1px `#F5F5F8` top border, padding `0 15px 15px`, with small caps labels (Inter 700 10.5px `#9A9AAB`, `letter-spacing: .04em`) over Inter 13px `#5A5A6E` paragraphs.

### Message bubbles
Outbound: `#6B4EE6` bg, white text, radius `14px 14px 4px 14px`, right-aligned with a 30px initials avatar. Inbound: `#fff`, 1px `#ECECF2`, `#1F1B33`, radius `14px 14px 14px 4px`, avatar left. Body Inter 13.5px `line-height: 1.5`; meta line beneath Inter 11px `#9A9AAB` naming channel · sender · time, with a green tick for delivered. System events are a centred pill on a hairline rule.

### Toggle switch
34 × 19 pill, radius 999px, padding 2px, with a 15px white knob. On `#6B4EE6` (knob right); off `#CFCFDA` (knob left).

### Scrollbar
```css
.scrolly { overflow-y: auto; }
.scrolly::-webkit-scrollbar { width: 9px; height: 9px; }
.scrolly::-webkit-scrollbar-thumb { background: #DEDCE8; border-radius: 5px; }
```

---

## 5. Content rules

- **Currency** — GBP, `£1,234.56`. Large figures abbreviate as `1.42M`, `£298k`.
- **Deltas** — `▲ 8.4%` / `▼ 3.3%` or arrow icon + `8.4%`. Points not percent for rate changes: `▲ 1.8pts`. Add a qualifier when direction alone is ambiguous: `▼ 3.3% — improving`.
- **Dates** — `1 – 31 Jul 2026`, `17 Jul 2026`, `Tuesday, 15 July`. Times `3:44 PM`. Relative for recency: `4 min ago`, `2 hrs ago`.
- **Durations** — `4m 12s`, `3:42`, or `4,073` with a `(min)` label.
- **Client names** — real ones, in their own casing (Tylaesthetics, The Contour Co, Palm Peach Body Sculpt, BBL Body Confidence, Beauty Hub Mcr, Thee Vision Studio). Never "Client A".
- **Reasoning copy** — one sentence, threshold-shaped: *"£48 CPL vs £22 target · 0 leads in 5 days · £312 spent."*
- **Empty / all-clear states** — say what's true, not "nothing here": *"All looking good"*, *"Birdy is watching 9 more signals."*
- **No filler.** Every stat, icon and section must earn its place. An empty-feeling area is a layout problem, not a content gap.

---

## 6. Interaction principles

1. **The tool tells you what to do.** Screens open on actions and alerts, not static dashboards.
2. **Two actions per recommendation** — execute, or dismiss. Never more.
3. **Auto-run vs approved** is always visible in the audit trail.
4. **One scrollbar per region.** Toggle between panels instead of stacking scroll areas.
5. **Filters live in the header**; view switches (tabs) live above the content they filter.
6. **Dropdowns** close on selection, outside click, and Escape; option clicks stop propagation.
7. **Charts re-animate** on metric or timeframe change.
8. **Hover reveals figures** — never require a click to read a value.
9. **Colour by meaning, not direction** — respect inverted metrics.
10. **Status gets its own column.** Never overload the name cell.

---

## 7. Anti-patterns

- Aggressive full-page gradients. One purple card, maximum.
- Emoji in headings or body copy.
- Inter or Roboto for headings — headings and numerals are Poppins.
- Rounded containers with a left-border accent stripe.
- Shadows on ordinary cards (they're flat and bordered).
- New colours outside the palette.
- Two scrollbars in one column.
- Hand-drawn SVG illustrations or logos.
- Bare "View all" links where a metric dropdown would be more useful.
- Percentage bar heights inside a container with no resolved height (bars silently collapse).
- Chart series that are flat, identical across timeframes, or don't align with their axis labels.

---

## 8. Starter snippet

```html
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #EEEDF3; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: #6B4EE6; text-decoration: none; }
  a:hover { color: #5A3FD6; }
  .scrolly { overflow-y: auto; }
  .scrolly::-webkit-scrollbar { width: 9px; height: 9px; }
  .scrolly::-webkit-scrollbar-thumb { background: #DEDCE8; border-radius: 5px; }
</style>
```

Frame: `width: 1600px; height: 1040px; background: #F7F7FB; border: 1px solid #E3E3EC; border-radius: 16px; overflow: hidden; display: flex; box-shadow: 0 20px 50px -20px rgba(30,25,60,.25);`

Assets needed: the Birdy mascot PNG (rail logo, 38 × 38, radius 10px, 1px `#E3E3EC`), Poppins + Inter from Google Fonts, and an icon set in the Feather/Lucide style.

---

## 9. Screens already designed

For consistency, match the closest existing screen:

| Screen | Pattern |
|---|---|
| **Homepage** | Task feed — Birdy suggestions / Alerts / Client wins pill tabs, 75/25 split with a fixed activity feed |
| **Client Hub** | Compact KPI strip + inline tabs + wide data table with a status column |
| **Lead Detail** | Two columns — tabbed profile panel (Profile / Journey / Calls / Ads) with a pinned AI summary, plus the messaging thread |
| **Portfolio Dashboard** | KPI strip, switchable line chart, top-clients leaderboard, horizontal funnel + diagnostic, six call-insight cells, suggestions/activity rail |
| **Sales Hub** | Chart left (1.65) · Birdy insight card over six compact tiles right (0.85) · section tabs · client table |
| **Marketing Hub** | Same as Sales Hub, campaign metrics and table |
| **Admin** | Dark rail (`#1E1A2E`), agency-owner table with Impersonate, AI query analytics, affiliate tracking |
| **Changelog** | Public page — centred hero, filter pills + live search, dated timeline, expandable entries |

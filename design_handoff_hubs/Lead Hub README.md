# Handoff: Birdy — Lead Hub

## Overview

The Lead Hub is the all-leads view inside **Birdy**, an AI-powered support and operations layer for service-based local lead-gen agencies. Birdy connects Meta Ads data, GoHighLevel (GHL) lead data, and sales CRM / dialler data, then surfaces recommendations the team can approve or let Birdy execute.

This screen answers: **across every client group, who are our leads and contacts, and is lead quality holding up?** It pairs a switchable trend chart with a Birdy-written narrative summary, six compact KPI tiles, pipeline-stage tabs, and a searchable lead table.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established component library, styling approach, and data layer. If no environment exists yet, choose the most appropriate framework for the project and implement there.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state and data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction behaviour are final and should be matched closely. All values are documented under **Design Tokens**, and `Birdy Style Guide.md` in this bundle carries the full product-wide system if you need patterns beyond this screen.

---

## Screen: Lead Hub

**File:** `Lead Hub.dc.html`

**Frame:** 1600 × 1040 px, background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px, `overflow: hidden`.

### Top-level layout

Horizontal flex:

1. **Icon rail** — `flex: 0 0 68px`, `#fff`, right border 1px `#ECECF2`, vertical flex, `align-items: center`, padding `20px 0`, `gap: 8px`.
2. **Main column** — `flex: 1`, vertical flex, `min-width: 0`: header bar (64px), then one scrolling content area (padding `22px 24px`, custom scrollbar 9px, thumb `#DEDCE8` radius 5px).

There is no right rail on this screen.

### 1. Icon rail

- **Logo** — Birdy mascot, 38 × 38, radius 10px, 1px `#E3E3EC`, `object-fit: cover`, `margin-bottom: 14px`. Asset: `uploads/birdy-mascot.png`.
- **Nav items** — 44 × 44, radius 12px, centred 20 × 20 stroke icons (stroke-width 2, round caps/joins). Active: `#F1EEFC` bg, `#6B4EE6` icon. Inactive: transparent, `#9A9AAB`.
- Order: Dashboard (home) · Clients (users) · Birdy AI (sparkle) · Reports (line chart) · Call centre (phone) · **Leads (list, active)** · [spacer `margin-top: auto`] Settings (gear).
- **Rail footer**, in order: settings → green support icon (24px, `#25A55F`, with an 8px online dot top-right, 2px white border) → 28 × 1px `#ECECF2` divider → red logout icon (`#E5484D`) → 28 × 1px divider → `Beta 1.7` pill (Inter 600 10.5px `#8A8A9A` on `#F1F1F5`, padding `4px 7px`, radius 6px, `margin-top: 10px`).

### 2. Header bar

Height 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 16px`.

- **Title block** — `Lead Hub` Poppins 700 19px `#1F1B33`; sub `Every lead and contact across all client groups` Inter 400 12px `#9A9AAB` (`margin-top: 1px`).
- **Ask Birdy field** (centred, `flex: 1`, `max-width: 420px`) — height 38px, `#F4F4F8`, 1px `#ECECF2`, radius 10px, padding `0 13px`, `gap: 9px`. 15px sparkle icon `#6B4EE6`, placeholder `Ask Birdy about your marketing data…` Inter 400 13.5px `#9A9AAB`, trailing `⌘K` chip (Inter 11px on `#EAEAF0`, padding `2px 7px`, radius 5px).
- **Right cluster** (`margin-left: auto`, `gap: 10px`), in order:
  1. **Date range dropdown** — height 38px, `#fff`, 1px `#ECECF2`, radius 10px, padding `0 13px`, label Inter 600 13px `#5A5A6E`, leading 14px clock icon `#6B4EE6`, trailing 12px chevron. Options: Today / **Last 7 days** (default) / Last 30 days / This quarter. Menu width 170px.
  2. **Client group dropdown** — same chip styling with a building icon. Options: **All Groups** (default) / Plush Aesthetics / LA Body / The Contour Co / Fallon Physique / BBL Body Confidence / Aura. Menu width 250px.
  3. **Notification bell** — 38 × 38, radius 10px, `#F4F4F8`, red count badge `9` (`#E5484D`, white Inter 700 10px, 18px circle, offset `-4px`).
  4. **Avatar** — 38 × 38, radius 10px, `linear-gradient(135deg, #7B5FE6, #6B4EE6)`, white user icon.

Both menus: `position: absolute; top: 44px`, right-aligned, `#fff`, 1px `#ECECF2`, radius 12px, shadow `0 14px 34px -12px rgba(30,25,60,.28)`, padding 6px, `z-index: 20`. Rows padding `9px 11px`, radius 8px, Inter 500 13px; selected `#6B4EE6` on `#F1EEFC`, else `#5A5A6E` on transparent. Opening one closes the other.

### 3. Chart + insights row

`display: flex`, `gap: 18px`, `align-items: stretch`, `margin-bottom: 18px`.

#### 3a. Trend chart — `flex: 1.65`

Card `#fff`, 1px `#ECECF2`, radius 16px, padding `20px 22px`.

- **Header** — left: title Poppins 600 15px `#1F1B33`, subtitle Inter 400 12px `#9A9AAB` reading `"<Date range> · <metric sub>"`. Right: segmented control — `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`; items padding `7px 13px`, radius 8px, Poppins 600 12.5px; selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`, else `#6B6480`.
- **Total row** — `margin: 14px 0 16px`, baseline aligned, `gap: 10px`: total Poppins 700 28px `#1F1B33`; delta Inter 600 12.5px, `#25A55F` when good, `#E5484D` when bad.
- **Plot** — `position: relative`, height 190px; SVG layer inset `0 0 22px 0`, axis labels pinned bottom as equal-width flex cells.
  - SVG `viewBox="0 0 1000 200"`, `preserveAspectRatio="none"`, 100% × 100%.
  - Area: `linearGradient` `#6B4EE6` 0.18 → 0. Line: `#6B4EE6`, `stroke-width: 3`, round caps/joins, `vector-effect: non-scaling-stroke`.
  - Dots 10 × 10, radius 50%, 2px white border, `margin: -5px 0 0 -5px`. Latest point `#6B4EE6` with glow `0 0 0 4px rgba(107,78,230,.18)`; others `#A98BF5`.
  - Axis labels: Inter 400 10.5px `#9A9AAB`.

**Chart geometry (so dots align with labels):** with `n` points, `halfCol = 100 / (2n)`; point *i* at `x% = halfCol + i * (100 - 2·halfCol) / (n - 1)` — centred over its axis label, not edge to edge. Normalise y between series min and max with 14 units of padding in the 200-unit viewBox. Close the area path at the **first and last data points**, not the frame edges.

**Metric tabs** (4):

| Tab | Title | Subtitle | Total | Delta | Good? | Series | ×mult |
|---|---|---|---|---|---|---|---|
| Leads (default) | Total leads | Lead volume across all client groups | 1,525 | ▲ 7.2% | green | `52,61,58,70,66,74,69,80,86,79,92,100` | 15 |
| Contacts | Total contacts | Contacts captured without a lead form | 448 | ▲ 4.6% | green | `70,64,78,58,82,66,74,60,86,71,63,80` | 5 |
| Open | Open leads | Leads still in an open opportunity stage | 1,425 | ▲ 5.4% | green | `48,55,62,58,66,72,64,78,70,84,80,90` | 16 |
| Conversion | Conversion rate | Share of leads converting to a won opportunity | 2.6% | ▼ 0.4pts | **red** | `74,66,81,58,88,63,77,70,84,60,90,72` | 0.03 |

Axis labels: `Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul` (Aug–Dec = 2025, Jan–Jul = 2026). Tooltip values format as counts, except Conversion which renders one decimal place plus `%`. Series are placeholders — drive from the real API; the multipliers exist only so tooltips read as plausible figures.

#### 3b. Right column — `flex: 0.85`

Vertical flex, `gap: 14px`.

**Birdy insights card** — `linear-gradient(135deg, #6B4EE6, #8B6BF0)`, 1px `#5A3FD6`, radius 16px, padding `16px 18px`, shadow `0 10px 26px -12px rgba(107,78,230,.6)`. This is deliberately the only saturated surface on the page — it marks Birdy's own voice.

- Header row (`gap: 8px`, `margin-bottom: 9px`): 26 × 26 radius 8px chip `rgba(255,255,255,.2)` with a white 14px sparkle · `Birdy Insights` Poppins 600 13.5px `#fff` · `AI` badge (`margin-left: auto`, Inter 700 10.5px `#fff` on `rgba(255,255,255,.22)`, padding `2px 8px`, radius 5px).
- Body — Inter 400 12.5px `rgba(255,255,255,.88)`, `line-height: 1.5`, figures and names in `<strong style="color:#fff">`. Current copy: *"Lead volume is up **7.2%** but conversion has fallen to **2.6%**. **Fallon Physique** has 214 contacts with no email captured — fixing that form would unlock your largest untouched pool."*
- Footer link — `Ask Birdy about this` + 13px chevron, Inter 600 12px `#fff`, `margin-top: 11px`.

Generated per period: state the headline movement, then name the single most actionable anomaly with its numbers.

**KPI tiles** — `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 10px`. Six tiles, each a single row: `display: flex`, `align-items: center`, `gap: 9px`, `#fff`, 1px `#ECECF2`, radius 12px, padding `11px 12px`, `min-width: 0`.

- Icon chip 28 × 28, radius 8px, centred 14px icon.
- Text: value Poppins 700 17px `#1F1B33` (`line-height: 1`); label Inter 400 11px `#8A8A9A`, `margin-top: 3px`, ellipsis.
- Delta pill (`margin-left: auto`): Inter 700 10.5px, padding `3px 6px`, radius 6px, 10px arrow (stroke-width 3). Good `#25A55F` on `#EDF8F1`; bad `#E5484D` on `#FEF1F1`.

| Tile | Value | Delta | Good? | Chip bg / icon colour | Icon |
|---|---|---|---|---|---|
| Total leads | 1,525 | ▲ 7.2% | green | `#F1EEFC` / `#6B4EE6` | user-check |
| Total contacts | 448 | ▲ 4.6% | green | `#EAF1FD` / `#3B7DD6` | users |
| Opportunities | 1,528 | ▲ 6.1% | green | `#EDF8F1` / `#25A55F` | target |
| Open leads | 1,425 | ▲ 5.4% | green | `#F1EEFC` / `#6B4EE6` | trending-up |
| Lost leads | 63 | ▲ 9.8% | **red** | `#FEF1F1` / `#E5484D` | x-circle |
| Conversion rate | 2.6% | ▼ 0.4pts | **red** | `#FDF1E7` / `#B4530A` | trending-down |

**Inverted metrics:** *Lost leads* rising is bad (red with an up arrow) and *Conversion rate* falling is bad (red with a down arrow). Colour by **meaning**, never by arrow direction.

### 4. Pipeline tabs + table controls

`margin-bottom: 14px`, `gap: 12px`.

- **Tabs** (left) — container `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`; items `gap: 7px`, padding `7px 15px`, radius 8px, Poppins 600 13px. Selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`; unselected `#6B6480`. Each carries a count badge (Inter 700 10.5px; selected `#6B4EE6` on `#F1EEFC`, else `#8A8A9A` on `#E7E7ED`).
- Tabs: **All Leads** `1,525` (default) · **Open** `1,425` · **Won** `40` · **Abandoned** `18` · **Lost** `63`.
- **Right controls** — search field (38px, `#fff`, 1px `#ECECF2`, radius 10px, 200px, magnifier icon, placeholder `Search leads…`) · `Filters` chip (funnel icon) · `Columns` chip (sliders icon + chevron).

### 5. Lead table

Card `#fff`, 1px `#ECECF2`, radius 16px, `overflow: hidden`, inner region `overflow-x: auto` with `min-width: 1420px`.

- **Header row** — padding `13px 22px`, bottom border 1px `#ECECF2`, background `#FAFAFC`, Inter 700 11.5px `#9A9AAB`, `letter-spacing: .03em`.
- **Body rows** — padding `12px 22px`, bottom border 1px `#F5F5F8`. Rows **zebra-stripe** alternating `#FCFCFD` and `#fff`.

Ten columns, in order, with flex weights:

| # | Column | Weight | Notes |
|---|---|---|---|
| 1 | *(row select)* | `0 0 26px` | Checkbox — 15 × 15, 1.5px border (`#CFCFDA` header, `#DFDFE8` rows), radius 4px, unchecked |
| 2 | `NAME` | 1.5 (`min-width: 150px`) | Inter 600 13.5px `#1F1B33`, ellipsis, `padding-right: 12px`. **Falls back to the phone number** when no name was captured (e.g. `07402 181878`) |
| 3 | `CLIENT GROUP` | 1.7 (`min-width: 170px`) | Inter 400 13.5px `#5A5A6E`, ellipsis |
| 4 | `EMAIL` | 1.7 (`min-width: 170px`) | Inter 500 13.5px `#1F1B33` when present; renders `–` in `#CFCFDA` at weight 400 when missing |
| 5 | `PHONE` | 1.2 | Inter 400 13.5px `#5A5A6E`; E.164 format (`+447962065699`), `–` when absent |
| 6 | `DATE ADDED ↓` | 1 | **Active sort column** — header label plus a `↓` arrow in `#1F1B33`; cells Inter 400 13.5px `#9A9AAB` |
| 7 | `TAGS` | 1.4 | First tag as a chip (Inter 400 11px `#5A5A6E` on `#F4F4F8`, 1px `#ECECF2`, padding `3px 8px`, radius 6px, ellipsis, `max-width: 150px`) plus a `+n` overflow badge (Inter 700 10.5px `#6B4EE6` on `#F1EEFC`, padding `3px 7px`, radius 6px). Renders `–` in `#CFCFDA` when untagged |
| 8 | `TYPE` | 0.7 | Pill, Inter 600 11px, padding `3px 9px`, radius 6px. **Lead** `#6B4EE6` on `#F1EEFC`; **Contact** `#8A8A9A` on `#F1F1F5` |
| 9 | `STATUS` | 0.9 | Pill with a 6px leading dot in the same colour. Open `#3B7DD6` on `#EAF1FD` · Won `#25A55F` on `#EDF8F1` · Lost `#E5484D` on `#FEF1F1`. Contacts have no status — render `—` in `#CFCFDA` |
| 10 | `VALUE` | 0.7 | Inter 500 13.5px `#1F1B33`; `—` in `#CFCFDA` when absent |

**The Lead vs Contact distinction is the core data model here.** A *Lead* submitted a form: it has an email, tags, an opportunity status, and a value. A *Contact* was captured some other way (usually an inbound call): often no name, no email, no status, no value. Roughly a third of rows are Contacts — the design must look correct with that many empty cells, which is why every missing value has an explicit muted placeholder rather than blank space.

Sample data (15 rows, sorted by date added descending — all `Aug 17, 2026`):

| Name | Client group | Email | Phone | Tags | Type | Status | Value |
|---|---|---|---|---|---|---|---|
| Jackie Roberts | Plush Aesthetics | home.jroberts@gmail.com | +447962065699 | fb lead form submitted +5 | Lead | Open | £349 |
| Fatna Addou | Lizzie Jayne's Beauty (Body Sculpting) | hananeaddou@gmail.com | +447526873132 | fb lead form submitted +6 | Lead | Open | £349 |
| Linda Marshall | LA Body | lmarshall327@gmail.com | +447881367225 | fb lead form submitted +9 | Lead | Open | £349 |
| 07402 181878 | Fallon Physique (Celebrity Face Sculpt) | – | +447402181878 | fallon-physique-face-hp-lead | Contact | — | — |
| Rebecca Connor | The Cosmetic Clinic MCR | re.connor@yahoo.co.uk | +447467534489 | fb lead form submitted +6 | Lead | Open | £349 |
| Ellen-scott Ashcroft | BBL Body Confidence | – | – | – | Contact | — | — |
| 07706 508139 | Fallon Physique (Celebrity Face Sculpt) | – | +447706508139 | fallon-physique-face-hp-lead | Contact | — | — |
| Nasima Khalique | Sculpted By Hayley | nasima_k@yahoo.co.uk | +447788883031 | fb lead form submitted +4 | Lead | Open | £349 |
| Carly_s_thompson | Fake It Aesthetics | – | – | – | Contact | — | — |
| 089 945 0903 | Casey Beauty and Aesthetics | – | +353899450903 | – | Contact | — | — |
| 07365 467815 | Fallon Physique (Celebrity Face Sculpt) | – | +447365467815 | fallon-physique-face-hp-lead | Contact | — | — |
| Obiribea Comfort | Glow By Leanne (Lymphatic Drain) | comfort.obiribea21@yahoo.com | +447387439215 | fb lead form submitted +5 | Lead | Open | £349 |
| Emma Davies Edensor | Simplea You | emmaldavies2005@gmail.com | +447305691493 | fb lead form submitted +12 | Lead | **Won** | £349 |
| Sheena Martin | The Contour Co | sheena.martin@sky.com | +447545623609 | fb lead form submitted +10 | Lead | Open | £349 |
| Hayley Prentice | Aura | h.prentice88@gmail.com | +447911204487 | fb lead form submitted +7 | Lead | **Lost** | £349 |

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| **Date range dropdown** | Lives in the header. Click toggles the menu and closes the client group menu. Selecting updates the chart subtitle prefix and, in production, every figure on the page. |
| **Client group dropdown** | Same pattern; filters the whole view — chart, tiles, tab counts and table — to one client group. |
| **Dropdown option clicks** | Must `stopPropagation` — otherwise the click bubbles to the trigger's toggle and reopens the menu immediately. (This was a real bug in the prototype.) |
| **Chart metric tabs** | Swap title, subtitle, total, delta (and its colour), series and point formatting; trigger the redraw animation. |
| **Chart point hover** | `mouseenter` stores the index, `mouseleave` clears it. Tooltip: `#1F1B33`, white text, padding `6px 10px`, radius 8px, shadow `0 6px 16px -6px rgba(30,25,60,.5)`, `pointer-events: none`, 15px above the dot and horizontally centred — value Poppins 700 12.5px over month + year Inter 400 10.5px `#C9BEF3`. |
| **Chart redraw** | Line animates `stroke-dasharray: 2400` with `stroke-dashoffset: 2400 → 0` over **800ms `cubic-bezier(.4, 0, .2, 1)` forwards**; area fades `opacity: 0 → 1` over **800ms ease-out**. The prototype alternates two keyframe names to force a restart — in a real framework, key the chart on the selected metric so it replays. |
| **Pipeline tabs** | Filter the table to that opportunity stage; the counts come from the same query. |
| **Row select checkbox** | Selects leads for bulk actions. The header checkbox selects all visible rows; a selection should reveal a bulk action bar (tag, assign, export, change stage). Not wired in the prototype. |
| **Column sort** | Sorted by DATE ADDED descending by default, shown by a `↓` beside the header label. Clicking a header re-sorts and moves the indicator. Not wired. |
| **Row click** | Should open the Lead Detail screen for that lead. Not wired. |
| **Search / Filters / Columns** | Not wired — search should filter rows live; Filters opens a facet panel (type, status, tag, group); Columns opens a visibility menu. |
| **Ask Birdy about this** | Opens the Birdy assistant seeded with the current period and summary context. Not wired. |
| **Menus** | Should also close on outside click and `Escape` in production. |

## State Management

```
tab:        'All Leads' | 'Open' | 'Won' | 'Abandoned' | 'Lost'   // default 'All Leads'
range:      'Today' | 'Last 7 days' | 'Last 30 days' | 'This quarter'  // default 'Last 7 days'
group:      'All Groups' | <client group name>                    // default 'All Groups'
rangeMenu:  boolean         // header date-range menu open
groupMenu:  boolean         // header client-group menu open
metric:     'leads' | 'contacts' | 'open' | 'conversion'          // default 'leads'
hover:      number | null   // hovered chart point index
anim:       number          // increments to restart the chart animation
```

Derived from state: chart series/labels/total/delta, tooltip visibility, tab styling and badges, animation names.

**Data the real implementation needs:**
- Lead aggregates for the selected range and group — total leads, total contacts, opportunities, open leads, lost leads, conversion rate, each with a period-over-period delta and a flag for whether a rise is good.
- Time series per chart metric (leads, contacts, open, conversion).
- Opportunity-stage counts for the five pipeline tabs.
- A generated Birdy insight naming the headline movement plus the most actionable anomaly and the entities it references.
- Per-lead rows: name (with a phone fallback), client group, email, phone, date added, tag list (first tag plus overflow count), record type (lead vs contact), opportunity status, and value — with explicit nulls so the muted placeholders render correctly.

## Design Tokens

**Colour**

| Token | Hex | Use |
|---|---|---|
| Primary | `#6B4EE6` | Brand, active nav, chart line, insight card, Lead pill |
| Primary deep | `#5A3FD6` | Insight card border |
| Primary gradient | `#7B5FE6 → #6B4EE6` | Avatar |
| Insight gradient | `#6B4EE6 → #8B6BF0` | Birdy insights card (135deg) |
| Primary tint | `#F1EEFC` | Active nav bg, chips, badges |
| Primary light | `#A98BF5` | Non-latest chart dots |
| Primary pale | `#C9BEF3` | Tooltip subtext |
| Ink | `#1F1B33` | Headings, values, tooltip bg |
| Body | `#5A5A6E` | Table cells, control labels |
| Muted | `#6B6480` | Inactive tabs |
| Subtle | `#8A8A9A` | Labels, Contact pill text, beta pill |
| Faint | `#9A9AAB` | Meta, inactive icons, axis labels, table headers, date cells |
| Placeholder | `#CFCFDA` | Empty-cell dashes, unchecked header checkbox |
| Border input | `#DFDFE8` | Row checkboxes |
| Divider soft | `#F5F5F8` | Table row borders |
| Divider | `#F1F1F5` | Segmented bg, Contact pill bg |
| Badge neutral | `#E7E7ED` | Unselected tab count badge |
| Field | `#F4F4F8` | Ask Birdy field, bell, tag chips |
| Border | `#ECECF2` | Cards, controls |
| Border strong | `#E3E3EC` | Frame border, mascot border |
| Table head | `#FAFAFC` | Table header row |
| Row zebra | `#FCFCFD` | Alternate table row |
| Surface | `#fff` | Cards, rails, rows |
| Canvas | `#F7F7FB` | App background |
| Desk | `#EEEDF3` | Page behind the frame |
| Scrollbar thumb | `#DEDCE8` | Custom scrollbars |
| Success | `#25A55F` / bg `#EDF8F1` | Positive deltas, Won status, opportunities chip, support icon |
| Danger | `#E5484D` / bg `#FEF1F1` | Negative deltas, Lost status, lost-leads chip, logout icon, notification badge |
| Amber | `#B4530A` / bg `#FDF1E7` | Conversion-rate chip |
| Info | `#3B7DD6` / bg `#EAF1FD` | Contacts chip, Open status |

**Typography** — Poppins (500/600/700) for headings, numerals and control labels; Inter (400/500/600/700) for body and meta. Both from Google Fonts.

Scale: 28px/700 chart total · 19px/700 page title · 17px/700 KPI tile values · 15px/600 card titles · 13.5px/600 lead names, insights title, control labels · 13.5px/400 table cells · 13px/600 pipeline tabs · 12.5px/600 chart tabs · 12.5px/400 insights body · 12px/400 labels, subtitles · 11.5px/700 table headers · 11px/600 status & type pills · 11px/400 tile labels, tag chips · 10.5px/700 delta pills, count badges · 10.5px/400 chart axis labels.

Body copy `line-height: 1.5`.

**Spacing** — 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 24 · 26 px. Card padding `20px 22px`; tile padding `11px 12px`; table row `12px 22px`; header bar `0 26px`; content `22px 24px`; row gap 18px; tile grid gap 10px.

**Radius** — 4px checkboxes · 5px small badges · 6px pills, tag chips, beta pill · 8px icon chips, segmented items, menu rows · 10px controls, mascot, buttons · 12px nav items, tiles, popovers · 16px cards and frame · 50% dots and status dots · 999px n/a on this screen.

**Shadow** — frame `0 20px 50px -20px rgba(30,25,60,.25)` · insight card `0 10px 26px -12px rgba(107,78,230,.6)` · selected segment `0 2px 8px -2px rgba(107,78,230,.35)` · popover `0 14px 34px -12px rgba(30,25,60,.28)` · tooltip `0 6px 16px -6px rgba(30,25,60,.5)` · chart point glow `0 0 0 4px rgba(107,78,230,.18)`.

Cards are otherwise **flat** — 1px `#ECECF2` border, no shadow.

**Motion** — chart line draw 800ms `cubic-bezier(.4, 0, .2, 1)`; area fade 800ms ease-out.

## Content rules

- **Currency** — GBP, `£349`.
- **Deltas** — arrow icon plus a bare percentage (`7.2%`), or points for rate changes (`0.4pts`).
- **Dates** — `Aug 17, 2026` in the table; ranges as `Last 7 days` in controls.
- **Phone** — E.164 (`+447962065699`) in the phone column; the local format (`07402 181878`) only when it stands in for a missing name.
- **Client groups** — real names in their own casing, including parenthetical service qualifiers: `Fallon Physique (Celebrity Face Sculpt)`, `Lizzie Jayne's Beauty (Body Sculpting)`, `Glow By Leanne (Lymphatic Drain)`.
- **Tags** — lowercase, hyphenated (`fb lead form submitted`, `fallon-physique-face-hp-lead`).
- **Empty values** — always an explicit muted placeholder: `–` (en dash) for missing text fields, `—` (em dash) for missing status and value. Never a blank cell.

## Assets

- **`uploads/birdy-mascot.png`** — Birdy mascot, used as the rail logo at 38 × 38 with a 1px `#E3E3EC` border and 10px radius. Supplied by the client; included in this bundle.
- **Icons** — all inline SVG on a 24 × 24 viewBox, `fill: none`, `stroke: currentColor`, `stroke-width: 2` (3 for delta arrows), round caps and joins. They match the Feather/Lucide vocabulary — substitute the equivalent from the codebase's existing icon library rather than pasting these paths.
- **Fonts** — Poppins and Inter via Google Fonts. Use whatever font loading the codebase already has.

## Files

- **`Lead Hub.dc.html`** — the design, extracted as a standalone page. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system: full token set, every shared component spec, content and interaction principles, anti-patterns, and a map of the other Birdy screens. Use it for anything this screen doesn't cover.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

**Sibling screens:** Lead Hub shares its shell, header, chart, insight card and tile anatomy with **Sales Hub** and **Marketing Hub**. If those are being built in the same codebase, extract the shell, chart, insight card, KPI tile, dropdown and table as shared components — only the metrics, tabs and table columns differ between them.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `Lead Hub.dc.html` — opening straight from the filesystem may block the local script and image.

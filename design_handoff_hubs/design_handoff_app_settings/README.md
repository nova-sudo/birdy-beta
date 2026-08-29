# Handoff: Birdy — Settings

## Overview

The workspace-level Settings page for **Birdy**, an AI-powered support and operations layer for service-based local lead-gen agencies. This is a redesign of an earlier, plainer settings screen to match Birdy's current visual system — three tabs: **General**, **Integrations**, and **Billing**.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show intended look and behaviour. They are **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established component library, styling approach, and data layer. If no environment exists yet, choose the most appropriate framework for the project and implement there.

The prototype uses a small in-house template runtime (`support.js`). Do not port that runtime — read the markup for structure/styling and the logic class for state and data shape, then rebuild idiomatically.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, and interaction behaviour are final and should be matched closely. All values are documented under **Design Tokens**, and `Birdy Style Guide.md` in this bundle carries the full product-wide design system for anything this screen doesn't cover.

---

## Screen: Settings

**File:** `App Settings.dc.html`

**Frame:** 1600 × 1000 px, background `#F7F7FB`, 1px border `#E3E3EC`, radius 16px, `overflow: hidden`.

### Top-level layout

Horizontal flex: **icon rail** (`flex: 0 0 68px`) → **main column** (`flex: 1`): header bar (64px), then one scrolling content area (padding `22px 24px`) with a tab strip and one of three panels below it.

### 1. Icon rail

Standard Birdy rail — mascot logo, nav icons (Settings gear is active, `#F1EEFC`/`#6B4EE6`), green support icon with online dot, red logout icon, `Beta 1.7` pill at the bottom. See `Birdy Style Guide.md` for exact metrics.

### 2. Header bar

Height 64px, `#fff`, bottom border 1px `#ECECF2`, padding `0 26px`, `gap: 16px`.

- **Left** — the page title sits directly in the header (matching the Sales/Marketing/Lead Hub pattern, not a separate heading in the content area): `Settings` Poppins 700 19px `#1F1B33`, sub `Workspace, integrations and AI configuration` Inter 400 12px `#9A9AAB`.
- **Centre** — Ask Birdy field (`flex: 1`, `max-width: 420px`), same as every Birdy screen.
- **Right** (`margin-left: auto`) — notification bell (`#F4F4F8`) and avatar (gradient `#7B5FE6 → #6B4EE6`).

### 3. Tab strip

`margin-top: 18px`, `margin-bottom: 18px`, `width: fit-content`. Segmented control: `#F1F1F5`, 1px `#ECECF2`, radius 10px, padding 4px, `gap: 5px`. Items padding `9px 20px`, radius 8px, Poppins 600 13px. Selected `#1F1B33` on `#fff` + shadow `0 2px 8px -2px rgba(107,78,230,.35)`; unselected `#6B6480` on transparent. Tabs, in order: **General** (default) · **Integrations** · **Billing**.

### 4. General tab

**Top row** — `display: grid; grid-template-columns: 1fr 1fr; gap: 18px`:

- **General settings card** — title (Poppins 600 16px) + subtitle (`Manage your general application and account settings`, Inter 400 13px `#9A9AAB`) + divider, then: **Name** field (value `SOUP Marketing`), **Email** field (value `hello@soupgrowth.com`), then a 2-column sub-grid for **Timezone** (`GMT (London)`) and **Currency** (`£ GBP`) — both styled as dropdown triggers (value + trailing chevron), though not wired to open a menu in this build.
- **Password card** — title + subtitle (`Change your account password`) + divider, then **Current password**, then a 2-column grid for **New password** / **Confirm new password** (all masked `••••••••`), then a primary "Update password" button (`#6B4EE6` fill, `width: fit-content`).

**Below, full width:** **Notification preferences card** (`max-width: 900px`) — title + subtitle (`How often Birdy sends your Slack brief`) + divider, then two selectable cards side by side: **Daily** (`A summary every morning`) and **Weekly** (`One digest each Monday`) — 2px border, selected state `#6B4EE6` border + `#F1EEFC` fill. Selecting reveals inline config **in the same card, beneath the cards**:
  - Daily → a single "What time?" field (`max-width: 220px`).
  - Weekly → two fields side by side: "Which day?" and "What time?".

Field label convention throughout: Inter 600 12.5px `#1F1B33`, `margin-bottom: 7px`, with the value/control in a 1px `#ECECF2` bordered box (radius 9px, padding `10px 12px`, Inter 13.5px).

### 5. Integrations tab

Header: `Connected services` (Poppins 600 16px) + `Manage your third-party service integrations` (Inter 400 13px `#9A9AAB`).

Four equal-width tiles in a row (`flex: 1` each, `gap: 14px`), each a `#fff` card, 1px `#ECECF2`, radius 14px, padding `16px 18px`, flex column:

- Header row: 30×30 radius-9px icon chip (brand colour), name (Poppins 600 14px, ellipsis), and a `Connected` badge (`margin-left: auto`, Inter 700 10.5px `#25A55F` on `#EDF8F1`, padding `3px 8px`, radius 6px).
- One-line description (Inter 400 12px `#8A8A9A`, `min-height: 34px` so tiles align even when descriptions wrap differently).
- A key/value row (e.g. `Expires` / `28/08/2026`, or `Workspace` / `SOUP`).
- **Slack only:** an extra sub-section above the actions — a bordered dropdown trigger showing the AI-suggestions Slack channel (`#birdy-ai-suggestions`) with a trailing chevron. Kept deliberately minimal — no extra copy, just the dropdown.
- Footer actions (`margin-top: auto` so they pin to the bottom of the tile regardless of content height): a "Connected" pill (purple fill `#6B4EE6`, white tick icon, `flex: 1`) and, where applicable, a square icon button with a trash-can glyph (1px `#ECECF2` border) for removing the integration.

The four integrations shown: **Slack**, **GoHighLevel**, **Meta**, **Hot Prospector**.

### 6. Billing tab

**Birdy Credits section** — title (Poppins 600 16px, matching the other card titles) + subtitle explaining the credit system (`A credit is about one cent of AI work…`).

- **Credits row** (`display: flex; gap: 14px`): a fixed-width (`flex: 0 0 220px`) green credits-left card (`#EDF8F1`/`#D5EEDF`, "Credits left" label, Poppins 700 26px `#1F9D63` value, small print below), immediately followed by **four credit-pack tiles** (`flex: 1` each) in the same row — 1,000/$10, 2,500/$25, 5,000/$50, 10,000/$90 — each with a lightning-bolt icon chip, pack name (Poppins 600 14px) + price, and an "Add credits" button pinned to the bottom (`margin-top: auto`).
- **Usage + payment row** (`display: flex; gap: 14px`): a **70/30 split** —
  - **Usage — last 30 days** (`flex: 0.7`): header with a summary (`25 questions · 503 credits`), a 170px chart area with a y-axis scale (0/35/70/105/140) and x-axis date labels, and two legend chips below (`Ask Birdy 500 credits`, `Suggestions 4 credits`). The chart itself is a placeholder area — wire it to the real per-day credit-usage series.
  - **Payment methods** (`flex: 0.3`): title (Poppins 600 15px — intentionally one step down from the 16px main-card tier since this is a nested side-card), a compact row per card (brand mark, masked number, a `Default` badge on the default card), and a dashed "Add new card" button pinned to the bottom.
- **Your plan section** — title (Poppins 600 16px) + subtitle (`You're currently on the **Growth** plan · 6 of 10 client groups used`), then three plan cards in a row: **Starter** ($97/mo, Downgrade), **Growth** ($297/mo, 2px purple border + "MOST POPULAR" ribbon, Current plan — disabled-style button), **Scale** ($497/mo, Upgrade, green accent). Each card: icon chip + name + client-count sub-line, then a large price (Poppins 700 24px) + `/mo`, then the CTA button.

---

## Interactions & Behaviour

| Interaction | Behaviour |
|---|---|
| **Tab strip** | Click sets the active tab; exactly one of General/Integrations/Billing shows. |
| **Notification frequency cards** | Click selects Daily or Weekly; the inline time/day fields below update to match. Does not auto-advance (unlike the onboarding flow's version of this control) — the user can change their mind before saving. |
| **Timezone / Currency / time-of-day fields** | Styled as dropdown triggers but not wired to open a menu in this prototype — implement as real selects. |
| **Integration "Connected" pill** | Currently a static status indicator, not a toggle — clicking should probably open a detail/manage view rather than disconnect (disconnecting is the trash-can icon's job). |
| **Trash-can icon (integration tiles)** | Should prompt to disconnect/remove that integration. |
| **Slack channel dropdown** | Should open a searchable channel picker (same pattern as elsewhere in Birdy) and update where Birdy posts AI suggestions. |
| **Credit pack "Add credits"** | Should kick off a purchase flow for that credit quantity. |
| **Plan cards** | Starter/Scale buttons should open a plan-change flow (likely the "Whop customer portal" referenced in the source reference material); Growth's button is inert since it's the current plan. |
| **Payment method actions** | Set as default / Set as backup / Remove per non-default card; a dashed "Add new card" opens a card-entry flow. |
| **Update password** | Should validate current password and confirm-match before submitting. |

## State Management

```
tab:      'General' | 'Integrations' | 'Billing'   // default 'General'
capMedia: boolean   // legacy — no longer used since Capabilities tab was removed; safe to drop
freq:     'daily' | 'weekly'                        // default 'daily'
```

**Data the real implementation needs:**
- Workspace account fields (name, email), timezone, currency.
- Password-change flow with server-side validation.
- Notification frequency + time/day, persisted and driving the real Slack-brief scheduler.
- Live integration connection status, per-service metadata (expiry, workspace/group id), and the AI-suggestions Slack channel.
- Credit balance, credit-pack pricing (likely from Stripe/Whop), and the last-30-days usage series broken down by source (Ask Birdy vs Suggestions).
- Current plan, plan catalogue (Starter/Growth/Scale pricing and limits), and client-group usage (`6 of 10`) for the plan-usage sentence.
- Saved payment methods with default/backup flags.

## Design Tokens

Inherits the full Birdy palette, type scale, spacing, radius and shadow tokens from `Birdy Style Guide.md`. This screen's typography was explicitly normalised to the shared hierarchy:

- **Main card titles** (one per card, top-level): Poppins 600 16px `#1F1B33` — `General settings`, `Password`, `Notification preferences`, `Connected services`, `Birdy Credits`, `Your plan`.
- **Card subtitles**: Inter 400 13px `#9A9AAB`, directly under the title.
- **Nested/side-card titles** (a card living inside a larger section, one tier down): Poppins 600 15px — currently only `Payment methods`.
- **Compact tile names** (name inside a small repeated tile — integrations, credit packs, plans): Poppins 600 14px `#1F1B33`.
- **Field labels**: Inter 600 12.5px `#1F1B33`.
- **Field values / body inside bordered boxes**: Inter (400/500) 13.5px.
- **Meta/help text**: Inter 400 11–12px `#9A9AAB`/`#8A8A9A`.

Additional screen-specific colours:

| Token | Hex | Use |
|---|---|---|
| Success surface | `#EDF8F1` / border `#D5EEDF` / text `#1F9D63` | Credits-left card |
| Slack/Hot Prospector chip | `#F1EEFC` / `#6B4EE6` | Icon backgrounds |
| GHL/Meta chip | `#EAF1FD` / `#3B7DD6` | Icon backgrounds |
| Danger (remove) | `#E5484D` / bg `#FEF6F6` / border `#F8DEDE` | Integration remove states (legacy — current build uses a plain icon button instead) |
| Plan accent — Starter | `#3B7DD6` | Icon + button fill |
| Plan accent — Growth | `#6B4EE6` | Icon + 2px border + button fill + "MOST POPULAR" ribbon |
| Plan accent — Scale | `#1F9D63` | Icon + button text/border |

## Assets

- **`uploads/birdy-mascot.png`** — rail logo, 38 × 38, 1px `#E3E3EC` border, 10px radius.
- **Icons** — inline SVG, 24 × 24 viewBox (scaled down per context), Feather/Lucide-style, stroke-width 2. Brand marks (Slack, Meta, Visa, Mastercard) are simplified glyphs — substitute the real brand assets in production.
- **Fonts** — Poppins and Inter via Google Fonts.

## Files

- **`App Settings.dc.html`** — the design, extracted as a standalone page. **This is the reference to build from.**
- **`Birdy Style Guide.md`** — the product-wide design system for shared components (dropdowns, buttons, cards, tabs) referenced throughout this screen.
- **`support.js`** — the prototype's template runtime. Required only to open the HTML locally; **do not port it**.
- **`uploads/birdy-mascot.png`** — the mascot asset.

To view: serve the folder over HTTP (e.g. `python3 -m http.server`) and open `App Settings.dc.html` — opening straight from the filesystem may block the local script and image.

# Birdy redesign: design tokens, primitives and shell

- **Date:** 2026-11-19
- **Ticket:** none; the work proceeds untracked
- **Plan:** `docs/superpowers/plans/2026-11-19-redesign-design-system.md`
- **Reference build:** `birdy-redesign-2026-11-18-clean.zip` (Javi's front-end mock on mock data). Click-through: https://birdy-javi.vercel.app/
- **Mock-up boards:** `~/Desktop/Birdy/mocks/redesign-tokens/` (eight boards, one per decision; shared files `shared.css`, `icons.js`, `birdy-mascot.png`)
- **Repo:** `birdy-beta`, in the main checkout on branch `feat/redesign-design-system`, created from `origin/main`.

## Goal

Birdy is being redesigned screen by screen to match the reference build. This spec covers the first step: one new design system that every rebuilt screen will use.

It delivers three things:

- a token set (colour, type, corners, shadows, spacing, sizes, motion);
- a kit of components built only from those tokens;
- the app shell (rail, client switcher, section header, tab pill).

Nothing a user sees changes in this step. The kit and shell are shown on a dev-only preview page.

## Why a new token set

The reference build's look is approved, but its styling is not a system:

- `tokens.css` has about 80 variables with unclear names and three overlapping red/amber/green sets;
- most values bypass it: about 150 raw `#fff`, 40+ other hard-coded colours (including a second purple), about 25 text sizes with half pixels, 15 corner sizes and 20 one-off shadows;
- its red, amber and green status pills fail the 4.5:1 text contrast standard (4.1 to 4.3).

`birdy-beta` has three component sets on `origin/main`: `src/components/ds/` (67 components, ported from Bytes, used by 112 files), the shadcn set in `src/components/ui/` (98 files) and the `pd-*` kit (184 files). `globals.css` holds 609 custom properties.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Codebase | Port the redesign into `birdy-beta`. The ZIP is the reference, not the new app. |
| Look | Locked to the reference build. This work systematises it; it does not restyle it. |
| Relation to existing kits | A new kit beside `ds`, `ui` and `pd-*`. The old sets are left untouched and deleted once no screen reads them. |
| Themes | Light only. Tokens are named by role so a dark theme is one extra block of values later. |
| Scope | Tokens, core components and the shell. Screens come after. |
| Mascot | Always inside its round frame, including on the rail. |
| Sizes | Standard Tailwind size classes. The app's base font size is 15.5px, so every size renders about 3% smaller than its nominal value; this is accepted. |
| Preview page | `/kit` runs on the development server only, until the redesign is done. |
| Radio button | Adds the `@radix-ui/react-radio-group` package. |
| Fonts | Poppins is self-hosted in `src/fonts/` and loaded only by the preview page for now. |

### The eight picks

Each pick has a board in the mock-ups folder. The chosen option on the board is the source of truth for its values.

| # | Board file | Pick | What it means |
|---|---|---|---|
| 01 | `01-colour.html` | B · Tuned | One violet-tinted grey ramp, purple `#6544ee`, status colours darkened to pass contrast |
| 02 | `02-type.html` | B · Poppins + Inter | Poppins for headings and figures, Inter for everything else; eight sizes, three weights |
| 03 | `03-shape-depth.html` | B · Soft system | Corners 6 / 8 / 12 / 16 / full; three shadow levels |
| 04 | `04-density.html` | B · Reference | 48px table rows, 36px controls, 68px rail |
| 05 | `05-motion.html` | C · Expressive | Spring curve, lift on hover, staged entrance, count-up numbers |
| 06 | `06-controls.html` | C · Lifted | Gradient primary button with a resting shadow; fields slightly inset |
| 07 | `07-data.html` | A · Reference, unified | Tinted pills with a dot; delta beside the number |
| 08 | `08-shell.html` | B · Compact header | Icon rail without an edge bar; title, tabs and date range on one row |

## Out of scope

- Rebuilding any screen (Chat, Bird's Eye, Dashboard, Suggestions, Clients, Settings, setup).
- Replacing the live app's sidebar. The new shell is shown on the preview page only.
- Wiring the rail's counts and the client list to the backend.
- Phone layouts. Javi set the redesign to desktop only.
- A dark theme.
- Changing or deleting `ds`, `ui`, `pd-*` or dashkit.

## Tokens

### Where they live

One file, `src/styles/tokens.css`, imported by `src/app/globals.css`. Every name starts with `by-`, so nothing collides with the existing variables. They are registered with Tailwind v4, so components write `bg-by-surface`, `text-by-muted`, `rounded-by-md`.

### Two tiers

| Tier | Holds | Who may use it |
|---|---|---|
| Raw values | The colour ramps | Only `tokens.css` |
| Roles | What a value is for | Every component |

### Raw colour values

| Ramp | Values, light to dark |
|---|---|
| Grey | `#ffffff` `#f7f6fb` `#f3f2f8` `#efeef5` `#e4e2ed` `#d0cedc` `#a7a4b6` `#7c798c` `#5f5c6e` `#433f50` `#000000` |
| Purple | `#f4f1fe` `#e8e2fd` `#d3c8fb` `#b5a3f7` `#8f76f3` `#6544ee` `#5433d6` `#4326b0` `#331d85` `#23145a` |

| Status | Text | Background | Solid |
|---|---|---|---|
| Danger | `#b4232c` | `#fdecec` | `#c9303a` |
| Warning | `#8a5300` | `#fdf1d7` | `#e0a100` |
| Success | `#12703f` | `#e2f5ea` | `#2bab63` |

Measured text contrast for the pills: danger 5.7, warning 5.6, success 5.4, purple 5.2. Muted text on white is 6.5.

### Roles

| Group | Roles | Value |
|---|---|---|
| Surfaces | canvas / surface / sunken / rail | `#f7f6fb` / `#ffffff` / `#efeef5` / `#f3f2f8` |
| Text | text / text-2 / muted / on-accent | `#000000` / `#433f50` / `#5f5c6e` / `#ffffff` |
| Borders | line / line-soft / line-strong | `#e4e2ed` / `#efeef5` / `#d0cedc` |
| Accent | accent / accent-hover / accent-soft / accent-soft-hover / accent-line | `#6544ee` / `#5433d6` / `#f4f1fe` / `#e8e2fd` / `#d3c8fb` |
| Status | danger, warning, success, each with text / background / solid | table above |
| Sections | Agency Ops | `#6544ee` on `#f4f1fe` |
| | Media Buyer | `#2a63d4` on `#e8effc` |
| | Sales Coach | `#12703f` on `#e2f5ea` |
| | Clients | `#0f7466` on `#def3ee` |
| Focus | focus ring | 2px solid accent, 2px offset (fields: 2px, inset by 1px) |

### Type

- Display font: Poppins (headings, page titles, KPI figures). Body font: Inter.
- Inter is already loaded by the root layout. Poppins is self-hosted (the repo stopped using Google's font loader after it broke builds on 2026-11-12) and, in this step, loaded only by the `/kit` layout so existing pages don't download it.
- Weights: 400, 500, 600 only.

| Name | Size | Used for |
|---|---|---|
| label | 11px | Table headers (uppercase, 0.07em tracking) |
| caption | 12px | Pills, deltas, help text |
| body-sm | 13px | Subtitles, secondary lines |
| body | 14px | Default text, tables, buttons |
| body-lg | 15px | Chat messages, ask bar |
| heading | 18px | Card and message headings |
| title | 24px | Page titles, KPI figures |
| display | 32px | Large figures |

Numbers in tables and KPI tiles use tabular figures.

### Corners and shadows

| Corner | Size | Used for |
|---|---|---|
| sm | 6px | Pills, chips, tooltips, checkboxes |
| md | 8px | Buttons, fields, menu rows, the tab chip |
| lg | 12px | Cards, rail tiles, the tab pill, popovers |
| xl | 16px | The ask bar |
| full | 999px | Count badges, switches, avatars |

| Shadow | Value | Used for |
|---|---|---|
| card | `0 1px 2px rgba(22,20,29,.05)` | Cards, KPI tiles |
| raised | `0 1px 2px rgba(22,20,29,.1)` | The tab chip, secondary buttons |
| floating | `0 0 0 1px rgba(22,20,29,.08), 0 8px 24px -8px rgba(22,20,29,.2)` | Popovers, menus, tooltips, the ask bar |

### Space and size

- Spacing steps: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48px. Every gap and padding uses one of these.
- All sizes in this spec are nominal. They are written with Tailwind's standard classes, which scale with the app's 15.5px base, so a 36px control renders at about 34.9px.
- Control heights: 32 (small), 36 (default), 40 (large).
- Table: 40px header, 48px rows, 16px cell padding.
- Rail: 68px wide, 40px tiles. Page gutter: 28px.

### Motion

| Token | Value | Used for |
|---|---|---|
| fast | 160ms | Colour and border changes |
| base | 320ms | Switches, popovers |
| press | 260ms | Button lift and press |
| tab | 460ms | The sliding tab chip |
| enter | 600ms, 70ms stagger | Page entrance |
| ease-out | `cubic-bezier(.2,0,0,1)` | Colour, opacity |
| ease-spring | `cubic-bezier(.34,1.56,.64,1)` | Anything that moves or scales |

Rules:

- Buttons rise 1px on hover and scale to 0.95 on press.
- KPI figures count up once when a page first loads, not on every tab switch.
- With the system "reduce motion" setting on, movement, scaling and count-ups are off; colour fades stay.

### Rules for tokens

- Components read roles only. No hex colours, raw ramp values or one-off shadows in a component.
- A dark theme later redefines the roles in one block; no component changes.

## Components

### Where they live

`src/components/by/`, as `.jsx` with JSDoc props, matching the rest of `birdy-beta`. One barrel file, `index.js`.

### What gets built

| Group | Components | Board |
|---|---|---|
| Actions and inputs | Button; text field; search field; dropdown trigger; ask bar; switch; checkbox; radio | 06 |
| Navigation | Tab pill (sliding chip, count badge); popover menu; tooltip | 05, 06, 08 |
| Data display | Status pill; count badge; CPL chip; KPI tile with delta; table (header, row, hover arrow); card; empty state | 07 |
| Identity | Framed Birdy avatar; client initial tile; user avatar | 07, 08 |
| Shell | Rail; client switcher panel; section header; credits ring | 08 |

### Component details

**Button** (Lifted)
- Kinds: primary, secondary, soft, ghost, danger.
- Sizes: 32, 36, 40px. Icon-only variant. Loading state with a spinner.
- Primary: gradient `#7a5df4` to `#5c3be6`, shadow `inset 0 1px 0 rgba(255,255,255,.28), 0 2px 6px -1px rgba(101,68,238,.5)`. Hover gradient `#6d4ef0` to `#4f2fd8` with a deeper shadow.
- Secondary: white, hairline border, raised shadow.
- States: rest, hover, press, keyboard focus, disabled, loading.

**Fields** (Lifted)
- White, hairline border, `inset 0 1px 2px rgba(22,20,29,.07)`.
- Focus: accent border and a 2px accent outline. No coloured halo.
- Error: red border and a message under the field that names the problem.

**Status pill** (Reference, unified)
- Tinted background, a 6px dot and 12px semibold text. One style for every pill.
- Tones: danger, warning, success, accent, neutral.

**KPI tile**
- Label, figure, and the delta beside the figure with a small triangle.
- Delta colour follows good or bad, not direction: a falling CPL is green.

**Table**
- Uppercase 11px header, 48px rows, soft row dividers.
- Rows highlight on hover and the trailing arrow nudges right.

**Empty state**
- Icon tile, heading, one or two lines, one action button.

**Framed Birdy avatar**
- Wraps the existing animated Birdy (`src/components/birdy/`) in the round frame: accent-soft background, accent-line border, bird at 82% of the frame, sitting on the bottom edge.
- Sizes 24, 32, 40, 56px. The mascot is never shown without the frame.

### How they are made

- **Behaviour:** Radix handles keyboard, focus and overlays for switch, checkbox, radio, tabs, popover and tooltip. All but the radio package are already installed; `@radix-ui/react-radio-group` is added. Only the look is new.
- **Icons:** `lucide-react`, already installed. 2px stroke, round caps.
- **Motion:** CSS only, from the motion tokens. No animation library.
- **Independence:** nothing in `by/` imports from `ds`, `ui` or the `pd-*` kit.

## Shell

### Rail

- 68px wide, always visible, on the rail surface with a hairline on its right edge.
- Top to bottom: client switcher tile, a divider, Agency Ops, Media Buyer, Sales Coach, Clients; then at the bottom Settings, the credits ring and the user's avatar.
- Creative Strategist stays hidden behind its existing flag.
- Agency Ops is the framed Birdy avatar. The other sections are tinted tiles in their section colour.
- The open section is a solid tile in its section colour with white icon. There is no edge bar.
- A section with open suggestions shows a purple dot. The number appears in the hover tooltip and on the Suggestions tab.
- Each tile has a hover tooltip with its name.

### Client switcher

- Opens from the black tile at the top of the rail, or with ⌘K. The panel flies out to the right of the rail.
- Contents, in order: search field, Add new client, Agency view (with the client count), then every client A to Z with a status dot.
- Keyboard: typing filters, arrow keys move, Enter picks, Escape closes.
- Picking a client scopes the whole app. The choice is kept in the address as `?client=` and remembered between visits, as in the reference build.

### Section header

- One row at 1440px and wider: section tile and title on the left, tab pill in the middle, date range on the right.
- Below 1440px it falls back to two rows: title and date range, then the tab pill.
- Tabs: Chat, Bird's Eye, Dashboard, Suggestions, then More. The Suggestions tab shows its count.
- The date range appears only on Bird's Eye and Dashboard.
- The subtitle is "Your entire agency", or the client's name and status when the app is scoped to a client.

### Empty, loading and error behaviour

| Situation | What the user sees |
|---|---|
| Client list loading | Grey placeholder rows in the panel |
| Client list fails to load | A one-line message and a Retry button inside the panel |
| Search matches nothing | "No client called …" and the Add new client action |
| Long client name | Cut with an ellipsis; full name on hover |
| A section has no open suggestions | No dot |

## Data flow

In this step the shell and components take everything as props. The preview page feeds them sample data taken from the reference build's fixtures. Connecting the rail's counts, the client list and the client scope to the real API happens when the first screen is rebuilt.

## Preview page

- A route, `/kit`, shows every component in every state. `/kit/shell` shows the shell with sample data.
- It replaces the mock-up boards as the living reference.
- It renders outside the old sidebar and top bar.
- It works on the development server only and returns "not found" in a production build, so it cannot be shared by link. This holds until the redesign is done.
- It is not linked from the app.

## Checks

- **Hygiene test:** fails if any file in `src/components/by/` contains a hex colour, or imports from `ds`, `ui` or a `pd-*` component.
- **Component tests (vitest):** each component's states and keyboard use.
- **Visual check:** screenshot `/kit` and `/kit/shell` at 1440 and 2560 wide and compare them with the chosen option on each board, judging look and proportion (sizes are about 3% smaller by decision).
- **Contrast:** the status pills, muted text and white-on-purple keep the measured ratios listed above.
- **Reduced motion:** with the setting on, nothing moves or counts up.

## Open questions

- **Creative Strategist's section colour.** The section is hidden for launch and no colour was chosen.
- **Motion on app screens.** The Expressive pick (600ms staged entrance, count-ups) is slower than common guidance for tools people use many times a day (150 to 250ms, no staged entrances). It was chosen knowingly. Revisit after it has been used on a real screen.
- **Narrow windows.** The one-row header needs 1440px. The two-row fallback covers smaller desktop windows; anything below about 1100px is undefined until phone and tablet layouts are in scope.

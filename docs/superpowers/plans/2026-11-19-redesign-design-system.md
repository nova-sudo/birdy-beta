# Birdy Redesign Design System Implementation Plan

**Status:** in progress. All six phases done 2026-11-19. Pull request #175 is open and includes the tests.

**Goal:** Build the `by-` tokens, the `by` component kit and the new app shell in `birdy-beta`, shown on a development-only `/kit` page, with no change to any existing page.

**Spec:** `docs/superpowers/specs/2026-11-19-redesign-design-system-design.md`. Read it first: every value (colours, sizes, shadows, timings) and every component's states are pinned there.

**Mock-up boards:** `/Users/abdelrahman/Desktop/Birdy/mocks/redesign-tokens/` (`01-colour.html` to `08-shell.html`, plus `shared.css`, `icons.js`). The chosen option on each board is the visual reference. Look only: never import from the boards or copy their CSS classes.

**Tech stack:** Next.js 16, React 19, Tailwind v4 (`@theme` blocks), Radix primitives, `lucide-react`, vitest with Testing Library.

## Scope

In scope:

- `src/styles/tokens.css` and its import;
- Poppins, self-hosted, for the preview page;
- `src/components/by/` (components and shell);
- `/kit` and `/kit/shell` preview routes.

Out of scope (from the spec): rebuilding any screen, replacing the live sidebar, wiring the shell to the API, phone layouts, a dark theme, and any change to `ds`, `ui`, `pd-*` or dashkit.

## Decision record

| Decision | Source |
|---|---|
| Port the redesign into `birdy-beta`; look locked to the reference build; light only with role-named tokens; scope is tokens, components and shell | User, brainstorming 2026-11-19 (spec, "Decisions made in brainstorming") |
| The eight visual picks (colour B, type B, corners and shadows B, density B, motion C, controls C, data display A, shell B) | User, one board each (spec, "The eight picks") |
| A new kit beside `ds`, not a retheme of `ds` | User, chosen after being shown that `ds` has 67 tested components used by 112 files |
| Sizes use standard Tailwind classes; the 3% shrink from the app's 15.5px base (`globals.css:479`) is accepted | User, plan audit 2026-11-19 |
| `/kit` is available on the development server only, until the redesign is done | User, plan audit 2026-11-19 |
| Add `@radix-ui/react-radio-group` for the radio button | User, plan audit 2026-11-19 |
| Poppins is self-hosted in `src/fonts/` and loaded only by the `/kit` layout | Repo rule in `src/lib/pd-fonts.js` (Google's loader broke builds on 2026-11-12); "no existing page changes" from the spec |
| Work in the current checkout on a new branch; no ticket | User, plan audit 2026-11-19 |
| Commit at the end of each phase; push and open the pull request only when the user says so | Proposed with the plan shape; user replied "go on" |

## Execution prerequisites

- **Ticket:** none; the user chose to proceed untracked.
- **Worktree:** none; work in the current tree, `/Users/abdelrahman/Desktop/Birdy/birdy-beta`, on a new branch `feat/redesign-design-system` created from `origin/main` after `git fetch origin`.
- **Before switching branches:** two untracked files also exist on `main` and block the switch: `docs/superpowers/plans/2026-10-24-bytes-ds-migration.md` and `docs/superpowers/specs/2026-10-24-bytes-ds-migration-design.md`. Both were byte-identical to `origin/main` on 2026-11-19. Re-check with `cmp` against `git show origin/main:<path>`; delete the local copies only if still identical, otherwise stop and ask.
- **Carry over:** this plan and the spec are untracked files; they survive the branch switch. Commit both in phase 1.
- **Leave alone:** the other untracked items (`.claude/worktrees/`, `design_handoff_hubs/design_handoff_birdy_hub/`, `design_handoff_hubs/design_handoff_bytes_ds/`). Never stage them; stage files by path.
- **Applicable memories:**
  - port from `origin/main`, never from a stale checkout (`port-from-latest-source`);
  - the mascot only appears inside its round frame (`birdy-mascot-always-framed`);
  - a styling change is not done until screenshots show it (`verify-with-screenshots`);
  - run Birdy on port 3005; port 3000 may be another app; pushing needs the `nova-sudo` GitHub login (`birdy-local-verify-setup`);
  - once approved, run every phase without pausing; confirm at the end (`run-approved-plans-through`);
  - anything the boards don't settle gets a mock-up and a question, not a guess (`revamp-user-chooses-each-step`, `plans-need-html-mocks`).
- **Required skills:** `nova-executing-plans` to run the plan; `impeccable` (read `reference/craft-floor.md` and `reference/operate.md`) before UI edits in phases 1 to 4; `nova-review` in phase 5.
- **Commands:** tests `npx vitest run --dir src` (plain `npm test` also runs the stale copies under `.claude/worktrees/`, where 90 files fail on unrelated code); production build `npm run build`; preview `npx next dev --turbopack --port 3005`. There is no lint script.
- **Screenshots:** the headless Chromium at `~/Library/Caches/ms-playwright/chromium_headless_shell-1243/`, as used for the boards.
- **Commit footer:** `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Global constraints

- Components read `by-` role tokens only. No hex colours, no raw ramp values and no one-off shadows inside `src/components/by/`.
- Nothing in `src/components/by/` imports from `@/components/ds`, `@/components/ui` or any `pd-*` component. `@/lib/utils` and `@/components/birdy/` are allowed.
- Files are `.jsx` with JSDoc props. Any module using hooks or context starts with `"use client"` (the existing `ds` hygiene rule; a missing directive breaks every route).
- Motion is CSS only, from the motion tokens, written with `motion-safe:` so that reduced motion keeps colour fades and drops movement, scaling and count-ups.
- Sizes are nominal: a "36px" control is Tailwind's `h-9` and renders at about 34.9px. Do not add pixel overrides to correct this.
- The edits to shared files are limited to those named in phase 1 (`globals.css`, `layout.jsx`) and the dependency in phase 2.
- Copy in the kit's examples is taken from the boards.

## Phases

### Phase 1: Foundation (done)

**Outcome:** the branch exists, the tokens are registered with Tailwind, and `/kit` renders on the dev server, outside the old sidebar, showing every token.

**Depends on:** nothing.

**Memories and skills:** `port-from-latest-source`; `impeccable` craft floor.

**Files:**

- Create `src/styles/tokens.css`: one `@theme` block declaring the spec's tokens under Tailwind's namespaces with a `by-` prefix (`--color-by-*`, `--text-by-*`, `--radius-by-*`, `--shadow-by-*`, `--ease-by-*`, `--font-by-display`, `--font-by-body`), plus duration variables for the motion timings. Raw ramps are declared first and the roles point at them. Text sizes are in rem (11px is `0.6875rem`, and so on).
- Modify `src/app/globals.css`: add `@import "../styles/tokens.css";` with the other imports at the top. No other change.
- Add `src/fonts/poppins-latin-500.woff2` and `src/fonts/poppins-latin-600.woff2`: the latin 500 and 600 files from the `@fontsource/poppins` package (OFL-1.1). Copy the files only; do not add the package as a dependency.
- Create `src/lib/by-fonts.js`: a `next/font/local` declaration for Poppins with the variable `--font-poppins`, following `src/lib/pd-fonts.js`. Inter is already on `<html>` as `--font-inter`.
- Create `src/components/by/cn.js`: a class-merging helper built with `extendTailwindMerge`, registering the `by-` text sizes, corners and shadows, so that `text-by-body` and `text-by-muted` are not treated as the same kind of class and merged away.
- Create `src/components/by/index.js`: the barrel, in the style of `src/components/ds/index.js`.
- Create `src/app/kit/layout.jsx`: a server component that calls `notFound()` unless `process.env.NODE_ENV === "development"`, and applies the Poppins variable class and the canvas background.
- Create `src/app/kit/page.jsx`: token reference (colour roles and ramps, the eight text sizes, corners, the three shadows, the motion curves).
- Modify `src/app/layout.jsx`: add `pathname.startsWith("/kit")` to `hideSidebar` (lines 95 to 105).
- `src/lib/constants.js` is not changed. Corrected during execution: `ProtectedLayout` sends signed-in users away from public routes, so listing `/kit` as public redirected it to `/clients`. Left unlisted, `/kit` loads signed in or out.

**Order that matters:** take "before" screenshots of `/dashboard`, `/clients`, `/Sales-Hub`, `/settings` and `/login` at 1440 wide on `origin/main` before the first edit. Phase 5 compares against them. The four signed-in pages use a session the user signed into themselves (their choice, 2026-11-19), saved in the session scratch folder and deleted after phase 5.

**Verification:** `npx vitest run --dir src` passes; `npm run build` passes; on the dev server `/kit` renders without the old sidebar or top bar; a production build serves "not found" for `/kit`; a screenshot of `/kit` shows Poppins headings and the token values from the spec.

### Phase 2: Actions and inputs (done)

**Outcome:** the controls from board 06 (Lifted) exist in the kit and appear on `/kit` in every state.

**Depends on:** phase 1.

**Memories and skills:** `verify-with-screenshots`; `impeccable` craft floor and Operate guidance.

**Files** (all under `src/components/by/`, exported from the barrel):

- `button.jsx`: kinds primary, secondary, soft, ghost, danger; sizes sm, md, lg; icon-only; loading.
- `field.jsx`: text field, search field and dropdown trigger sharing one surface; error state with a message.
- `ask-bar.jsx`.
- `choice.jsx`: switch, checkbox and radio on Radix, in one file because they share the label wrapper and the pop animation.
- `motion.js`: the shared transition, lift and focus-ring class recipes.
- `src/app/kit/sections/controls.jsx`: the preview section (the page stays a server component).
- Modify `package.json`: add `@radix-ui/react-radio-group`.
- Modify `src/app/kit/page.jsx`: mount the section. It shows rest, with-icon, loading, disabled and error; hover, press and keyboard focus are live states, checked by driving the page (hover, Tab, Space, arrow keys) rather than frozen copies.

**Verification:** `npx vitest run --dir src` and `npm run build` pass; screenshot the controls section and compare with option C on `06-controls.html`; tab through the section with the keyboard and confirm every control shows the 2px accent focus outline and operates with Space, Enter and arrow keys.

### Phase 3: Navigation, data display and identity (done)

**Outcome:** the remaining kit components exist and appear on `/kit`.

**Depends on:** phases 1 and 2.

**Memories and skills:** `birdy-mascot-always-framed`; `verify-with-screenshots`; `impeccable`.

**Files** (under `src/components/by/`):

- `tab-pill.jsx`: Radix tabs with the measured sliding chip and a count badge.
- `popover-menu.jsx` (Radix dropdown menu, exported as `Menu*`) and `tooltip.jsx`, on the floating shadow.
- `pill.jsx`: `Pill` (tones danger, warning, success, accent, neutral; tinted with a dot), `CplChip` and `CountBadge`, in one file because the last two are variations of the pill.
- `kpi-tile.jsx` with `Delta` in the same file: delta beside the figure; colour by good or bad, not direction; the figure counts up once on mount.
- `table.jsx`: header, row, numeric cell, hover arrow.
- `card.jsx`: `Card` and `EmptyState`.
- `avatar.jsx`: the framed Birdy avatar (wrapping `@/components/birdy/Birdy` in the round frame at 82%, in `by-` tokens; sizes 24, 32, 40, 56), the client initial tile and the user avatar.
- Modify `src/app/kit/page.jsx`: a section per component, with the table and KPI tiles filled from the board's sample rows.

**Verification:** `npx vitest run --dir src` and `npm run build` pass; screenshot and compare with option A on `07-data.html` and the tab pill on `06-controls.html`; confirm the popover and tooltip are not clipped by a scrolling parent; with reduced motion switched on, confirm the chip does not slide and the figures do not count up.

### Phase 4: Shell (done)

**Outcome:** the rail, client switcher and section header exist and `/kit/shell` shows them working together on sample data.

**Depends on:** phases 2 and 3.

**Memories and skills:** `birdy-mascot-always-framed`; `verify-with-screenshots`; `impeccable`.

**Files:**

- `src/components/by/shell/rail.jsx`: switcher tile, section tiles with the suggestion dot and tooltip, Settings, credits ring, user avatar. Agency Ops is the framed Birdy avatar. No edge bar.
- `src/components/by/shell/client-switcher.jsx`: the panel with search, Add new client, Agency view and the A to Z list; opens from the tile and with ⌘K; typing filters, arrows move, Enter picks, Escape closes; loading, failed-with-retry and no-match states.
- `src/components/by/shell/section-header.jsx`: one row at 1440px and wider, two rows below; the date range slot is shown only when passed; subtitle from props; a `more` slot puts the "More" menu trigger inside the pill (`TabPill` gained a `trailing` slot for it).
- `src/components/by/shell/credits-ring.jsx`.
- `src/components/by/shell/sections.js`: the section list (id, name, colour role, icon) with Creative Strategist flagged off.
- `src/app/kit/shell/page.jsx` and `src/app/kit/shell/sample-data.js`: Media Buyer's Dashboard as on board 08, with controls on the page to switch the client list between loaded, loading, failed and empty-search, and to scope to one client.

Everything in the shell takes its data as props. Nothing here calls the API.

**Verification:** `npx vitest run --dir src` and `npm run build` pass; screenshots of `/kit/shell` at 1440 and 1280 wide show the one-row and two-row headers; compare with option B on `08-shell.html`; open the switcher with ⌘K and complete a pick using only the keyboard; check each of the four client-list states.

### Phase 5: Final verification and pull request (done)

**Outcome:** the kit matches the boards, existing pages are unchanged, and the pull request is open.

**Depends on:** phases 1 to 4.

**Memories and skills:** `verify-with-screenshots`; `birdy-local-verify-setup`; `nova-review`.

**Checks:**

- Screenshot `/kit` and `/kit/shell` at 1440 and 2560 wide and compare with the chosen option on every board, judging look and proportion (sizes are about 3% smaller by decision).
- Contrast: measure the status pills, muted text and white on purple; they meet the ratios in the spec.
- Reduced motion: with the setting on, nothing moves or counts up.
- Existing pages: re-take the five "before" screenshots from phase 1 and confirm no visible difference.
- Search `src/components/by/` for hex colours and for imports from `ds`, `ui` or `pd-*`; there are none.
- `npx vitest run --dir src` and `npm run build` pass; the production build returns "not found" for `/kit` and `/kit/shell`.
- Run `nova-review` on the branch and fix what it finds. Done: the ask bar reuses the primary button recipe, the switcher reuses `SearchField`, the Birdy avatar wraps the app's existing framed mascot, and the preview pages use the existing `money()` helper.
- Open the pull request against `main` when the user says to push, using the `nova-sudo` login.
- After the shell review (user, 2026-11-19): the Agency Ops section header shows a sparkle icon tile instead of the mascot; on the rail the mascot keeps its 40px frame with the bird scaled up 18% inside it.

### Phase 6: Tests (done)

Planned for after the pull request's review. The user chose to start it once the pull request was open (2026-11-19), so the tests ship in the same pull request.

Written as five files: `__tests__/by-hygiene.test.js`, `cn.test.js`, `controls.test.jsx`, `display.test.jsx` and `shell/__tests__/shell.test.jsx` (79 tests), with `__tests__/jsdom.js` holding the polyfills Radix needs.

**Covers:**

- `src/components/by/__tests__/by-hygiene.test.js`: fails on a hex colour in the kit, on an import from `ds`, `ui` or a `pd-*` component, and on a hook-using module without `"use client"`. Modelled on `src/components/ds/__tests__/ds-hygiene.test.js`.
- One test file per component for its states and keyboard use: button (kinds, disabled, loading), field (error message), switch, checkbox and radio (toggle and arrow keys), tab pill (selection and arrow keys), popover menu and tooltip (open, Escape), pill tones, KPI delta colour by good or bad, table row, empty state, framed avatar.
- Shell: rail marks the open section and shows the dot only for a non-zero count; client switcher filters, picks by keyboard, and shows the loading, failed and no-match states; section header shows the date range only when given.
- The class-merging helper keeps a `by-` text size and a `by-` text colour together.

**Verification:** `npx vitest run --dir src` passes.

## Final verification

The goal is met when, on `feat/redesign-design-system`:

- every component in the spec's list is on `/kit`, and the shell is on `/kit/shell`, matching the chosen boards;
- the five existing pages look the same as before the work;
- `npx vitest run --dir src` and `npm run build` pass, and `/kit` is not served by a production build;
- the kit contains no hex colours and no imports from the older component sets.

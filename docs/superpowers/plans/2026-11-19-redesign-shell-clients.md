# Birdy Redesign: Shell Go-Live, Add Client, Import and Clients List Implementation Plan

**Status:** in progress. Phase 1 built 2026-11-19; phases 1 and 2 built; phase 3 next.

**Goal:** Put the new shell in front of every signed-in page, rebuild Add client and Import as kit dialogs, and rebuild the Clients list, on the redesign branch.

**Spec:** `docs/superpowers/specs/2026-11-19-redesign-shell-clients-design.md`. Read it first: the rail's destinations, every state and every failure message are pinned there.

**Builds on:** `docs/superpowers/plans/2026-11-19-redesign-design-system.md` (complete) and its spec. The kit is `src/components/by/`; its rules and its hygiene test apply to everything added here.

**Mock-up boards:** `/Users/abdelrahman/Desktop/Birdy/mocks/redesign-tokens/`: `08-shell.html` (option B), `09-clients.html` (option A), `10-add-client.html` (option A), `11-import.html` (option A). Look only: never import from the boards or copy their CSS.

**Tech stack:** Next.js 16, React 19, Tailwind v4, Radix, SWR, `lucide-react`, vitest with Testing Library.

## Scope

In scope:

- the root layout renders the new shell for every signed-in page;
- a dialog in the kit, and Add client and Import rebuilt on it;
- the Clients list rebuilt.

Out of scope (from the spec): any other page's rebuild, the client detail page, scoped section views, derived status, the first-run onboarding's look, any backend change, phone layouts.

## Decision record

| Decision | Source |
|---|---|
| New shell replaces the old one everywhere now; old pages render inside it with no header | User, brainstorming 2026-11-19 |
| Rail tiles open the nearest old page; a dashed "Other pages" tile lists the rest | User, brainstorming 2026-11-19 |
| No notifications bell; account menu on the avatar; background-jobs widget dropped | User, brainstorming 2026-11-19 |
| Status stays hand-set health, shown as At risk / On track (board 09 A) | User, brainstorming 2026-11-19 |
| Row click and the switcher open the existing client detail page until Agency Ops' Bird's Eye exists | Spec, "Scoping, for now"; accepted by the user in design section 1 |
| List keeps custom metric columns and saved column views; drops CSV export and the row active toggle | User, brainstorming 2026-11-19 |
| Add client is a stepper dialog (board 10 A); Import is a wide one-table dialog (board 11 A) | User, boards 10 and 11 |
| "Leads called" is a percentage: `hp_leads_with_calls` divided by `hp_leads`; a dash when the client has no Hot Prospector leads. It is not the reference's definition, which today's data cannot produce | User, plan audit 2026-11-19 |
| Build order is shell, then dialogs, then list (the spec lists list before dialogs) | Plan audit: today's wizard is inline in `src/app/clients/page.jsx`, so the page cannot be replaced before the dialogs exist. Approved with the plan shape |
| Import's rules move to one shared module used by the onboarding table and the new dialog | Proposed as a risk control and approved with the plan shape |
| Commit at the end of each phase and push to draft pull request #175 | Approved with the plan shape |
| Tests are the last phase, written straight after final verification | Approved with the plan shape; matches the user's choice on the previous plan |
| Pull request #175 is not merged until the whole redesign is done | User, 2026-11-19 |

## Execution prerequisites

- **Ticket:** none; the user chose to proceed untracked.
- **Worktree:** none; work in the current tree, `/Users/abdelrahman/Desktop/Birdy/birdy-beta`, on the existing branch `feat/redesign-design-system`. Do not create a new branch.
- **Before the first edit:** `git fetch origin` and merge `origin/main` into the branch, so the redesign does not drift from main. Stop and ask if the merge conflicts in files this plan does not touch.
- **Carry over:** this plan and its spec are untracked; commit both in phase 1.
- **Leave alone:** the untracked `.claude/worktrees/` and `design_handoff_hubs/` folders. Stage files by path.
- **Applicable memories:**
  - do not merge or suggest merging pull request #175 (`birdy-redesign-design-system-2026-11`);
  - the mascot only appears inside its round frame (`birdy-mascot-always-framed`);
  - a styling change is not done until screenshots show it (`verify-with-screenshots`);
  - run Birdy on port 3005; with no API address set it talks to the deployed backend; pushing needs the `nova-sudo` login (`birdy-local-verify-setup`);
  - client names are stored in several places; match clients on their id, never their name (`client-name-copies`);
  - once approved, run every phase without pausing; confirm at the end (`run-approved-plans-through`);
  - anything the boards do not settle gets a mock-up and a question, not a guess (`revamp-user-chooses-each-step`, `plans-need-html-mocks`).
- **Required skills:** `nova-executing-plans` to run the plan; `impeccable` (`reference/craft-floor.md`, `reference/operate.md`) before UI edits in phases 1 to 3; `nova-review` in phase 4.
- **Commands:** tests `npx vitest run --dir src`; production build `npm run build`; preview `npx next dev --turbopack --port 3005`.
- **Signed-in screenshots:** the user signs in once in a browser window opened for them; the session is saved in the session scratch folder and deleted after phase 4.
- **Commit footer:** `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Global constraints

- Everything added under `src/components/by/` obeys the kit's rules and must pass `src/components/by/__tests__/by-hygiene.test.js`.
- App wiring (data hooks, routing, requests) does not go in the kit. It lives beside the page or in `src/components/shell/`. The kit takes data as props.
- `src/components/ds/` and `src/components/ui/` are not edited or deleted. Files that `ds` still imports stay, even when the layout stops using them: `app-sidebar.jsx`, `NotificationsDropdown.jsx`, `SidebarCredits.jsx`, `SidebarJobs.jsx`.
- No request is added or changed. Each flow sends what today's code sends.
- Clients are matched by id.
- Money uses the account's currency through the existing helpers.
- Copy is taken from the spec and the boards.

## Phases

### Phase 1: Shell swap (built)

**Finding, 2026-11-19.** Removing the top bar hides working controls, not only titles. Pages publish these to it: Dashboard (date range, granularity); Marketing, Sales Hub and Leads (client picker, date range, granularity); the client detail page (date range and the Client settings button, which is how a client is marked inactive or its health set); Metrics (search, Create a custom metric); Alerts (create alert); Ask Birdy (new chat, view switch); Dashboards (new dashboard; a dashboard's tabs, save status and buttons). The spec's claim that a client can still be marked inactive from its own page does not hold without a header. Raised with the user before phase 2. **Decision (user, 2026-11-19): leave it as it is.** Every listed control stays hidden until its page is rebuilt, including the client page's settings button.

**Outcome:** every signed-in page renders inside the new rail, with real clients, credits and work count; old pages work without their header.

**Depends on:** nothing.

**Memories and skills:** `birdy-mascot-always-framed`; `client-name-copies`; `impeccable`.

**Files:**

- Modify `src/app/layout.jsx`:
  - replace the old sidebar, top bar and content wrapper with the new shell;
  - keep `CreditsProvider`, `DashboardControlsProvider` and `PageHeaderProvider` mounted (21 pages publish to them) but render none of their title or control outlets;
  - keep `ImpersonationBar`, `AgentRunBanner` and the lazily mounted `BirdyChatModal` with its `ASK_BIRDY_EVENT` listener;
  - remove the header search, its ⌘K handler, `NotificationsDropdown`, `UserMenu`, the wordmark and the `SidebarProvider` wrapper if nothing rendered still needs it;
  - put the Poppins variable from `src/lib/by-fonts.js` on `<html>` beside the existing font variables, and drop it from `src/app/kit/layout.jsx`.
- Create `src/components/shell/app-shell.jsx`: the wiring. Reads clients through `useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })`, credits through `useCredits`, the Media Buyer count through `useAgentWorkCount`, the user through the stored `user` record and `useRole`; maps the pathname to the open rail item; handles navigation with the router.
- Create `src/components/shell/nav.js`: the rail's destinations and "marked open on" paths from the spec's table, and the "Other pages" list.
- Modify `src/components/by/shell/rail.jsx`: accept an "other pages" slot (a dashed tile that opens a `Menu`) and an account menu on the avatar. Both arrive as props; the rail holds no routes.
- Modify `src/components/by/shell/client-switcher.jsx` only if wiring shows a gap (for example a grey dot for inactive clients).
- Create `src/components/shell/account-menu.jsx`: Admin console (admins only), Settings, Log out. Log out reuses the flow in today's `src/components/UserMenu.jsx`, including its confirmation.
- Delete `src/components/UserMenu.jsx` once the account menu replaces it (the layout is its only importer).

**Order that matters:** take "before" screenshots of the eleven old pages listed in the spec's Checks, signed in, before editing the layout.

**Verification:** `npx vitest run --dir src` and `npm run build` pass. On the dev server, signed in: each of the eleven old pages loads inside the new rail with no console error; the rail marks the right item open on each; "Other pages" and the avatar menu open and navigate; log out works; ⌘K opens the switcher; picking a client opens its detail page and the switcher shows it; "Agency view" returns to `/clients`. Signed out: login, register and onboarding look as before. `/kit` and `/kit/shell` still render. Write down which header controls each old page lost and report them to the user at the end.

### Phase 2: Dialogs, Add client and Import (built)

**As built:** the kit also gained a stepper, an option card, a notice and a skeleton, which the dialogs need. The dialogs are mounted once in the shell (`src/components/shell/client-actions.jsx`) and opened through a context, so the switcher and the page share them. In the old Clients page only the two buttons were repointed; its inline wizard is left unreachable and goes with the page in phase 3. The Meta ad account cell in Import is a plain menu (type a letter to jump) rather than a menu with its own search box.

**Outcome:** adding one client and importing several both happen in kit dialogs, opened from the still-old Clients page and from the switcher.

**Depends on:** phase 1.

**Memories and skills:** `client-name-copies`; `verify-with-screenshots`; `impeccable`.

**Files:**

- Create `src/components/by/dialog.jsx`: the kit dialog on `@radix-ui/react-dialog` (header, scrolling body, footer strip; sizes for the 600px stepper and the 1040px import table). Export from the barrel.
- **Corrections found while reading the old wizard (2026-11-19):** it has five steps (a fifth, "Leads", sets how the client gets leads and is sent as `lead_collection_method`); nothing can be skipped today; and the 409 error means the chosen GoHighLevel location or Meta ad account is already linked to another client, not that the name is taken. **User decision:** keep today's rules, so no Skip button. The spec is corrected to match.
- Create `src/components/clients/add-client-dialog.jsx` and step files beside it: the five steps from the spec, their lists, "Used by …" labels, the campaign picker step, and each failure from the spec's table. It sends the requests the inline wizard sends today: `/api/subaccount/locations`, `/api/facebook/adaccounts`, the campaign and Hot Prospector lookups the wizard already makes, and `POST /api/client-groups`.
- Create `src/lib/import-review.js`: the import rules now inside `src/app/onboarding/ReviewStep.jsx` (which rows are pre-ticked, the 25-row limit, row status, the suggested-match rule, search matching that never unticks hidden rows), as pure functions.
- Modify `src/app/onboarding/ReviewStep.jsx`: use those functions. No change to what it renders or does; `src/app/onboarding/__tests__/ReviewStep.test.jsx` must pass unchanged.
- Create `src/components/clients/import-dialog.jsx`: the wide dialog from board 11 on the shared rules, sending what `BulkImportDialog.jsx` sends today (`/api/onboarding/subaccounts-review`, `/api/onboarding/prepare-review`, `/api/onboarding/import-subaccounts`).
- Modify `src/app/clients/page.jsx`: remove the inline wizard and its state; open the two new dialogs from its existing buttons.
- Modify `src/components/shell/app-shell.jsx`: the switcher's "Add new client" opens the Add client dialog.
- Delete `src/components/clients/BulkImportDialog.jsx` and `src/components/clients/__tests__/BulkImportDialog.test.jsx` (the page was its only importer; its behaviour is covered again in phase 5).

**Verification:** `npx vitest run --dir src` and `npm run build` pass, with the onboarding review tests untouched. On the dev server: walk Add client through all four steps and through each skip, without submitting; trigger each failure state that can be reached without creating data (a list that fails to load, a taken name). Open Import and check the progress state, pre-ticks, search with hidden ticked rows, and the selection limit, without importing. Screenshot both against boards 10 and 11. Creating a real client or running a real import writes to the user's live account: do it only if the user says to.

### Phase 3: Clients list

**Outcome:** `/clients` is the rebuilt list from board 09, and the old page's code is gone.

**Depends on:** phases 1 and 2.

**Memories and skills:** `client-name-copies`; `verify-with-screenshots`; `impeccable`.

**Files:**

- Extend the kit for what the list needs, each exported from the barrel: a sortable header cell in `src/components/by/table.jsx`; `src/components/by/columns-menu.jsx` (a checklist of columns in a popover, with a search); `src/components/by/skeleton.jsx` (placeholder bars and rows).
- Create `src/components/clients/clients-list.jsx` and parts beside it: header, filter row, table, states.
- Create `src/lib/clients-list.js`: pure functions for the status mapping (Critical and Warning to At risk, Healthy or none to On track, `client_status` for inactive), tab counts, the "most urgent first" order, sorting with empty values last, search, the Leads called percentage, and reading and writing tab, search, sort and date range in the address.
- Replace `src/app/clients/page.jsx` with a thin page that renders the list. It keeps reading clients through `useClientGroups` without the per-day series, columns through `useColumnViews("clients")` and `usePageViews("clients", …)`, the catalogue through `useRememberViewCatalogue`, and custom metrics from `/api/custom-metrics`.
- Default columns: `meta_spend`, `meta_leads`, `cost_per_lead` and the Leads called percentage.
- A row click and the header's buttons use the app-shell's handlers from phases 1 and 2.
- Remove what the old page alone used, after checking each has no other importer.

**Verification:** `npx vitest run --dir src` and `npm run build` pass. On the dev server, signed in: the four tabs and their counts agree with the old page's health and status counts for the same account (compare against the "before" screenshot); every column sorts three ways; search, the Columns menu with a custom metric, and a saved view surviving a reload all work; the address carries tab, search, sort and date range and restores them; each state in the spec is reached (loading on a slow reload, a syncing client if the account has one, no match, an empty tab). Screenshot against board 09 at 1440 and 2560 wide.

### Phase 4: Final verification

**Outcome:** the three parts match their boards, old pages still work, and the branch is pushed.

**Depends on:** phases 1 to 3.

**Memories and skills:** `verify-with-screenshots`; `birdy-local-verify-setup`; `nova-review`.

**Checks:**

- Screenshots of the list, each Add client step and the Import dialog against boards 09, 10 and 11.
- The eleven old pages opened once more inside the new shell; each loads with no console error.
- Login, register, onboarding and the admin console look as in the "before" screenshots.
- Reduced motion: dialogs and menus appear without movement.
- Keyboard: both dialogs can be completed without a mouse; focus stays inside them; Escape closes them; focus returns to the button that opened them.
- `npx vitest run --dir src` and `npm run build` pass; the kit's hygiene test passes.
- Run `nova-review` on the work since the previous plan and fix what it finds.
- Push to draft pull request #175 and update its description. Delete the saved session.

### Phase 5: Tests

Started straight after phase 4, by the user's choice on the previous plan.

**Covers:**

- **Kit:** the dialog (opens, traps focus, Escape, returns focus); the sortable header cell's three states; the columns menu; the skeleton.
- **`src/lib/clients-list.js`:** status mapping including a missing health; tab counts; urgent-first order; sorting with empty values last; search; the Leads called percentage, including zero and missing Hot Prospector leads; the address round trip, including unknown values.
- **`src/lib/import-review.js`:** pre-ticking, the selection limit, hidden ticked rows surviving a search.
- **Clients list:** each state in the spec; tabs filter; a row click calls the open handler with the client's id.
- **Add client:** the four steps, each skip, Back keeping answers, the shared-account campaign rule, and each failure in the spec's table.
- **Import:** the progress state, the no-match warning and footer count, the limit message, the three outcomes after importing (imported, skipped for the plan limit, already in), and the nothing-left state.
- **Shell wiring:** each rail item's destination; which item is marked open for each path in the spec's table; the "Other pages" menu; the avatar menu with and without the admin entry; log out.

**Verification:** `npx vitest run --dir src` passes.

## Final verification

The goal is met when, on `feat/redesign-design-system`:

- every signed-in page renders inside the new rail and the eleven old pages still load and work;
- `/clients` is the rebuilt list, matching board 09, with its tabs agreeing with the stored health and status;
- one client can be added and several imported through the new dialogs, matching boards 10 and 11;
- `npx vitest run --dir src` and `npm run build` pass, including the kit's hygiene test;
- the work is pushed to draft pull request #175, which stays unmerged.

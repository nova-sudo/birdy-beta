# Birdy redesign: new shell goes live, Clients list, Add client and Import

- **Date:** 2026-11-19
- **Ticket:** none; the work proceeds untracked
- **Reference build:** `birdy-redesign-2026-11-18-clean.zip` (Javi's front-end mock). Click-through: https://birdy-javi.vercel.app/
- **Mock-up boards:** `~/Desktop/Birdy/mocks/redesign-tokens/` (`09-clients.html`, `10-add-client.html`, `11-import.html`; the shell is `08-shell.html`)
- **Builds on:** `docs/superpowers/specs/2026-11-19-redesign-design-system-design.md` (the `by-` tokens, kit and shell, in draft pull request #175)
- **Repo:** `birdy-beta`, branch `feat/redesign-design-system`. That branch is the redesign's long-lived branch and is not merged until all screens, the full functionality and the agent hierarchy are done.

## Goal

Put the redesign's shell in front of every signed-in page, and rebuild the first real screen on the new kit: the Clients list, with its two ways of adding clients.

Three parts:

1. the new shell replaces the old sidebar and top bar across the app;
2. the Clients list is rebuilt;
3. the Add client wizard and the bulk Import are rebuilt as kit dialogs.

They are built in the order 1, 3, 2: today's wizard is written inside the old Clients page file, so the page cannot be replaced before the dialogs exist. Plan: `docs/superpowers/plans/2026-11-19-redesign-shell-clients.md`.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| How rebuilt screens sit beside the old app | The new shell replaces the old one everywhere now. Pages not yet rebuilt render inside it. |
| Reaching old pages | Each rail tile opens its nearest old page. A dashed "Other pages" tile lists the rest. |
| Header on old pages | None. Their titles and header controls are not shown until they are rebuilt. |
| Notifications bell | Dropped. |
| Account menu | Opens from the avatar at the bottom of the rail. |
| Client status | Stays hand-set health. Not derived. |
| Status wording (board 09) | Option A: "At risk" and "On track". |
| Row click | As in the reference: it scopes the app to that client. |
| Kept from today's list | Custom metric columns; saved column views. |
| Dropped from today's list | CSV export; the per-row active/inactive toggle. |
| Add client and Import | Rebuilt in this step, not reused. |
| Add client container (board 10) | Option A: stepper dialog. |
| Import layout (board 11) | Option A: wide dialog, one table. |
| Background-jobs widget | Dropped (proposed in the design review; accepted). |
| Leads called | A percentage: leads called divided by Hot Prospector leads, with a dash for clients with no Hot Prospector leads. Today's data has only the count; this is not the reference's definition (share of the week's Meta leads that reached the CRM and got a call), which today's data cannot produce. |

## Out of scope

- Rebuilding any page other than the Clients list.
- The client detail page (`/clients/<id>`). It is reached as today and renders unchanged inside the new shell.
- Scoped section views (Agency Ops' Bird's Eye and the rest). See "Scoping, for now".
- Deriving a client's status or showing a reason beside it.
- The first-run onboarding, which keeps using the existing review table in the old look.
- Any backend change. Every request this step makes exists today.
- Phone layouts.

## Part 1: the new shell goes live

### What replaces what

- The old sidebar and top bar are removed from every signed-in page. The rail from the design-system spec takes their place.
- Pages that already opt out of the old shell keep their own layouts: login, register, the landing page, onboarding, install, connect and the admin console.
- Old pages render in the content area with no header. Their code is not changed. The providers they publish titles and controls to stay mounted, so nothing breaks; what they publish is simply not shown.

### Where each rail item goes

| Rail item | Opens, until its screen is rebuilt | Marked open on |
|---|---|---|
| Client switcher | see "Scoping, for now" | n/a |
| Agency Ops | `/dashboard` | `/dashboard` |
| Media Buyer | `/campaigns` | `/campaigns`, `/hub/agents/media-buying` |
| Sales Coach | `/Sales-Hub` | `/Sales-Hub` |
| Clients | `/clients` (rebuilt) | `/clients` and `/clients/<id>` |
| Other pages | a menu: BirdyHub (`/hub`), Ask Birdy (`/ask-birdy`), Leads (`/contacts`), Metrics (`/metrics`), Alerts (`/alerts`) | any of those five |
| Settings | `/settings` | `/settings`, `/billing`, `/credits` |
| Credits ring | shows the balance; not a link | n/a |
| Avatar | a menu: Admin console (admins only), Settings, Log out | n/a |

"Other pages" is a dashed tile with three dots, as on board 09. Its menu shrinks as pages are rebuilt or retired.

### Real data on the rail

- **Client switcher:** the signed-in user's clients, with the dot coloured from each client's hand-set health (Critical red, Warning amber, Healthy green; inactive clients grey).
- **Credits ring:** the real credit balance.
- **Section dots:** Media Buyer shows a dot when the Media Buying Agent has open work, the same count the old BirdyHub badge used. Agency Ops and Sales Coach show none until they have something to count.
- **Avatar:** the signed-in user's name.

### Scoping, for now

The reference scopes the whole app to a client and lands on Agency Ops' Bird's Eye for that client. That view is not built yet, so until it is:

- picking a client in the switcher, or clicking a row in the Clients list, opens that client's existing detail page;
- while on a client's detail page the switcher shows that client;
- "Agency view" in the switcher returns to the Clients list;
- "Add new client" in the switcher opens the Add client dialog from part 3.

When Agency Ops' Bird's Eye exists, the same click lands there with the client scoped, and this interim rule is removed.

### Kept and removed

| Kept | Removed |
|---|---|
| The impersonation banner | The Ask Birdy search bar |
| The "agent couldn't run" banner | The notifications bell |
| The Ask Birdy chat window, which old pages still open from their own buttons | The background-jobs widget |
| | The wordmark and version badge |

⌘K opens the client switcher. The old binding of ⌘K to the header search goes away with the header.

### Failure and edge cases

| Situation | What the user sees |
|---|---|
| Clients still loading | The switcher's placeholder rows |
| Clients fail to load | The switcher's message with Retry; the rest of the rail works |
| Credit balance unavailable | No ring |
| A signed-in non-admin | No "Admin console" in the avatar menu |

## Part 2: the Clients list

### Layout (board 09, option A)

- **Header:** the title "Clients"; a count line ("6 clients at risk · 33 active"); when the data was last synced; Import; Add client; the date range.
- **Filter row:** tabs with counts (All active, At risk, On track, Inactive); the sort control; search; Columns.
- **Table:** Client, Status, the number columns, the row arrow.

### Status

- Shown from hand-set health in the redesign's words:

| Stored health | Pill |
|---|---|
| Critical | red "At risk" |
| Warning | amber "At risk" |
| Healthy, or none recorded | green "On track" |

- The At risk tab holds Critical and Warning clients; On track holds the rest of the active ones.
- Inactive clients appear only on the Inactive tab, greyed, with no pill.
- There is no reason text beside the pill.

### Columns

- Default: Spend, Leads, CPL and Leads called (a percentage, see the decisions table), for the chosen date range.
- The Columns menu offers today's full catalogue, including the user's custom metrics.
- The chosen columns are saved to the user's account, as today.
- Every column sorts: first click highest first, second lowest first, third back to the default. Client sorts A to Z, then Z to A.
- Default order, "most urgent first": Critical, then Warning, then On track by spend.

### Behaviour

- Tab, search, sort and date range are kept in the address, so coming back from a client returns to the same list.
- The date range defaults to the last 7 days.
- A row click opens the client (part 1, "Scoping, for now").
- Money is shown in the account's currency, as today.

### States

| State | What the user sees |
|---|---|
| Loading | Grey placeholder rows |
| A client still importing or syncing | Its name, "Loading last 7 days…", placeholders in place of numbers; never a zero that was not measured |
| Load failed | A message with Retry in place of the table |
| Search matches nothing | "No clients match", with a button to clear the search |
| A tab is empty | For example "No clients at risk" |
| The account has no clients | An empty state with Add client and Import |

### Dropped

- CSV export.
- The per-row active/inactive toggle. Marking a client inactive belongs to its own page, whose settings are hidden until that page is rebuilt (see Known consequences).
- The Healthy / Warning / Critical / All tabs, replaced by the four above.

## Part 3: Add client and Import

### A dialog joins the kit

`src/components/by/` gains a dialog: centred, with a header, a scrolling body and a footer strip, on the Radix dialog package already installed. Focus stays inside it and Escape closes it. It follows the kit's rules (role tokens only, no imports from `ds`, `ui` or `pd-*`) and is covered by the hygiene test.

### Add client (board 10, option A)

A stepper dialog with the steps across the top.

| Step | What the user does | Required |
|---|---|---|
| 1 Name | Names the client. A hint offers Import when adding several. | Yes |
| 2 GoHighLevel | Searches and picks the sub-account. | Yes, when the account has any sub-accounts |
| 3 Meta | Searches and picks the ad account. If another client already uses it, picks the campaigns that belong to this one; at least one is required. | Yes, when the account has any ad accounts |
| 4 Calls | Chooses GoHighLevel or Hot Prospector as the source of calls. | Yes |
| 5 Leads | Says how the client gets leads: Meta Instant Forms, a form tool that sends to GoHighLevel, the client's own landing page, or "Ask later" (the default). | Has a default |

These are today's rules. Board 10 showed four steps and a Skip button; reading the old wizard showed five steps and no skipping, and the user chose to keep today's rules (2026-11-19).

- An account another client already uses is labelled "Used by …" before it is picked.
- Back keeps earlier answers. Closing the dialog discards them.
- It opens from the Add client button and from the switcher's "Add new client".
- It sends the same requests as today's wizard.

When adding fails:

| Problem | What the user sees |
|---|---|
| The chosen GoHighLevel location or Meta ad account is already linked to another client | A message naming that client, on the step it concerns |
| The plan's client limit is reached | A message in the dialog with a button to the billing page |
| A list will not load (sub-accounts, ad accounts, campaigns) | A message with Retry inside that step |
| Anything else | The dialog stays open with the choices kept and says what went wrong |

### Import (board 11, option A)

A wide dialog with one table.

- **While Birdy reads the sub-accounts:** a progress state with a count ("16 of 42").
- **Then:** four figures (sub-accounts found, with leads in 90 days, active, inactive); a search; the table.
- **Table columns:** tick, name in Birdy (editable), GoHighLevel sub-account, Meta ad account (a choice, with the suggested match filled in), where leads come from, status.
- Sub-accounts with a recent lead are pre-ticked, up to the limit per import, as today.
- "No matching ad account" is shown in amber. The footer says how many ticked clients will import without ad data.
- A search never unticks hidden rows. The footer says when ticked rows are hidden by the search.
- At the selection limit, the footer says so and further ticks are refused until one is removed.
- **After importing:** a confirmation of how many came in, and how many were skipped because the plan is full or they already exist. New clients appear in the list in their syncing state.
- **Nothing left to import:** the dialog says every sub-account is already in.
- It sends the same requests as today's import.

## Data flow

- The rail, the switcher and the Clients list read clients through the existing client-groups hook, without the per-day series (the list plots nothing).
- Health, active or inactive, and the syncing state come from fields the hook already returns.
- Saved column views and the custom-metrics catalogue use their existing hooks and requests.
- Credits use the existing credits provider.
- Nothing new is requested from the server.

## Checks

- **Tests:** the dialog; both flows, including each failure above; the list's tabs, sort, search, columns and every state; the rail's links, "Other pages" menu, avatar menu and open-section marking.
- **Screenshots:** the list, the Add client steps and the Import dialog compared with boards 09, 10 and 11 at 1440 and 2560 wide.
- **Old pages:** each one opened once inside the new shell (`/dashboard`, `/campaigns`, `/Sales-Hub`, `/contacts`, `/metrics`, `/alerts`, `/hub`, `/ask-birdy`, `/settings`, `/billing`, a client detail page) to confirm it loads and works without its header.
- **Unchanged layouts:** login, register, onboarding and the admin console look as before.
- **Hygiene:** the kit's hygiene test still passes with the new components.

## Known consequences

- Old pages lose the controls they kept in the top bar until they are rebuilt (user's decision, confirmed again on 2026-11-19 once the full list was known): Dashboard (date range, granularity); Marketing, Sales Hub and Leads (client picker, date range, granularity); the client detail page (date range, Client settings); Metrics (search, Create a custom metric); Alerts (create alert); Ask Birdy (new chat, view switch); Dashboards (new dashboard; a dashboard's tabs, save status and buttons).
- Because the client page's settings button is hidden, a client's health and active status cannot be changed on this branch until the client page is rebuilt. The Clients list shows whatever is stored.
- Fired alerts no longer surface anywhere but the Alerts page under "Other pages".
- Running syncs are no longer shown in the navigation; the Clients list's "synced" line and each row's syncing state are the remaining signals.
- The Clients list cannot say why a client is at risk until status is derived from the agents.

## Verified when planning

- "Leads Called" exists as the Hot Prospector metric `hp_leads_with_calls`, a count. The user chose to show it as a percentage of `hp_leads`.
- A client's `client_status` field marks it inactive, and the client detail page already changes it.
- `src/components/ds/` still imports the old sidebar, notifications, credits and jobs components, so those files stay even though the layout stops using them.

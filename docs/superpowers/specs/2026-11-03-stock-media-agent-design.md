# Stock Media Buying Agent and custom agents — design

**Date:** 2026-11-03
**Status:** Approved 2026-11-03
**Repos:** `birdy-beta` (frontend), `birdy-backend` (API, jobs, AI)
**Source process:** `/Users/abdelrahman/Downloads/PLAYBOOK.md`
**Mock:** `docs/superpowers/mocks/stock-agent/mock.html` (option A on setup, morning report and Slack)

## 1. Why

One agency runs a proven media buying process by hand with an AI assistant: batch checks,
spend-stopping alerts, cost-per-lead zones, change cards, a scoreboard of what worked and a
lessons log. Birdy should give every agency that process, with their own targets and clients,
and a lessons log that starts empty.

- **Birdy Media Buying Agent (stock)** becomes that process.
- **Custom agents** become today's agent process: scope, training chat, practice cases, dry
  run, turn on.
- **Slack replaces ClickUp** as the place cards are delivered and discussed.

**Success looks like:** an agency sets the agent up in one sitting. From then on it gets a
report on its schedule, sees spend-stopping problems first, approves or automates each change,
and later suggestions visibly improve from that agency's own results and corrections.

## 2. Decisions taken in brainstorming

| Question | Decision |
|---|---|
| Who changes Meta | Birdy can make the changes, through the mode below |
| Approval | Agent setting: **Flag**, **Ask me** or **Auto** |
| Mode granularity | One mode per change type (Remove, Add, Bring back), with per-client overrides |
| Custom agents | Several allowed; each client has at most one agent that can change its ads |
| Engine | Fixed code for checks and limits; AI chooses among allowed ads and writes the reasoning |
| Setup | **A** — guided full-page steps |
| Morning report | **A** — one long report in the playbook's order |
| Slack | **A** — one summary message with each card in its thread |
| Slack layouts | Agency-editable Block Kit templates for the card, summary and weekly message |

## 3. Playbook mapping

### Kept, with agency-chosen values

| Playbook | In Birdy |
|---|---|
| Batches A and B on fixed weekdays at 07:00 | Agency-defined batches, weekdays, time and timezone |
| Account table with notes | Clients the agency picks, each with a batch and optional notes |
| Green under £2.50, red over £3 | Agency default zones with per-client overrides, in the account's currency |
| Body sculpting, HIFU, lymphatic | Agency-defined treatment tags |
| Javi approves, Mani reviews | The mode setting, plus an optional "also tag" Slack person |
| Morning report | Page in Birdy plus a Slack summary |
| ClickUp card | Slack thread reply and a card in the report, same sections |
| Daily alert check | Same check, every morning |
| Prepaid balance | Same top-up estimate, with agency-entered top-ups |
| Weekly report | Same format, with a Post button in the report |
| Scoreboard and learning loop | Same, stored per agency and starting empty |

### Editable defaults (the playbook's numbers)

| Setting | Default |
|---|---|
| Data window | 7 full days ending yesterday, compared with the 7 before |
| Max ads live per ad set | 4 |
| Winner ranking | 14 days, 8+ leads |
| Old winner may return after | 2 months off |
| Major downtrend (red stays unchanged) | 30% drop, chosen from the playbook's −41% example |
| Score an ad after | 7 days live |
| Won | 5+ leads and CPL at or below the account's CPL before the change |
| Lost | CPL over 1.3× the account's CPL before, or spend past the limit with at most 1 lead |
| Lost spend limit | 6× the client's green limit (the playbook's £15 ÷ £2.50, currency-neutral) |
| Suggest a rule after | 3 repeats of a pattern |
| Prepaid warning | 4 days of spend or fewer |
| Spend drop alert | Under half the day before |
| Auto: max adds per client per run | 2 |

### Dropped as specific to one agency

Lessons log entries, named clients and people, the dashboard Google Sheet (Birdy has no Sheets
integration and has its own dashboards), the Meta AI connection "blocked accounts" workaround
(Birdy uses its own Meta connection), the Mac watchdog and local git steps, and the unpublished
drafts check (not visible to the API).

Lessons are never seeded, including ones that describe general Meta behaviour. Where such a
lesson changes how a check should work, the check uses Meta's own status fields instead (§6).

## 4. Agent types and migration

`agents.type` becomes one of:

- `stock_media_buying`: the new engine. One per user.
- `custom`: today's rule engine. Many per user. Gains a `name` field.

**Migration** is idempotent and runs from `create_agent_indexes`, in this order:

1. Update `type: "media_buying"` to `custom`, and set `name: "Pause and revive rules"`.
2. Drop the unique `(user_id, type)` index.
3. Create a partial unique index on `(user_id, type)` where `type = "stock_media_buying"`.

Existing rules, memory, history and activity stay attached to the same agent id. Stored
suggestions keep their `media_buying:<kind>` agent labels, so `routers/dashboard.py` and past
items keep working.

**Single-agent assumptions to remove:**

| Where | Change |
|---|---|
| `ai/agents/store.py` `create_agent` | Accept type and name; only stock raises `AgentExists` |
| `routers/agents.py` `POST /api/agents` | Body `{type, name}` |
| `ai/tools/agent_tools.py`, training chat | Act on the agent id in the chat context, not "the user's agent" |
| `ai/suggestions/creative_findings.py:359` | Use guardrails from the client's acting agent, else defaults |
| `jobs/agent_jobs.py` | Dispatch on type |
| `src/app/hub/page.jsx`, agent pages, `StartOverButton` | Read the agent id from the route, not `pickAgent` |
| Copy, `ai/prompts/agent_training.py` | Custom agents stop calling themselves "Media Buying Agent" |

### One acting agent per client

New collection `agent_client_claims`, unique on `(user_id, client_group_id)`, value `agent_id`.

- An agent claims its clients when it is turned on.
- Adding a client claimed by another agent returns 409 with the holder's name. The UI offers
  **Move it here**, which transfers the claim, or **Only flag**.
- `check_guardrails` gains a `not_acting_agent` check, run for every write, so a stale card or
  a race can't change the ads of a client that has moved.
- Migration writes a claim for each existing active agent's clients.
- A non-acting agent can still report on that client, with every change treated as Flag.

## 5. Settings model

Stored on the stock agent document:

```
settings: {
  batches: [{id, name, weekdays: [0..6]}],
  schedule: {time, tz},                       // kept in scope.schedule, as the tick reads it
  weekly: {enabled, weekday, auto_post},
  zones: {currency, green_under, red_over},
  treatments: [{id, name}],
  clients: {<gid>: {batch_id, treatment_ids, zones?, notes, on_hold,
                    prepaid: {topups: [{date, amount}]}?, modes?}},
  creative: {max_ads_live, winner_days, winner_min_leads, revive_after_days,
             major_downtrend_pct, auto_max_adds, data_window_days},
  scoring: {min_days, win_min_leads, lose_cpl_multiple, lose_spend_multiple, lose_max_leads, rule_after},
  alerts: {prepaid_days, spend_drop_ratio},
  modes: {remove, add, revive},               // flag | ask | auto, default ask
  slack: {channel_id, channel_name, also_tag_user_id?,
          templates: {card?, summary?, weekly?}},  // absent = the default template
}
```

Validation rules:

- `red_over` must be at least `green_under`.
- Every watched client needs resolved zones. The agency default applies only to clients whose
  account currency matches `zones.currency`. Any other client must have its own override, and
  the setup step says so on that row.
- A client with no treatment tag never receives another client's ads, and its ads are never
  offered to another client. That is how an agency opts a client out of sharing.
- `prepaid` is pre-filled from Meta's `is_prepay_account`, and the agency can change it.
- Every client starts on Your zones. A client CPL target is never copied into a zone limit; agencies give a client its own targets on its row or with the bulk bar.
- Slack is optional. Without it the report and all actions work in Birdy, and a notice says
  cards won't reach Slack.

## 6. The run

### Scheduling on Vercel

The existing tick runs every 15 minutes with a 300 s function limit and a 180 s working budget.
A run can't finish in one invocation across many clients, so it is a stored state machine.

`agent_runs`, unique on `(agent_id, local_date)`:

```
{_id, agent_id, user_id, local_date, kind: batch|alert_only|preview, batch_id,
 phase: alerts|catch_up|checks|writing|publishing|done,
 clients: {<gid>: {state, error}}, alerts: [], summary: {},
 slack: {channel_id, ts}, claimed_at, attempts, created_at}
```

Each tick claims a run, does as much of the current phase as fits, saves and stops. A stale
claim is retried. Progress is per client, so one failing client is recorded and the others
continue. A client that fails appears in the report as "couldn't be checked" with the reason.

`kind` comes from the weekday: a batch day runs that batch, and any other day runs alerts only.
All-clean alert-only days post one Slack line and no report.

### Phases

1. **Alerts**, every client, every morning.
2. **Catch up**, batch days: read edits and comments since last run, score due ads.
3. **Checks**, batch clients: compute window, zone, follow-ups and allowed candidates.
4. **Writing**, clients needing a proposal: one AI call per client.
5. **Publishing**: save cards, post to Slack, then run Auto changes.

### Alerts (spend-stoppers first)

New reads through the agent's Meta connection:

| Problem | Source |
|---|---|
| Account disabled, unsettled, in grace, risk review | `account_status`, `disable_reason` |
| Payment trouble | `account_status` 3 or 9, ads at `PENDING_BILLING_INFO`, missing `funding_source` |
| Rejected, in review, or with issues | Ad `effective_status` (`DISAPPROVED`, `PENDING_REVIEW`, `WITH_ISSUES`), `issues_info`, `ad_review_feedback` |
| £0 yesterday, or under half the day before | Daily spend |
| Active ad with no spend for 2+ days | `effective_status` plus daily spend |
| Prepaid running out | Top-up estimate, flagged at the threshold |

`WITH_ISSUES` is reported separately from `DISAPPROVED`, with Meta's own message, so a delivery
error is never called a rejection.

**Prepaid:** left = latest top-up − account spend since that date. Days left = left ÷ average
of the last 3 full days of spend, or the active daily budgets with fewer than 3 days. Meta
documents `balance` as the bill due, not money remaining, so the estimate stays until a real
prepaid account shows otherwise. Alerts label it as an estimate.

**Timezones:** every window uses the ad account's `timezone_name`. A day still in progress for
that account is excluded, so an account behind the agency's clock isn't flagged for low spend.

Alerts never change anything in Meta and never use AI.

### Checks

- **CPL** = spend ÷ leads for the client's scoped campaigns (`meta_campaign_ids`) over the
  window, from `agent_ad_days`.
- **Zone** from the client's resolved limits. Spend with no leads is red. No spend has no zone
  and shows "No data".

| State | Action |
|---|---|
| Spend stopped | Say so plainly; no CPL judgement; no changes |
| Green | Check for ad errors; no changes |
| Yellow, going down | No changes |
| Yellow, going up | Propose a fix |
| Red, major downtrend | No changes; say what goes in next if it stalls |
| Red, otherwise | Propose changes |

**Follow-ups:** each line of the client's last card is checked in Meta and shown with a tick or
cross. Add = live and spending since the card's date. Remove = off. Additional Changes lines
can't be checked by code and show "Check by hand".

### Allowed candidates

Code builds the list and the AI can only choose from it.

**Adds** come from other clients sharing a treatment tag, ranked by CPL ÷ that client's green
limit over `winner_days`, with at least `winner_min_leads`. Using a ratio makes ranking work
across currencies. The scoreboard is applied first: ads with a winning move record rank higher,
and ads that lost twice in this treatment are removed.

An ad is excluded if the destination account has already run the same creative, or a rejected
copy of it, in any campaign. Match on `image_hash`, or for videos on a normalised name, because
Meta video ids differ per account. This needs `creative{...}` added to `meta_state._AD_FIELDS`,
and the state read must include archived ads.

**Old winners** are ads that won in this account and have been off for `revive_after_days`.

**Removes** are ads currently live in the client's scoped campaigns.

**Limits:** live ads never exceed `max_ads_live`. Removing means pausing; nothing is ever deleted.

**Flag for review:** code checks a candidate's text against other clients' names, and the AI
marks any city, offer or clinic branding it finds in that text. A match is shown on the card,
and an Auto Add of it becomes Ask me.

### Writing

The AI receives the client's facts, allowed candidates, last card, unanswered questions and
active lessons. It returns JSON:

```
{"add": [candidate_id], "remove": [ad_id], "revive": [ad_id],
 "additional_changes": "...", "thought_process": "...", "next_steps": "..."}
```

The server validates it:

- Every id must be in the allowed list, and `max_ads_live` must hold.
- Money figures in the text must appear in the facts. One retry, then a plain code-written
  sentence.
- Green and "no changes" cards make no AI call. They use the playbook's fixed wording, and a
  no-changes card on a red or yellow account states the reason and CPL.
- Lessons and Slack text are passed as data. They can influence choices among allowed ads but
  can't widen the list or bypass guardrails.

Usage goes through `credits.record_usage`. If AI is unavailable or credits have run out, alerts,
zones and follow-ups still go out, cards are marked "Birdy couldn't write this one", and nothing
runs on Auto for that client.

## 7. Cards and modes

`agent_cards`, one per client per run:

```
{_id, agent_id, run_id, client_group_id, tag: changes|no_changes|green,
 window, previous_cpl, current_cpl, currency,
 lines: [{id, kind: add|remove|revive, ad_name, source, record,
          mode, state, error, meta_ids, flags}],
 additional_changes, thought_process, next_steps,
 status: closing|open|applied|partly_applied|dismissed|flagged|superseded,
 original: {...}, slack: {channel_id, ts}, decided_by, decided_at}
```

Line states: `proposed → (queued) → applying → applied | failed | needs_file | blocked`, plus `flagged` and `undone`.

A newer card for the same client marks any open card `superseded`, so an old card can't be applied.

| Mode | Behaviour |
|---|---|
| **Flag** | Card posted. People make the change. Checked as a follow-up next run |
| **Ask me** | Card posted with Apply, Edit, Dismiss. Nothing changes until someone approves |
| **Auto** | Change made within guardrails, card posted with what was done and Undo |

The mode resolves per line: the client's override, then the agent's setting. A card can mix them.

**Auto falls back to Ask me** when data is stale, the client has an open alert, a line carries a
text flag, AI failed, the Add limit is reached, or the video file is missing.

**Writes:**

- **Remove and Bring back** use `execute_action`, `check_guardrails` and
  `check_adset_contents_live`, including protected tags, last live ad, daily pause cap and the
  new acting-agent check. A failure sets the line to `blocked` with the reason.
- **Add** reuses the Creatives posting pipeline (`enqueue_post`, `run_post_jobs`), which already
  guards against double posts. It writes a creative test with `managed_by: "media_agent"`, and
  those tests are excluded from the Creatives tab, verdict tracking, alerts and findings. The
  agent's scoreboard tracks them instead. They consume CT- codes, so codes visible in Creatives
  can have gaps.
- **Page, form and ad set** for an Add come from a live ad in the destination's main scoped ad
  set. If none can be read, the line is `blocked`.
- **Ad names** keep the source's name with a new date and no "– Copy". `_run_step` uses the
  supplied name instead of the `CT-` format for managed tests.

### Moving videos between accounts

Meta video ids belong to one account, and `posting.media_plan` returns `unavailable` for a video
from another account unless Birdy holds the file. Meta also blocks the raw `source` URL for many
ad videos (`routers/meta.py:403`).

So for a video Add:

1. Reuse a file already held for that creative.
2. Try Meta's `source` URL, handing it straight to the upload for that post.
3. Otherwise the line is `needs_file`. The card shows **Upload video**, Slack links to the
   report, and Auto falls back to Ask me.

Files a person uploads are kept and keyed by source account and source video or image, so each is uploaded at most once per source. Images
don't have this problem, as the pipeline already re-uploads them.

**Undo:** Remove and Bring back use the existing undo window. Undoing an Add pauses the new ad.

## 8. Slack

Delivered to the agent's own channel. The bot can post to public channels already. A private
channel needs the bot invited, and the error says so.

- **Summary message:** header, one line of counts, alert sections, a `table` block of clients,
  then **Apply all** and **Open report**.
- **Each card:** a thread reply with Apply, Edit, Dismiss. Slack's `alert` block is modal-only,
  so alerts use `section` blocks with an emoji.
- **Also tag:** the chosen person is mentioned in the summary.
- **Edit:** opens a Slack form for the lines, reasoning and next step.
- **After a decision:** the message is updated with who did it and each line's result.
- **`@Birdy` in a card's thread:** `routers/slack_events.py` looks up the thread in
  `agent_cards`. If found, the text becomes a proposed lesson rather than a chat turn, and Birdy
  replies with what it recorded and an Undo.

**No new Slack permissions are needed.** Birdy can't read ordinary thread replies without
`channels:history`, and adding it would make every agency reconnect. So lessons come from edits,
dismiss reasons and `@Birdy` mentions. Ordinary replies are not read.

**Approval from Slack:** as with today's suggestions, anyone in the channel can press Apply. Setup
says this next to the channel picker, and every decision records who made it.

### Editable templates

The card, summary and weekly message are each a Block Kit template, using the engine Slack Reports
already has (`services/report_blocks.py`, `validate`, `render`, `fit_to_slack`) and its editor
(`src/components/report-designer/ReportEditor.jsx`). An agency can use any block a channel message
accepts, and can reset a template to the default.

- **Defaults** reproduce the playbook's card sections and weekly format, and mock option A's summary.
- **Agent placeholders** are added for the template type:

| Template | Placeholders |
|---|---|
| Card | `{{client}}`, `{{window}}`, `{{previous_cpl}}`, `{{current_cpl}}`, `{{zone}}`, `{{changes}}`, `{{additional_changes}}`, `{{thought_process}}`, `{{next_steps}}`, `{{follow_ups}}` |
| Summary | `{{date}}`, `{{batch}}`, `{{zone_counts}}`, `{{alerts}}`, `{{cards_waiting}}`, `{{tag}}`, plus a `birdy_data` client table with `previous_cpl`, `current_cpl` and `zone` |
| Weekly | `{{week}}`, `{{comparison}}`, `{{improved}}`, `{{decreased}}`, `{{status_check}}`, `{{wins}}` |

- **Report placeholders** such as `{{spend}}` and `{{ranking}}` keep working, because templates use
  the same engine.
- **Buttons are added by Birdy**, after the agency's blocks, based on the card's state and mode. A
  template can't remove or change Apply, Edit, Dismiss, Undo, Apply all or Open report, so an edited
  layout can't break a decision.
- **Oversized messages:** `fit_to_slack` trims them, reserving room for the buttons. If a rendered
  template fails at send time, Birdy logs it, posts with the default template and shows a notice in
  settings, so a bad edit can't stop a morning report.
- **Preview:** the editor renders the template using the agency's latest run, or sample data before
  the first run.

Money stays code-supplied: `{{thought_process}}` is the only AI-written text in these templates,
and it passes the validation in §6.

## 9. Learning loop

Agency-scoped, starting empty.

**Lessons** reuse `agent_memory`, adding `source` (`edit`, `dismiss`, `slack_mention`,
`overrule`, `promoted`), `author`, optional `client_group_id` and `status` (`active`,
`overruled`). `memory_from_note` turns text into a lesson. Typo-level edits are ignored by
comparing the lines and meaning fields, not the wording.

New lessons appear in the report's "What I learned", where someone can Keep or Overrule them.
They are active until overruled, and only active ones reach the AI. All are listed and removable
in settings.

**Scoreboard:** `agent_ad_outcomes` gets one row per applied or flagged Add:
`{agent_id, card_id, client_group_id, treatment_ids, creative_key, ad_id, ad_name, baseline_cpl,
live_since, result, scored_at}`.

Rows are scored in the catch-up phase after `scoring.min_days`, as Won, Lost, No clear change or
Never went live. Never went live counts as an execution problem and doesn't count against the ad.

**Rule suggestions:** a pattern reaching `rule_after` (for example, an ad winning in 3 accounts in
one treatment, or one type repeatedly losing) appears in the report as "Make it a rule?". Yes
stores it as a `promoted` lesson. The scoreboard ranking already prefers proven ads, so a promoted
rule guides the AI and doesn't change fixed checks.

## 10. Weekly report

On the chosen weekday, the report includes the playbook's weekly message for the last full
Monday to Sunday: improved or maintained, decreased or still in red, status check, wins.

- Only red accounts go under "Decreased / still in red", and no internal notes appear.
- It has a **Post to Slack** button. `weekly.auto_post` posts it without asking.
- Status Check compares the same set of accounts as last week.
- Clients marked `on_hold` are left out.

## 11. UI

Built on `src/components/ds/`. Screens follow the chosen mock.

| Route | What |
|---|---|
| `/hub` | Stock card; Custom agents list; Create your own agent |
| `/hub/agents/media-buying` | Stock agent: Report (default), Scoreboard, Lessons, Settings |
| `/hub/agents/media-buying/setup` | Guided setup |
| `/hub/agents/custom/new` | Asks for a name, then starts setup |
| `/hub/agents/custom/[id]` | Today's agent page |
| `/hub/agents/custom/[id]/setup` | Today's setup wizard |

**Setup steps:** Schedule → Clients and targets → Creative rules → Slack → Flag, Ask me or Auto →
Preview first report. Turn on requires at least one client, resolved zones for each, and a
finished preview.

**Preview:** a `preview` run on real data with AI writing. It writes nothing to Meta or Slack, and
it needs ad history ready, shown with the existing `HistoryProgress`.

**Settings** include a Slack section with the three templates, opening the existing report editor.

**Report page order:** answer box, Alerts, cost per lead bars and table, Follow-ups, Scoreboard,
What I learned, Cards (collapsed), Weekly message when due. Past reports are reachable by date.

The nav badge (`useAgentWorkCount`) adds open stock cards and alerts.

## 12. API

Added under `/api/agents/{id}`:

| Route | Purpose |
|---|---|
| `PATCH /settings` | Update settings, validated per §5 |
| `POST /preview` | Start a preview run |
| `POST /activate` | Existing route; stock gets its own readiness check |
| `GET /runs`, `GET /runs/{id}` | Report list and detail |
| `PATCH /cards/{id}` | Edit a card |
| `POST /cards/{id}/apply`, `/dismiss`, `/undo` | Decisions |
| `POST /runs/{id}/apply-all` | All open Ask me cards in a run |
| `POST /cards/{id}/lines/{line}/file` | Attach an uploaded video |
| `GET /outcomes` | Scoreboard |
| `POST /lessons/{id}/keep`, `/overrule` | Lesson decisions |
| `POST /proposals/{id}/accept`, `/reject` | Existing routes, extended for rule suggestions |
| `POST /runs/{id}/weekly/post` | Post the weekly message |
| `GET`, `PUT`, `DELETE /slack-templates/{card,summary,weekly}` | Read, save or reset a template |
| `POST /slack-templates/{kind}/preview` | Render for the editor |

`POST /api/agents` takes `{type, name}`. Scope changes return 409 with `{holder}` on a claimed
client, and accept `{move_claims: true}`.

Backend code lives in a new `ai/agents/stock/` package: `settings`, `alerts`, `windows`,
`candidates`, `writer`, `cards`, `apply`, `slack`, `lessons`, `scoreboard`, `weekly`, `runner`.

## 13. Errors

| Case | Behaviour |
|---|---|
| Meta token expired | Run records it; report and Slack say to reconnect; no writes |
| One client fails | Shown as "couldn't be checked"; others continue |
| Function killed mid-run | Resumes from saved state; after 3 stale attempts the run ends and reports what's missing |
| Slack post fails | Report is still available; the run page shows the error; retried next tick for the same run |
| Apply on a closed or moved client | Line `blocked`, with the reason |
| Add fails in Meta | Line `failed` with Meta's explained error and a Retry |
| Stale data past the grace window | Cards created, Auto falls back to Ask me, report says so |
| Same Slack button pressed twice | Second press returns the existing result; apply uses an atomic claim |

## 14. Testing

**Backend, unit:**

- Zone table, including no leads, no spend and each currency rule.
- Windows and timezones, including an account behind the agency's day.
- Prepaid estimate, candidate exclusions and ranking across currencies.
- Scoring boundaries.
- Writer validation: unknown ids, over the ad limit, invented money.
- Mode resolution and each Auto fallback.

**Backend, integration:**

- Run state machine across simulated ticks and a killed invocation.
- Migration idempotency, including an existing index.
- Claim conflicts and moves.
- Apply and undo per line kind.
- Slack actions, form edits and `@Birdy` routing against stored cards.
- Template validation, placeholder rendering, buttons always present, oversized messages and fallback to the default on a failed render.

**Frontend:** setup validation, report rendering per card state, mode overrides, the custom agent
route by id, and the hub's three states (no stock agent, draft, live).

**End to end:** a Playwright crawl with screenshots of every screen per
`verify-with-screenshots`, against a local backend and a seeded test agency.

## 15. Launch checks

These can't be done without real accounts:

1. **Creatives posting has never run on real Meta.** Post one paused image and one paused video
   on a test account before enabling Add. Until that passes, the `AGENT_ADD_WRITES_ENABLED`
   backend flag stays off and Add can only be Flag.
2. **Video `source` access.** Test on real ad videos to learn how often `needs_file` will appear.
3. **Prepaid accounts.** Compare `balance` with the top-up estimate on a real prepaid account.
4. **Slack table block.** Confirm rendering in a real workspace.

## 16. Out of scope

- Writing custom agents from a plain English description.
- Custom agents using the stock engine.
- Changing the card's data sections outside Slack (the page in Birdy keeps the fixed card).
- Google Sheets export.
- Reading all Slack thread replies (`channels:history`).
- Meta's activity log, including who made a change.
- Inspecting images and video content for faces or branding.

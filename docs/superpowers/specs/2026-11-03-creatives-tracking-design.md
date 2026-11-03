# Creatives Tracking — design

**Date:** 2026-11-03
**Status:** Design approved in chat; spec awaiting review
**Repos:** `birdy-beta` (frontend), `birdy-backend` (API, jobs, AI)
**Mock:** `docs/superpowers/mocks/creatives/mock.html` (Tab A, Wizard 2, detail sheet, integrations section are the chosen ones)

## 1. Why

When the agency wants to find out whether an ad is a winner, it posts the same ad,
under the same naming convention, into many ad accounts, then compares how it does
in each one. Today that is done by hand in Ads Manager and tracked in spreadsheets.

Birdy should own the whole loop:

1. Pick a creative: either **revive an ad we already have** or **create a new ad**.
2. Pick the ad accounts (and an ad set in each) to post it into.
3. Choose the targets that define a winner.
4. Birdy posts it everywhere, tracks it, and calls the verdict.
5. Suggestions, alerts and Birdy AI all understand creative tests, so a user can
   run the loop from chat without opening the Creatives tab.

**Success looks like:** a media buyer starts a test in under three minutes, never
opens Ads Manager to post or check it, and gets a verdict (with the action to take)
pushed to them in-app and in Slack.

## 2. Decisions taken in brainstorming

| Question | Decision |
|---|---|
| Who posts the ads | Birdy posts them through the Meta API |
| How a winner is defined | User chooses per test: thresholds per metric, beat the account baseline, or CPL only |
| Revive path starting point | Pick any existing ad from any connected account's ad list |
| Tab layout | **A** — table, one row per test, expandable per-account rows |
| Wizard | **2** — full page with a live Meta-style preview |
| Where the ad lands | User picks an existing ad set in each account |
| New ad from chat | Chat composer gains image/video attachments |
| Design system | Built on `src/components/ds/` (not `portfolio/` / `--pd-*`), so the Bytes DS migration does not have to port it |

## 3. Concepts

- **Creative test** — one creative posted as N ads, one per chosen ad account.
  It owns the targets, the verdict rules and the lifecycle.
- **Test ad** — one ad Birdy created (or adopted) in one account for one test.
  Has its own per-account score.
- **Test code** — `CT-0001`, sequential per agency (`user_id`). Never reused.
- **Naming convention** — the Meta ad name is identical in every account:
  `CT-0048 | <slug>`, where `<slug>` is a lowercase-dashed version of the
  internal name, max 40 chars. Example: `CT-0048 | mortgage-myth-ugc`.
  Users may edit the slug, not the code or separator.
- **Scored account** — an account whose test ad has passed the scoring floor
  (min spend **or** min days, whichever first). Below the floor the account is
  `scoring`, never pass/fail.

### Lifecycle

```
draft ─► posting ─► testing ─► winner | loser | inconclusive ─► archived
              │
              └─► post_failed (some accounts)  — test continues with the rest
```

- `posting`: ads are being created, all `PAUSED`.
- When every selected account has accepted (or the user chooses "go live with the
  ones that worked"), Birdy sets them all `ACTIVE` in one pass, so the test starts
  the same day everywhere. `started_at` is set then.
- Verdict states are recomputed daily; a verdict can still move until the user
  archives or acts on it (it is a reading, not a lock). `verdict_at` records the
  first time it reached a final state.

## 4. Verdict rules

Per test, `targets.mode` is one of:

| Mode | Account passes when |
|---|---|
| `thresholds` | Every enabled metric meets its threshold. Metrics: `cpl ≤`, `ctr ≥`, `cpc ≤`, `hook_rate ≥`, `leads ≥`. Each prefilled from the client's targets (`client_groups.targets.cpl`), then the agency default (`users.default_targets`), then blank. |
| `baseline` | Test ad's CPL is at least N% below the account's own blended CPL for the same window (and CTR at least N% above, if enabled). Baseline = all other ads in the account, same dates. |
| `cpl_only` | CPL ≤ target. |

Per-account overrides: if the account's client group has its own CPL target, that
number is used for that account (shown in the wizard and detail sheet). Users can
also override per account in the wizard.

**Scoring floor:** `min_spend` (default £150) or `min_days` (default 7), whichever first.

**Test verdict** (over scored accounts only, once at least 2 are scored):

- `winner` when pass share ≥ `win_share` (default 60%)
- `loser` when fail share ≥ `win_share`
- `inconclusive` when every account is scored and neither holds
- otherwise stays `testing`

Hook rate = 3-second video views (`actions[action_type=video_view]`) ÷ impressions.
Not applicable to image ads; the metric is hidden and skipped in scoring for them.

All of this is pure logic in one module per side
(`services/creative_verdict.py`, `src/lib/creative-verdict.js` for display only;
the backend is the source of truth).

## 5. Data model (MongoDB, raw dicts, per house style)

### `creative_tests`

```
id, user_id, code ("CT-0048"), name, slug, meta_ad_name,
origin: "new" | "revive",
source: { ad_id, ad_account_id, client_group_id } | null,   # revive only
creative: {
  format: "image" | "video",
  media: { blob_url, mime, bytes, width, height, duration_s, thumbnail_url },
  primary_text, headline, description, cta_type,
  destination: "lead_form" | "website" | "whatsapp",
  website_url, url_params
},
targets: {
  mode: "thresholds" | "baseline" | "cpl_only",
  metrics: { cpl: {op:"lte", value}, ctr: {op:"gte", value}, ... },
  baseline_pct, min_spend, min_days, win_share
},
on_verdict: { notify_channels: ["in_app","slack"], suggest_pause_failing: true,
              auto_pause_losers: false, alert_id },
status, started_at, verdict, verdict_at, archived_at,
summary: { spend, leads, cpl, ctr, hook_rate, accounts_total, accounts_scored,
           accounts_pass, accounts_fail, updated_at },
created_at, updated_at, created_via: "wizard" | "chat"
```

Indexes: `(user_id, code)` unique; `(user_id, status)`.

### `creative_test_ads`

```
id, user_id, test_id, client_group_id, ad_account_id, page_id,
adset_id, adset_name, lead_form_id,
meta: { image_hash | video_id, creative_id, ad_id },
post_state: "pending" | "uploading" | "created" | "active" | "failed",
post_error: { code, message, step } | null,
targets_override: {...} | null,
score: { state: "scoring" | "pass" | "fail", spend, leads, cpl, ctr, cpc,
         hook_rate, impressions, days_live, baseline_cpl, evaluated_at },
created_at, updated_at
```

Indexes: `(test_id)`; `(user_id, ad_account_id)`; `meta.ad_id` unique sparse.

### `creative_ad_days`

Daily insight rows for tracked ads only:
`(user_id, ad_id, date)` unique → `{spend, impressions, clicks, inline_link_clicks,
actions, video_view_3s, leads}`. Fed by the tracking job (§7). Kept separate from
`agent_ad_days`, which only exists for agent-watched groups and lacks video fields.

### Counter

`creative_test_counters` `{_id: user_id, seq}` incremented with
`find_one_and_update(..., upsert=True)` to mint codes.

Index creators registered in `core/indexes.py::INDEX_CREATORS`.

## 6. Meta integration (backend)

`ads_management` is already in the OAuth scopes, so no reconnect is needed.
All calls go through a new `integrations/facebook_utils/meta_creative_writer.py`
(httpx, Graph v25.0, same token helpers as `meta_status_service.py`).

### Reads (new endpoints in `routers/creatives.py`)

| Endpoint | Graph call | Used by |
|---|---|---|
| `GET /api/creatives/ad-accounts` | distinct `meta_ad_account_id` across the agency's `client_groups`, joined with `/me/adaccounts` names; one row per account with its client name(s) | Wizard step 2 |
| `GET /api/creatives/ad-accounts/{act}/adsets` | `/{act}/adsets?fields=id,name,status,effective_status,campaign{name,objective},optimization_goal,promoted_object` | Ad set picker |
| `GET /api/creatives/ad-accounts/{act}/pages` | `/{act}/promote_pages` | Page per account |
| `GET /api/creatives/pages/{page_id}/lead-forms` | `/{page}/leadgen_forms?fields=id,name,status` | Lead form per account |
| `GET /api/creatives/ads/search?q=&act=` | `facebook_cache.entities.ads` across groups (cached, fast), ranked by name match; metrics from the cached preset | Revive picker |

Ad set compatibility check: when the destination is `lead_form`, the picker only
enables ad sets whose campaign objective is `OUTCOME_LEADS`; for `website`, it
enables traffic/leads/sales objectives. Incompatible ones are shown disabled with
the reason.

### Writes — posting pipeline

Per test ad, in order, each step idempotent (skips if the id is already stored):

1. **Media**
   - Image: download from `blob_url`, `POST /{act}/adimages` (bytes) → `image_hash`.
   - Video: `POST /{act}/advideos` with `file_url=<blob_url>` → `video_id`; poll
     `/{video_id}?fields=status` until `ready` (bounded, resumed by the cron).
   - Revive: media is fetched from the source ad's creative
     (`image_url` / `video_id` source) and re-uploaded, because image hashes are
     account-scoped. If the source account is the target account, reuse directly.
2. **Ad creative** — `POST /{act}/adcreatives` with `object_story_spec`
   (`page_id`, `link_data` or `video_data`, `call_to_action` incl.
   `lead_gen_form_id` for lead forms) → `creative_id`.
3. **Ad** — `POST /{act}/ads` `{name: meta_ad_name, adset_id, creative:{creative_id},
   status:"PAUSED"}` → `ad_id`.
4. **Go live** — once all are `created` (or the user confirms partial), `POST /{ad_id}`
   `status=ACTIVE` for each, reusing `set_object_status()`.

Execution: `POST /api/creatives/{id}/post` enqueues jobs in a `creative_post_jobs`
collection; the work runs from a new `/api/cron/creatives-tick` (every minute,
same claim/lease pattern as `meta_refresh_manager`) so a Vercel function timeout
never leaves a half-posted test. The UI polls `GET /api/creatives/{id}`.

Errors: Meta's `error.code`, `error_subcode` and `error_user_msg` are stored on
`post_error` with the step. Known ones get a plain-language message and a fix
action (lead form not owned by Page → "use website URL"; ad set paused → "post
anyway / pick another"; policy rejection → show Meta's message). Retry =
re-run from the failed step.

### Media upload

The backend runs on Vercel, whose request bodies cap at 4.5 MB, and videos are
often 20–100 MB. So the browser uploads directly to **Vercel Blob** (client upload,
token issued by a new Next.js route `src/app/api/creatives/upload/route.js`), and
only the resulting URL goes to the backend. Meta pulls videos from that URL
(`file_url`). Limits: images ≤ 30 MB (jpg/png), videos ≤ 1 GB (mp4/mov), enforced
client-side and by the token route. Blobs are deleted 30 days after the test is
archived (handled by the cleanup cron).

> Assumption: the frontend Vercel project can add a Blob store. If not, the same
> client-upload flow works with S3 presigned URLs; only the token route changes.

## 7. Tracking

New job `jobs/creative_tracking.py`, run by `/api/cron/creatives-tick` once per
group per night (reusing `daily_refresh_slot.py`) and on demand from the detail sheet:

1. For each account with live test ads, one call:
   `/{act}/insights?level=ad&time_increment=1&filtering=[{field:"ad.id",operator:"IN",value:[...]}]`
   `fields=ad_id,spend,impressions,clicks,inline_link_clicks,actions,date_start`
   from `started_at` to yesterday. Upsert into `creative_ad_days`.
2. Baseline (mode `baseline` only): account-level insights for the same window
   minus the test ads.
3. Score each test ad, roll up the test `summary` and `verdict`
   (`services/creative_verdict.py`).
4. Emit events for state changes (verdict reached, account went pass→fail,
   account crossed fail) to the suggestions and alerts engines (§9).

Ads matched by stored `meta.ad_id`. A nightly reconcile also scans
`facebook_cache.entities.ads` for names starting with a known `CT-` code that
Birdy does not hold yet (someone duplicated it by hand) and offers to adopt them
via a suggestion, rather than silently tracking them.

## 8. Frontend

### 8.1 Creatives tab (Marketing Hub, `/campaigns`)

- `SECTION_TABS` gains `creatives`. Content lives in
  `src/components/creatives/CreativesTab.jsx`; `MarketingContent.jsx` only mounts it.
- **Hero while on this tab:** ds `MetricTabsChart` with tabs Tests live, Test
  spend, Leads, Blended CPL, Hook rate, Win rate; and `BirdyRead` fed by
  creative-scoped findings (§9). Other tabs keep the current hero.
- **Toolbar:** search, status chips (All / Testing / Winners / Losers /
  Archived, with counts), Columns menu (saved via `usePageViews("mktg_creatives")`),
  primary button **New creative test** → wizard route.
- **Table:** ds `DataTable` with `getSubRows` for per-account rows.
  Parent columns: Creative (thumb, name, code, date, origin), Accounts (dot strip
  + "7/9 pass"), Spend, Leads, CPL vs target, CTR, Hook, Progress to verdict
  (`ProgressBar`), Verdict (`Badge`). Child columns: account name, act id,
  ad set, pass/fail/scoring badge, same metrics, progress to floor, row action
  (Scale budget / Pause here / Retry).
- Client-group picker filters tests to those with ≥1 ad in that group's account;
  date picker does **not** apply (tests have their own window), and the tab
  says so in the toolbar.
- Row click → detail sheet.
- Empty state explains the loop and offers both paths.

### 8.2 Wizard — `/campaigns/creatives/new` (and `/campaigns/creatives/[id]/edit` for drafts)

Full page, two columns: form left, sticky preview right. Progress line reuses the
`WizardSteps` pattern (generalised to accept step labels).

1. **Creative**
   - Path cards: *Create a new ad* / *Test an ad you already have*.
   - New: media drop zone (uploads to Blob with progress), primary text,
     headline, description, CTA, destination (lead form / website / WhatsApp),
     internal name → generated `CT-xxxx | slug`.
   - Revive: searchable picker over all cached ads (thumb, name, account, CPL,
     leads, spend for the last 30 days, status). Picking one fills every field
     from the source creative; fields stay editable (editing makes it a variant,
     which is noted on the test).
2. **Accounts** — table of all agency ad accounts with client name. Per selected
   row: Page (defaults to the source ad's Page or the account's most-used
   Page), ad set picker (compatibility-filtered), lead form picker when the
   destination needs one. "Apply to all" for anything that has a same-named
   match across accounts (e.g. ad sets named "Birdy tests").
3. **Targets** — mode cards (thresholds / beat the account / CPL only), metric
   rows with prefilled values and source labels, per-account overrides drawer,
   scoring floor, win share, verdict actions (notify channels, suggest pausing
   failing accounts, auto-pause losers as an agent rule).
4. **Review & post** — summary per account, warnings (missing lead form,
   paused ad set, image ad with hook rate selected), and **Post to N accounts**.
   After posting the page turns into a live progress list per account and then
   links to the detail sheet.

**Preview:** Meta-style feed/reels/stories frame, rendered locally from the form
(no Meta call while typing). An account switcher shows the Page name per
account. After posting, "View on Meta" uses the existing
`/api/facebook/ad-preview/{ad_id}`.

Drafts autosave (`status=draft`), so leaving the page loses nothing.

### 8.3 Detail sheet

ds `Sheet` size `lg`, opened from the table, `BirdyRead` rows, suggestion cards,
alerts and chat cards (`?creative=CT-0048` deep link on `/campaigns`).
Content per the mock: header (thumb, name, code, origin, verdict badge, format,
destination, primary action), KPI row vs targets, per-account line chart
(`SegmentedTabs` CPL / CTR / Hook / Leads, dashed target line), accounts table,
Birdy's read for this test, footer actions (Add accounts, Edit targets, Pause
everywhere, Archive). Add accounts reopens wizard step 2 for the same test.

### 8.4 New frontend files

```
src/components/creatives/
  CreativesTab.jsx  CreativesTable.jsx  CreativeDetailSheet.jsx
  AccountDotStrip.jsx  VerdictBadge.jsx  useCreativeTests.js
src/app/campaigns/creatives/new/page.jsx
src/app/campaigns/creatives/[id]/edit/page.jsx
src/components/creatives/wizard/
  StepCreative.jsx  StepAccounts.jsx  StepTargets.jsx  StepReview.jsx
  AdPreview.jsx  RevivePicker.jsx  MediaDrop.jsx  useCreativeDraft.js
src/app/api/creatives/upload/route.js
src/lib/creatives-api.js  src/lib/creative-verdict.js  src/lib/creative-naming.js
```

## 9. Suggestions, alerts, Slack

### Suggestions (`ai/suggestions/`)

New deterministic subagent `CreativeTestJudge`, run by the tracking job (not only
by the weekly suggestions cron), writing `Finding`s into `ai_suggestions`:

| rule_id | Severity | Action type | Apply does |
|---|---|---|---|
| `creative_winner` | OPPORTUNITY | `scale_creative` | Opens wizard step 2 prefilled with accounts that have not run it (needs a second click to post — posting is never one-click from a card) |
| `creative_loser` | HIGH | `pause_ads` | Pauses the test ads that failed, keeps passing ones (existing action type) |
| `creative_account_fail` | MEDIUM | `pause_ads` | Pauses that one account's test ad |
| `creative_post_failed` | HIGH | `retry_creative_post` | Re-runs the failed step, or applies the suggested fix |
| `creative_adopt` | MEDIUM | `adopt_creative_ad` | Links a hand-duplicated `CT-` ad to its test |

`dedup_key` = `rule_id:test_id[:ad_account_id]`. Findings carry `creative_test_id`
so every card can deep-link to the detail sheet. `actions.py` gains the two new
action types; the dashboard `SuggestionCard` and the Media Buying Agent
`WorkItem` render them with no layout changes (title, description, stats, button).

### Alerts (`services/alert_service.py`)

- `AlertCondition` gains `scope: "clients" | "creative_tests"` (default `clients`,
  so existing alerts are untouched) and `creative_test_ids` (empty = all live tests).
- New metrics in `METRIC_LABELS`: `creative_verdict` (event-style: fires on
  reaching winner/loser), `creative_cpl`, `creative_ctr`, `creative_hook_rate`,
  `creative_post_failed`. Operators as today; `per_account` tracking mode
  mirrors `per_client`.
- Evaluated from `creative_tests.summary` and `creative_test_ads.score`.
- The wizard's "notify when a verdict lands" creates one such alert per test
  (stored as `on_verdict.alert_id`, removed on archive).
- `/alerts` editor: Scope segmented control; when `creative_tests`, the client
  picker is replaced by a test picker.

### Slack

Verdict and post-failure events go through the existing `report_events` outbox,
so they reach Slack with the existing apply/dismiss buttons.

## 10. Birdy AI

### Tools (`ai/tools/creative_tools.py`, registered in `routers/chat.py`)

| Tool | Writes? | Purpose |
|---|---|---|
| `find_ads` | no | Search cached ads across accounts by name/text/client, with recent metrics |
| `list_ad_accounts` | no | Agency accounts with client names |
| `list_adsets` | no | Ad sets for an account, with compatibility for a destination |
| `list_creative_tests` | no | Tests with status, summary, verdict |
| `get_creative_test` | no | One test with per-account scores (renders via `render_ui`) |
| `draft_creative_test` | draft only | Creates/updates a `draft` test from chat inputs; returns a confirm card |
| `post_creative_test` | **Meta** | Posts a draft. Requires `confirmed=true`, otherwise returns `confirmation_required` (same hard gate as `analyze_call_recordings`) |
| `scale_creative_test` | **Meta** | Adds accounts to an existing test; same gate |
| `pause_creative_ads` | **Meta** | Pauses the test in some/all accounts; same gate |
| `update_creative_targets` | Birdy only | Changes targets/floor; rescoring happens on next run |

`_PAGE_TOOLS` gives all of them to `campaigns` and the global chat; read tools to
`dashboard`. Prompt guidance added to `ai/prompts/birdy.py`: ask for missing
accounts/targets with `:::ui` choice blocks, always draft before posting, never
post without the confirm card being accepted.

### Confirm card

Frontend: new `:::creative` block parsed in `chat-ui-parser.js`, rendered by
`components/chat/blocks/CreativeTestCard.jsx` — thumb, code, accounts, targets,
destination, warnings, buttons **Post to N accounts** / **Open in wizard** /
**Change targets**. "Post" sends the confirmation turn that calls the tool with
`confirmed=true`. Tool pills get a `creative` category in `chat-tool-icons.js`.

### Chat attachments

- `ChatConversation` composer gains an attach button + drag-and-drop, images
  and videos only, same Blob client upload as the wizard (§6), with progress
  chips above the input.
- `POST /api/chat` accepts `attachments: [{blob_url, mime, bytes, width, height,
  duration_s}]` on a user message. They are stored with the message and passed
  to tools; images are also passed to the model as image content when the
  provider supports vision (videos as a thumbnail frame + metadata).
- `draft_creative_test` can take an attachment index as its media.

## 11. Error handling and guardrails

- No Meta write without either a wizard **Post** click or an accepted chat confirm card.
- Everything is created `PAUSED` first; go-live is a separate pass.
- Partial failure never blocks the rest; the user can go live with the accounts
  that worked and retry the others.
- Agent guardrails (`max_pauses_per_client_day`, `protected_tags`) apply to
  `pause_ads` from creative suggestions as they do today.
- Token expiry / permission errors surface as the existing Meta reconnect banner.
- Rate limits: posting runs per account sequentially with backoff on Meta codes
  4/17/613; tracking batches ad ids per account (≤50 per call).
- Archive does not delete Meta ads; it only stops tracking. A separate explicit
  "pause everywhere" exists.

## 12. Testing

- **Backend unit:** `creative_verdict` (each mode, floor, overrides, share
  thresholds, image vs video), naming/slug, counter minting, error mapping.
- **Backend integration:** posting pipeline against recorded Graph responses
  (`respx`), idempotent retries, partial go-live; tracking job upsert + rollup;
  new suggestion rules dedup; alert scope evaluation; tool confirmation gate.
- **Frontend:** `CreativesTab` table + sub-rows, wizard step validation and
  draft autosave, preview rendering, `:::creative` parser + card, composer
  attachments (Vitest + Testing Library, per existing `__tests__` layout).
- **Manual verify:** build with `NEXT_PUBLIC_API_URL` pointed at the local
  backend, crawl `/campaigns?tab=creatives`, the wizard and the chat flow, and
  screenshot each state against the mock before calling a phase done. Posting
  is verified against a sandbox/test ad account only.

## 13. Phases

Each phase ships on its own and is usable.

1. **Track** — data model, counter, naming, tracking job, verdict engine,
   Creatives tab + detail sheet, "adopt existing `CT-` ads" (lets the team use it
   immediately with ads they post by hand).
2. **Post** — Meta read endpoints, Blob upload, posting pipeline + cron, wizard
   (both paths) with preview.
3. **Act on it** — `CreativeTestJudge` suggestions, alert scope + metrics,
   Slack events, hero `BirdyRead` for the tab.
4. **Birdy AI** — creative tools, confirm card, chat attachments.

## 14. Open items to confirm during implementation

- Vercel Blob available on the frontend project (else S3 presigned, §6).
- A Meta test ad account to verify posting end-to-end before Phase 2 ships.
- Whether WhatsApp destination is needed in v1; it is in the form but can be
  hidden behind a flag if no client uses it.

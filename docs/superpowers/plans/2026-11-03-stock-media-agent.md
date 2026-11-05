# Stock Media Buying Agent and Custom Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn today's agent into "custom agents" and build the playbook process as the stock Birdy Media Buying Agent, with per-agency settings, Flag/Ask me/Auto changes, Slack delivery and a per-agency learning loop.

**Architecture:** A new `ai/agents/stock/` package runs a resumable state machine over the existing 15-minute agents tick. Fixed code computes alerts, zones, follow-ups and allowed ads; AI chooses among allowed ads and writes the reasoning, and the server validates its output. Writes reuse `execute_action`, the guardrails and the Creatives posting pipeline; Slack reuses the report template engine.

**Tech Stack:** FastAPI, Motor/Mongo (mongomock in tests), pytest; Next.js 16, SWR, Vitest, `src/components/ds`; Slack Block Kit; Meta Graph v25.0.

**Spec:** `docs/superpowers/specs/2026-11-03-stock-media-agent-design.md`. Read it first; this plan doesn't repeat its tables.

**Worktrees and commands:**
- Backend: `/Users/abdelrahman/Desktop/Birdy/birdy-backend-stock-agent`, branch `feat/stock-media-agent`. Tests: `../birdy-backend/.venv/bin/pytest tests/<file> -q`.
- Frontend: `/Users/abdelrahman/Desktop/Birdy/birdy-beta-stock-agent`, same branch. Run `npm ci` once. Tests: `npx vitest run <path>`.

## Global Constraints

- `agents.type` values: `stock_media_buying` (one per user), `custom` (many). Display names: "Birdy Media Buying Agent"; migrated custom agents are named "Pause and revive rules".
- Modes are `flag | ask | auto`; every change type defaults to `ask`. Alerts are always Flag.
- Nothing is ever deleted in Meta. Removing means pausing.
- The lessons log and scoreboard start empty. Nothing from `PLAYBOOK.md`'s lessons log, clients or people is seeded.
- Money stays in each account's own currency. Never mix currencies or use `fx_rate` in this feature.
- Fixed code supplies every number. AI output never reaches a card without `validate_draft`.
- Tick budget is `TICK_BUDGET_SECONDS` (180 s of Vercel's 300 s). All long work is resumable.
- Slack buttons are added by code after template blocks. A template can't remove them.
- `AGENT_ADD_WRITES_ENABLED` (env, default off) gates all Add writes. While off, Add resolves to Flag.
- Frontend is built only from `src/components/ds`. The mascot only appears inside its round frame. UI copy has no em dashes.
- Slack's `alert` block is modal-only; messages use `section`.
- Default editable numbers: spec §3 table, copied verbatim into `DEFAULT_SETTINGS`.

## Review Focus

1. **A card acted on after things changed** (agent off, client moved, or a newer card exists): Apply refuses with a plain reason, nothing changes in Meta. Test in Task 11.
2. **A brand-new client** with no last card, previous window or scoreboard: the report renders "No data" and the run finishes. Test in Task 9.
3. **Two client groups on one shared ad account:** account alerts appear on both with one Graph read, while CPL and Adds stay inside each group's campaigns. Test in Tasks 6 and 7.
4. **An agency saves a broken Slack template** (unknown placeholder, empty blocks, too long): save returns the errors, and a failure at send time posts the default plus a settings notice. Test in Task 14.
5. **Slack disconnected or the channel removed between setup and a run:** the report still appears in Birdy with the error, and Ask me lines remain applicable there. Test in Task 15.

---

## Part 1: Custom agents

### Task 1: Agent types, names and migration

**Files:**
- Modify: `ai/agents/store.py`, `routers/agents.py:138-147`, `ai/suggestions/creative_findings.py:359`
- Test: `tests/test_agent_types.py`

**Interfaces:**
- Produces: `TYPE_STOCK = "stock_media_buying"`, `TYPE_CUSTOM = "custom"`; `create_agent(db, user_id, *, type=TYPE_CUSTOM, name=None, tz="Europe/London")`; `async migrate_agent_types(db)`; `AGENT_PATCH_KEYS` gains `name`, `settings`.

- [ ] **Step 1: Write failing tests**

```python
async def test_migration_renames_and_is_idempotent(mock_db):
    await mock_db.agents.insert_one({"_id": "a", "user_id": "u", "type": "media_buying", "status": "active",
                                     "scope": {"client_group_ids": ["g1"]}})
    await store.migrate_agent_types(mock_db)
    await store.migrate_agent_types(mock_db)
    doc = await mock_db.agents.find_one({"_id": "a"})
    assert (doc["type"], doc["name"]) == ("custom", "Pause and revive rules")

async def test_custom_agents_can_repeat_stock_cannot(mock_db):
    await store.create_agent(mock_db, "u", type="custom", name="One")
    await store.create_agent(mock_db, "u", type="custom", name="Two")
    await store.create_agent(mock_db, "u", type=store.TYPE_STOCK)
    with pytest.raises(store.AgentExists):
        await store.create_agent(mock_db, "u", type=store.TYPE_STOCK)

async def test_stock_agent_has_no_rules(mock_db):
    a = await store.create_agent(mock_db, "u", type=store.TYPE_STOCK)
    assert await store.list_rules(mock_db, a["_id"]) == []
```
Also a router test: `POST /api/agents` with `{"type":"custom","name":""}` returns 400.

- [ ] **Step 2: Run, verify they fail** — `../birdy-backend/.venv/bin/pytest tests/test_agent_types.py -q`, FAIL on missing `migrate_agent_types`.

- [ ] **Step 3: Implement.** In `create_agent_indexes`: call `migrate_agent_types`, drop the old unique index if present (ignore not found), create the unique partial index with `partialFilterExpression={"type": TYPE_STOCK}`. `POST /api/agents` body `{type, name}`; custom requires a non-blank name of at most 60 chars. `creative_findings.py:359` reads the guard from `acting_agent(db, user_id, gid)` once Task 2 exists; for this task query `{"user_id": user_id, "type": "custom"}`.

- [ ] **Step 4: Run new tests plus `tests/test_agents_router.py tests/test_creative_final_fixes.py`, verify PASS.** Update old fixtures using `type: "media_buying"`.

- [ ] **Step 5: Commit** — `feat(agents): custom and stock agent types with migration`.

### Task 2: One acting agent per client

**Files:**
- Create: `ai/agents/claims.py`
- Modify: `ai/agents/guardrails.py`, `routers/agents.py` (`patch_agent`, `activate`), `ai/suggestions/creative_findings.py`, `ai/agents/store.py` (migration, index)
- Test: `tests/test_agent_claims.py`

**Interfaces:**
- Produces: `CLAIMS = "agent_client_claims"`; `async claim_clients(db, user_id, agent_id, gids, *, move=False) -> list[dict]` returns conflicts `[{client_group_id, holder_id, holder_name}]` and claims nothing when any conflict exists without `move`; `async release_clients(db, user_id, agent_id, gids=None)`; `async holder(db, user_id, gid) -> str | None`; `async acting_agent(db, user_id, gid) -> dict | None`.

- [ ] **Step 1: Write failing tests**: conflict returned with the holder's name and no partial claim; `move=True` transfers; `delete_draft_agent` and turning off release; two concurrent `claim_clients` on one client yield one holder; `check_guardrails` returns blocked code `not_acting_agent` for a client held by another agent; a migrated active agent holds its clients; a custom agent watching a client held by another gets its rules' items as `flag`.

- [ ] **Step 2: Run, verify failure.**

- [ ] **Step 3: Implement** unique index `(user_id, client_group_id)`. `check_guardrails` runs this check first. `activate`, and `patch_agent` on an active agent's scope, claim `scope.client_group_ids`, returning `409 {"detail", "conflicts"}` unless the body has `move_claims: true`. Clients the user chose to only flag stay watched with no claim. In `runner.run_agent`, a rule item for a non-held client is forced to `flag`.

- [ ] **Step 4: Run tests plus `tests/test_agent_runner.py tests/test_agent_apply.py`, verify PASS.**

- [ ] **Step 5: Commit** — `feat(agents): one acting agent per client`.

### Task 3: Training chat by agent id

**Files:**
- Modify: `ai/tools/agent_tools.py:28-30`, `routers/chat.py` (`ChatRequest`), `ai/orchestrator.py`, `ai/prompts/agent_training.py`
- Test: `tests/test_agent_tools.py`

**Interfaces:**
- Produces: `ChatRequest.agent_id: Optional[str]`; `current_training_agent: ContextVar[str | None]`, set by `routers/chat.py` on page `agent_training`.

- [ ] **Step 1: Write failing tests**: with two custom agents, `set_rule_param` changes only the agent in `current_training_agent`; another user's agent id returns `{"ok": False}`; a stock agent id returns `{"ok": False}`.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** `_agent` resolving from the ContextVar, owned and `TYPE_CUSTOM`. Prompt text says "this agent" instead of "their Media Buying Agent". `NO_AGENT = "Set up this agent first"`.
- [ ] **Step 4: Run `tests/test_agent_tools.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): training chat targets one agent by id`.

### Task 4: Frontend: custom agent routes

**Files (frontend repo):**
- Move: `src/app/hub/agents/media-buying/**` → `src/app/hub/agents/custom/[id]/**` (including `setup/` and tests)
- Create: `src/app/hub/agents/custom/new/page.jsx`
- Modify: `src/lib/agents-api.js` (`createAgent({type, name})`), `src/lib/constants.js:83-84`, `src/components/agents/StartOverButton.jsx`, `src/components/agents/TrainingChat.jsx`, `src/lib/__tests__/constants-routes.test.js`
- Test: moved tests, plus `src/app/hub/agents/custom/new/__tests__/page.test.jsx`

**Interfaces:**
- Produces: `customAgentPath(id)`, `customSetupPath(id)` from `src/lib/agents-api.js`; `TrainingChat` sends `agent_id`.

- [ ] **Step 1: Move the files and update moved tests** to render with `params: {id}`, asserting the agent read is `/api/agents/<id>`, never a list lookup. Add a new-page test: submit "Lead rules" posts `{type:"custom",name:"Lead rules"}` and pushes `/hub/agents/custom/<id>/setup`; blank name shows an inline error.
- [ ] **Step 2: Run `npx vitest run src/app/hub/agents`, verify failure.**
- [ ] **Step 3: Implement.** Remove `pickAgent` and `useEnsuredAgent`, using `use(params)`. `HEADINGS[1].title` becomes `Set up ${agent.name}`, and step 2's copy drops "Media Buying Agent". The scope step shows a conflict from a 409 with **Move it here** and **Only flag**. Add both new routes to the protected list in `constants.js`.
- [ ] **Step 4: Run `npx vitest run src/app/hub src/components/agents src/lib/__tests__/constants-routes.test.js`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(hub): custom agents have their own routes`.

---

## Part 2: Stock engine

### Task 5: Settings, zones and modes

**Files:**
- Create: `ai/agents/stock/__init__.py`, `ai/agents/stock/settings.py`, `routers/agent_stock.py`
- Modify: `main.py` (router), `ai/agents/store.py` (`create_agent` stock branch sets `settings`)
- Test: `tests/test_stock_settings.py`

**Interfaces:**
- Produces: `DEFAULT_SETTINGS: dict`; `resolve_zones(settings, gid, currency) -> Zones | None`, where `Zones` is a frozen dataclass of `green_under`, `red_over`; `resolve_mode(settings, gid, kind) -> str`; `settings_errors(settings, groups: list[dict]) -> list[dict]` of `{field, client_group_id?, message}`; `resolve_lost_spend(settings, zones) -> float`; `PATCH /api/agents/{id}/settings`.

- [ ] **Step 1: Write failing tests**

```python
def test_default_zones_only_for_matching_currency():
    s = {**DEFAULT_SETTINGS, "zones": {"currency": "GBP", "green_under": 8, "red_over": 10}}
    assert resolve_zones(s, "g", "GBP") == Zones(8, 10)
    assert resolve_zones(s, "g", "USD") is None

def test_client_override_wins():
    s = {**DEFAULT_SETTINGS, "zones": {"currency": "GBP", "green_under": 8, "red_over": 10},
         "clients": {"g": {"zones": {"green_under": 6, "red_over": 8}}}}
    assert resolve_zones(s, "g", "USD") == Zones(6, 8)

def test_red_below_green_is_an_error(): ...
def test_usd_client_without_override_is_an_error_naming_it(): ...

def test_mode_defaults_to_ask_and_client_override_wins():
    assert resolve_mode(DEFAULT_SETTINGS, "g", "add") == "ask"
    s = {**DEFAULT_SETTINGS, "clients": {"g": {"modes": {"add": "flag"}}}}
    assert resolve_mode(s, "g", "add") == "flag"

def test_add_is_flag_while_writes_disabled(monkeypatch):
    monkeypatch.delenv("AGENT_ADD_WRITES_ENABLED", raising=False)
    assert resolve_mode({**DEFAULT_SETTINGS, "modes": {"add": "auto"}}, "g", "add") == "flag"

def test_lost_spend_is_six_times_green():
    assert resolve_lost_spend(DEFAULT_SETTINGS, Zones(2.5, 3)) == 15
```
Add a route test: PATCH with an invalid mode returns 400; PATCH client list updates `scope.client_group_ids` (which keeps history sync working through `history.ensure_docs`).

- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** with defaults from spec §3 and §5. `batches` defaults to A `[0,3]`, B `[1,4]`. `zones` defaults to nulls, because money limits are never pre-set. PATCH merges, runs `settings_errors` only on `/activate`, returning per-field errors as `400` when a value's shape is invalid. Pre-fill `clients[gid].zones.green_under` from `client_targets` on first add, and `prepaid` from Task 6's `is_prepay_account` when known.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock agent settings`.

### Task 6: Alerts and prepaid estimate

**Files:**
- Create: `ai/agents/stock/alerts.py`, `ai/agents/stock/windows.py`
- Modify: `ai/agents/meta_state.py:22-23,60-120` (fields; include archived ads)
- Test: `tests/test_stock_alerts.py`, `tests/test_stock_windows.py`

**Interfaces:**
- Produces: `Window(start, end, prev_start, prev_end)`; `full_day_window(now_utc, tz_name, days=7) -> Window`; `last_full_day(now_utc, tz_name) -> date`; `async fetch_account_health(ad_account_id, token) -> dict` with fields `account_status, disable_reason, funding_source, is_prepay_account, timezone_name, currency, name`; `health_alerts(health, ads, daily_spend, settings, gid, now_utc) -> list[dict]` of `{client_group_id, code, severity, title, detail, since}`; `prepaid_estimate(topups, spend_since, last3_days, daily_budgets) -> {left, per_day, days_left} | None`; `async run_alerts(db, agent, token_for, now_utc, client_ids) -> list[dict]`. `meta_ad_state` gains `issues`, `review_feedback`, `creative` (`id, image_hash, video_id, page_id, lead_form_id, body, title, link`).

- [ ] **Step 1: Write failing tests** covering:

```python
def test_window_is_7_full_days_ending_yesterday_in_account_tz():
    w = full_day_window(datetime(2026, 11, 3, 7, tzinfo=timezone.utc), "Europe/London")
    assert (w.start, w.end, w.prev_start, w.prev_end) == (
        date(2026,10,27), date(2026,11,2), date(2026,10,20), date(2026,10,26))

def test_account_behind_agency_excludes_its_day_in_progress():
    now = datetime(2026, 11, 3, 7, tzinfo=timezone.utc)   # still Nov 2 in Los Angeles
    assert last_full_day(now, "America/Los_Angeles") == date(2026, 11, 1)

def test_with_issues_is_not_called_rejected(): ...      # code "ad_with_issues", Meta's message in detail
def test_disapproved_is_rejected(): ...                  # code "ad_rejected"
def test_status_3_or_9_is_payment(): ...
def test_zero_spend_and_under_half(): ...                # exactly half is no alert
def test_active_ad_no_spend_two_days(): ...

def test_prepaid_estimate_uses_budget_with_under_three_days():
    assert prepaid_estimate([{"date":"2026-11-01","amount":500}], 60, [20,40], [30])["per_day"] == 30
def test_prepaid_alert_at_threshold_labelled_estimate(): ...

async def test_shared_ad_account_read_once_alert_on_both_groups(mock_db, ...): ...  # Review Focus 3
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `/ads` filtering includes `ARCHIVED`. Don't change how existing evaluators treat non-ACTIVE ads (run `tests/test_agent_runner.py`). `run_alerts` caches `fetch_account_health` per ad account for the call. A read failure yields an alert with code `check_failed`, never an exception.
- [ ] **Step 4: Run new tests plus `tests/test_agent_runner.py tests/test_eval_*.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock alerts, windows and prepaid estimate`.

### Task 7: Zones, follow-ups and allowed candidates

**Files:**
- Create: `ai/agents/stock/checks.py`, `ai/agents/stock/candidates.py`, `ai/agents/stock/scoreboard.py` (outcome store and `record_for`)
- Test: `tests/test_stock_checks.py`, `tests/test_stock_candidates.py`

**Interfaces:**
- Consumes: `load_ad_days`, `load_state` (`ai/agents/snapshot.py`), `Zones`, `Window`.
- Produces: `cpl(spend, leads) -> float | None`; `zone(spend, leads, zones) -> "green"|"yellow"|"red"|"no_data"`; `decide(zone, prev_cpl, cur_cpl, spend_stopped, major_pct) -> "spend_stopped"|"none"|"propose"|"hold_downtrend"`; `async client_facts(db, agent, group, window) -> dict`; `follow_ups(card, ad_states, ad_days) -> list[{line_id, text, ok: bool|None}]`; `creative_key(ad) -> str`; `normalise_name(name) -> str`; `async build_candidates(db, agent, group, window) -> dict` with `add`, `revive`, `remove`; `async record_for(db, agent_id, creative_key) -> {won, lost, moves}`.

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.parametrize("spend,leads,z", [(0,0,"no_data"),(50,0,"red"),(70,10,"green"),
    (80,10,"yellow"),(100,10,"yellow"),(101,10,"red")])
def test_zone(spend, leads, z): assert zone(spend, leads, Zones(8, 10)) == z

def test_decide_table():
    assert decide("red", 10, 7, False, 30) == "hold_downtrend"    # exactly 30% counts
    assert decide("red", 10, 7.5, False, 30) == "propose"
    assert decide("yellow", 8, 9, False, 30) == "propose"
    assert decide("yellow", 9, 8.5, False, 30) == "none"
    assert decide("yellow", 9, 9, False, 30) == "none"
    assert decide("green", 1, 9, True, 30) == "spend_stopped"

def test_normalise_strips_copy_and_date():
    assert normalise_name("BS - Timelapse - 100926 - Win – Copy 2") == normalise_name("BS - Timelapse - 110326 - Win")

async def test_excludes_ad_already_run_including_rejected_copy(mock_db): ...
async def test_image_matches_by_hash_even_with_new_name(mock_db): ...
async def test_needs_shared_treatment_and_min_leads(mock_db): ...       # 7 leads excluded, 8 included
async def test_client_without_treatment_gives_and_gets_nothing(mock_db): ...
async def test_rank_uses_cpl_over_source_green_limit_across_currencies(mock_db): ...
async def test_lost_twice_is_removed_and_winner_ranks_first(mock_db): ...
async def test_old_winner_needs_revive_after_days(mock_db): ...
async def test_shared_account_candidates_stay_in_group_campaigns(mock_db): ...  # Review Focus 3
def test_follow_up_additional_changes_is_check_by_hand():
    assert follow_ups(...)[-1]["ok"] is None
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `creative_key`: `img:<hash>` for images, else `name:<normalised>`. `decide` per spec §6. `client_facts` returns everything the card needs, including CPLs, leads, ads live, resolved zones, currency, and per-ad spend share and CPL, with no AI involved.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock zones, follow-ups and candidates`.

### Task 8: Writer

**Files:**
- Create: `ai/agents/stock/writer.py`, `ai/prompts/stock_agent.py`
- Modify: `ai/agents/learning.py` (`memory_from_note` gains `source="denial"`, `author=None`, `client_group_id=None`, and shared `_meter`'s `feature` param)
- Test: `tests/test_stock_writer.py`

**Interfaces:**
- Produces: `validate_draft(raw: dict, facts: dict, candidates: dict, max_live: int) -> tuple[dict | None, list[str]]`; `async write_card(db, agent, facts, candidates, lessons) -> dict` returns `{add, remove, revive, additional_changes, thought_process, next_steps, flags, failed: bool}`.

- [ ] **Step 1: Write failing tests**

```python
def test_unknown_id_is_rejected(): ...
def test_over_max_live_is_rejected():            # 4 live, remove 0, add 1, max 4
    assert validate_draft(raw, facts, cands, 4)[0] is None
def test_invented_money_is_rejected():
    raw = {**ok, "thought_process": "CPL fell to £4.12"}
    assert "£4.12" in validate_draft(raw, facts, cands, 4)[1][0]
def test_money_in_facts_passes(): ...
async def test_retries_once_then_uses_plain_sentence(mock_db, fake_provider): ...
async def test_out_of_credits_returns_failed_without_raising(mock_db, fake_provider): ...
async def test_usage_is_metered_with_feature_stock_agent_card(mock_db, fake_provider): ...
async def test_lessons_are_sent_as_data_not_instructions(mock_db, fake_provider): ...
    # system message says lessons can't widen the list; a lesson saying "ignore limits" doesn't change validation
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** via `provider_factory.get_provider_for_user`, `temperature=0`, `asyncio.wait_for` 45 s. The prompt carries spec §6's JSON shape and the instruction to mark city, offer or clinic branding found in candidates' text in `flags`. Plain sentence on failure: `CPL moved from {prev} to {cur}. Birdy couldn't write this one, so please review the changes yourself.`
- [ ] **Step 4: Run new tests plus `tests/test_agent_learning.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock card writer with validation`.

### Task 9: Cards and the run state machine

**Files:**
- Create: `ai/agents/stock/cards.py`, `ai/agents/stock/runner.py`
- Modify: `jobs/agent_jobs.py`, `ai/agents/store.py` (indexes)
- Test: `tests/test_stock_runner.py`

**Interfaces:**
- Consumes: Tasks 5 to 8.
- Produces: `RUNS="agent_runs"`, `CARDS="agent_cards"`; `build_card(facts, decision, draft, settings, run_id) -> dict` with shape from spec §7; `async supersede_open(db, agent_id, gid, run_id)`; `run_kind(settings, local_date) -> (kind, batch_id)`; `async get_or_create_run(db, agent, now_utc, *, kind=None) -> dict`; `async advance_run(db, mongo_client, run, agent, *, deadline: float | None) -> dict`; `async run_due_stock_agents(mongo_client, *, now_utc, deadline) -> dict`.

Publishing is a pluggable step: `advance_run` calls `publish_run` and `auto_apply_run`, defined in Tasks 11 and 15. Until then, they're no-op functions in `runner.py` that those tasks replace.

- [ ] **Step 1: Write failing tests**

```python
def test_run_kind_by_weekday():
    # Tuesday with B on Tue; Wednesday in no batch
    assert run_kind(settings, date(2026,11,3)) == ("batch", "b")
    assert run_kind(settings, date(2026,11,4)) == ("alert_only", None)

async def test_runs_once_per_day(mock_db): ...                  # unique (agent_id, local_date)
async def test_resumes_after_deadline(mock_db, fakes): ...      # deadline expired after 1 client; next call finishes others, no double AI call
async def test_killed_run_retries_then_ends_with_whats_missing(mock_db, fakes): ...  # stale claim 3 attempts
async def test_one_client_failure_doesnt_stop_others(mock_db, fakes): ...
async def test_green_card_makes_no_ai_call(mock_db, fakes): ...
async def test_no_changes_on_red_states_reason_and_cpl(mock_db, fakes): ...
async def test_new_client_with_no_history_finishes_as_no_data(mock_db, fakes): ...   # Review Focus 2
async def test_new_card_supersedes_open_card_for_that_client(mock_db, fakes): ...
async def test_alert_only_day_makes_no_cards(mock_db, fakes): ...
async def test_tick_dispatches_custom_and_stock_separately(mock_db, fakes): ...
async def test_expired_token_records_reconnect_and_no_writes(mock_db, fakes): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `run_due_agents` queries `type != stock` and otherwise stays unchanged. `run_agents_tick` then calls `run_due_stock_agents` with the same deadline, reusing `_is_due` schedule checks, `_enqueue_refreshes` and grace logic. Past grace, the run sets `stale: true`. Line `mode` is resolved at build time through `resolve_mode`. Line state starts at `proposed`, or `flagged` for Flag lines. Status `superseded` is added to card statuses (a plan addition covering Review Focus 1).
- [ ] **Step 4: Run new tests plus `tests/test_agent_runner.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock run state machine`.

### Task 10: Stock API

**Files:**
- Modify: `routers/agent_stock.py`, `routers/agents.py` (`activate`, `delete_agent` dispatch by type)
- Test: `tests/test_stock_router.py`

**Interfaces:**
- Produces: `POST /preview`, `GET /runs?limit&before`, `GET /runs/latest`, `GET /runs/{id}`, `PATCH /cards/{id}`, `GET /outcomes`, `GET /lessons` under `/api/agents/{id}`. `GET /runs/{id}` returns `{run, cards, follow_ups, scoreboard, learned, proposals, weekly}`.

- [ ] **Step 1: Write failing tests**: all routes 404 on another user's agent and 400 on a custom agent; `POST /preview` returns 409 while history isn't ready, and otherwise creates a `preview` run; a preview makes no Meta write or Slack call; activate returns 409 with `missing` until there's at least one client, resolved zones and a finished preview; `PATCH /cards/{id}` keeps `original` and refuses a settled card.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** Preview starts through the same background pattern as `_run_dry_run_job` (`routers/agents.py:424`), and the tick finishes any unfinished preview. Preview cards carry `preview: true` and are never eligible for Apply. `PATCH /settings` on a live stock agent and its `activate` claim clients through `claim_clients`, with the same 409 shape as Task 2.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock agent API`.

---

## Part 3: Changes in Meta

### Task 11: Apply, undo and Auto for Remove and Bring back

**Files:**
- Create: `ai/agents/stock/apply.py`
- Modify: `ai/agents/stock/runner.py`, `routers/agent_stock.py`, `routers/cron.py`
- Test: `tests/test_stock_apply.py`

**Interfaces:**
- Produces: `async apply_card(db, mongo_client, user_id, card_id, *, by, source, line_ids=None) -> dict`; `async apply_run(db, mongo_client, user_id, run_id, *, by, source, budget_s=2.5) -> dict`; `async undo_line(db, mongo_client, user_id, card_id, line_id, *, by, source) -> dict`; `async dismiss_card(db, user_id, card_id, *, by, source, reason=None) -> dict`; `async auto_apply_run(db, mongo_client, run, agent)`; `async process_queued_lines(db, mongo_client, now_utc, *, deadline)`; routes `POST /cards/{id}/apply|dismiss|undo`, `POST /runs/{id}/apply-all`.

- [ ] **Step 1: Write failing tests**

```python
async def test_double_apply_writes_once(...): ...                # atomic proposed -> applying
async def test_refused_when_agent_off(...): ...                  # Review Focus 1: blocked + reason, no Meta call
async def test_refused_when_client_moved(...): ...               # not_acting_agent
async def test_refused_on_superseded_or_preview_card(...): ...
async def test_flag_line_never_writes(...): ...
async def test_guardrail_last_live_ad_blocks_with_reason(...): ...
async def test_pause_counts_toward_daily_cap(...): ...           # writes KIND_ACTION_APPLIED activity
async def test_undo_remove_and_window_expiry(...): ...
async def test_mixed_modes_only_ask_lines_wait(...): ...
@pytest.mark.parametrize("why", ["stale","open_alert","flagged_text","ai_failed","over_add_limit","needs_file"])
async def test_auto_falls_back_to_ask(why, ...): ...
async def test_apply_run_queues_past_budget_and_cron_finishes(...): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** Build a guardrail doc `{"action": {"type": ACTION_PAUSE_ADS|ACTION_ENABLE_ADS, "targets": [{"object_id", "object_type":"ad", "name"}]}, "client_group_id": gid}` for `check_guardrails` and `check_adset_contents_live`, then `execute_action`. Mirror state with the helper at `meta_state.py:171`. Log to `ACTIVITY`. Add a `queued` line state for `apply_run`; `process_queued_lines` runs from the existing per-minute cron that calls `run_post_jobs`. Undo window is `outcomes.UNDO_AUTO_WINDOW`. Replace the runner's `auto_apply_run` stub.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): apply and undo stock card lines`.

### Task 12: Add through the posting pipeline

**Files:**
- Create: `ai/agents/stock/add.py`
- Modify: `services/creatives/store.py` (`create_test`, `list_tests`), `services/creatives/posting.py`, `jobs/creative_tracking.py`, `services/creatives/alerts.py`, `ai/suggestions/creative_findings.py`, `ai/agents/stock/apply.py`, `routers/agent_stock.py`
- Test: `tests/test_stock_add.py`

**Interfaces:**
- Produces: `clean_ad_name(source_name, today) -> str`; `async destination_for(db, group) -> dict | None` (`adset_id, adset_name, page_id, lead_form_id, campaign_id`); `async plan_media(db, user_id, line, token) -> "ready"|"needs_file"`; `async enqueue_add(db, mongo_client, user_id, card, line) -> dict`; `async sync_add_lines(db, now_utc)`; `POST /cards/{id}/lines/{line}/file` taking `{blob_url}`. `create_test` gains `managed_by=None`, `ad_name=None`.

- [ ] **Step 1: Write failing tests**

```python
def test_clean_name_replaces_date_and_drops_copy():
    assert clean_ad_name("BS - Timelapse - 100926 - Win", date(2026,11,3)) == "BS - Timelapse - 110326 - Win"
    assert clean_ad_name("Plans Concept – Copy 2", date(2026,11,3)) == "Plans Concept - 110326"

async def test_managed_test_is_hidden_and_untracked(...): ...    # list_tests, tracking, alerts, findings skip it
async def test_ad_uses_supplied_name_not_ct_format(...): ...
async def test_video_tries_held_file_then_source_then_needs_file(...): ...
async def test_file_is_reused_for_later_adds(...): ...           # `agent_creative_files`, keyed (user_id, creative_key)
async def test_no_readable_destination_blocks_line(...): ...
async def test_failed_post_sets_explained_error_and_retry(...): ...
async def test_undo_add_pauses_new_ad(...): ...
async def test_writes_off_when_flag_disabled(...): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** Test doc: `origin="revive"`, `created_via="media_agent"`, `managed_by="media_agent"`. For videos, a Meta `source` URL is handed straight to `upload_video(file_url=...)` for that post, since it's short-lived, and only a user-uploaded Blob URL is stored in `agent_creative_files`. `sync_add_lines` runs with `process_queued_lines` and moves lines to `applied` or `failed` from `TEST_ADS.post_state`. Record the scoreboard row on `applied`.
- [ ] **Step 4: Run new tests plus `tests/test_creative*.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): add ads through the posting pipeline`.

---

## Part 4: Slack and learning

### Task 13: Lessons and scoreboard

**Files:**
- Create: `ai/agents/stock/lessons.py`
- Modify: `ai/agents/stock/scoreboard.py`, `ai/agents/stock/runner.py`, `ai/agents/learning.py`, `routers/agent_stock.py`, `routers/agents.py` (accept proposal)
- Test: `tests/test_stock_lessons.py`, `tests/test_stock_scoreboard.py`

**Interfaces:**
- Produces: `meaningful_edit(before: dict, after: dict) -> bool`; `async lesson_from_edit(db, agent, card, by)`; `async lesson_from_text(db, agent, text, *, source, author, client_group_id=None, source_ref=None) -> dict`; `async lessons_for_prompt(db, agent_id, gid) -> list[str]` (active, newest 50); `async keep_lesson`, `async overrule_lesson`; `score_result(ad_spend, ad_leads, baseline_cpl, lost_spend, settings) -> str`; `async score_due(db, agent, now_utc) -> list[dict]`; `async scan_patterns(db, agent)`; routes `POST /lessons/{id}/keep|overrule`.

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.parametrize("spend,leads,base,want", [
    (0,0,8,"never_went_live"), (40,5,8,"won"), (40,5,7.99,"no_clear_change"),
    (50,6,8,"no_clear_change"), (66,6,8,"lost"),  # 11 > 1.3*8=10.4
    (48,0,8,"lost"), (47,0,8,"no_clear_change"),  # lost spend limit 48 (6x green 8)
    (10,1,8,"no_clear_change"),                   # 1 lead, under both limits
])
def test_score_result(spend, leads, base, want): ...

def test_typo_edit_isnt_a_lesson(): ...
def test_changed_line_is_a_lesson(): ...
async def test_new_agency_has_no_lessons_or_rows(mock_db): ...
async def test_overruled_lesson_not_sent_to_ai(mock_db): ...
async def test_not_scored_before_min_days(mock_db, ...): ...
async def test_pattern_at_three_creates_one_proposal(mock_db): ...  # no duplicate at four
async def test_accept_stores_promoted_lesson(mock_db): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** A proposal doc uses `kind: "promote"`. `routers/agents.py` accept/reject branch on it and don't touch rules. The runner's catch-up phase calls `score_due` and `scan_patterns`. `apply.dismiss_card` with a reason calls `lesson_from_text(source="dismiss")`. `PATCH /cards/{id}` calls `lesson_from_edit`.
- [ ] **Step 4: Run new tests plus `tests/test_agent_learning.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock lessons and scoreboard`.

### Task 14: Editable Slack templates

**Files:**
- Create: `ai/agents/stock/templates.py`
- Modify: `services/report_template.py:136,231,748` (`AGENT_TOKENS`), `routers/agent_stock.py`
- Test: `tests/test_stock_templates.py`

**Interfaces:**
- Produces: `DEFAULT_TEMPLATES: dict[kind, dict]`; `validate_template(kind, raw) -> dict` raising `TemplateError`; `render_kind(kind, template, values: dict, rows: list | None, ctx) -> tuple[list, str]`; `card_buttons(card) -> dict | None`; `summary_buttons(run, frontend_url) -> dict`; `assemble(blocks, buttons) -> list`; `GET|PUT|DELETE /slack-templates/{kind}`, `POST /slack-templates/{kind}/preview`.

- [ ] **Step 1: Write failing tests**

```python
def test_defaults_validate_and_contain_playbook_sections(): ...
def test_unknown_placeholder_returns_error(): ...               # Review Focus 4
def test_empty_blocks_returns_error(): ...
def test_alert_block_is_refused_with_slack_reason(): ...
def test_buttons_always_present_after_fit():
    huge = {"blocks": [section("x"*2900)] * 60}
    blocks, _ = render_kind("card", huge, values, None, ctx)
    assert assemble(blocks, card_buttons(card))[-1]["type"] == "actions"
    assert len(assemble(blocks, card_buttons(card))) <= 50
def test_flag_line_card_has_no_apply_button(): ...
def test_settled_card_shows_undo_only_when_possible(): ...
def test_report_placeholders_still_work(): ...
def test_client_table_rows_come_from_run_not_caches(): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `AGENT_TOKENS` holds spec §8's placeholders, resolved from `ctx.event` the same way as `EVENT_TOKENS`, and accepted by `_check_token` only for agent templates (`validate_template` passes the allowed set). The client table is a `birdy_data: {"source": "agent_run"}` binding, replaced by `render_kind` with a normal `table` block before calling `rt.render`. `render_kind` calls `rt.fit_to_slack` with `MAX_BLOCKS - 1` so the actions block always fits.
- [ ] **Step 4: Run new tests plus `tests/test_slack_reports.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): editable Slack templates for the stock agent`.

### Task 15: Slack delivery and actions

**Files:**
- Create: `ai/agents/stock/slack.py`
- Modify: `ai/agents/stock/runner.py`, `routers/slack_interactions.py:272-295`, `routers/slack_events.py:68-100`, `ai/agents/stock/apply.py`
- Test: `tests/test_stock_slack.py`

**Interfaces:**
- Produces: `async publish_run(db, run, agent, cards)`; `async update_card_message(db, card)`; `async handle_card_action(payload, action, db, mongo_client) -> dict` for `agent_card_apply|edit|dismiss|undo`, `agent_run_apply_all`; `edit_view(card) -> dict`; `async handle_edit_submission(payload, db) -> dict` for callback `agent_card_edit`; `async handle_thread_mention(db, team_id, channel, thread_ts, text, author) -> bool`.

- [ ] **Step 1: Write failing tests** with a fake `AsyncWebClient`:

```python
async def test_summary_then_one_reply_per_card_with_thread_ts(...): ...
async def test_all_clean_alert_day_posts_one_line_no_report(...): ...
async def test_post_failure_keeps_report_and_retries_next_tick_once(...): ...   # no duplicate summary, using stored ts
async def test_slack_disconnected_records_error_ask_lines_still_apply(...): ...  # Review Focus 5
async def test_failed_template_render_uses_default_and_sets_notice(...): ...     # Review Focus 4
async def test_apply_button_updates_message_with_who_and_results(...): ...
async def test_action_from_another_team_is_ignored(...): ...
async def test_edit_form_saves_and_records_lesson(...): ...
async def test_thread_mention_becomes_lesson_not_chat(...): ...
async def test_mention_outside_card_thread_goes_to_chat(...): ...
async def test_also_tag_person_is_mentioned_in_summary(...): ...
```
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `settings.slack.channel_id` with `get_decrypted_bot_token_for_user`, using existing `mark_needs_reconnect` handling for token errors. Slack user mention `<@id>` resolved to a display name through `users.info` for `decided_by` (no new scope needed if `users:read` isn't granted: fall back to the `<@id>` string). `@Birdy` replies say what was recorded with a `lesson_undo` button that calls `overrule_lesson`. Replace the runner's `publish_run` stub.
- [ ] **Step 4: Run new tests plus `tests/test_slack_interactions.py tests/test_slack_events.py`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock agent Slack delivery and actions`.

### Task 16: Weekly report

**Files:**
- Create: `ai/agents/stock/weekly.py`
- Modify: `ai/agents/stock/runner.py`, `routers/agent_stock.py`
- Test: `tests/test_stock_weekly.py`

**Interfaces:**
- Produces: `last_full_week(now_utc, tz) -> (start, end, prev_start, prev_end)`; `async build_weekly(db, agent, now_utc) -> dict`; `async post_weekly(db, run, agent, *, by)`; `POST /runs/{id}/weekly/post`.

- [ ] **Step 1: Write failing tests**: red only under "Decreased / still in red", even if improved; a green account with fewer leads stays under "Improved / maintained"; a yellow that slipped from green stays under improved; `on_hold` clients excluded; Status Check reads last week's client set; no card notes, follow-ups or Meta errors in any rendered string; posted once on a double press; `auto_post` posts at run end; on Monday 07:00 the week ended yesterday.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `{{wins}}` lists up to 3 clients by CPL improvement from code, with the playbook's 🥇💪🚀 order, each with a code-written line. Weekly runs on `settings.weekly.weekday` even on an alert-only day; `kind` stays as is and `run.weekly` holds the result.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(agents): stock weekly report`.

---

## Part 5: Frontend

Every task uses components from `src/components/ds` and matches `docs/superpowers/mocks/stock-agent/mock.html`, option A.

### Task 17: API hooks and hub

**Files:**
- Create: `src/lib/stock-agent-api.js`
- Modify: `src/lib/query-keys.js`, `src/lib/agents-api.js` (`useAgentWorkCount`), `src/app/hub/page.jsx`
- Test: `src/app/hub/__tests__/hub.test.jsx`, `src/lib/__tests__/stock-agent-api.test.js`

**Interfaces:**
- Produces: `useStockAgent()`, `useLatestRun(id)`, `useRun(id, runId)`, `useOutcomes(id)`, `useLessons(id)`, `useSlackTemplate(id, kind)`, `createStockAgent()`, `patchSettings(id, patch)`, `startPreview(id)`, `applyCard`, `dismissCard`, `undoCardLine`, `editCard`, `applyRun`, `attachLineFile`, `keepLesson`, `overruleLesson`, `postWeekly`, `saveSlackTemplate`, `resetSlackTemplate`, `previewSlackTemplate`.

- [ ] **Step 1: Write failing tests**: hub shows Set up agent with no stock agent; Continue setup and Start over for a draft; Open agent when live; custom agents list each row linking to `/hub/agents/custom/<id>`; Create custom agent links to `/hub/agents/custom/new`; a list error shows ErrorState and doesn't read as empty; nav badge adds open stock cards.
- [ ] **Step 2: Run `npx vitest run src/app/hub/__tests__/hub.test.jsx`, verify failure.**
- [ ] **Step 3: Implement** per mock screen 1, removing `ComingSoonCard`.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(hub): stock agent card and custom agents list`.

### Task 18: Guided setup

**Files:**
- Create: `src/app/hub/agents/media-buying/setup/page.jsx`, `src/components/agents/stock/SetupSchedule.jsx`, `SetupClients.jsx`, `SetupCreative.jsx`, `SetupSlack.jsx`, `ModesTable.jsx`, `SetupPreview.jsx`
- Test: `src/app/hub/agents/media-buying/setup/__tests__/page.test.jsx`

**Interfaces:**
- Consumes: Task 17. Reuses `WizardSteps`, `HistoryProgress`, `StartOverButton`.
- Produces: `ModesTable({settings, clients, onChange})`, also used by Task 20.

- [ ] **Step 1: Write failing tests**: `?step=` routes between the 6 steps and survives reload; a client in a different currency shows an inline override request on its row and blocks Continue; red below green blocks Continue; a claimed client shows Move it here / Only flag; a client with no Meta account is shown disabled with a reason; Slack not connected shows a Notice and allows Continue; channel picker shows the "anyone in this channel can approve" note; Add shows Flag only with `add_writes_enabled: false`; Preview shows history progress, then the report; Turn on is disabled until the preview finished; a server `409 missing` is listed.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** per mock screen 2 A, saving each step through `patchSettings`. Settings GET includes `add_writes_enabled`.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(hub): stock agent guided setup`.

### Task 19: Morning report

**Files:**
- Create: `src/app/hub/agents/media-buying/page.jsx`, `src/components/agents/stock/MorningReport.jsx`, `AlertsFrame.jsx`, `CplBars.jsx`, `FollowUps.jsx`, `Scoreboard.jsx`, `LearnedFrame.jsx`, `CardRow.jsx`, `WeeklyMessage.jsx`
- Test: `src/components/agents/stock/__tests__/MorningReport.test.jsx`, `CardRow.test.jsx`

- [ ] **Step 1: Write failing tests**: sections render in the spec order; a run still in progress shows progress and polls; a client that failed shows "couldn't be checked" with the reason; No data shows when CPL is null; each currency renders with its own symbol; `CardRow` per state: open shows Edit, Dismiss, Apply; `needs_file` shows Upload video; `failed` shows the error and Retry; `blocked` shows the reason; applied shows Undo while possible; Flag shows no Apply; superseded shows "Replaced by a newer card" and no actions; Apply all counts only open Ask me lines; a Slack error shows a Notice; date picker loads past runs; clean alert-only day shows the one-line result; the mascot renders only through its framed component.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** per mock screen 3 A. Cards start collapsed. Bars use the zone colours from ds tokens. Upload reuses the Creatives upload grant flow. Page tabs: Report, Scoreboard, Lessons, Settings; if no active or draft stock agent exists, redirect to setup.
- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `feat(hub): stock agent morning report`.

### Task 20: Settings, lessons and template editor

**Files:**
- Create: `src/components/agents/stock/AgentSettings.jsx`, `LessonsList.jsx`, `SlackTemplates.jsx`
- Modify: `src/components/report-designer/ReportEditor.jsx`, `src/lib/report-editor.js`
- Test: `src/components/agents/stock/__tests__/AgentSettings.test.jsx`, `src/components/report-designer/__tests__/ReportEditor.test.jsx`

**Interfaces:**
- Produces: `ReportEditor` gains optional `previewFn`, `placeholders`, `extraMetricsDisabled` props. Defaults leave the Slack Reports behaviour unchanged.

- [ ] **Step 1: Write failing tests**: mode change saves; a client override is added and removed; the empty lessons state uses the mock's copy; overrule removes a lesson from the active list; each template opens the editor with the agent's placeholders offered and `previewFn` called; server validation errors appear and Save stays disabled; Reset restores the default after confirmation; a template failure notice is shown; turning the agent off asks for confirmation; existing `ReportEditor` tests pass unchanged.
- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** per mock screen 5, plus the schedule, client table and creative rule forms reused from Task 18.
- [ ] **Step 4: Run `npx vitest run src/components/agents src/components/report-designer src/components/reports`, verify PASS.**
- [ ] **Step 5: Commit** — `feat(hub): stock agent settings and Slack templates`.

### Task 21: Whole-product verification

**Files:**
- Modify: `src/lib/changelog.js`
- Create: scratchpad crawl script (not committed), `docs/superpowers/specs/2026-11-03-stock-media-agent-launch.md`

- [ ] **Step 1: Run both full suites.** `../birdy-backend/.venv/bin/pytest -q` and `npx vitest run`, expected 0 new failures compared with `main`.
- [ ] **Step 2: Build and run locally** per `birdy-local-verify-setup`: `NEXT_PUBLIC_API_URL=http://localhost:8000 npx next build`, backend on 8000, frontend on 3005. Seed one throwaway agency: 4 clients, one in USD, one on Ask me, Add flag off, with a seeded run covering every card state.
- [ ] **Step 3: Crawl and screenshot at 1360 and 390 px:** hub (3 states), new custom agent, custom agent page, all setup steps, report, scoreboard, lessons, settings, template editor. Open every screenshot, compare with the mock, and record `scrollWidth - innerWidth === 0` per page.
- [ ] **Step 4: Fix anything found, re-run affected tests, and clean up** the throwaway user (users, client_groups, agents, agent_runs, agent_cards, agent_memory, agent_ad_outcomes, agent_client_claims, ai_usage).
- [ ] **Step 5: Write the launch doc** with spec §15's four checks and exact steps for each. Add a changelog entry.
- [ ] **Step 6: Commit** — `docs(agents): stock agent launch checks and changelog`.
- [ ] **Step 7: Don't push.** Report results and ask the user before pushing or opening PRs. Production migration runs on deploy through `create_agent_indexes`, so the order is backend first, then frontend.

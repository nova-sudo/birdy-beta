# Creatives Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a media buyer post one creative to many Meta ad accounts through Birdy, track it per account against targets, get a winner/loser verdict, and act on it from the Creatives tab, suggestions, alerts, Slack or Birdy chat.

**Architecture:** Backend owns the model (`creative_tests`, `creative_test_ads`, `creative_ad_days`), the verdict engine, the Meta write pipeline (queued jobs run by a minute cron) and the tracking job. Frontend adds a Creatives tab to the Marketing Hub, a full-page wizard, a detail sheet, and chat blocks, all on the `src/components/ds/` kit. Suggestions, alerts and chat reuse their existing engines with new rule kinds, a new alert scope and new tools.

**Tech Stack:** FastAPI + Motor/Mongo (raw dicts), httpx → Graph API v25.0, pytest + mongomock-motor + `httpx.MockTransport`; Next.js 16 / React 19, SWR, TanStack Table via ds `DataTable`, Vitest + Testing Library, `@vercel/blob` client uploads.

**Spec:** `docs/superpowers/specs/2026-11-03-creatives-tracking-design.md` (mock: `docs/superpowers/mocks/creatives/mock.html` — Tab A, Wizard 2, detail sheet, integrations section).

**Workspaces (already created from origin/main):**
- Frontend: `~/Desktop/Birdy/birdy-beta-creatives`, branch `feat/creatives-tracking`
- Backend: `~/Desktop/Birdy/birdy-backend-creatives`, branch `feat/creatives-tracking`

Paths below are relative to the repo named in each task (**[BE]** backend, **[FE]** frontend).

## Global Constraints

- Graph base URL `https://graph.facebook.com/v25.0`; token via `integrations.facebook_utils.facebook.get_facebook_token(user_id, mongo_client)`.
- No new OAuth scope; `ads_management` is already granted.
- Test code format `CT-` + 4-digit zero-padded sequence per `user_id` (`CT-0001`), never reused.
- Meta ad name = `f"{code} | {slug}"`; slug lowercase, `[a-z0-9-]` only, dashes collapsed, max 40 chars; users may edit the slug, never the code or the ` | ` separator.
- Defaults: `min_spend=150`, `min_days=7`, `win_share=0.6`, verdict needs ≥ 2 scored accounts, `baseline_pct=15`.
- Hook rate = `actions[video_view]` ÷ impressions; skipped for image tests.
- Every ad is created `PAUSED`; go-live is a separate pass.
- Nothing writes to Meta without a wizard **Post** click or a chat tool call with `confirmed=true`.
- Media limits: images ≤ 30 MB (`image/jpeg`, `image/png`); videos ≤ 1 GB (`video/mp4`, `video/quicktime`).
- Tracking batches ≤ 50 ad ids per insights call; back off on Meta error codes 4, 17, 613.
- Blobs are deleted 30 days after the test is archived.
- Archive never deletes Meta ads.
- Frontend uses `@/components/ds` only (no new `portfolio/` or `--pd-*` usage); mascot only via `BirdyAvatar`/`BirdyRead`.
- Every collection doc carries string `id` (uuid4 hex) and `user_id`; every query is owner-scoped.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mixed currencies across accounts** — a GBP account and a USD account in one test: per-account figures stay in the account's currency; test totals are converted to the user's currency (`CurrencyService.get_user_currency`), never naively summed. Test in Task 3.
2. **Ad removed or deleted in Meta mid-test** — insights stop and status read returns error 100: the test ad becomes `post_state="removed"`, is excluded from scoring and shown as "Removed in Meta", never counted as a fail. Test in Task 6.
3. **Zero leads above the scoring floor** — CPL is `None`, the account **fails** a CPL threshold (and `baseline`/`cpl_only` modes), no division error, UI shows "— · 0 leads". Test in Task 3.
4. **One ad account shared by several client groups** — the account appears once in the picker labelled with every client name; the per-account CPL override comes from the group whose `meta_campaign_ids` own the chosen ad set's campaign (fallback: first group). Tests in Tasks 4 and 13.
5. **Double Post click or overlapping cron ticks** — no duplicate Meta objects: job claim with a lease plus "skip a step whose id is stored". Test in Task 15.

---

## Phase 0 — Workspace

### Task 0: Install and baseline

**Files:** none changed.

- [ ] **Step 1:** [FE] `npm ci` (worktree has no `node_modules`). Expected: exits 0.
- [ ] **Step 2:** [FE] `npx vitest run` — record the baseline pass/fail count in the task report.
- [ ] **Step 3:** [BE] `../birdy-backend/.venv/bin/python -m pytest -q` — record baseline. All backend test commands below use this interpreter, written as `PYTEST` (`../birdy-backend/.venv/bin/python -m pytest`).

---

## Phase 1 — Track

### Task 1: Naming convention [BE]

**Files:**
- Create: `services/creatives/__init__.py` (empty), `services/creatives/naming.py`
- Test: `tests/test_creative_naming.py`

**Interfaces — Produces:**
- `CODE_RE: re.Pattern` matching `^CT-\d{4,}` at the start of an ad name
- `format_code(seq: int) -> str`
- `slugify(name: str) -> str`
- `meta_ad_name(code: str, slug: str) -> str`
- `parse_code(ad_name: str | None) -> str | None`

- [ ] **Step 1: Write the failing tests**

```python
from services.creatives.naming import format_code, slugify, meta_ad_name, parse_code

def test_format_code_pads_to_four():
    assert format_code(7) == "CT-0007"
    assert format_code(12345) == "CT-12345"

def test_slugify_rules():
    assert slugify("Mortgage myth #3 — UGC hook") == "mortgage-myth-3-ugc-hook"
    assert slugify("  Ünïcode   & spaces  ") == "unicode-spaces"
    assert len(slugify("x" * 80)) == 40
    assert not slugify("a" * 39 + " b").endswith("-")

def test_meta_ad_name_and_parse_roundtrip():
    name = meta_ad_name("CT-0048", "mortgage-myth-ugc")
    assert name == "CT-0048 | mortgage-myth-ugc"
    assert parse_code(name) == "CT-0048"
    assert parse_code("ct-0048 | x") is None
    assert parse_code("Old ad CT-0048") is None
    assert parse_code(None) is None
```

- [ ] **Step 2:** `PYTEST tests/test_creative_naming.py -q` → FAIL (module missing).
- [ ] **Step 3:** Implement in `services/creatives/naming.py`. Slugify: NFKD-normalise and drop non-ASCII, lowercase, non-`[a-z0-9]` runs → `-`, strip dashes, truncate to 40, strip a trailing dash again.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5:** Commit `feat(creatives): naming convention helpers`.

### Task 2: Store, counter, indexes [BE]

**Files:**
- Create: `services/creatives/store.py`
- Modify: `core/indexes.py` (import + append `create_creative_indexes` in `_load_creators`)
- Test: `tests/test_creative_store.py`

**Interfaces:**
- Consumes: `format_code`, `slugify`, `meta_ad_name` (Task 1)
- Produces:
  - Constants `TESTS="creative_tests"`, `TEST_ADS="creative_test_ads"`, `AD_DAYS="creative_ad_days"`, `COUNTERS="creative_test_counters"`, `POST_JOBS="creative_post_jobs"`
  - Status constants `DRAFT, POSTING, TESTING, WINNER, LOSER, INCONCLUSIVE, ARCHIVED` (string values = lowercase names); `FINAL_VERDICTS = (WINNER, LOSER, INCONCLUSIVE)`
  - `async next_code(db, user_id: str) -> str`
  - `async create_test(db, user_id: str, *, name: str, origin: str, creative: dict, targets: dict, source: dict | None = None, slug: str | None = None, created_via: str = "wizard", on_verdict: dict | None = None) -> dict` — status `draft`, fills `code`, `slug`, `meta_ad_name`, defaults from `DEFAULT_TARGETS`
  - `DEFAULT_TARGETS = {"mode": "thresholds", "metrics": {}, "baseline_pct": 15, "min_spend": 150, "min_days": 7, "win_share": 0.6}`
  - `async get_test(db, user_id, test_id) -> dict | None`
  - `async list_tests(db, user_id, *, status: str | None = None, ad_account_ids: list[str] | None = None) -> list[dict]` (newest first; archived excluded unless `status=="archived"`)
  - `async update_test(db, user_id, test_id, fields: dict) -> dict | None` (sets `updated_at`; refuses `code`, `user_id`, `id`)
  - `async add_test_ads(db, user_id, test_id, rows: list[dict]) -> list[dict]` — each row needs `ad_account_id`, `client_group_id`; optional `adset_id`, `adset_name`, `page_id`, `lead_form_id`, `meta.ad_id`; default `post_state="pending"`, `score={"state":"scoring"}`
  - `async list_test_ads(db, test_id) -> list[dict]`
  - `async create_creative_indexes(mongo_client) -> None` — `(user_id, code)` unique; `(user_id, status)`; `TEST_ADS(test_id)`; `TEST_ADS(user_id, ad_account_id)`; `TEST_ADS(meta.ad_id)` unique sparse; `AD_DAYS(user_id, ad_id, date)` unique; `POST_JOBS(state, lease_until)`

- [ ] **Step 1: Write the failing tests** (`mock_db` fixture from `tests/conftest.py`)

```python
async def test_next_code_is_sequential_per_user(mock_db):
    assert await next_code(mock_db, "u1") == "CT-0001"
    assert await next_code(mock_db, "u1") == "CT-0002"
    assert await next_code(mock_db, "u2") == "CT-0001"

async def test_create_test_fills_name_and_defaults(mock_db):
    t = await create_test(mock_db, "u1", name="Mortgage myth #3", origin="new",
                          creative={"format": "video"}, targets={"mode": "cpl_only", "metrics": {"cpl": {"op": "lte", "value": 35}}})
    assert t["status"] == "draft" and t["code"] == "CT-0001"
    assert t["meta_ad_name"] == "CT-0001 | mortgage-myth-3"
    assert t["targets"]["min_spend"] == 150 and t["targets"]["win_share"] == 0.6
    assert "_id" not in t or t["_id"] == t["id"]

async def test_owner_scoping_and_update_guards(mock_db):
    t = await create_test(mock_db, "u1", name="x", origin="new", creative={}, targets={})
    assert await get_test(mock_db, "u2", t["id"]) is None
    out = await update_test(mock_db, "u1", t["id"], {"name": "y", "code": "CT-9999"})
    assert out["name"] == "y" and out["code"] == "CT-0001"

async def test_list_excludes_archived_by_default(mock_db): ...
    # create two, archive one via update_test(status="archived"); list_tests → 1; list_tests(status="archived") → 1

async def test_add_test_ads_defaults(mock_db): ...
    # add one row; post_state == "pending", score == {"state": "scoring"}, test_id set, user_id set
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Counter: `find_one_and_update({"_id": user_id}, {"$inc": {"seq": 1}}, upsert=True, return_document=AFTER)`. Return docs without Mongo `_id` unless it equals `id`.
- [ ] **Step 4:** Run → PASS. Also `PYTEST tests/test_mcp_registration.py -q` stays green (indexes import path).
- [ ] **Step 5:** Commit `feat(creatives): test store, code counter, indexes`.

### Task 3: Verdict engine [BE]

**Files:**
- Create: `services/creatives/verdict.py`
- Test: `tests/test_creative_verdict.py`

**Interfaces — Produces:**
- `aggregate_days(days: list[dict]) -> dict` → `{spend, impressions, clicks, link_clicks, leads, video_views_3s, days_live}`; `leads` = sum of `actions` with `action_type` in `("lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead")` taking the max-per-day of those types (Meta double-reports); `days_live` = distinct dates with spend > 0
- `derive(totals: dict) -> dict` → adds `cpl` (None when leads == 0), `ctr` (link_clicks/impressions·100, None when impressions == 0), `cpc`, `hook_rate` (video_views_3s/impressions·100)
- `score_account(totals: dict, targets: dict, *, fmt: str, baseline: dict | None = None) -> dict` → `{state: "scoring"|"pass"|"fail", checks: [{metric, op, target, value, ok}], ...derive(totals)}`
- `test_verdict(scores: list[dict], win_share: float) -> str` → one of `testing|winner|loser|inconclusive`
- `async rollup(db, user_id: str, ads: list[dict]) -> dict` → test `summary` (spec §5 fields, converted to the user's currency; `currency` key; `mixed_currency: bool`)

Rules (spec §4): below `min_spend` **and** below `min_days` → `scoring`. `thresholds`: every enabled metric must pass; `hook_rate` ignored when `fmt=="image"`; a `None` value fails its check. `baseline`: pass when `cpl ≤ baseline_cpl·(1 − baseline_pct/100)`, and if `targets.metrics` has `ctr` enabled also `ctr ≥ baseline_ctr·(1 + baseline_pct/100)`; no baseline → `scoring`. `cpl_only`: `cpl ≤ metrics.cpl.value`. Per-account override: `targets` passed in is already resolved (Task 4). Ads with `post_state in ("removed", "failed", "pending")` are excluded by the caller.

- [ ] **Step 1: Write the failing tests**

```python
T = {"mode": "thresholds", "min_spend": 150, "min_days": 7, "win_share": 0.6,
     "metrics": {"cpl": {"op": "lte", "value": 35}, "ctr": {"op": "gte", "value": 1.5},
                 "hook_rate": {"op": "gte", "value": 30}}}

def tot(**kw):
    base = dict(spend=0, impressions=0, clicks=0, link_clicks=0, leads=0, video_views_3s=0, days_live=0)
    return {**base, **kw}

def test_below_floor_is_scoring():
    assert score_account(tot(spend=149, days_live=6, leads=10, impressions=1000), T, fmt="video")["state"] == "scoring"

def test_floor_is_spend_or_days():
    assert score_account(tot(spend=20, days_live=7, leads=1, impressions=100, link_clicks=2, video_views_3s=40), T, fmt="video")["state"] != "scoring"

def test_thresholds_pass_and_fail():
    ok = tot(spend=212, days_live=5, leads=11, impressions=10000, link_clicks=230, video_views_3s=4100)
    assert score_account(ok, T, fmt="video")["state"] == "pass"
    bad = {**ok, "leads": 3}
    s = score_account(bad, T, fmt="video")
    assert s["state"] == "fail" and [c["metric"] for c in s["checks"] if not c["ok"]] == ["cpl"]

def test_zero_leads_above_floor_fails_not_crashes():            # Review Focus 3
    s = score_account(tot(spend=300, days_live=8, impressions=5000, link_clicks=90, video_views_3s=2000), T, fmt="video")
    assert s["cpl"] is None and s["state"] == "fail"
    assert score_account(tot(spend=300, days_live=8), {**T, "mode": "cpl_only"}, fmt="image")["state"] == "fail"

def test_hook_rate_ignored_for_images():
    ok = tot(spend=200, days_live=7, leads=10, impressions=10000, link_clicks=200)
    assert score_account(ok, T, fmt="image")["state"] == "pass"

def test_baseline_mode():
    b = {**T, "mode": "baseline", "baseline_pct": 15, "metrics": {}}
    acct = {"cpl": 40.0, "ctr": 1.0}
    assert score_account(tot(spend=200, days_live=7, leads=6, impressions=1000), b, fmt="image", baseline=acct)["state"] == "pass"   # cpl 33.3 ≤ 34
    assert score_account(tot(spend=200, days_live=7, leads=5, impressions=1000), b, fmt="image", baseline=acct)["state"] == "fail"   # cpl 40
    assert score_account(tot(spend=200, days_live=7, leads=5), b, fmt="image", baseline=None)["state"] == "scoring"

def test_verdict_shares():
    s = lambda *st: [{"state": x} for x in st]
    assert test_verdict(s("pass", "scoring"), 0.6) == "testing"          # < 2 scored
    assert test_verdict(s("pass", "pass", "fail", "scoring"), 0.6) == "winner"
    assert test_verdict(s("fail", "fail", "pass"), 0.6) == "loser"
    assert test_verdict(s("pass", "fail"), 0.6) == "inconclusive"         # all scored, 50/50
    assert test_verdict(s("pass", "fail", "scoring"), 0.6) == "testing"

def test_leads_not_double_counted():
    days = [{"date": "2026-10-01", "spend": 10, "impressions": 100, "actions": [
        {"action_type": "lead", "value": "3"}, {"action_type": "onsite_conversion.lead_grouped", "value": "3"}]}]
    assert aggregate_days(days)["leads"] == 3

async def test_rollup_converts_mixed_currency(mock_db, monkeypatch):     # Review Focus 1
    # user currency GBP; ad A spend 100 GBP, ad B spend 100 USD at rate 0.75
    # monkeypatch CurrencyService.get_user_currency -> "GBP", get_rate("USD","GBP") -> 0.75
    # summary["spend"] == 175.0, summary["currency"] == "GBP", summary["mixed_currency"] is True
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Each ad row passed to `rollup` carries `score` (Task 6 writes it) and `currency` (account currency from the client group's `ad_account_currency`, default user currency). If a rate lookup raises, keep that ad's money out of the total and set `rate_missing: True`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(creatives): verdict engine`.

### Task 4: Target defaults and per-account resolution [BE]

**Files:**
- Create: `services/creatives/targets.py`
- Test: `tests/test_creative_targets.py`

**Interfaces:**
- Consumes: `services.client_targets` (existing `client_groups.targets`, `users.default_targets`)
- Produces:
  - `async prefill_targets(db, user_id: str, client_group_ids: list[str]) -> dict` → `{"metrics": {"cpl": {"op": "lte", "value": v, "source": "client"|"agency"|None}, ...}, "per_account": {client_group_id: {"cpl": v}}}`; test-wide CPL = most common client CPL among the groups, else agency default, else None
  - `owning_group(groups: list[dict], campaign_id: str | None) -> dict` — group whose `meta_campaign_ids` contains `campaign_id`; else the first group with `meta_campaign_ids` None; else `groups[0]`
  - `resolve_account_targets(test_targets: dict, ad: dict, group_cpl: float | None) -> dict` — precedence: `ad.targets_override` > `group_cpl` (for `cpl` only) > test targets

- [ ] **Step 1: Write the failing tests**

```python
async def test_prefill_uses_client_then_agency(mock_db): ...
    # groups g1 cpl 35, g2 cpl 35, g3 cpl 42; user default cpl 30
    # metrics.cpl.value == 35, source "client"; per_account == {"g3": {"cpl": 42}, "g1": {"cpl": 35}, "g2": {"cpl": 35}}
    # with no group targets → value 30, source "agency"

def test_owning_group_for_shared_account():                              # Review Focus 4
    gs = [{"id": "a", "meta_campaign_ids": ["c1"]}, {"id": "b", "meta_campaign_ids": ["c2"]}]
    assert owning_group(gs, "c2")["id"] == "b"
    assert owning_group(gs, "zzz")["id"] == "a"

def test_resolve_precedence():
    t = {"mode": "thresholds", "metrics": {"cpl": {"op": "lte", "value": 35}}}
    assert resolve_account_targets(t, {}, 42)["metrics"]["cpl"]["value"] == 42
    assert resolve_account_targets(t, {"targets_override": {"cpl": 50}}, 42)["metrics"]["cpl"]["value"] == 50
    assert resolve_account_targets(t, {}, None)["metrics"]["cpl"]["value"] == 35
```

- [ ] **Step 2–4:** Run → FAIL, implement, run → PASS.
- [ ] **Step 5:** Commit `feat(creatives): target prefill and per-account resolution`.

### Task 5: Meta tracking reads [BE]

**Files:**
- Create: `integrations/facebook_utils/meta_creative_reader.py`
- Test: `tests/test_meta_creative_reader.py` (copy the `patch_client` fixture pattern from `tests/test_meta_ad_daily.py`, patching `integrations.facebook_utils.meta_creative_reader.httpx.AsyncClient`)

**Interfaces — Produces:**
- `TRACK_FIELDS = "ad_id,spend,impressions,clicks,inline_link_clicks,actions,date_start"`
- `BATCH = 50`
- `class MetaReadError(Exception)` with `.code: int | None`, `.retryable: bool` (`code in (4, 17, 613)`)
- `async fetch_tracked_ad_days(ad_account_id: str, token: str, ad_ids: list[str], since: date, until: date) -> list[dict]` — `level=ad`, `time_increment=1`, `filtering=[{"field":"ad.id","operator":"IN","value":[…]}]`, one request per ≤ 50 ids, follows `paging.next`
- `async fetch_account_daily(ad_account_id, token, since, until) -> list[dict]` — account-level totals per day (`spend,impressions,inline_link_clicks,actions,date_start`) for baselines
- `async fetch_ad_status(ad_id: str, token: str) -> str | None` — `effective_status`; returns `None` on Graph error code 100

- [ ] **Step 1: Write the failing tests**
  - `test_batches_ad_ids_by_50`: 120 ids → 3 requests; the `filtering` value lengths are `[50, 50, 20]`; `fields` == `TRACK_FIELDS`.
  - `test_follows_paging`: two pages → rows concatenated.
  - `test_rate_limit_error_is_retryable`: response 400 with `{"error": {"code": 17}}` → raises `MetaReadError` with `retryable is True`.
  - `test_status_none_when_deleted`: 400 `{"error": {"code": 100}}` → `fetch_ad_status` returns `None`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): Meta insights reads for tracked ads`.

### Task 6: Tracking job and cron [BE]

**Files:**
- Create: `jobs/creative_tracking.py`
- Modify: `routers/cron.py` (new `GET /api/cron/creatives-tick`, same shape as `agents_tick`), `vercel.json` (`{"path": "/api/cron/creatives-tick", "schedule": "* * * * *"}`)
- Test: `tests/test_creative_tracking.py`

**Interfaces:**
- Consumes: Tasks 2–5
- Produces:
  - `async track_test(db, mongo_client, test: dict, *, today: date) -> dict` — fetch + upsert `AD_DAYS` (`$set` on `(user_id, ad_id, date)`), score every live ad, write `score` on each `TEST_ADS` doc, write `summary`, `status` (`testing` → verdict), `verdict`, and `verdict_at` the first time a final verdict is reached; returns `{"test_id", "verdict", "changed": [events]}` where events are dicts `{"kind": "verdict"|"account_fail"|"account_pass", "ad_account_id"?}` (consumed by Task 21)
  - `async track_due_tests(db, mongo_client, now_utc: datetime) -> dict` — tests in `testing` or a final verdict (not archived) whose `tracked_at` is before the user's nightly slot (`services.daily_refresh_slot.last_slot_utc` with the user's timezone); sets `tracked_at`
  - `async run_creatives_tick(now_utc: datetime | None = None) -> dict` — in this task calls `track_due_tests`, and once per UTC day (stamp in `creative_test_counters` doc `_id="__daily__"`) `reconcile_all` (Task 7). Task 15 prepends `run_post_jobs`; Task 16 adds the daily `cleanup_archived_media`.

Rules: window = `started_at.date()` → `today - 1 day`. Ads whose `fetch_ad_status` is `None` → `post_state="removed"`, `score.state="removed"`, excluded. Baseline (mode `baseline` only): account daily totals minus the test ad's own days, same window, `derive()`d.

- [ ] **Step 1: Write the failing tests** (patch the reader functions with `monkeypatch.setattr("jobs.creative_tracking.fetch_tracked_ad_days", fake)` etc.)
  - `test_track_scores_and_sets_verdict`: test with 3 active ads, fake days giving pass/pass/fail above floor → test `verdict == "winner"`, `status == "winner"`, `verdict_at` set, each ad's `score.state` stored, `summary.accounts_pass == 2`.
  - `test_upsert_is_idempotent`: run twice → `AD_DAYS` count unchanged.
  - `test_removed_ad_is_excluded` (Review Focus 2): one ad's status → `None`; its `post_state == "removed"`; verdict computed from the other two.
  - `test_verdict_at_not_overwritten`: second run with same verdict keeps the first `verdict_at`.
  - `test_events_on_change`: account flips pass→fail between runs → `changed` contains `{"kind": "account_fail", "ad_account_id": …}`.
  - `test_due_selection_respects_slot`: `tracked_at` after slot → not tracked; before → tracked; archived → never.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): nightly tracking job and creatives-tick cron`.

### Task 7: Adopt hand-posted `CT-` ads [BE]

**Files:**
- Create: `services/creatives/reconcile.py`
- Test: `tests/test_creative_reconcile.py`

**Interfaces:**
- Consumes: `parse_code` (Task 1), store (Task 2); cached ads at `client_groups.facebook_cache.entities.ads[]` (`{id, name, campaign_id, adset_id, status}`)
- Produces:
  - `async find_adoptable(db, user_id: str) -> list[dict]` → `[{test_id, code, ad_id, ad_name, ad_account_id, client_group_id, adset_id}]` for cached ads whose `parse_code` matches a non-archived test of this user and whose id is not in `TEST_ADS`
  - `async adopt(db, user_id: str, test_id: str, ad_id: str) -> dict` — inserts a `TEST_ADS` row with `post_state="active"`, `origin="adopted"`; raises `ValueError` if the ad's code is not the test's code
  - `async reconcile_all(db) -> dict` — for every user with live tests, returns counts; emits nothing itself (Task 21 turns results into suggestions)

- [ ] **Step 1: Write the failing tests:** adoptable found across two groups; already-tracked ad excluded; ad whose code belongs to another user's test excluded; `adopt` with mismatched code raises.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): find and adopt hand-posted CT ads`.

### Task 8: Creatives router (Phase 1 endpoints) [BE]

**Files:**
- Create: `routers/creatives.py` (`router = APIRouter(prefix="/api/creatives", tags=["creatives"])`, route style of `routers/agents.py`: `async with get_mongo_client() as mongo_client: db = mongo_client[DB_NAME]`)
- Modify: `main.py` (import + `app.include_router(creatives.router)`)
- Test: `tests/test_creatives_router.py` (fixture copied from `tests/test_agents_router.py::api`, patching `routers.creatives.get_mongo_client`)

**Interfaces — Produces (JSON, `_id` stripped, ISO dates):**

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/creatives` | `?status=&client_group_id=` | `{"items": [test + "ads": [test ad]]}`; `client_group_id` filters to tests with ≥ 1 ad in that group's account |
| `GET /api/creatives/{id}` | — | test + `ads` + `days` (per ad, from `AD_DAYS`, for the chart) |
| `POST /api/creatives` | `{name, origin, creative, targets?, source?, slug?, on_verdict?}` | created draft |
| `PATCH /api/creatives/{id}` | any of `name, slug, creative, targets, on_verdict` | updated; `slug` change recomputes `meta_ad_name` only while `status == "draft"` (409 otherwise) |
| `POST /api/creatives/{id}/archive` | — | test with `status="archived"`, `archived_at` |
| `POST /api/creatives/{id}/refresh` | — | result of `track_test` |
| `GET /api/creatives/adoptable` | — | `find_adoptable` |
| `POST /api/creatives/{id}/adopt` | `{ad_id}` | new test ad; sets test `status="testing"` and `started_at` if it was draft |
| `GET /api/creatives/targets/prefill` | `?client_group_ids=a,b` | `prefill_targets` |

Validation: `origin in ("new", "revive")`; `targets.mode in ("thresholds", "baseline", "cpl_only")`; other users' ids → 404.

- [ ] **Step 1: Write the failing tests:** create → list → get round trip; 404 for other user; PATCH slug on non-draft → 409; archive hides from default list; adopt sets `testing`; invalid mode → 422.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): creatives API`.

### Task 9: Frontend API layer and display helpers [FE]

**Files:**
- Create: `src/lib/creatives-api.js`, `src/lib/creative-verdict.js`, `src/lib/creative-naming.js`
- Modify: `src/lib/query-keys.js` (`creatives: () => "/api/creatives"`, `creative: (id) => \`/api/creatives/${id}\``)
- Test: `src/lib/__tests__/creative-verdict.test.js`, `src/lib/__tests__/creative-naming.test.js`

**Interfaces — Produces:**
- `useCreativeTests({ status, clientGroupId }) -> { tests, error, isLoading, mutate }` (pattern of `useAgents` in `src/lib/agents-api.js`)
- `useCreativeTest(id) -> { test, error, isLoading, mutate }`
- `createCreativeTest(body)`, `updateCreativeTest(id, body)`, `archiveCreativeTest(id)`, `refreshCreativeTest(id)`, `adoptCreativeAd(id, adId)` — each `apiRequest` then revalidates `queryKeys.creatives()` and `queryKeys.creative(id)` via SWR `mutate`
- `creative-naming.js`: `slugify(name)`, `metaAdName(code, slug)` — identical rules to Task 1 (used only for the live preview)
- `creative-verdict.js`:
  - `VERDICT_META = { draft, posting, testing, winner, loser, inconclusive, archived } → { label, tone }` with tones `neutral|neutral|info|success|danger|warning|muted`
  - `scoreTone(state) -> "success"|"danger"|"warning"|"muted"` (`pass|fail|scoring|removed`)
  - `floorProgress(score, targets) -> { pct: number, label: string }` — max of spend/min_spend and days/min_days, capped at 1; label `"£96 / £150"` or `"day 4 of 7"` whichever is further along, `"done"` at 1
  - `formatCpl(score, currency) -> string` — `"— · 0 leads"` when `cpl == null` and spend > 0

- [ ] **Step 1: Write the failing tests** for `slugify` (same cases as Task 1), `floorProgress` (spend-led, days-led, capped), `formatCpl` zero-leads case, `VERDICT_META.winner.tone === "success"`.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/creative-` → FAIL.
- [ ] **Step 3–4:** Implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): frontend API and display helpers`.

### Task 10: Creatives table [FE]

**Files:**
- Create: `src/components/creatives/CreativesTable.jsx`, `AccountDotStrip.jsx`, `VerdictBadge.jsx`
- Test: `src/components/creatives/__tests__/creatives-table.test.jsx`

**Interfaces:**
- Consumes: Task 9 helpers; ds `DataTable` (`getSubRows`, `getRowId`, `onRowClick`), `Badge`, `ProgressBar`, `Button`
- Produces:
  - `<CreativesTable tests loading onOpen(testId) onAccountAction(test, ad, action) />` — `action ∈ "pause" | "retry"` (no budget action: the ad set and its budget belong to the user, not the test)
  - `<AccountDotStrip ads />` — one 10px square per ad coloured by `scoreTone`, then `"7/9 pass"`, or `"3 posted · 2 failed"` while posting
  - `<VerdictBadge status />`

Columns per spec §8.1 (parent and child). Child rows come from `test.ads` with a `__child: true` flag; child rows render the account name + `act_…` + ad set name in the first cell. Row click on a parent calls `onOpen`; the expand chevron toggles without opening.

- [ ] **Step 1: Write the failing tests:** renders one parent per test; expanding shows N child rows; child "Pause here" calls `onAccountAction(test, ad, "pause")`; zero-leads child shows `"— · 0 leads"`; removed child shows "Removed in Meta".
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): creatives table with per-account rows`.

### Task 11: Creatives tab in the Marketing Hub [FE]

**Files:**
- Create: `src/components/creatives/CreativesTab.jsx`, `src/components/creatives/CreativesHero.jsx`
- Modify: `src/components/campaigns/MarketingContent.jsx` — add `{ key: "creatives", label: "Creatives", icon: Sparkles }` to `SECTION_TABS`; when `activeTab === "creatives"`: render `<CreativesHero />` in place of the existing hero `StaggerItem` contents, hide the search `Input`/`ColumnsMenu`/`DrillDownBreadcrumb`/filters, and render `<CreativesTab clientGroupId={selectedClientGroup} />` inside `PageTabPanel`. Read `?tab=creatives` and `?creative=<code-or-id>` from the URL on mount.
- Test: `src/components/creatives/__tests__/creatives-tab.test.jsx`

**Interfaces:**
- `<CreativesTab clientGroupId />` — toolbar (ds search input, status chips with counts, Columns menu saved via `usePageViews("mktg_creatives")`, "New creative test" → `router.push("/campaigns/creatives/new")`), note "Tests use their own dates; the period picker doesn't apply", `CreativesTable`, empty state (two buttons: "Create a new ad", "Test an ad you already have" → wizard with `?path=revive`), and `CreativeDetailSheet` (Task 12) controlled by `openId`
- `<CreativesHero tests />` — ds `MetricTabsChart` with metrics `live, spend, leads, cpl, hook, win_rate` (values from summaries; series = sum of `days` per date across live tests for spend/leads/cpl), and ds `BirdyRead` fed with findings from `GET /api/dashboard/summary` filtered to `rule_id` starting `creative_` (Task 21; until then render `empty`)

- [ ] **Step 1: Write the failing tests:** status chip filters rows; `?creative=CT-0042` opens the sheet for that code; empty state shows both path buttons; the period-picker note is present.
- [ ] **Step 2–4:** FAIL → implement → PASS. Existing `src/components/campaigns/__tests__/ads-gallery.test.jsx` still passes.
- [ ] **Step 5:** Commit `feat(creatives): Creatives tab in the Marketing Hub`.

### Task 12: Detail sheet [FE]

**Files:**
- Create: `src/components/creatives/CreativeDetailSheet.jsx`, `src/components/creatives/AccountLinesChart.jsx`
- Test: `src/components/creatives/__tests__/detail-sheet.test.jsx`

**Interfaces:**
- `<CreativeDetailSheet testId open onOpenChange onAddAccounts onEditTargets />` — ds `Sheet` size `lg`; uses `useCreativeTest`
- `<AccountLinesChart days targets metric />` — recharts `LineChart`, one line per ad coloured by `scoreTone`, dashed `ReferenceLine` at the target (none for `baseline` mode); metric switch via ds `SegmentedTabs` `cpl|ctr|hook|leads` (hook hidden for image tests)

Sections exactly as spec §8.3; footer actions: Add accounts (→ wizard `?test=<id>&step=accounts`), Edit targets (→ `?test=<id>&step=targets`), Pause everywhere (Phase 2, Task 15 endpoint; hidden until then), Archive (`confirm()` from ds then `archiveCreativeTest`). Header "Refresh" calls `refreshCreativeTest`.

- [ ] **Step 1: Write the failing tests:** KPI row shows target captions; accounts sorted by CPL ascending with `null` last; Archive asks for confirmation then calls the API; image test hides the Hook tab.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): test detail sheet`.

---

## Phase 2 — Post

### Task 13: Meta read endpoints for the wizard [BE]

**Files:**
- Modify: `integrations/facebook_utils/meta_creative_reader.py`, `routers/creatives.py`
- Test: `tests/test_creatives_wizard_reads.py`

**Interfaces — Produces:**
- Reader: `list_adsets(act, token) -> list[dict]` (`id,name,status,effective_status,campaign{id,name,objective},optimization_goal,promoted_object`), `list_promote_pages(act, token) -> list[dict]`, `list_lead_forms(page_id, token) -> list[dict]` (`id,name,status`)
- `adset_compatible(adset: dict, destination: str) -> tuple[bool, str | None]` — `lead_form` needs objective `OUTCOME_LEADS`; `website` accepts `OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_ENGAGEMENT`; `whatsapp` needs `OUTCOME_ENGAGEMENT` or `OUTCOME_SALES`; reason string otherwise
- Routes:
  - `GET /api/creatives/ad-accounts` → `[{ad_account_id, name, currency, clients: [{id, name}]}]`, one row per distinct `meta_ad_account_id` (Review Focus 4)
  - `GET /api/creatives/ad-accounts/{act}/adsets?destination=` → adsets + `compatible`, `reason`, `owning_client_group_id` (via `owning_group` on the adset's campaign id)
  - `GET /api/creatives/ad-accounts/{act}/pages`
  - `GET /api/creatives/pages/{page_id}/lead-forms`
  - `GET /api/creatives/ads/search?q=&ad_account_id=&limit=30` → cached ads across the user's groups: `{ad_id, name, ad_account_id, client_name, status, thumbnail, image, video_id, title, body, metrics: {spend, leads, cpl}}` from preset `last_30d`, ranked: exact code match, name prefix, substring, then spend desc

Every route checks the account belongs to one of the user's client groups (404 otherwise).

- [ ] **Step 1: Write the failing tests:** shared account listed once with two clients; foreign account → 404; adset compatibility for each destination; search ranks `CT-0042` exact match first.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): wizard read endpoints`.

### Task 14: Meta writer and error explanations [BE]

**Files:**
- Create: `integrations/facebook_utils/meta_creative_writer.py`, `services/creatives/errors.py`
- Test: `tests/test_meta_creative_writer.py`, `tests/test_creative_errors.py`

**Interfaces — Produces:**
- `class MetaWriteError(Exception)` with `code, subcode, user_msg, step, retryable`
- `async upload_image(act, token, *, image_url: str) -> str` (downloads, posts base64 `bytes` to `/{act}/adimages`, returns hash)
- `async upload_video(act, token, *, file_url: str, name: str) -> str` (`/{act}/advideos`, returns id)
- `async video_ready(video_id, token) -> bool` (`status.video_status == "ready"`; raises on `"error"`)
- `async create_adcreative(act, token, *, name, page_id, fmt, media_ref, primary_text, headline, description, cta_type, destination, website_url=None, url_params=None, lead_form_id=None, whatsapp_number=None) -> str` — `object_story_spec` with `link_data` (image: `image_hash`) or `video_data` (`video_id`, `image_url` thumbnail); `call_to_action.value` holds `lead_gen_form_id` or `link`
- `async create_ad(act, token, *, name, adset_id, creative_id) -> str` — always `status="PAUSED"`
- `errors.explain(err: MetaWriteError) -> {"message": str, "fix": str | None}` with fixes: `lead_form_page_mismatch` (code 100, user_msg mentions form/page) → `"use_website_url"`; adset paused/archived → `"pick_adset"`; policy (code 368 or subcode 1885183) → `None` with Meta's message; rate limit (4/17/613) → `"retry_later"`; token (190) → `"reconnect_meta"`

- [ ] **Step 1: Write the failing tests:** request bodies for each call (assert `status == "PAUSED"` on ads, `call_to_action.value.lead_gen_form_id` set for lead forms); error mapping table above.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): Meta write calls and error explanations`.

### Task 15: Posting pipeline [BE]

**Files:**
- Create: `services/creatives/posting.py`
- Modify: `routers/creatives.py`, `jobs/creative_tracking.py` (`run_creatives_tick` calls `run_post_jobs` first)
- Test: `tests/test_creative_posting.py`

**Interfaces:**
- Consumes: Tasks 2, 13, 14; `set_object_status` (existing)
- Produces:
  - `async enqueue_post(db, user_id, test_id, *, accounts: list[dict]) -> dict` — `accounts` items `{ad_account_id, client_group_id, adset_id, adset_name, page_id, lead_form_id?, targets_override?}`; validates test is `draft` or (for add-accounts) not archived; inserts `TEST_ADS` rows + one `POST_JOBS` doc per row `{id, user_id, test_id, test_ad_id, state: "queued", attempts: 0, lease_until: None}`; sets test `status="posting"`
  - `async run_post_jobs(db, mongo_client, now_utc, *, limit: int = 5) -> dict` — claims queued jobs with `find_one_and_update` setting `lease_until = now + 90s` (skip if lease live); runs the next missing step for that ad (`media` → `creative` → `ad`), storing each id on `TEST_ADS.meta` **before** moving on; `video_ready` false → release, retry next tick; retryable error → `attempts += 1`, backoff `30s·2^attempts`, max 5; non-retryable → `post_state="failed"`, `post_error={code, message, step, fix}`
  - `async go_live(db, mongo_client, user_id, test_id, *, partial_ok: bool = False) -> dict` — requires all ads `created` unless `partial_ok`; sets each `ACTIVE` via `set_object_status`; `post_state="active"`; test `status="testing"`, `started_at=now`
  - `async retry(db, user_id, test_id, test_ad_id, *, patch: dict | None = None) -> dict` — applies `patch` (e.g. `{"destination": "website"}` or new `adset_id`), re-queues from the failed step
  - `async pause_ads(db, mongo_client, user_id, test_id, ad_account_ids: list[str] | None) -> dict`
- Routes: `POST /{id}/post` `{accounts}`; `POST /{id}/go-live` `{partial_ok}`; `POST /{id}/ads/{ad_row_id}/retry` `{patch?}`; `POST /{id}/pause` `{ad_account_ids?}`; `POST /{id}/accounts` (add accounts to a live test — enqueues, and new ads go live automatically when created because the test is already `testing`)
- Auto go-live: when the last job of a `posting` test succeeds and none failed, `run_post_jobs` calls `go_live` itself.

- [ ] **Step 1: Write the failing tests** (fake writer functions via monkeypatch):
  - `test_happy_path_posts_paused_then_live`: 3 accounts, 3 ticks → all `created`, then auto go-live → `ACTIVE` set 3×, test `testing`.
  - `test_double_post_creates_no_duplicates` (Review Focus 5): call the `POST /{id}/post` route twice → 409 on second; run two overlapping `run_post_jobs` with a live lease → each writer called once per ad.
  - `test_resume_after_crash_skips_done_steps`: `meta.image_hash` stored, `creative_id` missing → `upload_image` not called again.
  - `test_partial_failure`: one non-retryable error → that ad `failed` with `fix`; no auto go-live; `go_live(partial_ok=True)` activates the other two.
  - `test_retry_with_website_patch`: failed lead-form ad retried with `{"destination": "website"}` → re-runs from `creative`.
  - `test_rate_limit_backoff`: code 17 → `attempts == 1`, `lease_until` ≥ now + 60s.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): posting pipeline with paused-first go-live`.

### Task 16: Media upload [BE + FE]

**Files:**
- [BE] Create: `services/creatives/upload_grant.py`; Modify: `routers/creatives.py` (`POST /api/creatives/upload-grant` `{mime, bytes}` → `{grant}`)
- [FE] Create: `src/app/api/creatives/upload/route.js`, `src/lib/creative-upload.js`; Modify: `package.json` (`@vercel/blob` exact current version)
- Tests: [BE] `tests/test_creative_upload_grant.py`; [FE] `src/lib/__tests__/creative-upload.test.js`

**Why a grant:** the API's auth cookie lives on the backend domain, so the Next route cannot see the user. The backend signs a short-lived grant; the Next route verifies it before issuing a Blob client token.

**Interfaces — Produces:**
- [BE] `issue_grant(user_id: str, mime: str, size: int, now: datetime) -> str` — `base64url(json{u, m, s, exp}) + "." + hex(hmac_sha256(CREATIVE_UPLOAD_SECRET, payload))`, `exp = now + 10 min`; raises `ValueError` for disallowed mime or size over the Global Constraints limits
- [FE route] `POST /api/creatives/upload` using `handleUpload` from `@vercel/blob/client`; `onBeforeGenerateToken(pathname, clientPayload)` verifies the grant with `CREATIVE_UPLOAD_SECRET` (Node `crypto`), checks `exp`, returns `{ allowedContentTypes: [grant.m], maximumSizeInBytes: grant.s, tokenPayload: grant.u }`; pathname must start with `creatives/`
- [FE] `uploadCreativeMedia(file, { onProgress }) -> Promise<{ blob_url, mime, bytes, width, height, duration_s }>` — validates type/size client-side (same limits), gets the grant via `apiRequest`, calls `upload("creatives/<uuid>-<name>", file, { access: "public", handleUploadUrl: "/api/creatives/upload", clientPayload: grant, onUploadProgress })`, reads width/height/duration from an `Image`/`<video>` element
- [BE] `async cleanup_archived_media(db, now_utc) -> int` in `services/creatives/upload_grant.py` — deletes the Blob objects (`DELETE https://blob.vercel-storage.com/delete` with `BLOB_READ_WRITE_TOKEN`, urls batched) of tests archived ≥ 30 days ago and sets `creative.media.deleted_at`; called daily from `run_creatives_tick`
- Env: `CREATIVE_UPLOAD_SECRET` on both projects (plus `BLOB_READ_WRITE_TOKEN` on the backend for cleanup), `BLOB_READ_WRITE_TOKEN` on the frontend project. Add both to each repo's `.env.example`.

- [ ] **Step 1: Write the failing tests:** [BE] `cleanup_archived_media` deletes only tests archived ≥ 30 days and is not repeated once `deleted_at` is set; grant round-trip verifies with the same secret; tampered payload fails; 31 MB PNG raises; 1.1 GB MP4 raises. [FE] `uploadCreativeMedia` rejects a `image/gif` before any request; route verifier (export it as `verifyGrant(grant, secret, now)`) rejects expired grants.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit (one per repo) `feat(creatives): signed direct-to-Blob media upload`.

### Task 17: Wizard shell, draft autosave, step 1 [FE]

**Files:**
- Create: `src/app/campaigns/creatives/new/page.jsx`, `src/app/campaigns/creatives/[id]/edit/page.jsx`, `src/components/creatives/wizard/CreativeWizard.jsx`, `useCreativeDraft.js`, `StepCreative.jsx`, `RevivePicker.jsx`, `MediaDrop.jsx`
- Modify: `src/components/agents/WizardSteps.jsx` — accept an optional `steps` prop (default `WIZARD_STEPS`), so the agent setup page is unchanged
- Test: `src/components/creatives/wizard/__tests__/step-creative.test.jsx`, `src/components/agents/__tests__/` existing tests still pass

**Interfaces:**
- `CREATIVE_STEPS = ["Creative", "Accounts", "Targets", "Review & post"]`
- `useCreativeDraft(testId | null) -> { draft, setField(path, value), save(): Promise<test>, saving, error }` — creates the draft on first change (`createCreativeTest`), then debounced `updateCreativeTest` (800 ms); `/new` replaces the URL with `/campaigns/creatives/<id>/edit` after creation so refresh keeps the draft
- URL params: `path=new|revive`, `test=<id>`, `step=accounts|targets`, `scale=<id>` (Task 25)
- `<StepCreative draft setField />` — path cards; new: `MediaDrop` (calls `uploadCreativeMedia`, shows progress, sets `creative.media` and `creative.format`), primary text, headline, description, CTA select (`LEARN_MORE, SIGN_UP, GET_QUOTE, APPLY_NOW, CONTACT_US, BOOK_NOW`), destination segmented (`lead_form|website|whatsapp`), website URL when needed, internal name, editable slug with the fixed `CT-xxxx | ` prefix shown
- `<RevivePicker onPick(ad) />` — debounced search over `GET /api/creatives/ads/search`; picking fills `source`, `origin="revive"`, `creative` fields (`body→primary_text`, `title→headline`, media from `image`/`video_id`) and flags `edited=true` on later edits of copied fields
- Step validation for "Continue": media (new) or source (revive), primary text, destination (+ URL when `website`)

- [ ] **Step 1: Write the failing tests:** Continue disabled until required fields; picking a revive ad fills primary text and headline; slug input cannot change the code prefix; draft is created once then updated (mock the API).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): wizard shell, drafts and creative step`.

### Task 18: Wizard step 2 — Accounts [FE]

**Files:**
- Create: `src/components/creatives/wizard/StepAccounts.jsx`
- Test: `src/components/creatives/wizard/__tests__/step-accounts.test.jsx`

**Interfaces:**
- `<StepAccounts draft setField />` writes `draft.accounts: [{ad_account_id, client_group_id, adset_id, adset_name, page_id, lead_form_id}]` (kept on the draft under `creative.accounts`; Task 19 sends it to `/post`)
- Table of `GET /api/creatives/ad-accounts` (name, client names, currency) with checkboxes and "select all"; each checked row expands to: Page select (default: revive source page, else first promote page), Ad set select (incompatible ones disabled with reason, from `?destination=`), Lead form select when destination is `lead_form`. `client_group_id` = adset's `owning_client_group_id`.
- "Apply to all" for ad set: picks, in every other selected account, the ad set with the same name if one exists.
- Rows already in the test (add-accounts mode) are shown checked and locked.

- [ ] **Step 1: Write the failing tests:** incompatible ad set is disabled with its reason; "Apply to all" fills same-named ad sets only; lead form select appears only for `lead_form`; Continue disabled until every selected row has an ad set (and a form when needed).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): wizard accounts step`.

### Task 19: Wizard steps 3–4 — Targets, Review & post [FE]

**Files:**
- Create: `src/components/creatives/wizard/StepTargets.jsx`, `StepReview.jsx`, `PostProgress.jsx`
- Test: `src/components/creatives/wizard/__tests__/step-targets.test.jsx`, `step-review.test.jsx`

**Interfaces:**
- `<StepTargets draft setField />` — mode cards; for `thresholds`: rows for `cpl ≤`, `ctr ≥`, `cpc ≤`, `hook_rate ≥` (disabled with note for image), `leads ≥`, each with enable checkbox and source label from `GET /api/creatives/targets/prefill`; `baseline`: `baseline_pct` + "also require CTR" toggle; `cpl_only`: one input. Per-account overrides drawer (ds `Sheet` md) listing selected accounts with their resolved CPL. Floor (`min_spend`, `min_days`), `win_share` (as %), daily budget note is **not** included (budget comes from the chosen ad set). Verdict actions → `on_verdict` (`notify_channels`, `suggest_pause_failing`, `auto_pause_losers`).
- `<StepReview draft />` — per-account summary, warnings (missing lead form, paused ad set, image + hook rate), **Post to N accounts** → `POST /api/creatives/{id}/post`; then `<PostProgress testId />` polls `useCreativeTest` every 3 s while `status === "posting"`, shows per-account state + `post_error.message` + fix buttons (`use_website_url` → retry with patch; `pick_adset` → inline ad set select → retry), "Go live with the N that worked" → `go-live {partial_ok:true}`, and "Open test" → `/campaigns?tab=creatives&creative=<code>`.

- [ ] **Step 1: Write the failing tests:** switching to `cpl_only` hides other rows; image format disables hook row; Post sends the accounts array; failed row with `fix:"use_website_url"` retries with `{patch:{destination:"website"}}`; partial go-live button appears only when ≥ 1 created and ≥ 1 failed.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): targets and review steps with post progress`.

### Task 20: Live ad preview [FE]

**Files:**
- Create: `src/components/creatives/wizard/AdPreview.jsx`
- Test: `src/components/creatives/wizard/__tests__/ad-preview.test.jsx`

**Interfaces:**
- `<AdPreview creative accounts />` — sticky frame; ds `SegmentedTabs` `feed|reels|stories` (reels/stories crop to 9:16); Page name from the selected account's page (switcher across selected accounts); renders local media (`blob_url`, or the revive source image/thumbnail), primary text with "…more" after 125 chars, headline, CTA label, `FORM ON FACEBOOK` vs domain caption; note "Posts paused first, then goes live together". After posting, a "View on Meta" link per ad uses `/api/facebook/ad-preview/{ad_id}`.

- [ ] **Step 1: Write the failing tests:** text over 125 chars truncates with "…more"; website destination shows the URL's domain; switching account changes the Page name.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): live ad preview`.

---

## Phase 3 — Act on it

### Task 21: Creative findings → suggestions [BE]

**Files:**
- Create: `ai/suggestions/creative_findings.py`
- Modify: `jobs/creative_tracking.py` (after `track_test`, call `sync_creative_suggestions`), `services/creatives/posting.py` (failed post → finding), `routers/dashboard.py::_suggestion_to_api` (add `"creative_test_id": (doc.get("evidence") or {}).get("creative_test_id")` and `"rule_id": doc.get("rule_id")`)
- Test: `tests/test_creative_findings.py`

**Interfaces:**
- `AGENT = "creative_test_judge"`
- `findings_for_test(test: dict, ads: list[dict], groups_by_id: dict) -> list[Finding]` — rule table (spec §9): `creative_winner` (OPPORTUNITY, `Action("scale_creative", params={"test_id"})`, only when ≥ 1 agency account has not run it), `creative_loser` (HIGH, `Action("pause_ads", targets=[failing ads])`), `creative_account_fail` (MEDIUM, one per failing account while the test is still `testing`, only if `on_verdict.suggest_pause_failing`), `creative_post_failed` (HIGH, `Action("retry_creative_post", params={"test_id","test_ad_id","patch"})`), `creative_adopt` (MEDIUM, `Action("adopt_creative_ad", params={"test_id","ad_id"})`). Every finding: `rule_id` set, `dedup_key = f"{rule_id}:{test_id}" + (f":{ad_account_id}" if per-account)`, `evidence.window="weekly"`, `evidence.raw["creative_test_id"] = test["id"]`, `client_group_id` = the account's group (test-level: the group with the most test ads), stats from the summary (CPL vs target, accounts pass/total, spend).
- `async sync_creative_suggestions(db, user_id: str, test: dict, ads: list[dict]) -> int` — `store.upsert_finding` for each, then `store.close_stale_open(db, user_id, AGENT, "weekly", keep_ids, client_group_ids=None)` limited to this test's keys (pass `keep_ids` = this pass's keys ∪ open keys of other tests)

- Auto-pause: when `on_verdict.auto_pause_losers` is true and the verdict becomes `loser`, `sync_creative_suggestions` calls `posting.pause_ads` for the failing accounts, logs `store.log_activity(kind=KIND_ACTION_APPLIED, actor="birdy")` and emits the `creative_loser` finding already applied (status `applied`) instead of open.
- Slack: new open findings reach Slack through the existing suggestion notifier (`services/slack_suggestion_notifier.py`); no new Slack code.

- [ ] **Step 1: Write the failing tests:** auto-pause on loser pauses only failing ads and stores the finding as applied; winner with all accounts already used → no winner finding; loser targets only failing ads; dedup keys stable across runs; test turning winner closes its open `creative_account_fail` items; API passthrough exposes `creative_test_id`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): creative test suggestions`.

### Task 22: New suggestion action types [BE]

**Files:**
- Modify: `ai/suggestions/contracts.py` (`ACTION_SCALE_CREATIVE="scale_creative"`, `ACTION_RETRY_CREATIVE_POST="retry_creative_post"`, `ACTION_ADOPT_CREATIVE_AD="adopt_creative_ad"`), `ai/suggestions/actions.py`
- Test: `tests/test_creative_actions.py`

**Interfaces:**
- `execute_action` routes the new types: `scale_creative` → no Meta write, returns `{"succeeded": [], "failed": [], "redirect": "/campaigns/creatives/new?scale=<test_id>"}`; `retry_creative_post` → `posting.retry(...)`; `adopt_creative_ad` → `reconcile.adopt(...)`. `_apply_claimed` passes `redirect` through in its result; undo for the new types returns `{"ok": False, "detail": "Nothing to undo"}`.
- Guardrails unchanged; they still run for `pause_ads` from creative findings (agent-less findings skip agent guardrails exactly as today).

- [ ] **Step 1: Write the failing tests:** apply on a `scale_creative` suggestion marks applied and returns the redirect; `retry_creative_post` calls `posting.retry` with the stored patch; undo on `adopt_creative_ad` is refused.
- [ ] **Step 2–4:** FAIL → implement → PASS. `PYTEST tests/test_suggestion_flow.py tests/test_agent_apply.py -q` still green.
- [ ] **Step 5:** Commit `feat(creatives): suggestion actions for creative tests`.

### Task 23: Alerts — creative test scope [BE]

**Files:**
- Create: `services/creatives/alerts.py`
- Modify: `core/models.py` (`CreateAlertRequest`/`UpdateAlertRequest`: `scope: Optional[str] = "clients"`, `creative_test_ids: Optional[List[str]] = []`), `core/constants.py` (`METRIC_LABELS` += `creative_verdict: "Creative verdict"`, `creative_cpl: "Creative CPL"`, `creative_ctr: "Creative CTR"`, `creative_hook_rate: "Creative hook rate"`, `creative_post_failed: "Creative post failed"`), `services/alert_service.py::evaluate_alert` (first line: `if alert.get("scope") == "creative_tests": return await evaluate_creative_alert(alert, mongo_client[DB_NAME])`), `routers/alerts.py` (persist the two new fields), `services/creatives/posting.py` (`go_live` creates the verdict alert when `on_verdict.notify_channels` is non-empty and stores `on_verdict.alert_id`; archive deletes it)
- Test: `tests/test_creative_alerts.py`

**Interfaces — Produces:**
- `async evaluate_creative_alert(alert: dict, db) -> dict` — same return shape as `evaluate_alert`; `tracking_mode == "per_client"` means **per account** and fills `per_client_results` with `group_id = ad_account_id`, `group_name = account name`
  - `creative_verdict`: triggered when any selected test has `verdict in ("winner","loser")` and `verdict_at > alert.last_triggered_at` (or never triggered); `value` 1/0; message `"CT-0042 is a winner"`
  - `creative_cpl|ctr|hook_rate`: compares each live test ad's `score` value with `operator`/`value` (`gt, lt, eq, neq`; `pct_*` unsupported → message "Not available for creative tests")
  - `creative_post_failed`: count of `post_state == "failed"` > 0
- `async create_verdict_alert(db, user_id, test: dict) -> str`

- [ ] **Step 1: Write the failing tests:** existing client alert path unchanged (no `scope`); verdict alert triggers once per verdict; per-account CPL alert lists only crossing accounts; `pct_drop` returns not-available without raising; archive removes the auto alert.
- [ ] **Step 2–4:** FAIL → implement → PASS. `PYTEST tests/test_alert_mcp.py -q` still green.
- [ ] **Step 5:** Commit `feat(creatives): creative test alert scope`.

### Task 24: Alerts editor scope [FE]

**Files:**
- Create: `src/components/alerts/CreativeScopeFields.jsx`
- Modify: `src/app/alerts/page.jsx` (scope `SegmentedTabs` "Clients | Creative tests" above the client picker; when `creative_tests`, render `CreativeScopeFields` instead of the client checklist and swap `METRIC_OPTIONS` for the creative metrics; send `scope` and `creative_test_ids`), `src/lib/alert-helpers.jsx` (creative metric labels/format)
- Test: `src/components/alerts/__tests__/creative-scope.test.jsx`

**Interfaces:** `<CreativeScopeFields value={creative_test_ids} onChange tests />` — "All live tests" toggle + checklist of live tests (code + name).

- [ ] **Step 1: Write the failing tests:** switching scope swaps the metric list; empty selection submits `creative_test_ids: []` with "All live tests" label; existing alerts open in "Clients".
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): creative scope in the alerts editor`.

### Task 25: Suggestion links and test actions [FE]

**Files:**
- Modify: `src/components/portfolio/SuggestionCard.jsx` and `src/components/agents/WorkItem.jsx` (when `suggestion.creative_test_id`, title links to `/campaigns?tab=creatives&creative=<id>`; on apply, if the response has `redirect`, `router.push(redirect)`), `src/app/dashboard/usePortfolioData.js` (map `creative_test_id`, `rule_id`), `src/components/creatives/CreativesHero.jsx` (feed `BirdyRead` from open suggestions with `rule_id` starting `creative_`, action = apply), `src/components/creatives/wizard/CreativeWizard.jsx` (`?scale=<id>`: load that test, jump to Accounts in add-accounts mode with unused accounts pre-checked)
- Also wire actions now that Task 15 exists: `CreativesTab` `onAccountAction` → `pause` calls `POST /api/creatives/{id}/pause {ad_account_ids:[act]}` (after ds `confirm()`), `retry` calls the retry endpoint; detail sheet shows **Pause everywhere** (confirm, then `POST /{id}/pause {}`). Add `pauseCreativeAds(id, adAccountIds?)` and `retryCreativeAd(id, rowId, patch?)` to `src/lib/creatives-api.js`.
- Test: `src/components/creatives/__tests__/suggestion-links.test.jsx`

- [ ] **Step 1: Write the failing tests:** row Pause confirms then calls the pause endpoint with that one account; card with `creative_test_id` renders the link; apply response with `redirect` navigates; `?scale=` pre-checks only accounts not in the test.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): suggestions link to creative tests`.

---

## Phase 4 — Birdy AI

### Task 26: Read tools [BE]

**Files:**
- Create: `ai/tools/creative_tools.py` (pattern of `ai/tools/agent_tools.py`: `_TOOL_DEFS` dict and `register_creative_tools(tool_registry=None)`; executors take `(db, user_id, mongo_client=None, **args)`)
- Modify: `routers/chat.py` (import + `register_creative_tools()`), `ai/orchestrator.py` (`CREATIVE_READ_TOOLS` added to `_PAGE_TOOLS["campaigns"]` and `["dashboard"]`)
- Test: `tests/test_creative_tools.py`

**Interfaces — Produces:** `find_ads(q, ad_account_id?, limit=10)`, `list_ad_accounts()`, `list_adsets(ad_account_id, destination)`, `list_creative_tests(status?)`, `get_creative_test(code_or_id)` — thin wrappers over Tasks 2, 8, 13 returning compact JSON (no media URLs except thumbnail); `get_creative_test` accepts `"CT-0042"` or an id.

- [ ] **Step 1: Write the failing tests:** each tool owner-scoped; `get_creative_test("CT-0042")` resolves by code; the five names are in `_PAGE_TOOLS["campaigns"]`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): Birdy read tools for creative tests`.

### Task 27: Write tools with confirmation gate + prompt [BE]

**Files:**
- Modify: `ai/tools/creative_tools.py`, `ai/orchestrator.py` (write tools on `campaigns`; general chat already gets all tools), `ai/prompts/birdy.py` (append `CREATIVE_TESTS_GUIDE` from new `ai/prompts/creatives.py`)
- Test: `tests/test_creative_tools.py` (extend)

**Interfaces — Produces:**
- `draft_creative_test(name, origin, source_ad_id?, attachment_index?, primary_text?, headline?, cta_type?, destination, website_url?, ad_account_ids, adset_ids?: {act: adset_id}, targets)` → creates/updates a draft (adset auto-picked when exactly one compatible ad set exists, else returns `needs: [{ad_account_id, adsets: [...]}]`); returns `{"draft": {...}, "card": <creative card payload>}` and the reply must include `:::creative <card json>:::`
- `post_creative_test(test_id, confirmed=False)`, `scale_creative_test(test_id, ad_account_ids, confirmed=False)`, `pause_creative_ads(test_id, ad_account_ids?, confirmed=False)` → without `confirmed is True` return `{"error": "confirmation_required", "message": ...}` (copy the shape in `ai/tools/call_analysis_tools.py`); with it, call Task 15 functions
- `update_creative_targets(test_id, targets)` → Birdy-only write, no gate
- Card payload: `{test_id, code, name, thumbnail, origin, accounts: [{name, adset_name}], targets_text, destination_text, warnings: [str], posts_as: "Paused, then live together once all N accept"}`
- Prompt guide (exact rules): ask for missing accounts/targets with `:::ui` choice blocks; always `draft_creative_test` before posting; never set `confirmed=true` unless the user's latest message is the card's confirmation or says to post; for a brand-new ad without an attachment, ask the user to attach the image/video.

- [ ] **Step 1: Write the failing tests:** post without `confirmed` returns `confirmation_required` and writes nothing; with `confirmed=True` calls `enqueue_post`; draft with two compatible ad sets returns `needs`; `CREATIVE_TESTS_GUIDE` is in the campaigns system prompt.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): Birdy write tools behind confirmation`.

### Task 28: `:::creative` chat block [FE]

**Files:**
- Modify: `src/lib/chat-ui-parser.js` (`BLOCK_TYPES` += `"creative"`), `src/components/chat/MessageBubble.jsx` (case `"creative"`), `src/lib/chat-tool-icons.js` (category `creative` for the ten tool names, labels e.g. "Finding ads", "Drafting test", "Posting test")
- Create: `src/components/chat/blocks/CreativeTestCard.jsx`
- Test: `src/lib/__tests__/chat-ui-parser-creative.test.js`, `src/components/chat/__tests__/creative-card.test.jsx`

**Interfaces:** `<CreativeTestCard data onSend(text) />` — buttons: **Post to N accounts** → `onSend("Yes, post CT-0048 to N accounts.")`; **Open in wizard** → `router.push("/campaigns/creatives/<test_id>/edit")`; **Change targets** → `onSend("Change the targets for CT-0048.")`. Buttons disable after one click. `MessageBubble` already receives the send callback used by `ChatUIBlock`; pass the same one.

- [ ] **Step 1: Write the failing tests:** parser extracts a `creative` block with and without closing fence; card renders warnings; Post click sends the exact text once.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(creatives): creative confirm card in chat`.

### Task 29: Chat attachments — backend [BE]

**Files:**
- Modify: `core/models.py` (`ChatAttachment(BaseModel): blob_url, mime, bytes, width?, height?, duration_s?, thumbnail_url?`; `ChatRequest.attachments: Optional[List[ChatAttachment]] = []`), `routers/chat.py` (pass through), `ai/orchestrator.py::run_chat` (new param `attachments: Optional[list[dict]] = None`; stores them on the session as `session_attachments` (append, index = position); the user message sent to the provider gets OpenAI-style content parts `[{"type":"text"}, {"type":"image_url","image_url":{"url":…}}]` **only for this turn** and only when `provider.supports_vision`; history keeps text plus a line `"[Attached: 1 image (1080×1350), 1 video (0:27)]"`; `draft_creative_test(attachment_index=…)` reads from `session_attachments`), `ai/providers/base.py` (`supports_vision: bool = False`), `ai/providers/anthropic_provider.py` + `openai_provider.py` + `openrouter_provider.py` (`supports_vision = True`; Anthropic `_convert_messages` maps `image_url` parts to `{"type":"image","source":{"type":"url","url":…}}`), videos send `thumbnail_url` as the image part when present.
- Validation: attachment `blob_url` host must end with `.public.blob.vercel-storage.com`; max 4 per message; same mime/size limits.
- Test: `tests/test_chat_attachments.py`

- [ ] **Step 1: Write the failing tests:** non-blob host → 422; history stores the text summary, not the parts; Anthropic conversion emits an `image` block; non-vision provider gets text only; `draft_creative_test(attachment_index=0)` sets `creative.media.blob_url`.
- [ ] **Step 2–4:** FAIL → implement → PASS. `PYTEST tests/test_chat_history.py -q` still green.
- [ ] **Step 5:** Commit `feat(chat): image and video attachments`.

### Task 30: Chat attachments — composer [FE]

**Files:**
- Modify: `src/components/chat/ChatComposer.jsx` (paperclip button, drag-and-drop, chips with progress and remove, max 4, accepts the Global Constraints types), `src/components/chat/ChatConversation.jsx` (`sendMessage(text, attachments)`; body gains `attachments`; user bubble shows thumbnails; send disabled while an upload is in progress)
- Test: `src/components/chat/__tests__/composer-attachments.test.jsx`

**Interfaces:** uses `uploadCreativeMedia` (Task 16). `sendRef` callers that pass only text keep working.

- [ ] **Step 1: Write the failing tests:** a fifth file is refused with a toast; send is disabled during upload; request body carries the uploaded attachment; removing a chip drops it from the body.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(chat): attach images and videos`.

---

## Phase 5 — Verify

### Task 31: End-to-end verification

- [ ] **Step 1:** [BE] `PYTEST -q` → no new failures vs Task 0 baseline. [FE] `npx vitest run` → same.
- [ ] **Step 2:** [FE] `NEXT_PUBLIC_API_URL=http://localhost:8000 npx next build` → exits 0. Run backend `../birdy-backend/.venv/bin/uvicorn main:app --port 8000`, frontend on port 3005.
- [ ] **Step 3:** Seed a throwaway test user with two client groups (one shared ad account), three creative tests (winner, testing with a removed ad, posting with one failure) directly in Mongo. Screenshot at 1440 wide and 390 wide: `/campaigns?tab=creatives` (collapsed + expanded row), detail sheet, wizard each step, post progress with a failure, `/alerts` creative scope, dashboard suggestion card, chat with the creative card. Compare each against `docs/superpowers/mocks/creatives/mock.html`; fix drift.
- [ ] **Step 4:** Posting against Meta is verified only on a sandbox/test ad account. If none is available, record that the posting path is covered by recorded-response tests only and list it as outstanding in the final report.
- [ ] **Step 5:** Delete the seeded user and its documents (`users`, `client_groups`, `creative_*`, `ai_suggestions`, `alerts`, `ai_chat_sessions`, `ai_conversation_log`, `ai_usage`).
- [ ] **Step 6:** Commit any fixes; push both branches; open one PR per repo (bodies end with the Claude Code line), linking each other and the spec.

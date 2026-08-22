# Data-Accuracy Audit — Clients page vs. Marketing / Sales / Lead hubs

**Date:** 2026-08-22 · **DB:** `birdyaidev` · **Reference user:** `hello@soupgrowth.com` (67 client groups)
**Method:** every card and chart traced component → API client → FastAPI router → service → MongoDB pipeline, then each figure recomputed directly against the cluster at `last_7d`, `last_30d` and `maximum`.

**Baseline:** the Clients page (`/clients`) is treated as source of truth. 18 discrepancies confirmed with numbers.

> Spot-checked independently against the cluster: findings 9, 13 and 14 reproduce exactly
> (`active`x9, `raw_payload.transfer = True` on 103,183/103,183, exactly 1,019 orphans in one dead group).

---

## The shape of the problem

All four surfaces consume the **same** `/api/client-groups` payload but read **different fields out of it**, and the three redesigned hubs then apply a **second, client-side date window** on top of the one the backend already applied.

Worst offenders: the Marketing Hub's ad-spend chart plots £278,161 under a headline saying £428,479 (−35.1%), and its leads chart plots 33,555 under a headline saying 150,827 (−77.8%).

Notably, the **cache-staleness hypothesis** in `saleshub-totals.js:11-19` — the stated reason four tiles were moved onto `daily_calls` — **does not currently reproduce**. `hp_daily_calls` and `hotprospector_call_cache` agree to 0 calls at every preset.

---

## Data lineage map

| Surface | Card / Chart | Route → Service → Collection | Pipeline summary |
|---|---|---|---|
| **Clients** (truth) | Active clients / Total spend / Total leads / Avg CPL | `GET /api/client-groups?date_preset=` → `routers/client_groups.py:83` → `client_groups.facebook_cache.<preset>.metrics.insights` | Filters `client_status === "Active"`, sums account-level Meta Insights |
| **Clients** | Table `ghl_contacts` | same → live `$match`+`$group` on `ghl_contacts` (`client_groups.py:124-160`) | `contact_data.dateAdded` between `{start}T00:00:00.000Z`..`{end}T23:59:59.999Z` |
| **Clients** | Table `ghl_*_opps` | same → `client_groups.ghl_opp_cache.<preset>` ← `integrations/gohighlevel.py:79` | won/lost by `lastStatusChangeAt`, open by `createdAt` — **activity-in-window** |
| **Clients** | Table `hp_*` | same → `client_groups.hotprospector_call_cache.<preset>` ← `services/hp_service.py:54` | Buckets every call by `call_time_iso[:10]` into each preset |
| **Marketing** | 6 KPI tiles + spend/leads/CPL headline | `facebook_cache.<preset>.campaigns[]` → `marketing-aggregate.js:70-92` | Sums **campaign rows**, no `client_status` filter |
| **Marketing** | Spend & Impressions chart | `client_groups.meta_daily_spend` ← `meta_daily_spend.py:52` | Raw Meta `time_increment=1`, **400-day retention, unconverted currency** |
| **Marketing** | Leads & CPL chart | `GET /api/facebook-leads/series` → `routers/meta.py:854` → `facebook_leads` | `$substrBytes(created_time,0,10)` group-by-day |
| **Marketing** | Table GHL columns | `GET /api/campaigns/opp-rollup` → `client_groups.py:1947` | `facebook_leads` ⋈ `ghl_contacts`, **one** primary opp per matched contact |
| **Sales Hub** | Total calls / Inbound / Outbound / Talk + chart | `client_groups.hp_daily_calls` ← `hp_service.py:108` | Client-side window slice, `outbound = calls − inbound` |
| **Sales Hub** | Leads called / Transfers tiles | `client_groups.hotprospector_call_cache.<preset>` | Different cache from the tiles beside them |
| **Lead Hub** | 6 KPI tiles + 4 chart series | `client_groups.ghl_daily_leads` ← `services/ghl_daily_leads.py:54` | Cohort by `dateAdded[:10]`, `lead_type=="lead"`, `$unwind` opportunities |
| **Lead Hub** | Table + insight anomaly | `GET /api/leads/unified` → `client_groups.py:2082` | Live aggregation, **no group filter when "all"** |

---

## Confirmed discrepancies

### 1. Marketing Hub: ad-spend chart contradicts its own headline — CRITICAL

| Preset | Headline (tile) | Chart plotted sum | Δ |
|---|---|---|---|
| `maximum` | £428,479.21 | £278,161.14 | **−£150,318 (−35.1%)** |
| `last_30d` | £21,092.19 | £22,542.71 | +£1,450 (+6.9%) |
| `last_7d` | £4,877.85 | £5,258.80 | +£381 (+7.8%) |

Three stacked causes:
- `meta_daily_spend.py:116` retains only **400 days** (2025-07-18 → 2026-08-22); "maximum" spans the full account lifetime, so the chart is structurally truncated while `useMarketingHubData.js:266` takes `total` from the untruncated preset.
- The chart window comes from `presetToDateRange()` (`date-utils.js:38-43`), returning `today−7 … today` — **8 days including today**. Meta's own `last_7d` ends yesterday. GBP-only: preset £4,462.90 vs FE-window £4,622.64 vs Meta-window £4,393.16.
- Currency (finding 4).

### 2. Marketing Hub: leads chart contradicts its own headline — CRITICAL

| Preset | Headline (Meta `results`) | Chart plotted (`facebook_leads` rows) | Δ |
|---|---|---|---|
| `maximum` | 150,827 | 33,555 | **−117,272 (−77.8%)** |
| `last_30d` | 7,549 | 6,695 | −854 (−11.3%) |
| `last_7d` | 1,752 | 1,473 | −279 (−15.9%) |

`useMarketingHubData.js:275` takes the card total from `current.leads` (Meta Insights conversion count, `marketing-aggregate.js:76`) while the plotted series counts rows in `facebook_leads` (36,204 docs total for this user — it can never reach 150,827). Two different measurements presented as one metric.

### 3. Clients excludes Inactive clients; Marketing Hub includes them — HIGH

`last_7d`, same user, same preset:

| | Clients page | Marketing Hub | Δ |
|---|---|---|---|
| Total spend | £4,316.17 | £4,877.85 | +£561.68 (**+13.0%**) |
| Total leads | 1,632 | 1,752 | +120 (+7.4%) |
| Avg CPL | £2.64 | £2.78 | +£0.14 |

`clients/page.jsx:548` filters `client_status === "Active"` (49 of 67). `marketing-aggregate.js:111-114` and `MarketingContent.jsx:342` iterate every group. The 18 Inactive groups carry exactly £561.68 / 142 results in that window.

### 4. `meta_daily_spend` is never currency-converted — HIGH

`services/meta_service.py:406-439` converts every spend field to the user's currency before writing `facebook_cache` (all 67 groups show `currency = "GBP"`, 4 show `original_currency = "USD"`). `meta_daily_spend.py:97` writes Meta's raw response with **no conversion**.

The 4 USD accounts, `last_7d`, preset ÷ daily:

| Group | preset | daily (Meta window) | ratio |
|---|---|---|---|
| Marika Aesthetics (Body Sculpting) | 125.17 | 168.36 | 0.743 |
| Marika Aesthetics (face and body) | 125.16 | 168.36 | 0.743 |
| Lizzie Jayne's Beauty | 112.09 | 150.76 | 0.743 |
| Simplea You | 52.53 | 129.55 | 0.405 ← anomalous, see Suspected |

0.743 is a USD→GBP rate. **£631.94 of the `last_7d` chart and £35,939.68 of the all-time chart are unconverted USD**, inflated ≈1.35x, silently added to GBP totals under one symbol.

### 5. Three different "Opportunities" and "Conversion rate" figures — HIGH

`last_7d`, all 67 groups:

| Surface | Total opps | Won | Conversion | Source |
|---|---|---|---|---|
| **Clients** `ghl_total_opps` | **3,462** | 60 | 1.73% | `ghl_opp_cache.last_7d` — won/lost by `lastStatusChangeAt`, open by `createdAt` |
| **Lead Hub** "Opportunities" | **1,507** | 35 | 2.32% | `ghl_daily_leads.py:76-81` — cohort by `dateAdded`, `lead_type=="lead"`, `$unwind` |
| **Marketing** `ghl_total_opps` | **1,468** | 30 | 2.04% | `opp-rollup` `client_groups.py:2010-2020` — one primary opp per matched contact |

`maximum`: 125,616 vs 97,452. `abandoned` is 45 on the Clients path and **0** on the Lead Hub path at every preset, because `ghl_daily_leads` reads `contact_data.opportunities[].status`, which never carries "abandoned".

### 6. Five Meta endpoints drop the entire final day of the range — HIGH

`routers/meta.py:592, 636, 679, 729, 895` and `routers/client_groups.py:1982` all set `date_filter["$lte"] = end_date` against `lead_data.created_time`, a full ISO timestamp (`'2026-05-25T19:38:41+0000'`). String-comparing `"2026-08-22T10:14:00+0000" <= "2026-08-22"` is **false**.

`get_unified_leads` gets this right (`client_groups.py:2122` appends `T23:59:59.999Z`); these do not.

Measured: `last_7d` → 1,473 returned vs **1,536** correct — **63 leads (4.1%) silently dropped**, identical loss at `last_30d`. Affects the Marketing leads chart, the CPL chart, the Leads tab table, `/api/campaign-insights`, `/api/adset-insights`, `/api/ad-insights` and `opp-rollup`.

> Same bug class as F4 in the MongoDB audit: ISO datetimes stored as strings and range-queried as strings.

### 7. Marketing Hub delta pills compare a partial period against a full one — HIGH

`portfolio-series.js:141-147` maps `this_month → last_month`, `this_quarter → last_quarter`, `this_year → last_year` with no length normalisation (only `last_7d` gets `subtractCurrent`). Today is the 22nd, so "This Month" is 22 days against July's 31.

| Comparison | Current | Previous | Pill shown |
|---|---|---|---|
| this_month vs last_month | £14,295.77 | £26,896.29 | **"Spend ▼ 46.8%"** |
| this_quarter vs last_quarter | £37,058.07 | £68,607.04 | "▼ 46.0%" |
| leads, this_month | 5,018 | 10,518 | "▼ 52.3%" |

Calendar artifacts, not performance. The Lead Hub gets this right — `leadhub-totals.js:99-116` shifts the window by its own span.

### 8. Lead Hub "Total leads" vs Clients "GHL Leads" — MEDIUM

`last_7d`: Lead Hub **1,504**, Clients **1,996** → −492 (**−24.7%**). `maximum`: 99,533 vs 179,087 (−44.4%).

A definition split, not a counting error: `ghl_daily_leads.py:76` filters `lead_type == "lead"` (1,504 leads + 492 contacts = 1,996, reconciles exactly). The Clients column shows the undifferentiated total. Both are labelled "leads".

### 9. Lead Hub tiles disagree with the Lead Hub table on the same screen — MEDIUM

`maximum`: tiles 99,533 / 79,554 / 97,452; table (`/api/leads/unified`) **100,395 / 79,711 / 98,277**. Δ = 862 / 157 / 825.

**1,019 orphaned contacts** in `ghl_contacts` under `client_group_id = "hello@soupgrowth.com_1775983653"` — a deleted client group. `contacts/page.jsx:90` sends `groups=""` for "all", so `client_groups.py:2114` never applies a group filter and the orphans are counted; the tiles read per-group `ghl_daily_leads`, so they aren't. 862 + 157 = 1,019 exactly. *(Independently verified.)*

### 10. Marketing Hub impressions chart is *always* an estimate — MEDIUM

`useMarketingHubData.js:225` prefers measured impressions "where the backend puts it on the cached row". `meta_daily_spend.py:72` requests `"fields": "spend,date_start"` — impressions are never fetched. **0 of 18,010 cached rows carry the field**, so the measured branch is dead code and the chart always renders a spend-shaped estimate under a real impressions total (58.2M at `maximum`).

### 11. `bucketSeries` shifts every daily bucket for viewers west of UTC — MEDIUM

`portfolio-series.js:66` does `new Date("2026-08-01")` (parsed as **UTC** midnight) then formats with date-fns in **local** time. Verified in Node: `America/New_York → 2026-07-31`, `America/Los_Angeles → 2026-07-31`, `Africa/Cairo → 2026-08-01`.

Every trend chart on all three hubs shifts one day earlier for US viewers; at Weekly/Monthly granularity the 1st of a month lands in the previous month. The KPI tiles beside them use plain string comparison (`saleshub-totals.js:44`, `leadhub-totals.js:60`) and do **not** shift — so tile and chart disagree at every window edge.

### 12. Browser-local `today` vs server-UTC `today` — MEDIUM

`date-utils.js:21` builds the client-side window from the browser's local date; `core/constants.py:100` builds the backend's from `_date.today()` (UTC on Vercel). A viewer at UTC−4 after 20:00, or UTC+3 before 03:00, slices a window offset by a full day from the one the caches were built for.

One day at this volume: **~2,700–3,200 calls (≈20% of a 7-day window's 14,706)**, ~180–240 leads (≈12%), ~£690 spend (≈14%).

### 13. Sales Hub "Transfers" tile is not a transfer count — MEDIUM

`raw_payload.transfer` is `True` on **103,183 of 103,183** HotProspector calls. `hp_service.py:83` therefore makes `transfers ≡ total_calls` at every preset (last_7d 14,706 = 14,706; maximum 103,183 = 103,183). The tile duplicates "Total calls" — and because `saleshub-totals.js:62` reads it from `call_stats` while Total-calls reads `daily_calls`, the two will visibly diverge the moment those caches drift. *(Independently verified.)*

### 14. `client_status` comparison is case-sensitive — MEDIUM

`clients/page.jsx:150, 156, 546, 548` compare `=== "Active"`. Stored values: `Active` x49, `Inactive` x18, **`active` x9**. Those 9 groups (all of `priya@lumenaesthetics.co`, `marcus@harbordigital.io`, `sofia@brightleaf.clinic`) fail the check — excluded from every stat card, counted in the "Inactive" filter badge. Financial impact is currently £0 only because those accounts have no Meta data yet. *(Independently verified.)*

### 15. Sales Hub derives outbound; Clients reads it — MEDIUM (latent)

`saleshub-totals.js:49` computes `outbound = calls − inbound`. `hp_service.py:78-81` counts `call_status == "outbound"` explicitly and puts calls with any other status in neither bucket. They agree **today** (1,044 + 13,662 = 14,706 exactly) only because every current call has a clean direction — `call_logs.direction` already shows 76 `null` rows. Any status drift makes the surfaces disagree with no signal.

### 16. Sales Hub "Leads called" (5,379) vs its own "New leads contacted" chart (1,741) — LOW

`last_7d`: the tile sums `call_stats.leads_with_calls` (distinct leads called *in* the window); the chart tab sums `daily_calls.called` (leads whose *first-ever* call fell in the window). A 3.1x gap between two adjacent controls. Documented in `saleshub-series.js:78-82` but nothing on screen says so.

### 17. Marketing Hub CPL chart line sits well above its headline — LOW

`last_7d`: headline £2.78, chart blended over its own buckets **£3.40** (+22%). `last_30d`: £2.79 vs £3.33. Numerator from `meta_daily_spend` (unconverted, includes today), denominator from `facebook_leads` (missing the final day) — the intersection is 7 of 8 spend-days.

### 18. Marketing "Total leads" vs Clients "Meta Leads" — LOW

`last_7d`: 1,752 (campaign-row sum, `marketing-aggregate.js:76`) vs 1,774 (account `insights.results`, `table-container.jsx:210`). 22 leads (1.3%) sit at account level but on no campaign row. Also: 15 of 67 groups have `insights.results == 0` and fall through to the campaign-sum fallback on the Clients page (`clients/page.jsx:557`) but not on the Marketing Hub.

---

## Suspected but unconfirmed

- **The `call_stats` staleness the redesign was built around.** `saleshub-totals.js:11-19` says the preset cache "can run up to 24h stale", motivating the move of four tiles onto `daily_calls`. Recomputed at `last_7d` / `last_30d` / `maximum`: **Δ calls = 0, Δ inbound = 0, Δ talk ≤ 0.5 min, zero per-group mismatches.** Either the drift was fixed upstream or it only appears mid-refresh-cycle. Confirming needs snapshots hours apart, or the hp-tick cron logs.
- **"Simplea You"** shows preset/daily = 0.405 where the other three USD accounts show 0.743. Either a stale `facebook_cache` for that group or a different FX rate at write time. Needs `facebook_cache.updated_at` and `CurrencyService` rate history.
- **The team's actual browser timezone.** Findings 11 and 12 are proven in code and reproduced in Node, but live magnitude depends on where the browser is. If the team is UTC+ (Cairo), 11 is dormant and 12 only bites before 03:00 local.
- **Duplicate suppression — ruled out.** No duplicates exist: `ghl_contacts` 180,108 / 0 duplicate `contact_id`; `facebook_leads` 36,204 / 0 duplicate `lead_id`; `hotprospector_leads` 54,792 / 1 duplicate group. 32,568 `match_keys` overlap between Meta and HP leads, but no surface unions those collections, so cross-source double-counting is not occurring.
- **`get_unified_leads` opportunity `$unwind`** lacks `preserveNullAndEmptyArrays`, so lead-type contacts with zero opportunities vanish from the denominator. Both tile and table paths do this identically, so it causes no *divergence* — but the published conversion rate is opportunities-based, not leads-based.

---

## Root-cause themes

1. **One payload, four field selections.** All surfaces call `/api/client-groups`, then each picks a different field for the same concept: account `insights.spend` vs summed `campaigns[].spend`; `call_stats.*` vs `daily_calls.*`; `metrics.total_contacts` vs `daily_leads.new_leads`; `ghl_opp_cache` vs unwound `contact_data.opportunities` vs `opp-rollup`. → 1, 5, 8, 13, 15, 18.
2. **Double windowing.** The backend applies `ghl_date_bounds(preset)` in UTC; the hubs re-slice the returned series with `presetToDateRange()` in browser-local time against a *differently defined* window (8-day `last_7d` vs Meta's 7-day). → 1, 11, 12, 17.
3. **Headline and series come from different sources but share one card.** Every Marketing Hub chart takes its `total` from the preset aggregate while plotting a series from a separate collection with different retention, currency handling and date semantics. → 1, 2, 10, 17.
4. **Cross-cutting date-boundary bug.** `$lte: end_date` compared against full ISO timestamps drops the last day in six places. → 6.
5. **Population scoping is inconsistent and unenforced.** `client_status` filtering exists only on the Clients page and is case-sensitive; deleted groups leave orphaned contacts some queries see and others don't; group filters are omitted when "all" is selected. → 3, 9, 14.

---

## Recommended fixes (ordered by value — none implemented)

1. **Give each metric exactly one definition, server-side.** A shared resolver (e.g. `services/metric_orchestrator.py`) returning `{spend, leads, cpl, calls, opportunities, ...}` for a `(group_set, window)`, consumed by all four surfaces. → 1, 2, 5, 8, 13, 15, 18.
2. **Fix `$lte` at all six sites** (`meta.py:592, 636, 679, 729, 895`; `client_groups.py:1982`) to `f"{end_date}T23:59:59.999Z"`, matching `client_groups.py:2122`. One line each. → 6.
3. **Convert `meta_daily_spend` at write time** in `meta_daily_spend.py:97` via the same `CurrencyService` path as `meta_service.py:406`; stamp the row's currency. → 4, and part of 1 and 17.
4. **Stop letting a chart's headline come from a different source than its line.** Either derive the headline from the plotted series, or render an explicit "chart covers *n* of *m* days / measured through *date*" caption. → 1, 2, 17; makes 10 honest.
5. **Fix date bucketing.** Parse `yyyy-MM-dd` as local (`new Date(y, m-1, d)`) in `portfolio-series.js:66`, and send explicit `start_date`/`end_date` from the browser rather than a preset name so client and server agree on "today". → 11, 12.
6. **Normalise population scoping.** Case-insensitive `client_status`, a shared "which groups are in scope" helper used by all four surfaces, always pass the resolved group-id list (never empty-means-all), and clean up the 1,019 orphaned `ghl_contacts`. → 3, 9, 14.
7. **Fix the delta pills** in `portfolio-series.js:141` — replace the preset-pair table with the span-shifting approach already working in `leadhub-totals.js:99`. → 7.
8. **Add `impressions` to `meta_daily_spend.py:72`'s field list** and extend retention past 400 days (or have "maximum" fall back to a coarser series). → 10, and the structural half of 1.
9. **Fix or retire the Transfers tile** — find out why HotProspector reports `transfer: "Yes"` on 100% of calls before showing the number at all. → 13.
10. **Re-test the `call_stats` staleness assumption** before building further on it; the two caches currently agree exactly, so the comment in `saleshub-totals.js:11-19` should be corrected or removed.

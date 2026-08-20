# Backend ask: a call time-series endpoint

For **birdy-backend**. Written from what the Sales Hub needs; the frontend work
is already merged and works without this, badly.

## The problem

The Sales Hub's trend chart plots four call metrics over the selected window.
Nothing the API currently serves has a time dimension in it:

| What exists | Shape | Why it can't feed a chart |
|---|---|---|
| `/api/client-groups` → `hotprospector.call_stats` | One aggregate per client for the whole window | No per-day breakdown — it's a single number |
| `/api/hotprospector/call-center` | Lead rows with `call_logs[]` nested | Has the timestamps, but they arrive wrapped in every lead record |

So the frontend builds the series client-side out of the second one. That means
**paging the entire window's lead records to the browser** — a 45,000-lead window
is ~23 requests carrying names, emails, phones, companies and every nested call
log, to extract nothing but a timestamp, a direction and a duration from each.

It got worse before it got better. The first version fetched one 2,000-row page,
which looked reasonable until you read `src/constants/sales-hub-constants.js`:

> `/api/hotprospector/call-center` sorts leads by lead *creation* date, not by
> call recency, so a small batch can badly undercount real recent calls (most of
> the newest-created leads may have no calls at all in the window).

One page isn't a sample of the window, it's a biased slice of it. Against a
window where 6,879 leads had been called, the chart drew a curve off a third of
the data that wasn't a random third. Fixing it meant fetching *all* of it.

That same constants file already asks for this endpoint, for the Calls tab:

> a correct fix needs a backend aggregation that sorts by call time directly

## What to build

```
GET /api/hotprospector/call-series
```

### Query parameters

| Param | Values | Notes |
|---|---|---|
| `date_preset` | same vocabulary as `/api/client-groups` | Preferred — keeps one date language across the API |
| `start_date`, `end_date` | `yyyy-MM-dd` | Accept as an alternative, as `/api/hotprospector/call-center` already does |
| `granularity` | `day` \| `week` \| `month` | Week starts Monday, matching the dashboard's bucketing |
| `location_id` | GHL location id | Optional. Absent = every client the caller can see |

### Response

```json
{
  "data": [
    {
      "bucket": "2026-08-13",
      "calls": 2431,
      "leads_called": 812,
      "inbound": 187,
      "outbound": 2244,
      "talk_minutes": 1683.5
    }
  ],
  "meta": {
    "granularity": "day",
    "start_date": "2026-08-13",
    "end_date": "2026-08-20",
    "totals": {
      "total_calls": 17093,
      "leads_with_calls": 6879,
      "inbound_count": 1232,
      "outbound_count": 15861,
      "total_talk_min": 12253.4
    }
  }
}
```

`meta.totals` deliberately reuses the field names from
`client_groups[].hotprospector.call_stats`, so the two are obviously the same
quantities.

## The four things that are easy to get wrong

**1. Bucket by call time, not lead creation time.** This is the entire bug being
fixed. A lead created in March and called in August belongs in August's bucket.

**2. `leads_called` counts each lead once, at its *first* call in the window.**
Not once per call. Counting every call makes it a quieter duplicate of `calls`;
counting the first makes it answer its own question — how far through the pool
the dialler has got. In aggregation terms: group by lead, take `min(call_time)`
within the window, then bucket *that*.

**3. Return every bucket in the range, including empty ones.** A day with no
calls should come back as a row of zeros, not be omitted. The frontend draws
four series on one shared x-axis; if inbound silently has fewer buckets than
calls, switching chart tabs redraws the axis under the reader. Emitting zeros
lets the client delete a whole alignment step.

**4. Direction follows the existing rule.** A log counts as outbound when
`call_status == "outbound"` and inbound otherwise — same as the tables do
today. `talk_minutes` is `sum(duration) / 60`, duration being seconds.

## The consistency requirement

`sum(data[].calls)` **must equal** `meta.totals.total_calls`, and that must equal
what `/api/client-groups` reports in `call_stats.total_calls` for the same window
and scope. Same for the other three.

This is the part worth a test. Right now the chart's total and the KPI tile above
it are two independent computations over two different endpoints, and the only
reason they agree is that both are careful. Ideally the series aggregation and
`call_stats` are the *same* pipeline grouped differently, so they cannot drift.

## What it saves

- ~23 requests → 1, on every Sales Hub load with a large window.
- A multi-megabyte transfer of full lead records → a few KB of counts.
- Deletes the paging loop in `src/app/Sales-Hub/useSalesHubSeries.js`, the
  bucketing in `src/lib/saleshub-series.js`, and the shared-axis alignment in it.
- Removes the "counting N of M leads so far" caveat from the chart, because the
  first response is already complete.

## Two other things found while building this

**1. `transfers` is wrong.** `call_stats.transfers` comes back exactly equal to
`total_calls` for every client, on every window, in both local and production:

| Client | `total_calls` | `transfers` |
|---|---|---|
| Aura | 452 | 452 |
| Bbl Body Confidence | 364 | 364 |
| V Rejuvederm Aesthetic Clinic | 143 | 143 |
| Tylaesthetics | 304 | 304 |

The old Sales Hub showed four stat cards and transfers wasn't one of them, so
nothing surfaced it. The redesign's six tiles do. Either the field is being
populated from the wrong source, or a `transfer` flag on the call log isn't being
read. Worth checking before anyone trusts that number.

**2. A flat call feed, sorted by call time.** Separate from the series, the Calls
tab wants individual calls — newest first, paginated. It currently fakes this by
pulling `recentCallsLimit × 20` lead records and flattening them client-side,
which the constants file itself calls "a heuristic band-aid, not a guarantee".
The same aggregation that powers the series could expose the rows.

## Priority

If only one thing gets built: the series endpoint. It is the one the chart is
currently brute-forcing. The `transfers` bug is a small fix but a wrong number on
screen, so it is cheap and worth doing first if it turns out to be a one-liner.

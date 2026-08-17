# Dashboard (Portfolio)

The agency-level view: **across all clients, what is happening and where is the
problem?** Built from the `Birdy — Portfolio Dashboard (variant 3e)` design
handoff.

Route: `/dashboard` — this is the app home screen.

## Layout

```
PortfolioHeader          title · timeframe picker · date range
├── content column       scrolls independently
│   ├── KpiStrip         spend · leads · avg CPL · closed leads
│   ├── TrendChart       switchable metric × timeframe
│   ├── TopClients       leaderboard, rankable by 4 metrics
│   ├── PerformanceFunnel 5 stages + derived diagnostic banner
│   └── CallInsights     6 call-centre aggregates
└── RightRail            Suggestions / Activity, one shared scroll area
```

| Where | What |
|---|---|
| `page.jsx` | Composition and the state the cards share |
| `usePortfolioData.js` | Fetching and shaping from the real endpoints |
| `presentation.js` | Which icon and tone each metric wears |
| `fonts.js` | Poppins + Inter, scoped to this route |
| `src/components/portfolio/` | The data-agnostic component set |
| `useDashboardData.js` | Legacy hook, still used by `clients/[id]` for its activity feed |
| `src/lib/portfolio-aggregate.js` | Client groups → KPIs, funnel, leaderboards (pure) |
| `src/lib/portfolio-series.js` | Bucketing and previous-period mapping (pure) |
| `src/lib/portfolio-chart.js` | Chart geometry (pure) |
| `src/lib/portfolio-metrics.js` | Delta polarity and funnel diagnosis (pure) |

## State

| State | Default | Drives |
|---|---|---|
| `preset` | `last_7d` | The window **every** figure covers — lives in the top bar |
| `granularity` | `Daily` | How finely the chart buckets that window — lives in the top bar |
| `chartMetric` | `leads` | Which series is plotted |
| `topMetric` | first available | Leaderboard ranking |
| `panel` | `suggestions` | Which rail panel renders — Suggestions or Activity |

The handoff blurred these first two into one "timeframe" control. They are
different questions — which window, and how finely to slice it — so they are
two controls here.

The **title block** sits in the top bar too, standing in for the Birdy wordmark
while you are on this route — the page carries no heading of its own. Only the
page knows the client count, so it publishes that up through the same context
rather than the header fetching the portfolio a second time.

Both controls sit in the **global top bar**, beside the notifications bell and profile
menu, not on the page. That puts them and the page that obeys them in different
parts of the tree, so their state lives in `DashboardControlsProvider`
(`src/components/dashboard-controls.jsx`), which `src/app/layout.jsx` wraps the
shell in. `DashboardHeaderControls` renders on `/dashboard` only — no other
route has anything for them to filter. Tests render the page inside that
provider with the controls above it, because rendering the page alone would not
exercise the wiring at all.

The chart replays its draw animation by being keyed on
`metric + granularity + preset`, so a switch remounts the paths and the CSS
animations restart.

## Where the data comes from

Everything is real, from endpoints that already existed:

| Endpoint | Feeds |
|---|---|
| `/api/client-groups?date_preset=` | KPIs, leaderboards, funnel, call insights |
| `/api/client-groups?date_preset=<previous>` | The delta pills |
| `/api/facebook-leads/filtered` | The leads, spend and closes series, and the funnel's attribution |
| `/api/hotprospector/call-center` | The calls series — fetched only when that tab is opened |
| `/api/dashboard/summary` | Suggestions and activity |
| `/api/dashboard/suggestions/:id/apply` `DELETE :id` | Do it / Dismiss |

Field paths mirror what `components/ui/table-container.jsx` already reads, so
this screen and the clients table can't drift into disagreeing about what
"leads" means. Lead counts follow the same ladder it uses — `results`, then
summed campaign results, then `total_leads` — because older cached insights
only carry the last one, and skipping the ladder makes whole clients read as
zero-lead.

### The date range

`useClientGroups` takes its preset as an **initial** value — it holds the window
in its own state and expects callers to move it with the `setDatePreset` it
returns. Passing a new preset on re-render does nothing. `usePortfolioData`
therefore pushes the change in explicitly and holds `loading` until the groups
match the window that was asked for, so the screen never shows one window's
figures under another window's label.

Everything except the right rail follows the date range. Suggestions, wins and
activity come from `/api/dashboard/summary`, which takes no date parameters —
they describe what needs attention now rather than what happened in a window.

### The chart's four series, and which are measured

| Tab | Shape | Total |
|---|---|---|
| Leads | counted from lead rows | exact |
| Ad spend | **borrowed from lead volume** | exact |
| Calls | counted from call logs | exact |
| Closes | shaped from won lead rows, totalled from GHL `won` | exact |

Every total is exact. Three things about the shapes are worth knowing.

**The chart plots every bucket in the range.** It used to keep only the most
recent 31, which meant Daily granularity drew a 31-day window whatever preset
you picked — "all time" quietly rendered as "the last month", and so did this
year, this quarter and last quarter. `bucketSeries` now returns the whole range
and thins the *axis labels* to `MAX_LABELS` instead, blanking the rest so each
printed date still sits under its own point. Tooltips stay complete.

**The row endpoints cap what they return** — 5,000 leads, 2,000 call-centre
leads — so those series are samples of their window. A series built straight
from one undercounts and sits beneath a headline total that does not: a chart
reading 120,531 above a curve summing to 5,000. `scaleSeriesToTotal` multiplies
every bucket by one factor so the curve sums to the real total: shape from the
sample, magnitude from the uncapped figure.

That cap has a second effect worth knowing on long ranges: the leads endpoint
sorts newest-first, so once a range holds more than 5,000 leads the rows *only
cover the recent end of it* and the earlier buckets are missing rather than
merely scaled. Scaling fixes the magnitude, not the span. The fix is a
server-side series: a `$group` on `lead_data.created_time` returning per-bucket
counts, which has no cap and a far smaller payload than the rows do.

**Ad spend has no shape of its own.** Meta reports spend already totalled for
the whole date preset — there is no daily breakdown in the payload and no
endpoint that returns one. The curve is the real total spread across days in
proportion to that day's leads, which assumes CPL held steady. On a day of heavy
spend and few leads it will understate, and that is exactly the case a media
buyer cares about, so the card says `spread across days by lead share` under
the total rather than letting the line read as measured. Making it real is a
backend change: request `time_increment=1` from Meta's Insights API and cache
the daily rows.

Call logs are fetched lazily, only once the Calls tab is opened — a second
heavyweight request most visits never need. A change of date range drops what
was held rather than showing one window's calls under another's.

### The funnel is a cohort, and that is the whole point

Every stage counts the **same people**: the contacts whose `dateAdded` falls in
the selected window. Each stage shows its share of that cohort, and Closes'
share *is* the close rate — the number this card exists to show.

| Stage | Of the window's contacts... |
|---|---|
| Leads | all of them |
| In CRM | ...those an opportunity was opened for |
| Called | ...those HotProspector logged a call to |
| Closes | ...those with an opportunity since won |

`Leads ⊇ In CRM ⊇ Closes` always holds, which is what makes closes/leads a rate
you can act on. Called is a subset of Leads but measured beside In CRM rather
than under it, because a lead can be dialled without anyone opening an
opportunity for them.

**The backend does the cohort work.** `compute_cohort_funnel` in birdy-backend
buckets a group's contacts into all 13 presets on the GHL refresh and stores
them at `ghl_funnel_cache.<preset>`; `/api/client-groups` serves the requested
preset as `gohighlevel.metrics.funnel`. Answering it per request meant scanning
`ghl_contacts` on every dashboard load, which was this cluster's largest source
of collection scans.

**Recent windows under-report.** A cohort keeps closing after its window ends,
so "last 7 days" describes leads that have had a week to convert and will show
a lower close rate than "last month". That is cohort reporting working, not a
data fault — compare like windows.

**A missing preset renders nothing, not zeroes.** `buildFunnel` returns `[]`
when no client has a cached cohort, because four zeroes read as "a portfolio
with no leads" — a different claim from "not computed yet". The backend
deliberately does *not* fall back to the lifetime figure here, unlike the opp
and call caches: that silent fallback is exactly how an earlier funnel ended up
showing all-time call counts beside a windowed lead count.

**Why not portfolio totals.** An earlier version counted each stage from a
different cache — `total_contacts`, `opportunity_stats.open`,
`call_stats.leads_with_calls` — and the stages could not nest, because each
integration windows on a different event. `opportunity_stats` in particular
counts *activity* in the window (`lastStatusChangeAt`), so dividing its wins by
this window's new contacts compared two different populations and produced a
close rate that meant nothing.

`diagnoseFunnel` still ignores stages with no delta rather than reading the
absence as zero, so a preset without a previous period cannot let an
information-free stage win "strongest stage" or mask a decline elsewhere.

### Deltas

`/api/client-groups` only speaks in date presets, so a previous period has to
be expressible as one. Where a natural predecessor exists (`this_month` →
`last_month`) it is fetched directly. Where only a longer window exists,
`last_7d` is compared against `last_14d` **minus** the current week — every
figure summed here is additive, so that subtraction is exact rather than an
estimate.

Presets with no expressible predecessor (`last_30d`, `maximum`, `last_14d`,
`this_week_mon_today`) get **no delta pills at all** rather than invented ones.
The same applies when a previous period was zero: something out of nothing has
no meaningful percentage, and "+100%" on a client's first week of spend would
be worse than silence.

### What the design asks for that the data cannot give

Both are absent rather than approximated:

* **A "Shows" funnel stage.** GoHighLevel opportunity stats carry
  won/lost/open/abandoned and nothing about attendance.

Two call metrics also moved to what exists: "Speed to lead" became talk time
(no first-touch timestamp is available), and "Unique answer rate" became answer
rate, since `call_stats` counts answered calls rather than answered leads.

## Things worth knowing

**Delta polarity.** Most metrics are better when they rise, but average CPL
and calls per close are better when they *fall*, and calls per lead is worse
when it rises. `deltaTone(direction, polarity)` is the single place that
resolves this — getting it backwards inverts the meaning of a whole card.

**Chart geometry.** Points are centred over their axis label rather than spread
edge to edge, and the area closes to the baseline at the first and last *data
points* rather than the frame edges. Both are easy to get wrong and both are
visible when you do.

**The diagnostic banner is derived, not copy.** `diagnoseFunnel` finds the worst
stage falling by more than 1% and, when the stage feeding it is rising,
contrasts the two — that contrast is what says the problem is one step rather
than lead flow. Below the threshold it names the strongest stage instead.

## What this screen replaced

It took over `/dashboard` from a page that listed Birdy suggestions, triggered
alerts and client wins as tabs, with an activity feed beside them. Of those:

* **Suggestions** and **activity** are the right rail, on the same endpoints.
* **Client wins** are not shown. They briefly had a third rail panel, which was
  removed — three tabs did not fit a 340px rail without abbreviating
  "Suggestions". `usePortfolioData` still maps `wins` off the summary response
  and `WinCard` / `completeWinRequest` still exist, so restoring the panel is a
  few lines; nothing currently renders them.
* **Triggered alerts** are not carried over — `/alerts` already lists them, and
  the old tab was a second view of the same store.
* **Suggestion strictness** (the `PUT /api/dashboard/settings` control) has no
  home yet. It is a preference rather than a portfolio figure, so `/settings` is
  the natural place, but that move is not made here.

`useDashboardData.js` stays because `clients/[id]` imports it for its own
activity feed.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **No frame, no page header bar.** The design's 1600×1040 card had a canvas
   background inside a bordered box. That canvas is now the whole app's
   background (`body` in `globals.css`, plus `SidebarInset`), so the box has
   nothing left to delimit — cards and rails read as raised surfaces on every
   route, not just this one. The title survives as an ordinary page heading.
2. **No icon rail, no header avatar.** `AppSidebar` and `UserMenu` already
   render both globally from `src/app/layout.jsx`. Duplicating them would put
   two nav systems on one screen. The design's frame — canvas, border, radius,
   independently scrolling columns — is kept.
3. **The chart's total-row delta is coloured by direction.** The handoff
   hardcodes it green, which misreads daily leads, weekly spend and daily calls,
   all of which fell.
4. **"Unique answer rate" uses a phone-call icon.** The design draws a phone
   crossed with an ×, which is lucide's `phone-missed` and reads as the opposite
   of the metric. The handoff's own icon table calls that slot "phone-answer".
5. **The header has two controls, not one.** The handoff's single "timeframe"
   picker conflated the window with the granularity; the API separates them, so
   the header does too.
6. **Menus and segmented controls are keyboard-operable.** The prototype closed
   menus only on selection; the handoff asks for outside-click and Escape in
   production, and this adds roving focus, arrow keys and focus return on top.
7. **Chart points are buttons.** The tooltip was the only reading of an
   individual period and hover-only put it out of reach of keyboard users.

## Tests

```bash
npx vitest run src/app/dashboard src/lib/__tests__
```

84 tests. The pure modules are covered directly — chart geometry, delta
polarity, funnel diagnosis, the aggregation ladder and its divide-by-zero
guards, bucketing, and the previous-period arithmetic.

`__tests__/page.test.jsx` runs the screen against mocked endpoints returning
real-shaped client groups, and asserts the things a wrong number would break:
the roll-up totals, CPL derived from summed spend over summed leads rather than
an average of averages, delta pills appearing on a comparable preset and
vanishing on one without, the series bucketing by day and by month, ascending
CPL ranking against descending everything else, auto-run separated from
approved in the feed, and a failed apply putting the card back.

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
| `preset` | `last_7d` | The window **every** figure covers |
| `granularity` | `Daily` | How finely the chart buckets that window |
| `chartMetric` | `leads` | Which series is plotted |
| `topMetric` | first available | Leaderboard ranking |
| `panel` | `suggestions` | Which rail panel renders — Suggestions, Wins or Activity |

The handoff blurred these first two into one "timeframe" control. They are
different questions — which window, and how finely to slice it — so they are
two controls here.

The chart replays its draw animation by being keyed on
`metric + granularity + preset`, so a switch remounts the paths and the CSS
animations restart.

## Where the data comes from

Everything is real, from endpoints that already existed:

| Endpoint | Feeds |
|---|---|
| `/api/client-groups?date_preset=` | KPIs, leaderboards, funnel, call insights |
| `/api/client-groups?date_preset=<previous>` | The delta pills |
| `/api/facebook-leads/filtered` | The trend series (leads and closes) |
| `/api/dashboard/summary` | Suggestions and activity |
| `/api/dashboard/suggestions/:id/apply` `DELETE :id` | Do it / Dismiss |
| `/api/dashboard/wins/:id/complete` | Mark a win done |

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

### The funnel, and why it is only three stages

A funnel's whole claim is that each stage is a **subset** of the one above it.
Portfolio totals cannot deliver that, because each integration counts a
different population:

* GoHighLevel's `total_contacts` is every contact a client has — organic
  enquiries, referrals, manual imports, everyone from before Meta was connected
  — and unlike the Meta cache it is not read through a date preset. An earlier
  version used it for "In CRM" and duly showed *more* people in the CRM than
  there were leads.
* HotProspector's `leads_with_calls` counts whoever is in the dialler, with no
  link back to which Meta lead they were.

So every stage now comes from `/api/facebook-leads/filtered`, which returns
individual Meta leads carrying `ghl_matched` and `ghl_opportunity_status`:

| Stage | Source |
|---|---|
| Leads | Meta insights lead total for the window |
| In CRM | share of sampled leads with `ghl_matched` |
| Closes | share of sampled leads whose opportunity is `won` |

"Called" is gone — its figures still appear in the Call insights card, where
they are not pretending to be a funnel stage.

**The rows are a sample.** The fetch is capped at `LEADS_FETCH_LIMIT` (5,000),
so a raw count would top out at the cap rather than describing the portfolio.
The sample supplies the *rate* and the true lead total supplies the
*magnitude*. When the cap is hit the scaled stages are marked estimated and
render with a `≈`, because an estimate should not wear the same exactness as a
counted figure.

**Attributed stages carry no delta.** They are derived from one window's rows
and there is no previous-window fetch to compare against, so only Leads has a
movement. `diagnoseFunnel` ignores stages with no delta rather than reading the
absence as zero — otherwise a stage with no information could win "strongest
stage", or mask a real decline elsewhere.

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

* **A spend-over-time curve.** Meta insights arrive pre-aggregated per date
  preset; nothing breaks spend down by day. Spend is a KPI here, not a chart
  metric, so the chart offers Leads and Closes only.
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
* **Client wins** are a third rail panel. They had no home outside the page this
  replaced, so they moved rather than disappearing with it.
* **Triggered alerts** are not carried over — `/alerts` already lists them, and
  the old tab was a second view of the same store.
* **Suggestion strictness** (the `PUT /api/dashboard/settings` control) has no
  home yet. It is a preference rather than a portfolio figure, so `/settings` is
  the natural place, but that move is not made here.

`useDashboardData.js` stays because `clients/[id]` imports it for its own
activity feed.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **No icon rail, no header avatar.** `AppSidebar` and `UserMenu` already
   render both globally from `src/app/layout.jsx`. Duplicating them would put
   two nav systems on one screen. The design's frame — canvas, border, radius,
   independently scrolling columns — is kept.
2. **The chart's total-row delta is coloured by direction.** The handoff
   hardcodes it green, which misreads daily leads, weekly spend and daily calls,
   all of which fell.
3. **"Unique answer rate" uses a phone-call icon.** The design draws a phone
   crossed with an ×, which is lucide's `phone-missed` and reads as the opposite
   of the metric. The handoff's own icon table calls that slot "phone-answer".
4. **The header has two controls, not one.** The handoff's single "timeframe"
   picker conflated the window with the granularity; the API separates them, so
   the header does too.
5. **Menus and segmented controls are keyboard-operable.** The prototype closed
   menus only on selection; the handoff asks for outside-click and Escape in
   production, and this adds roving focus, arrow keys and focus return on top.
6. **Chart points are buttons.** The tooltip was the only reading of an
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

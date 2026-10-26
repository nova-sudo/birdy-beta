# Dashboard (Portfolio)

The agency-level view: **across all clients, what is happening and where is the
problem?** Hub layout option A of the Bytes design-system migration
(`design_handoff_hubs/design_handoff_bytes_ds/hub-options.html`), built from
`@/components/ds`.

Route: `/dashboard` — this is the app home screen.

## Layout

```
PageHeader            greeting · one-sentence summary · period (Today / 7 days / 30 days / More)
MetricTabsChart       Leads · Closes · Cost per lead (inverted delta) · Ad spend
grid 1.35fr / 1fr     Breakdown "By client"  |  BirdyRead
```

Below `lg` the grid is a single `grid-cols-1` column.

| Where | What |
|---|---|
| `page.jsx` | Composition and the state the page shares (chart metric, optimistic suggestion removal) |
| `PeriodControl.jsx` | `SegmentedTabs` quick picks plus a "More" `DropdownMenu` of every other `DATE_PRESETS` entry |
| `usePortfolioData.js` | Fetching and shaping from the real endpoints |
| `presentation.js` | Wording and shaping into ds props: greeting, summary sentence, `toFindings`, client breakdown, cost-per-lead series |
| `useDashboardData.js` | Legacy hook, still used by `clients/[id]` for its activity feed |
| `src/components/dashboard-controls.jsx` | The date range, held above the page so it survives navigation |
| `src/lib/portfolio-aggregate.js` | Client groups → KPIs, funnel, per-client rows (pure) |
| `src/lib/portfolio-series.js` | Bucketing and previous-period mapping (pure) |
| `src/lib/portfolio-metrics.js` | Delta polarity and funnel diagnosis (pure) |

## State

| State | Default | What it does |
|---|---|---|
| `preset` (context) | `last_7d` | Which window every figure covers |
| `chartMetric` | `leads` | Which tab is selected; every tab's figure is always shown |
| `removed` | `{}` | Suggestions acted on or dismissed, optimistic and rolled back on failure |

The chart is bucketed daily (there is no granularity control). A window that
yields a single bucket (Today) shows the figures and the message "Pick 7 days
or longer to see a trend."

The page publishes only its title ("Dashboard") to the top bar; the period
control is in the page header so it never crowds the bar at 390px.

## Where the data comes from

| Endpoint | Feeds |
|---|---|
| `/api/client-groups?date_preset=` | Metric figures, by-client rows, funnel (for the diagnosis) |
| `/api/client-groups?date_preset=<previous>` | The deltas |
| `/api/facebook-leads/series` | The leads and closes series (cost per lead is spend ÷ leads per bucket) |
| `/api/dashboard/summary` | Suggestions (and activity / wins, fetched but not shown) |
| `/api/dashboard/suggestions/:id/apply`, `DELETE :id` | Do it / Dismiss |

Deltas appear only for presets whose previous period is expressible as another
preset (`PREVIOUS_PERIOD`). Elsewhere they are absent, and so is the
"on the previous period" clause in the summary.

## Birdy's read

`toFindings(briefing, suggestions, handlers)` merges the funnel diagnosis
(only with a comparison, and with the Called stage blanked where no client has
a call centre) and the pending suggestions into at most five rows, worst tone
first. Suggestions carry "Do it" and a dismiss button; the diagnosis carries
neither.

Dropped from the old page, per option A: the KPI strip, top-clients
leaderboard, funnel panel, call-insights card, the Activity feed and the Calls
chart tab. The data for activity and wins is still fetched.

## Tests

```bash
npx vitest run src/app/dashboard
```

`__tests__/presentation.test.js` covers the pure helpers. `__tests__/page.test.jsx`
runs the page against mocked endpoints with real-shaped client groups: header,
summary, the four tabs and their delta colours, the period control and its
More menu, the by-client shares, apply / dismiss and their rollback, a neutral
server-rendered greeting, and the loading, empty, error and plot states.

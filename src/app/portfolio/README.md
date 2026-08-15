# Portfolio Dashboard

The agency-level view: **across all clients, what is happening and where is the
problem?** Built from the `Birdy — Portfolio Dashboard (variant 3e)` design
handoff.

Route: `/portfolio`.

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
| `usePortfolioData.js` | Fetching, optimistic actions, the backend contract |
| `fixtures.js` | The handoff's figures, in the payload's shape |
| `fonts.js` | Poppins + Inter, scoped to this route |
| `src/components/portfolio/` | The cards and the two shared controls |
| `src/lib/portfolio-chart.js` | Chart geometry (pure) |
| `src/lib/portfolio-metrics.js` | Delta polarity and funnel diagnosis (pure) |
| `src/lib/portfolio-view.js` | Payload → render shapes (pure) |

## State

Five pieces, all on the page:

| State | Default | Drives |
|---|---|---|
| `timeframe` | `Monthly` | KPI strip **and** chart together |
| `chartMetric` | `leads` | Chart series, title, total |
| `topMetric` | first in payload | Leaderboard ranking |
| `panel` | `suggestions` | Which rail panel renders |
| `hoveredIndex` | `null` | Chart tooltip (local to `TrendChart`) |

The chart replays its draw animation by being keyed on `metric + timeframe`, so
a switch remounts the paths and the CSS animations restart.

## Backend contract

```
GET    /api/portfolio/summary
POST   /api/portfolio/suggestions/:id/apply
DELETE /api/portfolio/suggestions/:id
```

The summary returns **every timeframe in one payload**. Switching
Daily/Weekly/Monthly is a redraw the user expects to be instant, and a round trip
per switch would put a spinner in the middle of the one interaction this screen
is built around. The full shape is documented at the top of `usePortfolioData.js`.

### When the endpoint isn't live

* **Development** — falls back to `fixtures.js` behind a visible banner saying
  so, and actions skip the request rather than rolling back.
* **Production** — shows a distinct "data isn't available" state. It never
  renders placeholder numbers, matching the rule `useDashboardData` already
  holds on the homepage. That matters more here than anywhere: an agency owner
  would otherwise be reading named clients and spend figures that are not
  theirs. "Isn't available" is also a different claim from "you have no
  clients", so the two are not collapsed into one empty state.

## Things worth knowing

**Delta polarity.** Most metrics are better when they rise, but average CPL,
speed to lead and calls per close are better when they *fall*, and calls per lead
is worse when it rises. `deltaTone(direction, polarity)` is the single place that
resolves this — getting it backwards inverts the meaning of a whole card.

**Chart geometry.** Points are centred over their axis label rather than spread
edge to edge, and the area closes to the baseline at the first and last *data
points* rather than the frame edges. Both are easy to get wrong and both are
visible when you do.

**The diagnostic banner is derived, not copy.** `diagnoseFunnel` finds the worst
stage falling by more than 1% and, when the stage feeding it is rising,
contrasts the two — that contrast is what says the problem is one step rather
than lead flow. Below the threshold it names the strongest stage instead.

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
4. **Menus and segmented controls are keyboard-operable.** The prototype closed
   menus only on selection; the handoff asks for outside-click and Escape in
   production, and this adds roving focus, arrow keys and focus return on top.
5. **Chart points are buttons.** The tooltip was the only reading of an
   individual period and hover-only put it out of reach of keyboard users.

## Tests

```bash
npx vitest run src/app/portfolio src/lib/__tests__
```

The pure modules are tested directly — chart geometry, delta polarity, funnel
diagnosis, payload shaping. `__tests__/page.test.jsx` covers the interactions:
timeframe switching moving every figure at once, inverted CPL colouring,
leaderboard re-ranking, rail panel swapping, and apply/dismiss.

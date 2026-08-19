# Sales Hub

Call-centre performance across every Hot Prospector client: **is the outreach
happening, and is it working?** Built from the `Sales Hub` design handoff in
`design_handoff_hubs/`.

Route: `/Sales-Hub`.

## Layout

```
SalesHubShell            title · date range · client picker
├── chart + insights row
│   ├── TrendChart       flex 1.65 — 4 call metrics
│   └── right column     flex 0.85
│       ├── InsightCard  generated per period
│       └── KpiTiles     6 compact tiles
└── CallCentreContent    section tabs · search/columns · table
```

| Where | What |
|---|---|
| `page.jsx` | Composition, and the window/scope state the controls hold |
| `useSalesHubData.js` | Fetching and shaping from the real endpoints |
| `presentation.js` | Which icon and tone each tile wears |
| `src/lib/saleshub-series.js` | The four series, from call logs (pure) |
| `src/lib/saleshub-insight.js` | The insight copy (pure) |
| `src/components/saleshub/` | Shell, picker, insight card, tiles |
| `src/components/portfolio/` | TrendChart, PdSegmented, StatTile, reused |

## State

| State | Default | Drives |
|---|---|---|
| `datePreset` | `last_7d` | The window **every** figure covers |
| `selectedClientGroup` | `all` | Which client is in scope |
| `chartMetric` | `calls` | Which series is plotted |
| `activeTab` | `overview` | Which table renders |

The first two live on the page rather than in the table, because the design puts
both in the header row above everything they filter, and the table stopped being
the only thing that reads them. `CallCentreContent` takes the selection as a
controlled prop with an internal fallback, so `/clients/[id]` — which renders it
scoped to one client and never moves it — is unaffected.

## Where the data comes from

| Endpoint | Feeds |
|---|---|
| `/api/client-groups?date_preset=` | Tile totals, chart totals, table rows |
| `/api/client-groups?date_preset=<previous>` | The delta pills |
| `/api/hotprospector/call-center` | The shape of all four series |
| `/api/hotprospector/members/dashboard` | The Members tab |

### Totals and shapes come from different places, deliberately

Call stats on the client groups are aggregates the backend computed over the
whole window, so they are **exact**. The rows endpoint caps what it returns, so
the rows are a **sample**. A curve built straight from a capped sample
undercounts and sits directly beneath a headline figure that does not.
`scaleSeriesToTotal` takes the shape from the sample and the magnitude from the
total, and the chart prints "shape estimated from a sample of calls" when it had
to — a sample should not read as a census.

### The four series share one axis

Every metric here is a different reading of the same call logs, so all four come
from one fetch. Two things about them are worth knowing:

**Leads called counts each lead once, at its first call in the window.** Counting
every call would make it a quieter copy of Total calls rather than an answer to
its own question — how far through the pool the dialler has got.

**All four are drawn on the Total calls axis.** `bucketSeries` builds buckets
from the data it is given, which is right for one series and wrong for four:
inbound calls happen on fewer days than calls do, so inbound came back with fewer
points and its own dates, and switching tabs silently redrew the x-axis. Every
entry in all four is a call log, so Total calls is a superset and the rest align
to it. A day with no inbound calls reads as the zero it is.

### Granularity picks itself

There is no granularity control — the design has none. The window chooses:
daily up to a month, weekly to four, monthly beyond. The design's fixed twelve
months would plot a single point for "today".

### Deltas

`/api/client-groups` only speaks in date presets, so a previous period has to be
expressible as one. `PREVIOUS_PERIOD` maps the five that can be; the rest get
**no pills at all** rather than invented ones, and the insight card falls back to
describing the window in absolute terms. Where only a longer window exists
(`last_7d` against `last_14d`), the current one is subtracted out of it — every
figure summed here is additive, so that subtraction is exact.

Every metric on this screen is a volume, so none of them inverts. The Marketing
Hub's CPL is the sibling screen's counter-example, and `DeltaPill` already takes
a polarity for exactly that reason.

### The insight card is generated, not written

It names the biggest movement, then the single most actionable anomaly — the
client sitting on the largest pool of leads nobody has dialled. That anomaly is
ranked by the **size** of the pool rather than the share called: a client sitting
on 977 uncalled leads is a bigger miss than one sitting on 228. It also needs no
previous period, so it survives on the windows that have none.

The card stays quiet rather than reaching: no inbound clause for a pure outbound
portfolio, no untouched-pool sentence for a client already mostly worked, and no
invented "but" when every metric moved the same way.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **No frame, no icon rail, no header bar.** `AppSidebar` and `src/app/layout.jsx`
   already render the rail, the Ask Birdy field, the notification bell and the
   avatar globally. Rebuilding them would put two nav systems and two search
   fields on one screen. The Portfolio Dashboard made the same call for the same
   reason. The title survives as an ordinary page heading.
2. **A client picker in the header.** The design's header carries only a date
   range. This is Birdy's own and it stays — the hub is an all-clients view whose
   first move is usually "which client is this?".
3. **The window picks its own granularity**, rather than always drawing twelve
   months.
4. **Deltas are absent rather than assumed** on windows with no comparable
   previous period, including the chart's total-row delta, which the prototype
   hardcodes.
5. **Menus close on outside click and Escape**, and the segmented controls are
   keyboard-operable with roving focus. The prototype closed only on selection.
6. **One table panel is mounted at a time.** Radix's `Tabs` mounted all four and
   hid three, and three of them own a fetch — a visit that never left Overview
   still pulled the Leads tab's first batch.

## Shared with `/clients/[id]`

`CallCentreContent` is rendered by that page's Call Centre tab too, with
`showGroupFilter={false}`, so it shows only Leads and Calls. It inherits this
redesign's section tabs, toolbar chips and one-panel-at-a-time behaviour, which
is the intended direction — one component, one look. It keeps the four stat cards
the hub turned off (`showStatCards`), because it has no other call KPIs.

## Tests

```bash
npx vitest run src/app/Sales-Hub src/lib/__tests__
```

The pure modules are covered directly: the series arithmetic and its shared axis,
the capped-sample scaling, granularity selection, and every branch of the insight
copy. `__tests__/page.test.jsx` runs the screen against mocked endpoints.

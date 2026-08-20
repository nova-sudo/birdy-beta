# Sales Hub

Call-centre performance across every Hot Prospector client: **is the outreach
happening, and is it working?** Built from the `Sales Hub` design handoff in
`design_handoff_hubs/`.

Route: `/Sales-Hub`.

## Layout

```
global top bar           Sales Hub · date range · client picker · bell · profile
SalesHubShell            canvas + one scroll region
├── chart + insights row
│   ├── TrendChart       flex 1.65 — 4 call metrics
│   └── right column     flex 0.85
│       ├── InsightCard  the window's figures, stated
│       └── KpiTiles     6 compact tiles
└── CallCentreContent    section tabs · search/columns · table
```

| Where | What |
|---|---|
| `page.jsx` | Composition, and the window/scope state the controls hold |
| `useSalesHubSeries.js` | The chart's series, counted from call logs |
| `presentation.js` | Which icon and tone each tile wears |
| `src/lib/saleshub-series.js` | Bucketing the four metrics (pure) |
| `src/lib/saleshub-totals.js` | Summing the call stats (pure) |
| `src/lib/saleshub-insight.js` | The insight copy (pure) |
| `src/components/saleshub/` | Shell, picker, insight card, tiles |
| `src/components/portfolio/` | `StatTile`, `PdSegmented`, reused |

## State

| State | Default | Drives |
|---|---|---|
| `datePreset` | `last_7d` | The window **every** figure covers |
| `selectedClientGroup` | `all` | Which client is in scope |
| `chartMetric` | `calls` | Which series is plotted |
| `activeTab` | `overview` | Which table renders |

The first two live on the page rather than in the table, because the design puts
both in the header row above everything they filter, and the table stopped being
the only thing that reads them. The page then *publishes* its title and those
two controls into the global top bar (`src/components/page-header.jsx`), which
is where the design draws them — in place of the Birdy wordmark, beside the bell
and profile menu. What is published are React nodes, so the controls stay part
of this page's tree and keep closing over its state; nothing is lifted into a
provider to be filtered by. `CallCentreContent` takes the selection as a
controlled prop with an internal fallback, so `/clients/[id]` — which renders it
scoped to one client and never moves it — is unaffected.

## Where the data comes from

Two sources, and the difference between them is the thing to understand.

| Reads | Feeds |
|---|---|
| `clientGroups[].hotprospector.call_stats` | The six tiles and the insight card |
| `/api/hotprospector/call-center` | The trend chart's four series |

**The tiles and the card derive nothing.** `sumCallStats` adds up what
`/api/client-groups` sent for the one preset that was asked for; `formatTotal`
decides only how a number is printed. Talk time keeps its decimal, because the
table has always shown `251.7` rather than `252` and a tile above it reading
differently would invite the reader to work out which one is lying.

**The chart cannot work that way.** Those call stats are per-client aggregates
for the whole window — exact, but with no time dimension in them — so there is
nothing in them to plot. A curve has to be counted from the call logs
themselves, which is what `/api/hotprospector/call-center` returns nested inside
its lead rows.

Everything plotted is a straight count of those logs. Nothing is scaled onto
another figure and no previous period is fetched, so the chart carries no delta.

### It pages through the whole window, and it has to

`src/constants/sales-hub-constants.js` records that this endpoint orders leads by
lead **creation** date rather than call recency. That makes one page not a sample
of the window but a biased slice of it — most of the newest-created leads may
have no calls in the period at all. An earlier version fetched a single 2,000-row
page against a window where 6,879 leads had been called, and drew a curve off a
third of the data that was not a random third.

So `useSalesHubSeries` fetches every page: a small first one so a curve appears
quickly, then the rest behind it in batches of 2,000, six at a time, with
`meta.total` saying when it is done. Rows accumulate as pages land and the series
rebuilds on each, so the chart fills in rather than blocking. While that is
happening it prints "counting N of M leads so far"; once complete, the note goes
and the plotted total is the window's real count.

**There is no ceiling on the page count.** An earlier version capped at 40 pages,
which stopped dead on 40,500 leads and drew a curve that quietly omitted
everything past it — a partial count with nothing on screen saying which calls
were missing. A slow chart is better than a wrong one.

The cost is real: a window holding 45,000 leads is 23 requests carrying every
lead record, when all the chart wants is call timestamps. The right fix is a
backend aggregation returning per-bucket counts — `src/constants/sales-hub-constants.js`
asks for the same thing for the Calls tab, for the same reason.

The chart's headline figure is the sum of what it drew, so the curve and the
number above it always agree.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **The chart plots what was counted, not a scaled sample.** It pages the whole
   window to do that, and says so while pages are still arriving. See above.
2. **No delta pills, anywhere**, including the chart's total-row delta, which
   the prototype hardcodes. A period-over-period figure means fetching and
   assembling a second window; every number here belongs to the one window that
   was asked for.
3. **No frame, no icon rail, no header bar.** `AppSidebar` and
   `src/app/layout.jsx` already render the rail, the Ask Birdy field, the
   notification bell and the avatar globally. Rebuilding them would put two nav
   systems and two search fields on one screen. The Portfolio Dashboard made the
   same call for the same reason. The title survives as an ordinary page
   heading.
4. **A client picker in the header.** The design's header carries only a date
   range. This is Birdy's own and it stays — the hub is an all-clients view
   whose first move is usually "which client is this?".
5. **The table keeps its existing design.** `StyledTable` renders as it does on
   every other screen; the handoff's table chrome is not applied.
6. **Menus close on outside click and Escape**, and the segmented controls are
   keyboard-operable with roving focus. The prototype closed only on selection.
7. **One table panel is mounted at a time.** Radix's `Tabs` mounted all four and
   hid three, and three of them own a fetch — a visit that never left Overview
   still pulled the Leads tab's first batch.

## Shared with `/clients/[id]`

`CallCentreContent` is rendered by that page's Call Centre tab too, with
`showGroupFilter={false}`, so it shows only Leads and Calls. It inherits this
redesign's section tabs, toolbar chips and one-panel-at-a-time behaviour, which
is the intended direction — one component, one look. It keeps the four stat
cards the hub turned off (`showStatCards`), because it has no other call KPIs.

## Tests

```bash
npx vitest run src/app/Sales-Hub src/lib/__tests__
```

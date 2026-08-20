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

Two sources, both precomputed server-side — neither fetches per-lead rows.

| Reads | Feeds |
|---|---|
| `clientGroups[].hotprospector.call_stats` | The six tiles and the insight card |
| `clientGroups[].hotprospector.daily_calls` | The trend chart's four series |

**The tiles and the card derive nothing.** `sumCallStats` adds up what
`/api/client-groups` sent for the one preset that was asked for; `formatTotal`
decides only how a number is printed. Talk time keeps its decimal, because the
table has always shown `251.7` rather than `252` and a tile above it reading
differently would invite the reader to work out which one is lying.

**Neither does the chart, any more.** It used to page the whole call-log
history through `/api/hotprospector/call-center` on every load and bucket it
into days client-side — that endpoint orders leads by *creation* date rather
than call recency, so one page was a biased slice of the window rather than a
sample of it, and a correct curve needed every page fetched. A window holding
45,000 leads meant 23 requests carrying every lead record, when the chart only
ever wanted four numbers a day.

`birdy-backend`'s `hp_service._compute_daily_call_series` now derives that
same per-day breakdown once, server-side, from the calls it already loads to
refresh the Overview tiles — no extra API call. `/api/client-groups` serves it
whole, same shape as Meta's `daily_spend` and GHL's `daily_leads`:
`mergeDailyCalls` (`saleshub-totals.js`) sums it across whichever clients are
in scope, and `useSalesHubSeries` slices it to the selected window and hands
it to `buildSalesSeries` (`saleshub-series.js`) to bucket by day/week/month.
Nothing is scaled onto another figure and no previous period is fetched, so
the chart still carries no delta — and the headline figure is still the sum
of what it drew, so curve and number always agree.

**"Leads called" is a lifetime cohort, not a window-relative one.** Each lead
is counted once, on the day of their *first-ever* call — not their first call
within whatever window happens to be selected. A lead first contacted before
the window started therefore reads as zero for that window even if they were
called again inside it. The old paginated version got this exactly right for
any window, because it only ever fetched calls inside that window in the first
place; this trades that precision for not fetching per-call data at all. Same
tradeoff GHL's cohort funnel already accepts (see `compute_cohort_funnel`'s
"recent end under-reports" note) — worth knowing if the number looks low for a
short window on a client with older history.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **"Leads called" is a lifetime-cohort count, not a scaled sample.** See
   above for the tradeoff that accepts.
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

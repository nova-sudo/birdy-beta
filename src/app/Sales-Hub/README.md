# Sales Hub

Call-centre performance across every Hot Prospector client: **is the outreach
happening, and is it working?** Built from the `Sales Hub` design handoff in
`design_handoff_hubs/`.

Route: `/Sales-Hub`.

## Layout

```
global top bar           page name · bell · profile
PageHeader               Sales Hub · period · granularity · client picker
├── hero row               CallCentreOverview
│   ├── MetricTabsChart    the five figures as tabs; the selected one is plotted
│   └── BirdyRead          Birdy's read: one sentence + up to five findings
└── CallCentreContent    ds Tabs · search/columns/filters · ds DataTable (25 a page)
    ├── CallLogsDialog       a lead's calls (Leads tab)
    ├── MemberAnalyzeDialog  three-step batch analysis (Members tab)
    └── CallAnalysisSheet    single-call analysis, right Sheet (Calls tab)
```

| Where | What |
|---|---|
| `page.jsx` | Composition, and the window/scope state the controls hold |
| `useSalesHubSeries.js` | The chart's series, counted from call logs |
| `presentation.js` | Which series each figure plots |
| `src/lib/saleshub-series.js` | Bucketing the five plottable metrics (pure) |
| `src/lib/saleshub-totals.js` | Summing the call stats (pure) |
| `src/lib/saleshub-insight.js` | The briefing sentence and findings (pure) |
| `src/components/saleshub/` | The hero row |
| `src/components/callcenter/` | The tables, dialogs and sheet |
| `src/components/ds/` | `MetricTabsChart`, `BirdyRead`, `DataTable`, `Sparkline` |

## State

| State | Default | Drives |
|---|---|---|
| `datePreset` | `last_7d` | The window **every** figure covers |
| `selectedClientGroup` | `all` | Which client is in scope |
| `activeTab` (hero) | `calls` | Which figure is selected, and so which series is plotted |
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

Two sources, both precomputed server-side — neither fetches per-lead rows —
and which figures come from which is deliberate:

| Reads | Feeds |
|---|---|
| `clientGroups[].hotprospector.call_stats` | Leads called + Transfers figures, the Overview table's Leads/Transfers columns |
| `clientGroups[].hotprospector.daily_calls` | Total calls / Inbound / Outbound / Talk time figures, the briefing, the Overview table's matching columns and sparklines, and the chart's five series |

**Total calls / Inbound / Outbound / Talk time used to read `call_stats` too**,
same as Leads called and Transfers still do. Investigated 2026-08-20 after the
figures and the chart disagreed on Total calls for the same window: re-deriving
`daily_calls` fresh didn't close the gap, which ruled out a timing fluke.
`call_stats` only gets recomputed by the once-a-day `hp-tick` cron pass per
location, so it can run up to 24h stale against what's actually in storage;
`daily_calls` reflects current storage on every refresh. `sumCallStats` and
`CallCentreContent`'s Overview rows (`windowCallTotals`, `saleshub-totals.js`)
now sum the same daily series the chart draws for those four figures, so the
figures, the table and the curve read off one cadence instead of two — and get
the fresher number in the process. Outbound isn't tracked per day separately;
it's `calls - inbound` off the same rows.

**Leads called and Transfers stay on `call_stats`, unchanged, on purpose.**
"Leads called" there means "distinct leads with any call in the window" —
`daily_calls.called` answers a different question (see below) and summing it
would just be a smaller, more confusing tile. Transfers is HP's own upstream
field already effectively equal to Total calls on their side (see the
Transfers card investigation), so there's no separate version of it in
`daily_calls` to switch to either way.

**Nothing here fetches, still.** `sumCallStats` and `windowCallTotals` sum
what `/api/client-groups` already sent; `formatTotal` decides only how a
number is printed. Talk time keeps its decimal, because the table has always
shown `251.7` rather than `252` and a tile above it reading differently would
invite the reader to work out which one is lying.

**The chart doesn't fetch either.** It used to page the whole call-log
history through `/api/hotprospector/call-center` on every load and bucket it
into days client-side — that endpoint orders leads by *creation* date rather
than call recency, so one page was a biased slice of the window rather than a
sample of it, and a correct curve needed every page fetched. A window holding
45,000 leads meant 23 requests carrying every lead record, when the chart only
ever wanted four numbers a day.

`birdy-backend`'s `hp_service._compute_daily_call_series` now derives that
same per-day breakdown once, server-side, from the calls it already loads to
refresh the Overview figures — no extra API call. `/api/client-groups` serves it
whole, same shape as Meta's `daily_spend` and GHL's `daily_leads`:
`mergeDailyCalls` (`saleshub-totals.js`) sums it across whichever clients are
in scope, and `useSalesHubSeries` slices it to the selected window and hands
it to `buildSalesSeries` (`saleshub-series.js`) to bucket by day/week/month.
Nothing is scaled onto another figure and no previous period is fetched, so
the chart still carries no delta — and the headline figure is still the sum
of what it drew, so curve and number always agree.

**The curve under the "Leads called" figure is a lifetime cohort ("New
leads contacted"), not a window-relative count — and the plot header says so,
with a "Plotted: N" note beside it, for exactly that reason.** Each lead is counted once, on the day of their
*first-ever* call — not their first call within whatever window happens to be
selected. A lead first contacted before the window started therefore reads as
zero for that window even if they were called again inside it. The old
paginated version got this exactly right for any window, because it only ever
fetched calls inside that window in the first place; this trades that
precision for not fetching per-call data at all. Same tradeoff GHL's cohort
funnel already accepts (see `compute_cohort_funnel`'s "recent end
under-reports" note) — worth knowing if the number looks low for a short
window on a client with older history. The figure in the tab is the
window's distinct leads called; the curve beneath it is titled by what it
actually counts, and its own sum is printed, so the two never read as one
figure disagreeing with itself.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **The "Leads called" figure's curve is a lifetime-cohort count ("New
   leads contacted"), not a scaled sample, and the plot header says so.** See
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
5. **Tables are the ds `DataTable`.** Client-side paging at 25 rows (50 on
   request), so a Leads table of thousands of rows renders one page at a time.
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

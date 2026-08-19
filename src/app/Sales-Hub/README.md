# Sales Hub

Call-centre performance across every Hot Prospector client: **is the outreach
happening, and is it working?** Built from the `Sales Hub` design handoff in
`design_handoff_hubs/`.

Route: `/Sales-Hub`.

## Layout

```
SalesHubShell            title · date range · client picker
├── InsightCard          the window's figures, stated
├── KpiTiles             6 compact tiles
└── CallCentreContent    section tabs · search/columns · table
```

| Where | What |
|---|---|
| `page.jsx` | Composition, and the window/scope state the controls hold |
| `presentation.js` | Which icon and tone each tile wears |
| `src/lib/saleshub-totals.js` | Summing the call stats (pure) |
| `src/lib/saleshub-insight.js` | The insight copy (pure) |
| `src/components/saleshub/` | Shell, picker, insight card, tiles |
| `src/components/portfolio/` | `StatTile`, `PdSegmented`, reused |

## State

| State | Default | Drives |
|---|---|---|
| `datePreset` | `last_7d` | The window **every** figure covers |
| `selectedClientGroup` | `all` | Which client is in scope |
| `activeTab` | `overview` | Which table renders |

The first two live on the page rather than in the table, because the design puts
both in the header row above everything they filter, and the table stopped being
the only thing that reads them. `CallCentreContent` takes the selection as a
controlled prop with an internal fallback, so `/clients/[id]` — which renders it
scoped to one client and never moves it — is unaffected.

## Where the data comes from

**This screen fetches nothing of its own.** Every figure above the table is
summed from the client groups the page already holds — the windowed call stats
`/api/client-groups` returns for the selected preset — and shown as returned.

| Reads | Feeds |
|---|---|
| `clientGroups[].hotprospector.call_stats` | The six tiles and the insight card |

Nothing is derived, scaled, estimated, bucketed or compared against another
window. `sumCallStats` adds up what the API sent for the one preset that was
asked for; `formatTotal` decides only how a number is printed. Talk time keeps
its decimal, because the table has always shown `251.7` rather than `252` and a
tile above it reading differently would invite the reader to work out which one
is lying.

The tables below keep their own existing behaviour and endpoints — `Overview`
off the same client groups, `Leads`, `Members` and `Calls` off the HotProspector
endpoints `CallCentreContent` has always called.

### The insight card restates, it does not conclude

The design asks it to name the biggest movement and then the most actionable
anomaly. Both are derived claims — one needs a second window, the other a
ranking across clients — so neither is drawn. The card reports the same figures
the tiles beside it report.

It still declines to pad: no inbound clause for a pure-outbound portfolio, no
"across 1 client" when the view is already scoped to one, and a plain statement
of fact when no calls were logged at all.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **No trend chart.** The design plots four call metrics over the window. This
   app has no call time-series — building one meant pulling call logs and
   bucketing them into a curve, which is derived data by definition. The tiles
   carry the same four figures as totals.
2. **No delta pills, anywhere.** A period-over-period figure means fetching and
   assembling a second window. Every number here is the one window that was
   asked for.
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
npx vitest run src/app/Sales-Hub src/lib/__tests__/saleshub-insight.test.js
```

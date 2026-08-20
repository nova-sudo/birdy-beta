# Lead Hub

`/contacts`, rebuilt to `design_handoff_hubs/Lead Hub.dc.html` on Birdy's real
data.

> **On the committed bundle.** `design_handoff_hubs/` holds the Lead Hub target,
> the Marketing Hub target, the shared style guide, and one handoff README per
> screen. Dropped from the delivered archive: `support.js`, the prototype
> runtime its own README says not to port, and a mascot PNG the app already
> ships as `public/birdy-mascot-VmH3J7Wq.png`. The style guide in the Lead Hub
> archive is byte-identical to the one already committed for the Marketing Hub,
> so it is not duplicated.

This screen answers: **across every client group, who are our leads and
contacts, and is lead quality holding up?**

## What it reuses

The Portfolio Dashboard and the Marketing Hub were built from this same handoff
bundle, so most of the design system is already implemented:

- Every colour, shadow and radius is a `--pd-*` token in `globals.css`.
- `src/components/portfolio/` holds the components built to these specs —
  `TrendChart`, `StatTile`, `InsightCard`, `PdCard`, `PdSegmented`, `DeltaPill`,
  `LoadingPulse`.
- `src/lib/portfolio-*.js` holds the chart geometry, series bucketing and delta
  polarity.

The handoff calls Lead Hub, Sales Hub and Marketing Hub siblings that "share
their shell, header, chart, insight card and tile anatomy", so this screen wires
those to lead data rather than reimplementing the specs. What was genuinely new:

| Added | Where |
|---|---|
| Five table greys — field, soft divider, table head, row zebra, input border | `globals.css` |
| Lead arithmetic, window comparison, insight copy | `lib/lead-hub-aggregate.js` |
| Fetching and shaping | `components/contacts/useLeadHubData.js` |

The handoff also draws a 68px icon rail and a 64px header with bell and avatar.
`src/app/layout.jsx` already renders all of it globally, so — as both sibling
screens did — only the title block and the two filter chips are published up
into it, through `useHeaderSlot`. Rebuilding the rail would produce two
sidebars.

## Layout

```
top bar (global)         Lead Hub · date range · client group
├── hero row
│   ├── TrendChart       leads · contacts · open · conversion       flex 1.65
│   └── right column                                                flex 0.85
│       ├── InsightCard  Birdy's reading of the period
│       └── 6 StatTile   in a 1fr 1fr grid, so the column matches the chart
├── PdSegmented          five pipeline stages, each with its count
│   └── search · Filters · Columns
└── StyledTable          the lead rows, paged
```

| Where | What |
|---|---|
| `components/contacts/LeadsContent.jsx` | Composition, the table's own query, and the state the cards share |
| `components/contacts/useLeadHubData.js` | The hero's fetching and shaping |
| `lib/lead-hub-aggregate.js` | Window comparison, KPIs, pipeline tabs, insight copy (all pure) |
| `lib/contact-columns.js` | The table's column set |

`LeadsContent` is also embedded in `clients/[id]` with `showHeader={false}`.
That copy publishes nothing into the top bar, so it cannot claim it from the
route that owns it.

## Where the figures come from

Everything on the hero row is real.

| Element | Source |
|---|---|
| Six KPI tiles | `meta.stats` from `GET /api/leads/unified` over the window |
| Delta pills | the same call over the window `previousWindow` names |
| Four chart curves | every row in the window from the same endpoint, bucketed by `dateAdded` |
| Pipeline tab counts | the same `meta.stats` |
| Insight copy | the largest KPI movement, plus the client group with the most records carrying no email |
| Table rows | `GET /api/leads/unified`, paged, filtered by the open stage tab |

### The hero describes the period; the table describes the tab

The table's query carries the pipeline-stage filter. **The hero's does not.**

Reading the tiles off the table's response would make "Total leads" mean "total
won leads" the moment you opened the Won tab — a different figure wearing the
same label — and would leave all five tab badges showing whichever tab was open.
So the hero runs its own pair of calls, asking for a single row each:
`meta.stats` aggregates the window rather than the page, so a page of one
carries the same figures as a page of fifteen.

Both still follow the date range and the client group, because those narrow what
the *period* is rather than which slice of it you are reading.

### Deltas reach further here than on the sibling screens

`/api/client-groups` speaks only in date presets, so the Portfolio Dashboard and
the Marketing Hub can only compare a window against another window that happens
to have a preset name — and several have none, which is why those screens drop
the pills entirely on `last_30d` and `maximum`.

`/api/leads/unified` takes explicit dates, so `previousWindow` can name the exact
comparison for every dated preset:

| Window | Compared against |
|---|---|
| Rolling — today, yesterday, last 7/14/30 days | the equal-length window ending the day before it starts |
| Part-finished — week / month / quarter / year to date | the same **opening stretch** of the unit before |
| Whole — last month, last quarter, last year | the whole unit before |
| Maximum | nothing — no pills at all |

The opening-stretch case matters. Month-to-date on the 9th covers nine days;
comparing it against the *tail* of last month would put a quiet start of month
beside a busy end of month and read the difference as a change in performance.

### The chart's four curves, and what is measured

There is no per-day endpoint for GHL contacts. The shapes are bucketed from the
window's rows — all of them; one bucket set carries all four weightings, which is
what lets the won and lead counts be divided index by index for the conversion
curve.

| Tab | Total | Curve |
|---|---|---|
| Leads | exact, from `meta.stats` | counted from every row in the window |
| Contacts | exact | counted from every row in the window |
| Open | exact | counted from every row in the window |
| Conversion | exact | won ÷ leads per bucket |

Every figure on this card is counted. Nothing is estimated.

**The whole window is read, a page at a time.** The first attempt asked for
2,000 rows in a single call and came back empty: this endpoint serves the table
at a page size of 15, and nothing documents what it does with a limit two orders
of magnitude past that — reject it, clamp it, or serve it. Paging at
`LEAD_SERIES_PAGE_SIZE`, a size it is already known to accept, removes the
guess. Page one goes on its own because its `meta.total_pages` says how many
there are; the rest are fetched `LEAD_SERIES_CONCURRENCY` at a time.

Both halves of that matter. Walking the pages one after another turned a slow
window into a minute of loading pulse — a screen that hangs tells you less than
a screen that says it has nothing. Firing all of them at once would put hundreds
of requests in flight on a long range. The pool is what keeps a complete read
from becoming either.

**Nothing is sampled and nothing is scaled.** An earlier version took the first
N rows and scaled their shape onto the real total. That fixed the magnitude but
not the span: this endpoint sorts newest-first, so a truncated read covers the
recent end of the window and leaves the earlier buckets *missing* rather than
merely short — a curve describing a fortnight while claiming to describe a
quarter. Reading the whole window is the only version of this chart whose shape
is a fact.

The one case that still needs saying is a read that came up short because a page
failed. The curve is then genuinely under the total above it, so `TrendChart`
prints a note; a chart that under-draws in silence is worse than one that admits
it.

The conversion curve is derived from the same rows on the same buckets, so its
numerator and denominator always describe one population.

**Granularity is derived rather than picked.** The Portfolio Dashboard makes it a
control because the window and the slicing are separate questions there. Here the
header already carries the handoff's two chips and draws no third, so the window
chooses — daily up to a month, weekly for a quarter, monthly for a year and for
all time. A week of daily points is a curve; a year of them is a smear.

### The insight is derived, not copy

Two sentences, both from figures already on the screen.

The **headline movement** pairs lead volume with the conversion rate and joins
them with "but" when they disagree — volume rising while the rate falls is the
period worth reading, and the whole reason both are on the card. With no
comparable window it states the position instead of inventing a move.

The **anomaly** is the client group with the most records carrying no email,
which is the design's own example and the right one: such a record can be called
but not emailed, making it the cheapest untouched pool an agency has, and it is
nearly always one client's form dropping the field rather than a spread across
all of them. GHL writes a synthetic `no_email_` address where none was captured,
so those count as missing — the table's Email column already treats them that
way. Below `LEAD_POOL_FLOOR` nothing is named. The count is exact, since it is
read off the same complete set of rows the curves are; it only becomes a floor —
and the sentence only says "at least" — where a page failed to load.

## Things worth knowing

**Delta polarity.** Two of the six tiles are inverted: lost leads rising is bad
news and renders red with an **up** arrow, and a conversion rate falling is bad
news and renders red with a **down** arrow. `deltaTone(direction, polarity)`
resolves this in one place — the tiles name a polarity rather than picking a
colour. Getting it backwards inverts the meaning of the tile.

**Rates move in points.** 3.0% → 2.6% is a fall of 0.4pts. Reporting it as
-13.3% is true of the ratio and reads as though the rate itself were 13%.

**Absence is not zero.** Three separate places turn on this: a metric with no
comparable period renders with no pill, a pipeline stage the payload does not
carry renders with no badge, and a window with no dated rows renders an empty
state rather than a flat line.

**And absence is not failure.** The chart's empty state distinguishes three
things that once shared one sentence: no GoHighLevel connection at all, a row
request that failed, and a window that genuinely holds nothing. Collapsing them
is what let a rejected request sit on the card reading as a fact about the
business — which is exactly how the 2,000-row limit went unnoticed.

**The server-side series is still the right fix.** Reading a long window costs
one request per hundred rows, and none of that work is anything the database
could not do in one pass: a `$group` on `ghl_contacts.dateAdded` returning
per-bucket counts has no paging, no concurrency pool, and a payload measured in
bytes rather than megabytes. The Portfolio Dashboard's leads curve wants the
same endpoint.

**The pipeline tabs are a radiogroup, not a tablist.** There are no panels — the
table sits outside the tab row and re-queries when the stage changes — so what is
left is a choice between five values. `PdSegmented` also has the badge slot the
Radix trigger lacks, and gives the group one tab stop with arrow keys between the
options instead of five separate ones.

## Deviations from the handoff

These are deliberate. Everything else matches the design's tokens.

1. **No frame, no icon rail, no header bell or avatar.** `AppSidebar` and
   `UserMenu` already render globally from `src/app/layout.jsx`, and the canvas
   background is the whole app's. Duplicating them would put two nav systems on
   one screen.
2. **The conversion tile wears a percent sign, not a downward arrow.** The design
   draws trending-down because its sample period fell; an icon that states the
   direction misreads every period that rises. The amber chip is the design's.
3. **Granularity is derived from the window** rather than fixed at the design's
   twelve monthly points, which were placeholder data.
4. **`TrendChart` renders the total alone when no delta exists.** The prototype
   always draws an arrow; an arrow with nothing beside it is a direction the data
   never supplied. This also fixes the Marketing Hub's Impressions tab on
   `maximum`.
5. **Abandoned takes amber.** The design's status list covers Open, Won and Lost
   only; GHL has a fourth stage and it takes the amber this system already uses
   for it.

## Not done

**The table is still on the app's shared chrome.** The design specs it as a 16px
card with a `#FAFAFC` header row, `#FCFCFD`/white zebra striping, ten named
columns, a row-select checkbox, a sort indicator on `DATE ADDED`, and an explicit
muted placeholder in every empty cell — an en dash for missing text, an em dash
for a missing status or value. That last point is the substantive one: roughly a
third of the rows are contacts rather than leads, and the design has to look
correct with that many blanks.

None of it is built. `StyledTable` is shared with the Marketing Hub, the Sales
Hub and the clients table, so restyling it in place would move every table in the
app; an opt-in variant is the shape the change wants. The column set in
`lib/contact-columns.js` is this screen's alone and could be restyled without
affecting anything else.

Also unwired, as in the prototype: row-select bulk actions, column sorting from
the header, row click through to a lead detail screen, and "Ask Birdy about
this".

## Tests

```bash
npx vitest run src/lib/__tests__/lead-hub-aggregate.test.js
```

31 tests, all against the pure module: the four shapes of window comparison,
delta polarity on the two inverted metrics, points-vs-percent on the rate,
nullable stage counts, the unreachable-pool floor and GHL's synthetic addresses,
and each branch of the insight copy.

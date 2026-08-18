# Marketing Hub

`/campaigns`, rebuilt to `design_handoff_hubs/Marketing Hub.dc.html` on Birdy's
real data.

## What it reuses

The Portfolio Dashboard was built from this same handoff bundle, so the design
system in `Birdy Style Guide.md` is already implemented:

- Every colour, shadow and radius is a `--pd-*` token in `globals.css`.
- `src/components/portfolio/` holds the components built to these specs —
  `TrendChart`, `StatTile`, `PdCard`, `PdSegmented`, `DeltaPill`, `LoadingPulse`.
- `src/lib/portfolio-*.js` holds the chart geometry, series bucketing and
  delta polarity.

The Marketing Hub is the Sales Hub's sibling — the handoff asks for them to be
*"one component with two data configurations"* — so it wires those to marketing
data rather than reimplementing the specs. What was genuinely new:

| Added | Where |
|---|---|
| Birdy Insights card (the one saturated surface) | `components/portfolio/InsightCard.jsx` |
| Single-row compact KPI tile | `layout="compact"` in `StatTile.jsx` |
| Marketing arithmetic | `lib/marketing-aggregate.js` |
| Fetching + shaping | `components/campaigns/useMarketingHubData.js` |

The handoff also draws a 68px icon rail and a 64px header with bell and avatar.
`src/app/layout.jsx` already renders all of it globally, so — as the Portfolio
Dashboard did — only the title block is added here. Rebuilding the rail would
produce two sidebars.

## Where the figures come from

Everything on the hero row is real.

The KPI tiles, the insight card and the table all read **the same campaign
rows**, so they cannot disagree and the client-group picker filters them at
once. The hero deliberately ignores the drill-down: it describes the account for
the period, while the table below is whatever you have drilled into.

| Element | Source |
|---|---|
| Spend curve | `group.facebook.daily_spend` — measured, `time_increment=1` |
| Leads curve | `GET /api/facebook-leads/series` |
| CPL curve | spend ÷ leads, bucketed over the days that have **both** |
| Impressions curve | measured where the daily rows carry `impressions`; otherwise the shape of daily spend scaled to the real total, and labelled as an estimate |
| Six KPI tiles | the campaign rows for the selected group |
| Delta pills | `GET /api/client-groups?date_preset=<previous>` via `PREVIOUS_PERIOD` |
| Insight copy | the largest KPI movement + the highest-CPL campaign over the ceiling |

Three things worth knowing before reading a number off this screen:

**The Impressions curve is an estimate today, and says so on the card.** It
resolves in two steps:

1. **Measured**, where the cached daily rows carry `impressions`. Meta's
   `time_increment=1` breakdown does return it alongside spend, so the moment
   the backend puts it on the row this curve becomes identical in kind to the
   spend curve, with no frontend change.
2. **Otherwise the shape of daily spend**, scaled so the buckets sum to the
   period's real impression total, and flagged `estimated` so `TrendChart`
   prints *"daily shape follows ad spend — Meta caches no impression
   breakdown"* under the headline figure.

The backend does not currently send the field, so step 2 is what renders.

Two things make step 2 defensible rather than a fabrication. The **magnitude is
measured** — the line is anchored to the real period total, so only the
distribution is inferred; without that anchor it would be spend wearing an
impressions label. And the inference is **declared on the card**, not buried
here. Impressions and spend move together within an account at a roughly steady
CPM, which makes spend the closest honest proxy for *when* delivery happened.

This is the same mechanism the Portfolio Dashboard's calls series uses, and the
reason `estimated`/`estimateNote` exist on `TrendChart` at all.

What it is **not** derived from is lead volume. Spreading impressions in
proportion to leads would inherit every gap in lead capture — the reasoning that
once drew £2,554 of spend for a day that actually cost £718, and why spend is
measured today rather than inferred.

`mergeDailyMetrics` counts `impressionDays` separately from the impression total
so the chart can tell **a day that served nothing** (a row reporting `0`, which
plots) from **a day nothing cached** (a row with no `impressions` field, which
does not). Plotting the second as zero would draw a trough that never happened.

**Getting to a fully measured curve** is one backend change: add `impressions`
to the `meta_daily_spend` rows served as `facebook.daily_spend`.

**CPL is only plotted where both inputs exist.** A day present in the spend
cache but missing from the lead series (or the reverse) is a gap in a cache, not
a day that cost nothing — dividing across it would draw a reading that never
happened.

**Delta pills are absent, not zero, on most presets.** `/api/client-groups`
only speaks in presets, so a previous period has to be expressible as one.
`today`, `last_7d`, `this_month`, `this_quarter` and `this_year` have one;
`last_30d` and `maximum` do not, and render without pills.

## The CPL threshold

The handoff renders four of fourteen CPL cells in red and lists *"the CPL
threshold per client/campaign"* as data needed. **No such field exists** — not
in Meta's payload, not on the client group.

Rather than leave the column uncoloured or hard-code a pound figure that would
be wrong for every client at a different budget, the ceiling is **relative to the
selection's own blended CPL**: a campaign is red when it costs more than
`CPL_CEILING_MULTIPLE` (2×) what the rest of the account pays for the same lead,
and only once it has spent at least `CPL_JUDGEMENT_FLOOR` (£20) — one lead on £8
of spend is an £8 CPL that means nothing yet.

2× is what the handoff's own sample implies: blended £3.00, and the red rows
start at £6.58. When a real per-client threshold lands, `CPL_CEILING_MULTIPLE`
is the only line that changes.

## Inverted metrics

CPL is `LOWER_IS_BETTER`: a rise renders **red with an up arrow**, in the tile,
in the chart's headline delta, and as the red cell in the table. Spend, leads,
impressions and CTR are the opposite. `deltaTone(direction, polarity)` is the
one place this is decided — never colour by arrow direction.

CTR moves in **points**, not percent. A rise from 3.6% to 3.9% is `▲ 0.3pts`; a
percentage change of a percentage would read as though the rate were 8%.

## Still to do

**The table is not restyled.** The design asks for zebra rows, a `#FAFAFC`
header and the Inter type scale. `StyledTable` (`components/ui/table-container.jsx`)
is shared by the clients page, leads and Sales Hub with its styling hard-coded
and no variant prop, so restyling it in place would change every table in the
app — well beyond this page. The right move is an opt-in `variant="pd"` on
`StyledTable`, as its own change.

What the table already does correctly, and did before this work: sort by spend
descending with a `↓` indicator, the per-row status toggle wired to
`POST /api/facebook/update-status` with optimistic rollback, row-select
checkboxes, and `–` in Social Spend (never populated, exactly as the design
draws it).

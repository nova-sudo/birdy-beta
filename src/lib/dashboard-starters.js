import { createId } from "dashkit/core"

// ─── One-click starters and the "Add widget" ops ────────────────────────────
// An empty dashboard offers a default board and three single-widget starters,
// each already bound to real numbers. Both helpers return dashkit (v3) ops for
// ONE applyAll batch, so a starter (or a picked widget) is one undo step, and
// the ids are chosen here so the caller can select the new widget in the same
// go. Each widget carries its query on `addWidget`.
//
// Metric, dimension and window keys are the backend catalog's
// (services/dashboards_catalog.py): spend, meta_leads, clicks, ctr,
// impressions, cpl, ghl_won_opps; by client; last_7d and last_30d.

const LAST_30D = { preset: "last_30d" }
const metrics = (...keys) => keys.map((metric) => ({ metric }))

// The KPI row: each tile shows its change, which needs the previous period.
const KPI_ROW = {
  type: "kpi-strip",
  query: { metrics: metrics("spend", "meta_leads", "clicks", "ctr"), window: LAST_30D, compare: "previous" },
}
const SPEND_TREND = {
  type: "trend",
  title: "Spend by day",
  query: { metrics: metrics("spend"), over: "day", window: LAST_30D },
}

const DEFINITIONS = {
  // The default board: two rows of half-width pairs under the KPI row.
  "overview-board": {
    label: "Overview board: KPIs, trend, funnel, leaderboard and table (last 30 days)",
    icon: "layout-dashboard",
    widgets: [
      KPI_ROW,
      SPEND_TREND,
      {
        type: "funnel",
        title: "Impressions to won opps",
        query: {
          metrics: [
            { metric: "impressions", label: "Impressions" },
            { metric: "clicks", label: "Clicks" },
            { metric: "meta_leads", label: "Leads" },
            { metric: "ghl_won_opps", label: "Won opps" },
          ],
          window: LAST_30D,
        },
      },
      {
        // Ranked by spend (the first metric); the change column needs the previous period.
        type: "leaderboard",
        title: "Top clients by spend",
        query: { metrics: metrics("spend", "meta_leads"), by: "client", window: LAST_30D, compare: "previous" },
      },
      {
        type: "table",
        title: "Clients",
        size: { w: 6, h: 6 },
        query: { metrics: metrics("spend", "meta_leads", "cpl"), by: "client", window: LAST_30D },
      },
    ],
  },
  "kpi-strip-30d": {
    label: "KPI strip of spend, leads, clicks and CTR (last 30 days)",
    icon: "rows-3",
    widgets: [KPI_ROW],
  },
  "spend-trend-30d": {
    label: "Spend trend by day (last 30 days)",
    icon: "trending-up",
    widgets: [SPEND_TREND],
  },
  "spend-by-client-table-7d": {
    label: "Spend by client table (last 7 days)",
    icon: "table",
    widgets: [
      {
        type: "table",
        title: "Spend by client",
        query: { metrics: metrics("spend"), by: "client", window: { preset: "last_7d" } },
      },
    ],
  },
}

/** The starters, in the order the empty state shows them. */
export const STARTERS = Object.entries(DEFINITIONS).map(([kind, { label, icon }]) => ({ kind, label, icon }))

/**
 * Where a widget added from outside the editor goes: `after` the doc's last
 * widget in reading order (to its right when it fits, else on the row below),
 * so it lands at the end of the dashboard. Only the first widget under a
 * heading names the heading; later ones chain to the widget before them.
 * Docs are stored sorted by row then column, so the last widget is the last
 * one read. `null` for an empty doc.
 */
function lastWidgetId(doc) {
  return doc.widgets.at(-1)?.id ?? null
}

/**
 * The ops for one starter, as one batch: on an empty dashboard a level-1
 * heading first (its page title: dashkit renders no title of its own), then
 * each widget, with its query, placed `after` the one before it.
 *
 * @param {keyof typeof DEFINITIONS} kind
 * @param {object} doc the dashboard it is for (dashkit v3)
 * @returns {object[]} dashkit ops
 */
export function starterOps(kind, doc) {
  const def = Object.hasOwn(DEFINITIONS, kind) ? DEFINITIONS[kind] : null
  if (!def) throw new Error(`Unknown dashboard starter "${kind}"`)
  const ops = []
  let after = lastWidgetId(doc)
  if (!after) {
    after = createId()
    ops.push({ op: "addWidget", widget: { id: after, type: "heading", title: doc.title || "Overview", data: { level: 1 } } })
  }
  for (const { type, title, size, query } of def.widgets) {
    const widget = { type, id: createId() }
    if (title) widget.title = title
    if (size) widget.size = size
    widget.query = structuredClone(query)
    ops.push({ op: "addWidget", after, widget })
    after = widget.id
  }
  return ops
}

/**
 * The ops for adding one widget of `type` from outside the editor: at the
 * end of the dashboard (after its last widget), or at the top of an empty one.
 *
 * @returns {{ ops: object[], widgetId: string }}
 */
export function addWidgetOps(doc, type) {
  const widgetId = createId()
  const widget = { type, id: widgetId }
  const after = lastWidgetId(doc)
  return { ops: [after ? { op: "addWidget", after, widget } : { op: "addWidget", widget }], widgetId }
}

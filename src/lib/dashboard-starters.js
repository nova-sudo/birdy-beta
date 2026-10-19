import { createId } from "dashkit/core"

// ─── One-click starters and the "Add widget" ops ────────────────────────────
// An empty dashboard offers three starters, each a widget already bound to
// real numbers. Both helpers return dashkit (v2) ops for ONE applyAll batch,
// so a starter (or a picked widget) is one undo step, and the ids are chosen
// here so the caller can bind or select the new widget in the same go.
//
// Metric, dimension and window keys are the backend catalog's
// (services/dashboards_catalog.py): spend, meta_leads, clicks, ctr; by client
// or day; last_7d and last_30d.

const inWindow = (preset) => ({ preset })

const DEFINITIONS = {
  "kpi-strip-30d": {
    label: "KPI strip of spend, leads, clicks and CTR (last 30 days)",
    icon: "rows-3",
    type: "kpi-strip",
    // The strip shows each metric's change (showDelta is on by default),
    // which needs the previous period resolved alongside.
    bindings: {
      a: { metric: "spend", window: inWindow("last_30d"), compare: "previous" },
      b: { metric: "meta_leads", window: inWindow("last_30d"), compare: "previous" },
      c: { metric: "clicks", window: inWindow("last_30d"), compare: "previous" },
      d: { metric: "ctr", window: inWindow("last_30d"), compare: "previous" },
    },
  },
  "spend-trend-30d": {
    label: "Spend trend by day (last 30 days)",
    icon: "trending-up",
    type: "trend",
    title: "Spend by day",
    bindings: { series: { metric: "spend", by: "day", window: inWindow("last_30d") } },
  },
  "spend-by-client-table-7d": {
    label: "Spend by client table (last 7 days)",
    icon: "table",
    type: "table",
    title: "Spend by client",
    bindings: { rows: { metric: "spend", by: "client", window: inWindow("last_7d") } },
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
 * the widget placed `after` the last widget, then one setBinding per slot.
 *
 * @param {keyof typeof DEFINITIONS} kind
 * @param {object} doc the dashboard it is for (dashkit v2)
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
  const widgetId = createId()
  const widget = { type: def.type, id: widgetId }
  if (def.title) widget.title = def.title
  return [
    ...ops,
    { op: "addWidget", after, widget },
    ...Object.entries(def.bindings).map(([slot, binding]) => ({ op: "setBinding", widgetId, slot, binding })),
  ]
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

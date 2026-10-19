import { createId } from "dashkit/core"

// ─── One-click starters and the "Add widget" ops ────────────────────────────
// An empty dashboard offers three starters, each a widget already bound to
// real numbers. Both helpers return dashkit ops for ONE applyAll batch, so a
// starter (or a picked widget) is one undo step, and the ids are chosen here
// so the caller can bind or select the new widget in the same go.
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

/** Ops that make sure there is a section to add into: `sectionId`, or a new one. */
function ensureSection(sectionId) {
  if (sectionId) return { sectionId, ops: [] }
  const id = createId()
  return { sectionId: id, ops: [{ op: "addSection", section: { id } }] }
}

/**
 * The ops for one starter: an addWidget into `sectionId` (or into a section
 * added first, when there is none) followed by one setBinding per slot.
 *
 * @param {keyof typeof DEFINITIONS} kind
 * @param {{ sectionId?: string }} [options]
 * @returns {object[]} dashkit ops
 */
export function starterOps(kind, { sectionId } = {}) {
  const def = Object.hasOwn(DEFINITIONS, kind) ? DEFINITIONS[kind] : null
  if (!def) throw new Error(`Unknown dashboard starter "${kind}"`)
  const target = ensureSection(sectionId)
  const widgetId = createId()
  const widget = { type: def.type, id: widgetId }
  if (def.title) widget.title = def.title
  return [
    ...target.ops,
    { op: "addWidget", sectionId: target.sectionId, widget },
    ...Object.entries(def.bindings).map(([slot, binding]) => ({ op: "setBinding", widgetId, slot, binding })),
  ]
}

/**
 * The ops for adding one widget of `type` from outside the editor: into the
 * doc's last section, or into a new one when the doc has none.
 *
 * @returns {{ ops: object[], widgetId: string }}
 */
export function addWidgetOps(doc, type) {
  const last = doc.sections.at(-1)
  const target = ensureSection(last?.id)
  const widgetId = createId()
  return { ops: [...target.ops, { op: "addWidget", sectionId: target.sectionId, widget: { type, id: widgetId } }], widgetId }
}

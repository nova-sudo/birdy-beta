// lib/default-metrics.js
// Birdy metrics that ship with the product.
//
// These are derived figures Birdy computes rather than reads off an
// integration — the same family as conversion rate, CPL and engagement rate.
// What makes them "default" is ownership: they arrive with the account, every
// client gets the same definition, and the Metrics Hub offers them show/hide
// alone. A Custom Formula can be renamed, edited, duplicated and deleted; one
// of these cannot, because a metric half the app quotes by name can't be
// something a single user removes out from under it.
//
// ROAS lived here as a custom formula first (GHL Revenue ÷ Meta Spend). Every
// agency built the same one by hand, so it belongs in the catalog instead.

/**
 * `category: "Calculated"` is what earns the Birdy badge — see
 * `sourceForCategory` in metric-sources.js. `level` mirrors the backend's
 * base_metrics shape so these merge into the catalog without special-casing.
 */
export const DEFAULT_METRICS = [
  {
    id: "roas",
    label: "ROAS",
    description: "Revenue returned for every unit of ad spend.",
    category: "Calculated",
    level: "group",
    // A multiple, not a count: 15.4x, never 15 and never $15.40.
    format: "multiplier",
    dashboards: ["clients"],
    /**
     * Won revenue from GHL over what Meta charged. Falls back to the
     * campaign-level `spend` key so the same definition works on a row that
     * carries campaign fields rather than group ones.
     * @returns {number} 0 where nothing was spent — an undefined ratio reads
     *   worse as Infinity than as "no return yet".
     */
    compute: (row) => {
      const spend = Number(row?.meta_spend ?? row?.spend ?? 0)
      const revenue = Number(row?.ghl_revenue ?? 0)
      if (!Number.isFinite(spend) || !Number.isFinite(revenue) || spend <= 0) return 0
      return revenue / spend
    },
  },
]

const BY_ID = new Map(DEFAULT_METRICS.map((m) => [m.id, m]))

/** True for metrics Birdy owns — the ones with no delete control. */
export function isDefaultMetric(id) {
  return BY_ID.has(id)
}

/** The definition, or undefined for anything else in the catalog. */
export function getDefaultMetric(id) {
  return BY_ID.get(id)
}

/**
 * Display format for a default metric ("multiplier", …), or null when the id
 * isn't one of ours and the caller should fall back to its own rules.
 */
export function defaultMetricFormat(id) {
  return BY_ID.get(id)?.format ?? null
}

/**
 * Write every default metric onto a flattened table row, in place.
 * Called after the base fields are assembled, since the formulas read them.
 * @param {object} row
 * @returns {object} the same row, for chaining
 */
export function applyDefaultMetrics(row) {
  for (const metric of DEFAULT_METRICS) {
    row[metric.id] = metric.compute(row)
  }
  return row
}

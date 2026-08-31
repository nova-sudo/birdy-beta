/**
 * The four diagnostic funnel stages for one client.
 *
 * Percentages are of the COHORT, not of the previous stage. That is not a
 * stylistic choice — `called` is not downstream of `in_crm`. From
 * compute_cohort_funnel's own contract:
 *
 *     leads   every contact created in the window
 *     in_crm  ...of whom an opportunity was opened
 *     called  ...of whom HotProspector logged at least one call
 *     closes  ...of whom an opportunity has since been won
 *
 * `in_crm` and `closes` are true subsets of `leads`, and `closes` is a subset
 * of `in_crm` — but `called` is measured independently, because a lead can be
 * dialled without anyone opening an opportunity. So "called ÷ in_crm" is a
 * ratio of two overlapping-but-unordered sets and means nothing. Every stage
 * against the cohort is the one framing that holds for all four.
 *
 * Note the window under-reports at its recent end: a cohort goes on closing
 * after its window ends, so "last 7 days" reads lower than "last month" for
 * reasons that have nothing to do with performance.
 */

import { percentDelta } from "@/lib/portfolio-aggregate"

// `issue` and `stageNoun` exist for diagnoseFunnel, which builds the verdict
// sentence out of them — "Problem found: close rate", "the drop is at the
// closing stage". They are the same words the Portfolio Dashboard's funnel
// uses, so one stage reads identically wherever it is drawn.
export const FUNNEL_STAGES = [
  { id: "leads", label: "Leads", key: "leads", issue: "lead flow", stageNoun: "lead" },
  { id: "in_crm", label: "In CRM", key: "in_crm", issue: "CRM sync", stageNoun: "CRM" },
  { id: "called", label: "Called", key: "called", issue: "call coverage", stageNoun: "calling" },
  { id: "closes", label: "Closed", key: "closes", issue: "close rate", stageNoun: "closing" },
]

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * @param group a client group as /api/client-groups returns it
 * @param previous the preceding window's funnel, for the per-stage deltas.
 *        Null where the window has no expressible previous period, in which
 *        case no stage carries a delta and diagnoseFunnel has nothing to read.
 * @returns null when no funnel is cached for the window — the caller should
 *          say so rather than draw four zeroes, which reads as "no results"
 *          when it actually means "not measured".
 */
export function buildFunnelStages(group, previous = null) {
  const funnel = group?.gohighlevel?.metrics?.funnel
  if (!funnel) return null

  const cohort = num(funnel.leads)

  return FUNNEL_STAGES.map((stage) => {
    const count = num(funnel[stage.key])
    const change = previous ? percentDelta(count, num(previous[stage.key])) : null

    return {
      ...stage,
      // diagnoseFunnel reads the display name off `stage` and wants `delta` as
      // a number, not the pill-style string percentDelta returns.
      stage: stage.label,
      count,
      // The first stage IS the cohort, so a percentage of itself is noise.
      share: stage.id === "leads" || cohort === 0 ? null : count / cohort,
      ...(change ? { direction: change.direction, delta: parseFloat(change.delta) } : {}),
    }
  })
}

/**
 * The preceding window's funnel.
 *
 * Some presets compare against an enclosing window rather than a sibling one —
 * "last 7 days" against "last 14 days" — so the current window has to be taken
 * back out of it. Clamped at zero because the two caches refresh at different
 * moments, and an enclosing window can briefly read lower than the one inside.
 *
 * @param current the selected window's funnel
 * @param enclosing the comparison window's funnel, as fetched
 * @param subtractCurrent whether `enclosing` contains `current`
 */
export function buildPreviousFunnel(current, enclosing, { subtractCurrent = false } = {}) {
  if (!enclosing) return null
  if (!subtractCurrent) return enclosing
  if (!current) return null

  const out = {}
  for (const stage of FUNNEL_STAGES) {
    out[stage.key] = Math.max(num(enclosing[stage.key]) - num(current[stage.key]), 0)
  }
  return out
}

/** "12.5%" for a share, or an em dash when it isn't defined. */
export function formatShare(share) {
  if (share == null || !Number.isFinite(share)) return ""
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}% of leads`
}

/**
 * The same figure without the qualifier, for the diagnostics card — its column
 * sits beside a delta pill and a count in a third of the page, where "of leads"
 * does not fit. The card says what the percentages are of in its own heading.
 */
export function formatSharePct(share) {
  if (share == null || !Number.isFinite(share)) return ""
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`
}

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

export const FUNNEL_STAGES = [
  { id: "leads", label: "Leads", key: "leads" },
  { id: "in_crm", label: "In CRM", key: "in_crm" },
  { id: "called", label: "Called", key: "called" },
  { id: "closes", label: "Closed", key: "closes" },
]

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * @param group a client group as /api/client-groups returns it
 * @returns null when no funnel is cached for the window — the caller should
 *          say so rather than draw four zeroes, which reads as "no results"
 *          when it actually means "not measured".
 */
export function buildFunnelStages(group) {
  const funnel = group?.gohighlevel?.metrics?.funnel
  if (!funnel) return null

  const cohort = num(funnel.leads)

  return FUNNEL_STAGES.map((stage) => {
    const count = num(funnel[stage.key])
    return {
      ...stage,
      count,
      // The first stage IS the cohort, so a percentage of itself is noise.
      share: stage.id === "leads" || cohort === 0 ? null : count / cohort,
    }
  })
}

/** "12.5%" for a share, or an em dash when it isn't defined. */
export function formatShare(share) {
  if (share == null || !Number.isFinite(share)) return ""
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}% of leads`
}

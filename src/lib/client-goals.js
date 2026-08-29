/**
 * The five goals on the Client Detail overview, each as {value, target, state}.
 *
 * Two things are worth knowing before reading the numbers:
 *
 * 1. Actuals come from the cohort funnel (`gohighlevel.metrics.funnel`), not
 *    the activity-window opportunity stats. The funnel counts one cohort — the
 *    leads created in the window — and asks how far *those* people got, which
 *    is the only way closes/leads is a real close rate. See
 *    integrations/gohighlevel.compute_cohort_funnel.
 *
 * 2. "Number of leads" has no target of its own. The design's Targets tab
 *    defines six goals and this is not one of them, so it is implied from two
 *    that are: monthly spend ÷ cost per lead is how many leads that budget is
 *    meant to buy.
 *
 * A goal with no target is returned with `target: null` and no state — it
 * renders as a plain figure rather than pretending to be on track.
 */

export const ON_TRACK = "On track"
export const BEHIND = "Behind"
export const AT_RISK = "At risk"

// A goal counts as met at 90% of target, matching the health rule's pace band
// so the strip and the health pill never disagree about the same client.
const ON_TRACK_RATIO = 0.9
const AT_RISK_RATIO = 0.7

/**
 * Where a value sits against its target.
 * @param polarity "higher" when more is better (revenue), "lower" for costs.
 */
export function goalState(value, target, polarity = "higher") {
  if (target == null || !Number.isFinite(target) || target === 0) return null
  if (!Number.isFinite(value)) return null

  // For a cost goal the comparison inverts: being under target is winning, so
  // the ratio is target/value rather than value/target.
  const ratio = polarity === "lower"
    ? (value === 0 ? Infinity : target / value)
    : value / target

  if (ratio >= ON_TRACK_RATIO) return ON_TRACK
  if (ratio >= AT_RISK_RATIO) return AT_RISK
  return BEHIND
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const orNull = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

/**
 * @param group  a client group as /api/client-groups returns it
 * @returns the five goals, in the order the design lists them
 */
export function buildClientGoals(group) {
  const targets = group?.targets ?? {}
  const funnel = group?.gohighlevel?.metrics?.funnel ?? null
  const spend = num(group?.facebook?.metrics?.insights?.spend)

  const leads = num(funnel?.leads)
  const closes = num(funnel?.closes)
  const revenue = num(funnel?.won_revenue)

  // Close rate is only meaningful with a cohort to divide by.
  const closeRate = leads > 0 ? closes / leads : null
  const cpl = leads > 0 ? spend / leads : null

  // Implied from the two targets that do exist — see the note above.
  const spendTarget = orNull(targets.monthly_spend)
  const cplTarget = orNull(targets.cpl)
  const leadsTarget =
    spendTarget != null && cplTarget != null && cplTarget > 0
      ? spendTarget / cplTarget
      : null

  return [
    {
      id: "revenue",
      label: "Revenue",
      value: revenue,
      target: orNull(targets.monthly_revenue),
      format: "currency",
      polarity: "higher",
    },
    {
      id: "closes",
      label: "Monthly closes",
      value: closes,
      target: orNull(targets.monthly_wins),
      format: "number",
      polarity: "higher",
    },
    {
      id: "cpl",
      label: "Cost per lead",
      value: cpl,
      target: cplTarget,
      format: "currency",
      polarity: "lower",
    },
    {
      id: "closeRate",
      label: "Close rate",
      value: closeRate,
      target: orNull(targets.conversion_rate),
      format: "percent",
      polarity: "higher",
    },
    {
      id: "leads",
      label: "Number of leads",
      value: leads,
      target: leadsTarget,
      format: "number",
      polarity: "higher",
      // Surfaced so the UI can say where the number came from — it is the only
      // goal on the strip the agency did not type in directly.
      implied: leadsTarget != null,
    },
  ].map((goal) => ({
    ...goal,
    state: goalState(goal.value, goal.target, goal.polarity),
  }))
}

/** Display string for a goal value or target. */
export function formatGoal(value, format, currencySymbol = "$") {
  if (value == null || !Number.isFinite(value)) return "—"
  if (format === "currency") {
    return `${currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: value < 100 ? 2 : 0,
      maximumFractionDigits: value < 100 ? 2 : 0,
    })}`
  }
  if (format === "percent") {
    // Targets are stored as a fraction (0.25), which is also what the funnel
    // ratio produces, so both sides scale the same way.
    return `${(value * 100).toFixed(1)}%`
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

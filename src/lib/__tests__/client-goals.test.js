// The five goals on the Client Detail overview.
//
// The comparison inverts for cost goals — being UNDER a cost-per-lead target
// is winning — so a single ratio would report every well-performing client as
// behind. That inversion, and the "no target" case, are what these cover.

import { describe, it, expect } from "vitest"
import {
  buildClientGoals,
  goalState,
  formatGoal,
  ON_TRACK,
  AT_RISK,
  BEHIND,
} from "@/lib/client-goals"

const group = ({ targets = {}, funnel = null, spend = 0 } = {}) => ({
  targets,
  gohighlevel: { metrics: { funnel } },
  facebook: { metrics: { insights: { spend } } },
})

const byId = (goals) => Object.fromEntries(goals.map((g) => [g.id, g]))

describe("goalState — higher is better", () => {
  it.each([
    [100, 100, ON_TRACK],
    [95, 100, ON_TRACK],   // 95% — at or above the 90% band
    [90, 100, ON_TRACK],
    [85, 100, AT_RISK],
    [70, 100, AT_RISK],
    [69, 100, BEHIND],
    [0, 100, BEHIND],
    [150, 100, ON_TRACK],  // beating the target
  ])("%i against %i is %s", (value, target, expected) => {
    expect(goalState(value, target, "higher")).toBe(expected)
  })
})

describe("goalState — lower is better", () => {
  it("is on track when the cost is at or under target", () => {
    // £9 CPL against a £10 target is good, and a naive value/target ratio
    // would have called it 90% and drifting.
    expect(goalState(9, 10, "lower")).toBe(ON_TRACK)
    expect(goalState(5, 10, "lower")).toBe(ON_TRACK)
    expect(goalState(10, 10, "lower")).toBe(ON_TRACK)
  })

  it("degrades as the cost rises above target", () => {
    expect(goalState(11, 10, "lower")).toBe(ON_TRACK)   // 10/11 ≈ 0.91
    expect(goalState(13, 10, "lower")).toBe(AT_RISK)    // 10/13 ≈ 0.77
    expect(goalState(20, 10, "lower")).toBe(BEHIND)     // 10/20 = 0.50
  })

  it("treats a zero cost as unbeatable rather than dividing by zero", () => {
    expect(goalState(0, 10, "lower")).toBe(ON_TRACK)
  })
})

describe("goalState — no target", () => {
  it.each([null, undefined, 0, NaN])("returns no state for a target of %p", (t) => {
    expect(goalState(50, t, "higher")).toBeNull()
  })

  it("returns no state when the value is unknown", () => {
    expect(goalState(null, 100, "higher")).toBeNull()
  })
})

describe("buildClientGoals", () => {
  it("returns the five goals in the design's order", () => {
    const goals = buildClientGoals(group())
    expect(goals.map((g) => g.id)).toEqual([
      "revenue", "closes", "cpl", "closeRate", "leads",
    ])
  })

  it("reads actuals from the cohort funnel", () => {
    const goals = byId(buildClientGoals(group({
      funnel: { leads: 200, closes: 20, won_revenue: 50000 },
      spend: 2000,
    })))

    expect(goals.revenue.value).toBe(50000)
    expect(goals.closes.value).toBe(20)
    expect(goals.leads.value).toBe(200)
  })

  it("derives close rate from the same cohort", () => {
    // closes/leads is only a real rate because both describe one cohort —
    // see compute_cohort_funnel's own note on this.
    const goals = byId(buildClientGoals(group({
      funnel: { leads: 200, closes: 20 },
    })))
    expect(goals.closeRate.value).toBeCloseTo(0.1)
  })

  it("derives cost per lead from spend over that cohort", () => {
    const goals = byId(buildClientGoals(group({
      funnel: { leads: 200 }, spend: 2000,
    })))
    expect(goals.cpl.value).toBe(10)
  })

  it("leaves ratios unknown rather than zero when there are no leads", () => {
    const goals = byId(buildClientGoals(group({ funnel: { leads: 0 }, spend: 500 })))
    expect(goals.cpl.value).toBeNull()
    expect(goals.closeRate.value).toBeNull()
  })

  it("survives a client with no funnel cached", () => {
    const goals = byId(buildClientGoals(group()))
    expect(goals.closes.value).toBe(0)
    expect(goals.cpl.value).toBeNull()
  })

  it("survives a null group", () => {
    expect(buildClientGoals(null)).toHaveLength(5)
  })
})

describe("targets", () => {
  it("maps each stored target onto its goal", () => {
    const goals = byId(buildClientGoals(group({
      targets: {
        monthly_revenue: 60000,
        monthly_wins: 25,
        cpl: 9,
        conversion_rate: 0.12,
      },
    })))

    expect(goals.revenue.target).toBe(60000)
    expect(goals.closes.target).toBe(25)
    expect(goals.cpl.target).toBe(9)
    expect(goals.closeRate.target).toBe(0.12)
  })

  it("implies the leads target from spend ÷ cost per lead", () => {
    // "Number of leads" is not one of the six goals the Targets tab defines,
    // so it comes from two that are.
    const goals = byId(buildClientGoals(group({
      targets: { monthly_spend: 9000, cpl: 9 },
    })))
    expect(goals.leads.target).toBe(1000)
    expect(goals.leads.implied).toBe(true)
  })

  it("leaves the leads target unset when either input is missing", () => {
    expect(byId(buildClientGoals(group({ targets: { cpl: 9 } }))).leads.target).toBeNull()
    expect(byId(buildClientGoals(group({ targets: { monthly_spend: 9000 } }))).leads.target).toBeNull()
  })

  it("does not divide by a zero cost-per-lead target", () => {
    const goals = byId(buildClientGoals(group({
      targets: { monthly_spend: 9000, cpl: 0 },
    })))
    expect(goals.leads.target).toBeNull()
  })

  it("gives an untargeted goal no state, rather than claiming it is on track", () => {
    const goals = byId(buildClientGoals(group({
      funnel: { leads: 200, closes: 20, won_revenue: 50000 },
    })))
    expect(goals.revenue.target).toBeNull()
    expect(goals.revenue.state).toBeNull()
  })
})

describe("end to end", () => {
  it("marks a client behind on closes and fine on cost", () => {
    const goals = byId(buildClientGoals(group({
      targets: { monthly_wins: 25, cpl: 12 },
      funnel: { leads: 200, closes: 5 },
      spend: 2000,          // £10 CPL against a £12 target
    })))

    expect(goals.closes.state).toBe(BEHIND)     // 5/25 = 20%
    expect(goals.cpl.state).toBe(ON_TRACK)      // under target
  })
})

describe("formatGoal", () => {
  it("renders currency with the given symbol", () => {
    expect(formatGoal(50000, "currency", "£")).toBe("£50,000")
  })

  it("keeps pence on small currency figures", () => {
    expect(formatGoal(9.5, "currency", "£")).toBe("£9.50")
  })

  it("renders a stored fraction as a percentage", () => {
    // Targets and the funnel ratio are both fractions, so they scale alike.
    expect(formatGoal(0.125, "percent")).toBe("12.5%")
  })

  it("renders an em dash for an unknown value", () => {
    expect(formatGoal(null, "number")).toBe("—")
    expect(formatGoal(NaN, "currency")).toBe("—")
  })
})

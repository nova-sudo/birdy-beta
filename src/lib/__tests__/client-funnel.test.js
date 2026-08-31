// The four diagnostic funnel stages.
//
// The one thing worth guarding: percentages are of the COHORT, not of the
// previous stage. `called` is measured independently of `in_crm` — a lead can
// be dialled without anyone opening an opportunity — so a stage-over-stage
// ratio compares two overlapping-but-unordered sets and can even exceed 100%.

import { describe, it, expect } from "vitest"
import {
  buildFunnelStages,
  buildPreviousFunnel,
  formatShare,
  formatSharePct,
  FUNNEL_STAGES,
} from "@/lib/client-funnel"
import { diagnoseFunnel } from "@/lib/portfolio-metrics"

const group = (funnel) => ({ gohighlevel: { metrics: { funnel } } })
const byId = (stages) => Object.fromEntries(stages.map((s) => [s.id, s]))

describe("stages", () => {
  it("returns the four stages in cohort order", () => {
    const stages = buildFunnelStages(group({ leads: 100 }))
    expect(stages.map((s) => s.id)).toEqual(["leads", "in_crm", "called", "closes"])
  })

  it("reads each count from the cached funnel", () => {
    const stages = byId(buildFunnelStages(group({
      leads: 200, in_crm: 120, called: 150, closes: 18,
    })))
    expect(stages.leads.count).toBe(200)
    expect(stages.in_crm.count).toBe(120)
    expect(stages.called.count).toBe(150)
    expect(stages.closes.count).toBe(18)
  })

  it("treats a missing stage as zero", () => {
    const stages = byId(buildFunnelStages(group({ leads: 100 })))
    expect(stages.closes.count).toBe(0)
  })
})

describe("shares are of the cohort", () => {
  it("divides every stage by leads", () => {
    const stages = byId(buildFunnelStages(group({
      leads: 200, in_crm: 100, called: 150, closes: 20,
    })))
    expect(stages.in_crm.share).toBeCloseTo(0.5)
    expect(stages.called.share).toBeCloseTo(0.75)
    expect(stages.closes.share).toBeCloseTo(0.1)
  })

  it("does not chain called off in_crm", () => {
    // More leads were called than had opportunities opened. Stage-over-stage
    // would report 150% here; against the cohort it is a sane 75%.
    const stages = byId(buildFunnelStages(group({
      leads: 200, in_crm: 100, called: 150, closes: 10,
    })))
    expect(stages.called.share).toBeCloseTo(0.75)
    expect(stages.called.share).toBeLessThanOrEqual(1)
  })

  it("gives the cohort stage no share of its own", () => {
    // Leads against leads is always 100% — noise, not information.
    const stages = byId(buildFunnelStages(group({ leads: 200, closes: 10 })))
    expect(stages.leads.share).toBeNull()
  })

  it("leaves shares undefined when the cohort is empty", () => {
    const stages = byId(buildFunnelStages(group({ leads: 0, closes: 0 })))
    expect(stages.in_crm.share).toBeNull()
    expect(stages.closes.share).toBeNull()
  })
})

describe("no funnel cached", () => {
  it("returns null rather than four zeroes", () => {
    // Four zeroes read as "no results"; null lets the card say "not measured".
    expect(buildFunnelStages(group(undefined))).toBeNull()
    expect(buildFunnelStages({})).toBeNull()
    expect(buildFunnelStages(null)).toBeNull()
  })

  it("distinguishes that from a real all-zero window", () => {
    const stages = buildFunnelStages(group({ leads: 0, in_crm: 0, called: 0, closes: 0 }))
    expect(stages).not.toBeNull()
    expect(stages.every((s) => s.count === 0)).toBe(true)
  })
})

describe("formatShare", () => {
  it("renders a share against the cohort", () => {
    expect(formatShare(0.5)).toBe("50% of leads")
  })

  it("keeps a decimal on small shares, where rounding would read as zero", () => {
    expect(formatShare(0.045)).toBe("4.5% of leads")
  })

  it("renders nothing when there is no share", () => {
    expect(formatShare(null)).toBe("")
    expect(formatShare(undefined)).toBe("")
  })
})

describe("formatSharePct", () => {
  it("drops the qualifier, for the card's narrow column", () => {
    expect(formatSharePct(0.5)).toBe("50%")
    expect(formatSharePct(0.045)).toBe("4.5%")
  })

  it("renders nothing when there is no share", () => {
    expect(formatSharePct(null)).toBe("")
  })
})

describe("stage definitions", () => {
  it("maps each stage to its funnel key", () => {
    expect(FUNNEL_STAGES.map((s) => s.key)).toEqual([
      "leads", "in_crm", "called", "closes",
    ])
  })

  it("names the issue and the stage noun diagnoseFunnel writes the verdict from", () => {
    const closes = FUNNEL_STAGES.find((s) => s.id === "closes")
    expect(closes.issue).toBe("close rate")
    expect(closes.stageNoun).toBe("closing")
  })
})

describe("deltas against the previous window", () => {
  const current = { leads: 200, in_crm: 100, called: 150, closes: 20 }

  it("carries no delta at all when there is no previous window", () => {
    // Not a flat one. An unknown movement must not render as 0%.
    const stages = buildFunnelStages(group(current))
    expect(stages.every((s) => s.direction === undefined)).toBe(true)
    expect(stages.every((s) => s.delta === undefined)).toBe(true)
  })

  it("reads each stage against its own previous count", () => {
    const stages = byId(
      buildFunnelStages(group(current), { leads: 100, in_crm: 100, called: 100, closes: 40 })
    )
    expect(stages.leads.direction).toBe("up")
    expect(stages.leads.delta).toBe(100)
    expect(stages.closes.direction).toBe("down")
    expect(stages.closes.delta).toBe(50)
  })

  it("leaves a stage with no previous figure undiagnosable", () => {
    // Zero to something has no meaningful percentage — percentDelta's rule.
    const stages = byId(buildFunnelStages(group(current), { leads: 0, closes: 0 }))
    expect(stages.leads.direction).toBeUndefined()
    expect(stages.closes.direction).toBeUndefined()
  })

  it("feeds diagnoseFunnel a shape it can name the failing stage from", () => {
    // Closes down while the leads feeding them are up: the drop is at the
    // closing stage, which is the whole point of showing the funnel.
    const stages = buildFunnelStages(
      group(current),
      { leads: 100, in_crm: 100, called: 100, closes: 40 }
    )
    const diagnosis = diagnoseFunnel(stages)
    expect(diagnosis.state).toBe("problem")
    expect(diagnosis.title).toBe("Problem found: close rate")
    expect(diagnosis.body).toContain("the drop is at the closing stage")
  })

  it("says nothing is wrong when no stage is materially down", () => {
    const stages = buildFunnelStages(
      group(current),
      { leads: 100, in_crm: 50, called: 100, closes: 10 }
    )
    expect(diagnoseFunnel(stages).state).toBe("healthy")
  })
})

describe("buildPreviousFunnel", () => {
  const current = { leads: 100, in_crm: 60, called: 80, closes: 10 }

  it("uses a sibling window as it comes", () => {
    const enclosing = { leads: 90, in_crm: 50, called: 70, closes: 8 }
    expect(buildPreviousFunnel(current, enclosing)).toBe(enclosing)
  })

  it("takes the current window back out of an enclosing one", () => {
    // last_7d compares against last_14d, which contains it.
    const prev = buildPreviousFunnel(
      current,
      { leads: 250, in_crm: 140, called: 190, closes: 25 },
      { subtractCurrent: true }
    )
    expect(prev).toEqual({ leads: 150, in_crm: 80, called: 110, closes: 15 })
  })

  it("clamps at zero when the enclosing cache is behind the inner one", () => {
    // The two caches refresh at different moments, so the enclosing window can
    // briefly read lower than the window inside it. Negative counts would flip
    // every delta's direction.
    const prev = buildPreviousFunnel(
      current,
      { leads: 80, in_crm: 40, called: 60, closes: 5 },
      { subtractCurrent: true }
    )
    expect(Object.values(prev).every((v) => v >= 0)).toBe(true)
    expect(prev.leads).toBe(0)
  })

  it("returns null when there is nothing to compare against", () => {
    expect(buildPreviousFunnel(current, null)).toBeNull()
    expect(buildPreviousFunnel(null, { leads: 10 }, { subtractCurrent: true })).toBeNull()
  })
})

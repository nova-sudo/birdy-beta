// The four diagnostic funnel stages.
//
// The one thing worth guarding: percentages are of the COHORT, not of the
// previous stage. `called` is measured independently of `in_crm` — a lead can
// be dialled without anyone opening an opportunity — so a stage-over-stage
// ratio compares two overlapping-but-unordered sets and can even exceed 100%.

import { describe, it, expect } from "vitest"
import { buildFunnelStages, formatShare, FUNNEL_STAGES } from "@/lib/client-funnel"

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

describe("stage definitions", () => {
  it("maps each stage to its funnel key", () => {
    expect(FUNNEL_STAGES.map((s) => s.key)).toEqual([
      "leads", "in_crm", "called", "closes",
    ])
  })
})

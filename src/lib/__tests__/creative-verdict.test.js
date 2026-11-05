import { describe, it, expect } from "vitest"
import { VERDICT_META, adFloorProgress, scoreTone, floorProgress, formatCpl } from "../creative-verdict"

const targets = { min_spend: 150, min_days: 7 }

describe("VERDICT_META", () => {
  it("maps every status to label and tone", () => {
    expect(VERDICT_META.winner.tone).toBe("success")
    expect(VERDICT_META.loser.tone).toBe("danger")
    expect(VERDICT_META.inconclusive.tone).toBe("warning")
    expect(VERDICT_META.testing.tone).toBe("info")
    expect(VERDICT_META.archived.tone).toBe("muted")
    expect(VERDICT_META.draft.tone).toBe("neutral")
    expect(VERDICT_META.posting.tone).toBe("neutral")
    for (const v of Object.values(VERDICT_META)) expect(v.label).toBeTruthy()
  })
})

describe("scoreTone", () => {
  it("maps score states", () => {
    expect(scoreTone("pass")).toBe("success")
    expect(scoreTone("fail")).toBe("danger")
    expect(scoreTone("scoring")).toBe("warning")
    expect(scoreTone("removed")).toBe("muted")
    expect(scoreTone("nope")).toBe("muted")
  })
})

describe("floorProgress", () => {
  it("is spend-led", () => {
    const p = floorProgress({ spend: 96, days_live: 2, currency: "GBP" }, targets)
    expect(p.pct).toBeCloseTo(0.64)
    expect(p.label).toBe("£96 / £150")
  })
  it("is days-led", () => {
    const p = floorProgress({ spend: 30, days_live: 4, currency: "GBP" }, targets)
    expect(p.pct).toBeCloseTo(4 / 7)
    expect(p.label).toBe("day 4 of 7")
  })
  it("caps at 1 and reads done", () => {
    expect(floorProgress({ spend: 400, days_live: 9 }, targets)).toEqual({ pct: 1, label: "done" })
  })
  it("handles a missing score", () => {
    expect(floorProgress(null, targets).pct).toBe(0)
  })
})

describe("formatCpl", () => {
  it("shows a dash with zero leads once spend exists", () => {
    expect(formatCpl({ cpl: null, spend: 80, leads: 0 }, "GBP")).toBe("— · 0 leads")
  })
  it("formats a cpl in the account currency", () => {
    expect(formatCpl({ cpl: 12.5, spend: 100, leads: 8 }, "GBP")).toBe("£12.50")
  })
  it("is a plain dash with no spend", () => {
    expect(formatCpl({ cpl: null, spend: 0 }, "GBP")).toBe("—")
    expect(formatCpl(null, "GBP")).toBe("—")
  })
})

describe("adFloorProgress (final review I5)", () => {
  const test = { summary: { currency: "GBP" }, targets: { min_spend: 150, min_days: 7 } }
  it("compares a converted row's spend with the floor in the user's currency", () => {
    expect(adFloorProgress({ currency: "GBP", score: { spend: 75, days_live: 1 } }, test, "GBP").label).toBe("£75 / £150")
  })
  it("counts days only for a row left in another currency", () => {
    expect(adFloorProgress({ currency: "JPY", score: { spend: 20000, days_live: 3 } }, test, "GBP").label).toBe("day 3 of 7")
    expect(adFloorProgress({ currency: "GBP", score: { spend: 999, days_live: 2, rate_missing: true } }, test, "GBP").label).toBe("day 2 of 7")
  })
})

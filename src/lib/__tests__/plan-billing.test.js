import { describe, it, expect } from "vitest"
import {
  allowanceLeft, creditBreakdown, currentPlan, nextPlan, offeredPacks, periodLine, planAction, slotGrid, withoutParam,
} from "../plan-billing"

const PLANS = [{ id: "starter" }, { id: "growth" }, { id: "scale" }]
const ORDER = ["starter", "growth", "scale"]

describe("plans", () => {
  it("finds the subscribed plan and the one above it", () => {
    const status = { subscribed: true, plan: { id: "growth" } }
    expect(currentPlan(status, PLANS)).toEqual({ id: "growth" })
    expect(nextPlan(currentPlan(status, PLANS), PLANS, ORDER)).toEqual({ id: "scale" })
    expect(nextPlan({ id: "scale" }, PLANS, ORDER)).toBeNull()
    expect(currentPlan({ subscribed: false, plan: { id: "free" } }, PLANS)).toBeNull()
  })

  it("says what each tier's button does", () => {
    const status = { subscribed: true, plan: { id: "growth" } }
    expect(planAction({ id: "starter" }, status, ORDER)).toBe("downgrade")
    expect(planAction({ id: "growth" }, status, ORDER)).toBe("current")
    expect(planAction({ id: "scale" }, status, ORDER)).toBe("upgrade")
    expect(planAction({ id: "scale" }, { subscribed: false }, ORDER)).toBe("checkout")
  })
})

describe("slotGrid", () => {
  it("marks used slots inside the plan, paid extras, and free ones", () => {
    const grid = slotGrid({ subscribed: true, client_limit: 6, client_count: 5, extra_clients_paid: 2 })
    expect(grid).toEqual(["included", "included", "included", "included", "extra", "free"])
  })

  it("draws nothing without a plan or with too many slots", () => {
    expect(slotGrid({ subscribed: false, client_limit: 3 })).toBeNull()
    expect(slotGrid({ subscribed: true, client_limit: 0 })).toBeNull()
    expect(slotGrid({ subscribed: true, client_limit: 500, client_count: 3 })).toBeNull()
  })

  it("shows clients over the limit as extra", () => {
    expect(slotGrid({ subscribed: true, client_limit: 2, client_count: 3, extra_clients_paid: 0 })).toEqual(["included", "included", "extra"])
  })
})

describe("period and credits", () => {
  it("writes the billing line", () => {
    expect(periodLine({ subscribed: false })).toBeNull()
    expect(periodLine({ subscribed: true, current_period_end: "2026-12-04T00:00:00Z" })).toBe("Billed monthly · next bill 4 Dec 2026")
    expect(periodLine({ subscribed: true, cancel_at_period_end: true, current_period_end: "2026-12-04T00:00:00Z" })).toBe("Billed monthly · ends 4 Dec 2026")
  })

  it("works out the share of allowance left", () => {
    expect(allowanceLeft(0, 10)).toBeNull()
    expect(allowanceLeft(200, 50)).toBe(25)
    expect(allowanceLeft(100, 150)).toBe(100)
  })

  it("sorts where credits went, largest first", () => {
    const rows = creditBreakdown({ by_feature: { suggestions: 40.4, ask_birdy: 120.2, reports_x: 0 } })
    expect(rows.map((r) => [r.label, r.credits, Math.round(r.share)])).toEqual([["Ask Birdy", 120, 100], ["Suggestions", 40, 33]])
    expect(creditBreakdown(null)).toEqual([])
  })

  it("hides the bulk pack", () => {
    expect(offeredPacks([{ credits: 1000 }, { credits: 10000 }])).toEqual([{ credits: 1000 }])
  })

  it("drops one query flag and keeps the section", () => {
    expect(withoutParam("/settings?section=plan&topup=success", "topup")).toBe("/settings?section=plan")
    expect(withoutParam("/settings?topup=success", "topup")).toBe("/settings")
  })
})

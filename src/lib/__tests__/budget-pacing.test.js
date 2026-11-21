import { describe, it, expect } from "vitest"
import { monthOf, paceRow, pacingOf, runsOutWords } from "../budget-pacing"

// Sat 21 Nov 2026: day 21 of 30, 20.5 days gone.
const NOW = new Date("2026-11-21T10:00:00Z")
const month = monthOf(NOW)

const group = (id, spend, results, targets = {}, extra = {}) => ({
  id, name: id.toUpperCase(), client_status: "Active", targets,
  facebook: { currency: "GBP", metrics: { insights: { spend, results } } }, ...extra,
})

describe("budget pacing", () => {
  it("counts the month as the backend's tool does", () => {
    expect(month).toMatchObject({ day: 21, days: 30, elapsed: 20.5, name: "November", key: "2026-11" })
  })

  it("carries spend so far in a straight line to the month's end", () => {
    const row = paceRow(2050, 3000, month)
    expect(row.projected).toBeCloseTo(3000)
    expect(row.used_pct).toBe(68.3)
    expect(row.expected_pct).toBe(68.3)
    expect(row.status).toBe("on_pace")
    expect(row.runs_out_on).toBeNull()
  })

  it("flags a client more than 10 points ahead as over, and says when its budget runs out", () => {
    const row = paceRow(2700, 3000, month)
    expect(row.status).toBe("over")
    // 20.5 × 3000 / 2700 = day 22.8 → 23 Nov
    expect(row.runs_out_on).toBe("2026-11-23")
    expect(runsOutWords(row.runs_out_on)).toBe("Runs out 23 Nov")
  })

  it("flags a client more than 15 points behind as under, and one past its budget as used", () => {
    expect(paceRow(1000, 3000, month).status).toBe("under")
    expect(paceRow(3100, 3000, month).runs_out_on).toBe("already")
    expect(runsOutWords("already")).toBe("Budget used")
  })

  it("has no status or percentage without a budget", () => {
    expect(paceRow(500, null, month)).toMatchObject({ status: "no_budget", used_pct: null, budget: null })
  })

  it("totals only the clients with a budget, leaves out inactive ones, and lists budgets first", () => {
    const p = pacingOf([
      group("none", 900, 30),
      group("a", 2050, 100, { monthly_spend: 3000, cpl: 20 }),
      group("b", 2700, 90, { monthly_spend: 3000, cpl: 30 }),
      group("gone", 5000, 10, { monthly_spend: 100 }, { client_status: "Inactive" }),
    ], NOW)
    expect(p.clients.map((c) => c.id)).toEqual(["b", "a", "none"])
    expect(p.totals).toMatchObject({ clients: 2, spend: 4750, budget: 6000, leads: 190 })
    // budget ÷ CPL target per client: 150 + 100
    expect(p.totals.leadTarget).toBe(250)
    expect(p.totals.cplTarget).toBe(24)
    expect(p.totals.projected).toBeCloseTo(4750 / 20.5 * 30)
    expect(p.summary).toEqual({ over: 1, on_pace: 1, under: 0, no_budget: 1 })
  })

  it("gives no lead target unless every budgeted client has a CPL target", () => {
    const p = pacingOf([group("a", 100, 5, { monthly_spend: 300, cpl: 10 }), group("b", 100, 5, { monthly_spend: 300 })], NOW)
    expect(p.totals.leadTarget).toBeNull()
    expect(p.totals.cplTarget).toBeNull()
  })

  it("has no totals when no client has a budget", () => {
    expect(pacingOf([group("a", 100, 5)], NOW).totals).toBeNull()
  })
})

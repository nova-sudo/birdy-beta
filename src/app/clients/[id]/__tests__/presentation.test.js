import { describe, it, expect, vi } from "vitest"
import { clientFindings } from "../presentation"

const group = (funnel, spend = 0) => ({
  name: "Glow Clinic",
  gohighlevel: { metrics: { funnel } },
  facebook: { metrics: { insights: { spend } } },
})

const goal = (over) => ({ id: "cpl", label: "Cost per lead", value: 12, target: 10, format: "currency", state: "Behind", ...over })

describe("clientFindings", () => {
  it("is empty without a client", () => {
    expect(clientFindings({ group: null })).toEqual([])
  })

  it("summarises the window from the funnel and spend", () => {
    const [row] = clientFindings({ group: group({ leads: 1562, closes: 29 }, 4200), currencySymbol: "£" })
    expect(row).toMatchObject({ tone: "info", title: "1,562 leads from £4,200 of ad spend", detail: "29 have closed" })
  })

  it("says so when nothing has come in", () => {
    const [row] = clientFindings({ group: group({ leads: 0 }) })
    expect(row).toMatchObject({ tone: "neutral", title: "No leads recorded in this window yet" })
    expect(clientFindings({ group: group(null) })[0].tone).toBe("neutral")
  })

  it("adds a row for each goal that is behind or at risk, and none for the rest", () => {
    const rows = clientFindings({
      group: group({ leads: 10, closes: 0 }),
      goals: [
        goal({ id: "cpl", state: "Behind" }),
        goal({ id: "leads", label: "Leads", state: "At risk", value: 40, target: 100, format: "integer" }),
        goal({ id: "closes", label: "Closes", state: "On track" }),
        goal({ id: "revenue", label: "Revenue", state: null, target: null }),
      ],
      currencySymbol: "£",
    })
    const goals = rows.filter((r) => r.id.startsWith("goal-"))
    expect(goals.map((r) => [r.id, r.tone])).toEqual([
      ["goal-cpl", "danger"],
      ["goal-leads", "warning"],
    ])
    expect(goals[0].title).toBe("Cost per lead is behind")
  })

  it("carries the funnel verdict only with a comparison, and View calls only on a problem", () => {
    const onViewCalls = vi.fn()
    const problem = { state: "problem", title: "Problem found: close rate", body: "Closes fell 30%." }
    const args = { group: group({ leads: 10, closes: 1 }), diagnosis: problem, onViewCalls }

    expect(clientFindings({ ...args, hasComparison: false }).find((r) => r.id === "funnel")).toBeUndefined()

    const row = clientFindings({ ...args, hasComparison: true }).find((r) => r.id === "funnel")
    expect(row).toMatchObject({ tone: "danger", title: "Problem found: close rate" })
    row.action.onClick()
    expect(onViewCalls).toHaveBeenCalled()

    const healthy = clientFindings({
      ...args,
      hasComparison: true,
      diagnosis: { state: "healthy", title: "Funnel looks healthy", body: "Every stage is up." },
    }).find((r) => r.id === "funnel")
    expect(healthy).toMatchObject({ tone: "success", action: undefined })
  })

  it("wires dismissal for the verdict", () => {
    const onDismissDiagnosis = vi.fn()
    const row = clientFindings({
      group: group({ leads: 10 }),
      diagnosis: { state: "problem", title: "t", body: "b" },
      hasComparison: true,
      onDismissDiagnosis,
    }).find((r) => r.id === "funnel")
    row.onDismiss()
    expect(onDismissDiagnosis).toHaveBeenCalled()
  })

  it("lists the worst tone first and caps at five", () => {
    const rows = clientFindings({
      group: group({ leads: 10 }),
      goals: ["a", "b", "c", "d", "e"].map((id) => goal({ id, label: id, state: id === "e" ? "At risk" : "Behind" })),
    })
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.tone)).toEqual(["danger", "danger", "danger", "danger", "warning"])
  })
})

import { describe, it, expect } from "vitest"
import { clientRows, cplDelta, statusOf, titleCase } from "../presentation"

const group = (id, { spend, leads, extra = {} }) => ({
  id,
  name: `client ${id}`,
  client_status: "Active",
  facebook: { currency: "GBP", metrics: { insights: { spend, results: leads } } },
  ...extra,
})

describe("titleCase", () => {
  it("capitalises each word", () => {
    expect(titleCase("acme DENTAL")).toBe("Acme Dental")
  })
})

describe("cplDelta", () => {
  it("is the signed percent change", () => {
    expect(cplDelta(12, 10)).toBeCloseTo(20)
    expect(cplDelta(8, 10)).toBeCloseTo(-20)
  })
  it("is null when either side is unknown", () => {
    expect(cplDelta(null, 10)).toBeNull()
    expect(cplDelta(10, 0)).toBeNull()
  })
})

describe("clientRows", () => {
  it("derives leads, spend and cost per lead from the shared metrics", () => {
    const [row] = clientRows([group("a", { spend: 200, leads: 20 })], null, undefined)
    expect(row).toMatchObject({ id: "a", name: "Client A", leads: 20, spend: 200, cpl: 10, currency: "GBP", active: true })
    expect(row.cplDelta).toBeNull()
  })

  it("has no cost per lead without leads or spend", () => {
    const rows = clientRows([group("a", { spend: 50, leads: 0 }), group("b", { spend: 0, leads: 4 })], null)
    expect(rows.map((r) => r.cpl)).toEqual([null, null])
  })

  it("compares against a sibling window directly", () => {
    const rows = clientRows(
      [group("a", { spend: 120, leads: 10 })],
      [group("a", { spend: 100, leads: 10 })],
      { preset: "yesterday" }
    )
    expect(rows[0].cplDelta).toBeCloseTo(20)
  })

  it("takes the current window back out of an enclosing one", () => {
    // last_14d = 300 over 20 leads; last_7d = 120 over 10 -> previous week is 180 over 10 = 18
    const rows = clientRows(
      [group("a", { spend: 120, leads: 10 })],
      [group("a", { spend: 300, leads: 20 })],
      { preset: "last_14d", subtractCurrent: true }
    )
    expect(rows[0].cpl).toBe(12)
    expect(rows[0].cplDelta).toBeCloseTo(((12 - 18) / 18) * 100)
  })

  it("has no delta for a client missing from the comparison", () => {
    const rows = clientRows([group("a", { spend: 120, leads: 10 })], [], { preset: "yesterday" })
    expect(rows[0].cplDelta).toBeNull()
  })

  it("withholds figures from a client still syncing", () => {
    const [row] = clientRows([group("a", { spend: 120, leads: 10, extra: { _isSyncing: true } })], null)
    expect(row).toMatchObject({ syncing: true, leads: null, spend: null, cpl: null })
  })

  it("normalises health and status", () => {
    const rows = clientRows([
      group("a", { spend: 1, leads: 1, extra: { health: "critical" } }),
      group("b", { spend: 1, leads: 1, extra: { client_status: "inactive" } }),
    ])
    expect(rows[0].health).toBe("Critical")
    expect(rows[1]).toMatchObject({ health: "Healthy", active: false })
  })
})

describe("statusOf", () => {
  it("syncing wins over active", () => {
    expect(statusOf({ syncing: true, active: true })).toEqual({ label: "Syncing", tone: "info" })
    expect(statusOf({ syncing: false, active: true })).toEqual({ label: "Active", tone: "success" })
    expect(statusOf({ syncing: false, active: false })).toEqual({ label: "Inactive", tone: "neutral" })
  })
})

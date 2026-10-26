import { describe, it, expect } from "vitest"
import { catalogueColumns, catalogueValues, formatCell, readSavedView } from "../catalogue"

const group = {
  id: "g1",
  facebook: { metrics: { total_campaigns: 7, insights: { spend: 200, results: 20, clicks: 100, impressions: 5000, ctr: 2 } } },
  gohighlevel: { metrics: { total_contacts: 45, tag_breakdown: { VIP: 3, cold: 1 }, opportunity_stats: { won: 2, won_revenue: 900 } } },
}

describe("catalogueColumns", () => {
  it("offers the base catalogue without the columns the curated five replace", () => {
    const ids = catalogueColumns([group]).map((c) => c.id)
    expect(ids).toContain("meta_campaigns")
    expect(ids).toContain("ghl_contacts")
    expect(ids).not.toContain("name")
    expect(ids).not.toContain("meta_spend")
    expect(ids).not.toContain("cost_per_lead")
    expect(ids).not.toContain("meta_leads")
  })

  it("adds one column per GHL tag in use, and the formulas shown on Clients", () => {
    const cols = catalogueColumns([group], [
      { id: "m1", name: "Mine", enabled: true, dashboards: ["clients"] },
      { id: "m2", name: "Elsewhere", enabled: true, dashboards: ["marketing"] },
      { id: "m3", name: "Off", enabled: false, dashboards: ["clients"] },
    ])
    expect(cols.find((c) => c.id === "tag_vip")).toMatchObject({ label: "Tag: Vip", tag: "vip" })
    expect(cols.map((c) => c.id)).toContain("m1")
    expect(cols.map((c) => c.id)).not.toContain("m2")
    expect(cols.map((c) => c.id)).not.toContain("m3")
  })
})

describe("catalogueValues", () => {
  it("computes the figures the previous table showed", () => {
    const cols = catalogueColumns([group])
    const v = catalogueValues(group, cols)
    expect(v).toMatchObject({ meta_campaigns: 7, ghl_contacts: 45, ghl_revenue: 900, meta_spend: 200, meta_leads: 20, cost_per_lead: 10, conversion_rate: 20, tag_vip: 3 })
    expect(v.roas).toBeCloseTo(4.5)
  })

  it("evaluates a custom formula against the row", () => {
    const custom = { id: "m1", name: "Spend per contact", enabled: true, dashboards: ["clients"],
      formulaParts: [{ type: "metric", value: "meta_spend" }, { type: "operator", value: "/" }, { type: "metric", value: "ghl_contacts" }] }
    const cols = catalogueColumns([group], [custom])
    expect(catalogueValues(group, cols).m1).toBeCloseTo(200 / 45)
  })

  it("a client with no call centre has no call figures, not zeroes", () => {
    const v = catalogueValues({ ...group, call_log_provider: "none" }, [])
    expect(v.hp_total_calls).toBeNull()
    expect(v.hp_connect_rate).toBeNull()
  })
})

describe("formatCell", () => {
  it("formats money, rates and counts, and dashes the missing", () => {
    expect(formatCell("meta_cpc", 1.5, { symbol: "£" })).toBe("£1.50")
    expect(formatCell("meta_ctr", 2)).toBe("2.00%")
    expect(formatCell("meta_campaigns", 1234)).toBe("1,234")
    expect(formatCell("roas", 4.5)).toBe("4.5x")
    expect(formatCell("meta_campaigns", null)).toBe("—")
    expect(formatCell("meta_campaigns", Infinity)).toBe("—")
    expect(formatCell("m1", 0.5, { custom: { formatType: "percentage" } })).toBe("50.00%")
  })
})

describe("readSavedView", () => {
  it("is null when nothing is saved", () => {
    expect(readSavedView(null)).toBeNull()
    expect(readSavedView([])).toBeNull()
  })
  it("keeps the saved order, reads legacy ids as the curated columns, and always keeps name", () => {
    const view = readSavedView(["meta_campaigns", "meta_spend", "cost_per_lead"])
    expect(view.order).toEqual(["meta_campaigns", "spend", "cpl"])
    expect([...view.visible].sort()).toEqual(["cpl", "meta_campaigns", "name", "spend"])
  })
})

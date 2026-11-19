import { describe, it, expect } from "vitest"
import { flattenClientGroup } from "../client-rows"

const group = (extra = {}) => ({
  id: "g1",
  name: "Aura",
  client_status: "Active",
  call_log_provider: "hotprospector",
  facebook: { metrics: { insights: { spend: 120, clicks: 60, impressions: 4000, results: 24 } } },
  gohighlevel: { metrics: { total_contacts: 30, tag_breakdown: { vip: 4, cold: 9 } } },
  hotprospector: { metrics: { total_leads: 40 }, call_stats: { total_calls: 50, leads_with_calls: 10, answered_calls: 25, total_leads: 40 } },
  ...extra,
})

describe("flattenClientGroup", () => {
  it("reads the core figures off the group", () => {
    const row = flattenClientGroup(group())
    expect(row).toMatchObject({ id: "g1", name: "Aura", status: "Active", meta_spend: 120, meta_leads: 24, ghl_contacts: 30, hp_leads: 40 })
  })

  it("gives the share of leads called as a percentage", () => {
    expect(flattenClientGroup(group()).hp_connect_rate).toBe(25)
  })

  it("leaves call figures empty, not zero, for a client with no call centre", () => {
    const row = flattenClientGroup(group({ call_log_provider: "none" }))
    expect(row.hp_connect_rate).toBeNull()
    expect(row.hp_total_calls).toBeNull()
    expect(row.hp_leads_with_calls).toBeNull()
  })

  it("adds the wider set only when asked: cost per lead, tags", () => {
    expect(flattenClientGroup(group()).cost_per_lead).toBeUndefined()
    const row = flattenClientGroup(group(), { enhanced: true, columns: [{ id: "tag_vip", type: "tag", tagName: "vip" }] })
    expect(row.cost_per_lead).toBe(5)
    expect(row.total_tags).toBe(2)
    expect(row.tag_vip).toBe(4)
  })

  it("does not divide by zero when there are no leads or clicks", () => {
    const row = flattenClientGroup(group({ facebook: { metrics: { insights: { spend: 50 } } } }), { enhanced: true })
    expect(row.cost_per_lead).toBe(0)
    expect(row.conversion_rate).toBe(0)
  })

  it("copes with a group that has no integrations at all", () => {
    const row = flattenClientGroup({ id: "g2" }, { enhanced: true })
    expect(row).toMatchObject({ id: "g2", name: "Unnamed Group", status: "Active", meta_spend: 0, meta_leads: 0, ghl_contacts: 0 })
  })

  it("evaluates custom formula metrics onto the row", () => {
    const customMetrics = [{ id: "double_spend", formulaParts: [{ type: "metric", value: "meta_spend" }, { type: "operator", value: "*" }, { type: "number", value: "2" }] }]
    const row = flattenClientGroup(group(), { customMetrics })
    expect(typeof row.double_spend).toBe("number")
  })
})

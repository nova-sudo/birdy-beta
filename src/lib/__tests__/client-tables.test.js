import { describe, expect, it } from "vitest"
import { adRows, callRows, leadCounts, leadRow, lengthLabel, searchBy, sortBy, toggleSort, whenLabel } from "../client-tables"

const contact = (over = {}) => ({ contactId: "c1", contactName: "Leanne Turner", dateAdded: "2026-11-04T18:31:00Z", source: "Facebook", opportunities: [], ...over })

describe("leadRow", () => {
  it("puts a lead in the furthest stage it reached", () => {
    expect(leadRow(contact()).stage).toBe("crm")
    expect(leadRow(contact({ hp_enrichment: { call_logs_count: 2 } })).stage).toBe("called")
    expect(leadRow(contact({ hp_enrichment: { call_logs_count: 2 }, opportunities: [{ status: "won", monetaryValue: 349 }] })).stage).toBe("closed")
    expect(leadRow(contact({ opportunities: [{ status: "lost" }, { status: "abandoned" }] })).stage).toBe("lost")
    // An open deal beside a lost one is still live.
    expect(leadRow(contact({ opportunities: [{ status: "lost" }, { status: "open" }] })).stage).toBe("crm")
  })

  it("carries where it came from, its calls and the value of its deals", () => {
    const row = leadRow(contact({
      meta_enrichment: { campaign_name: "Body Sculpting - CBO", ad_name: "Timelapse" },
      hp_enrichment: { call_logs_count: "3" },
      opportunities: [{ status: "open", monetaryValue: 349, pipelineStageName: "Spicy leads" }, { status: "open", monetaryValue: "100" }],
    }))
    expect(row).toMatchObject({ id: "c1", name: "Leanne Turner", campaign: "Body Sculpting - CBO", ad: "Timelapse", calls: 3, value: 449, stageNote: "Spicy leads" })
  })

  it("copes with a contact that has almost nothing", () => {
    expect(leadRow({ contactId: "x" })).toMatchObject({ name: "Unknown", stage: "crm", calls: 0, value: 0, campaign: "", ad: "" })
  })
})

describe("leadCounts", () => {
  it("counts each stage and the total", () => {
    expect(leadCounts([{ stage: "crm" }, { stage: "called" }, { stage: "called" }, { stage: "closed" }])).toEqual({ all: 4, crm: 1, called: 2, closed: 1, lost: 0 })
  })
})

describe("adRows", () => {
  const group = { facebook: { campaigns: [{ id: "c1", name: "SOUP - Body Sculpting - CBO" }], ads: [
    { id: "a1", name: "Timelapse", campaign_id: "c1", spend: 24.03, results: 2 },
    { id: "a2", name: "Spent, no leads", campaign_id: "zz", spend: 10, results: 0 },
    { id: "a3", name: "Never ran", campaign_id: "c1", spend: 0, results: 0 },
  ] } }
  it("lists the ads that spent or brought a lead, with their campaign and CRM figures", () => {
    const rows = adRows(group, { a1: { contacts: 1, won: 1 } })
    expect(rows.map((r) => r.name)).toEqual(["Timelapse", "Spent, no leads"])
    expect(rows[0]).toMatchObject({ campaign: "SOUP - Body Sculpting - CBO", spend: 24.03, leads: 2, cpl: 12.015, inCrm: 1, closed: 1 })
    // No leads means no cost per lead, not a cost of zero.
    expect(rows[1]).toMatchObject({ campaign: "", cpl: null, inCrm: 0, closed: 0 })
  })
  it("is empty for a client with no ads", () => {
    expect(adRows(null)).toEqual([])
    expect(adRows({ facebook: {} })).toEqual([])
  })
})

describe("callRows", () => {
  it("lists every call newest first, answered when it has talk time", () => {
    const rows = callRows([
      { id: "h1", first_name: "Leanne", last_name: "Turner", call_logs: [
        { call_time_iso: "2026-11-04T18:37:00Z", duration: 0, caller_name: "Priya", call_status: "outbound" },
        { call_time_iso: "2026-11-04T19:27:00Z", duration: 412, caller_name: "Priya", call_status: "outbound", recording_url: "https://x/r.mp3" },
      ] },
      { id: "h2", phone: "07700 900123", call_logs: [{ call_time_iso: "2026-11-05T09:00:00Z", duration: 30 }] },
      { id: "h3", first_name: "No", last_name: "Calls" },
    ])
    expect(rows.map((r) => [r.name, r.outcome, r.seconds])).toEqual([["07700 900123", "answered", 30], ["Leanne Turner", "answered", 412], ["Leanne Turner", "none", 0]])
    expect(rows[1]).toMatchObject({ caller: "Priya", recording: "https://x/r.mp3", direction: "Outbound" })
    expect(rows[0]).toMatchObject({ caller: "", recording: "", direction: "Inbound" })
    expect(callRows(undefined)).toEqual([])
  })
})

describe("labels, search and sort", () => {
  it("writes lengths as minutes and seconds", () => {
    expect([lengthLabel(412), lengthLabel(65), lengthLabel(0)]).toEqual(["6:52", "1:05", "—"])
  })
  it("writes a missing time as a dash", () => {
    expect(whenLabel("")).toBe("—")
    expect(whenLabel("not a date")).toBe("—")
    expect(whenLabel("2026-11-04T18:31:00")).toBe("4 Nov · 18:31")
  })
  it("searches the named fields only", () => {
    const rows = [{ name: "Leanne", ad: "Timelapse" }, { name: "Hannah", ad: "Body Sculpting" }]
    expect(searchBy(rows, "time", ["name", "ad"]).map((r) => r.name)).toEqual(["Leanne"])
    expect(searchBy(rows, "time", ["name"])).toEqual([])
    expect(searchBy(rows, "  ", ["name"])).toHaveLength(2)
  })
  it("sorts numbers as numbers and text as text, blanks last either way", () => {
    const rows = [{ n: "b", v: 2 }, { n: "a", v: null }, { n: "c", v: 10 }]
    expect(sortBy(rows, { id: "v", dir: "desc" }).map((r) => r.n)).toEqual(["c", "b", "a"])
    expect(sortBy(rows, { id: "v", dir: "asc" }).map((r) => r.n)).toEqual(["b", "c", "a"])
    expect(sortBy(rows, { id: "n", dir: "asc" }).map((r) => r.n)).toEqual(["a", "b", "c"])
    expect(sortBy(rows, null)).toBe(rows)
  })
  it("reverses a column on its second press and starts another as asked", () => {
    expect(toggleSort({ id: "spend", dir: "desc" }, "spend")).toEqual({ id: "spend", dir: "asc" })
    expect(toggleSort({ id: "spend", dir: "desc" }, "name", "asc")).toEqual({ id: "name", dir: "asc" })
  })
})

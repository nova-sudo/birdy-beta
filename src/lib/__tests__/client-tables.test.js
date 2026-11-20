import { describe, expect, it } from "vitest"
import { adLevelRows, adRows, callRows, filterLeads, leadCounts, leadFilterOptions, leadRow, lengthLabel, repRows, searchBy, sortBy, toggleSort, whenLabel } from "../client-tables"

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

describe("repRows", () => {
  it("counts each caller's calls, answers, leads reached, talk time and last call, busiest first", () => {
    const rows = callRows([
      { id: "h1", first_name: "Leanne", client_name: "Aura", call_logs: [
        { call_time_iso: "2026-11-04T18:37:00Z", duration: 0, caller_name: "Priya" },
        { call_time_iso: "2026-11-04T19:27:00Z", duration: 400, caller_name: "Priya" },
      ] },
      { id: "h2", first_name: "Jade", client_name: "No Client Group", call_logs: [{ call_time_iso: "2026-11-05T09:00:00Z", duration: 200, caller_name: "Priya" }, { call_time_iso: "2026-11-05T10:00:00Z", duration: 60 }] },
    ])
    expect(rows.map((r) => r.client)).toEqual(["", "", "Aura", "Aura"])
    expect(repRows(rows)).toEqual([
      { id: "Priya", name: "Priya", named: true, calls: 3, answered: 2, talk: 600, leads: 2, last: "2026-11-05T09:00:00Z", answerRate: (2 / 3) * 100, average: 300 },
      { id: "unnamed", name: "No caller name", named: false, calls: 1, answered: 1, talk: 60, leads: 1, last: "2026-11-05T10:00:00Z", answerRate: 100, average: 60 },
    ])
    expect(repRows(undefined)).toEqual([])
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

describe("lead filters", () => {
  const rows = [
    leadRow({ contactId: "1", source: "Facebook", contactType: "lead", tags: ["hifu", "cold lead"], opportunities: [{ status: "open" }, { status: "lost" }] }),
    leadRow({ contactId: "2", source: "Website", contactType: "contact", tags: ["hifu"], opportunities: [{ status: "won" }] }),
    leadRow({ contactId: "3", source: "Facebook", contactType: "lead" }),
  ]
  it("offers the values present in the loaded leads, A to Z", () => {
    expect(leadFilterOptions(rows)).toEqual({ source: ["Facebook", "Website"], type: ["contact", "lead"], status: ["lost", "open", "won"], tag: ["cold lead", "hifu"] })
  })
  it("matches any chosen value within a filter and every filter that has a choice", () => {
    expect(filterLeads(rows, { tag: ["hifu"] }).map((r) => r.id)).toEqual(["1", "2"])
    expect(filterLeads(rows, { tag: ["hifu"], source: ["Facebook"] }).map((r) => r.id)).toEqual(["1"])
    expect(filterLeads(rows, { status: ["lost", "won"] }).map((r) => r.id)).toEqual(["1", "2"])
    expect(filterLeads(rows, { source: [] })).toBe(rows)
    expect(filterLeads(rows, {})).toBe(rows)
  })
})

describe("adLevelRows", () => {
  const group = { facebook: {
    campaigns: [{ id: "c1", name: "SOUP - CBO", spend: 50, results: 4 }, { id: "c2", name: "Paused", spend: 0, results: 0 }],
    adsets: [{ id: "s1", name: "Lookalike 1%", campaign_id: "c1", spend: 50, results: 4 }],
    ads: [{ id: "a1", name: "Timelapse", campaign_id: "c1", spend: 24, results: 2 }],
  } }
  const rollup = { by_campaign: { c1: { contacts: 3, won: 1 } }, by_adset: { s1: { contacts: 3, won: 1 } }, by_ad: { a1: { contacts: 1, won: 1 } } }
  it("gives each level its own rows and CRM figures, with the campaign as the parent below campaign level", () => {
    expect(adLevelRows(group, rollup, "campaigns")).toEqual([expect.objectContaining({ name: "SOUP - CBO", parent: "", spend: 50, leads: 4, cpl: 12.5, inCrm: 3, closed: 1 })])
    expect(adLevelRows(group, rollup, "adsets")[0]).toMatchObject({ name: "Lookalike 1%", parent: "SOUP - CBO", inCrm: 3 })
    expect(adLevelRows(group, rollup, "ads")[0]).toMatchObject({ name: "Timelapse", parent: "SOUP - CBO", inCrm: 1 })
  })
  it("copes with no roll-up yet and with a client that has no ad sets", () => {
    expect(adLevelRows(group, undefined, "campaigns")[0]).toMatchObject({ inCrm: 0, closed: 0 })
    expect(adLevelRows({ facebook: {} }, rollup, "adsets")).toEqual([])
  })
})

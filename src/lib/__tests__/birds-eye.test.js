import { describe, expect, it } from "vitest"
import { buildFinding, buildTiles, calledShare, change, chartKeys, comparisonLabel, greeting, previousValues, previousWindow, rankCampaigns, shiftDay } from "../birds-eye"

const money = (n, d = 0) => `£${Number(n).toFixed(d)}`
const NOW = { spend: 2888, leads: 962, closes: 29, cpl: 3, funnelCached: 1, funnelLeads: 962, funnelCalled: 280 }
const BEFORE = { spend: 2977, leads: 971, closes: 62, cpl: 3.07, funnelCached: 1, funnelLeads: 971, funnelCalled: 369 }

describe("change", () => {
  it("is the signed percentage, and nothing when there is no previous figure", () => {
    expect(change(50, 100)).toBe(-50)
    expect(change(150, 100)).toBe(50)
    expect(change(5, 0)).toBeNull()
    expect(change(5, undefined)).toBeNull()
  })
})

describe("comparisonLabel", () => {
  it("names the comparison only for ranges that have one", () => {
    expect(comparisonLabel("last_7d")).toBe("vs previous 7 days")
    expect(comparisonLabel("today")).toBe("vs yesterday")
    expect(comparisonLabel("last_30d")).toBeNull()
  })
})

describe("calledShare", () => {
  it("is called over leads, and nothing without a call centre, a ready funnel or any leads", () => {
    expect(Math.round(calledShare(NOW))).toBe(29)
    expect(calledShare(NOW, false)).toBeNull()
    expect(calledShare({ ...NOW, funnelCached: 0 })).toBeNull()
    expect(calledShare({ ...NOW, funnelLeads: 0 })).toBeNull()
  })
})

describe("buildTiles", () => {
  it("leads the agency with spend, leads, closed and leads called", () => {
    const tiles = buildTiles({ current: NOW, previous: BEFORE, preset: "last_7d", hasCallCentre: true, money })
    expect(tiles.map((t) => t.label)).toEqual(["Ad spend", "Leads", "Closed", "Leads called"])
    expect(tiles[0]).toMatchObject({ goodWhen: "neither", note: "vs previous 7 days" })
    expect(tiles[2].note).toBe("down from 62")
    expect(tiles[3]).toMatchObject({ kind: "percent", note: "280 of 962 · down from 38%", noteTone: "bad" })
  })

  it("shows a dash and says why when nobody has a call centre", () => {
    const called = buildTiles({ current: NOW, previous: BEFORE, preset: "last_7d", hasCallCentre: false, money })[3]
    expect(called).toMatchObject({ value: null, note: "No client has a call centre" })
  })

  it("gives one client its cost per lead against its limit instead of calls", () => {
    const tiles = buildTiles({ current: { ...NOW, spend: 50, leads: 4, cpl: 12.5 }, previous: null, preset: "last_30d", hasCallCentre: true, scoped: true, cplTarget: 6, money })
    expect(tiles.map((t) => t.label)).toEqual(["Spend", "Leads", "CPL", "Closed"])
    expect(tiles[2]).toMatchObject({ goodWhen: "down", note: "limit £6.00", noteTone: "bad", delta: null })
    expect(tiles[0].note).toBeNull()
  })

  it("has no cost per lead for a client with no leads", () => {
    const cpl = buildTiles({ current: { ...NOW, leads: 0, cpl: 0 }, previous: null, preset: "last_7d", hasCallCentre: true, scoped: true, money })[2]
    expect(cpl.value).toBeNull()
  })
})

describe("buildFinding", () => {
  it("states the biggest movement, and the call share when that moved too", () => {
    expect(buildFinding({ current: NOW, previous: BEFORE, preset: "last_7d", hasCallCentre: true })).toEqual({
      lead: "Closes are down 53% on the previous 7 days",
      rest: ". Leads called went from 38% to 29%.",
    })
  })

  it("says a steady stretch is steady", () => {
    const finding = buildFinding({ current: NOW, previous: { ...NOW, closes: 30 }, preset: "last_7d", hasCallCentre: true })
    expect(finding.lead).toBe("A steady stretch")
  })

  it("says nothing without a previous period", () => {
    expect(buildFinding({ current: NOW, previous: null, preset: "last_7d", hasCallCentre: true })).toBeNull()
    expect(buildFinding({ current: NOW, previous: BEFORE, preset: "last_30d", hasCallCentre: true })).toBeNull()
  })

  it("writes spend in the singular", () => {
    const finding = buildFinding({ current: { ...NOW, spend: 6000 }, previous: { ...NOW, spend: 3000 }, preset: "today", hasCallCentre: false })
    expect(finding.lead).toBe("Ad spend is up 100% on yesterday")
  })
})

describe("chartKeys", () => {
  it("swaps calls for cost per lead inside a client", () => {
    expect(chartKeys(false)).toEqual(["leads", "spend", "calls", "closes"])
    expect(chartKeys(true)).toEqual(["leads", "spend", "cpl", "closes"])
  })
})

describe("rankCampaigns", () => {
  const campaigns = [
    { id: "1", name: "Timelapse", spend: 36, results: 3 },
    { id: "2", name: "Body Sculpting", spend: 10, results: 5 },
    { id: "3", name: "No leads yet", spend: 20, results: 0 },
    { id: "4", name: "Not running", spend: 0, results: 0 },
  ]
  it("ranks the campaigns that spent and brought a lead, cheapest first, marking any over the limit", () => {
    const rows = rankCampaigns(campaigns, { cplTarget: 6, money })
    expect(rows.map((r) => [r.name, r.cpl, r.tone])).toEqual([["Body Sculpting", 2, "accent"], ["Timelapse", 12, "danger"]])
    expect(rows[1].bar).toBe(100)
    expect(rows[1].meta).toBe("£36.00 spend · 3 leads")
  })
  it("is empty for a client with no campaigns", () => {
    expect(rankCampaigns(undefined)).toEqual([])
  })
})

describe("greeting", () => {
  it("follows the time of day", () => {
    expect([greeting(8), greeting(13), greeting(20)]).toEqual(["Good morning", "Good afternoon", "Good evening"])
  })
})

describe("the period before", () => {
  it("is the window of the same length just before the range", () => {
    expect(previousWindow("2026-11-12", "2026-11-19")).toEqual({ start: "2026-11-04", end: "2026-11-11", days: 8 })
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("does not exist for an open range, a single day or a very long range", () => {
    expect(previousWindow(null, null)).toBeNull()
    expect(previousWindow("2026-11-19", "2026-11-19")).toBeNull()
    expect(previousWindow("2026-01-01", "2026-11-19")).toBeNull()
  })

  it("lines each plotted day up with the same day one window earlier, counting a missing day as zero", () => {
    const rows = [{ date: "2026-11-09", leads: 4 }, { date: "2026-11-11", leads: 6 }, { date: "2026-11-12", leads: 9 }]
    expect(previousValues(["2026-11-12", "2026-11-13", "2026-11-14"], rows, 3, (r) => r.leads)).toEqual([4, 0, 6])
  })

  it("is absent when there is nothing recorded for the earlier window", () => {
    expect(previousValues(["2026-11-12", "2026-11-13"], [{ date: "2026-11-12", leads: 9 }], 2, (r) => r.leads)).toBeNull()
    expect(previousValues([], [], 2, (r) => r.leads)).toBeNull()
  })
})

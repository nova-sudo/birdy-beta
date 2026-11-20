import { describe, it, expect } from "vitest"
import {
  buyerClientRows, buyerFinding, buyerTiles, callFunnel, callSeries, callTotals, calledByClient, cheapestClients, coachClientRows, coachFinding, coachTiles,
  cplBands, cplChanges, cplStanding, previousByClient,
} from "../section-birds-eye"

const money = (n, d = 0) => `£${Number(n).toFixed(d)}`
const group = (id, name, { spend = 0, leads = 0, limit = null, funnel = null, calls = null, provider = "hotprospector", won = 0, status = "Active" } = {}) => ({
  id, name, client_status: status, call_log_provider: provider, targets: limit ? { cpl: limit } : {},
  facebook: { metrics: { insights: { spend, results: leads } } },
  gohighlevel: { metrics: { opportunity_stats: { won }, funnel } },
  hotprospector: { call_stats: calls ?? {}, daily_calls: [] },
})

describe("Media Buyer", () => {
  it("places a cost per lead against the client's limit", () => {
    expect(cplStanding(7, 6)).toBe("over")
    expect(cplStanding(5, 6)).toBe("under")
    expect(cplStanding(5, null)).toBe("nolimit")
    expect(cplStanding(null, 6)).toBe("none")
  })

  it("leaves inactive clients out and prices each active one", () => {
    const rows = buyerClientRows([
      group("a", "Aura", { spend: 50, leads: 4, limit: 6 }),
      group("b", "Beaulea", { spend: 0, leads: 0, limit: 6 }),
      group("c", "Gone", { spend: 10, leads: 1, status: "Inactive" }),
    ])
    expect(rows.map((r) => [r.name, r.cpl, r.standing])).toEqual([["Aura", 12.5, "over"], ["Beaulea", null, "none"]])
  })

  it("says how many clients with a limit are over it on the CPL tile", () => {
    const rows = buyerClientRows([group("a", "Aura", { spend: 50, leads: 4, limit: 6 }), group("b", "B", { spend: 20, leads: 10, limit: 6 }), group("c", "C", { spend: 20, leads: 10 })])
    const tiles = buyerTiles({ current: { spend: 90, leads: 24, cpl: 3.75 }, previous: { spend: 100, leads: 20, cpl: 5 }, preset: "last_7d", rows })
    expect(tiles.map((t) => t.label)).toEqual(["Spend", "Leads", "CPL"])
    expect(tiles[2]).toMatchObject({ value: 3.75, goodWhen: "down", note: "1 of 2 clients over their limit", noteTone: "bad" })
    expect(tiles[1].delta).toBeCloseTo(20)
  })

  it("counts clients in each band", () => {
    const rows = [{ standing: "over" }, { standing: "under" }, { standing: "under" }, { standing: "none" }]
    expect(cplBands(rows).map((b) => [b.key, b.count])).toEqual([["under", 2], ["over", 1], ["nolimit", 0], ["none", 1]])
  })

  it("compares each client's cost per lead with the week before, biggest rise first", () => {
    const now = [group("a", "Aura", { spend: 60, leads: 4 }), group("b", "B", { spend: 30, leads: 10 })]
    const fortnight = [group("a", "Aura", { spend: 90, leads: 14 }), group("b", "B", { spend: 70, leads: 20 })]
    const before = previousByClient(fortnight, now, "last_7d")
    expect(before.get("a")).toMatchObject({ spend: 30, leads: 10 })
    const rows = cplChanges(buyerClientRows(now), before, { money })
    expect(rows.map((r) => [r.name, r.value, r.tone])).toEqual([["Aura", "+400%", "danger"], ["B", "-25%", "accent"]])
    expect(rows[0].meta).toBe("£3.00 to £15.00 a lead")
  })

  it("has nothing to compare for a range with no previous period", () => {
    expect(previousByClient([group("a", "Aura")], [group("a", "Aura")], "last_30d").size).toBe(0)
  })

  it("ranks clients cheapest first when there is nothing to compare", () => {
    const rows = buyerClientRows([group("a", "Aura", { spend: 60, leads: 4, limit: 6 }), group("b", "B", { spend: 30, leads: 10 })])
    expect(cheapestClients(rows, { money }).map((r) => [r.name, r.value, r.tone])).toEqual([["B", "£3.00", "accent"], ["Aura", "£15.00", "danger"]])
  })

  it("leads with the biggest move, and the clients over their limit", () => {
    const rows = buyerClientRows([group("a", "Aura", { spend: 60, leads: 4, limit: 6 })])
    expect(buyerFinding({ current: { spend: 100, leads: 10, cpl: 10 }, previous: { spend: 100, leads: 20, cpl: 5 }, preset: "last_7d", rows }))
      .toEqual({ lead: "Cost per lead is up 100% on the previous 7 days", rest: ". 1 of 1 clients with a limit is over it." })
    expect(buyerFinding({ current: { spend: 100, leads: 10, cpl: 10 }, previous: null, preset: "last_30d", rows: [] })).toBeNull()
  })
})

describe("Sales Coach", () => {
  const funnel = (leads, inCrm, called, closes) => ({ leads, in_crm: inCrm, called, closes })

  it("only counts clients that have a call centre", () => {
    const rows = coachClientRows([
      group("a", "Aura", { funnel: funnel(10, 8, 2, 1), calls: { total_calls: 10, answered_calls: 4 } }),
      group("b", "No dialler", { provider: "none", funnel: funnel(5, 5, 0, 0) }),
    ], "last_7d")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: "Aura", inCrm: 8, called: 2, share: 25, answered: 40, behind: "2 of 8 new in CRM called" })
  })

  it("names a client whose leads never reach the CRM", () => {
    const [row] = coachClientRows([group("a", "Aura", { funnel: funnel(100, 0, 0, 0) })], "last_7d")
    expect(row.behind).toBe("0 of 100 leads in the CRM")
  })

  it("says not ready rather than zero when the funnel is not cached", () => {
    const [row] = coachClientRows([group("a", "Aura")], "last_7d")
    expect(row).toMatchObject({ ready: false, inCrm: null, share: null, behind: null })
  })

  it("ranks clients by the share of new leads called, lowest first", () => {
    const rows = [{ id: "a", name: "A", share: 60, inCrm: 10, called: 6 }, { id: "b", name: "B", share: 0, inCrm: 18, called: 0 }, { id: "c", name: "C", share: null }]
    expect(calledByClient(rows).map((r) => [r.name, r.value, r.tone])).toEqual([["B", "0%", "danger"], ["A", "60%", "accent"]])
  })

  it("sums the dialler's own days for the range and the window before", () => {
    const d = (offset) => { const x = new Date(); x.setDate(x.getDate() - offset); return x.toISOString().slice(0, 10) }
    const g = group("a", "Aura")
    g.hotprospector.daily_calls = [{ date: d(1), calls: 10, talk_min: 30, called: 4 }, { date: d(2), calls: 5, talk_min: 10, called: 1 }, { date: d(9), calls: 20, talk_min: 40, called: 6 }]
    const totals = callTotals([g], "last_7d")
    expect(totals).toMatchObject({ calls: 15, talk: 40, called: 5, previous: { calls: 20, talk: 40, called: 6 } })
    const series = callSeries(totals.days, "last_7d")
    expect(series.calls.sum).toBe(15)
    expect(series.calls.previousValues).toHaveLength(series.calls.values.length)
  })

  it("builds the four tiles from the funnel and the dialler", () => {
    const tiles = coachTiles({
      current: { funnelCached: 1, funnelLeads: 20, funnelInCrm: 18, funnelCalled: 6, closes: 2 },
      previous: { funnelCached: 1, funnelInCrm: 20, funnelCalled: 10, closes: 4 },
      preset: "last_7d",
      calls: { calls: 40, talk: 100, previous: { calls: 50 } },
    })
    expect(tiles.map((t) => [t.label, t.value])).toEqual([["New in CRM", 18], ["Leads called", 6], ["Calls made", 40], ["Closed", 2]])
    expect(tiles[1]).toMatchObject({ note: "33% of new leads reached", noteTone: "bad" })
    expect(tiles[2]).toMatchObject({ note: "100 min on the phone", delta: -20 })
    expect(tiles[3].note).toBe("down from 4")
  })

  it("names calling as the problem when under half of new leads got a call", () => {
    const f = callFunnel({ funnelCached: 1, funnelInCrm: 357, funnelCalled: 121, funnelCloses: 17 })
    expect(f.stages.map((s) => [s.label, s.count, s.share])).toEqual([["New in CRM", 357, null], ["Called", 121, "34%"], ["Closed", 17, "5%"]])
    expect(f.diagnosis).toMatchObject({ state: "problem", title: "Problem found: calling" })
    expect(f.diagnosis.body).toContain("121 of 357 new leads in the CRM got a call (34%)")
    expect(callFunnel({ funnelCached: 0 })).toBeNull()
  })

  it("states the share called, against the week before", () => {
    expect(coachFinding({ current: { funnelCached: 1, funnelInCrm: 100, funnelCalled: 29 }, previous: { funnelCached: 1, funnelInCrm: 100, funnelCalled: 38 }, preset: "last_7d" }))
      .toEqual({ lead: "29% of new leads got a call", rest: ", against 38% in the previous 7 days." })
    expect(coachFinding({ current: { funnelCached: 0 } })).toBeNull()
  })
})

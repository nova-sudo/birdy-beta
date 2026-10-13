import { describe, expect, it } from "vitest"
import {
  addSection, applyOrder, canAdd, MAX_SECTIONS, moveSection, newSection, removeSection,
  sectionSummary, toTemplate, updateSection, withKeys,
} from "@/lib/report-editor"

const CATALOG = [
  { id: "spend", label: "Ad spend", available: false },
  { id: "leads", label: "Leads", available: true },
  { id: "cpl", label: "Cost per lead", available: true },
]

const keyed = (...types) => withKeys(types.map((type) => ({ type })))

describe("adding sections", () => {
  it("defaults a metric to the first metric the account actually has", () => {
    expect(newSection("metric", CATALOG)).toMatchObject({ metric: "leads", scope: "portfolio", compare: "previous" })
  })

  it("puts new sections above Birdy's take", () => {
    const s = addSection(keyed("alerts", "birdy_take"), newSection("ranking", CATALOG))
    expect(s.map((x) => x.type)).toEqual(["alerts", "ranking", "birdy_take"])
  })

  it("allows one take and twelve sections", () => {
    expect(canAdd(keyed("birdy_take"), "birdy_take")).toBe(false)
    const full = keyed(...Array(MAX_SECTIONS).fill("alerts"))
    expect(canAdd(full, "alerts")).toBe(false)
    expect(addSection(full, newSection("alerts"))).toBe(full)
  })
})

describe("ordering", () => {
  it("moves within bounds and never below the take", () => {
    const s = keyed("alerts", "underperforming_ads", "birdy_take")
    const down = moveSection(s, s[0]._key, +1)
    expect(down.map((x) => x.type)).toEqual(["underperforming_ads", "alerts", "birdy_take"])
    expect(moveSection(down, down[1]._key, +1)).toBe(down)       // already last before the take
    expect(moveSection(s, s[2]._key, -1)).toBe(s)                 // the take does not move
  })

  it("keeps the take last after a drag", () => {
    const s = keyed("alerts", "underperforming_ads", "birdy_take")
    const out = applyOrder(s, [s[1]._key, s[0]._key])
    expect(out.map((x) => x.type)).toEqual(["underperforming_ads", "alerts", "birdy_take"])
  })
})

describe("editing", () => {
  it("updates and removes by key", () => {
    const s = withKeys([{ type: "metric", metric: "spend" }, { type: "alerts" }])
    expect(updateSection(s, s[0]._key, { metric: "cpl" })[0].metric).toBe("cpl")
    expect(removeSection(s, s[0]._key).map((x) => x.type)).toEqual(["alerts"])
  })

  it("strips client keys and blank titles when saving", () => {
    const t = toTemplate({ frequency: "weekly", day: "Friday", time: "8:00 AM" }, "  ", withKeys([{ type: "alerts" }]))
    expect(t).toEqual({ frequency: "weekly", day: "Friday", time: "8:00 AM", title: null, sections: [{ type: "alerts" }] })
  })
})

describe("sectionSummary", () => {
  const byId = Object.fromEntries(CATALOG.map((m) => [m.id, m]))
  it("describes metrics, rankings and takes", () => {
    expect(sectionSummary({ type: "metric", metric: "cpl", scope: { client_id: "g1" }, compare: "target" }, byId, { g1: "Glow" }))
      .toBe("Cost per lead · Glow · vs target")
    expect(sectionSummary({ type: "metric", metric: "spend", scope: "portfolio", compare: "none" }, byId))
      .toBe("Ad spend · All clients")
    expect(sectionSummary({ type: "ranking", metric: "leads", direction: "worst", limit: 2 }, byId))
      .toBe("Bottom 2 clients by leads")
    expect(sectionSummary({ type: "birdy_take", focus: "costs" })).toBe("Focused on costs")
  })
})

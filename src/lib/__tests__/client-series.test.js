// The Client Detail chart's four series.
//
// The care here is that leads and spend come from two independent caches that
// cover different day ranges. Deriving CPL by position would pair a Tuesday's
// spend with a Thursday's leads the moment one cache starts a day earlier.

import { describe, it, expect } from "vitest"
import { buildClientSeries, hasData, CLIENT_CHART_METRICS } from "@/lib/client-series"

const group = ({ leads = [], spend = [] } = {}) => ({
  gohighlevel: { daily_leads: leads },
  facebook: { daily_spend: spend },
})

const leadRow = (date, new_leads, won = 0) => ({ date, new_leads, won })
const spendRow = (date, spend) => ({ date, spend })

/** Value at a given bucket label. */
const at = (series, label) =>
  series.values[series.labels.indexOf(label)]

describe("series", () => {
  it("builds all four metrics", () => {
    const series = buildClientSeries(group(), "Daily")
    expect(Object.keys(series).sort()).toEqual(["closes", "cpl", "leads", "spend"])
  })

  it("sums leads and closes from the lead cache", () => {
    const series = buildClientSeries(group({
      leads: [leadRow("2026-08-01", 10, 2), leadRow("2026-08-02", 15, 3)],
    }), "Daily")

    expect(series.leads.values.reduce((a, b) => a + b, 0)).toBe(25)
    expect(series.closes.values.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it("sums spend from the Meta cache", () => {
    const series = buildClientSeries(group({
      spend: [spendRow("2026-08-01", 100), spendRow("2026-08-02", 150)],
    }), "Daily")

    expect(series.spend.values.reduce((a, b) => a + b, 0)).toBe(250)
  })

  it("survives a client with neither cache", () => {
    const series = buildClientSeries({}, "Daily")
    expect(series.leads.values).toEqual([])
    expect(series.cpl.values).toEqual([])
  })
})

describe("cost per lead", () => {
  it("divides spend by leads within each bucket", () => {
    const series = buildClientSeries(group({
      leads: [leadRow("2026-08-01", 10)],
      spend: [spendRow("2026-08-01", 100)],
    }), "Daily")

    expect(series.cpl.values[0]).toBe(10)
  })

  it("pairs buckets by label, not by position", () => {
    // Spend starts a day before leads do. Index 0 of each is a different day,
    // so a positional pairing would divide the 1st's spend by the 2nd's leads.
    const series = buildClientSeries(group({
      spend: [spendRow("2026-08-01", 500), spendRow("2026-08-02", 100)],
      leads: [leadRow("2026-08-02", 10)],
    }), "Daily")

    // The 2nd's £100 over the 2nd's 10 leads is £10 — not £50.
    const second = series.cpl.values[series.spend.labels.length - 1]
    expect(second).toBe(10)
  })

  it("leaves a bucket with spend but no leads undefined", () => {
    // Zero would draw a spend-heavy week as free.
    const series = buildClientSeries(group({
      spend: [spendRow("2026-08-01", 500)],
      leads: [],
    }), "Daily")

    expect(series.cpl.values[0]).toBeNull()
  })

  it("leaves a bucket with no spend and no leads undefined", () => {
    const series = buildClientSeries(group({
      spend: [spendRow("2026-08-01", 0)],
    }), "Daily")
    expect(series.cpl.values[0]).toBeNull()
  })
})

describe("bucketing", () => {
  it("groups days into weeks when asked", () => {
    const series = buildClientSeries(group({
      leads: [
        leadRow("2026-08-03", 5), leadRow("2026-08-04", 5),
        leadRow("2026-08-05", 5),
      ],
    }), "Weekly")

    expect(series.leads.values.reduce((a, b) => a + b, 0)).toBe(15)
    expect(series.leads.values.length).toBeLessThan(3)
  })
})

describe("hasData", () => {
  it("is false for an empty or all-zero series", () => {
    expect(hasData(undefined)).toBe(false)
    expect(hasData({ values: [] })).toBe(false)
    expect(hasData({ values: [0, 0, 0] })).toBe(false)
  })

  it("is false when every bucket is undefined", () => {
    // An all-null CPL series has nothing to draw.
    expect(hasData({ values: [null, null] })).toBe(false)
  })

  it("is true once anything is non-zero", () => {
    expect(hasData({ values: [0, 3, 0] })).toBe(true)
  })
})

describe("metric definitions", () => {
  it("lists the design's four, in order", () => {
    expect(CLIENT_CHART_METRICS.map((m) => m.key)).toEqual([
      "leads", "spend", "cpl", "closes",
    ])
  })
})

import { describe, it, expect } from "vitest"
import {
  DEFAULT_METRICS,
  applyDefaultMetrics,
  defaultMetricFormat,
  getDefaultMetric,
  isDefaultMetric,
} from "../default-metrics"
import { formatMetric } from "../format-metric"
import { sourceForCategory } from "../metric-sources"
import { formatMetricValue } from "../metrics"

const roas = () => getDefaultMetric("roas")

describe("default metrics", () => {
  it("badges every default as Birdy's own", () => {
    for (const metric of DEFAULT_METRICS) {
      expect(sourceForCategory(metric.category)).toBe("birdy")
    }
  })

  it("knows which ids it owns", () => {
    expect(isDefaultMetric("roas")).toBe(true)
    expect(isDefaultMetric("meta_spend")).toBe(false)
    expect(isDefaultMetric("custom_123")).toBe(false)
  })
})

describe("ROAS", () => {
  it("returns revenue over spend", () => {
    expect(roas().compute({ ghl_revenue: 15400, meta_spend: 1000 })).toBeCloseTo(15.4)
  })

  it("falls back to the campaign-level spend key", () => {
    expect(roas().compute({ ghl_revenue: 500, spend: 200 })).toBeCloseTo(2.5)
  })

  it("reads zero rather than Infinity where nothing was spent", () => {
    expect(roas().compute({ ghl_revenue: 900, meta_spend: 0 })).toBe(0)
    expect(roas().compute({ ghl_revenue: 900 })).toBe(0)
    expect(roas().compute({})).toBe(0)
  })

  it("survives junk on the row", () => {
    expect(roas().compute({ ghl_revenue: "nope", meta_spend: 100 })).toBe(0)
    expect(roas().compute(null)).toBe(0)
  })

  it("displays as a multiple to one decimal", () => {
    expect(defaultMetricFormat("roas")).toBe("multiplier")
    expect(formatMetric(15.44, "multiplier")).toBe("15.4x")
    expect(formatMetric(15.46, "multiplier")).toBe("15.5x")
    expect(formatMetric(15, "multiplier")).toBe("15.0x")
    expect(formatMetric(0, "multiplier")).toBe("0.0x")
  })

  it("keeps that format wherever a metric value is rendered", () => {
    // Would otherwise fall through to the integer rule and print "15".
    expect(formatMetricValue(15.44, "roas")).toBe("15.4x")
  })
})

describe("applyDefaultMetrics", () => {
  it("writes each default onto the row it is given", () => {
    const row = { ghl_revenue: 2000, meta_spend: 500 }
    const result = applyDefaultMetrics(row)

    expect(result).toBe(row)
    expect(row.roas).toBeCloseTo(4)
  })

  it("recomputes rather than trusting a value already on the row", () => {
    const row = { ghl_revenue: 2000, meta_spend: 500, roas: 99 }
    applyDefaultMetrics(row)
    expect(row.roas).toBeCloseTo(4)
  })
})

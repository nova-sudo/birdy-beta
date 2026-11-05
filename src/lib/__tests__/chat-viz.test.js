// Shaping for the chat's inline visuals. The payloads below are what the
// backend's render_ui tool writes (birdy-backend ai/tools/render_ui_tools.py);
// the "older" cases are the hand-typed shapes stored in past replies.
import { describe, it, expect } from "vitest"
import { formatTick, formatValue, shapeChart, shapeDelta } from "@/lib/chat-viz"
import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics"

const combo = {
  type: "composed", title: "Ad spend vs CPL", subtitle: "All clients · last 3 days", format: "currency", currency: "£",
  data: [{ label: "Oct 1", spend: 120.5, cpl: 14.1 }, { label: "Oct 2", spend: 98, cpl: 12.25 }, { label: "Oct 3", spend: 143, cpl: null }],
  series: [
    { key: "spend", name: "Ad spend", type: "bar", axis: "left", format: "currency", currency: "£" },
    { key: "cpl", name: "CPL", type: "line", axis: "right", format: "currency", currency: "£" },
  ],
  sort: false,
}

describe("shapeChart", () => {
  it("keeps a combo chart's series, axes and time order", () => {
    const c = shapeChart(combo)
    expect(c.kind).toBe("composed")
    expect(c.multi).toBe(true)
    expect(c.series.map((s) => [s.key, s.type, s.axis])).toEqual([["spend", "bar", "left"], ["cpl", "line", "right"]])
    expect(c.rows.map((r) => r.label)).toEqual(["Oct 1", "Oct 2", "Oct 3"])
    expect(c.rows[2].cpl).toBeNull()
  })

  it("never re-sorts a single-series line", () => {
    const c = shapeChart({ type: "line", data: [{ label: "a", value: 3 }, { label: "b", value: 9 }, { label: "c", value: 1 }], sort: false })
    expect(c.rows.map((r) => r.value)).toEqual([3, 9, 1])
    expect(c.kind).toBe("line")
  })

  it("ranks bars and lays many of them out horizontally", () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ label: `Client ${i}`, value: i + 1 }))
    const c = shapeChart({ type: "bar", data })
    expect(c.horizontal).toBe(true)
    expect(c.rows[0].value).toBe(8)
  })

  it("drops non-positive donut slices and totals the rest", () => {
    const c = shapeChart({ type: "donut", data: [{ label: "a", value: 30 }, { label: "b", value: 0 }, { label: "c", value: 10 }] })
    expect(c.rows.map((r) => r.label)).toEqual(["a", "c"])
    expect(c.total).toBe(40)
  })

  it("infers series from an older multi-key payload", () => {
    const c = shapeChart({ type: "line", data: [{ label: "Jan", spend: 1, leads: 2 }] })
    expect(c.series.map((s) => [s.key, s.axis])).toEqual([["spend", "left"], ["leads", "right"]])
  })

  it("returns null for nothing to draw", () => {
    expect(shapeChart({ type: "bar", data: [] })).toBeNull()
    expect(shapeChart({ type: "bar", data: [{ label: "a", value: 0 }] })).toBeNull()
  })
})

describe("shapeDelta", () => {
  it("reads a percent change with the metric's polarity", () => {
    expect(shapeDelta({ deltaPct: -12.5, polarity: "lower", deltaLabel: "vs previous 30 days" })).toEqual({
      direction: "down", value: "12.5%", polarity: LOWER_IS_BETTER, label: "vs previous 30 days",
    })
    expect(shapeDelta({ deltaPct: 8 })).toMatchObject({ direction: "up", value: "8%", polarity: HIGHER_IS_BETTER })
  })

  it("keeps a neutral metric's direction without calling it good or bad", () => {
    expect(shapeDelta({ deltaPct: -1.7, polarity: "neutral" })).toMatchObject({ direction: "down", polarity: "neutral" })
  })

  it("shows a flat delta without a direction", () => {
    expect(shapeDelta({ deltaPct: 0 })).toMatchObject({ direction: null, value: "0%" })
  })

  it("reads an older absolute delta in the metric's unit", () => {
    expect(shapeDelta({ delta: -3141, format: "currency", currency: "£" })).toMatchObject({ direction: "down", value: "£3,141" })
    expect(shapeDelta({ label: "x" })).toBeNull()
  })
})

describe("formatValue / formatTick", () => {
  it("keeps pence on small money and drops them on large", () => {
    expect(formatValue(14.2, "currency", "£")).toBe("£14.20")
    expect(formatValue(12480.4, "currency", "£")).toBe("£12,480")
    expect(formatValue(null, "currency", "£")).toBe("–")
  })

  it("prints compact ticks per format", () => {
    expect(formatTick(12500, "currency", "£")).toBe("£12.5K")
    expect(formatTick(2.5, "currency", "£")).toBe("£2.5")
    expect(formatTick(42, "percentage")).toBe("42%")
    expect(formatTick(3.24, "multiplier")).toBe("3.2x")
  })
})

describe("labels and currencies from tool results", () => {
  it("prints ISO dates as day and month", async () => {
    const { prettyLabel } = await import("@/lib/chat-viz")
    expect(prettyLabel("2026-10-03")).toBe("3 Oct")
    expect(prettyLabel("Aura")).toBe("Aura")
    expect(shapeChart({ type: "line", data: [{ label: "2026-09-20", value: 1 }, { label: "2026-09-21", value: 2 }] }).rows[0].label).toBe("20 Sep")
  })

  it("turns an ad account's ISO currency code into its symbol", () => {
    expect(formatTick(280, "currency", "GBP")).toBe("£280")
    expect(formatValue(14.2, "currency", "EUR")).toBe("€14.20")
    expect(formatValue(14.2, "currency", "SEK")).toBe("SEK 14.20")
  })
})

// Colouring a metric against the client's own target.
//
// The handoff asks whether CPL should redden "past a threshold" without naming
// one. A threshold nobody chose is a judgement invented on the agency's
// behalf — £9 CPL is good or bad entirely depending on what they set out to
// pay — so these pin down that colour appears only where a target exists.

import { describe, it, expect } from "vitest"
import { metricTone, TONE } from "@/lib/metric-tone"

describe("cost metrics (lower is better)", () => {
  it("is good at or under target", () => {
    expect(metricTone(9, 10, "lower")).toBe(TONE.good)
    expect(metricTone(10, 10, "lower")).toBe(TONE.good)
    expect(metricTone(4, 10, "lower")).toBe(TONE.good)
  })

  it("warns as it drifts over", () => {
    expect(metricTone(13, 10, "lower")).toBe(TONE.warn)   // 10/13 ≈ 0.77
  })

  it("is bad well over target", () => {
    expect(metricTone(20, 10, "lower")).toBe(TONE.bad)    // 10/20 = 0.50
  })
})

describe("no target means no opinion", () => {
  it.each([null, undefined, 0, NaN, ""])("stays neutral for a target of %p", (t) => {
    expect(metricTone(9, t, "lower")).toBe(TONE.neutral)
  })

  it("stays neutral when the value is unknown", () => {
    expect(metricTone(null, 10, "lower")).toBe(TONE.neutral)
    expect(metricTone(undefined, 10, "lower")).toBe(TONE.neutral)
  })

  it("stays neutral at zero cost", () => {
    // Not a triumph — it means nothing was spent, or nothing landed.
    expect(metricTone(0, 10, "lower")).toBe(TONE.neutral)
  })
})

describe("higher-is-better metrics", () => {
  it("greens at or above target", () => {
    expect(metricTone(100, 100, "higher")).toBe(TONE.good)
    expect(metricTone(95, 100, "higher")).toBe(TONE.good)
  })

  it("degrades below it", () => {
    expect(metricTone(75, 100, "higher")).toBe(TONE.warn)
    expect(metricTone(50, 100, "higher")).toBe(TONE.bad)
  })
})

describe("consistency with the rest of the product", () => {
  it("uses the same 90% band as the goals strip and health rule", () => {
    // A client must not read green here and behind on the overview.
    expect(metricTone(90, 100, "higher")).toBe(TONE.good)
    expect(metricTone(89, 100, "higher")).not.toBe(TONE.good)
  })
})

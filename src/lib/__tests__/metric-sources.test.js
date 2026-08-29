import { describe, it, expect } from "vitest"
import { SOURCE_STYLES, SOURCE_TABS, matchesSourceTab, sourceForCategory } from "../metric-sources"

describe("sourceForCategory", () => {
  it("collapses both Meta categories onto one badge", () => {
    // Account-level and campaign-level Meta metrics are catalogued apart but
    // come from the same place, which is what the badge answers.
    expect(sourceForCategory("Meta Ads")).toBe("meta")
    expect(sourceForCategory("Campaigns")).toBe("meta")
  })

  it("collapses both call-centre categories onto Sales", () => {
    expect(sourceForCategory("Call Center")).toBe("sales")
    expect(sourceForCategory("Call Center Agents")).toBe("sales")
  })

  it("files GHL opportunity fields under GoHighLevel", () => {
    expect(sourceForCategory("GoHighLevel")).toBe("ghl")
    expect(sourceForCategory("Lead Fields")).toBe("ghl")
  })

  it("calls derived ratios Birdy's own", () => {
    expect(sourceForCategory("Calculated")).toBe("birdy")
  })

  it("falls back to birdy rather than mislabelling an unknown category", () => {
    expect(sourceForCategory("Something New")).toBe("birdy")
    expect(sourceForCategory(undefined)).toBe("birdy")
  })
})

describe("source tabs", () => {
  it("has a style for every tab except 'all'", () => {
    for (const tab of SOURCE_TABS) {
      if (tab.key === "all") continue
      expect(SOURCE_STYLES[tab.key]).toBeDefined()
    }
  })

  it("puts every metric under the all tab", () => {
    for (const key of Object.keys(SOURCE_STYLES)) {
      expect(matchesSourceTab("all", key)).toBe(true)
    }
  })

  it("shows a metric only under its own source tab", () => {
    expect(matchesSourceTab("meta", "meta")).toBe(true)
    expect(matchesSourceTab("meta", "ghl")).toBe(false)
    expect(matchesSourceTab("custom", "custom")).toBe(true)
  })
})

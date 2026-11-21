import { describe, expect, it } from "vitest"
import { hitAgo, installLink, trackingRow, trackingSetupHref, trackingSummary } from "@/lib/lead-tracking"

const NOW = Date.parse("2026-11-21T12:00:00Z")
const ago = (mins) => new Date(NOW - mins * 60000).toISOString()

describe("hitAgo", () => {
  it.each([
    [null, null],
    ["nope", null],
    [ago(1), "just now"],
    [ago(30), "30m ago"],
    [ago(180), "3h ago"],
    [ago(60 * 50), "2d ago"],
  ])("%s -> %s", (iso, want) => expect(hitAgo(iso, NOW)).toBe(want))
})

describe("trackingSummary", () => {
  it("counts clients with no lead source, legacy names included", () => {
    const clients = [{ method: "unknown" }, { method: null }, { method: "external_form" }, { method: "landing_page" }]
    expect(trackingSummary(clients)).toEqual({ total: 4, unset: 2, set: 2 })
    expect(trackingSummary([])).toEqual({ total: 0, unset: 0, set: 0 })
  })
})

describe("trackingRow", () => {
  it("needs no script for Meta forms and form tools", () => {
    const row = trackingRow({ group_id: "g1", group_name: "Aura", method: "instant_form", installed: false, tracked_leads: 9 }, NOW)
    expect(row).toMatchObject({ id: "g1", name: "Aura", source: "Meta forms", needsScript: false, script: "none", captured: null })
  })

  it("says whether a landing page's pixel is live", () => {
    const live = trackingRow({ group_id: "g2", group_name: "B", method: "landing_page", installed: true, tracked_leads: 4, last_seen_at: ago(5), site_id: "s1" }, NOW)
    expect(live).toMatchObject({ script: "live", captured: 4, lastHit: "5m ago", siteId: "s1" })
    expect(trackingRow({ group_id: "g3", method: "landing_page", installed: false }, NOW)).toMatchObject({ script: "not_seen", captured: 0, siteId: null })
  })

  it("shows an unset source as Not set", () => {
    expect(trackingRow({ group_id: "g4", method: "unknown" }, NOW).source).toBe("Not set")
  })
})

describe("links", () => {
  it("builds the install link and setup page", () => {
    expect(installLink("https://app.test/", "s1")).toBe("https://app.test/install/s1")
    expect(trackingSetupHref("g1")).toBe("/clients/g1/tracking")
  })
})

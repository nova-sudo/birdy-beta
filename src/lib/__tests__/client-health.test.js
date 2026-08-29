// Client health — the manually-set Healthy / Warning / Critical axis behind
// the Client Hub tabs and the pill on both screens.
//
// Health is a second, independent axis from status: a client can be Inactive
// and Healthy, or Active and Critical. Nothing derives it, so these cover the
// normalising and counting only.

import { describe, it, expect } from "vitest"
import {
  normalizeHealth,
  matchesHealthFilter,
  healthCounts,
  matchesStatusFilter,
  HEALTH_VALUES,
  HEALTHY,
  WARNING,
  CRITICAL,
} from "@/lib/client-status"

const g = (health, client_status = "Active") => ({ health, client_status })

describe("normalizeHealth", () => {
  it.each(HEALTH_VALUES)("passes %s through", (h) => {
    expect(normalizeHealth(h)).toBe(h)
  })

  it.each([
    ["healthy", HEALTHY],
    ["WARNING", WARNING],
    ["  critical  ", CRITICAL],
  ])("normalises %s to %s", (input, expected) => {
    expect(normalizeHealth(input)).toBe(expected)
  })

  it.each([undefined, null, "", "   ", "Fine", 42])(
    "falls back to Healthy for %p",
    (input) => {
      // Most clients have never had a health chosen; they must read as
      // Healthy, matching the API's own default rather than blank.
      expect(normalizeHealth(input)).toBe(HEALTHY)
    }
  )
})

describe("matchesHealthFilter", () => {
  it("matches the chosen value", () => {
    expect(matchesHealthFilter(g(WARNING), WARNING)).toBe(true)
    expect(matchesHealthFilter(g(WARNING), CRITICAL)).toBe(false)
  })

  it("lets everything through on 'all'", () => {
    expect(matchesHealthFilter(g(CRITICAL), "all")).toBe(true)
    expect(matchesHealthFilter(g(CRITICAL), null)).toBe(true)
  })

  it("matches a differently-cased stored value", () => {
    expect(matchesHealthFilter({ health: "critical" }, CRITICAL)).toBe(true)
  })

  it("counts a client with no health as Healthy", () => {
    expect(matchesHealthFilter({}, HEALTHY)).toBe(true)
    expect(matchesHealthFilter({}, CRITICAL)).toBe(false)
  })
})

describe("healthCounts", () => {
  it("counts each bucket", () => {
    const counts = healthCounts([
      g(HEALTHY), g(HEALTHY), g(WARNING), g(CRITICAL), g(CRITICAL), g(CRITICAL),
    ])
    expect(counts).toEqual({ healthy: 2, warning: 1, critical: 3 })
  })

  it("folds unset health into Healthy", () => {
    expect(healthCounts([{}, { health: null }, g(WARNING)]))
      .toEqual({ healthy: 2, warning: 1, critical: 0 })
  })

  it("is null-safe for an unloaded list", () => {
    expect(healthCounts(undefined)).toEqual({ healthy: 0, warning: 0, critical: 0 })
  })

  it("counts every client regardless of status", () => {
    // An Inactive client still has a health, and the Critical tab should show
    // it — the two axes are independent.
    const counts = healthCounts([g(CRITICAL, "Inactive"), g(CRITICAL, "Active")])
    expect(counts.critical).toBe(2)
  })
})

describe("the two axes are independent", () => {
  it("an Inactive client can be Healthy", () => {
    const client = g(HEALTHY, "Inactive")
    expect(matchesHealthFilter(client, HEALTHY)).toBe(true)
    expect(matchesStatusFilter(client, "Inactive")).toBe(true)
    expect(matchesStatusFilter(client, "Active")).toBe(false)
  })

  it("an Active client can be Critical", () => {
    const client = g(CRITICAL, "Active")
    expect(matchesHealthFilter(client, CRITICAL)).toBe(true)
    expect(matchesStatusFilter(client, "Active")).toBe(true)
  })
})

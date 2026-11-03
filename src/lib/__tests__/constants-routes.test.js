import { describe, it, expect } from "vitest"
import { PROTECTED_ROUTES, PROTECTED_ROUTE_PREFIXES, isProtectedPath } from "../constants"

describe("PROTECTED_ROUTES", () => {
  it("guards the hub and the dashboards list under it (exact-match consumers)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub")
    expect(PROTECTED_ROUTES).toContain("/hub/dashboards")
  })

  it("guards the agent setup wizard (its ?step= is not part of the pathname)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub/agents/media-buying/setup")
  })

  it("guards the new custom agent page", () => {
    expect(PROTECTED_ROUTES).toContain("/hub/agents/custom/new")
  })

  it("guards the agent page itself (final review minor 10)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub/agents/media-buying")
  })

  it("guards every custom agent page and its setup by prefix", () => {
    expect(PROTECTED_ROUTE_PREFIXES).toContain("/hub/agents/custom/")
    expect(isProtectedPath("/hub/agents/custom/ag1")).toBe(true)
    expect(isProtectedPath("/hub/agents/custom/ag1/setup")).toBe(true)
    expect(isProtectedPath("/hub")).toBe(true)
    expect(isProtectedPath("/login")).toBe(false)
    expect(isProtectedPath("/hub/agentsX")).toBe(false)
  })
})

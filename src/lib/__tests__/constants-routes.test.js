import { describe, it, expect } from "vitest"
import { PROTECTED_ROUTES } from "../constants"

describe("PROTECTED_ROUTES", () => {
  it("guards the hub and the dashboards list under it (exact-match consumers)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub")
    expect(PROTECTED_ROUTES).toContain("/hub/dashboards")
  })

  it("guards the agent setup wizard (its ?step= is not part of the pathname)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub/agents/media-buying/setup")
  })

  it("guards the agent page itself (final review minor 10)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub/agents/media-buying")
  })
})

import { describe, it, expect } from "vitest"
import { PROTECTED_ROUTES } from "../constants"

describe("PROTECTED_ROUTES", () => {
  it("guards the hub and the dashboards list under it (exact-match consumers)", () => {
    expect(PROTECTED_ROUTES).toContain("/hub")
    expect(PROTECTED_ROUTES).toContain("/hub/dashboards")
  })
})

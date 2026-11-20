import { describe, it, expect } from "vitest"
import { cn } from "../cn"

describe("cn", () => {
  it("keeps a by- text size and a by- text colour together", () => {
    expect(cn("text-by-body", "text-by-muted")).toBe("text-by-body text-by-muted")
  })

  it("lets a later by- value of the same kind win", () => {
    expect(cn("rounded-by-md shadow-by-card text-by-body", "rounded-by-lg shadow-by-floating text-by-caption")).toBe(
      "rounded-by-lg shadow-by-floating text-by-caption",
    )
  })

  it("drops falsy entries", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b")
  })
})

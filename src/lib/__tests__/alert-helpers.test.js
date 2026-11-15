import { describe, it, expect } from "vitest"
import { withEmailChannel, hasEmailChannel } from "@/lib/alert-helpers"

describe("withEmailChannel", () => {
  it("email switch adds email channel and keeps in_app", () => {
    expect(withEmailChannel(["in_app"], true)).toEqual(["in_app", "email"])
  })
  it("switching off removes only email", () => {
    expect(withEmailChannel(["in_app", "email"], false)).toEqual(["in_app"])
  })
  it("preserves other channels such as slack in both directions", () => {
    expect(withEmailChannel(["in_app", "slack"], true)).toEqual(["in_app", "slack", "email"])
    expect(withEmailChannel(["in_app", "slack", "email"], false)).toEqual(["in_app", "slack"])
  })
  it("never duplicates email", () => {
    expect(withEmailChannel(["in_app", "email"], true)).toEqual(["in_app", "email"])
  })
  it("undefined or empty input falls back to in_app", () => {
    expect(withEmailChannel(undefined, false)).toEqual(["in_app"])
    expect(withEmailChannel([], false)).toEqual(["in_app"])
    expect(withEmailChannel(undefined, true)).toEqual(["in_app", "email"])
    expect(withEmailChannel([], true)).toEqual(["in_app", "email"])
  })
  it("keeps in_app when it was missing", () => {
    expect(withEmailChannel(["slack"], false)).toEqual(["in_app", "slack"])
  })
})

describe("hasEmailChannel", () => {
  it("reads email from stored channels", () => {
    expect(hasEmailChannel(["in_app", "slack", "email"])).toBe(true)
    expect(hasEmailChannel(["in_app"])).toBe(false)
    expect(hasEmailChannel(undefined)).toBe(false)
  })
})

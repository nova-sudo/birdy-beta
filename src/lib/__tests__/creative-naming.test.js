import { describe, it, expect } from "vitest"
import { slugify, metaAdName } from "../creative-naming"

describe("slugify", () => {
  it("follows the backend rules", () => {
    expect(slugify("Mortgage myth #3 — UGC hook")).toBe("mortgage-myth-3-ugc-hook")
    expect(slugify("  Ünïcode   & spaces  ")).toBe("unicode-spaces")
    expect(slugify("x".repeat(80))).toHaveLength(40)
    expect(slugify("a".repeat(39) + " b").endsWith("-")).toBe(false)
  })
  it("is pure and may return empty", () => {
    expect(slugify("")).toBe("")
    expect(slugify(null)).toBe("")
    expect(slugify("###")).toBe("")
  })
})

describe("metaAdName", () => {
  it("joins code and slug with ' | '", () => {
    expect(metaAdName("CT-0048", "mortgage-myth-ugc")).toBe("CT-0048 | mortgage-myth-ugc")
  })
  it("uses untitled for an empty slug", () => {
    expect(metaAdName("CT-0001", "")).toBe("CT-0001 | untitled")
  })
})

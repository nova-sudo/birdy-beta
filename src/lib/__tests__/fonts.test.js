import { describe, it, expect, vi } from "vitest"

// next/font only runs inside the Next compiler; stand in a factory that
// records its options and hands back a distinct variable per family.
const calls = vi.hoisted(() => ({}))
vi.mock("next/font/google", () => {
  const make = (name, variable) => (opts) => {
    calls[name] = opts
    return { variable: `--font-${variable}` }
  }
  return { Outfit: make("Outfit", "x-outfit"), Geist_Mono: make("Geist_Mono", "x-mono") }
})

import { fontVariables, pdFontClass } from "@/lib/fonts"

describe("fonts", () => {
  it("puts both families' variables on the root string", () => {
    expect(fontVariables).toContain("--font-x-outfit")
    expect(fontVariables).toContain("--font-x-mono")
  })

  it("requests Outfit at 400-700 with swap", () => {
    expect(calls.Outfit.weight).toEqual(["400", "500", "600", "700"])
    expect(calls.Outfit.display).toBe("swap")
  })

  it("binds the CSS variable names the tokens reference", () => {
    expect(calls.Outfit.variable).toBe("--font-outfit")
    expect(calls.Geist_Mono.variable).toBe("--font-geist-mono")
  })

  it("keeps pdFontClass as a font-sans alias", () => {
    expect(pdFontClass).toBe("font-sans")
  })
})

// The model sometimes answers a percentage as LaTeX. Markdown eats the `\(`
// delimiters and the chat showed the raw formula; these pin down that it reads
// as plain arithmetic with the result, and that nothing else is rewritten.

import { describe, it, expect } from "vitest"
import { delatex } from "@/lib/chat-math"

describe("delatex", () => {
  it("shows only the result of the conversion-rate formula from the bug report", () => {
    expect(delatex("**Conversion Rate**: \\( \\frac{17}{232} \\times 100 \\approx 7.33\\% \\)")).toBe(
      "**Conversion Rate**: 7.33%",
    )
  })

  it("takes the last result of a chain and handles display math and $$ blocks", () => {
    expect(delatex("\\[ \\frac{2}{152} \\times 100 = 1.3157 \\approx 1.32\\% \\]")).toBe("1.32%")
    expect(delatex("$$\\frac{11}{151}$$")).toBe("11 / 151")
  })

  it("keeps compound parts grouped and unwraps text and nested fractions", () => {
    expect(delatex("\\( \\frac{\\text{Won} - 2}{\\frac{a}{b}} \\)")).toBe("(Won - 2) / (a / b)")
    expect(delatex("\\( \\$1{,}200 \\div 4 \\)")).toBe("$1,200 ÷ 4")
  })

  it("leaves currency, code and plain text alone", () => {
    const plain = "Spend was $1,200 vs $900 (up 33%)."
    expect(delatex(plain)).toBe(plain)
    const code = "Use `\\( x \\)` or\n```\n\\[ y \\]\n```"
    expect(delatex(code)).toBe(code)
    expect(delatex("")).toBe("")
    expect(delatex(undefined)).toBe(undefined)
  })

  it("leaves an unclosed span alone while the reply is still streaming", () => {
    expect(delatex("Rate: \\( \\frac{17}{2")).toBe("Rate: \\( \\frac{17}{2")
  })
})

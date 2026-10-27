import { describe, it, expect } from "vitest"
import { pageNumbers } from "../page-numbers"

describe("pageNumbers", () => {
  it("draws nothing worth clicking for a single page", () => {
    expect(pageNumbers(1, 1)).toEqual([1])
    expect(pageNumbers(1, 0)).toEqual([])
  })

  it("lists every page while they still fit", () => {
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("elides the middle on a long list", () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, "ellipsis", 20])
    expect(pageNumbers(9, 20)).toEqual([1, "ellipsis", 9, "ellipsis", 20])
    expect(pageNumbers(20, 20)).toEqual([1, "ellipsis", 19, 20])
  })

  it("prints a lone skipped page instead of an ellipsis for it", () => {
    // "1 ··· 3" would hide a single number behind a wider control.
    expect(pageNumbers(3, 20)).toEqual([1, 2, 3, "ellipsis", 20])
    expect(pageNumbers(18, 20)).toEqual([1, "ellipsis", 18, 19, 20])
  })

  it("never repeats a page number", () => {
    for (let total = 2; total <= 30; total++) {
      for (let cur = 1; cur <= total; cur++) {
        const nums = pageNumbers(cur, total).filter((n) => n !== "ellipsis")
        expect(new Set(nums).size).toBe(nums.length)
      }
    }
  })
})

import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
import { proposalErrorMessage, receiptLine } from "../proposals-api"

describe("receiptLine", () => {
  it("keeps enough of the reply to say something, without markdown", () => {
    expect(receiptLine("Done. **I put “Spring Promo v1” back** on both ad sets. More follows.")).toBe("Done. I put “Spring Promo v1” back on both ad sets.")
  })
  it("cuts a long reply to one line", () => {
    expect(receiptLine("a".repeat(300)).length).toBe(140)
  })
  it("is empty for no reply", () => {
    expect(receiptLine(undefined)).toBe("")
  })
})

describe("proposalErrorMessage", () => {
  it("says a 404 means it was decided elsewhere", () => {
    expect(proposalErrorMessage({ status: 404 })).toMatch(/already decided/)
  })
})

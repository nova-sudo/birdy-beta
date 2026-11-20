import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
import { normalizeProposal, pendingProposalsKey, proposalErrorMessage, receiptLine, undoErrorMessage } from "../proposals-api"

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

describe("normalizeProposal", () => {
  it("keeps a known status, and treats anything else as waiting", () => {
    expect(normalizeProposal({ id: "p", status: "approved" }).status).toBe("approved")
    expect(normalizeProposal({ id: "p", status: "weird" }).status).toBe("pending")
  })
  it("offers undo only when the server says so, and keeps where it came from", () => {
    const p = normalizeProposal({ id: "p", can_undo: "yes", origin: "sub_agent_run", sub_agent_id: "s1" })
    expect(p.can_undo).toBe(false)
    expect(p.origin).toBe("sub_agent_run")
    expect(p.sub_agent_id).toBe("s1")
    expect(normalizeProposal({ id: "p", origin: "elsewhere" }).origin).toBeNull()
  })
  it("drops a proposal with no id", () => {
    expect(normalizeProposal({ title: "x" })).toBeNull()
  })
})

describe("pending proposals", () => {
  it("asks for one agent's pending ones, or nothing", () => {
    expect(pendingProposalsKey("media_buyer")).toBe("/api/chat/proposals?status=pending&agent=media_buyer")
    expect(pendingProposalsKey(null)).toBeNull()
  })
})

describe("undoErrorMessage", () => {
  it("shows the server's reason when it can't undo", () => {
    expect(undoErrorMessage({ status: 409, code: "cannot_undo", detail: "The old form was deleted." })).toBe("The old form was deleted.")
  })
  it("says plainly when undo is not there yet", () => {
    expect(undoErrorMessage({ status: 404 })).toBe("Undo is not available yet.")
  })
})

import { describe, it, expect, vi } from "vitest"
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
import { getChat, hydrateChat, syncProposals, updateProposal } from "../chat-store"

describe("updateProposal", () => {
  it("keeps the owner's decision on the reply that carried the proposal", () => {
    hydrateChat("k1", { sessionId: "s", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "x", proposals: [{ id: "p1", status: "pending" }, { id: "p2", status: "pending" }] }] })
    updateProposal("k1", "p1", { status: "approved", session_id: "mb-1" })
    const [, reply] = getChat("k1").messages
    expect(reply.proposals).toEqual([{ id: "p1", status: "approved", session_id: "mb-1" }, { id: "p2", status: "pending" }])
  })
  it("leaves the chat alone for a proposal it doesn't have", () => {
    const before = getChat("k1")
    updateProposal("k1", "nope", { status: "approved" })
    expect(getChat("k1")).toBe(before)
  })
})

describe("syncProposals", () => {
  it("takes the decision recorded on the saved conversation, and leaves everything else alone", () => {
    hydrateChat("k2", { sessionId: "s", messages: [{ role: "assistant", content: "x", proposals: [{ id: "p1", status: "pending", title: "A" }, { id: "p2", status: "pending" }] }] })
    syncProposals("k2", [{ role: "assistant", content: "x", proposals: [{ id: "p1", status: "approved", session_id: "mb-2", can_undo: true }] }])
    const [reply] = getChat("k2").messages
    expect(reply.proposals).toEqual([{ id: "p1", status: "approved", title: "A", session_id: "mb-2", can_undo: true }, { id: "p2", status: "pending" }])
  })
  it("does nothing when the saved conversation has nothing new", () => {
    const before = getChat("k2")
    syncProposals("k2", [{ role: "assistant", content: "x", proposals: [{ id: "p2", status: "pending" }] }])
    syncProposals("k2", [{ role: "user", content: "hi" }])
    expect(getChat("k2")).toBe(before)
  })
})

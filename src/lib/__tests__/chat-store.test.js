import { describe, it, expect, vi, beforeEach } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { getChat, resetChat, sendChatMessage, subscribeChat } from "@/lib/chat-store"

const reply = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body })

beforeEach(() => apiRequest.mockReset())

describe("chat-store", () => {
  it("lands the reply and stops loading (writes after an emit are not lost)", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "Hi there", tools_used: ["propose_report"], session_id: "s1" }))
    const seen = []
    const off = subscribeChat("k1", () => seen.push(getChat("k1").loading))
    const tools = []

    await sendChatMessage("k1", { text: "hello" }, { onToolUsed: (t) => tools.push(t) })
    off()

    const chat = getChat("k1")
    expect(chat.loading).toBe(false)
    expect(chat.messages.map((m) => m.content)).toEqual(["hello", "Hi there"])
    expect(chat.sessionId).toBe("s1")
    expect(tools).toEqual(["propose_report"])
    expect(seen[seen.length - 1]).toBe(false)
  })

  it("drops a reply that arrives after the chat was reset", async () => {
    let resolve
    apiRequest.mockReturnValue(new Promise((r) => { resolve = r }))
    const sending = sendChatMessage("k2", { text: "old question" })
    resetChat("k2")
    resolve({ ok: true, status: 200, json: async () => ({ reply: "old answer", tools_used: [] }) })
    await sending

    expect(getChat("k2").messages).toEqual([])
    expect(getChat("k2").loading).toBe(false)
  })
})

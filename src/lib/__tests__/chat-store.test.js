import { describe, it, expect, vi, beforeEach } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { appendMessage, getChat, hydrateChat, resetChat, seedMessages, sendChatMessage, subscribeChat } from "@/lib/chat-store"

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

  it("sends agent_id in the /api/chat body, and leaves it out without one", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "ok", tools_used: [] }))
    await sendChatMessage("k-agent", { text: "hi", page: "agent_training", agentId: "ag1" })
    expect(JSON.parse(apiRequest.mock.calls[0][1].body).agent_id).toBe("ag1")
    await sendChatMessage("k-none", { text: "hi", page: "dashboard" })
    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).not.toHaveProperty("agent_id")
  })

  it("sends card_id when cardId given", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "ok", tools_used: [] }))
    await sendChatMessage("k-card", { text: "hi", page: "stock_card", agentId: "ag1", cardId: "c1" })
    const body = JSON.parse(apiRequest.mock.calls[0][1].body)
    expect(body.card_id).toBe("c1")
    expect(body.agent_id).toBe("ag1")
  })

  it("sends card_read_only only for a read-only card", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "ok", tools_used: [] }))
    await sendChatMessage("k-ro", { text: "do it", page: "stock_card", agentId: "ag1", cardId: "c1", cardReadOnly: true })
    expect(JSON.parse(apiRequest.mock.calls[0][1].body).card_read_only).toBe(true)
    await sendChatMessage("k-rw", { text: "do it", page: "stock_card", agentId: "ag1", cardId: "c1" })
    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).not.toHaveProperty("card_read_only")
  })

  it("omits card_id otherwise", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "ok", tools_used: [] }))
    await sendChatMessage("k-nocard", { text: "hi", page: "stock_lessons", agentId: "ag1" })
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).not.toHaveProperty("card_id")
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

  it("sends the dashboard and its live summary, and hands ops to onDashboardOps", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "Added it", tools_used: ["dashboard_apply"], dashboard_ops: [{ op: "setTitle", title: "New" }] }))
    let summary = "old"
    const getSummary = vi.fn(() => summary)
    summary = "live"
    const onDashboardOps = vi.fn(() => ({ applied: true, diff: ["Renamed dashboard"] }))

    await sendChatMessage("k3", { text: "rename it", page: "dashboards", dashboardId: "d1", getSummary }, { onDashboardOps })

    const body = JSON.parse(apiRequest.mock.calls[0][1].body)
    expect(body.dashboard_id).toBe("d1")
    expect(body.summary).toBe("live")
    expect(onDashboardOps).toHaveBeenCalledWith([{ op: "setTitle", title: "New" }], expect.objectContaining({ dashboard_id: "d1" }))
    const last = getChat("k3").messages.at(-1)
    expect(last.dashboard_ops).toEqual([{ op: "setTitle", title: "New" }])
    expect(last.dashboard_diff).toEqual(["Renamed dashboard"])
    expect(last.dashboard_applied).toBe(true)
  })

  it("leaves other pages' requests and messages as they were", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "Hi", tools_used: [] }))

    await sendChatMessage("k4", { text: "hello", page: "dashboard" })

    const body = JSON.parse(apiRequest.mock.calls[0][1].body)
    expect(body).not.toHaveProperty("dashboard_id")
    expect(body).not.toHaveProperty("summary")
    expect(getChat("k4").messages.at(-1)).toEqual({ role: "assistant", content: "Hi", tools_used: [] })
  })

  it("seeds an empty chat with a saved transcript once, and appends local messages", () => {
    seedMessages("k-seed", [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }])
    seedMessages("k-seed", [{ role: "user", content: "again" }])
    expect(getChat("k-seed").messages.map((m) => m.content)).toEqual(["hi", "hello"])
    appendMessage("k-seed", { role: "assistant", content: "Done" })
    expect(getChat("k-seed").messages.map((m) => m.content)).toEqual(["hi", "hello", "Done"])
  })

  it("hydrateChat fills an empty chat with a saved transcript, and never overwrites one", () => {
    const seen = []
    const off = subscribeChat("hyd1", () => seen.push(getChat("hyd1").messages.length))
    hydrateChat("hyd1", { sessionId: "s9", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] })
    expect(getChat("hyd1").sessionId).toBe("s9")
    expect(getChat("hyd1").messages.map((m) => m.content)).toEqual(["a", "b"])
    expect(seen).toEqual([2])
    hydrateChat("hyd1", { sessionId: "s10", messages: [{ role: "user", content: "c" }] })
    expect(getChat("hyd1").messages).toHaveLength(2)
    expect(getChat("hyd1").sessionId).toBe("s9")
    off()
  })
})

describe("chat-store, streaming with other agents", () => {
  const enc = new TextEncoder()
  const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const stream = (chunks) => {
    let i = 0
    return {
      ok: true, status: 200, headers: { get: () => "text/event-stream" },
      body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true }), cancel: async () => {} }) },
    }
  }
  const ROUTE = { status: "working", seconds: 3, credits: 0, steps: [{ id: "s1", agent: "media_buyer", status: "working" }] }
  const DONE = { ...ROUTE, status: "done", steps: [{ id: "s1", agent: "media_buyer", status: "done" }] }

  it("sends the agent, shows the route while it streams, and keeps it on the reply", async () => {
    const live = []
    apiRequest.mockImplementation(() => Promise.resolve(stream([
      sse("route", ROUTE),
      sse("final", { reply: "Done", tools_used: [], session_id: "s1", route: DONE, proposals: [{ id: "p1", agent: "media_buyer", title: "Put the old form back", status: "pending" }] }),
    ])))
    const off = subscribeChat("k-stream", () => live.push(getChat("k-stream").route))
    await sendChatMessage("k-stream", { text: "why?", agent: "sales_coach", stream: true })
    off()
    expect(apiRequest.mock.calls[0][0]).toBe("/api/chat/stream")
    expect(JSON.parse(apiRequest.mock.calls[0][1].body).agent).toBe("sales_coach")
    expect(live).toContainEqual(ROUTE)
    const chat = getChat("k-stream")
    expect(chat.route).toBeNull()
    expect(chat.loading).toBe(false)
    expect(chat.messages.at(-1)).toMatchObject({ role: "assistant", content: "Done", route: DONE, proposals: [expect.objectContaining({ id: "p1" })] })
  })

  it("leaves agent and route out of a plain chat", async () => {
    apiRequest.mockImplementation(() => reply({ reply: "Hi", tools_used: [], route: null }))
    await sendChatMessage("k-plain", { text: "hello" })
    expect(apiRequest.mock.calls[0][0]).toBe("/api/chat")
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).not.toHaveProperty("agent")
    expect(getChat("k-plain").messages.at(-1)).toEqual({ role: "assistant", content: "Hi", tools_used: [] })
  })

  it("keeps the route it had, marked failed, when the stream breaks", async () => {
    apiRequest.mockImplementation(() => Promise.resolve(stream([sse("route", ROUTE), sse("error", { message: "timed out" })])))
    await sendChatMessage("k-broken", { text: "why?", stream: true })
    expect(getChat("k-broken").messages.at(-1)).toMatchObject({ content: "Sorry, I hit an error. Please try again.", route: { ...ROUTE, status: "failed" } })
  })

  it("hands a locked agent's 423 to on423 and takes the message back", async () => {
    const body = { detail: { code: "agent_locked", agent: "sales_coach", waits_on: "media_buyer" } }
    apiRequest.mockImplementation(() => Promise.resolve({ ok: false, status: 423, json: async () => body, headers: { get: () => "application/json" } }))
    const on423 = vi.fn()
    await sendChatMessage("k-locked", { text: "hi", page: "sales_coach", agent: "sales_coach", stream: true }, { on423 })
    expect(on423).toHaveBeenCalledWith(body)
    expect(getChat("k-locked").messages).toEqual([])
    expect(getChat("k-locked").loading).toBe(false)
    // Without a handler the old "something went wrong" reply stands.
    await sendChatMessage("k-locked-2", { text: "hi", page: "sales_coach" })
    expect(getChat("k-locked-2").messages.map((m) => m.role)).toEqual(["user", "assistant"])
  })
})

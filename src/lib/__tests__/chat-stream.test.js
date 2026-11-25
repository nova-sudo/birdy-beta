import { describe, it, expect, vi, beforeEach } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))

import { createEventParser, postChat } from "@/lib/chat-stream"

const enc = new TextEncoder()
/** A fetch Response stand-in whose body hands out these chunks in order. */
function streamResponse(chunks, { status = 200, type = "text/event-stream", failAfter } = {}) {
  let i = 0
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) },
    body: {
      getReader: () => ({
        read: async () => {
          if (failAfter !== undefined && i === failAfter) throw new TypeError("network lost")
          return i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined }
        },
        cancel: async () => {},
      }),
    },
  }
}
const jsonResponse = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => "application/json" } })

const ROUTE1 = { status: "working", steps: [{ id: "s1", agent: "sales_coach", status: "working" }] }
const ROUTE2 = { status: "working", steps: [{ id: "s1", agent: "sales_coach", status: "done" }, { id: "s2", agent: "birdy", status: "working" }] }
const FINAL = { reply: "The leads changed.", session_id: "abc", route: { ...ROUTE2, status: "done" }, proposals: [] }

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

beforeEach(() => apiRequest.mockReset())

describe("createEventParser", () => {
  it("joins events cut anywhere, including inside a character and a CRLF", () => {
    const seen = []
    const p = createEventParser((e) => seen.push(e))
    const text = "event: route\r\ndata: {\"a\":\"é\"}\r\n\r\n: keep-alive\n\nevent: final\ndata: 1\ndata: 2\n\n"
    // Split byte by byte through a decoder, the way a real stream arrives.
    const bytes = enc.encode(text)
    const dec = new TextDecoder()
    for (const b of bytes) p.push(dec.decode(new Uint8Array([b]), { stream: true }))
    p.end()
    expect(seen).toEqual([{ event: "route", data: "{\"a\":\"é\"}" }, { event: "final", data: "1\n2" }])
  })

  it("counts a last event that has no closing blank line", () => {
    const seen = []
    const p = createEventParser((e) => seen.push(e))
    p.push("data: hi")
    p.end()
    expect(seen).toEqual([{ event: "message", data: "hi" }])
  })
})

describe("postChat", () => {
  it("calls onRoute for each route event and resolves with the final JSON, across chunk boundaries", async () => {
    const whole = sse("route", ROUTE1) + sse("route", ROUTE2) + sse("final", FINAL)
    const chunks = [whole.slice(0, 7), whole.slice(7, 40), whole.slice(40, 41), whole.slice(41, 120), whole.slice(120)]
    apiRequest.mockResolvedValueOnce(streamResponse(chunks))
    const onRoute = vi.fn()
    const res = await postChat({ message: "hi", agent: "sales_coach" }, { onRoute })
    expect(onRoute.mock.calls.map((c) => c[0])).toEqual([ROUTE1, ROUTE2])
    expect(res).toEqual({ ok: true, status: 200, data: FINAL, streamed: true })
    const [url, opts] = apiRequest.mock.calls[0]
    expect(url).toBe("/api/chat/stream")
    expect(JSON.parse(opts.body)).toEqual({ message: "hi", agent: "sales_coach" })
    expect(opts.headers.Accept).toBe("text/event-stream")
  })

  it.each([404, 405, 500])("falls back to /api/chat when the stream endpoint answers %s", async (status) => {
    apiRequest.mockResolvedValueOnce(jsonResponse({ detail: "Not Found" }, status)).mockResolvedValueOnce(jsonResponse({ reply: "plain" }))
    const res = await postChat({ message: "hi" })
    expect(apiRequest.mock.calls.map((c) => c[0])).toEqual(["/api/chat/stream", "/api/chat"])
    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).toEqual({ message: "hi" })
    expect(res).toEqual({ ok: true, status: 200, data: { reply: "plain" }, streamed: false })
  })

  it("falls back on a network error before anything arrives", async () => {
    apiRequest.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(jsonResponse({ reply: "plain" }))
    expect((await postChat({ message: "hi" })).data).toEqual({ reply: "plain" })
  })

  it("falls back when the stream breaks before its first event", async () => {
    apiRequest.mockResolvedValueOnce(streamResponse([], { failAfter: 0 })).mockResolvedValueOnce(jsonResponse({ reply: "plain" }))
    expect((await postChat({ message: "hi" })).data).toEqual({ reply: "plain" })
  })

  it("does not send the message twice once the stream has started", async () => {
    apiRequest.mockResolvedValueOnce(streamResponse([sse("route", ROUTE1)], { failAfter: 1 }))
    const onRoute = vi.fn()
    await expect(postChat({ message: "hi" }, { onRoute })).rejects.toThrow("network lost")
    expect(onRoute).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("rejects with the server's message on an error event", async () => {
    apiRequest.mockResolvedValueOnce(streamResponse([sse("route", ROUTE1), sse("error", { message: "Marketing Guru timed out" })]))
    await expect(postChat({ message: "hi" })).rejects.toThrow("Marketing Guru timed out")
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("hands 402 and 412 back without retrying", async () => {
    apiRequest.mockResolvedValueOnce(jsonResponse({}, 402))
    expect(await postChat({ message: "hi" })).toMatchObject({ ok: false, status: 402 })
    apiRequest.mockResolvedValueOnce(jsonResponse({}, 412))
    expect(await postChat({ message: "hi" })).toMatchObject({ ok: false, status: 412 })
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it("takes a JSON answer from the stream endpoint as the final reply", async () => {
    apiRequest.mockResolvedValueOnce(jsonResponse({ reply: "json" }))
    expect(await postChat({ message: "hi" })).toMatchObject({ ok: true, data: { reply: "json" } })
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("rejects when the stream ends after routes but without a final", async () => {
    apiRequest.mockResolvedValueOnce(streamResponse([sse("route", ROUTE1)]))
    await expect(postChat({ message: "hi" })).rejects.toThrow(/stopped before/)
  })
})

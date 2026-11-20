import { describe, it, expect, vi, beforeEach } from "vitest"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))

import { cardChanges, contextErrorMessage, normalizeContext, request, saveCard, usedWhenLine, addNote } from "../context-api"

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status, body) => ({ ok: false, status, json: async () => body })

beforeEach(() => apiRequest.mockReset())

describe("normalizeContext", () => {
  it("puts the cards in the page's order and makes derived lines read-only", () => {
    const ctx = normalizeContext({
      cards: [
        { key: "rules", title: "Rules", used_when: "x", items: [] },
        { key: "agency", title: "Agency", used_when: "y", items: [{ id: "derived:clients", text: "5 active clients", source: "derived", editable: true }, { id: "a1", text: "Clinics", source: "owner", editable: true }] },
      ],
      client: { id: "g0", name: "Aura", used_when: "z", items: [{ id: "c1", text: "CPL £5" }] },
      notes: [{ id: "n1", text: "No changes at weekends", author: "Hadley", created_at: "2026-11-02", updated_at: "2026-11-03" }, { text: "no id" }],
    })
    expect(ctx.cards.map((c) => c.key)).toEqual(["agency", "rules"])
    expect(ctx.cards[0].items[0].editable).toBe(false)
    expect(ctx.cards[0].items[1].editable).toBe(true)
    expect(ctx.client).toMatchObject({ id: "g0", used_when: "z" })
    expect(ctx.notes).toHaveLength(1)
    expect(ctx.notes[0]).toMatchObject({ author: "Hadley", updated_at: "2026-11-03", client_group_id: null })
  })

  it("survives an empty answer", () => {
    expect(normalizeContext(null)).toEqual({ cards: [], client: null, notes: [] })
  })
})

describe("usedWhenLine", () => {
  it("starts the sentence unless the server already did, and ends it", () => {
    expect(usedWhenLine("It judges a client")).toBe("Birdy uses this when it judges a client.")
    expect(usedWhenLine("Birdy uses this when it writes.")).toBe("Birdy uses this when it writes.")
    expect(usedWhenLine("")).toBe("")
  })
})

describe("cardChanges", () => {
  const before = [{ id: "a", text: "One", editable: true }, { id: "b", text: "Two", editable: true }, { id: "derived:x", text: "Three", editable: false }]
  it("adds, changes and removes lines, and never touches read-only ones", () => {
    const out = cardChanges(before, [
      { id: "a", text: "One, changed" },
      { id: "b", text: "  " },
      { id: "derived:x", text: "hack", removed: true },
      { id: null, text: "New line" },
      { id: null, text: "" },
    ])
    expect(out).toEqual({ add: ["New line"], change: [{ id: "a", text: "One, changed" }], remove: ["b"] })
  })
  it("is empty when nothing changed", () => {
    expect(cardChanges(before, [{ id: "a", text: "One " }, { id: "b", text: "Two" }])).toEqual({ add: [], change: [], remove: [] })
  })
})

describe("writes", () => {
  it("sends a card's changes to the item routes, a client line with its client", async () => {
    apiRequest.mockResolvedValue(ok({}))
    await saveCard({ card: "client", clientId: "g0", changes: { add: ["CPL £5"], change: [{ id: "c1", text: "x" }], remove: ["c2"] } })
    expect(apiRequest.mock.calls.map(([url, o]) => `${o.method} ${url} ${o.body ?? ""}`)).toEqual([
      "DELETE /api/context/items/c2 ",
      'PATCH /api/context/items/c1 {"text":"x"}',
      'POST /api/context/items {"card":"client","text":"CPL £5","client_group_id":"g0"}',
    ])
  })
  it("sends notes to the notes route", async () => {
    apiRequest.mockResolvedValue(ok({ id: "n9" }))
    await addNote({ text: "Hi", clientId: null })
    expect(apiRequest).toHaveBeenCalledWith("/api/context/notes", expect.objectContaining({ method: "POST", body: '{"text":"Hi"}' }))
  })
  it("carries the server's detail and code on a refusal, and shows the detail", async () => {
    apiRequest.mockResolvedValue(fail(409, { detail: "That card is full", code: "too_many" }))
    const err = await request("/api/context/items", "POST", {}).catch((e) => e)
    expect(err).toMatchObject({ status: 409, code: "too_many", detail: "That card is full" })
    expect(contextErrorMessage(err)).toBe("That card is full")
    expect(contextErrorMessage(new Error("x"))).toMatch(/didn’t save/)
  })
})

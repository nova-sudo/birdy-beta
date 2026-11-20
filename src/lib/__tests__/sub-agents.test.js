import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
import { clientsLine, daysLine, draftErrors, draftOf, normalizeSubAgent, patchOf, scheduleLine, sortSubAgents, subAgentErrorMessage } from "../sub-agents"

const raw = {
  id: "s1", parent: "media_buyer", kind: "specialist", name: "Form checker", purpose: "Flags form changes", instructions: "Check daily",
  tools: [{ name: "a", label: "A" }, { name: "b", label: "B" }], clients: "all",
  schedule: { time: "08:00", timezone: "Europe/London", days: ["mon", "tue", "wed", "thu", "fri"] }, status: "proposed",
}

describe("words", () => {
  it("says when it runs", () => {
    expect(scheduleLine(null)).toBe("Only when asked")
    expect(scheduleLine(raw.schedule)).toBe("Weekdays at 08:00, Europe/London")
    expect(daysLine([])).toBe("Every day")
    expect(daysLine(["sat", "sun"])).toBe("Weekends")
    expect(daysLine(["mon"])).toBe("Mons")
    expect(daysLine(["mon", "wed", "fri"])).toBe("Mon, Wed and Fri")
  })
  it("says which clients", () => {
    expect(clientsLine("all")).toBe("All clients")
    expect(clientsLine([{ id: "1", name: "Aura" }, { id: "2", name: null }])).toBe("Aura and A removed client")
    expect(clientsLine([{ id: "1", name: "Aura" }, { id: "2", name: "B" }, { id: "3", name: "C" }])).toBe("Aura and 2 more")
  })
  it("puts proposals first, then active, then paused", () => {
    const list = sortSubAgents([{ ...raw, id: "p", status: "paused" }, { ...raw, id: "a", status: "active" }, { ...raw, id: "w", status: "proposed" }].map(normalizeSubAgent))
    expect(list.map((s) => s.id)).toEqual(["w", "a", "p"])
  })
  it("names refusals plainly", () => {
    expect(subAgentErrorMessage({ code: "duplicate_name" })).toMatch(/already has that name/)
    expect(subAgentErrorMessage({ status: 404 })).toMatch(/no longer exists/)
  })
})

describe("patchOf", () => {
  const record = normalizeSubAgent(raw)
  it("is empty when nothing changed", () => {
    expect(patchOf(record, draftOf(record))).toEqual({})
  })
  it("sends only what changed", () => {
    const draft = { ...draftOf(record), name: "Form watcher ", tools: ["a"], clients: ["g0"], schedule: null }
    expect(patchOf(record, draft)).toEqual({ name: "Form watcher", tools: ["a"], clients: ["g0"], schedule: null })
  })
  it("orders the days the way the server keeps them", () => {
    const draft = { ...draftOf(record), schedule: { ...record.schedule, days: ["fri", "mon"] } }
    expect(patchOf(record, draft).schedule).toEqual({ time: "08:00", timezone: "Europe/London", days: ["mon", "fri"] })
  })
})

describe("draftErrors", () => {
  it("names each field that can't be saved", () => {
    const draft = { ...draftOf(normalizeSubAgent(raw)), name: " ", purpose: "", tools: [], clients: [], schedule: { time: "", timezone: "UTC", days: [] } }
    expect(Object.keys(draftErrors(draft)).sort()).toEqual(["clients", "name", "purpose", "schedule", "tools"])
  })
})

import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
import {
  clientsLine, daysLine, draftErrors, draftOf, normalizeRun, normalizeSubAgent, patchOf, runErrorMessage, runSeconds, scheduleLine, sortSubAgents, subAgentErrorMessage,
  subAgentRunsKey, subAgentToolsKey, toolOptions,
} from "../sub-agents"

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

describe("runs", () => {
  it("keeps the last run on a record, with a known outcome", () => {
    const rec = normalizeSubAgent({ ...raw, last_run: { status: "timeout", at: "2026-11-20T08:00:00Z", summary: "Stopped", credits: 3 } })
    expect(rec.last_run).toEqual({ status: "timeout", at: "2026-11-20T08:00:00Z", summary: "Stopped", credits: 3 })
    expect(rec.last_run_at).toBe("2026-11-20T08:00:00Z")
    expect(normalizeSubAgent({ ...raw, last_run: null }).last_run).toBeNull()
    expect(normalizeSubAgent({ ...raw, last_run: { status: "odd", credits: -2 } }).last_run).toMatchObject({ status: "error", credits: 0 })
  })
  it("makes a run safe to draw", () => {
    expect(normalizeRun({ id: "r1", status: "ok", summary: "Fine", credits: "4", proposals: [{ id: "p" }, null] })).toMatchObject({ id: "r1", status: "done", summary: "Fine", answer: "", credits: 4, proposals: [{ id: "p" }] })
  })
  it("reads the server's outcomes, and shows an unknown one as failed", () => {
    expect(normalizeRun({ status: "done" }).status).toBe("done")
    expect(normalizeRun({ status: "running", trigger: "manual" })).toMatchObject({ status: "running", trigger: "manual" })
    expect(normalizeRun({ status: "???", trigger: "elsewhere" })).toMatchObject({ status: "error", trigger: null })
  })
  it("works out how long a run took, or nothing", () => {
    expect(runSeconds({ started_at: "2026-11-20T08:00:00Z", finished_at: "2026-11-20T08:01:40Z" })).toBe(100)
    expect(runSeconds({ started_at: "2026-11-20T08:00:00Z" })).toBeNull()
  })
  it("asks the server for runs and tools at the right addresses", () => {
    expect(subAgentRunsKey("s 1")).toBe("/api/agents/sub/s%201/runs?limit=20")
    expect(subAgentToolsKey("sales_coach")).toBe("/api/agents/sub/tools?parent=sales_coach")
    expect(subAgentToolsKey(null)).toBeNull()
  })
  it("says why a run did not start", () => {
    expect(runErrorMessage({ status: 404 })).toBe("Running a sub-agent by hand is not available yet.")
    expect(runErrorMessage({ status: 409, code: "wrong_status" })).toMatch(/Resume it first/)
    expect(runErrorMessage({ status: 400, detail: "Too many runs today." })).toBe("Too many runs today.")
  })
})

describe("toolOptions", () => {
  it("offers the tools it has, then the rest its main agent can hand out, once each", () => {
    const rec = normalizeSubAgent(raw)
    expect(toolOptions(rec, [{ name: "b", label: "B" }, { name: "c", label: "C" }, { name: "" }]).map((t) => t.name)).toEqual(["a", "b", "c"])
    expect(toolOptions(rec, undefined).map((t) => t.name)).toEqual(["a", "b"])
  })
})

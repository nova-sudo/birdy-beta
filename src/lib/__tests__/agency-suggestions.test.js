import { describe, expect, it } from "vitest"
import { forClient, shapeSummary, suggestionsHeading } from "../agency-suggestions"

const SUMMARY = {
  suggestions: [
    { id: "1", severity: "MEDIUM", client: "Fallon Physique", title: "Refresh the creative", description: "Frequency 4.1" },
    { id: "2", severity: "high", client: "Aura", title: "Pause Body Sculpting", why: "CPL 2.1x its limit", agent_id: "ag1" },
    { id: "3", client: "Aura", title: "No severity given" },
    { id: "4", severity: "LOW", client: "Cloud Nine Beauty", title: "Raise the budget" },
  ],
  activity: [
    { id: "a1", title: "Synced Meta", client: "All clients", actor: "birdy", time: "12 min ago", kind: "sync" },
    { id: "a2", title: "Analysed 33 clients", actor: "birdy", kind: "analysis_pass" },
    { id: "a3", action: "Turned on an ad", client: "Aura", actor: "user", time: "Yesterday", kind: "ad_enabled" },
  ],
}

describe("shapeSummary", () => {
  it("lists suggestions most impact first, keeping the served order within a level", () => {
    const { suggestions } = shapeSummary(SUMMARY)
    expect(suggestions.map((s) => [s.id, s.tone])).toEqual([["2", "danger"], ["1", "warning"], ["3", "warning"], ["4", "accent"]])
    expect(suggestions[0]).toMatchObject({ why: "CPL 2.1x its limit", agentId: "ag1", client: "Aura" })
  })

  it("keeps only changes that were made in the history, and says who made each", () => {
    expect(shapeSummary(SUMMARY).history).toEqual([
      { id: "a1", what: "Synced Meta", client: "All clients", mode: "Auto-run", when: "12 min ago" },
      { id: "a3", what: "Turned on an ad", client: "Aura", mode: "Approved", when: "Yesterday" },
    ])
  })

  it("is empty before anything has loaded", () => {
    expect(shapeSummary(undefined)).toEqual({ suggestions: [], history: [] })
  })
})

describe("inside a client", () => {
  it("keeps that client's rows only, whatever the name's case", () => {
    const { suggestions } = shapeSummary(SUMMARY)
    expect(forClient(suggestions, "aura ").map((s) => s.id)).toEqual(["2", "3"])
    expect(forClient(suggestions, undefined)).toHaveLength(4)
  })
})

describe("suggestionsHeading", () => {
  it("counts them and says where", () => {
    expect(suggestionsHeading(5)).toBe("5 suggestions across your agency")
    expect(suggestionsHeading(1, "Aura")).toBe("1 suggestion for Aura")
    expect(suggestionsHeading(0)).toBe("All looking good")
    expect(suggestionsHeading(0, "Aura")).toBe("No suggestions for Aura")
  })
})

import { describe, it, expect } from "vitest"
import {
  clientsBody, clientsInitial, playbookLines, cplBody, cplInitial, outcomeChoices, outcomesBody, permissionsBody, practiceLines, scheduleBody, scheduleInitial, speedBody,
} from "../team-setup-forms"

describe("setup interview forms", () => {
  it("sends all clients or the picked ones", () => {
    expect(clientsBody("all", ["a"])).toEqual({ client_group_ids: "all" })
    expect(clientsBody("some", ["a", "b", "a"])).toEqual({ client_group_ids: ["a", "b"] })
    expect(clientsBody("some", [])).toBeNull()
    expect(clientsInitial({ client_group_ids: ["a"] })).toEqual({ mode: "some", ids: ["a"] })
    expect(clientsInitial(undefined)).toEqual({ mode: "all", ids: [] })
  })

  it("sends one CPL limit, or one per client", () => {
    expect(cplBody("one", "6.5")).toEqual({ body: { default: 6.5, clients: {} } })
    expect(cplBody("one", "")).toEqual({ error: "Type a limit above zero." })
    expect(cplBody("each", "", { a: "5", b: "" })).toEqual({ body: { default: null, clients: { a: 5 } } })
    expect(cplBody("each", "", { a: "x" }).error).toBeTruthy()
    expect(cplInitial({ default: null, clients: { a: 5 } })).toEqual({ mode: "each", all: "", each: { a: "5" } })
  })

  it("never sends budgets", () => {
    expect(permissionsBody({ ads: true, budgets: true })).toEqual({ ads: true, adsets: false, campaigns: false })
  })

  it("checks the schedule", () => {
    expect(scheduleBody({ time: "07:30", tz: "Europe/London", days: "weekdays" })).toEqual({ body: { time: "07:30", tz: "Europe/London", days: "weekdays" } })
    expect(scheduleBody({ time: "", tz: "UTC" }).error).toBeTruthy()
    expect(scheduleInitial({ time: "09:00", tz: "Asia/Dubai", days: "daily" })).toEqual({ time: "09:00", tz: "Asia/Dubai", days: "daily" })
  })

  it("offers tags and pipeline stages for booked and closed", () => {
    const choices = outcomeChoices({ tags: [{ value: "booked", label: "Booked" }], pipelines: [{ id: "p", name: "Sales", stages: [{ id: "s1", name: "Won" }] }] })
    expect(choices.all.map((c) => c.id)).toEqual(["tag:booked", "stage:s1"])
    expect(outcomesBody(choices, "tag:booked", "stage:s1")).toEqual({
      body: { booked: { kind: "tag", value: "booked", label: "Booked" }, closed: { kind: "stage", value: "s1", label: "Sales · Won" } },
    })
    expect(outcomesBody(choices, "tag:booked", "").error).toBeTruthy()
  })

  it("takes whole minutes for speed to lead", () => {
    expect(speedBody("15")).toEqual({ body: { minutes: 15 } })
    expect(speedBody("0").error).toBeTruthy()
    expect(speedBody("1.5").error).toBeTruthy()
  })

  it("shows a practice summary's numbers and short texts only", () => {
    expect(practiceLines({ changes: 3, clients_checked: 12, note: "All fine", alerts: [1, 2], nested: { a: 1 } })).toEqual([
      { key: "changes", label: "Changes it would propose", value: "3" },
      { key: "clients_checked", label: "Clients checked", value: "12" },
      { key: "note", label: "Note", value: "All fine" },
      { key: "alerts", label: "Alerts", value: "2" },
    ])
    expect(practiceLines(null)).toEqual([])
    expect(practiceLines({ clients: 7, client_states: { ok: 7 }, cards: 2, changes: 5, ended_early: false, finished_at: "2026-11-21T10:00:00Z" })).toEqual([
      { key: "clients", label: "Clients checked", value: "7" },
      { key: "cards", label: "Cards it would post", value: "2" },
      { key: "changes", label: "Changes it would propose", value: "5" },
    ])
  })

  it("reads the playbook's modes and scoring as lines, skipping what is missing", () => {
    expect(playbookLines({ modes: { remove: "auto", add: "nonsense" }, scoring: { min_days: 7 } })).toEqual([
      { label: "Pausing ads", value: "Acts on its own" },
      { label: "Judges an ad after", value: "7 days" },
    ])
    expect(playbookLines(null)).toEqual([])
  })
})

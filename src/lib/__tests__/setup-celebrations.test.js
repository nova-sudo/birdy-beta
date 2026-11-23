import { describe, it, expect, beforeEach, vi } from "vitest"
import { celebrateOnce, celebrationKey, celebrationLines, teamLines, wasCelebrated } from "@/lib/setup-celebrations"
import { normalizeTeam } from "@/lib/team-setup"

const team = normalizeTeam({
  agents: {
    birdy: { status: "done" },
    media_buyer: {
      status: "done", order: ["clients", "cpl", "playbook", "schedule", "slack"], steps: { clients: true, cpl: true, playbook: true, schedule: true, slack: true },
      known: [{ step: "clients", label: "Clients", value: "3 clients" }, { step: "cpl", label: "Cost per lead", value: "£6" }, { step: "schedule", label: "Report time", value: "07:00" }, { step: "slack", label: "Slack", value: null }],
    },
    sales_coach: { status: "done", order: [], steps: {} },
    sub_agents: { status: "done" },
  },
})

beforeEach(() => localStorage.clear())

describe("setup celebrations", () => {
  it("shows once per account and agent", () => {
    localStorage.setItem("user", JSON.stringify({ email: "Sam@x.test" }))
    expect(celebrationKey("media_buyer")).toBe("birdy_setup_celebrated:sam@x.test:media_buyer")
    expect(celebrateOnce("media_buyer")).toBe(true)
    expect(celebrateOnce("media_buyer")).toBe(false)
    expect(celebrateOnce("sales_coach")).toBe(true)
    localStorage.setItem("user", JSON.stringify({ email: "other@x.test" }))
    expect(wasCelebrated("media_buyer")).toBe(false)
  })

  it("still shows when storage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked") })
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(celebrateOnce("media_buyer")).toBe(true)
    get.mockRestore()
    set.mockRestore()
  })

  it("repeats the real answers, leaving out the empty ones", () => {
    expect(celebrationLines(team, "media_buyer")).toEqual(["Clients: 3 clients", "Cost per lead: £6", "Report time: 07:00"])
  })

  it("says what the whole team has", () => {
    expect(teamLines(team, 2)).toEqual(["Agency Ops is set up", "Media Buyer is set up", "Sales Coach is set up", "2 sub-agents working for you"])
    expect(teamLines(team, 0)).toHaveLength(3)
  })
})

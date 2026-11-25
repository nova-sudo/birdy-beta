import { describe, it, expect } from "vitest"
import {
  answerMessage, answered, isLocked, knownLines, lockedRefusal, lockedSections, nextSection, normalizeTeam, replyBlock, setupPercent, stepsLeftOf, teamDone,
} from "../team-setup"

const MB_ORDER = ["clients", "cpl", "playbook", "permissions", "schedule", "slack"]
const SC_ORDER = ["clients", "outcomes", "speed", "schedule", "slack"]
const raw = (over = {}) => ({
  order: ["birdy", "media_buyer", "sales_coach", "sub_agents"],
  agents: {
    birdy: { status: "done" },
    media_buyer: {
      status: "open", waits_on: null, order: MB_ORDER,
      steps: { clients: true, cpl: true, playbook: false }, current: "playbook",
      known: [{ step: "clients", label: "Clients", value: "All active clients" }, { step: "cpl", label: "CPL limits", value: "£6 for every client" }],
      values: { clients: { client_group_ids: "all" } }, completed_at: null,
    },
    sales_coach: { status: "locked", waits_on: "media_buyer", order: SC_ORDER, steps: {}, current: null, known: [], values: {}, completed_at: null },
    sub_agents: { status: "locked", waits_on: "sales_coach", skipped: false, completed_at: null },
    ...over,
  },
})

describe("normalizeTeam", () => {
  it("reads the server's state and fills what is missing", () => {
    const team = normalizeTeam(raw())
    expect(team.agents.media_buyer.current).toBe("playbook")
    expect(team.agents.media_buyer.steps).toEqual({ clients: true, cpl: true, playbook: false, permissions: false, schedule: false, slack: false })
    expect(team.agents.sales_coach.waits_on).toBe("media_buyer")
    expect(normalizeTeam({ agents: {} }).agents.media_buyer.status).toBe("locked")
  })

  it("is null for anything that isn't the state", () => {
    expect(normalizeTeam(null)).toBeNull()
    expect(normalizeTeam({ detail: "Not Found" })).toBeNull()
  })
})

describe("locks", () => {
  it("follows the server's status", () => {
    const team = normalizeTeam(raw())
    expect(isLocked(team, "sales_coach")).toBe(true)
    expect(lockedSections(team)).toEqual({ buyer: false, coach: true })
  })

  it("treats everything as unlocked without a state", () => {
    expect(lockedSections(null)).toEqual({ buyer: false, coach: false })
    expect(isLocked(null, "sub_agents")).toBe(false)
    expect(nextSection(null)).toBe("ops")
    expect(teamDone(null)).toBe(false)
  })

  it("reads a 423 refusal", () => {
    expect(lockedRefusal({ detail: { code: "agent_locked", agent: "sales_coach", waits_on: "media_buyer" } })).toEqual({ agent: "sales_coach", waits_on: "media_buyer" })
    expect(lockedRefusal({ detail: "nope" })).toBeNull()
    expect(lockedRefusal(null)).toBeNull()
  })
})

describe("progress", () => {
  const team = normalizeTeam(raw())

  it("counts answers and names what is left", () => {
    expect(answered(team, "media_buyer")).toEqual({ done: 2, total: 6 })
    expect(stepsLeftOf(team, "media_buyer")).toEqual(["Playbook", "Permissions", "Schedule", "Slack"])
    expect(nextSection(team)).toBe("buyer")
  })

  it("lists what the agent knows, current step marked", () => {
    const lines = knownLines(team, "media_buyer")
    expect(lines[0]).toEqual({ step: "clients", label: "Clients", value: "All active clients", done: true, current: false })
    expect(lines[2]).toMatchObject({ step: "playbook", done: false, current: true, value: null })
  })

  it("counts the agents' steps into setup's share", () => {
    const steps = { a: "done", b: "todo" }
    // Birdy 1 of 2, Marketing Guru 2 of 6, Sales Coach 0 of 5, sub-agents 0 of 1.
    expect(setupPercent(steps, team)).toBe(Math.round((3 / 14) * 100))
    expect(setupPercent(steps, team, { completed: true })).toBe(Math.round((4 / 14) * 100))
    expect(setupPercent(steps, null)).toBe(50)
  })

  it("says what was saved, in the agent's own line", () => {
    expect(answerMessage(team, "media_buyer", "cpl")).toBe("CPL limits: £6 for every client")
    expect(answerMessage(team, "media_buyer", "schedule")).toBe("Schedule: saved")
  })
})

describe("replyBlock", () => {
  it("reads the contract's block", () => {
    expect(replyBlock({ agent_changes: [{ tool: "x" }, { ui_block: { type: "schedule" } }] })).toEqual({ type: "schedule", data: {} })
  })

  it("reads the older flat block with its data", () => {
    expect(replyBlock({ agent_changes: [{ tool: "guard", ui_block: "playbook", playbook: [{ kind: "flag_no_spend" }] }] }))
      .toEqual({ type: "playbook", data: { playbook: [{ kind: "flag_no_spend" }] } })
  })

  it("is null when a reply asks for nothing", () => {
    expect(replyBlock({ content: "hi" })).toBeNull()
    expect(replyBlock({ agent_changes: [{ changed: "playbook" }] })).toBeNull()
  })
})

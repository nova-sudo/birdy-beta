import { describe, it, expect } from "vitest"
import {
  STEPS, allDone, basicsOf, buildTargetsPayload, callingTool, deriveSteps, hasAnyTarget, nextStep, pctDone, sectionParam, stepsLeft,
} from "../setup-steps"

const onboarding = (extra = {}, data = {}) => ({ completed: false, name: "Sam", agency_name: "Acme", default_currency: "GBP", data, ...extra })
const client = (id, extra = {}) => ({ id, name: `Client ${id}`, client_status: "Active", call_log_provider: "ghl", ...extra })
const FULL = {
  onboarding: onboarding({}, { sales_tool: "ghl", slack: { channel_id: "C1" } }),
  status: { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } },
  hp: { connected: false },
  slack: { installed: true, notify_channel_id: "C1" },
  clients: [client("a", { targets: { cpa: 40, cpl: 6 } }), client("b", { targets: { cpl: 7 } })],
}
const empty = { onboarding: onboarding({ name: null, agency_name: null, default_currency: null }), status: null, hp: null, slack: null, clients: [] }

describe("deriveSteps", () => {
  it("is all to do for a fresh account", () => {
    expect(Object.values(deriveSteps(empty))).toEqual(STEPS.map(() => "todo"))
  })

  it("is all done for an account that has everything", () => {
    expect(allDone(deriveSteps(FULL))).toBe(true)
  })

  it("needs name, agency and currency for the basics", () => {
    expect(deriveSteps({ ...empty, onboarding: onboarding({ default_currency: null }) }).basics).toBe("setup")
    expect(deriveSteps({ ...empty, onboarding: onboarding({ name: null, agency_name: null, default_currency: null }, { name: "Sam", agency: "Acme", currency: "USD" }) }).basics).toBe("done")
  })

  it("reads the connections from /api/status and flags an expired Meta login", () => {
    expect(deriveSteps({ ...empty, status: { facebook: { connected: true, token_expired: true } } }).meta).toBe("issue")
    expect(deriveSteps({ ...empty, status: { gohighlevel: { agency: { connected: true } } } }).ghl).toBe("done")
  })

  it("waits on a Hot Prospector key when that's the answer", () => {
    const hp = { ...empty, onboarding: onboarding({}, { sales_tool: "hp" }) }
    expect(deriveSteps(hp).calling).toBe("setup")
    expect(deriveSteps({ ...hp, hp: { connected: true } }).calling).toBe("done")
    expect(deriveSteps({ ...empty, onboarding: onboarding({}, { sales_tool: "none" }) }).calling).toBe("done")
    // A client that already says where its calls come from answers it too.
    expect(deriveSteps({ ...empty, clients: [client("a")] }).calling).toBe("done")
  })

  it("counts a client still being created as in setup", () => {
    expect(deriveSteps({ ...empty, clients: [client("a", { status: "creating" })] }).client).toBe("setup")
  })

  it("needs a target on some client", () => {
    expect(deriveSteps({ ...empty, clients: [client("a", { targets: {} })] }).targets).toBe("todo")
    expect(deriveSteps({ ...empty, clients: [client("a", { targets: { monthly_wins: 3 } })] }).targets).toBe("done")
  })

  it("reads Slack's install, its channel and a stale install", () => {
    expect(deriveSteps({ ...empty, slack: { installed: true } }).slack).toBe("setup")
    expect(deriveSteps({ ...empty, slack: { installed: true, needs_reconnect: true, notify_channel_id: "C" } }).slack).toBe("issue")
    expect(deriveSteps({ ...empty, slack: { installed: true }, onboarding: onboarding({}, { slack: { channel_id: null } }) }).slack).toBe("done")
  })

  it("finishes the import with a second client, a saved no, or a finished onboarding", () => {
    expect(deriveSteps({ ...empty, clients: [client("a")] }).import).toBe("todo")
    expect(deriveSteps({ ...empty, clients: [client("a"), client("b")] }).import).toBe("done")
    expect(deriveSteps({ ...empty, onboarding: onboarding({}, { wants_sync: false }) }).import).toBe("done")
    expect(deriveSteps({ ...empty, onboarding: onboarding({ completed: true }) }).import).toBe("done")
  })
})

describe("progress", () => {
  it("counts progress", () => {
    const steps = { ...deriveSteps(empty), basics: "done", meta: "done", ghl: "issue" }
    expect(pctDone(steps)).toBe(Math.round((2 / STEPS.length) * 100))
    expect(stepsLeft(steps)).toBe(STEPS.length - 2)
    expect(nextStep(steps)).toBe("ghl")
    expect(nextStep(deriveSteps(FULL))).toBeNull()
  })

  it("reads ?s= in either naming", () => {
    expect(["birdy", "ops", undefined, "x"].map(sectionParam)).toEqual(["ops", "ops", "ops", "ops"])
    expect(["mb", "buyer"].map(sectionParam)).toEqual(["buyer", "buyer"])
    expect(["sales", "coach", "sales_coach"].map(sectionParam)).toEqual(["coach", "coach", "coach"])
    expect(["subs", "sub_agents", "media_buyer"].map(sectionParam)).toEqual(["subs", "subs", "buyer"])
  })
})

describe("answers", () => {
  it("prefers the profile over saved answers for the basics", () => {
    expect(basicsOf(onboarding({ name: " Sam " }, { name: "Old" }))).toEqual({ name: "Sam", agency: "Acme", currency: "GBP" })
    expect(basicsOf(null)).toEqual({ name: "", agency: "", currency: "" })
  })

  it("takes the calling answer, or a connected Hot Prospector", () => {
    expect(callingTool({ onboarding: onboarding({}, { sales_tool: "none" }) })).toBe("none")
    expect(callingTool({ onboarding: onboarding(), hp: { connected: true } })).toBe("hp")
    expect(callingTool({ onboarding: null })).toBeNull()
  })

  it("builds the targets the endpoint stores", () => {
    expect(buildTargetsPayload({ cpa: "45", wins: "", convRate: "15", saveAsDefault: true })).toEqual({ cpa: 45, conversion_rate: 0.15, save_as_default: true })
    expect(buildTargetsPayload({ cpa: " ", wins: "", convRate: "" })).toBeNull()
  })

  it("knows a target only by the fields the Targets form has", () => {
    expect(hasAnyTarget({ cpl: 0 })).toBe(true)
    expect(hasAnyTarget({ something_else: 3, cpa: "" })).toBe(false)
    expect(hasAnyTarget(null)).toBe(false)
  })
})

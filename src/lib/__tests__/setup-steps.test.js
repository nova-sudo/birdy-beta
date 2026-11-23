import { describe, it, expect } from "vitest"
import {
  STEPS, allDone, basicsOf, buildTargetsPayload, callingTool, clientsToFit, deriveSteps, hasAnyTarget, nextStep, pctDone, planIsCurrent,
  sectionParam, setupHolds, stepsLeft,
} from "../setup-steps"

const onboarding = (extra = {}, data = {}) => ({ completed: false, name: "Sam", agency_name: "Acme", default_currency: "GBP", data, ...extra })
const client = (id, extra = {}) => ({ id, name: `Client ${id}`, client_status: "Active", call_log_provider: "ghl", ...extra })
const FULL = {
  onboarding: onboarding({}, { sales_tool: "ghl", slack: { channel_id: "C1" } }),
  status: { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } },
  hp: { connected: false },
  slack: { installed: true, notify_channel_id: "C1" },
  clients: [client("a", { targets: { cpa: 40, cpl: 6 } }), client("b", { targets: { cpl: 7 } })],
  billing: { subscribed: true, needs_plan: false, sandbox: false },
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

describe("the plan step", () => {
  const tools = { ...empty, onboarding: onboarding({}, { sales_tool: "ghl" }), status: FULL.status }

  it("sits after calling and before the first client", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["basics", "meta", "ghl", "calling", "plan", "client", "targets", "slack", "import"])
    expect(STEPS.find((s) => s.id === "plan").label).toBe("Pick your plan")
  })

  it("is done with an active subscription or when no plan is needed", () => {
    expect(deriveSteps({ ...tools, billing: { subscribed: false, needs_plan: true } }).plan).toBe("todo")
    expect(deriveSteps({ ...tools, billing: { subscribed: true, needs_plan: false } }).plan).toBe("done")
    // An admin-granted client limit: never asked.
    expect(deriveSteps({ ...tools, billing: { subscribed: false, needs_plan: false } }).plan).toBe("done")
    // Billing unread: onboarding's answer stands in.
    expect(deriveSteps({ ...tools, onboarding: onboarding({ needs_plan: false }) }).plan).toBe("done")
    expect(deriveSteps({ ...tools, onboarding: onboarding({ completed: true, needs_plan: true }) }).plan).toBe("todo")
    // Nobody says: an unfinished account is asked, a finished one is left alone.
    expect(deriveSteps(tools).plan).toBe("todo")
    expect(deriveSteps({ ...tools, onboarding: onboarding({ completed: true }) }).plan).toBe("done")
  })

  it("counts in the progress", () => {
    const steps = deriveSteps({ ...tools, billing: { subscribed: false, needs_plan: true } })
    expect(steps).toMatchObject({ basics: "done", meta: "done", ghl: "done", calling: "done", plan: "todo" })
    expect(pctDone(steps)).toBe(44)
    expect(stepsLeft(steps)).toBe(5)
    expect(nextStep(steps)).toBe("plan")
  })

  it("is the step on screen once the tools are in, or at once for a finished account", () => {
    const steps = deriveSteps({ ...tools, billing: { needs_plan: true } })
    expect(planIsCurrent(steps)).toBe(true)
    expect(planIsCurrent({ ...steps, calling: "todo" })).toBe(false)
    expect(planIsCurrent({ ...steps, calling: "todo" }, true)).toBe(true)
    expect(planIsCurrent({ ...steps, plan: "done" }, true)).toBe(false)
  })

  it("holds unfinished setup and a finished account without a plan", () => {
    expect(setupHolds(null)).toBe(false)
    expect(setupHolds(onboarding())).toBe(true)
    expect(setupHolds(onboarding({ completed: true }))).toBe(false)
    expect(setupHolds(onboarding({ completed: true, needs_plan: true }))).toBe(true)
    expect(setupHolds(onboarding({ completed: true, needs_plan: true }), { plan: "done" })).toBe(false)
  })

  it("knows how many clients to fit from the sub-accounts or the clients", () => {
    expect(clientsToFit(empty)).toBeNull()
    const subs = { gohighlevel: { subaccounts: { l1: {}, l2: {}, l3: {}, l4: {} } } }
    expect(clientsToFit({ ...empty, status: subs })).toEqual({ count: 4, source: "ghl" })
    expect(clientsToFit({ ...empty, clients: [client("a"), client("b")] })).toEqual({ count: 2, source: "clients" })
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

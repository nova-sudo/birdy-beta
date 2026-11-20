import { describe, it, expect } from "vitest"
import {
  agentChatHref, agentInfo, askedByName, findStep, formatCredits, formatSeconds, limitMessage, liveIndex, liveWire, normalizeRoute,
  routeMeta, routeStatusLabel, routeStatusLine, stepMeta, stepStatusLabel,
} from "@/lib/agent-route"

const step = (over) => ({ id: "s1", agent: "sales_coach", name: "Sales Coach", kind: "main", status: "done", summary: "212 calls checked", question: null, asked_by: null, tools: [], answer: null, credits: 0, seconds: 0, ...over })
const ROUTE = {
  status: "done", seconds: 34, credits: 18, limit_hit: null,
  steps: [
    step(),
    step({ id: "s2", agent: "birdy", name: "Birdy", kind: "orchestrator", summary: "Chose Media Buyer", asked_by: "s1" }),
    step({ id: "s3", agent: "media_buyer", name: "Media Buyer", summary: "6 campaigns checked", asked_by: "s2", question: "Did leads change?", credits: 9, seconds: 20 }),
  ],
}

describe("agentInfo", () => {
  it("knows the main agents, their colour role and icon", () => {
    expect(agentInfo("birdy")).toMatchObject({ name: "Birdy", role: "ops", icon: "mascot", kind: "orchestrator" })
    expect(agentInfo("media_buyer")).toMatchObject({ name: "Media Buyer", role: "buyer", icon: "megaphone", kind: "main" })
    expect(agentInfo("sales_coach")).toMatchObject({ name: "Sales Coach", role: "coach", icon: "phone" })
  })

  it("gives a sub-agent the neutral treatment and keeps its main agent", () => {
    const info = agentInfo("sub:abc", { name: "Form checker", parent: "media_buyer" })
    expect(info).toMatchObject({ name: "Form checker", role: "neutral", icon: "bot", kind: "sub", parent: "media_buyer", parentName: "Media Buyer" })
    expect(agentChatHref(info)).toBe("/media-buyer/chat")
  })

  it("never names Birdy as a sub-agent's main agent", () => {
    expect(agentInfo("sub:x", { parent: "birdy" })).toMatchObject({ parent: null, name: "Sub-agent" })
    expect(agentChatHref(agentInfo("sub:x"))).toBe("/dashboard/chat")
  })
})

describe("normalizeRoute", () => {
  it("returns null when there is nothing to draw", () => {
    expect(normalizeRoute(null)).toBeNull()
    expect(normalizeRoute({ status: "done", steps: [] })).toBeNull()
    expect(normalizeRoute({ steps: "nope" })).toBeNull()
  })

  it("fills gaps with safe defaults", () => {
    const r = normalizeRoute({ status: "weird", seconds: "abc", credits: -3, limit_hit: "other", steps: [{ agent: "media_buyer", status: "??", tools: [{ label: "Leads by ad" }, null, {}] }] })
    expect(r).toMatchObject({ status: "done", seconds: 0, credits: 0, limit_hit: null })
    expect(r.steps[0]).toMatchObject({ id: "step-0", status: "done", kind: "main", tools: [{ label: "Leads by ad", detail: null }] })
    expect(r.steps[0].info.name).toBe("Media Buyer")
  })

  it("finds a sub-agent's main agent from who asked it, or the nearest main agent before it", () => {
    const asked = normalizeRoute({ status: "done", steps: [step({ id: "a", agent: "media_buyer" }), step({ id: "b", agent: "sub:1", kind: "sub", asked_by: "a" })] })
    expect(asked.steps[1].info.parentName).toBe("Media Buyer")
    const nearest = normalizeRoute({ status: "done", steps: [step({ id: "a", agent: "sales_coach" }), step({ id: "b", agent: "birdy" }), step({ id: "c", agent: "sub:2", kind: "sub" })] })
    expect(nearest.steps[2].info.parentName).toBe("Sales Coach")
  })

  it("is safe to run twice", () => {
    const once = normalizeRoute(ROUTE)
    expect(normalizeRoute(once)).toEqual(once)
  })
})

describe("labels", () => {
  it("formats time and credits", () => {
    expect(formatSeconds(8)).toBe("8s")
    expect(formatSeconds(72)).toBe("1m 12s")
    expect(formatSeconds(120)).toBe("2m")
    expect(formatCredits(1)).toBe("1 credit")
    expect(formatCredits(18)).toBe("18 credits")
    expect(formatCredits(2.54)).toBe("2.5 credits")
  })

  it("writes the footer and an agent's share", () => {
    const r = normalizeRoute(ROUTE)
    expect(routeMeta(r)).toBe("34s · 18 credits")
    expect(routeMeta({ ...r, credits: 0, seconds: 12 })).toBe("12s")
    expect(stepMeta(r.steps[2])).toBe("20s · 9 credits")
    expect(stepMeta(r.steps[0])).toBe("")
  })

  it("names each state in words", () => {
    expect(stepStatusLabel("failed")).toBe("Couldn’t finish")
    expect(stepStatusLabel("skipped")).toBe("Skipped")
    expect(routeStatusLabel({ status: "failed" })).toBe("Stopped")
  })

  it("says where the answer went, who is working, or who failed", () => {
    const r = normalizeRoute(ROUTE)
    expect(routeStatusLine(r)).toBe("Answer came back to Sales Coach")
    const working = normalizeRoute({ ...ROUTE, status: "working", steps: [ROUTE.steps[0], ROUTE.steps[1], { ...ROUTE.steps[2], status: "working", summary: "Checking lead forms…" }] })
    expect(routeStatusLine(working)).toBe("Media Buyer: checking lead forms…")
    const failed = normalizeRoute({ ...ROUTE, status: "failed", steps: [ROUTE.steps[0], { ...ROUTE.steps[2], status: "failed" }] })
    expect(routeStatusLine(failed)).toBe("Media Buyer couldn’t finish its part")
  })

  it("explains each limit in plain words", () => {
    expect(limitMessage("asks")).toMatch(/limit of 3 agent asks/)
    expect(limitMessage("depth")).toMatch(/can’t go any deeper/)
    expect(limitMessage("repeat")).toMatch(/asked again/)
    expect(limitMessage(null)).toBeNull()
    for (const k of ["asks", "depth", "repeat"]) expect(limitMessage(k)).not.toMatch(/—/)
  })
})

describe("the live line", () => {
  it("is the one leading into the agent at work", () => {
    const working = normalizeRoute({ ...ROUTE, status: "working", steps: [ROUTE.steps[0], ROUTE.steps[1], { ...ROUTE.steps[2], status: "working" }] })
    expect(liveIndex(working)).toBe(2)
    expect(liveWire(working)).toBe(1)
  })

  it("is none when the first agent is still working, or the route is finished", () => {
    const first = normalizeRoute({ status: "working", steps: [step({ status: "working" })] })
    expect(liveIndex(first)).toBe(0)
    expect(liveWire(first)).toBe(-1)
    expect(liveIndex(normalizeRoute(ROUTE))).toBe(-1)
  })
})

describe("asked by", () => {
  it("names the asking agent by step id or by agent key", () => {
    const r = normalizeRoute(ROUTE)
    expect(askedByName(r, findStep(r, "s3"))).toBe("Birdy")
    expect(askedByName(r, { asked_by: "media_buyer" })).toBe("Media Buyer")
    expect(askedByName(r, findStep(r, "s1"))).toBeNull()
    expect(findStep(r, "nope")).toBeNull()
  })
})

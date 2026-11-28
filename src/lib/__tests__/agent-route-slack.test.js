import { describe, it, expect } from "vitest"
import { findStep, isSlackTool, normalizeRoute, pastTense, routeStatusLine, routeStops, routeWorthShowing, slackSummary, workingLine } from "@/lib/agent-route"

const step = (over) => ({ id: "s1", agent: "birdy", name: "Birdy", status: "done", tools: [], ...over })

describe("Slack work on a route", () => {
  it("marks Slack tools, from the server's kind or, for older replies, by name", () => {
    expect(isSlackTool({ name: "x", kind: "slack" })).toBe(true)
    expect(isSlackTool({ name: "create_slack_report" })).toBe(true)
    expect(isSlackTool({ name: "get_daily_metrics" })).toBe(false)
    const route = normalizeRoute({ status: "done", steps: [step({ tools: [{ name: "get_daily_metrics", label: "Daily results" }, { name: "preview_report", label: "Building the preview" }] })] })
    expect(route.steps[0].tools.map((t) => t.kind)).toEqual([undefined, "slack"])
  })

  it("keeps doing_kind only for Slack, and only with something being done", () => {
    const r = (s) => normalizeRoute({ status: "working", steps: [step({ status: "working", ...s })] }).steps[0].doing_kind
    expect(r({ doing: "Building the preview", doing_kind: "slack" })).toBe("slack")
    expect(r({ doing: "Daily results", doing_kind: "other" })).toBeNull()
    expect(r({ doing: null, doing_kind: "slack" })).toBeNull()
  })

  it("adds a live Slack stop while the live step is in Slack, and a done one once it used Slack", () => {
    const live = normalizeRoute({ status: "working", steps: [step({ status: "working", doing: "Checking channels", doing_kind: "slack" })] })
    expect(live.steps[0].slack).toMatchObject({ id: "s1:slack", kind: "slack", status: "working", doing: "Checking channels", tools: [] })
    expect(live.steps[0].slack.info).toMatchObject({ name: "Slack", icon: "slack", parentName: "Birdy", chat: "/dashboard/chat" })
    expect(routeStops(live).map((s) => s.id)).toEqual(["s1", "s1:slack"])
    expect(findStep(live, "s1:slack")).toBe(live.steps[0].slack)

    const done = normalizeRoute({ status: "done", steps: [step({ tools: [{ name: "a", label: "Checking channels", kind: "slack" }, { name: "b", label: "Checking channels", kind: "slack" }, { name: "c", label: "Report metrics", kind: "slack" }] })] })
    expect(done.steps[0].slack).toMatchObject({ status: "done", summary: "Checked channels · Report metrics" })

    const none = normalizeRoute({ status: "done", steps: [step({ tools: [{ name: "get_daily_metrics", label: "Daily results" }] })] })
    expect(none.steps[0].slack).toBeNull()
    expect(routeStops(none)).toHaveLength(1)
  })

  it("only the step at work gets a live Slack stop", () => {
    const route = normalizeRoute({ status: "working", steps: [step({ status: "done", doing: "Checking channels", doing_kind: "slack" }), step({ id: "s2", agent: "media_buyer", status: "working" })] })
    expect(route.steps[0].slack).toBeNull()
  })

  it("puts Slack labels in the past tense, and leaves other labels alone", () => {
    expect(pastTense("Building the preview")).toBe("Built the preview")
    expect(pastTense("Sending a test to Slack")).toBe("Sent a test to Slack")
    expect(pastTense("Creating the report")).toBe("Created the report")
    expect(pastTense("Slack reports")).toBe("Slack reports")
    expect(slackSummary([{ label: "Building the preview" }, { label: "Checking channels" }])).toBe("Built the preview · Checked channels")
    expect(slackSummary([])).toBe("")
  })

  it("words the live line for Slack work", () => {
    const line = (doing, name = "Birdy", agent = "birdy") => routeStatusLine(normalizeRoute({ status: "working", steps: [step({ agent, name, status: "working", doing, doing_kind: "slack" })] }))
    expect(line("Building the preview")).toBe("Birdy is building the preview in Slack")
    expect(line("Checking channels", "Marketing Guru", "media_buyer")).toBe("Marketing Guru is checking channels in Slack")
    expect(line("Slack reports")).toBe("Birdy is looking at reports in Slack")
    const r = normalizeRoute({ status: "working", steps: [step({ status: "working", summary: "Picked CPL", doing: "Building the preview", doing_kind: "slack" })] })
    expect(workingLine(r.steps[0])).toBe("Picked CPL")
    expect(workingLine({ ...r.steps[0], summary: "" })).toBe("Working in Slack")
    expect(workingLine(r.steps[0].slack)).toBe("Building the preview…")
  })

  it("a Birdy reply that only worked in Slack still shows its map", () => {
    expect(routeWorthShowing({ status: "done", steps: [step({ tools: [{ name: "list_slack_reports", label: "Slack reports", kind: "slack" }] })] })).toBe(true)
  })
})

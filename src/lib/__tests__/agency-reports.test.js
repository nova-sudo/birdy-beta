import { describe, it, expect } from "vitest"
import { agentSchedule, batchWords, buyerReports, runLine, runsOf, slackReportView, slackStatus } from "../agency-reports"

const NOW = new Date("2026-11-20T08:00:00Z") // Fri 20 Nov

const BRIEF = {
  id: "r1", name: "Daily brief", enabled: true, is_default: true,
  trigger: { type: "schedule", frequency: "daily", day: null, time: "09:00", timezone: null },
  template: { frequency: "daily", blocks: [{ type: "header", text: { type: "plain_text", text: "Birdy brief · {{period}}" } }] },
  summary: ["header", "section", "chart"], channel_id: null,
  last_run: { at: "2026-11-20T07:30:00", status: "sent", key: "2026-11-20" },
}

describe("Slack reports, as Birdy's Reports shows them", () => {
  it("says when a scheduled report next goes out, in the account's zone", () => {
    const v = slackReportView(BRIEF, { accountTz: "Europe/London", birdyChannel: "marketing", now: NOW })
    expect(v).toMatchObject({
      name: "Daily brief", isDefault: true, what: "Birdy brief · ‹period›", when: "Daily · 9:00 AM London",
      channel: "#marketing", next: "Today · 9:00 AM", last: "Today · 7:30 AM", lastError: null, window: "Yesterday",
    })
    expect(v.status).toEqual({ tone: "success", label: "Sent today" })
  })

  it("has no next run when off or set off by an event", () => {
    expect(slackReportView({ ...BRIEF, enabled: false }, { now: NOW }).next).toBeNull()
    const event = { ...BRIEF, trigger: { type: "event", event: "account_created" }, last_run: null }
    expect(slackReportView(event, { now: NOW })).toMatchObject({ next: null, when: "New account added", last: null })
    expect(slackStatus(event, NOW)).toEqual({ tone: "accent", label: "On" })
  })

  it("names a failed last run and what to do about it", () => {
    const failed = { ...BRIEF, channel_id: "C1", channel_name: "ops", last_run: { at: "2026-11-18T09:00:00", status: "failed", error: "not_in_channel" } }
    const v = slackReportView(failed, { now: NOW })
    expect(v.status).toEqual({ tone: "danger", label: "Failed" })
    expect(v.channel).toBe("#ops")
    expect(v.lastError).toMatch(/invite it/)
  })

  it("says Paused for a report that is off, whatever its last run was", () => {
    expect(slackStatus({ ...BRIEF, enabled: false }, NOW)).toEqual({ tone: "neutral", label: "Paused" })
  })
})

const AGENT = {
  id: "ag1", status: "active",
  scope: { schedule: { time: "07:00", tz: "Europe/London" } },
  settings: {
    batches: [{ id: "a", name: "Batch A", weekdays: [0, 3] }, { id: "b", name: "Batch B", weekdays: [1, 4] }],
    weekly: { enabled: true, weekday: 0, auto_post: false },
    slack: { channel_name: "media-buying" },
  },
}

describe("the Media Buying Agent's reports, as Media Buyer's Reports shows them", () => {
  it("lists the morning report every day at its time, and the weekly one on its weekday", () => {
    const [morning, weekly] = buyerReports(AGENT, { local_date: "2026-11-20" }, NOW)
    expect(morning).toMatchObject({
      key: "morning", when: "Every day · 7:00 AM London", goesTo: "#media-buying in Slack", channel: "Slack",
      on: true, next: "Tomorrow · 7:00 AM", last: "Fri 20 Nov",
      detail: "Batch A on Mon, Thu · Batch B on Tue, Fri · other days: alerts only",
    })
    expect(weekly).toMatchObject({ key: "weekly", when: "Mondays · with the morning report", next: "Mon 23 Nov · 7:00 AM" })
    expect(weekly.detail).toMatch(/Waits/)
  })

  it("leaves the weekly report out when it is off, and has no next run while the agent is off", () => {
    const off = { ...AGENT, status: "paused", settings: { ...AGENT.settings, weekly: { enabled: false } } }
    const list = buyerReports(off, null, NOW)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ on: false, next: null, last: null })
  })

  it("uses the runner's defaults when the agent has no schedule or channel of its own", () => {
    expect(agentSchedule({ status: "active" })).toMatchObject({ time: "07:00", tz: "Europe/London", channel: null })
    expect(buyerReports({ status: "active" }, null, NOW)[0].goesTo).toMatch(/Birdy only/)
    expect(batchWords([{ name: "All", weekdays: [0, 1, 2, 3, 4, 5, 6] }])).toBe("All on Every day")
  })

  it("keeps only the weekly's weekday for the weekly report's runs", () => {
    const runs = [{ id: "1", local_date: "2026-11-16" }, { id: "2", local_date: "2026-11-17" }, { id: "3", local_date: "2026-11-09" }]
    expect(runsOf("weekly", runs, AGENT).map((r) => r.id)).toEqual(["1", "3"])
    expect(runsOf("morning", runs, AGENT)).toBe(runs)
  })

  it("sums up a run: its batch, the clients it checked, its alerts and whether it reached Slack", () => {
    const run = { local_date: "2026-11-19", kind: "batch", batch_id: "a", phase: "done", clients: { g1: { carded: true }, g2: { carded: true }, g3: { carded: false } }, alerts: [{}], slack: { ts: "1.2" } }
    expect(runLine(run, AGENT.settings.batches)).toEqual({ title: "Thu 19 Nov", line: "Batch A · 2 clients checked · 1 alert", state: { tone: "success", label: "Posted" } })
    expect(runLine({ ...run, kind: "alert_only", alerts: [], slack: {}, publish_error: "no channel" }).line).toBe("Alerts only · 0 alerts")
    expect(runLine({ ...run, kind: "alert_only", slack: {}, publish_error: "x" }).state.label).toBe("Not posted")
    expect(runLine({ ...run, phase: "checks" }).state.label).toBe("Running")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { bodyFor, initialForm } from "../ReportPanel"
import { contentSummary, lastRunShort, timeLabel, triggerLabel } from "../report-format"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
vi.mock("@/components/report-designer/ReportDesigner", () => ({ default: () => <div>designer</div> }))

import { apiRequest } from "@/lib/api"

const res = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })

const BRIEF = {
  id: "r1", name: "Daily brief", enabled: true, is_default: true,
  trigger: { type: "schedule", frequency: "daily", day: null, time: "09:00", timezone: null },
  template: { frequency: "daily", blocks: [{ type: "header", text: { type: "plain_text", text: "Birdy brief · {{period}}" } }] },
  summary: ["header", "section", "chart", "context"], channel_id: null,
  last_run: { at: "2026-10-27T09:00:12", status: "sent", key: "2026-10-27" },
}
const ALERT_REPORT = {
  id: "r2", name: "CPL follow-up", enabled: true, is_default: false,
  trigger: { type: "event", event: "alert_fired", alert_id: "a1" },
  template: { frequency: "daily", blocks: [] }, summary: [], channel_id: "C0OPS", channel_name: "ops",
  last_run: { at: "2026-10-20T14:45:00", status: "failed", error: "not_in_channel" },
}

let reports
let calls
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  calls.push({ path, method, body: init.body ? JSON.parse(init.body) : undefined })
  if (path === "/api/integrations/slack/status") return Promise.resolve(res({ installed: true, notify_channel_name: "marketing" }))
  if (path === "/api/alerts") return Promise.resolve(res({ alerts: [{ id: "a1", name: "CPL above £40" }] }))
  if (path === "/api/user/profile") return Promise.resolve(res({ timezone: "Europe/London" }))
  if (path === "/api/integrations/slack/channels") return Promise.resolve(res({ channels: [{ id: "C0OPS", name: "ops" }] }))
  if (path === "/api/slack-reports" && method === "GET") return Promise.resolve(res({ reports, max: 20 }))
  if (path === "/api/slack-reports/r2" && method === "PATCH") {
    return Promise.resolve(res({ report: { ...ALERT_REPORT, ...JSON.parse(init.body) } }))
  }
  return Promise.resolve(res({}, 404))
}

beforeEach(() => {
  reports = [BRIEF, ALERT_REPORT]
  calls = []
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("report form body", () => {
  it("builds a weekly schedule in its own timezone and channel", () => {
    const form = { ...initialForm(null), name: " Leadership ", frequency: "weekly", day: "Friday", time: "16:45", timezone: "Asia/Dubai", channelId: "C0OPS", window: "weekly" }
    expect(bodyFor(form, { channels: [{ id: "C0OPS", name: "ops" }] }).body).toEqual({
      name: "Leadership",
      trigger: { type: "schedule", frequency: "weekly", day: "Friday", time: "16:45", timezone: "Asia/Dubai" },
      channel_id: "C0OPS", channel_name: "ops",
      template: { frequency: "weekly" },
    })
  })

  it("builds an alert trigger, any alert by default", () => {
    const form = { ...initialForm(null), name: "x", kind: "event" }
    expect(bodyFor(form).body.trigger).toEqual({ type: "event", event: "alert_fired", alert_id: null })
    expect(bodyFor({ ...form, alertId: "a1" }).body.trigger.alert_id).toBe("a1")
    expect(bodyFor({ ...form, event: "account_created", alertId: "a1" }).body.trigger.alert_id).toBeNull()
  })

  it("the brief's numbers follow its schedule; account timezone and Birdy's channel are blank", () => {
    const form = { ...initialForm(BRIEF), frequency: "weekly", template: { blocks: [1] } }
    const { body } = bodyFor(form, { isDefault: true })
    expect(body.template).toEqual({ frequency: "weekly", blocks: [1] })
    expect(body.trigger.timezone).toBeNull()
    expect(body.channel_id).toBe("")
  })

  it("refuses an empty name or time", () => {
    expect(bodyFor({ ...initialForm(null), name: "  " }).error).toMatch(/name/)
    expect(bodyFor({ ...initialForm(null), name: "x", time: "" }).error).toMatch(/time/)
  })
})

describe("report words", () => {
  it("times, triggers and summaries", () => {
    expect(timeLabel("00:05")).toBe("12:05 AM")
    expect(timeLabel("16:45")).toBe("4:45 PM")
    expect(triggerLabel({ type: "schedule", frequency: "weekly", day: "Monday", time: "08:30" })).toBe("Mondays · 8:30 AM")
    expect(triggerLabel({ type: "event", event: "alert_fired", alert_id: null })).toBe("Any alert fires")
    expect(contentSummary(["header", "section", "section", "chart", "data_table of clients (spend)"]))
      .toBe("Header · 2 × text · Chart · Clients table")
  })

  it("last run reads naive server times as UTC", () => {
    const run = lastRunShort({ at: "2026-10-27T09:00:00", status: "skipped", error: "no active clients" },
      new Date("2026-10-27T12:00:00Z"))
    expect(run).toEqual({ tone: "neutral", text: "Skipped today", error: "no active clients" })
    expect(lastRunShort({ at: "2026-10-27T09:00:00Z", status: "sent" }, new Date("2026-10-27T12:00:00Z")))
      .toEqual({ tone: "success", text: "Sent today", error: null })
  })
})

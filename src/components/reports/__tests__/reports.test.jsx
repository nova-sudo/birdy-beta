import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { ReportsSection } from "../ReportsSection"
import { bodyFor, initialForm } from "../ReportPanel"
import { contentSummary, lastRunLabel, timeLabel, triggerLabel } from "../report-format"

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

const renderSection = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ReportsSection />
    </SWRConfig>,
  )

beforeEach(() => {
  reports = [BRIEF, ALERT_REPORT]
  calls = []
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Hub reports section", () => {
  it("lists each report with its trigger, channel and last run", async () => {
    renderSection()
    expect(await screen.findByText("Daily brief")).toBeInTheDocument()
    expect(screen.getByText("Default")).toBeInTheDocument()
    expect(screen.getByText("Daily · 9:00 AM")).toBeInTheDocument()
    expect(screen.getByText("“CPL above £40” fires")).toBeInTheDocument()
    expect(screen.getByText(/Birdy isn't in that channel/)).toBeInTheDocument()
    expect(screen.getByText("ops")).toBeInTheDocument()
    expect(screen.getByText("marketing")).toBeInTheDocument()
  })

  it("turns a report off from its card", async () => {
    renderSection()
    fireEvent.click(await screen.findByRole("switch", { name: "Turn off CPL follow-up" }))
    await waitFor(() => expect(calls).toContainEqual({ path: "/api/slack-reports/r2", method: "PATCH", body: { enabled: false } }))
  })

  it("asks for Slack before anything else when it isn't connected", async () => {
    vi.mocked(apiRequest).mockImplementation((path) =>
      path === "/api/integrations/slack/status" ? Promise.resolve(res({ installed: false })) : mockApi(path))
    renderSection()
    expect(await screen.findByText("Connect Slack to get reports")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Connect Slack" })).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("opens the form for a new report", async () => {
    renderSection()
    await screen.findByText("Daily brief")
    fireEvent.click(screen.getAllByRole("button", { name: /New report/ })[0])
    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByRole("heading", { name: "New report" })).toBeInTheDocument()
    expect(within(sheet).getByRole("button", { name: "Create report" })).toBeInTheDocument()
  })
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
    const run = lastRunLabel({ at: "2026-10-27T09:00:00", status: "skipped", error: "no active clients" },
      new Date("2026-10-27T12:00:00Z"))
    expect(run.tone).toBe("neutral")
    expect(run.text).toMatch(/^Skipped today .*: no active clients$/)
  })
})

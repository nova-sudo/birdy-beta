import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import "@/components/by/__tests__/jsdom"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard/reports", useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/components/report-designer/SlackMessagePreview", () => ({ default: ({ blocks }) => <div data-testid="slack-preview">{(blocks ?? []).length} blocks</div> }))

import { apiRequest } from "@/lib/api"
import { SlackReportPage, SlackReportsList } from "../reports-slack"
import { AgentReportPage, AgentReportsList } from "../reports-agent"
import { reportScope } from "../reports-slack"
import { COACH_SECTION } from "../sections"

const res = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })

const BRIEF = {
  id: "r1", name: "Daily brief", enabled: true, is_default: true,
  trigger: { type: "schedule", frequency: "daily", day: null, time: "09:00", timezone: null },
  template: { frequency: "daily", blocks: [{ type: "header", text: { type: "plain_text", text: "Birdy brief" } }] },
  summary: ["header", "section"], channel_id: null, last_run: null,
}
const LEAD = {
  id: "r2", name: "Leadership wrap-up", enabled: true, is_default: false,
  trigger: { type: "schedule", frequency: "weekly", day: "Friday", time: "16:30", timezone: "Europe/London" },
  template: { frequency: "weekly", blocks: [] }, summary: [], channel_id: "C0LEAD", channel_name: "leadership", last_run: null,
}
const GURU = { ...LEAD, id: "g1", name: "Guru weekly", owner: "media_buyer", channel_name: "ads" }
const COACH = { ...LEAD, id: "s1", name: "Calls recap", owner: "sales_coach", channel_name: "sales" }
const AGENT = {
  id: "ag1", type: "stock_media_buying", status: "active",
  scope: { schedule: { time: "07:00", tz: "Europe/London" } },
  settings: { batches: [{ id: "a", name: "Batch A", weekdays: [0, 3] }], weekly: { enabled: true, weekday: 0 }, slack: { channel_name: "media-buying" } },
}
const RUN = { id: "run1", local_date: "2026-11-16", kind: "batch", batch_id: "a", phase: "done", clients: { g1: { carded: true } }, alerts: [], slack: { ts: "1" } }

let state
let calls
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  calls.push({ path, method, body: init.body ? JSON.parse(init.body) : undefined })
  if (path === "/api/integrations/slack/status") return Promise.resolve(res({ installed: state.connected, notify_channel_name: "marketing" }))
  if (path === "/api/alerts") return Promise.resolve(res({ alerts: [] }))
  if (path === "/api/user/profile") return Promise.resolve(res({ timezone: "Europe/London" }))
  if (path === "/api/integrations/slack/channels") return Promise.resolve(res({ channels: [{ id: "C0LEAD", name: "leadership" }] }))
  if (path.startsWith("/api/slack-reports?owner=") && method === "GET") {
    const owner = new URLSearchParams(path.split("?")[1]).get("owner")
    // Filtered here as the server would; a report without an owner is Birdy's.
    return Promise.resolve(res({ reports: state.reports.filter((r) => (r.owner || "birdy") === owner || state.ignoreOwner), max: 20 }))
  }
  if (path === "/api/slack-reports" && method === "POST") return Promise.resolve(res({ report: { ...LEAD, id: "r9", ...JSON.parse(init.body) } }))
  if (path === "/api/slack-reports/r2/test") return Promise.resolve(res({ status: "sent" }))
  if (path === "/api/slack-reports/r2" && method === "PATCH") return Promise.resolve(res({ report: { ...LEAD, ...JSON.parse(init.body) } }))
  if (path === "/api/report-designer/preview") return Promise.resolve(res({ blocks: [{}, {}], sample: false }))
  if (path === "/api/agents") return Promise.resolve(res(state.agents))
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(AGENT))
  if (path === "/api/agents/ag1/runs/latest") return Promise.resolve(res({ run: RUN, open_cards: 0 }))
  if (path === "/api/agents/ag1/runs") return Promise.resolve(res({ runs: [RUN], next_before: null }))
  if (path === "/api/agents/ag1/runs/run1") return Promise.resolve(res({ run: { ...RUN, alerts: [{ id: "al1", title: "Spend stopped" }] }, cards: [{ id: "c1", client_name: "Cloud Nine", zone: "red", current_cpl: 42, previous_cpl: 30, currency: "GBP", lines: [] }] }))
  if (path === "/api/agents/ag1/slack-templates/summary/test") return Promise.resolve(res(state.testFails ? { detail: "Slack isn't connected" } : { ok: true, kind: "summary", channel_id: "C0MB", channel_name: "media-buying", source: "latest" }, state.testFails ? 409 : 200))
  if (/^\/api\/agents\/ag1\/slack-templates\/\w+\/preview$/.test(path)) return Promise.resolve(res({ kind: "x", blocks: [{}], sample: true }))
  if (path === "/api/agents/ag1/settings" && method === "PATCH") return Promise.resolve(res(AGENT))
  if (path === "/api/agents/ag1" && method === "PATCH") return Promise.resolve(res(AGENT))
  return Promise.resolve(res({}, 404))
}

const wrap = (ui) => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>)
const writes = () => calls.filter((c) => c.method !== "GET")

beforeEach(() => {
  state = { connected: true, reports: [BRIEF, LEAD, GURU, COACH], agents: [AGENT] }
  calls = []
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Birdy › Reports", () => {
  it("lists the account's Slack reports, each linking to its page, without writing anything", async () => {
    wrap(<SlackReportsList />)
    const list = await screen.findByRole("list", { name: "Your reports" })
    const links = within(list).getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/dashboard/reports/r1", "/dashboard/reports/r2"])
    expect(within(list).getByText("Birdy brief")).toBeInTheDocument()
    expect(within(list).getByText(/Fridays · 4:30 PM London · #leadership/)).toBeInTheDocument()
    expect(writes()).toEqual([])
  })

  it("turns a report off with its switch, and only then", async () => {
    wrap(<SlackReportsList />)
    await userEvent.click(await screen.findByRole("switch", { name: "Leadership wrap-up: on" }))
    await waitFor(() => expect(writes()).toEqual([{ path: "/api/slack-reports/r2", method: "PATCH", body: { enabled: false } }]))
  })

  it("asks Slack to be connected when it isn't", async () => {
    state.connected = false
    wrap(<SlackReportsList />)
    expect(await screen.findByRole("link", { name: "Connect Slack" })).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("sends a test only after the confirm button, never on opening or cancelling", async () => {
    wrap(<SlackReportPage reportId="r2" />)
    await userEvent.click(await screen.findByRole("button", { name: "Send a test" }))
    const dialog = await screen.findByRole("dialog", { name: "Send a test now?" })
    expect(dialog).toHaveTextContent("#leadership")
    expect(writes()).toEqual([])
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(writes()).toEqual([])

    await userEvent.click(screen.getByRole("button", { name: "Send a test" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send test" }))
    await waitFor(() => expect(writes()).toEqual([{ path: "/api/slack-reports/r2/test", method: "POST", body: undefined }]))
    expect(await screen.findByText("Test sent to #leadership.")).toBeInTheDocument()
  })

  it("builds the preview only when asked, for the report's owner", async () => {
    wrap(<SlackReportPage reportId="r1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Show a preview" }))
    expect(await screen.findByTestId("slack-preview")).toHaveTextContent("2 blocks")
    expect(calls.find((c) => c.path === "/api/report-designer/preview").body).toEqual({ template: BRIEF.template, owner: "birdy" })
  })

  it("saves a change through the report form", async () => {
    wrap(<SlackReportPage reportId="r2" />)
    await userEvent.click(await screen.findByRole("button", { name: "Change" }))
    const dialog = await screen.findByRole("dialog", { name: "Change Leadership wrap-up" })
    const name = within(dialog).getByLabelText("Name")
    await userEvent.clear(name)
    await userEvent.type(name, "Leadership")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]).toMatchObject({ path: "/api/slack-reports/r2", method: "PATCH", body: { name: "Leadership", channel_id: "C0LEAD", trigger: { frequency: "weekly", day: "Friday", time: "16:30" } } })
  })

  it("can't delete the brief, only turn it off", async () => {
    wrap(<SlackReportPage reportId="r1" />)
    await screen.findByRole("button", { name: "Change" })
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
  })
})

describe("Birdy's list holds only Birdy's reports", () => {
  it("drops another agent's reports even if the server ignores the owner filter", async () => {
    state.ignoreOwner = true
    wrap(<SlackReportsList />)
    const list = await screen.findByRole("list", { name: "Your reports" })
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/dashboard/reports/r1", "/dashboard/reports/r2"])
  })
})

describe("Sales Coach › Reports", () => {
  const scope = reportScope(COACH_SECTION)

  it("lists its own Slack reports under its own address", async () => {
    wrap(<SlackReportsList scope={scope} />)
    const list = await screen.findByRole("list", { name: "Your reports" })
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/sales-coach/reports/s1"])
    expect(calls.some((c) => c.path === "/api/slack-reports?owner=sales_coach")).toBe(true)
  })

  it("creates a new report with its owner", async () => {
    wrap(<SlackReportsList scope={scope} />)
    await userEvent.click(await screen.findByRole("button", { name: "New report" }))
    const dialog = await screen.findByRole("dialog", { name: "New report" })
    await userEvent.type(within(dialog).getByLabelText("Name"), "Calls daily")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create report" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]).toMatchObject({ path: "/api/slack-reports", method: "POST", body: { name: "Calls daily", owner: "sales_coach" } })
    expect(push).toHaveBeenCalledWith("/sales-coach/reports/r9")
  })

  it("opens its report's page with Change, Send a test and a preview, and says it is Sales Coach that posts", async () => {
    wrap(<SlackReportPage reportId="s1" scope={scope} />)
    expect(await screen.findByRole("link", { name: "Reports" })).toHaveAttribute("href", "/sales-coach/reports")
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show a preview" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Send a test" }))
    expect(await screen.findByRole("dialog", { name: "Send a test now?" })).toHaveTextContent("Sales Coach posts “Calls recap”")
  })

  it("doesn't open another agent's report under its address", async () => {
    wrap(<SlackReportPage reportId="r2" scope={scope} />)
    expect(await screen.findByText("This report isn’t here")).toBeInTheDocument()
  })
})

describe("Marketing Guru › Reports", () => {
  it("lists the agent's morning and weekly reports first, then its own Slack reports", async () => {
    wrap(<AgentReportsList client={null} />)
    const list = await screen.findByRole("list", { name: "Your reports" })
    await within(list).findByText("Guru weekly")
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/media-buyer/reports/morning", "/media-buyer/reports/weekly", "/media-buyer/reports/g1"])
    expect(within(list).getByText(/Every day · 7:00 AM London/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New report" })).toBeInTheDocument()
  })

  it("never links to the old agent page", async () => {
    const { container } = wrap(<AgentReportsList client={null} />)
    await screen.findByText("Guru weekly")
    expect(container.querySelector('a[href^="/hub"]')).toBeNull()
  })

  it("lists only its Slack reports when the agent isn't set up", async () => {
    state.agents = []
    wrap(<AgentReportsList client={null} />)
    const list = await screen.findByRole("list", { name: "Your reports" })
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/media-buyer/reports/g1"])
  })

  it("turns the weekly report off from its switch", async () => {
    wrap(<AgentReportsList client={null} />)
    await userEvent.click(await screen.findByRole("switch", { name: "Weekly report: on" }))
    await waitFor(() => expect(writes()).toEqual([{ path: "/api/agents/ag1/settings", method: "PATCH", body: { settings: { weekly: { enabled: false } } } }]))
  })

  it("opens a run in place, not on the old agent page", async () => {
    const { container } = wrap(<AgentReportPage reportKey="morning" />)
    const runs = await screen.findByRole("list", { name: "Runs" })
    expect(container.querySelector('a[href^="/hub"]')).toBeNull()
    const run = within(runs).getByRole("button")
    expect(run).toHaveTextContent("Batch A · 1 client checked · 0 alerts")
    await userEvent.click(run)
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Cloud Nine")).toBeInTheDocument()
    expect(within(dialog).getByText("Spend stopped")).toBeInTheDocument()
    expect(writes()).toEqual([])
  })

  it("sends a test of the morning report only after the confirm button", async () => {
    wrap(<AgentReportPage reportKey="morning" />)
    await userEvent.click(await screen.findByRole("button", { name: "Send a test" }))
    const dialog = await screen.findByRole("dialog", { name: "Send a test now?" })
    expect(dialog).toHaveTextContent("#media-buying")
    expect(writes()).toEqual([])
    await userEvent.click(within(dialog).getByRole("button", { name: "Send test" }))
    await waitFor(() => expect(writes()).toEqual([{ path: "/api/agents/ag1/slack-templates/summary/test", method: "POST", body: undefined }]))
    expect(await screen.findByText("Test sent to #media-buying with the latest run's figures.")).toBeInTheDocument()
  })

  it("says why a test wasn't sent", async () => {
    state.testFails = true
    wrap(<AgentReportPage reportKey="morning" />)
    await userEvent.click(await screen.findByRole("button", { name: "Send a test" }))
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send test" }))
    expect(await screen.findByText("Not sent: Slack isn't connected")).toBeInTheDocument()
  })

  it("previews the morning report's summary and card, writing nothing", async () => {
    wrap(<AgentReportPage reportKey="morning" />)
    await userEvent.click(await screen.findByRole("button", { name: "Show a preview" }))
    expect(await screen.findAllByTestId("slack-preview")).toHaveLength(2)
    expect(calls.filter((c) => c.path.endsWith("/preview")).map((c) => c.path)).toEqual(["/api/agents/ag1/slack-templates/summary/preview", "/api/agents/ag1/slack-templates/card/preview"])
  })

  it("changes the morning report's time and channel through Change", async () => {
    wrap(<AgentReportPage reportKey="morning" />)
    await userEvent.click(await screen.findByRole("button", { name: "Change" }))
    const dialog = await screen.findByRole("dialog", { name: "Change Morning report" })
    fireEvent.change(within(dialog).getByLabelText("Time"), { target: { value: "08:30" } })
    await userEvent.selectOptions(within(dialog).getByLabelText("Channel"), await within(dialog).findByRole("option", { name: "#leadership" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()).toEqual([
      { path: "/api/agents/ag1", method: "PATCH", body: { scope: { schedule: { time: "08:30", tz: "Europe/London" } } } },
      { path: "/api/agents/ag1/settings", method: "PATCH", body: { settings: { slack: { channel_id: "C0LEAD", channel_name: "leadership" } } } },
    ])
  })

  it("changes the weekly report's day and posting through Change", async () => {
    wrap(<AgentReportPage reportKey="weekly" />)
    await userEvent.click(await screen.findByRole("button", { name: "Change" }))
    const dialog = await screen.findByRole("dialog", { name: "Change Weekly report" })
    await userEvent.click(within(dialog).getByRole("radio", { name: "Friday" }))
    await userEvent.click(within(dialog).getByRole("switch", { name: "Post it to Slack by itself" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]).toEqual({ path: "/api/agents/ag1/settings", method: "PATCH", body: { settings: { weekly: { enabled: true, weekday: 4, auto_post: true } } } })
  })
})

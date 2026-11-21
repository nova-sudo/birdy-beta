import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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
  if (path === "/api/slack-reports" && method === "GET") return Promise.resolve(res({ reports: state.reports, max: 20 }))
  if (path === "/api/slack-reports/r2/test") return Promise.resolve(res({ status: "sent" }))
  if (path === "/api/slack-reports/r2" && method === "PATCH") return Promise.resolve(res({ report: { ...LEAD, ...JSON.parse(init.body) } }))
  if (path === "/api/report-designer/preview") return Promise.resolve(res({ blocks: [{}, {}], sample: false }))
  if (path === "/api/agents") return Promise.resolve(res(state.agents))
  if (path === "/api/agents/ag1") return Promise.resolve(res(AGENT))
  if (path === "/api/agents/ag1/runs/latest") return Promise.resolve(res({ run: RUN, open_cards: 0 }))
  if (path === "/api/agents/ag1/runs") return Promise.resolve(res({ runs: [RUN], next_before: null }))
  return Promise.resolve(res({}, 404))
}

const wrap = (ui) => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>)
const writes = () => calls.filter((c) => c.method !== "GET")

beforeEach(() => {
  state = { connected: true, reports: [BRIEF, LEAD], agents: [AGENT] }
  calls = []
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Agency Ops › Reports", () => {
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

  it("builds the preview only when asked", async () => {
    wrap(<SlackReportPage reportId="r1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Show a preview" }))
    expect(await screen.findByTestId("slack-preview")).toHaveTextContent("2 blocks")
    expect(calls.find((c) => c.path === "/api/report-designer/preview").body).toEqual({ template: BRIEF.template })
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

describe("Media Buyer › Reports", () => {
  it("lists the agent's morning and weekly reports", async () => {
    wrap(<AgentReportsList client={null} />)
    const list = await screen.findByRole("list", { name: "The agent's reports" })
    expect(within(list).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/media-buyer/reports/morning", "/media-buyer/reports/weekly"])
    expect(within(list).getByText(/Every day · 7:00 AM London/)).toBeInTheDocument()
  })

  it("points to setup when there is no agent", async () => {
    state.agents = []
    wrap(<AgentReportsList client={null} />)
    expect(await screen.findByRole("link", { name: "Set it up" })).toHaveAttribute("href", "/hub/agents/media-buying/setup")
  })

  it("lists a report's runs, each opening the full report", async () => {
    wrap(<AgentReportPage reportKey="morning" />)
    const runs = await screen.findByRole("list", { name: "Runs" })
    const link = within(runs).getByRole("link")
    expect(link).toHaveAttribute("href", "/hub/agents/media-buying?run=run1")
    expect(link).toHaveTextContent("Batch A · 1 client checked · 0 alerts")
  })
})

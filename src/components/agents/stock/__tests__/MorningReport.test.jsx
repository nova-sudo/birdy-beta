import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig, useSWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
const push = vi.fn()
const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => <svg data-testid="birdy" /> }))

import { ConfirmHost } from "@/components/ds"
import { PageHeaderProvider, PageHeaderTitle } from "@/components/page-header"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import ReportPage from "@/app/hub/agents/media-buying/page"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

// Radix Select asks jsdom for these.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const WINDOW = { start: "2026-10-27", end: "2026-11-02", prev_start: "2026-10-20", prev_end: "2026-10-26" }
const line = (over = {}) => ({ id: "l1", kind: "remove", ad_name: "Static Offer", mode: "ask", state: "proposed", error: null, flags: [], ...over })
const card = (over = {}) => ({
  id: "c1", client_group_id: "g1", client_name: "Harbour Body Co", tag: "changes", zone: "red", status: "open", can_apply: true, has_newer: false,
  currency: "GBP", previous_cpl: 10, current_cpl: 12, leads: 31, ads_live: 4, window: WINDOW, lines: [line()], thought_process: "CPL rose.", next_steps: "Friday.", ...over,
})
const run = (over = {}) => ({
  id: "r1", kind: "batch", batch_id: "b", local_date: "2026-11-03", as_of: "2026-11-03T07:00:00", phase: "done",
  clients: { g1: { state: "done" } }, alerts: [], summary: {}, slack: { ts: "1.2" }, publish_error: null, slack_pending: false, slack_late: false, ...over,
})
const report = (over = {}) => ({
  run: run(), cards: [card()], follow_ups: [], scoreboard: { won: 0, lost: 0, moves: 0, rows: [] }, learned: [], proposals: [], weekly: null, ...over,
})
const FULL = () =>
  report({
    run: run({ alerts: [{ client_group_id: "g3", code: "spend_stopped", severity: "critical", title: "No spend yesterday", detail: "Nothing spent since Sunday.", since: "2026-11-01" }] }),
    cards: [
      card(),
      card({ id: "c2", client_group_id: "g2", client_name: "Velvet Laser", zone: "yellow", previous_cpl: 8, current_cpl: 9, lines: [line({ id: "l1", ad_name: "Plans" })] }),
      card({ id: "c3", client_group_id: "g3", client_name: "Coastline Med Spa", zone: "green", tag: "no_changes", previous_cpl: 7, current_cpl: 7.5, lines: [] }),
      card({ id: "c4", client_group_id: "g4", client_name: "Lumen Skin Clinic", zone: "green", tag: "green", previous_cpl: 8, current_cpl: 7, lines: [] }),
    ],
    follow_ups: [
      { client_group_id: "g1", line_id: "l1", text: "Timelapse: live and spending", ok: true },
      { client_group_id: "g1", line_id: "l2", text: "Static Offer: still live", ok: false },
      { client_group_id: "g1", line_id: "additional_changes", text: "Additional changes: check by hand", ok: null },
    ],
    scoreboard: {
      won: 3, lost: 1, moves: 4,
      rows: [
        { id: "o1", client_group_id: "g1", creative_key: "ba", ad_name: "BS - Before After - 110326 - Win", result: "won", currency: "GBP", spend: 10, leads: 2, cpl: 5 },
        { id: "o2", client_group_id: "g2", creative_key: "ba", ad_name: "BS - Before After - 100326 - Win", result: "won", currency: "GBP", spend: 10, leads: 2, cpl: 5 },
        { id: "o3", client_group_id: "g3", creative_key: "ba", ad_name: "BS - Before After - 090326 - Win", result: "won", currency: "EUR", spend: 10, leads: 2, cpl: 5 },
        { id: "o4", client_group_id: "g1", creative_key: "pl", ad_name: "Plans Concept", result: "lost", currency: "GBP", spend: 30, leads: 1, cpl: 30 },
      ],
    },
    learned: [{ id: "m1", text: "Wait 3 days before judging new laser ads.", source: "slack_mention", client_group_id: "g2", status: "active", created_at: "2026-10-30T09:00:00" }],
    proposals: [{ id: "p1", kind: "promote", text: "Before After won in 3 accounts in Body. Prefer it.", status: "open" }],
    weekly: {
      values: { week: "26 Oct to 1 Nov", comparison: "Against the week before", improved: "Lumen improved", decreased: "Harbour still red", status_check: "1 fewer red", wins: "Lumen won" },
      posted: false,
    },
  })

let agent
let latest
let reports
let runsPages
let outcomes
let answers
let mutateAll

const AGENT = () => ({ id: "ag1", type: "stock_media_buying", name: "Birdy Media Buying Agent", status: "active", settings: { batches: [{ id: "b", name: "Batch B", weekdays: [1] }], slack: { channel_id: "C1" } }, scope: { client_group_ids: ["g1"] } })
const GROUPS = [
  { id: "g1", name: "Harbour Body Co" },
  { id: "g2", name: "Velvet Laser" },
  { id: "g3", name: "Coastline Med Spa" },
  { id: "g4", name: "Lumen Skin Clinic" },
]

function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  const hit = answers[`${method} ${path}`]
  if (hit) return Promise.resolve(typeof hit === "function" ? hit() : hit)
  if (path === "/api/agents" && method === "GET") return Promise.resolve(res(agent ? [agent] : []))
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(agent))
  if (path === "/api/agents/ag1/runs/latest") return Promise.resolve(res({ run: latest, open_cards: 0 }))
  if (path === "/api/agents/ag1/outcomes") return Promise.resolve(res(outcomes))
  if (path === "/api/agents/ag1/lessons") return Promise.resolve(res([]))
  const one = path.match(/^\/api\/agents\/ag1\/runs\/(\w+)$/)
  if (one && reports[one[1]]) return Promise.resolve(res(reports[one[1]]))
  if (path.startsWith("/api/agents/ag1/runs")) {
    const before = new URL(`http://x${path}`).searchParams.get("before")
    return Promise.resolve(res(runsPages[before ?? ""] ?? { runs: [], next_before: null }))
  }
  if (path.startsWith("/api/client-groups")) return Promise.resolve(res({ client_groups: GROUPS }))
  return Promise.resolve(res({}, 404))
}

function Grab() {
  const { mutate } = useSWRConfig()
  mutateAll = () => mutate(() => true)
  return null
}
const page = () => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher, errorRetryCount: 0, shouldRetryOnError: false }}>
    <Grab />
    <ConfirmHost />
    <ReportPage />
  </SWRConfig>
)
const renderPage = () => render(page())
const calls = (path, method) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)
const heading = (name) => screen.findByRole("heading", { name })
const rowFor = (name) => screen.findByRole("row", { name })
const openRow = async (name) => userEvent.click(await rowFor(name))
const clientNames = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)
const cellsOf = async (name) => within(await rowFor(name)).getAllByRole("cell").map((c) => c.textContent)

const use = (rep) => {
  latest = rep.run
  reports = { [rep.run.id]: rep }
}

beforeEach(() => {
  window.innerWidth = 1360
  agent = AGENT()
  use(report())
  runsPages = { "": { runs: [run()], next_before: null } }
  outcomes = { won: 0, lost: 0, moves: 0, rows: [] }
  answers = {}
  search = ""
  push.mockReset()
  replace.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})
afterEach(() => vi.useRealTimers())

describe("Agent page: lessons and settings tabs", () => {
  it("the Lessons tab lists the lessons, empty at first", async () => {
    search = "tab=lessons"
    renderPage()
    expect(await screen.findByText(/Nothing yet. When you edit a card/)).toBeInTheDocument()
  })

  it("the Settings tab opens the agent's settings once the clients are in", async () => {
    search = "tab=settings"
    renderPage()
    expect(await screen.findByRole("region", { name: "Schedule settings" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Flag, Ask me or Auto settings" })).toBeInTheDocument()
  })
})

describe("Agent page: the top bar", () => {
  const withBar = () => render(<PageHeaderProvider><header data-testid="bar"><PageHeaderTitle /></header>{page()}</PageHeaderProvider>)

  it("names the section that is open", async () => {
    search = "tab=settings"
    withBar()
    await screen.findByRole("region", { name: "Schedule settings" })
    expect(screen.getByTestId("bar")).toHaveTextContent("Birdy Media Buying AgentSettings")
    expect(screen.getByTestId("bar")).not.toHaveTextContent("Morning report")
  })

  it("says Report on the report", async () => {
    withBar()
    await screen.findByRole("table")
    expect(screen.getByTestId("bar")).toHaveTextContent("Birdy Media Buying AgentReport")
  })
})


// The old Report tab (answer box, tiles, side panel, Apply all, follow-ups, weekly, Scoreboard tab) came off
// the page with the sheet redesign (spec §2.1); the sheet and chat have their own tests. These keep the
// page's links and states honest against the API.
describe("Agent page: the report sheet", () => {
  it("reads ?run= from the Slack link and opens that report, even one past the first page", async () => {
    search = "run=r9"
    reports.r9 = report({ run: run({ id: "r9", local_date: "2026-06-02" }), cards: [card({ id: "c9", client_name: "From Slack" })] })
    renderPage()
    expect(await within(await screen.findByRole("table")).findByRole("button", { name: "From Slack: open Birdy's chat" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Report:/ })).toHaveTextContent("2 Jun")
    expect(screen.getByTestId("sheet-summary")).toHaveTextContent("Read-only")
    expect(calls("/api/agents/ag1/runs/r1", "GET")).toHaveLength(0)
  })

  it("a run that can't be found says so, and offers the way back to the latest", async () => {
    search = "run=gone"
    answers["GET /api/agents/ag1/runs/gone"] = res({ detail: "Run not found" }, 404)
    renderPage()
    expect(await screen.findByText("Run not found")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open the latest report" }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying")
  })

  it("today's report lists its clients with what Birdy wants", async () => {
    use(FULL())
    renderPage()
    expect(await within(await screen.findByRole("table")).findByRole("button", { name: "Harbour Body Co: open Birdy's chat" })).toBeInTheDocument()
    expect(screen.getByTestId("sheet-summary")).toHaveTextContent("3 to decide")
    expect(screen.getByTestId("sheet-summary")).toHaveTextContent("1 ads stopped")
  })
})

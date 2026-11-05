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
import { ScoreboardTab } from "../Scoreboard"

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

  it("says Morning report on the report", async () => {
    withBar()
    await heading("Morning report")
    expect(screen.getByTestId("bar")).toHaveTextContent("Morning report")
  })
})

describe("Morning report: the page", () => {
  it("lists the clients worst first: at risk, then changes, then red, yellow, no data, green, then not checked", async () => {
    use(report({
      run: run({
        clients: { n: { state: "no_zones", reason: "Needs zones." } },
        alerts: [{ client_group_id: "g3", code: "payment_issue", severity: "critical", title: "Payment problem", detail: "x" }],
      }),
      cards: [
        card({ id: "c4", client_group_id: "g4", client_name: "Green Co", zone: "green", tag: "green", lines: [] }),
        card({ id: "c5", client_group_id: "g5", client_name: "No Data Co", zone: "no_data", tag: "no_changes", current_cpl: null, previous_cpl: null, lines: [] }),
        card({ id: "c6", client_group_id: "g6", client_name: "Yellow Co", zone: "yellow", tag: "no_changes", lines: [] }),
        card({ id: "c7", client_group_id: "g7", client_name: "Red Co", zone: "red", tag: "no_changes", lines: [] }),
        card({ id: "c8", client_group_id: "g8", client_name: "No Leads Co", zone: "red", tag: "no_changes", current_cpl: null, lines: [] }),
        card({ id: "c1", client_name: "Changes Co", zone: "yellow" }),
        card({ id: "c3", client_group_id: "g3", client_name: "At Risk Co", zone: "green", tag: "green", lines: [] }),
      ],
    }))
    renderPage()
    await heading("Clients")
    expect(clientNames()).toEqual(["At Risk Co", "Changes Co", "No Leads Co", "Red Co", "Yellow Co", "No Data Co", "Green Co", "A client"])
  })

  it("renders the sections in order, with an agency-wide alert above the clients", async () => {
    const rep = FULL()
    rep.run.alerts.push({ client_group_id: null, code: "meta_reconnect", severity: "critical", title: "Meta needs reconnecting", detail: "Reconnect it." })
    use(rep)
    renderPage()
    const names = ["Alerts", "Clients", "Follow-ups from last round", /keeps working/, "What I learned since last time", "Weekly message"]
    const found = await Promise.all(names.map((n) => heading(n)))
    const answer = screen.getByRole("heading", { name: /1 green, 1 yellow, 2 red or stopped/ })
    ;[answer, ...found].reduce((prev, next) => {
      expect(prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      return next
    })
  })

  it("the answer box says what to look at first and who needs an OK, from the numbers", async () => {
    use(FULL())
    renderPage()
    expect(await screen.findByRole("heading", { name: "1 green, 1 yellow, 2 red or stopped. Look at Coastline Med Spa first." })).toBeInTheDocument()
    expect(screen.getByText(/2 cards need your OK: Harbour Body Co and Velvet Laser/)).toBeInTheDocument()
  })

  it("the answer box names a few clients waiting and counts the rest", async () => {
    const names = ["One", "Two", "Three", "Four", "Five", "Six"]
    use(report({ cards: names.map((n, i) => card({ id: `c${i}`, client_group_id: `g${i}`, client_name: n })) }))
    renderPage()
    expect(await screen.findByText(/6 cards need your OK: One, Two, Three and 3 more/)).toBeInTheDocument()
  })

  it("heads the page with the date, batch and window", async () => {
    renderPage()
    expect(await screen.findByText("Tue 3 Nov · Batch B · 27 Oct to 2 Nov compared with the 7 days before")).toBeInTheDocument()
  })

  it("a run in progress shows progress and polls until it is done", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const r = report({ run: run({ phase: "checks", clients: { g1: { state: "done" }, g2: { state: "pending" } } }), cards: [] })
    use(r)
    renderPage()
    expect(await screen.findByText(/1 of 2 clients checked/)).toBeInTheDocument()
    const before = calls("/api/agents/ag1/runs/r1", "GET").length
    use(report({ run: run({ clients: { g1: { state: "done" }, g2: { state: "done" } } }) }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5100) })
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1", "GET").length).toBeGreaterThan(before))
    await waitFor(() => expect(screen.queryByText(/clients checked/)).not.toBeInTheDocument())
    const settled = calls("/api/agents/ag1/runs/r1", "GET").length
    await act(async () => { await vi.advanceTimersByTimeAsync(11000) })
    expect(calls("/api/agents/ag1/runs/r1", "GET").length).toBe(settled)
  })

  it("keeps polling while a line is still being applied", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    use(report({ cards: [card({ lines: [line({ state: "applying" })] })] }))
    renderPage()
    await heading("Clients")
    const before = calls("/api/agents/ag1/runs/r1", "GET").length
    await act(async () => { await vi.advanceTimersByTimeAsync(5100) })
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1", "GET").length).toBeGreaterThan(before))
  })

  it("a run waiting on data says it carries on by itself", async () => {
    use(report({ run: run({ phase: "waiting", clients: { g1: { state: "waiting" } } }), cards: [] }))
    renderPage()
    expect(await screen.findByText(/waiting for ad data from Meta/i)).toBeInTheDocument()
  })

  it("a client that failed shows couldn't be checked with the reason", async () => {
    use(report({ run: run({ clients: { g1: { state: "done" }, g2: { state: "failed", error: "Meta needs reconnecting." } } }) }))
    renderPage()
    await openRow(/Velvet Laser/)
    expect(await screen.findByText("Velvet Laser couldn't be checked")).toBeInTheDocument()
    expect(screen.getByText("Meta needs reconnecting.")).toBeInTheDocument()
  })

  it("names what an early end left unfinished, and stale data", async () => {
    use(report({ run: run({ ended_early: true, summary: { missing: ["g2"], stale: true, stale_clients: ["g1"], health_unread: ["g4"] } }) }))
    renderPage()
    await openRow(/Velvet Laser/)
    expect(await screen.findByText("Velvet Laser wasn't finished")).toBeInTheDocument()
    await openRow(/Lumen Skin Clinic/)
    expect(await screen.findByText(/Lumen Skin Clinic.* health couldn't be read/)).toBeInTheDocument()
    expect(screen.getByText(/stopped before it finished/)).toBeInTheDocument()
    expect(screen.getByText(/couldn't be refreshed/)).toBeInTheDocument()
  })

  it("a client with no card says why", async () => {
    use(report({ run: run({ clients: { g1: { state: "done" }, g2: { state: "no_zones", reason: "Velvet needs zones." } } }) }))
    renderPage()
    await openRow(/Velvet Laser/)
    expect(await screen.findByText("Velvet needs zones.")).toBeInTheDocument()
  })

  it("a client's alerts are in its panel, and only agency-wide ones stay above the table", async () => {
    use(report({
      run: run({ alerts: [
        { client_group_id: "g1", code: "check_failed", severity: "warning", title: "Couldn't check Harbour Body Co", detail: "Timed out." },
        { client_group_id: "g2", code: "payment_issue", severity: "critical", title: "Payment problem on the ad account", detail: "Update the card." },
        { client_group_id: null, code: "meta_reconnect", severity: "critical", title: "Meta needs reconnecting", detail: "Reconnect it." },
      ] }),
      cards: [card(), card({ id: "c2", client_group_id: "g2", client_name: "Velvet Laser" })],
    }))
    renderPage()
    const frame = (await heading("Alerts")).closest("section")
    expect(within(frame).getByText("Meta needs reconnecting")).toBeInTheDocument()
    expect(within(frame).queryByText(/Payment problem/)).not.toBeInTheDocument()
    // The client at risk comes first, so its panel is the one open.
    const panel = screen.getByRole("article", { name: "Velvet Laser" })
    expect(within(panel).getByText("Payment problem on the ad account")).toBeInTheDocument()
    expect(within(panel).getByText("Needs you")).toBeInTheDocument()
    expect(within(await rowFor(/Velvet Laser/)).getAllByRole("cell")[6]).toHaveTextContent("1")
    await openRow(/Harbour/)
    expect(screen.getByRole("article", { name: "Harbour Body Co" })).toHaveTextContent("Couldn't check Harbour Body Co")
    expect(screen.queryByRole("article", { name: "Velvet Laser" })).not.toBeInTheDocument()
  })

  it.each([
    ["Meta Graph error on act_1/ads: (#200) Ad account owner has NOT granted ads_read", /Meta hasn't given Birdy access/],
    ["Meta Graph error on act_1/ads: (#17) rate limited", /Meta returned an error/],
  ])("doesn't show Meta's own error text: %s", async (detail, copy) => {
    use(report({ run: run({ alerts: [{ client_group_id: "g1", code: "check_failed", severity: "warning", title: "Couldn't check", detail }] }) }))
    renderPage()
    expect(await screen.findByText(copy)).toBeInTheDocument()
    expect(screen.queryByText(/Graph error/)).not.toBeInTheDocument()
  })

  it("the tiles count the clients and filter the table", async () => {
    use(report({
      run: run({
        clients: { g9: { state: "failed", error: "Timed out." } },
        alerts: [
          { client_group_id: "g2", code: "payment_issue", severity: "critical", title: "Payment problem", detail: "x" },
          { client_group_id: "g3", code: "ad_rejected", severity: "warning", title: "Ad rejected", detail: "x" },
        ],
      }),
      cards: [
        card({ client_name: "Red Changes" }),
        card({ id: "c2", client_group_id: "g2", client_name: "At Risk", zone: "green", tag: "green", lines: [] }),
        card({ id: "c3", client_group_id: "g3", client_name: "Ad Issue", zone: "yellow", tag: "no_changes", lines: [] }),
      ],
    }))
    renderPage()
    await heading("Clients")
    const tile = (name) => screen.getByRole("button", { name })
    expect(tile(/^4\s*All clients/)).toHaveAttribute("aria-pressed", "true")
    expect(clientNames()).toHaveLength(4)
    const cases = [[/^1\s*Spend at risk/, ["At Risk"]], [/^1\s*Red$/, ["Red Changes"]], [/^1\s*Suggested changes/, ["Red Changes"]], [/^1\s*With ad issues/, ["Ad Issue"]], [/^1\s*Not checked/, ["A client"]]]
    for (const [name, names] of cases) {
      await userEvent.click(tile(name))
      expect(tile(name)).toHaveAttribute("aria-pressed", "true")
      expect(clientNames()).toEqual(names)
      // The panel never describes a row the filter hid.
      expect(screen.getByRole("article", { name: names[0] })).toBeInTheDocument()
    }
  })

  it("a tile with no clients says so", async () => {
    use(report({ cards: [card({ zone: "green", tag: "green", lines: [] })] }))
    renderPage()
    await heading("Clients")
    await userEvent.click(screen.getByRole("button", { name: /^0\s*Red$/ }))
    expect(await screen.findByText("No clients here.")).toBeInTheDocument()
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
  })

  it("marks the row whose details are open", async () => {
    use(FULL())
    renderPage()
    expect(await rowFor(/Coastline/)).toHaveAttribute("aria-current", "true")
    await openRow(/Velvet Laser/)
    expect(await rowFor(/Velvet Laser/)).toHaveAttribute("aria-current", "true")
    expect(await rowFor(/Coastline/)).not.toHaveAttribute("aria-current")
  })

  it("below 1200px the details open in a sheet from the row, not beside the table", async () => {
    window.innerWidth = 390
    use(FULL())
    renderPage()
    await heading("Clients")
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
    await openRow(/Velvet Laser/)
    const sheet = await screen.findByRole("dialog", { name: "Velvet Laser" })
    expect(within(sheet).getByText("Remove - Plans")).toBeInTheDocument()
  })

  it("No data shows when CPL is null", async () => {
    use(report({ cards: [card({ current_cpl: null, previous_cpl: null, zone: "no_data", tag: "no_changes", lines: [] })] }))
    renderPage()
    expect((await cellsOf(/Harbour/)).filter((t) => t === "No data").length).toBeGreaterThan(2)
  })

  it("each client shows its own currency, and the change as a signed percent", async () => {
    use(report({
      cards: [
        card({ currency: "GBP", current_cpl: 10, previous_cpl: 8 }),
        card({ id: "c2", client_group_id: "g2", client_name: "Velvet Laser", currency: "EUR", current_cpl: 100, previous_cpl: 200 }),
      ],
    }))
    renderPage()
    const harbour = await cellsOf(/Harbour/)
    expect(harbour).toEqual(expect.arrayContaining(["£8.00", "£10.00", "+25%"]))
    expect(await cellsOf(/Velvet/)).toEqual(expect.arrayContaining(["€200.00", "€100.00", "−50%"]))
  })

  it("a client whose spend stopped shows Stopped beside its zone", async () => {
    use(FULL())
    renderPage()
    const row = await rowFor(/Coastline Med Spa/)
    expect(within(row).getByText("Stopped")).toBeInTheDocument()
    expect(within(row).getByText("Green")).toBeInTheDocument()
  })

  it("shows leads in the table and ads live in the panel; zero is a count, and an older card with neither shows a dash", async () => {
    const older = card({ id: "c2", client_group_id: "g2", client_name: "Older Card" })
    delete older.leads
    delete older.ads_live
    use(report({ cards: [card(), card({ id: "c3", client_group_id: "g3", client_name: "Zero Card", leads: 0, ads_live: 0, current_cpl: 1 }), older] }))
    renderPage()
    const leads = 5
    expect((await cellsOf(/Harbour/))[leads]).toBe("31")
    expect((await cellsOf(/Zero Card/))[leads]).toBe("0")
    expect((await cellsOf(/Older Card/))[leads]).toBe("–")
    expect(screen.getByRole("article", { name: "Harbour Body Co" })).toHaveTextContent("Ads live4")
    await openRow(/Zero Card/)
    expect(screen.getByRole("article", { name: "Zero Card" })).toHaveTextContent("Ads live0")
    await openRow(/Older Card/)
    expect(screen.getByRole("article", { name: "Older Card" })).toHaveTextContent("Ads live–")
  })

  it("spend with no leads reads No leads", async () => {
    use(report({ cards: [card({ current_cpl: null, previous_cpl: 9, zone: "red", leads: 0 })] }))
    renderPage()
    expect(await cellsOf(/Harbour/)).toContain("No leads")
  })

  it("Apply all waits, with a reason, until the run finishes; a single card can still be applied", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = res({ ok: true, outcome: "applied", reason: null, lines: [] })
    use(report({ run: run({ phase: "writing", clients: { g1: { state: "done" }, g2: { state: "needs_writing" } } }) }))
    renderPage()
    expect(await screen.findByRole("button", { name: "Apply 1 change" })).toBeDisabled()
    expect(screen.getByText(/Apply all opens when Birdy has finished this report/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() => expect(calls("/api/agents/ag1/cards/c1/apply", "POST")).toHaveLength(1))
    expect(calls("/api/agents/ag1/runs/r1/apply-all", "POST")).toHaveLength(0)
  })

  it("Apply all opens by itself once the run finishes", async () => {
    answers["POST /api/agents/ag1/runs/r1/apply-all"] = res({ ok: true, outcome: "applied", reason: null, applied: 1, blocked: 0, failed: 0, needs_file: 0, queued: 0 })
    const c = report().cards
    use(report({ run: run({ phase: "writing", clients: { g1: { state: "done" }, g2: { state: "needs_writing" } } }), cards: c }))
    renderPage()
    expect(await screen.findByRole("button", { name: "Apply 1 change" })).toBeDisabled()
    use(report({ cards: c }))
    await act(async () => { await mutateAll().catch(() => {}) })
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply 1 change" })).toBeEnabled())
    expect(screen.queryByText(/Apply all opens when Birdy has finished this report/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Apply 1 change" }))
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1/apply-all", "POST")).toHaveLength(1))
  })

  it("names the client with spend and no leads first, ahead of a red one with a figure", async () => {
    use(report({
      cards: [
        card({ client_name: "Steady Red Clinic", current_cpl: 12 }),
        card({ id: "c2", client_group_id: "g2", client_name: "No Leads Clinic", current_cpl: null, leads: 0 }),
      ],
    }))
    renderPage()
    expect(await screen.findByRole("heading", { name: /Look at No Leads Clinic first\./ })).toBeInTheDocument()
  })

  it("names the client with no leads first even when its currency is listed second", async () => {
    use(report({
      cards: [
        card({ client_name: "Pounds Clinic", currency: "GBP", current_cpl: 12 }),
        card({ id: "c2", client_group_id: "g2", client_name: "Euro Clinic", currency: "EUR", current_cpl: null, leads: 0 }),
      ],
    }))
    renderPage()
    expect(await screen.findByRole("heading", { name: /Look at Euro Clinic first\./ })).toBeInTheDocument()
  })

  it("among red clients with a figure, names the highest in the report's order", async () => {
    use(report({
      cards: [
        card({ client_name: "Lower Clinic", current_cpl: 12 }),
        card({ id: "c2", client_group_id: "g2", client_name: "Higher Clinic", current_cpl: 30 }),
        card({ id: "c3", client_group_id: "g3", client_name: "Green Clinic", zone: "green", tag: "green", current_cpl: 90, lines: [] }),
      ],
    }))
    renderPage()
    expect(await screen.findByRole("heading", { name: /Look at Higher Clinic first\./ })).toBeInTheDocument()
  })

  it("a card a newer one replaced isn't counted by Apply all", async () => {
    use(report({ cards: [card({ can_apply: false, has_newer: true, status: "partly_applied" }), card({ id: "c2", client_group_id: "g2", client_name: "Velvet Laser" })] }))
    renderPage()
    expect(await screen.findByRole("button", { name: "Apply 1 change" })).toBeInTheDocument()
  })

  it("Apply all's Still going goes away once those lines finish", async () => {
    answers["POST /api/agents/ag1/runs/r1/apply-all"] = () => {
      use(report({ cards: [card({ status: "partly_applied", lines: [line({ state: "applying" })] })] }))
      return res({ ok: true, outcome: "queued", reason: null, not_in_slack: 0, applied: 0, blocked: 0, failed: 0, needs_file: 0, queued: 1 })
    }
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Apply 1 change" }))
    expect(await screen.findByText(/Still going 1/)).toBeInTheDocument()
    use(report({ cards: [card({ status: "applied", can_apply: false, lines: [line({ state: "applied" })] })] }))
    await act(async () => { await mutateAll().catch(() => {}) })
    await waitFor(() => expect(screen.queryByText(/Still going/)).not.toBeInTheDocument())
  })

  it("Apply all answering queued with nothing counted yet says it is still working", async () => {
    answers["POST /api/agents/ag1/runs/r1/apply-all"] = () => {
      use(report({ run: run({ apply_all: { pending: true } }) }))
      return res({ ok: true, outcome: "queued", reason: null, not_in_slack: 0, applied: 0, blocked: 0, failed: 0, needs_file: 0, queued: 0 })
    }
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Apply 1 change" }))
    expect(await screen.findByText(/Birdy is still working through these/)).toBeInTheDocument()
  })

  it("Apply all counts only open Ask me lines, and applies the run", async () => {
    answers["POST /api/agents/ag1/runs/r1/apply-all"] = res({ ok: true, outcome: "applied", reason: null, not_in_slack: 0, applied: 3, blocked: 1, failed: 0, needs_file: 0, queued: 0 })
    use(report({
      cards: [
        card({ lines: [line(), line({ id: "l2", mode: "flag", state: "flagged" }), line({ id: "l3", state: "failed" }), line({ id: "l4", state: "applied" }), line({ id: "l5", state: "needs_file" })] }),
        card({ id: "c2", client_name: "Velvet Laser", lines: [line(), line({ id: "l2", mode: "auto" })] }),
        card({ id: "c3", client_name: "Old", status: "superseded", can_apply: false, lines: [line()] }),
        card({ id: "c4", client_name: "Done", status: "dismissed", can_apply: false, lines: [line()] }),
      ],
    }))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Apply 3 changes" }))
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1/apply-all", "POST")).toHaveLength(1))
    expect(await screen.findByText(/Applied 3\. Blocked 1\./)).toBeInTheDocument()
  })

  it("no Apply all when nothing is open", async () => {
    use(report({ cards: [card({ status: "applied", can_apply: false, lines: [line({ state: "applied" })] })] }))
    renderPage()
    await heading("Clients")
    expect(screen.queryByRole("button", { name: /^Apply \d/ })).not.toBeInTheDocument()
  })

  it("a refused Apply all says why", async () => {
    answers["POST /api/agents/ag1/runs/r1/apply-all"] = res({ detail: "Nope." }, 409)
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Apply 1 change" }))
    expect(await screen.findByText("Nope.")).toBeInTheDocument()
  })

  it("a mixed card shows a line's note when the action returns no reason", async () => {
    answers["POST /api/agents/ag1/cards/c1/apply"] = () => {
      use(report({ cards: [card({ status: "partly_applied", can_apply: false, lines: [line({ state: "applied" }), line({ id: "l2", state: "flagged", mode: "flag", note: "This change is now set to Flag, so Birdy didn't make it." })] })] }))
      return res({ ok: true, outcome: "partial", reason: null, lines: [] })
    }
    use(report({ cards: [card({ lines: [line(), line({ id: "l2", ad_name: "Second" })] })] }))
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Apply" }))
    expect(await screen.findByText(/now set to Flag/)).toBeInTheDocument()
  })

  const NO_ACCESS = "Birdy can't post to this Slack channel. For a private channel, invite the Birdy bot to it."
  it.each([
    [{ publish_error: "Slack timed out.", slack_pending: true }, ["This report didn't reach Slack", "Slack timed out.", "Birdy will try again."]],
    [{ publish_error: NO_ACCESS, slack_pending: false }, ["This report didn't reach Slack", NO_ACCESS]],
    [{ publish_error: "Slack isn't connected, so this didn't reach Slack. The report and its actions are in Birdy.", slack_pending: false }, ["Slack isn't connected"]],
    [{ slack_pending: true }, ["being sent to Slack"]],
    [{ slack_late: true }, ["Posted late"]],
  ])("shows Slack delivery state %o", async (fields, copies) => {
    use(report({ run: run(fields) }))
    renderPage()
    await heading("Clients")
    const notice = [...document.querySelectorAll("[data-slot=notice]")].find((n) => /Slack/.test(n.textContent))
    for (const copy of copies) expect(notice).toHaveTextContent(copy)
  })

  it("a Slack failure doesn't say it will try again when it won't", async () => {
    use(report({ run: run({ publish_error: NO_ACCESS, slack_pending: false }) }))
    renderPage()
    await heading("Clients")
    expect(screen.queryByText(/try again/)).not.toBeInTheDocument()
  })

  it("no warning when Slack simply isn't set up, which setup calls optional", async () => {
    agent = { ...AGENT(), settings: { batches: [] } }
    use(report({ run: run({ slack: { ts: null }, publish_error: "No Slack channel is chosen for this agent, so this didn't reach Slack. The report and its actions are in Birdy." }) }))
    renderPage()
    await heading("Clients")
    expect(screen.queryByText(/Slack/)).not.toBeInTheDocument()
  })

  it("no Slack notice when delivery went fine", async () => {
    renderPage()
    await heading("Clients")
    expect(screen.queryByText(/Slack/)).not.toBeInTheDocument()
  })

  it("the date picker loads past runs, older pages included", async () => {
    const past = run({ id: "r0", local_date: "2026-10-30", as_of: "2026-10-30T07:00:00", batch_id: "b" })
    const oldest = run({ id: "rz", local_date: "2026-09-01", as_of: "2026-09-01T07:00:00", batch_id: null, kind: "alert_only" })
    runsPages = {
      "": { runs: [run(), past], next_before: "2026-10-30T07:00:00" },
      "2026-10-30T07:00:00": { runs: [oldest], next_before: null },
    }
    reports.r0 = report({ run: past, cards: [card({ id: "c0", client_name: "Past Client" })] })
    const { rerender } = renderPage()
    const picker = await screen.findByRole("combobox", { name: "Report date" })
    await waitFor(() => expect(picker).toHaveTextContent("Tue 3 Nov"))
    await userEvent.click(picker)
    await userEvent.click(await screen.findByRole("option", { name: /Fri 30 Oct/ }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?run=r0")
    search = "run=r0"
    rerender(page())
    expect(await screen.findByRole("row", { name: /Past Client/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Older reports" }))
    await waitFor(() => expect(vi.mocked(apiRequest).mock.calls.some(([p]) => p.includes("before=2026-10-30T07%3A00%3A00"))).toBe(true))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Older reports" })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole("combobox", { name: "Report date" }))
    expect(await screen.findByRole("option", { name: /1 Sep.*Alerts only/ })).toBeInTheDocument()
  })

  it("reads ?run= from the Slack link and opens that report, even one past the first page", async () => {
    search = "run=r9"
    reports.r9 = report({ run: run({ id: "r9", local_date: "2026-06-02" }), cards: [card({ id: "c9", client_name: "From Slack" })] })
    renderPage()
    expect(await screen.findByRole("row", { name: /From Slack/ })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Report date" })).toHaveTextContent("2 Jun")
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
    // The picker doesn't claim the latest report is the one open, so picking it is a real change.
    expect(screen.getByRole("combobox", { name: "Report date" })).toHaveTextContent("Pick a date")
  })

  it("encodes the run id from the address", async () => {
    search = "run=a%2Fb"
    answers["GET /api/agents/ag1/runs/a%2Fb"] = res({ detail: "Run not found" }, 404)
    renderPage()
    expect(await screen.findByText("Run not found")).toBeInTheDocument()
    expect(calls("/api/agents/ag1/runs/a%2Fb", "GET").length).toBeGreaterThan(0)
  })

  it("a reply that isn't a report is not found: ?run=latest doesn't read as a report with no cards", async () => {
    search = "run=latest"
    renderPage()
    expect(await screen.findByText("Report not found")).toBeInTheDocument()
    expect(screen.queryByText(/No client has a card/)).not.toBeInTheDocument()
  })

  it("?run= naming a preview is read only and labelled a preview", async () => {
    search = "run=rp"
    reports.rp = report({ run: run({ id: "rp", kind: "preview", batch_id: null }), cards: [card({ id: "cp", preview: true, can_apply: false })] })
    renderPage()
    await screen.findByRole("article", { name: "Harbour Body Co" })
    for (const name of ["Edit", "Dismiss", "Apply"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Report date" })).toHaveTextContent("Preview")
  })

  it("when past reports can't be read the page says so", async () => {
    answers["GET /api/agents/ag1/runs"] = res({ detail: "boom" }, 500)
    renderPage()
    expect(await screen.findByText(/Couldn't load past reports/)).toBeInTheDocument()
  })

  it("a clean alert-only day shows the one-line result and nothing else", async () => {
    use(report({
      run: run({ kind: "alert_only", batch_id: null, local_date: "2026-11-04", clients: { g1: { state: "alerts_only" }, g2: { state: "alerts_only" } }, alerts: [{ severity: "info", code: "spend_data_late", title: "Spend data is behind", detail: "x" }] }),
      cards: [],
    }))
    renderPage()
    expect(await screen.findByRole("heading", { name: "All clear for Wed 4 Nov: 2 clients checked, nothing needs you." })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Alerts" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Cost per lead" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Clients" })).not.toBeInTheDocument()
  })

  it("an alert-only day with an open alert isn't all clear", async () => {
    use(report({
      run: run({ kind: "alert_only", batch_id: null, clients: { g1: { state: "alerts_only" } }, alerts: [{ client_group_id: "g1", severity: "warning", code: "spend_drop", title: "Spend dropped sharply", detail: "x" }] }),
      cards: [],
    }))
    renderPage()
    expect(await screen.findByText(/Spend dropped sharply/)).toBeInTheDocument()
    expect(screen.queryByText(/All clear/)).not.toBeInTheDocument()
  })

  it("a clean day still shows lessons waiting on a person", async () => {
    use(report({
      run: run({ kind: "alert_only", batch_id: null, clients: { g1: { state: "alerts_only" } } }),
      cards: [],
      learned: [{ id: "m1", text: "New lesson.", source: "edit", status: "active" }],
    }))
    renderPage()
    expect(await screen.findByText(/All clear/)).toBeInTheDocument()
    expect(screen.getByText(/New lesson\./)).toBeInTheDocument()
  })

  it("the mascot renders only through its framed component", async () => {
    use(FULL())
    renderPage()
    await heading("Clients")
    const birds = screen.getAllByTestId("birdy")
    expect(birds.length).toBeGreaterThan(0)
    for (const b of birds) expect(b.parentElement.className).toMatch(/rounded-full/)
  })

  it("redirects to setup when there is no stock agent", async () => {
    agent = null
    renderPage()
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hub/agents/media-buying/setup"))
  })

  it("doesn't redirect a draft agent, and points it back to setup", async () => {
    agent = { ...AGENT(), status: "draft" }
    latest = null
    renderPage()
    expect(await screen.findByRole("link", { name: /Finish setup/ })).toHaveAttribute("href", "/hub/agents/media-buying/setup")
    expect(replace).not.toHaveBeenCalled()
  })

  it("an active agent with no run yet says the first report is coming", async () => {
    latest = null
    renderPage()
    expect(await screen.findByText(/No report yet/)).toBeInTheDocument()
  })

  it("doesn't redirect on a 404 from the agent list: a misrouted API isn't an agency with no agent", async () => {
    answers["GET /api/agents"] = res({ detail: "Not Found" }, 404)
    renderPage()
    expect(await screen.findByText(/Couldn't load your agent/)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("Retry after that 404 trusts a list that really is empty", async () => {
    answers["GET /api/agents"] = res({ detail: "Not Found" }, 404)
    renderPage()
    await screen.findByText(/Couldn't load your agent/)
    answers["GET /api/agents"] = res([])
    await userEvent.click(screen.getByRole("button", { name: /Try again|Retry/ }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hub/agents/media-buying/setup"))
  })

  it("doesn't redirect when the agent list fails to load", async () => {
    answers["GET /api/agents"] = res({ detail: "boom" }, 500)
    renderPage()
    expect(await screen.findByText(/Couldn't load your agent/)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("a failed background refetch doesn't cover good data with an error", async () => {
    renderPage()
    await heading("Clients")
    answers["GET /api/agents/ag1/runs/latest"] = res({ detail: "boom" }, 500)
    answers["GET /api/agents/ag1/runs/r1"] = res({ detail: "boom" }, 500)
    answers["GET /api/agents"] = res({ detail: "boom" }, 500)
    await act(async () => { await mutateAll().catch(() => {}) })
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1", "GET").length).toBeGreaterThan(1))
    expect(screen.getByRole("heading", { name: "Clients" })).toBeInTheDocument()
    expect(screen.queryByText("boom")).not.toBeInTheDocument()
  })

  it("a first load that fails offers a retry", async () => {
    answers["GET /api/agents/ag1/runs/latest"] = res({ detail: "boom" }, 500)
    renderPage()
    expect(await screen.findByRole("button", { name: /Try again/ })).toBeInTheDocument()
  })
})

describe("Morning report: follow-ups, lessons, suggestions, weekly", () => {
  it("follow-ups say which worked, which didn't and which to check by hand", async () => {
    use(FULL())
    renderPage()
    const frame = (await heading("Follow-ups from last round")).closest("section")
    expect(within(frame).getByText("Harbour Body Co")).toBeInTheDocument()
    expect(within(frame).getByLabelText("Done")).toBeInTheDocument()
    expect(within(frame).getByLabelText("Not done")).toBeInTheDocument()
    expect(within(frame).getByLabelText("Check by hand")).toBeInTheDocument()
    expect(within(frame).getByText("Static Offer: still live")).toBeInTheDocument()
  })

  it("the report scoreboard groups by ad, counts as the server does, and heads with what keeps working", async () => {
    use(FULL())
    renderPage()
    const frame = (await heading(/BS - Before After keeps working wherever we move it/)).closest("section")
    expect(within(frame).getByText("worked 3 of 3")).toBeInTheDocument()
    expect(within(frame).getByText("worked 0 of 1")).toBeInTheDocument()
  })

  it("a cleared or unscored result isn't a move", async () => {
    const r = FULL()
    r.scoreboard.rows = [
      { id: "o1", creative_key: "pl", ad_name: "Plans Concept", result: "won" },
      { id: "o2", creative_key: "pl", ad_name: "Plans Concept", result: "cleared" },
      { id: "o3", creative_key: "pl", ad_name: "Plans Concept", result: "unscored" },
      { id: "o4", creative_key: "pl", ad_name: "Plans Concept", result: null },
    ]
    use(r)
    renderPage()
    const frame = (await heading("Scoreboard")).closest("section")
    expect(within(frame).getByText("worked 1 of 2")).toBeInTheDocument()
  })

  it("Make it a rule: Yes accepts and No rejects", async () => {
    answers["POST /api/agents/ag1/proposals/p1/accept"] = res({ proposal: {} })
    answers["POST /api/agents/ag1/proposals/p1/reject"] = res({ proposal: {} })
    use(FULL())
    renderPage()
    expect(await screen.findByText(/Make it a rule\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Yes" }))
    await waitFor(() => expect(calls("/api/agents/ag1/proposals/p1/accept", "POST")).toHaveLength(1))
    await userEvent.click(screen.getByRole("button", { name: "No" }))
    await waitFor(() => expect(calls("/api/agents/ag1/proposals/p1/reject", "POST")).toHaveLength(1))
  })

  it("lessons can be kept or overruled", async () => {
    answers["POST /api/agents/ag1/lessons/m1/keep"] = res({})
    answers["POST /api/agents/ag1/lessons/m1/overrule"] = res({})
    use(FULL())
    renderPage()
    const frame = (await heading("What I learned since last time")).closest("section")
    expect(within(frame).getByText(/Wait 3 days/)).toBeInTheDocument()
    expect(within(frame).getByText(/From a Slack mention.*Velvet Laser.*30 Oct/)).toBeInTheDocument()
    await userEvent.click(within(frame).getByRole("button", { name: "Keep" }))
    await waitFor(() => expect(calls("/api/agents/ag1/lessons/m1/keep", "POST")).toHaveLength(1))
    await userEvent.click(within(frame).getByRole("button", { name: "Overrule" }))
    await waitFor(() => expect(calls("/api/agents/ag1/lessons/m1/overrule", "POST")).toHaveLength(1))
  })

  it("an overruled lesson says so and can only be kept again", async () => {
    use(report({ learned: [{ id: "m1", text: "Old.", source: "edit", status: "overruled" }] }))
    renderPage()
    expect(await screen.findByText("Overruled")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Overrule" })).not.toBeInTheDocument()
  })

  it("the weekly message shows and posts to Slack", async () => {
    answers["POST /api/agents/ag1/runs/r1/weekly/post"] = res({ outcome: "posted", ts: "1" })
    use(FULL())
    renderPage()
    const frame = (await heading("Weekly message")).closest("section")
    expect(within(frame).getByText("Harbour still red")).toBeInTheDocument()
    expect(within(frame).getByText("26 Oct to 1 Nov")).toBeInTheDocument()
    await userEvent.click(within(frame).getByRole("button", { name: "Post to Slack" }))
    await waitFor(() => expect(calls("/api/agents/ag1/runs/r1/weekly/post", "POST")).toHaveLength(1))
  })

  it("the weekly message: posted hides the button, a post error shows", async () => {
    const r = FULL()
    r.weekly = { ...r.weekly, posted: true }
    use(r)
    const { unmount } = renderPage()
    const frame = (await heading("Weekly message")).closest("section")
    expect(within(frame).queryByRole("button", { name: "Post to Slack" })).not.toBeInTheDocument()
    expect(within(frame).getByText("Posted to Slack")).toBeInTheDocument()
    unmount()
    const s = FULL()
    s.weekly = { ...s.weekly, post_error: "channel_not_found" }
    use(s)
    renderPage()
    expect(await screen.findByText(/channel_not_found/)).toBeInTheDocument()
  })

  it("a refused weekly post says why, once, though the refusal is also stored", async () => {
    answers["POST /api/agents/ag1/runs/r1/weekly/post"] = () => {
      const s = FULL()
      s.weekly = { ...s.weekly, post_error: "Slack refused it." }
      use(s)
      return res({ detail: "Slack refused it." }, 502)
    }
    use(FULL())
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Post to Slack" }))
    await screen.findByText(/Slack refused it\./)
    expect(screen.getAllByText(/Slack refused it\./)).toHaveLength(1)
  })

  it("a weekly that couldn't be built says so, and whether it will try again", async () => {
    use(report({ run: run({ weekly_pending: true, weekly_error: "boom" }), weekly: null }))
    const { unmount } = renderPage()
    expect(await screen.findByRole("heading", { name: "Weekly message" })).toBeInTheDocument()
    expect(screen.getByText(/couldn't build this week's message.*tries again by itself/)).toBeInTheDocument()
    unmount()
    use(report({ run: run({ weekly_pending: false, weekly_error: "boom" }), weekly: null }))
    renderPage()
    await screen.findByText(/couldn't build this week's message/)
    expect(screen.queryByText(/tries again/)).not.toBeInTheDocument()
  })

  it("no weekly section on a day none is due", async () => {
    renderPage()
    await heading("Clients")
    expect(screen.queryByRole("heading", { name: "Weekly message" })).not.toBeInTheDocument()
  })
})

describe("Morning report: tabs", () => {
  it("has Report, Scoreboard, Lessons and Settings, and a tab keeps the address", async () => {
    renderPage()
    for (const name of ["Report", "Scoreboard", "Lessons", "Settings"]) expect(await screen.findByRole("tab", { name })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("tab", { name: "Scoreboard" }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?tab=scoreboard")
  })

  it("a tab keeps the report it was opened from", async () => {
    search = "run=r1"
    renderPage()
    await userEvent.click(await screen.findByRole("tab", { name: "Lessons" }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?run=r1&tab=lessons")
  })

  it("the Scoreboard tab lists rows in their own currency and clears a wrong result", async () => {
    search = "tab=scoreboard"
    outcomes = {
      won: 1, lost: 0, moves: 1,
      rows: [
        { id: "o1", client_group_id: "g1", ad_name: "Winner", result: "won", currency: "EUR", spend: 40, leads: 8, cpl: 5 },
        { id: "o2", client_group_id: "g2", ad_name: "Gone", result: "cleared", currency: "GBP", spend: 1, leads: 0, cpl: null },
        { id: "o3", client_group_id: "g2", ad_name: "Waiting", currency: "GBP" },
      ],
    }
    answers["POST /api/agents/ag1/outcomes/o1/clear"] = res({ id: "o1", result: "cleared" })
    renderPage()
    const row = await screen.findByRole("row", { name: /Winner/ })
    expect(within(row).getByText("€5.00")).toBeInTheDocument()
    expect(within(row).getByText("Harbour Body Co")).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /Gone/ })).queryByRole("button")).not.toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /Waiting/ })).queryByRole("button")).not.toBeInTheDocument()
    await userEvent.click(within(row).getByRole("button", { name: /Clear/ }))
    await userEvent.click(await screen.findByRole("button", { name: "Clear result" }))
    await waitFor(() => expect(calls("/api/agents/ag1/outcomes/o1/clear", "POST")).toHaveLength(1))
  })

  it("a Clear in progress stays busy when the page re-renders, so it can't be pressed twice", async () => {
    outcomes = {
      won: 1, lost: 0, moves: 0,
      rows: [{ id: "o1", ad_name: "Kept Ad", client_group_id: "g1", result: "won", spend: 10, leads: 2, cpl: 5, currency: "USD" }],
    }
    const pending = new Promise(() => {})
    const tab = (actions) => (
      <SWRConfig value={{ provider: () => swrCache, fetcher, dedupingInterval: 0 }}>
        <ConfirmHost />
        <ScoreboardTab agentId="ag1" actions={actions} nameOf={() => "A client"} />
      </SWRConfig>
    )
    const swrCache = new Map()
    const { rerender } = render(tab({ clearOutcome: () => pending }))
    const row = await screen.findByRole("row", { name: /Kept Ad/ })
    await userEvent.click(within(row).getByRole("button", { name: /Clear/ }))
    await userEvent.click(await screen.findByRole("button", { name: "Clear result" }))
    await waitFor(() => expect(within(screen.getByRole("row", { name: /Kept Ad/ })).getByRole("button", { name: /Clear/ })).toBeDisabled())
    rerender(tab({ clearOutcome: () => pending }))
    expect(within(screen.getByRole("row", { name: /Kept Ad/ })).getByRole("button", { name: /Clear/ })).toBeDisabled()
  })

  it("the Scoreboard tab starts empty", async () => {
    search = "tab=scoreboard"
    renderPage()
    expect(await screen.findByText(/No results yet/)).toBeInTheDocument()
  })

  it("the report's scoreboard links to every result", async () => {
    use(FULL())
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: /See every result/ }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?tab=scoreboard")
  })
})

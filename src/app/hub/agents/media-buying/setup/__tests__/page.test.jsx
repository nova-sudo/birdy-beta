import { describe, it, expect, vi, beforeEach } from "vitest"
import { StrictMode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
const push = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))

// The training chat is exercised on its own; here it only has to mount.
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => <div data-testid="training-chat" data-page={props.page} />,
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import SetupPage from "../page"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const AGENT = {
  id: "ag1",
  type: "media_buying",
  status: "draft",
  scope: { client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" } },
  permissions: { ads: true, adsets: true, campaigns: false, budgets: false },
  guardrails: { max_pauses_per_client_day: 3, protect_last_live_ad: true, protected_tags: ["Evergreen"] },
  client_caps: {},
}

const GROUPS = {
  client_groups: [
    { id: "g1", name: "Tylaesthetics", meta_ad_account_id: "act_1", facebook: { currency: "EUR" }, targets: { cpl: 20 } },
    { id: "g2", name: "No Meta Ltd", meta_ad_account_id: null },
  ],
}

const RULES = [
  { id: "r1", kind: "pause_over_target", enabled: true, mode: "ask", params: { patience_spend: 60, patience_days: 3, cpl_multiple: 1.5, zero_lead_spend: 80 } },
  { id: "r2", kind: "flag_no_spend", enabled: true, mode: "flag", params: { hours: 24 } },
]

let agents
let activateStatus
let confidence
const conf = (score) => ({
  score,
  coverage: 40,
  practice: score - 40,
  parts: { targets: true, pause: true, revive: true, flags: true, practice_agreed: 5, practice_answered: 6 },
  ready: score >= 80,
  missing: score >= 80 ? [] : ["Get the score to 80"],
})
const CASE = {
  case_id: "c1",
  rule_kind: "pause_over_target",
  client_name: "Tylaesthetics",
  title: "Pause “Botox – Static 4”",
  facts: [{ label: "CPL", value: "€71 vs €22 target" }],
  options: ["Pause", "Leave it", "Flag"],
  birdy_answer: "Pause",
  why: "Over 1.5× target.",
}
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/agents" && method === "GET") return Promise.resolve(res(agents))
  if (path === "/api/agents" && method === "POST") {
    agents = [AGENT]
    return Promise.resolve(res(AGENT))
  }
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(AGENT))
  if (path === "/api/agents/ag1" && method === "PATCH") return Promise.resolve(res({ ...AGENT, ...JSON.parse(init.body) }))
  if (path === "/api/agents/ag1/rules") return Promise.resolve(res(RULES))
  if (path === "/api/agents/ag1/dry-run") return Promise.resolve(res({ job_id: "j1" }))
  if (path === "/api/agents/ag1/jobs/j1")
    return Promise.resolve(
      res({ status: "done", result: { actions: 0, by_rule: {}, spend_saved: 0, leads_at_risk: 0, examples: [] } })
    )
  if (path === "/api/agents/ag1/confidence") return Promise.resolve(res(confidence))
  if (path.startsWith("/api/agents/ag1/practice?")) return Promise.resolve(res([CASE]))
  if (path === "/api/agents/ag1/practice/c1")
    return Promise.resolve(res({ agreed: true, birdy_answer: "Pause", why: CASE.why }))
  if (path === "/api/agents/ag1/activate") return Promise.resolve(res({ detail: "Not Found" }, activateStatus))
  if (path.startsWith("/api/client-groups")) return Promise.resolve(res(GROUPS))
  return Promise.resolve(res({}, 404))
}

const renderPage = () =>
  render(
    <StrictMode>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <SetupPage />
      </SWRConfig>
    </StrictMode>
  )

beforeEach(() => {
  agents = []
  activateStatus = 404
  confidence = conf(79)
  search = ""
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

const posts = (path) =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && init?.method === "POST").length

describe("Media Buying Agent setup", () => {
  it("creates the agent once when there is none, then shows step 1", async () => {
    renderPage()
    expect(await screen.findByText("Tylaesthetics")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Set up your Media Buying Agent" })).toBeInTheDocument()
    expect(posts("/api/agents")).toBe(1)
  })

  it("Next saves scope and safety in one PATCH and moves to step 2", async () => {
    agents = [AGENT]
    renderPage()
    await screen.findByText("Tylaesthetics")
    await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=2"))
    const patches = vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === "/api/agents/ag1" && init?.method === "PATCH")
    expect(patches).toHaveLength(1)
    const body = JSON.parse(patches[0][1].body)
    expect(body.scope).toEqual({ client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" } })
    expect(body.guardrails.max_pauses_per_client_day).toBe(3)
    expect(body.permissions.ads).toBe(true)
  })

  it("step 3 shows the playbook in the clients' currency and handles a missing activate route", async () => {
    agents = [AGENT]
    search = "step=3"
    renderPage()
    expect(await screen.findByText("Pause ads over target")).toBeInTheDocument()
    expect(screen.getAllByText("€").length).toBeGreaterThan(0)
    expect(screen.queryByText("£")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
    expect(await screen.findByText(/Turning the agent on isn't available yet/)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("a 409 on create whose refetch still finds no agent shows an error with Retry", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
      if (path === "/api/agents" && init.method === "POST") return Promise.resolve(res({ detail: "exists" }, 409))
      if (path === "/api/agents") return Promise.resolve(res([]))
      return mockApi(path, init)
    })
    renderPage()
    expect(await screen.findByText("Your agent exists but couldn't be loaded.")).toBeInTheDocument()
    // Retry tries again, and this time the list has it.
    agents = [AGENT]
    vi.mocked(apiRequest).mockImplementation(mockApi)
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }))
    expect(await screen.findByText("Tylaesthetics")).toBeInTheDocument()
  })

  it("a failing agent list is an error, not a reason to create", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/agents" ? Promise.resolve(res({ detail: "boom" }, 500)) : mockApi(path, init)
    )
    renderPage()
    expect(await screen.findByText("Couldn't load your agent")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument()
    expect(posts("/api/agents")).toBe(0)
  })

  it("lists what is missing on a 409", async () => {
    agents = [AGENT]
    search = "step=3"
    activateStatus = 409
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/ag1/activate"
        ? Promise.resolve(res({ detail: { missing: ["targets", "practice"] } }, 409))
        : mockApi(path, init)
    )
    renderPage()
    await screen.findByText("Pause ads over target")
    await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
    expect(await screen.findByText(/Still needed: targets, practice/)).toBeInTheDocument()
  })

  it("Next disabled until ready", async () => {
    agents = [AGENT]
    search = "step=2"
    renderPage()
    expect(await screen.findByText("79%")).toBeInTheDocument()
    expect(screen.getByText("1 points to go. Answer practice cases or keep chatting.")).toBeInTheDocument()
    const next = screen.getByRole("button", { name: /Next: check the dry run/ })
    expect(next).toBeDisabled()
    expect(screen.getByTestId("training-chat")).toHaveAttribute("data-page", "agent_training")
    expect(await screen.findByText("Pause ads over target")).toBeInTheDocument()

    // Answering a practice case lifts the score to 80, and the meter refreshes.
    confidence = conf(80)
    await userEvent.click(await screen.findByRole("button", { name: "Pause" }))
    expect(await screen.findByText("80%")).toBeInTheDocument()
    expect(screen.getByText("Ready. More practice keeps raising it.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: /Next: check the dry run/ })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: /Next: check the dry run/ }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=3")
  })

  it("lists what is missing on a 409 with a top-level missing list", async () => {
    agents = [AGENT]
    search = "step=3"
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/ag1/activate"
        ? Promise.resolve(res({ detail: "The agent isn't ready to switch on yet", missing: ["Set a CPL target for X"] }, 409))
        : mockApi(path, init)
    )
    renderPage()
    await screen.findByText("Pause ads over target")
    await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
    expect(await screen.findByText(/Still needed: Set a CPL target for X/)).toBeInTheDocument()
  })
})

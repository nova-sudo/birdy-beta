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
})

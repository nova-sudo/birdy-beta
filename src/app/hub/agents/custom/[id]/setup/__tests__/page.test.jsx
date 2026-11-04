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
import { useAgent, useAgents } from "@/lib/agents-api"

// Next hands the page a promise; one already marked fulfilled lets `use` read it without suspending.
const PARAMS = Object.assign(Promise.resolve({ id: "ag1" }), { status: "fulfilled", value: { id: "ag1" } })

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const AGENT = {
  id: "ag1",
  type: "custom",
  name: "Lead rules",
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
        <SetupPage params={PARAMS} />
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

describe("Custom agent setup", () => {
  it("reads the agent by its id, titles step 1 with its name and never creates one", async () => {
    renderPage()
    expect(await screen.findByText("Tylaesthetics")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Set up Lead rules" })).toBeInTheDocument()
    const calls = vi.mocked(apiRequest).mock.calls
    expect(calls.some(([p]) => p === "/api/agents/ag1")).toBe(true)
    expect(posts("/api/agents")).toBe(0)
  })

  it("Next saves scope and safety in one PATCH and moves to step 2", async () => {
    agents = [AGENT]
    renderPage()
    await screen.findByText("Tylaesthetics")
    await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=2"))
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

  it("a failing agent read is an error with Retry", async () => {
    let fail = true
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/agents/ag1" && fail ? Promise.resolve(res({ detail: "boom" }, 500)) : mockApi(path, init)
    )
    renderPage()
    expect(await screen.findByText("Couldn't load your agent")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }))
    expect(await screen.findByText("Tylaesthetics")).toBeInTheDocument()
  })

  describe("turning on with a client another agent holds", () => {
    const CONFLICT = { detail: "Client is claimed", conflicts: [{ client_group_id: "g1", holder_id: "ag7", holder_name: "Old rules" }] }
    const activations = () =>
      vi.mocked(apiRequest).mock.calls
        .filter(([p]) => p === "/api/agents/ag1/activate")
        .map(([, init]) => (init.body ? JSON.parse(init.body) : {}))

    const refuseFirstActivation = () => {
      let refused = false
      vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
        if (path === "/api/agents/ag1/activate") {
          if (!refused) {
            refused = true
            return Promise.resolve(res(CONFLICT, 409))
          }
          return Promise.resolve(res({ ...AGENT, status: "active" }))
        }
        return mockApi(path, init)
      })
    }

    const turnOn = async () => {
      agents = [AGENT]
      search = "step=3"
      renderPage()
      await screen.findByText("Pause ads over target")
      await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
      expect(await screen.findByText(/is with Old rules/)).toBeInTheDocument()
    }

    it("Move it here resends the activation with move_claims", async () => {
      refuseFirstActivation()
      await turnOn()
      expect(push).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole("button", { name: "Move it here" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1"))
      expect(activations()[1]).toEqual({ move_claims: true })
    })

    it("Only flag resends the activation with that client in only_flag", async () => {
      refuseFirstActivation()
      await turnOn()
      await userEvent.click(screen.getByRole("button", { name: "Only flag" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1"))
      expect(activations()[1]).toEqual({ only_flag: ["g1"] })
    })
  })

  it("Only flag keeps the clients already flag-only, so two conflicts resolve one after the other", async () => {
    const holder = (gid) => ({ client_group_id: gid, holder_id: "ag7", holder_name: "Old rules" })
    const two = { ...AGENT, scope: { ...AGENT.scope, client_group_ids: ["g1", "g2"] } }
    agents = [two]
    let saves = 0
    vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
      if (path === "/api/agents/ag1" && init.method === "GET") return Promise.resolve(res(two))
      if (path === "/api/agents/ag1" && init.method === "PATCH") {
        saves += 1
        if (saves === 1) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g1"), holder("g2")] }, 409))
        if (saves === 2) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g2")] }, 409))
        return Promise.resolve(res(two))
      }
      return mockApi(path, init)
    })
    renderPage()
    await screen.findByText("Tylaesthetics")
    await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
    const flags = await screen.findAllByRole("button", { name: "Only flag" })
    await userEvent.click(flags[0])
    await userEvent.click(await screen.findByRole("button", { name: "Only flag" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=2"))
    const bodies = vi.mocked(apiRequest).mock.calls
      .filter(([p, init]) => p === "/api/agents/ag1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse(init.body))
    expect(bodies[1].only_flag).toEqual(["g1"])
    expect(bodies[2].only_flag).toEqual(["g1", "g2"])
  })

  describe("Only flag on one client, then Move all", () => {
    const holder = (gid) => ({ client_group_id: gid, holder_id: "ag7", holder_name: "Old rules" })
    const two = { ...AGENT, scope: { ...AGENT.scope, client_group_ids: ["g1", "g2"] } }
    const bodies = (path, method) =>
      vi.mocked(apiRequest).mock.calls
        .filter(([p, init]) => p === path && init?.method === method)
        .map(([, init]) => (init.body ? JSON.parse(init.body) : undefined))

    it("the scope save keeps the flagged client out of the move", async () => {
      agents = [two]
      let saves = 0
      vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
        if (path === "/api/agents/ag1" && init.method === "GET") return Promise.resolve(res(two))
        if (path === "/api/agents/ag1" && init.method === "PATCH") {
          saves += 1
          if (saves === 1) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g1"), holder("g2"), holder("g3")] }, 409))
          if (saves === 2) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g2"), holder("g3")] }, 409))
          return Promise.resolve(res(two))
        }
        return mockApi(path, init)
      })
      renderPage()
      await screen.findByText("Tylaesthetics")
      await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
      await userEvent.click((await screen.findAllByRole("button", { name: "Only flag" }))[0])
      await userEvent.click(await screen.findByRole("button", { name: "Move all here" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=2"))
      const third = bodies("/api/agents/ag1", "PATCH")[2]
      expect(third.move_claims).toBe(true)
      expect(third.only_flag).toEqual(["g1"])
      expect(third.scope.client_group_ids).toContain("g1")
    })

    it("the activation keeps the flagged client out of the move", async () => {
      agents = [two]
      search = "step=3"
      let tries = 0
      vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
        if (path === "/api/agents/ag1" && init.method === "GET") return Promise.resolve(res(two))
        if (path === "/api/agents/ag1/activate") {
          tries += 1
          if (tries === 1) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g1"), holder("g2"), holder("g3")] }, 409))
          if (tries === 2) return Promise.resolve(res({ detail: "claimed", conflicts: [holder("g2"), holder("g3")] }, 409))
          return Promise.resolve(res({ ...two, status: "active" }))
        }
        return mockApi(path, init)
      })
      renderPage()
      await screen.findByText("Pause ads over target")
      await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
      await userEvent.click((await screen.findAllByRole("button", { name: "Only flag" }))[0])
      await userEvent.click(await screen.findByRole("button", { name: "Move all here" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1"))
      expect(bodies("/api/agents/ag1/activate", "POST")[2]).toEqual({ move_claims: true, only_flag: ["g1"] })
    })
  })

  describe("a client another agent holds", () => {
    const CONFLICT = { detail: "Client is claimed", conflicts: [{ client_group_id: "g1", holder_id: "ag7", holder_name: "Old rules" }] }
    const saves = () =>
      vi.mocked(apiRequest).mock.calls
        .filter(([p, init]) => p === "/api/agents/ag1" && init?.method === "PATCH")
        .map(([, init]) => JSON.parse(init.body))

    // The first save is refused; the resend is accepted.
    const refuseFirstSave = () => {
      let refused = false
      vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
        if (path === "/api/agents/ag1" && init.method === "PATCH" && !refused) {
          refused = true
          return Promise.resolve(res(CONFLICT, 409))
        }
        return mockApi(path, init)
      })
    }

    it("Move it here resends the save with move_claims", async () => {
      refuseFirstSave()
      renderPage()
      await screen.findByText("Tylaesthetics")
      await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
      expect(await screen.findByText(/is with Old rules/)).toBeInTheDocument()
      expect(push).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole("button", { name: "Move it here" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=2"))
      const [first, second] = saves()
      expect(first.move_claims).toBeUndefined()
      expect(second.move_claims).toBe(true)
      expect(second.scope.client_group_ids).toEqual(["g1"])
    })

    it("Only flag resends with that client in only_flag, together with the scope", async () => {
      refuseFirstSave()
      renderPage()
      await screen.findByText("Tylaesthetics")
      await userEvent.click(screen.getByRole("button", { name: /Next: teach it your strategy/ }))
      await userEvent.click(await screen.findByRole("button", { name: "Only flag" }))
      await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=2"))
      const second = saves()[1]
      expect(second.only_flag).toEqual(["g1"])
      expect(second.scope.client_group_ids).toEqual(["g1"])
      expect(second.move_claims).toBeUndefined()
    })
  })

  it("the agent page's caches read active right after activation, before any refetch", async () => {
    agents = [AGENT]
    search = "step=3"
    let seen = null
    function Probe() {
      const { agent } = useAgent("ag1")
      const { agents: list } = useAgents()
      return <div data-testid="probe" data-agent={agent?.status} data-list={list[0]?.status} />
    }
    push.mockImplementation((url) => {
      if (url === "/hub/agents/custom/ag1") {
        const el = screen.getByTestId("probe")
        seen = [el.dataset.agent, el.dataset.list]
      }
    })
    // The server keeps answering "draft" on reads: only the activation response says active.
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/ag1/activate"
        ? Promise.resolve(res({ ...AGENT, status: "active" }))
        : mockApi(path, init)
    )
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <Probe />
        <SetupPage params={PARAMS} />
      </SWRConfig>
    )
    await screen.findByText("Pause ads over target")
    await userEvent.click(screen.getByRole("button", { name: /Turn on agent/ }))
    await waitFor(() => expect(seen).not.toBeNull())
    expect(seen).toEqual(["active", "active"])
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
    expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1/setup?step=3")
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

  it("score at 80 but a missing target: badge, gate and Next all say not ready", async () => {
    agents = [AGENT]
    search = "step=2"
    confidence = { ...conf(82), ready: false, missing: ["Set a CPL target for Tylaesthetics"] }
    renderPage()
    expect(await screen.findByText("82%")).toBeInTheDocument()
    expect(screen.getByText("Keep training")).toBeInTheDocument()
    expect(screen.queryByText("Ready to switch on")).not.toBeInTheDocument()
    expect(screen.getByText("Still needed: Set a CPL target for Tylaesthetics.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Next: check the dry run/ })).toBeDisabled()
  })

  it("a failed More cases keeps the answered cases on screen", async () => {
    agents = [AGENT]
    search = "step=2"
    let practiceCalls = 0
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path.startsWith("/api/agents/ag1/practice?")) {
        practiceCalls += 1
        return Promise.resolve(practiceCalls === 1 ? res([CASE]) : res({ detail: "boom" }, 500))
      }
      return mockApi(path, init)
    })
    renderPage()
    await userEvent.click(await screen.findByRole("button", { name: "Pause" }))
    expect(await screen.findByText(/Birdy agrees: Pause/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /More cases/ }))
    expect(await screen.findByText("Couldn't load more cases.")).toBeInTheDocument()
    expect(screen.getByText(/Birdy agrees: Pause/)).toBeInTheDocument()
    expect(screen.getByText(CASE.why)).toBeInTheDocument()
  })
})

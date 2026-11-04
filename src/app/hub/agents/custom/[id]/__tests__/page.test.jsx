import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock("@/components/chat/ChatConversation", () => ({
  default: () => <div data-testid="training-chat" />,
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import AgentPage from "../page"

// Next hands the page a promise; one already marked fulfilled lets `use` read it without suspending.
const PARAMS = Object.assign(Promise.resolve({ id: "ag1" }), { status: "fulfilled", value: { id: "ag1" } })

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

let agent
const WORK = {
  open: [
    {
      id: "s1",
      status: "open",
      agent_id: "ag1",
      rule_kind: "pause_over_target",
      rule_mode: "ask",
      has_action: true,
      client: "Tylaesthetics",
      title: "Pause “Summer BBL – Video 3”",
      stats: [],
      blocked_reason: null,
    },
  ],
  auto_applied: [],
}

beforeEach(() => {
  search = ""
  replace.mockReset()
  agent = {
    id: "ag1",
    type: "custom",
    name: "Lead rules",
    status: "active",
    scope: { client_group_ids: ["g1", "g2"], schedule: { time: "07:00", tz: "Europe/London" } },
  }
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path) => {
    if (path === "/api/agents/ag1") return Promise.resolve(res(agent))
    if (path === "/api/agents/ag1/work") return Promise.resolve(res(WORK))
    if (path === "/api/agents/ag1/rules") return Promise.resolve(res([]))
    return Promise.resolve(res({}, 404))
  })
})

const row = (id, acting, holder_name = null) => ({ client_group_id: id, name: `Client ${id}`, acting, holder_name })

/** The claims route answers `claims`; a save resolves to `onSave`, then the route answers `after`. */
function withClaims(claims, { after = claims, onSave = () => res(agent) } = {}) {
  let current = claims
  const base = vi.mocked(apiRequest).getMockImplementation()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
    if (path === "/api/agents/ag1/claims") return Promise.resolve(res({ clients: current }))
    if (path === "/api/agents/ag1" && init.method === "PATCH") {
      const answer = onSave()
      if (answer.ok) current = after
      return Promise.resolve(answer)
    }
    return base(path, init)
  })
}

const saves = () =>
  vi.mocked(apiRequest).mock.calls
    .filter(([p, init]) => p === "/api/agents/ag1" && init?.method === "PATCH")
    .map(([, init]) => JSON.parse(init.body))

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <AgentPage params={PARAMS} />
    </SWRConfig>
  )

describe("Custom agent page", () => {
  describe("a client no agent is acting on", () => {
    it("says so and takes it back through the scope save", async () => {
      withClaims([row("g1", "no_agent"), row("g2", "this_agent")], {
        after: [row("g1", "this_agent"), row("g2", "this_agent")],
      })
      renderPage()
      expect(await screen.findByText(/No agent is acting on Client g1/)).toBeInTheDocument()
      expect(screen.queryByText(/Another agent/)).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: "Take back Client g1" }))
      await waitFor(() => expect(screen.queryByText(/No agent is acting on/)).not.toBeInTheDocument())
      expect(saves()).toEqual([{ scope: { client_group_ids: ["g1", "g2"] }, only_flag: [] }])
    })

    it("keeps a client held elsewhere as only flag, so that holder's client doesn't refuse the save", async () => {
      agent.scope.flag_only_client_group_ids = ["g4"]
      withClaims([row("g1", "no_agent"), row("g2", "other_agent", "Birdy Media Buying Agent"), row("g3", "this_agent"), row("g4", "no_agent")])
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: "Take back Client g1" }))
      await waitFor(() => expect(saves()).toHaveLength(1))
      expect(saves()[0]).toEqual({ scope: { client_group_ids: ["g1", "g2", "g3", "g4"] }, only_flag: ["g2", "g4"] })
    })

    it("names each client when there are several", async () => {
      withClaims([row("g1", "no_agent"), row("g2", "no_agent")])
      renderPage()
      expect(await screen.findByRole("button", { name: "Take back Client g1" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Take back Client g2" })).toBeInTheDocument()
    })

    it("offers nothing for a client another agent really holds", async () => {
      withClaims([row("g1", "other_agent", "Birdy Media Buying Agent"), row("g2", "this_agent")])
      renderPage()
      await screen.findByText("Pause “Summer BBL – Video 3”")
      await waitFor(() =>
        expect(vi.mocked(apiRequest).mock.calls.some(([p]) => p === "/api/agents/ag1/claims")).toBe(true)
      )
      expect(screen.queryByText(/No agent is acting on/)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Take back/ })).not.toBeInTheDocument()
    })

    it("says so if another agent got there first, and nothing is saved twice", async () => {
      withClaims([row("g1", "no_agent")], {
        onSave: () => res({ detail: "Another agent already acts on Stock", conflicts: [{ client_group_id: "g1" }] }, 409),
      })
      renderPage()
      await userEvent.click(await screen.findByRole("button", { name: "Take back Client g1" }))
      expect(await screen.findByText(/Another agent has just taken this client/)).toBeInTheDocument()
      expect(saves()).toHaveLength(1)
    })

    it("shows nothing while the route is missing", async () => {
      renderPage() // the default mock answers 404
      await screen.findByText("Pause “Summer BBL – Video 3”")
      expect(screen.queryByRole("button", { name: /Take back/ })).not.toBeInTheDocument()
    })
  })

  it("reads the agent by its id from the route, never from the list", async () => {
    renderPage()
    expect(await screen.findByRole("heading", { name: "Lead rules" })).toBeInTheDocument()
    const paths = vi.mocked(apiRequest).mock.calls.map(([p]) => p)
    expect(paths).toContain("/api/agents/ag1")
    expect(paths).not.toContain("/api/agents")
  })

  it("shows the work list by default and keeps the tab in ?tab=", async () => {
    renderPage()
    expect(await screen.findByText("Pause “Summer BBL – Video 3”")).toBeInTheDocument()
    expect(screen.getByText(/Watching 2 clients/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: /Playbook/ }))
    expect(replace).toHaveBeenCalledWith("/hub/agents/custom/ag1?tab=playbook", { scroll: false })
  })

  it("shows impact and the activity log on ?tab=activity", async () => {
    search = "tab=activity"
    const base = vi.mocked(apiRequest).getMockImplementation()
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/api/agents/ag1/activity?limit=50") {
        return Promise.resolve(
          res({
            items: [
              {
                id: "act1",
                at: new Date().toISOString(),
                title: "Paused “Botox – Static 4”",
                client_name: "Tylaesthetics",
                suggestion_id: "s9",
                action_type: "pause_ads",
                decided: "auto",
                can_undo: true,
                currency: "GBP",
              },
            ],
            next_before: null,
          })
        )
      }
      if (path === "/api/agents/ag1/impact") {
        return Promise.resolve(
          res({
            month: "2026-10",
            actions: 1,
            auto: 1,
            wasted_spend_stopped: 40,
            wasted_spend_by_currency: { GBP: 40 },
            currency: "GBP",
            approval_rate: null,
            approval_counts: { approved: 0, denied: 0, undone_user: 0 },
            vs_prev_month: { month: "2026-09", actions: 0, auto: 0, approval_rate: null },
          })
        )
      }
      return base(path, init)
    })
    renderPage()
    expect(await screen.findByRole("tab", { name: /Wasted spend stopped/ })).toHaveTextContent("£40")
    const table = await screen.findByRole("table")
    expect(await within(table).findByText("Paused “Botox – Static 4”")).toBeInTheDocument()
    expect(within(table).getByRole("button", { name: "Undo Paused “Botox – Static 4”" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull()
  })

  it("loads older activity with the server's next_cursor", async () => {
    search = "tab=activity"
    const base = vi.mocked(apiRequest).getMockImplementation()
    const item = (id, title) => ({
      id,
      at: "2026-10-20T07:01:00.000Z",
      title,
      client_name: "Tylaesthetics",
      suggestion_id: `s_${id}`,
      action_type: "pause_ads",
      decided: "approved",
      can_undo: false,
      currency: "GBP",
    })
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/api/agents/ag1/activity?limit=50") {
        return Promise.resolve(
          res({ items: [item("a1", "Paused One")], next_before: "2026-10-20T07:01:00.000Z", next_cursor: "c 1" })
        )
      }
      if (path === "/api/agents/ag1/activity?limit=50&cursor=c%201") {
        return Promise.resolve(res({ items: [item("a2", "Paused Two")], next_before: null, next_cursor: null }))
      }
      return base(path, init)
    })
    renderPage()
    const more = await screen.findByRole("button", { name: "Load more" })
    await userEvent.click(more)
    const table = screen.getByRole("table")
    expect(await within(table).findByText("Paused Two")).toBeInTheDocument()
    expect(within(table).getByText("Paused One")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull()
  })

  it("keeps loaded rows and offers a retry when Load more fails", async () => {
    search = "tab=activity"
    const base = vi.mocked(apiRequest).getMockImplementation()
    let failMore = true
    const item = (id, title) => ({
      id,
      at: "2026-10-20T07:01:00.000Z",
      title,
      client_name: "Tylaesthetics",
      suggestion_id: `s_${id}`,
      action_type: "pause_ads",
      decided: "approved",
      can_undo: false,
      currency: "GBP",
    })
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/api/agents/ag1/activity?limit=50") {
        return Promise.resolve(res({ items: [item("a1", "Paused One")], next_before: null, next_cursor: "c1" }))
      }
      if (path === "/api/agents/ag1/activity?limit=50&cursor=c1") {
        if (failMore) return Promise.resolve(res({ detail: "Server hiccup" }, 500))
        return Promise.resolve(res({ items: [item("a2", "Paused Two")], next_before: null, next_cursor: null }))
      }
      return base(path, init)
    })
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher, shouldRetryOnError: false }}>
        <AgentPage params={PARAMS} />
      </SWRConfig>
    )
    await userEvent.click(await screen.findByRole("button", { name: "Load more" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load more activity.")
    expect(within(screen.getByRole("table")).getByText("Paused One")).toBeInTheDocument()

    failMore = false
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await within(screen.getByRole("table")).findByText("Paused Two")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).getByText("Paused One")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("shows the empty activity log", async () => {
    search = "tab=activity"
    const base = vi.mocked(apiRequest).getMockImplementation()
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/ag1/activity?limit=50"
        ? Promise.resolve(res({ items: [], next_before: null, next_cursor: null }))
        : base(path, init)
    )
    renderPage()
    expect((await screen.findAllByText(/Nothing yet\. Every action/)).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull()
  })

  it("shows an error with retry when the activity log fails", async () => {
    search = "tab=activity"
    const base = vi.mocked(apiRequest).getMockImplementation()
    let fail = true
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/api/agents/ag1/activity?limit=50") {
        return Promise.resolve(
          fail
            ? res({ detail: "Activity is down" }, 500)
            : res({ items: [{ id: "a1", at: "2026-10-20T07:01:00.000Z", title: "Paused One", decided: "approved" }] })
        )
      }
      return base(path, init)
    })
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher, shouldRetryOnError: false }}>
        <AgentPage params={PARAMS} />
      </SWRConfig>
    )
    const title = await screen.findByText("Couldn't load the activity")
    const frame = title.closest("[data-ds='frame']") ?? title.parentElement.parentElement
    fail = false
    await userEvent.click(within(frame).getByRole("button", { name: "Try again" }))
    expect(await within(await screen.findByRole("table")).findByText("Paused One")).toBeInTheDocument()
  })

  it("says how confidence moved since launch", async () => {
    agent = { ...agent, confidence: { score: 82, at_activation: 82 } }
    const base = vi.mocked(apiRequest).getMockImplementation()
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/ag1/confidence" ? Promise.resolve(res({ score: 91 })) : base(path, init)
    )
    renderPage()
    expect(await screen.findByText(/confidence 91%, up from 82% at launch/)).toBeInTheDocument()
  })

  it("gives the score alone when it has not moved or there is no launch figure", async () => {
    agent = { ...agent, confidence: { score: 84, at_activation: null } }
    renderPage()
    expect(await screen.findByText(/confidence 84%$/)).toBeInTheDocument()
    expect(screen.queryByText(/at launch/)).toBeNull()
  })

  it("sends an agent that isn't on yet to setup", async () => {
    agent = { ...agent, status: "draft" }
    renderPage()
    const link = await screen.findByRole("link", { name: /Continue setup/ })
    expect(link).toHaveAttribute("href", "/hub/agents/custom/ag1/setup")
  })
})

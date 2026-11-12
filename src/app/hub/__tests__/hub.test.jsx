import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import HubPage from "../page"
import { PageHeaderProvider } from "@/components/page-header"
import { ConfirmHost } from "@/components/ds"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useAgentWorkCount } from "@/lib/agents-api"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  json: async () => body,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
})

let agents
let stockFails
let listed
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/agents/a1" && method === "DELETE") return Promise.resolve(res({ deleted: "a1" }))
  if (path === "/api/agents" && method === "POST") return Promise.resolve(res({ id: "s1", type: "stock_media_buying", status: "draft" }))
  if (path === "/api/agents") {
    if (agents === "error") return Promise.resolve(res({ detail: "Server error" }, 500))
    return Promise.resolve(agents === 404 ? res({}, 404) : res(agents))
  }
  if (path === "/api/agents/s1" && method === "DELETE") return Promise.resolve(res({ deleted: "s1" }))
  if (path === "/api/agents/s1/runs/latest") {
    if (stockFails) return Promise.resolve(res({ detail: "boom" }, 500))
    return Promise.resolve(res({ run: { id: "r1" }, open_cards: 2 }))
  }
  if (path === "/api/dashboards" && method === "GET") return Promise.resolve(res({ items: listed }))
  return Promise.resolve(res({}, 404))
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PageHeaderProvider>
        <HubPage />
        <ConfirmHost />
      </PageHeaderProvider>
    </SWRConfig>,
  )

beforeEach(() => {
  agents = []
  stockFails = false
  listed = [
    { id: "d1", title: "Weekly spend", updatedAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "d2", title: "Lead sources", updatedAt: new Date(Date.now() - 86400_000 * 3).toISOString() },
  ]
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

const STOCK = (status) => ({ id: "s1", type: "stock_media_buying", status, name: "Birdy Media Buying Agent" })
const CUSTOM = (over = {}) => ({ id: "a1", type: "custom", status: "active", name: "Pause and revive rules", ...over })

describe("BirdyHub page", () => {
  it("shows agents dashboards reports in order with New buttons on the right of each header", async () => {
    renderPage()
    await screen.findByText("Weekly spend")
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(["Agents", "Dashboards", "Reports"])
    const header = (name) => screen.getByRole("heading", { level: 2, name }).closest("[data-hub-section-header]")
    expect(within(header("Agents")).getByRole("link", { name: /New agent/ })).toHaveAttribute("href", "/hub/agents/custom/new")
    expect(within(header("Dashboards")).getByRole("button", { name: /New dashboard/ })).toBeInTheDocument()
    // The button is the last thing in the header row, so it sits on the right.
    const row = header("Dashboards")
    expect(row.lastElementChild).toContainElement(within(row).getByRole("button", { name: /New dashboard/ }))
    expect(screen.queryByText("Birdy teammates that work your ad accounts")).not.toBeInTheDocument()
  })

  it("stock card shows N to decide when live with open cards", async () => {
    agents = [STOCK("active")]
    renderPage()
    const card = await screen.findByRole("link", { name: /Birdy Media Buying Agent/ })
    expect(card).toHaveAttribute("href", "/hub/agents/media-buying")
    expect(within(card).getByText("Default")).toBeInTheDocument()
    expect(await within(card).findByText("2 to decide")).toBeInTheDocument()
    expect(within(card).getByText(/Live/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Start over/ })).not.toBeInTheDocument()
  })

  it("missing stock agent creates then routes to setup", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /Birdy Media Buying Agent/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup"))
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      "/api/agents",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "stock_media_buying" }) }),
    )
  })

  it("a 409 on create (agent already exists) reloads the list", async () => {
    const base = mockApi
    let posted = false
    vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
      if (path === "/api/agents" && init.method === "POST") {
        posted = true
        agents = [STOCK("draft")]
        return Promise.resolve(res({ detail: "You already have the Birdy Media Buying Agent" }, 409))
      }
      return base(path, init)
    })
    renderPage()
    fireEvent.click(await screen.findByRole("button", { name: /Birdy Media Buying Agent/ }))
    expect(await screen.findByRole("link", { name: /Birdy Media Buying Agent/ })).toHaveAttribute(
      "href",
      "/hub/agents/media-buying/setup",
    )
    expect(posted).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it("draft stock card links to setup", async () => {
    agents = [STOCK("draft")]
    renderPage()
    const card = await screen.findByRole("link", { name: /Birdy Media Buying Agent/ })
    expect(card).toHaveAttribute("href", "/hub/agents/media-buying/setup")
    expect(within(card).getByText("Setting up")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Start over/ })).not.toBeInTheDocument()
  })

  it("a turned off stock agent opens the agent page and says Turned off", async () => {
    agents = [{ ...STOCK("draft"), turned_off_at: "2026-11-04T09:00:00" }]
    renderPage()
    const card = await screen.findByRole("link", { name: /Birdy Media Buying Agent/ })
    expect(card).toHaveAttribute("href", "/hub/agents/media-buying")
    expect(within(card).getByText("Turned off")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument()
  })

  it("custom agent card shows Setting up for draft", async () => {
    agents = [CUSTOM(), CUSTOM({ id: "a2", name: "Winner mover", status: "draft" })]
    renderPage()
    const live = await screen.findByRole("link", { name: /Pause and revive rules/ })
    expect(live).toHaveAttribute("href", "/hub/agents/custom/a1")
    expect(within(live).getByText(/Live/)).toBeInTheDocument()
    const draft = screen.getByRole("link", { name: /Winner mover/ })
    expect(draft).toHaveAttribute("href", "/hub/agents/custom/a2")
    expect(within(draft).getByText("Setting up")).toBeInTheDocument()
  })

  it("a live custom agent with open work shows N to decide", async () => {
    agents = [CUSTOM()]
    const base = mockApi
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/a1/work" ? Promise.resolve(res({ open: [{ id: "w1" }, { id: "w2" }, { id: "w3" }], auto_applied: [] })) : base(path, init),
    )
    renderPage()
    const card = await screen.findByRole("link", { name: /Pause and revive rules/ })
    expect(await within(card).findByText("3 to decide")).toBeInTheDocument()
  })

  it("custom agents are not mistaken for the stock agent", async () => {
    agents = [CUSTOM()]
    renderPage()
    expect(await screen.findByRole("button", { name: /Birdy Media Buying Agent/ })).toBeInTheDocument()
  })

  it("a failed agent list shows an error and not an empty hub", async () => {
    agents = "error"
    renderPage()
    expect(await screen.findByText("Couldn't load your agents")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Birdy Media Buying Agent/ })).not.toBeInTheDocument()
  })

  it("treats a missing /api/agents route as no agents", async () => {
    agents = 404
    renderPage()
    expect(await screen.findByRole("button", { name: /Birdy Media Buying Agent/ })).toBeInTheDocument()
  })

  it("lists dashboards as compact cards", async () => {
    renderPage()
    expect(await screen.findByRole("link", { name: /Weekly spend/ })).toHaveAttribute("href", "/hub/dashboards/d1")
    expect(screen.getByRole("link", { name: /Lead sources/ })).toHaveAttribute("href", "/hub/dashboards/d2")
  })

  it("empty dashboards shows single empty card with New dashboard", async () => {
    listed = []
    renderPage()
    expect(await screen.findByText("No dashboards yet.")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /New dashboard/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: /New dashboard/ }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})

describe("nav badge", () => {
  function Badge() {
    const count = useAgentWorkCount()
    return <output aria-label="nav badge">{count == null ? "none" : count}</output>
  }
  const renderBadge = () =>
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <Badge />
      </SWRConfig>,
    )

  it("counts the open cards of a live stock agent", async () => {
    agents = [STOCK("active")]
    renderBadge()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("2"))
  })

  it("adds them to a custom agent's open work", async () => {
    agents = [STOCK("active"), CUSTOM({ id: "a1" })]
    const base = mockApi
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/a1/work" ? Promise.resolve(res({ open: [{ id: "w1" }], auto_applied: [] })) : base(path, init),
    )
    renderBadge()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("3"))
  })

  it("makes one request for the stock count, and never reads the whole report", async () => {
    agents = [STOCK("active")]
    renderBadge()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("2"))
    const paths = vi.mocked(apiRequest).mock.calls.map(([p]) => p)
    expect(paths.filter((p) => p.startsWith("/api/agents/s1/"))).toEqual(["/api/agents/s1/runs/latest"])
  })

  it("keeps a custom agent's count when the stock request fails", async () => {
    agents = [STOCK("active"), CUSTOM({ id: "a1" })]
    stockFails = true
    const base = mockApi
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/agents/a1/work" ? Promise.resolve(res({ open: [{ id: "w1" }], auto_applied: [] })) : base(path, init),
    )
    renderBadge()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("1"))
  })

  it("counts only the custom agent when there is no stock agent", async () => {
    agents = [CUSTOM({ id: "a1" }), CUSTOM({ id: "a2" })]
    const base = mockApi
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path.endsWith("/work") ? Promise.resolve(res({ open: [{ id: "w" }, { id: "x" }], auto_applied: [] })) : base(path, init),
    )
    renderBadge()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("4"))
  })

  it("stays hidden for a draft stock agent", async () => {
    agents = [STOCK("draft")]
    renderBadge()
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledWith("/api/agents"))
    expect(screen.getByLabelText("nav badge")).toHaveTextContent("none")
  })
})

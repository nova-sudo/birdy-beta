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
  if (path === "/api/agents/s1/runs/latest") return Promise.resolve(res({ run: { id: "r1" } }))
  if (path === "/api/agents/s1/runs/r1") {
    return Promise.resolve(res({ run: { id: "r1" }, cards: [{ id: "c1", can_apply: true }, { id: "c2", can_apply: false }, { id: "c3", can_apply: true }] }))
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
  it("offers Set up agent when there is no stock agent, and creates one then opens setup", async () => {
    renderPage()
    expect(await screen.findByText("Birdy Media Buying Agent")).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: /Set up agent/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup"))
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      "/api/agents",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "stock_media_buying" }) }),
    )
  })

  it("treats a missing /api/agents route as no agents", async () => {
    agents = 404
    renderPage()
    expect(await screen.findByRole("button", { name: /Set up agent/ })).toBeInTheDocument()
    expect(screen.getByText("No custom agents yet")).toBeInTheDocument()
  })

  it("a failed agent list shows an error and not an empty hub", async () => {
    agents = "error"
    renderPage()
    expect(await screen.findByText("Couldn't load your agents")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Set up agent/ })).not.toBeInTheDocument()
    expect(screen.queryByText("No custom agents yet")).not.toBeInTheDocument()
  })

  it("a draft stock agent offers Continue setup or Start over", async () => {
    agents = [STOCK("draft")]
    renderPage()
    const cont = await screen.findByRole("link", { name: /Continue setup/ })
    expect(cont).toHaveAttribute("href", "/hub/agents/media-buying/setup")

    fireEvent.click(screen.getByRole("button", { name: /Start over/ }))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Start over" }))
    await waitFor(() =>
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith("/api/agents/s1", expect.objectContaining({ method: "DELETE" })),
    )
    // Starting a stock agent over stays on the hub; it doesn't open the custom wizard.
    expect(push).not.toHaveBeenCalledWith("/hub/agents/custom/new")
  })

  it("a live stock agent only offers Open agent", async () => {
    agents = [STOCK("active")]
    renderPage()
    const open = await screen.findByRole("link", { name: /Open agent/ })
    expect(open).toHaveAttribute("href", "/hub/agents/media-buying")
    expect(screen.queryByRole("button", { name: /Start over/ })).not.toBeInTheDocument()
  })

  it("lists each custom agent linking to its page", async () => {
    agents = [CUSTOM(), CUSTOM({ id: "a2", name: "Winner mover", status: "draft" })]
    renderPage()
    const first = await screen.findByRole("link", { name: /Pause and revive rules/ })
    expect(first).toHaveAttribute("href", "/hub/agents/custom/a1")
    expect(screen.getByRole("link", { name: /Winner mover/ })).toHaveAttribute("href", "/hub/agents/custom/a2")
    expect(screen.queryByText("No custom agents yet")).not.toBeInTheDocument()
  })

  it("custom agents are not mistaken for the stock agent", async () => {
    agents = [CUSTOM()]
    renderPage()
    expect(await screen.findByRole("button", { name: /Set up agent/ })).toBeInTheDocument()
  })

  it("Create custom agent opens the custom wizard", async () => {
    renderPage()
    const link = await screen.findByRole("link", { name: /Create custom agent/ })
    expect(link).toHaveAttribute("href", "/hub/agents/custom/new")
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()
  })

  it("lists dashboards", async () => {
    renderPage()
    expect(await screen.findByText("Weekly spend")).toBeInTheDocument()
    expect(screen.getByText("Lead sources")).toBeInTheDocument()
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

  it("stays hidden for a draft stock agent", async () => {
    agents = [STOCK("draft")]
    renderBadge()
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledWith("/api/agents"))
    expect(screen.getByLabelText("nav badge")).toHaveTextContent("none")
  })
})

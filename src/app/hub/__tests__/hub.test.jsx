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
  if (path === "/api/agents") return Promise.resolve(agents === 404 ? res({}, 404) : res(agents))
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

describe("BirdyHub page", () => {
  it("shows the Set up card when there is no agent", async () => {
    renderPage()
    expect(screen.getByText("Media Buying Agent")).toBeInTheDocument()
    const link = await screen.findByRole("link", { name: /Set up agent/ })
    expect(link).toHaveAttribute("href", "/hub/agents/media-buying/setup")
  })

  it("treats a missing /api/agents route as no agent", async () => {
    agents = 404
    renderPage()
    expect(await screen.findByRole("link", { name: /Set up agent/ })).toBeInTheDocument()
  })

  it("lists dashboards", async () => {
    renderPage()
    expect(await screen.findByText("Weekly spend")).toBeInTheDocument()
    expect(screen.getByText("Lead sources")).toBeInTheDocument()
  })

  it("Create your own agent is Coming soon", () => {
    renderPage()
    expect(screen.getByText("Create your own agent")).toBeInTheDocument()
    expect(screen.getByText("Coming soon")).toBeInTheDocument()
  })

  it("a draft agent offers Continue setup or Start over", async () => {
    agents = [{ id: "a1", type: "media_buying", status: "draft" }]
    renderPage()
    const cont = await screen.findByRole("link", { name: /Continue setup/ })
    expect(cont).toHaveAttribute("href", "/hub/agents/media-buying/setup")

    fireEvent.click(screen.getByRole("button", { name: /Start over/ }))
    const dialog = await screen.findByRole("alertdialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Start over" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/media-buying/setup?step=1"))
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith("/api/agents/a1", expect.objectContaining({ method: "DELETE" }))
  })

  it("an active agent only offers Open agent", async () => {
    agents = [{ id: "a1", type: "media_buying", status: "active" }]
    renderPage()
    expect(await screen.findByRole("link", { name: /Open agent/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Start over/ })).not.toBeInTheDocument()
  })
})

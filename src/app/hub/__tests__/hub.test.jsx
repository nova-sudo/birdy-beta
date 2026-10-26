import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SWRConfig } from "swr"
import HubPage from "../page"
import { PageHeaderProvider } from "@/components/page-header"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
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
  if (path === "/api/agents") return Promise.resolve(agents === 404 ? res({}, 404) : res(agents))
  if (path === "/api/dashboards" && method === "GET") return Promise.resolve(res({ items: listed }))
  return Promise.resolve(res({}, 404))
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PageHeaderProvider>
        <HubPage />
      </PageHeaderProvider>
    </SWRConfig>,
  )

beforeEach(() => {
  agents = []
  listed = [
    { id: "d1", title: "Weekly spend", updatedAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "d2", title: "Lead sources", updatedAt: new Date(Date.now() - 86400_000 * 3).toISOString() },
  ]
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
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import DashboardsPage from "../page"
import { PageHeaderProvider, PageHeaderControls } from "@/components/page-header"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
// next/font hits the network at module load; the class names are all the shell uses.
vi.mock("@/lib/fonts", () => ({ pdFontClass: "" }))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { apiRequest } from "@/lib/api"

// The store speaks to apiRequest, which returns a fetch Response; these
// stand-ins carry just what dashkit's http helper reads (ok, status, text()).
const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
})

let listed
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/dashboards" && method === "GET") return Promise.resolve(res({ items: listed }))
  if (method === "PUT") return Promise.resolve(res(JSON.parse(init.body)))
  if (method === "DELETE") return Promise.resolve(res(undefined, 204))
  return Promise.resolve(res({}, 404))
}

// A fresh SWR cache per test, so one test's list never leaks into the next.
// The "New dashboard" button is published into the global top bar, so the real
// header provider and its controls slot are rendered to put it on screen.
const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PageHeaderProvider>
        <PageHeaderControls />
        <DashboardsPage />
      </PageHeaderProvider>
    </SWRConfig>,
  )

beforeEach(() => {
  push.mockClear()
  vi.mocked(apiRequest).mockReset()
  listed = [
    { id: "d1", title: "Weekly spend", updatedAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "d2", title: "Lead sources", updatedAt: new Date(Date.now() - 86400_000 * 3).toISOString() },
  ]
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("My dashboards list page", () => {
  it("renders a card per dashboard", async () => {
    renderPage()

    expect(await screen.findByText("Weekly spend")).toBeInTheDocument()
    expect(screen.getByText("Lead sources")).toBeInTheDocument()
    expect(screen.getAllByText(/^Updated /)).toHaveLength(2)
    expect(document.querySelectorAll('[data-ds="surface"]')).toHaveLength(2)
    expect(screen.getByRole("link", { name: /Weekly spend/ })).toHaveAttribute("href", "/dashboards/d1")
  })

  it("shows an empty state when there are no dashboards", async () => {
    listed = []
    renderPage()

    expect(await screen.findByText("No dashboards yet")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="empty-state"]')).not.toBeNull()
  })

  it("shows an error state with a retry when the list fails to load", async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      path === "/api/dashboards" && (init.method ?? "GET") === "GET"
        ? Promise.resolve(res({}, 500))
        : mockApi(path, init),
    )
    renderPage()

    expect(await screen.findByText("Couldn't load your dashboards.")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="error-state"]')).not.toBeNull()

    vi.mocked(apiRequest).mockImplementation(mockApi)
    await user.click(screen.getByRole("button", { name: /Try again/ }))
    expect(await screen.findByText("Weekly spend")).toBeInTheDocument()
    const listCalls = vi.mocked(apiRequest).mock.calls.filter(
      ([path, init]) => path === "/api/dashboards" && (init?.method ?? "GET") === "GET",
    )
    expect(listCalls).toHaveLength(2)
  })

  it("create blank saves and navigates", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Weekly spend")

    await user.click(screen.getByRole("button", { name: "New dashboard" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText(/Title/), "Q4 overview")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    const put = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "PUT")
    expect(put[0]).toMatch(/^\/api\/dashboards\/[^/]+$/)
    const saved = JSON.parse(put[1].body)
    expect(saved.title).toBe("Q4 overview")
    // A v2 doc with nothing on it yet (the backend rejects v1 saves).
    expect(saved.version).toBe(3)
    expect(saved.widgets).toEqual([])
    expect(saved.sections).toBeUndefined()
    expect(push).toHaveBeenCalledWith(`/dashboards/${saved.id}`)
  })

  it("create with a brief carries it to the detail page", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Weekly spend")

    await user.click(screen.getByRole("button", { name: "New dashboard" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText(/Title/), "Spend")
    await user.type(within(dialog).getByLabelText(/Brief/), "spend by client & day")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    const put = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "PUT")
    const { id } = JSON.parse(put[1].body)
    expect(push).toHaveBeenCalledWith(`/dashboards/${id}?brief=${encodeURIComponent("spend by client & day")}`)
  })

  it("requires a title", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Weekly spend")

    await user.click(screen.getByRole("button", { name: "New dashboard" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeDisabled()
  })

  it("remove calls DELETE and drops the card", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Weekly spend")

    await user.click(screen.getByRole("button", { name: "Delete Weekly spend" }))
    const confirm = await screen.findByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(screen.queryByText("Weekly spend")).not.toBeInTheDocument())
    expect(apiRequest).toHaveBeenCalledWith("/api/dashboards/d1", expect.objectContaining({ method: "DELETE" }))
    expect(screen.getByText("Lead sources")).toBeInTheDocument()
  })
})

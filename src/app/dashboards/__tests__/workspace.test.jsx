// One dashboard: view/edit over the same live doc, with Ask Birdy beside it.
// ChatConversation is stubbed to record its props, so these cover what the
// workspace hands the chat (the brief, the live summary, the ops handler)
// without a model in the loop.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import { PageHeaderProvider, PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import DashboardWorkspace from "../[id]/DashboardWorkspace"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
// next/font hits the network at module load; the class names are all the shell uses.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(search),
}))

const chatProps = { current: null }
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    chatProps.current = props
    return <div data-testid="chat" />
  },
}))

import { apiRequest } from "@/lib/api"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
})

const now = "2026-10-18T00:00:00.000Z"
const DOC = {
  id: "d1",
  version: 1,
  title: "Weekly spend",
  sections: [
    {
      id: "s1",
      title: "Overview",
      widgets: [{ id: "w1", type: "text", title: "Intro", span: { cols: 6, rows: 1 }, data: { markdown: "Hello there" } }],
    },
  ],
  meta: { createdAt: now, updatedAt: now, lastAuthor: "user" },
}
const CATALOG = {
  metrics: [{ key: "spend", label: "Spend", format: "currency", dimensions: [] }],
  dimensions: [],
  windows: [{ preset: "last_7_days", label: "Last 7 days" }],
}

function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/dashboards/catalog") return Promise.resolve(res(CATALOG))
  if (path === "/api/dashboards/resolve") return Promise.resolve(res({ slots: [] }))
  if (path === "/api/dashboards/d1" && method === "GET") return Promise.resolve(res(DOC))
  if (path === "/api/dashboards/d1" && method === "PUT") return Promise.resolve(res(JSON.parse(init.body)))
  return Promise.resolve(res({}, 404))
}

const renderWorkspace = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PageHeaderProvider>
        <PageHeaderTitle />
        <PageHeaderControls />
        <DashboardWorkspace id="d1" />
      </PageHeaderProvider>
    </SWRConfig>,
  )

beforeEach(() => {
  search = ""
  replace.mockClear()
  chatProps.current = null
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("Dashboard workspace", () => {
  it("toggle edit shows the editor", async () => {
    const user = userEvent.setup()
    const { container } = renderWorkspace()
    expect(await screen.findByText("Hello there")).toBeInTheDocument()
    expect(container.querySelector(".dk-editor")).toBeNull()

    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    expect(await screen.findByRole("complementary", { name: "Widgets" })).toBeInTheDocument()
    expect(container.querySelector(".dk-editor")).not.toBeNull()
  })

  it("leaving edit mode saves unsaved changes", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    await user.click(await screen.findByRole("button", { name: "Add Text" }))
    expect(vi.mocked(apiRequest).mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false)

    await user.click(screen.getByRole("radio", { name: /View/ }))

    await waitFor(() => {
      const put = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "PUT")
      expect(JSON.parse(put[1].body).sections[0].widgets).toHaveLength(2)
    })
    expect(await screen.findByText("Saved")).toBeInTheDocument()
  })

  it("brief query seeds the chat", async () => {
    search = `brief=${encodeURIComponent("spend by client & day")}`
    renderWorkspace()

    await waitFor(() => expect(chatProps.current).not.toBeNull())
    expect(chatProps.current.initialMessage).toBe("spend by client & day")
    expect(chatProps.current.page).toBe("dashboards")
    expect(chatProps.current.dashboardId).toBe("d1")
    expect(chatProps.current.sessionKey).toBe("birdy_dashboard_d1")
    expect(replace).toHaveBeenCalledWith("/dashboards/d1")
    // The summary is the live doc's, read when the message is sent.
    expect(chatProps.current.getDashboardSummary()).toContain("[w1]")
  })

  it("ops from the chat land on the dashboard and are saved", async () => {
    renderWorkspace()
    await screen.findByText("Hello there")
    await waitFor(() => expect(chatProps.current).not.toBeNull())

    let result
    act(() => {
      result = chatProps.current.onDashboardOps(
        [{ op: "updateWidgetData", widgetId: "w1", patch: { markdown: "Rewritten by Birdy" } }],
        { dashboard_id: "d1" },
      )
    })

    expect(result.applied).toBe(true)
    expect(await screen.findByText("Rewritten by Birdy")).toBeInTheDocument()
    await waitFor(() => {
      const put = vi.mocked(apiRequest).mock.calls.find(([, init]) => init?.method === "PUT")
      expect(JSON.parse(put[1].body).sections[0].widgets[0].data.markdown).toBe("Rewritten by Birdy")
    })
    expect(chatProps.current.getDashboardSummary()).toContain("[w1]")
  })
})

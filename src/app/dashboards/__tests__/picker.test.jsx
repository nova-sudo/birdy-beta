// Discoverability on one dashboard: the view-mode "Add widget" picker, the
// one-click starters on an empty dashboard, and Ask Birdy's quick starters.
// Same harness as workspace.test.jsx: the real workspace over a mocked API,
// with ChatConversation stubbed to record its props.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import { PageHeaderProvider, PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import { WidgetPicker } from "@/components/dashboards/WidgetPicker"
import { registry } from "@/lib/dashkit/registry"
import DashboardWorkspace from "../[id]/DashboardWorkspace"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
// next/font hits the network at module load; the class names are all the shell uses.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
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
const base = { id: "d1", version: 1, title: "Weekly spend", meta: { createdAt: now, updatedAt: now, lastAuthor: "user" } }
const NO_SECTIONS = { ...base, sections: [] }
const EMPTY = { ...base, sections: [{ id: "s1", title: "Overview", widgets: [] }] }
const WITH_TEXT = {
  ...base,
  sections: [
    {
      id: "s1",
      title: "Overview",
      widgets: [{ id: "w1", type: "text", title: "Intro", span: { cols: 6, rows: 1 }, data: { markdown: "Hello there" } }],
    },
  ],
}
const CATALOG = {
  metrics: [
    { key: "spend", label: "Spend", format: "currency", dimensions: ["client", "day"] },
    { key: "meta_leads", label: "Meta leads", format: "number", dimensions: ["client"] },
    { key: "clicks", label: "Clicks", format: "number", dimensions: ["client", "day"] },
    { key: "ctr", label: "CTR", format: "percent", dimensions: ["client"] },
  ],
  dimensions: [
    { key: "client", label: "Client" },
    { key: "day", label: "Day" },
  ],
  windows: [
    { preset: "last_7d", label: "Last 7 days" },
    { preset: "last_30d", label: "Last 30 days" },
  ],
}

let doc = EMPTY
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/dashboards/catalog") return Promise.resolve(res(CATALOG))
  if (path === "/api/dashboards/resolve") return Promise.resolve(res({ slots: [] }))
  if (path === "/api/dashboards/d1" && method === "GET") return Promise.resolve(res(doc))
  if (path === "/api/dashboards/d1" && method === "PUT") return Promise.resolve(res(JSON.parse(init.body)))
  return Promise.resolve(res({}, 404))
}
const puts = () => vi.mocked(apiRequest).mock.calls.filter(([, init]) => init?.method === "PUT")

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

const STARTER_LABELS = [
  "KPI strip of spend, leads, clicks and CTR (last 30 days)",
  "Spend trend by day (last 30 days)",
  "Spend by client table (last 7 days)",
]

beforeEach(() => {
  doc = EMPTY
  chatProps.current = null
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("WidgetPicker", () => {
  it("shows every widget kind as an icon tile, grouped by category", async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const onOpenChange = vi.fn()
    render(<WidgetPicker open onOpenChange={onOpenChange} onPick={onPick} />)

    const dialog = screen.getByRole("dialog", { name: "Add a widget" })
    const headings = within(dialog).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(["Metrics", "Charts", "Tables", "Content"])

    const tiles = within(dialog).getAllByRole("button", { name: /^Add / })
    expect(tiles).toHaveLength(registry.list().length)
    for (const tile of tiles) expect(tile.querySelector("svg")).not.toBeNull()

    await user.click(within(dialog).getByRole("button", { name: "Add Trend" }))
    expect(onPick).toHaveBeenCalledWith("trend")
  })
})

describe("Dashboard discoverability", () => {
  it("add widget from view creates a section", async () => {
    doc = NO_SECTIONS
    const user = userEvent.setup()
    const { container } = renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Add widget" }))
    const dialog = await screen.findByRole("dialog", { name: "Add a widget" })
    await user.click(within(dialog).getByRole("button", { name: "Add KPI" }))

    // Edit mode, with the new widget in a new section and selected.
    await waitFor(() => expect(container.querySelector(".dk-editor")).not.toBeNull())
    expect(screen.getByRole("radio", { name: /Edit/ })).toBeChecked()
    expect(screen.queryByRole("dialog", { name: "Add a widget" })).toBeNull()
    expect(container.querySelectorAll(".dk-canvas .dk-section")).toHaveLength(1)
    expect(container.querySelectorAll(".dk-canvas .dk-widget")).toHaveLength(1)
    expect(container.querySelector(".dk-widget--selected")).not.toBeNull()
    expect(within(screen.getByRole("complementary", { name: "Properties" })).queryByText("Select a widget or section")).toBeNull()
    // The header button that opened the picker is gone in edit mode, so focus
    // lands in the new widget's properties rather than dropping to <body>.
    expect(screen.getByRole("complementary", { name: "Properties" })).toContainElement(document.activeElement)

    // Edit mode keeps it unsaved until the user saves or leaves the editor.
    expect(puts()).toHaveLength(0)
    await user.click(screen.getByRole("radio", { name: /View/ }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    const saved = JSON.parse(puts()[0][1].body)
    expect(saved.sections).toHaveLength(1)
    expect(saved.sections[0].widgets.map((w) => w.type)).toEqual(["kpi"])
  })

  it("add widget appends to the last section", async () => {
    doc = { ...WITH_TEXT, sections: [...WITH_TEXT.sections, { id: "s2", title: "More", widgets: [] }] }
    const user = userEvent.setup()
    const { container } = renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Add widget" }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add Table" }))

    await waitFor(() => expect(container.querySelector(".dk-editor")).not.toBeNull())
    const sections = container.querySelectorAll(".dk-canvas .dk-section")
    expect(sections).toHaveLength(2)
    expect(sections[0].querySelectorAll(".dk-widget")).toHaveLength(1)
    expect(sections[1].querySelector(".dk-widget--selected")).not.toBeNull()
  })

  it("the header's Add widget is a view-mode control", async () => {
    doc = WITH_TEXT
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    expect(screen.getByRole("button", { name: "Add widget" })).toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    // The editor has its own palette for that.
    expect(screen.queryByRole("button", { name: "Add widget" })).toBeNull()
  })

  it("empty dashboard shows three starters", async () => {
    renderWorkspace()

    const starters = await screen.findByRole("region", { name: "Start with" })
    expect(within(starters).getAllByRole("button").map((b) => b.textContent)).toEqual(STARTER_LABELS)
  })

  it("a dashboard with widgets shows no starters", async () => {
    doc = WITH_TEXT
    renderWorkspace()
    await screen.findByText("Hello there")
    expect(screen.queryByRole("region", { name: "Start with" })).toBeNull()
  })

  it("a starter adds its bound widget in one click and saves it", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("button", { name: STARTER_LABELS[0] }))

    await waitFor(() => expect(puts()).toHaveLength(1))
    const [widget] = JSON.parse(puts()[0][1].body).sections[0].widgets
    expect(widget.type).toBe("kpi-strip")
    expect(widget.bindings).toEqual({
      a: { metric: "spend", window: { preset: "last_30d" }, compare: "previous" },
      b: { metric: "meta_leads", window: { preset: "last_30d" }, compare: "previous" },
      c: { metric: "clicks", window: { preset: "last_30d" }, compare: "previous" },
      d: { metric: "ctr", window: { preset: "last_30d" }, compare: "previous" },
    })
    // Still in view, the starters gone now there is a widget, and one Undo away.
    expect(screen.getByRole("radio", { name: /View/ })).toBeChecked()
    expect(screen.queryByRole("region", { name: "Start with" })).toBeNull()
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("chat panel receives the three starters", async () => {
    renderWorkspace()
    await waitFor(() => expect(chatProps.current).not.toBeNull())

    expect(chatProps.current.quickStarters.map((s) => s.label)).toEqual([
      "Add a table of spend by client",
      "Make the Overview heading large",
      "Add a note explaining this dashboard",
    ])
    for (const s of chatProps.current.quickStarters) expect(s.prompt).toBe(s.label)
  })
})

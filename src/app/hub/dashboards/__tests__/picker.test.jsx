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
import { setGridWidth } from "./grid-env"
import CATALOG from "./fixtures/birdy-catalog.json"
import DashboardWorkspace from "../[id]/DashboardWorkspace"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
// next/font hits the network at module load; the class names are all the shell uses.
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
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
const base = { id: "d1", version: 3, title: "Weekly spend", meta: { createdAt: now, updatedAt: now, lastAuthor: "user" } }
// A new dashboard: createDashboard gives v3 docs no widgets at all.
const EMPTY = { ...base, widgets: [] }
const OVERVIEW = { id: "s1", type: "heading", version: 1, title: "Overview", layout: { x: 0, y: 0, w: 12, h: 1 }, data: {} }
// Only a heading: still nothing to look at, so the starters stay.
const HEADING_ONLY = { ...base, widgets: [OVERVIEW] }
const WITH_TEXT = {
  ...base,
  widgets: [
    OVERVIEW,
    { id: "w1", type: "text", version: 1, title: "Intro", layout: { x: 0, y: 1, w: 6, h: 3 }, data: { markdown: "Hello there" } },
  ],
}
// A v1 doc saved before dashkit 0.3.0, for the picker on a migrated doc.
const V1_WITH_TEXT = {
  ...base,
  version: 1,
  sections: [
    {
      id: "s1",
      title: "Overview",
      widgets: [{ id: "w1", type: "text", version: 1, title: "Intro", span: { cols: 6, rows: 1 }, data: { markdown: "Hello there" } }],
    },
  ],
}
let doc = EMPTY
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/dashboards/catalog") return Promise.resolve(res(CATALOG))
  if (path === "/api/dashboards/query") {
    return Promise.resolve(res({ frames: JSON.parse(init.body).queries.map(() => null) }))
  }
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
  "Overview board: KPIs, trend, funnel, leaderboard and table (last 30 days)",
  "KPI strip of spend, leads, clicks and CTR (last 30 days)",
  "Spend trend by day (last 30 days)",
  "Spend by client table (last 7 days)",
]

const canvasWidgets = (container) =>
  [...container.querySelectorAll('[data-dk="canvas"] [data-dk="widget"]')].map((el) => el.closest(".react-grid-item"))
const selectedHandle = () => screen.getAllByRole("button", { name: /^Select / }).find((b) => b.getAttribute("aria-pressed") === "true")

beforeEach(() => {
  setGridWidth(1440)
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
    // dashkit 0.4's ten kinds: bar, donut and comparison folded into Chart.
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual([
      "Add KPI",
      "Add KPI strip",
      "Add Trend",
      "Add Chart",
      "Add Funnel",
      "Add Leaderboard",
      "Add Table",
      "Add Heading",
      "Add Text",
      "Add Briefing",
    ])
    for (const tile of tiles) expect(tile.querySelector("svg")).not.toBeNull()

    await user.click(within(dialog).getByRole("button", { name: "Add Trend" }))
    expect(onPick).toHaveBeenCalledWith("trend")
  })
})

describe("Dashboard discoverability", () => {
  it("add widget from view adds it to an empty dashboard and selects it", async () => {
    const user = userEvent.setup()
    const { container } = renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Add widget" }))
    const dialog = await screen.findByRole("dialog", { name: "Add a widget" })
    await user.click(within(dialog).getByRole("button", { name: "Add KPI" }))

    // Edit mode, with the new widget on the canvas and selected.
    await waitFor(() => expect(container.querySelector('[data-dk="canvas"]')).not.toBeNull())
    expect(screen.getByRole("tab", { name: /Edit/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("dialog", { name: "Add a widget" })).toBeNull()
    // The canvas grid mounts once it has measured its width.
    await waitFor(() => expect(canvasWidgets(container)).toHaveLength(1))
    expect(selectedHandle()).toHaveAccessibleName(/^Select KPI/)
    expect(within(screen.getByRole("complementary", { name: "Properties" })).queryByText("Select a widget to edit it")).toBeNull()
    // The header button that opened the picker is gone in edit mode, so focus
    // lands in the new widget's properties rather than dropping to <body>.
    expect(screen.getByRole("complementary", { name: "Properties" })).toContainElement(document.activeElement)

    // Edit mode keeps it unsaved until the user saves or leaves the editor.
    expect(puts()).toHaveLength(0)
    await user.click(screen.getByRole("tab", { name: /View/ }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    const saved = JSON.parse(puts()[0][1].body)
    expect(saved.version).toBe(3)
    expect(saved.widgets.map((w) => w.type)).toEqual(["kpi"])
  })

  it("add widget goes after the last widget of a migrated v1 doc", async () => {
    doc = V1_WITH_TEXT
    const user = userEvent.setup()
    const { container } = renderWorkspace()

    await user.click(await screen.findByRole("button", { name: "Add widget" }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add Table" }))

    await waitFor(() => expect(container.querySelector('[data-dk="canvas"]')).not.toBeNull())
    // Heading, text, and the new table: selected, below the text (too wide for its row).
    // The canvas grid mounts once it has measured its width.
    await waitFor(() => expect(canvasWidgets(container)).toHaveLength(3))
    expect(selectedHandle()).toHaveAccessibleName(/^Select Table/)
    await user.click(screen.getByRole("tab", { name: /View/ }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    const saved = JSON.parse(puts()[0][1].body)
    expect(saved.widgets.map((w) => [w.id === "s1" || w.id === "w1" ? w.id : w.type, w.layout.y])).toEqual([
      ["s1", 0],
      ["w1", 1],
      ["table", 3],
    ])
  })

  it("the header's Add widget is a view-mode control", async () => {
    doc = WITH_TEXT
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    expect(screen.getByRole("button", { name: "Add widget" })).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Edit/ }))
    // The editor has its own palette for that.
    expect(screen.queryByRole("button", { name: "Add widget" })).toBeNull()
  })

  it("empty dashboard shows the four starters", async () => {
    renderWorkspace()

    const starters = await screen.findByRole("region", { name: "Start with" })
    expect(within(starters).getAllByRole("button").map((b) => b.textContent)).toEqual(STARTER_LABELS)
  })

  it("a dashboard with only a heading still shows the starters", async () => {
    doc = HEADING_ONLY
    renderWorkspace()
    expect(await screen.findByRole("region", { name: "Start with" })).toBeInTheDocument()
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

    await user.click(await screen.findByRole("button", { name: STARTER_LABELS[1] }))

    await waitFor(() => expect(puts()).toHaveLength(1))
    // An empty dashboard gets its page title as a level-1 heading, the widget under it.
    const saved = JSON.parse(puts()[0][1].body)
    expect(saved.version).toBe(3)
    const [heading, widget] = saved.widgets
    expect(heading).toMatchObject({ type: "heading", title: "Weekly spend", data: { level: 1 }, layout: { x: 0, y: 0, w: 12 } })
    expect(widget.type).toBe("kpi-strip")
    expect(widget.layout.y).toBe(heading.layout.h)
    expect(widget.bindings).toEqual({
      query: {
        metrics: [{ metric: "spend" }, { metric: "meta_leads" }, { metric: "clicks" }, { metric: "ctr" }],
        window: { preset: "last_30d" },
        compare: "previous",
      },
    })
    // Still in view, the starters gone now there is a widget, and one Undo away.
    expect(screen.getByRole("tab", { name: /View/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("region", { name: "Start with" })).toBeNull()
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument()
  })

  it("the default board starter adds the whole board in one click", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(await screen.findByRole("button", { name: STARTER_LABELS[0] }))

    await waitFor(() => expect(puts()).toHaveLength(1))
    const saved = JSON.parse(puts()[0][1].body)
    expect(saved.widgets.map((w) => w.type)).toEqual(["heading", "kpi-strip", "trend", "funnel", "leaderboard", "table"])
    // One batch, so one Undo takes it all back.
    await user.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(JSON.parse(puts()[1][1].body).widgets).toEqual([])
  })

  it("chat panel receives the three starters", async () => {
    renderWorkspace()
    await waitFor(() => expect(chatProps.current).not.toBeNull())

    expect(chatProps.current.quickStarters.map((s) => s.label)).toEqual([
      "Add a table of spend by client",
      "Add a page title heading",
      "Add a note explaining this dashboard",
    ])
    for (const s of chatProps.current.quickStarters) expect(s.prompt).toBe(s.label)
  })
})

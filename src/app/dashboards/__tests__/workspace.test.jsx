// One dashboard: view/edit over the same live doc, with Ask Birdy beside it.
// ChatConversation is stubbed to record its props, so these cover what the
// workspace hands the chat (the brief, the live summary, the ops handler)
// without a model in the loop.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import { EDITOR_MIN_WIDTH } from "dashkit/react"
import { PageHeaderProvider, PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import { setGridWidth } from "./grid-env"
import BIRDY_V1 from "./fixtures/birdy-v1.json"
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
    // A field that keeps Escape for itself, as the composer does while its
    // slash menu is open.
    return (
      <div data-testid="chat">
        <input
          aria-label="Stub composer"
          onKeyDown={(e) => {
            if (e.key === "Escape" && e.currentTarget.value.startsWith("/")) e.preventDefault()
          }}
        />
      </div>
    )
  },
}))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: "",
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
})

const now = "2026-10-18T00:00:00.000Z"
// Stored before dashkit 0.3.0: a v1 doc (sections of spanned widgets). The
// workspace migrates it on load; every save after that stores v2.
const DOC = {
  id: "d1",
  version: 1,
  title: "Weekly spend",
  description: "Spend across every client, week by week.",
  sections: [
    {
      id: "s1",
      title: "Overview",
      widgets: [{ id: "w1", type: "text", version: 1, title: "Intro", span: { cols: 6, rows: 1 }, data: { markdown: "Hello there" } }],
    },
  ],
  meta: { createdAt: now, updatedAt: now, lastAuthor: "user" },
}
const CATALOG = {
  metrics: [{ key: "spend", label: "Spend", format: "currency", dimensions: [] }],
  dimensions: [],
  windows: [
    { preset: "last_7_days", label: "Last 7 days" },
    { preset: "last_30_days", label: "Last 30 days" },
  ],
}
// A doc with one bound widget, for the window badge.
const BOUND_DOC = {
  ...DOC,
  sections: [
    {
      id: "s1",
      title: "Overview",
      widgets: [
        {
          id: "k1",
          type: "kpi",
          version: 1,
          title: "Spend",
          span: { cols: 3, rows: 1 },
          data: { showDelta: true, emphasis: "normal" },
          bindings: { value: { metric: "spend", window: { preset: "last_30_days" } } },
        },
      ],
    },
  ],
}
let doc = DOC

// Saved docs are v2: a flat widget list, where the migrated "Overview"
// section is a heading widget (id s1). These are the widgets under it.
const bodyWidgets = (saved) => {
  expect(saved.version).toBe(2)
  expect(saved.sections).toBeUndefined()
  return saved.widgets.filter((w) => w.type !== "heading")
}

// How many upcoming PUTs should fail (a 500), to exercise the retry paths.
let failPuts = 0
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (method === "PUT" && failPuts > 0) {
    failPuts -= 1
    return Promise.resolve(res({ detail: "boom" }, 500))
  }
  if (path === "/api/dashboards/catalog") return Promise.resolve(res(CATALOG))
  if (path === "/api/dashboards/resolve") return Promise.resolve(res({ slots: [] }))
  if (path === "/api/dashboards/d1" && method === "GET") return Promise.resolve(res(doc))
  if (path === "/api/dashboards/d1" && method === "PUT") return Promise.resolve(res(JSON.parse(init.body)))
  return Promise.resolve(res({}, 404))
}

const puts = () => vi.mocked(apiRequest).mock.calls.filter(([, init]) => init?.method === "PUT")
const putBody = (call) => JSON.parse(call[1].body)
const textOp = (id, markdown) => ({ op: "addWidget", after: "w1", widget: { type: "text", id, data: { markdown } } })

async function enterEditAndAddText(user) {
  await screen.findByText("Hello there")
  await user.click(screen.getByRole("radio", { name: /Edit/ }))
  await user.click(await screen.findByRole("button", { name: "Add Text" }))
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
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
  setGridWidth(1440)
  search = ""
  doc = DOC
  failPuts = 0
  vi.mocked(toast.error).mockClear()
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
    expect(container.querySelector('[data-dk="canvas"]')).toBeNull()

    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    expect(await screen.findByRole("complementary", { name: "Widgets" })).toBeInTheDocument()
    expect(container.querySelector('[data-dk="canvas"]')).not.toBeNull()
    expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument()
  })

  it("loads a v1 doc as v2", async () => {
    doc = { ...BIRDY_V1, id: "d1" }
    const { container } = renderWorkspace()

    // The v1 section "Overview" is now a heading widget, above its widgets.
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(container.querySelector('[data-dk="heading"]')).toHaveTextContent("Overview")
    await waitFor(() => expect(chatProps.current).not.toBeNull())
    const summary = chatProps.current.getDashboardSummary()
    expect(summary).toMatch(/^# Weekly spend \(5 widgets\)/)
    expect(summary).toContain('- [sec_overview] heading "Overview" 12×1 @0,0')
    expect(summary).toContain("[w_kpi_spend] kpi")
    // 1-row v1 KPIs and strips migrate to dashkit's 3-row minimum, so their values fit.
    expect(summary).toMatch(/- \[w_kpi_strip\] kpi-strip "[^"]*" 12×3 @0,5/)
    expect(summary).toMatch(/- \[w_trend_spend\] trend "[^"]*" 6×4 @0,8/)
    expect(summary).toMatch(/- \[w_kpi_spend\] kpi "[^"]*" 3×3 @6,8/)

    // The next save stores v2.
    act(() => {
      chatProps.current.onDashboardOps(
        [{ op: "updateWidgetData", widgetId: "sec_overview", patch: { level: 1 } }],
        { dashboard_id: "d1" },
      )
    })
    await waitFor(() => expect(puts()).toHaveLength(1))
    const saved = putBody(puts()[0])
    expect(saved.version).toBe(2)
    expect(saved.sections).toBeUndefined()
    expect(saved.widgets.map((w) => w.id)).toEqual([
      "sec_overview",
      "w_spend_by_client",
      "w_kpi_strip",
      "w_trend_spend",
      "w_kpi_spend",
    ])
    expect(saved.widgets[0]).toMatchObject({ type: "heading", title: "Overview", data: { level: 1 } })
  })

  it("the narrow cutoff is dashkit's exported EDITOR_MIN_WIDTH", () => {
    expect(EDITOR_MIN_WIDTH).toBe(1024)
  })

  it("a container narrower than EDITOR_MIN_WIDTH keeps the toolbar and shows the dashboard read-only", async () => {
    setGridWidth(EDITOR_MIN_WIDTH - 1)
    const user = userEvent.setup()
    const { container } = renderWorkspace()
    await screen.findByText("Hello there")

    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    expect(await screen.findByText("Editing needs a wider window")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Dashboard title" })).toBeInTheDocument()
    expect(screen.queryByRole("complementary", { name: "Widgets" })).toBeNull()
    expect(container.querySelector('[data-dk="canvas"]')).toBeNull()
    // The read-only grid mounts once it has measured its own width.
    expect(await screen.findByText("Hello there")).toBeInTheDocument()
  })

  it("edit mode folds Ask Birdy into a rail whose button opens it as a drawer", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    const chat = screen.getByTestId("chat")
    // View mode docks the chat: no rail.
    expect(screen.queryByRole("button", { name: "Ask Birdy" })).toBeNull()

    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    const open = await screen.findByRole("button", { name: "Ask Birdy" })
    expect(open).toHaveAttribute("aria-expanded", "false")
    const drawer = document.getElementById(open.getAttribute("aria-controls"))
    expect(drawer).toHaveAttribute("data-state", "closed")
    expect(drawer).toContainElement(chat)

    await user.click(open)
    expect(open).toHaveAttribute("aria-expanded", "true")
    expect(drawer).toHaveAttribute("data-state", "open")
    expect(within(drawer).getByRole("button", { name: "Close Ask Birdy" })).toHaveFocus()
    // The same chat, never remounted, so its conversation carries over.
    expect(screen.getByTestId("chat")).toBe(chat)

    await user.click(within(drawer).getByRole("button", { name: "Close Ask Birdy" }))
    expect(open).toHaveAttribute("aria-expanded", "false")
    expect(drawer).toHaveAttribute("data-state", "closed")

    // Escape closes it too.
    await user.click(open)
    await user.keyboard("{Escape}")
    expect(drawer).toHaveAttribute("data-state", "closed")
    expect(open).toHaveFocus()

    // An Escape the chat used itself (closing its slash menu) leaves the drawer open.
    await user.click(open)
    await user.type(within(drawer).getByRole("textbox", { name: "Stub composer" }), "/")
    await user.keyboard("{Escape}")
    expect(drawer).toHaveAttribute("data-state", "open")
    await user.clear(within(drawer).getByRole("textbox", { name: "Stub composer" }))
    await user.keyboard("{Escape}")
    expect(drawer).toHaveAttribute("data-state", "closed")

    // Back in view the chat docks again, still the same one.
    await user.click(screen.getByRole("radio", { name: /View/ }))
    expect(screen.queryByRole("button", { name: "Ask Birdy" })).toBeNull()
    expect(screen.getByTestId("chat")).toBe(chat)
  })

  it("the page header carries the dashboard title; the board renders no hero", async () => {
    const { container } = renderWorkspace()
    await screen.findByText("Hello there")

    expect(container.querySelector(".dk-hero")).toBeNull()
    const crumb = screen.getByRole("link", { name: "My dashboards" })
    expect(crumb).toHaveAttribute("href", "/dashboards")
    expect(crumb.parentElement).toHaveTextContent("My dashboards / Weekly spend")
    // The migrated section title is a heading widget on the board.
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
  })

  it("a bound widget shows its window badge", async () => {
    doc = BOUND_DOC
    const { container } = renderWorkspace()

    const badge = await screen.findByText("Last 30 days · all clients")
    expect(badge.closest('[data-dk="window-badge"]')).not.toBeNull()
    expect(container.querySelector('[data-dk="frame-title"]').parentElement).toContainElement(badge)
  })

  it("edit mode composes dashkit's toolbar, palette, canvas and property panel", async () => {
    const user = userEvent.setup()
    const { container } = renderWorkspace()
    await screen.findByText("Hello there")
    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    const palette = await screen.findByRole("complementary", { name: "Widgets" })
    const root = palette.closest(".dk-root")
    expect(root).not.toBeNull()
    expect(root).toContainElement(container.querySelector('[data-dk="toolbar"]'))
    expect(root).toContainElement(container.querySelector('[data-dk="canvas"]'))
    expect(root).toContainElement(screen.getByRole("complementary", { name: "Properties" }))
    // dashkit's own palette tiles, with their icons.
    const tile = within(palette).getByRole("button", { name: "Add KPI" })
    expect(tile.querySelector("svg")).not.toBeNull()

    // The JSON view replaces the canvas, in the same editor.
    await user.click(screen.getByRole("button", { name: "JSON" }))
    expect(container.querySelector('[data-dk="canvas"]')).toBeNull()
    expect(root).toContainElement(container.querySelector('[data-dk="json"]'))
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
      expect(bodyWidgets(JSON.parse(put[1].body))).toHaveLength(2)
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
      expect(bodyWidgets(JSON.parse(put[1].body))[0].data.markdown).toBe("Rewritten by Birdy")
    })
    expect(chatProps.current.getDashboardSummary()).toContain("[w1]")
  })

  it("unmounting with unsaved edit-mode changes saves them", async () => {
    const user = userEvent.setup()
    const { unmount } = renderWorkspace()
    await enterEditAndAddText(user)
    expect(puts()).toHaveLength(0)

    unmount()

    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(bodyWidgets(putBody(puts()[0]))).toHaveLength(2)
  })

  it("warns before the tab closes while there are unsaved changes", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    const clean = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    await enterEditAndAddText(user)
    const dirty = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })

  it("a failed save can be retried from the header", async () => {
    const user = userEvent.setup()
    failPuts = 1
    renderWorkspace()
    await screen.findByText("Hello there")
    await waitFor(() => expect(chatProps.current).not.toBeNull())

    act(() => {
      chatProps.current.onDashboardOps([textOp("ai", "From Birdy")], { dashboard_id: "d1" })
    })

    expect(await screen.findByText("Save failed")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't save this dashboard",
      expect.objectContaining({ action: expect.objectContaining({ label: "Retry" }) }),
    )
    // The change is still on screen, waiting to be saved.
    expect(screen.getByText("From Birdy")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Saved")).toBeInTheDocument()
    expect(puts()).toHaveLength(2)
    expect(bodyWidgets(putBody(puts()[1])).map((w) => w.id)).toEqual(["w1", "ai"])
  })

  it("a failed toolbar save shows inline, without the page's toast", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await enterEditAndAddText(user)
    failPuts = 1

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(/^Save failed:/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("ops that arrive after the workspace unmounted are not applied", async () => {
    const { unmount } = renderWorkspace()
    await screen.findByText("Hello there")
    await waitFor(() => expect(chatProps.current).not.toBeNull())
    const onDashboardOps = chatProps.current.onDashboardOps

    unmount()
    const result = onDashboardOps([textOp("late", "Too late")], { dashboard_id: "d1" })

    expect(result.applied).toBe(false)
    expect(result.error).toBeTruthy()
    expect(puts()).toHaveLength(0)
  })

  it("ops in edit mode join the unsaved local edit and save both", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await enterEditAndAddText(user)

    let result
    act(() => {
      result = chatProps.current.onDashboardOps([textOp("ai", "From Birdy")], { dashboard_id: "d1" })
    })

    expect(result.applied).toBe(true)
    await waitFor(() => expect(puts()).toHaveLength(1))
    const widgets = bodyWidgets(putBody(puts()[0]))
    expect(widgets).toHaveLength(3)
    expect(widgets.map((w) => w.id)).toContain("ai")
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument())
  })

  it("shows an error, not a loading chat, when the dashboard can't load", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init) =>
      path === "/api/dashboards/d1" ? Promise.resolve(res({ detail: "nope" }, 404)) : mockApi(path, init),
    )
    renderWorkspace()

    expect(await screen.findByText(/Couldn.t load this dashboard/)).toBeInTheDocument()
    const aside = screen.getByRole("complementary", { name: "Ask Birdy" })
    expect(aside).toHaveTextContent(/once this dashboard loads/)
    expect(chatProps.current).toBeNull()
  })

  it("view-mode AI ops are undoable", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    await waitFor(() => expect(chatProps.current).not.toBeNull())
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()

    act(() => {
      chatProps.current.onDashboardOps(
        [{ op: "updateWidgetData", widgetId: "w1", patch: { markdown: "Rewritten by Birdy" } }],
        { dashboard_id: "d1" },
      )
    })
    expect(await screen.findByText("Rewritten by Birdy")).toBeInTheDocument()
    await waitFor(() => expect(puts()).toHaveLength(1))

    // From the chat's Undo under the reply…
    let undone
    act(() => {
      undone = chatProps.current.onUndoDashboardOps()
    })
    expect(undone).toBe(true)
    expect(await screen.findByText("Hello there")).toBeInTheDocument()
    expect(screen.queryByText("Rewritten by Birdy")).toBeNull()
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(bodyWidgets(putBody(puts()[1]))[0].data.markdown).toBe("Hello there")

    // …and Redo / Undo from the view-mode header.
    await user.click(screen.getByRole("button", { name: "Redo" }))
    expect(await screen.findByText("Rewritten by Birdy")).toBeInTheDocument()
    await waitFor(() => expect(puts()).toHaveLength(3))
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(await screen.findByText("Hello there")).toBeInTheDocument()
    await waitFor(() => expect(puts()).toHaveLength(4))
    expect(bodyWidgets(putBody(puts()[3]))[0].data.markdown).toBe("Hello there")
  })

  it("the chat's Undo does not take back the user's later edit", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await screen.findByText("Hello there")
    await waitFor(() => expect(chatProps.current).not.toBeNull())
    act(() => {
      chatProps.current.onDashboardOps([textOp("ai", "From Birdy")], { dashboard_id: "d1" })
    })
    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    await user.click(await screen.findByRole("button", { name: "Add Text" }))

    let undone
    act(() => {
      undone = chatProps.current.onUndoDashboardOps()
    })

    expect(undone).toBe(false)
    expect(screen.getByText("From Birdy")).toBeInTheDocument()
  })

  it("history survives a mode switch", async () => {
    const user = userEvent.setup()
    const { container } = renderWorkspace()
    await enterEditAndAddText(user)
    // The migrated heading plus the two text widgets.
    expect(container.querySelectorAll('[data-dk="widget"]')).toHaveLength(3)

    await user.click(screen.getByRole("radio", { name: /View/ }))
    await waitFor(() => expect(puts()).toHaveLength(1))

    // The edit made in the editor is still on the shared history.
    const undo = await screen.findByRole("button", { name: "Undo" })
    await user.click(undo)
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(bodyWidgets(putBody(puts()[1]))).toHaveLength(1)

    // Back in the editor, the toolbar can redo it.
    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    const redo = await screen.findByRole("button", { name: "Redo" })
    expect(redo).not.toBeDisabled()
    await user.click(redo)
    await waitFor(() => expect(container.querySelectorAll('[data-dk="widget"]')).toHaveLength(3))
  })
})

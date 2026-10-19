// One dashboard: view/edit over the same live doc, with Ask Birdy beside it.
// ChatConversation is stubbed to record its props, so these cover what the
// workspace hands the chat (the brief, the live summary, the ops handler)
// without a model in the loop.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
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

// The real EditorDnd, marked, so a test can check what the workspace puts inside it.
vi.mock("dashkit/react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    EditorDnd: ({ children }) => (
      <div data-testid="editor-dnd" style={{ display: "contents" }}>
        <actual.EditorDnd>{children}</actual.EditorDnd>
      </div>
    ),
  }
})

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
const DOC = {
  id: "d1",
  version: 1,
  title: "Weekly spend",
  description: "Spend across every client, week by week.",
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
const textOp = (id, markdown) => ({ op: "addWidget", sectionId: "s1", widget: { type: "text", id, data: { markdown } } })

async function enterEditAndAddText(user) {
  await screen.findByText("Hello there")
  await user.click(screen.getByRole("radio", { name: /Edit/ }))
  await user.click(await screen.findByRole("button", { name: "Add Text" }))
  expect(screen.getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument()
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
    expect(container.querySelector(".dk-editor")).toBeNull()

    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    expect(await screen.findByRole("complementary", { name: "Widgets" })).toBeInTheDocument()
    expect(container.querySelector(".dk-editor")).not.toBeNull()
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

  it("hero renders the dashboard title and description", async () => {
    const { container } = renderWorkspace()
    await screen.findByText("Hello there")

    const hero = container.querySelector(".dk-hero")
    expect(hero).not.toBeNull()
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent("Weekly spend")
    expect(within(hero).getByText("Spend across every client, week by week.")).toBeInTheDocument()

    // The top bar is a breadcrumb back to the list; the hero carries the big title.
    const crumb = screen.getByRole("link", { name: "My dashboards" })
    expect(crumb).toHaveAttribute("href", "/dashboards")
    expect(crumb.parentElement).toHaveTextContent("My dashboards / Weekly spend")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  it("a bound widget shows its window badge", async () => {
    doc = BOUND_DOC
    const { container } = renderWorkspace()

    const badge = await screen.findByText("Last 30 days · all clients")
    expect(badge).toHaveClass("dk-frame-meta")
    expect(container.querySelector(".dk-frame-titlerow")).toContainElement(badge)
  })

  it("palette and canvas are inside one EditorDnd", async () => {
    const user = userEvent.setup()
    const { container } = renderWorkspace()
    await screen.findByText("Hello there")
    await user.click(screen.getByRole("radio", { name: /Edit/ }))

    const palette = await screen.findByRole("complementary", { name: "Widgets" })
    const scopes = screen.getAllByTestId("editor-dnd")
    expect(scopes).toHaveLength(1)
    expect(scopes[0]).toContainElement(palette)
    expect(scopes[0]).toContainElement(container.querySelector(".dk-canvas"))
    // The palette's tiles are pd buttons with their icons.
    const tile = within(palette).getByRole("button", { name: "Add KPI" })
    expect(tile).toHaveClass("dk-button", "dk-palette-item")
    expect(tile.querySelector("svg")).not.toBeNull()

    // The JSON view sits in the same scope.
    await user.click(screen.getByRole("button", { name: "JSON" }))
    expect(screen.getAllByTestId("editor-dnd")).toHaveLength(1)
    expect(screen.getByTestId("editor-dnd")).toContainElement(container.querySelector(".dk-json"))
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

  it("unmounting with unsaved edit-mode changes saves them", async () => {
    const user = userEvent.setup()
    const { unmount } = renderWorkspace()
    await enterEditAndAddText(user)
    expect(puts()).toHaveLength(0)

    unmount()

    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(putBody(puts()[0]).sections[0].widgets).toHaveLength(2)
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
    expect(putBody(puts()[1]).sections[0].widgets.map((w) => w.id)).toEqual(["w1", "ai"])
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
    const widgets = putBody(puts()[0]).sections[0].widgets
    expect(widgets).toHaveLength(3)
    expect(widgets.map((w) => w.id)).toContain("ai")
    await waitFor(() => expect(screen.queryByRole("img", { name: "Unsaved changes" })).not.toBeInTheDocument())
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
    expect(putBody(puts()[1]).sections[0].widgets[0].data.markdown).toBe("Hello there")

    // …and Redo / Undo from the view-mode header.
    await user.click(screen.getByRole("button", { name: "Redo" }))
    expect(await screen.findByText("Rewritten by Birdy")).toBeInTheDocument()
    await waitFor(() => expect(puts()).toHaveLength(3))
    await user.click(screen.getByRole("button", { name: "Undo" }))
    expect(await screen.findByText("Hello there")).toBeInTheDocument()
    await waitFor(() => expect(puts()).toHaveLength(4))
    expect(putBody(puts()[3]).sections[0].widgets[0].data.markdown).toBe("Hello there")
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
    expect(container.querySelectorAll(".dk-widget")).toHaveLength(2)

    await user.click(screen.getByRole("radio", { name: /View/ }))
    await waitFor(() => expect(puts()).toHaveLength(1))

    // The edit made in the editor is still on the shared history.
    const undo = await screen.findByRole("button", { name: "Undo" })
    await user.click(undo)
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(putBody(puts()[1]).sections[0].widgets).toHaveLength(1)

    // Back in the editor, the toolbar can redo it.
    await user.click(screen.getByRole("radio", { name: /Edit/ }))
    const redo = await screen.findByRole("button", { name: "Redo" })
    expect(redo).not.toBeDisabled()
    await user.click(redo)
    await waitFor(() => expect(container.querySelectorAll(".dk-widget")).toHaveLength(2))
  })
})

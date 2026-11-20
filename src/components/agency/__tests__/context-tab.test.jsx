import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { ContextTab } from "../context-tab"

const push = vi.fn()
const route = { search: "" }
const ctx = { state: null }
const subs = { state: null }
const api = { saveCard: vi.fn(), addNote: vi.fn(), changeNote: vi.fn(), removeNote: vi.fn() }
const subApi = { pause: vi.fn(), del: vi.fn(), approve: vi.fn(), run: vi.fn() }
const lessons = { state: null, add: vi.fn(), change: vi.fn(), remove: vi.fn(), calls: [] }
const runs = { state: null }
const tools = { state: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/media-buyer/context", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0 }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn(), updateProposal: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [{ id: "g0", name: "Aura", client_status: "Active", health: "Critical" }], loading: false }) }))
vi.mock("@/lib/team-lessons", async (orig) => ({
  ...(await orig()),
  useTeamLessons: (agent, clientId) => { lessons.calls.push([agent, clientId]); return lessons.state },
  addLesson: (...a) => lessons.add(...a),
  changeLesson: (...a) => lessons.change(...a),
  removeLesson: (...a) => lessons.remove(...a),
}))
vi.mock("@/lib/context-api", async (orig) => ({
  ...(await orig()),
  useContext: () => ctx.state,
  saveCard: (...a) => api.saveCard(...a),
  addNote: (...a) => api.addNote(...a),
}))
vi.mock("@/lib/sub-agents", async (orig) => ({
  ...(await orig()),
  useSubAgents: () => subs.state,
  pauseSubAgent: (...a) => subApi.pause(...a),
  deleteSubAgent: (...a) => subApi.del(...a),
  approveSubAgent: (...a) => subApi.approve(...a),
  runSubAgent: (...a) => subApi.run(...a),
  useSubAgentRuns: () => runs.state,
  useSubAgentTools: () => tools.state,
}))

const item = (id, text, o = {}) => ({ id, text, source: "owner", editable: true, updated_at: null, ...o })
const CONTEXT = {
  cards: [
    { key: "agency", title: "Agency", used_when: "it writes to you", items: [item("a1", "Clinics only"), item("derived:n", "5 active clients", { source: "derived", editable: false })] },
    { key: "targets", title: "Targets", used_when: "it judges a client", items: [item("t1", "CPL limit £6")] },
  ],
  client: null,
  notes: [{ id: "n1", text: "No changes at weekends", client_group_id: null, client_name: null, created_at: "2026-11-02T09:00:00Z", author: "Hadley" }],
}
const sub = (o) => ({ id: "s1", parent: "media_buyer", kind: "specialist", name: "Form checker", purpose: "Flags form changes", instructions: "", tools: [{ name: "a", label: "Lead form history" }], clients: "all", schedule: null, status: "active", created_at: null, last_run_at: null, ...o })
const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  ctx.state = { context: CONTEXT, unavailable: false, error: null, isLoading: false, mutate }
  subs.state = { subAgents: [sub()], unavailable: false, error: null, isLoading: false, mutate }
  lessons.state = { lessons: [{ id: "l1", text: "Don't remove young ads", client_group_id: null, client_name: null, source: "chat", created_at: "2026-11-02T09:00:00Z", updated_at: "2026-11-02T09:00:00Z" }], unavailable: false, error: null, isLoading: false, mutate }
  lessons.calls = []
  lessons.add.mockResolvedValue({})
  lessons.change.mockResolvedValue({})
  lessons.remove.mockResolvedValue({})
  runs.state = { runs: [], unavailable: false, error: null, isLoading: false, mutate }
  tools.state = { tools: [], unavailable: false, error: null, isLoading: false }
  api.saveCard.mockResolvedValue()
  api.addNote.mockResolvedValue({})
  subApi.pause.mockResolvedValue({})
  subApi.del.mockResolvedValue({ deleted: true })
})

describe("a section's Context page", () => {
  it("shows what the section knows, with when Birdy uses each card, under the Context page of More", () => {
    render(<ContextTab section="buyer" />)
    expect(screen.getByRole("heading", { level: 2, name: "What Media Buyer knows" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("Clinics only")).toBeInTheDocument()
    expect(screen.getByText("From your data")).toBeInTheDocument()
    expect(screen.getByText("Birdy uses this when it judges a client.")).toBeInTheDocument()
    expect(screen.getByText("No changes at weekends")).toBeInTheDocument()
    expect(screen.getByText("Don't remove young ads")).toBeInTheDocument()
  })

  it("edits a card in place and saves only what changed, never a line Birdy works out", async () => {
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "Edit Agency" }))
    const line = screen.getByRole("textbox", { name: "Agency, line 1" })
    await userEvent.clear(line)
    await userEvent.type(line, "Aesthetics clinics")
    await userEvent.click(screen.getByRole("button", { name: "Add a line" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Agency, line 2" }), "UK only")
    expect(screen.queryByRole("textbox", { name: /5 active/ })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(api.saveCard).toHaveBeenCalledWith({ card: "agency", clientId: null, changes: { add: ["UK only"], change: [{ id: "a1", text: "Aesthetics clinics" }], remove: [] } })
  })

  it("adds a note", async () => {
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "Add context" }))
    await userEvent.type(screen.getByRole("textbox", { name: "A note for Birdy" }), "Budget freeze in December")
    await userEvent.click(screen.getByRole("button", { name: "Add note" }))
    expect(api.addNote).toHaveBeenCalledWith({ text: "Budget freeze in December", clientId: null })
  })

  it("inside a client puts its own card and notes first", () => {
    route.search = "client=g0"
    ctx.state = { ...ctx.state, context: { ...CONTEXT, client: { id: "g0", name: "Aura", used_when: "", items: [item("c1", "CPL limit £5")] }, notes: [{ id: "n2", text: "Owner away", client_group_id: "g0", client_name: "Aura", created_at: null }, ...CONTEXT.notes] } }
    render(<ContextTab section="buyer" />)
    expect(screen.getByRole("heading", { level: 3, name: "Aura" })).toBeInTheDocument()
    expect(screen.getByText("Your agency")).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Notes about Aura" })).getByText("Owner away")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add a note" })).toBeInTheDocument()
    // Lessons are read with the client, and its own come under its name.
    expect(lessons.calls.at(-1)).toEqual(["media_buyer", "g0"])
    expect(within(screen.getByRole("region", { name: "Lessons" })).getByText("For Aura")).toBeInTheDocument()
  })

  it("says plainly when the server has no Context yet, and still lists the sub-agents", () => {
    ctx.state = { context: null, unavailable: true, error: null, isLoading: false, mutate }
    render(<ContextTab section="coach" />)
    expect(screen.getByText("Context is not available yet")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Sub-agents" })).toBeInTheDocument()
  })

  it("has no sub-agents or lessons in Agency Ops", () => {
    render(<ContextTab section="ops" />)
    expect(screen.queryByRole("region", { name: "Sub-agents" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Lessons" })).toBeNull()
  })
})

describe("the Sub-agents card", () => {
  it("says sub-agents come from asking the section's agent in Chat when there are none", () => {
    subs.state = { ...subs.state, subAgents: [] }
    render(<ContextTab section="coach" />)
    const card = screen.getByRole("region", { name: "Sub-agents" })
    expect(card).toHaveTextContent("Sales Coach has no sub-agents yet")
    expect(within(card).getByRole("link", { name: "Ask Sales Coach" })).toHaveAttribute("href", "/sales-coach/chat")
  })

  it("puts a waiting proposal first, flags it at the top, and approves it", async () => {
    subs.state = { ...subs.state, subAgents: [sub({ id: "w", name: "Fatigue watcher", status: "proposed" }), sub()] }
    subApi.approve.mockResolvedValue({})
    render(<ContextTab section="buyer" />)
    expect(screen.getByText("1 sub-agent is waiting for your approval.")).toBeInTheDocument()
    const rows = within(screen.getByRole("list", { name: "Media Buyer’s sub-agents" })).getAllByRole("listitem")
    expect(rows[0]).toHaveTextContent("Fatigue watcher")
    expect(rows[0]).toHaveTextContent("Waiting for you")
    await userEvent.click(screen.getByRole("button", { name: "Approve Fatigue watcher" }))
    expect(subApi.approve).toHaveBeenCalledWith("w")
  })

  it("asks before deleting and offers to pause instead", async () => {
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "More for Form checker" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = screen.getByRole("dialog", { name: "Delete Form checker?" })
    expect(dialog).toHaveTextContent("lessons and its schedule")
    await userEvent.click(within(dialog).getByRole("button", { name: "Pause instead" }))
    expect(subApi.pause).toHaveBeenCalledWith("s1")
    expect(subApi.del).not.toHaveBeenCalled()
  })

  it("shows a rules agent with a link to its own page instead of edit actions", () => {
    subs.state = { ...subs.state, subAgents: [sub({ id: "c9", kind: "custom", name: "CPL guard" })] }
    render(<ContextTab section="buyer" />)
    expect(screen.getByRole("link", { name: /Manage on its page/ })).toHaveAttribute("href", "/hub/agents/custom/c9")
    expect(screen.queryByRole("button", { name: "Delete CPL guard" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Edit CPL guard" })).toBeNull()
  })

  it("says plainly when sub-agents are not available yet", () => {
    subs.state = { subAgents: [], unavailable: true, error: null, isLoading: false, mutate }
    render(<ContextTab section="buyer" />)
    expect(screen.getByRole("region", { name: "Sub-agents" })).toHaveTextContent("Sub-agents are not available yet")
  })
})

describe("a sub-agent's runs", () => {
  const RUN = { id: "r1", status: "done", trigger: "manual", started_at: "2026-11-20T08:00:00Z", finished_at: "2026-11-20T08:00:42Z", summary: "2 forms changed", answer: "Aura and Beaulea changed their lead forms this week.", credits: 4, proposals: [] }

  it("shows the last run on the row, with how it went and what it cost", () => {
    subs.state = { ...subs.state, subAgents: [sub({ last_run: { status: "timeout", at: "2026-11-20T08:00:00Z", summary: "Stopped at 100 seconds", credits: 3 } })] }
    render(<ContextTab section="buyer" />)
    const row = within(screen.getByRole("list", { name: "Media Buyer’s sub-agents" })).getAllByRole("listitem")[0]
    expect(row).toHaveTextContent("Ran out of time")
    expect(row).toHaveTextContent("Stopped at 100 seconds")
    expect(row).toHaveTextContent("3 credits")
  })

  it("says when it has not run yet", () => {
    render(<ContextTab section="buyer" />)
    expect(screen.getByText("Not run yet")).toBeInTheDocument()
  })

  it("asks before running now, says it uses credits, then shows the result", async () => {
    subApi.run.mockResolvedValue(RUN)
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "More for Form checker" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Run now" }))
    const dialog = screen.getByRole("dialog", { name: "Run Form checker now?" })
    expect(dialog).toHaveTextContent("uses Birdy Credits")
    expect(subApi.run).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Run now" }))
    expect(subApi.run).toHaveBeenCalledWith("s1")
    expect(await screen.findByText("2 forms changed")).toBeInTheDocument()
    expect(screen.getByText("Aura and Beaulea changed their lead forms this week.")).toBeInTheDocument()
    expect(screen.getByText(/Took 42s · 4 credits/)).toBeInTheDocument()
  })

  it("says plainly when running by hand is not there yet", async () => {
    subApi.run.mockRejectedValue(Object.assign(new Error("x"), { status: 404 }))
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "More for Form checker" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Run now" }))
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run now" }))
    expect(await screen.findByText("Running a sub-agent by hand is not available yet.")).toBeInTheDocument()
  })

  it("offers no Run now for a paused one", async () => {
    subs.state = { ...subs.state, subAgents: [sub({ status: "paused" })] }
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "More for Form checker" }))
    expect(await screen.findByRole("menuitem", { name: "See its runs" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Run now" })).toBeNull()
  })

  it("lists its runs in a table, and a row opens to its answer", async () => {
    runs.state = { ...runs.state, runs: [RUN, { ...RUN, id: "r2", status: "error", summary: "Could not read the forms", answer: "" }] }
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "More for Form checker" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "See its runs" }))
    const table = within(screen.getByRole("dialog", { name: "Form checker’s runs" })).getByRole("table", { name: "Form checker’s runs" })
    expect(within(table).getAllByRole("row")).toHaveLength(3)
    expect(table).toHaveTextContent("Failed")
    await userEvent.click(within(table).getByText("2 forms changed"))
    expect(within(table).getByText("Aura and Beaulea changed their lead forms this week.")).toBeInTheDocument()
  })
})

describe("editing a sub-agent's tools", () => {
  it("offers every tool its main agent can hand out, and sends the added one", async () => {
    tools.state = { ...tools.state, tools: [{ name: "a", label: "Lead form history" }, { name: "b", label: "Ad figures" }] }
    const change = vi.fn().mockResolvedValue({})
    const ctx2 = await import("@/lib/context-api")
    vi.spyOn(ctx2, "request").mockImplementation((url, method, body) => change(url, method, body))
    render(<ContextTab section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "Edit Form checker" }))
    const dialog = screen.getByRole("dialog", { name: "Edit Form checker" })
    expect(within(dialog).getByText("Lead form history")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Ad figures/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    expect(change).toHaveBeenCalledWith("/api/agents/sub/s1", "PATCH", { tools: ["a", "b"] })
  })
})

describe("lessons on Context", () => {
  it("lists Sales Coach's own lessons too", () => {
    render(<ContextTab section="coach" />)
    expect(lessons.calls.at(-1)).toEqual(["sales_coach", null])
    expect(within(screen.getByRole("region", { name: "Lessons" })).getByText("Don't remove young ads")).toBeInTheDocument()
  })

  it("adds a lesson for the whole agency", async () => {
    render(<ContextTab section="buyer" />)
    const card = screen.getByRole("region", { name: "Lessons" })
    await userEvent.click(within(card).getByRole("button", { name: "Add a lesson" }))
    await userEvent.type(within(card).getByRole("textbox", { name: "A lesson for Media Buyer" }), "Never pause an ad in its first 3 days")
    await userEvent.click(within(card).getByRole("button", { name: "Add lesson" }))
    expect(lessons.add).toHaveBeenCalledWith("media_buyer", { text: "Never pause an ad in its first 3 days", clientId: null })
  })

  it("edits and deletes a lesson in place", async () => {
    render(<ContextTab section="coach" />)
    const card = screen.getByRole("region", { name: "Lessons" })
    await userEvent.click(within(card).getByRole("button", { name: "Edit the lesson: Don't remove young ads" }))
    const box = within(card).getByRole("textbox", { name: "Edit the lesson" })
    await userEvent.clear(box)
    await userEvent.type(box, "Keep young ads for a week")
    await userEvent.click(within(card).getByRole("button", { name: "Save" }))
    expect(lessons.change).toHaveBeenCalledWith("sales_coach", "l1", "Keep young ads for a week")
    await userEvent.click(within(card).getByRole("button", { name: "Edit the lesson: Don't remove young ads" }))
    await userEvent.click(within(card).getByRole("button", { name: "Delete" }))
    expect(lessons.remove).toHaveBeenCalledWith("sales_coach", "l1")
  })

  it("shows the server's reason when a save is refused", async () => {
    lessons.add.mockRejectedValue(Object.assign(new Error("x"), { status: 400, detail: "A lesson can be at most 500 characters." }))
    render(<ContextTab section="buyer" />)
    const card = screen.getByRole("region", { name: "Lessons" })
    await userEvent.click(within(card).getByRole("button", { name: "Add a lesson" }))
    await userEvent.type(within(card).getByRole("textbox", { name: "A lesson for Media Buyer" }), "x")
    await userEvent.click(within(card).getByRole("button", { name: "Add lesson" }))
    expect(await within(card).findByText("A lesson can be at most 500 characters.")).toBeInTheDocument()
  })

  it("says plainly when lessons are not there yet", () => {
    lessons.state = { lessons: [], unavailable: true, error: null, isLoading: false, mutate }
    render(<ContextTab section="buyer" />)
    expect(screen.getByRole("region", { name: "Lessons" })).toHaveTextContent("Lessons are not available yet")
  })
})

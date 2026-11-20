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
const subApi = { pause: vi.fn(), del: vi.fn(), approve: vi.fn() }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/media-buyer/context", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0 }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn(), updateProposal: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [{ id: "g0", name: "Aura", client_status: "Active", health: "Critical" }], loading: false }) }))
vi.mock("@/lib/stock-agent-api", async (orig) => ({ ...(await orig()), useStockAgent: () => ({ agent: { id: "stock1" }, isLoading: false }), useLessons: () => ({ lessons: [{ id: "l1", text: "Don't remove young ads", uses: 2, source: "chat", status: "active" }], isLoading: false, mutate: vi.fn() }) }))
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
    // Lessons are agency-wide, as in the reference.
    expect(screen.queryByText("Lessons from chat")).toBeNull()
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
    expect(screen.queryByText("Lessons from chat")).toBeNull()
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
    await userEvent.click(screen.getByRole("button", { name: "Delete Form checker" }))
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

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SuggestionsTab } from "../suggestions-tab"

const push = vi.fn()
const route = { search: "" }
const sendChatMessage = vi.fn()
const sugg = { state: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard/suggestions", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestions: () => sugg.state, useSuggestionCount: () => sugg.state.suggestions.length }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: (...a) => sendChatMessage(...a), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
const pending = { agents: [] }
vi.mock("@/components/agency/pending-proposals", () => ({ PendingProposals: ({ agent, clientId }) => { pending.agents.push([agent, clientId]); return <section aria-label="Waiting for your approval" /> } }))
vi.mock("@/lib/proposals-api", async (orig) => ({ ...(await orig()), usePendingProposals: () => ({ proposals: [], unavailable: false, error: null, isLoading: false, mutate: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [{ id: "a", name: "Aura", client_status: "Active", health: "Critical" }] }) }))

const S = (id, title, client, tone = "warning") => ({ id, title, client, tone, why: `${title} because`, agentId: null })
const state = (over = {}) => ({
  suggestions: [S("1", "Pause Body Sculpting", "Aura", "danger"), S("2", "Refresh the creative", "Fallon Physique")],
  history: [{ id: "h1", what: "Synced Meta", client: "All clients", mode: "Auto-run", when: "12 min ago" }, { id: "h2", what: "Turned on an ad", client: "Aura", mode: "Approved", when: "Yesterday" }],
  loading: false, error: null, busy: null, refresh: vi.fn(), apply: vi.fn(), dismiss: vi.fn(),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  sugg.state = state()
})

describe("Birdy's Suggestions tab", () => {
  it("lists what is suggested with its client and reason, and counts them on the tab", () => {
    render(<SuggestionsTab />)
    expect(screen.getByRole("tab", { name: /^Suggestions/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /^Suggestions/ })).toHaveTextContent("Suggestions2")
    expect(screen.getByRole("heading", { level: 2, name: "2 suggestions across your agency" })).toBeInTheDocument()
    const rows = within(screen.getByRole("region", { name: "2 suggestions across your agency" })).getAllByRole("listitem")
    expect(rows[0]).toHaveTextContent("Pause Body Sculpting")
    expect(rows[0]).toHaveTextContent("Aura")
    expect(rows[0]).toHaveTextContent("Pause Body Sculpting because")
  })

  it("does one for me and dismisses another", async () => {
    render(<SuggestionsTab />)
    await userEvent.click(screen.getByRole("button", { name: "Do it for me: Pause Body Sculpting" }))
    expect(sugg.state.apply).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }))
    await userEvent.click(screen.getByRole("button", { name: "Dismiss: Refresh the creative" }))
    expect(sugg.state.dismiss).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }))
  })

  it("holds every button while one action is running", () => {
    sugg.state = state({ busy: "1" })
    render(<SuggestionsTab />)
    expect(screen.getByRole("button", { name: "Dismiss: Refresh the creative" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Do it for me: Refresh the creative" })).toBeDisabled()
  })

  it("shows what was done, and by whom", () => {
    render(<SuggestionsTab />)
    const history = within(screen.getByRole("complementary", { name: "History" })).getAllByRole("listitem")
    expect(history.map((li) => li.textContent)).toEqual(["Synced MetaAll clientsAuto-run12 min ago", "Turned on an adAuraApprovedYesterday"])
  })

  it("marks a dismissed suggestion as dismissed in the history", () => {
    sugg.state = state({ history: [{ id: "d1", what: "Refresh the creative", client: "Fallon Physique", mode: "Dismissed", when: "just now" }] })
    render(<SuggestionsTab />)
    expect(within(screen.getByRole("complementary", { name: "History" })).getByRole("listitem")).toHaveTextContent("Refresh the creativeFallon PhysiqueDismissed")
  })

  it("narrows to one client", () => {
    route.search = "client=a"
    render(<SuggestionsTab />)
    expect(screen.getByRole("heading", { level: 2, name: "1 suggestion for Aura" })).toBeInTheDocument()
    expect(screen.queryByText("Refresh the creative")).not.toBeInTheDocument()
    expect(within(screen.getByRole("complementary", { name: "History" })).getAllByRole("listitem")).toHaveLength(1)
  })

  it("says so when there is nothing to suggest, while loading, and on failure", async () => {
    sugg.state = state({ suggestions: [], history: [] })
    const none = render(<SuggestionsTab />)
    expect(screen.getByRole("heading", { level: 2, name: "All looking good" })).toBeInTheDocument()
    expect(screen.getByText("Nothing done yet.")).toBeInTheDocument()
    none.unmount()
    sugg.state = state({ loading: true, suggestions: [] })
    const loading = render(<SuggestionsTab />)
    expect(screen.getByLabelText("Loading suggestions")).toBeInTheDocument()
    loading.unmount()
    sugg.state = state({ error: new Error("HTTP 500"), suggestions: [] })
    render(<SuggestionsTab />)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load suggestions.")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(sugg.state.refresh).toHaveBeenCalled()
  })

  it("opens the conversation beside the page when a question is asked", async () => {
    render(<SuggestionsTab />)
    await userEvent.type(screen.getByRole("textbox", { name: "Ask Birdy about these suggestions" }), "Which first?{Enter}")
    expect(sendChatMessage).toHaveBeenCalledWith("by_ops_ask_sugg_agency", expect.objectContaining({ text: "Which first?", page: "dashboard" }), expect.any(Object))
    expect(screen.getByRole("complementary", { name: "Birdy conversation" })).toBeInTheDocument()
  })
})

describe("Media Buyer's and Sales Coach's Suggestions tab", () => {
  it("lists Media Buyer's own suggestions, says whose they are, and keeps the history", () => {
    sugg.state = state({ suggestions: [{ ...S("1", "Pause Body Sculpting", "Aura"), platform: "Meta Ads" }, { ...S("2", "Call back the missed leads", "Aura"), platform: "Hot Prospector" }] })
    render(<SuggestionsTab section="buyer" />)
    expect(screen.getByRole("heading", { level: 2, name: "1 suggestion from Media Buyer" })).toBeInTheDocument()
    expect(screen.queryByText("Call back the missed leads")).not.toBeInTheDocument()
    expect(screen.getByRole("complementary", { name: "History" })).toBeInTheDocument()
  })

  it("gives Sales Coach only call suggestions, and no history of ad changes", () => {
    render(<SuggestionsTab section="coach" />)
    expect(screen.queryByText("Pause Body Sculpting")).not.toBeInTheDocument()
    expect(screen.getByText(/Sales Coach has no suggestions yet/)).toBeInTheDocument()
    expect(screen.queryByRole("complementary", { name: "History" })).not.toBeInTheDocument()
  })

  it("puts what waits for approval first in Media Buyer's and Sales Coach's, not in Birdy's", () => {
    pending.agents = []
    const { unmount } = render(<SuggestionsTab />)
    expect(screen.queryByRole("region", { name: "Waiting for your approval" })).toBeNull()
    unmount()
    route.search = "client=a"
    render(<SuggestionsTab section="coach" />)
    expect(screen.getByRole("region", { name: "Waiting for your approval" })).toBeInTheDocument()
    expect(pending.agents.at(-1)).toEqual(["sales_coach", "a"])
  })

  it("moves between Sales Coach's own tabs", async () => {
    render(<SuggestionsTab section="coach" />)
    await userEvent.click(screen.getByRole("tab", { name: /^Dashboard/ }))
    expect(push).toHaveBeenCalledWith("/sales-coach/table")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { AgencyChat } from "../chat/agency-chat"

const push = vi.fn()
const route = { search: "" }
const apiRequest = vi.fn()
const chatStore = { state: null }
const sendChatMessage = vi.fn()
const resetChat = vi.fn(() => { chatStore.state = { messages: [], loading: false, sessionId: null, submittedUIs: [] } })
const hydrateChat = vi.fn((key, { sessionId, messages }) => { chatStore.state = { messages, loading: false, sessionId, submittedUIs: [] } })

vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 5 }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard/chat", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/lib/chat-store", () => ({
  useChat: () => chatStore.state, sendChatMessage: (...a) => sendChatMessage(...a), markUISubmitted: vi.fn(),
  resetChat: (...a) => resetChat(...a), hydrateChat: (...a) => hydrateChat(...a),
}))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [{ id: "a", name: "Aura", client_status: "Active", health: "Critical" }] }) }))
vi.mock("@/components/shell/account-menu", () => ({ useStoredUser: () => ({ name: "Hadley Stone" }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const LIST = [
  { session_id: "s1", title: "Which call centre is furthest behind?", scope: "client", client_name: "Beaulea Clinic", updated_at: new Date().toISOString() },
  { session_id: "s2", title: "Best creatives this month", scope: "global", updated_at: new Date(Date.now() - 40 * 864e5).toISOString() },
]

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  chatStore.state = { messages: [], loading: false, sessionId: null, submittedUIs: [] }
  apiRequest.mockImplementation((url, opts) => {
    if (opts?.method === "DELETE") return ok({})
    if (url === "/api/chat/conversations") return ok({ conversations: LIST })
    return ok({ messages: [{ role: "user", content: "Which call centre is furthest behind?" }, { role: "assistant", content: "Beaulea Clinic." }] })
  })
})

describe("Agency Ops chat", () => {
  it("opens on a new chat with a greeting, starters and the saved conversations in groups", async () => {
    render(<AgencyChat />)
    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("heading", { level: 3, name: /^Good (morning|afternoon|evening), Hadley\.$|^Hello, Hadley\.$/ })).toBeInTheDocument()
    const list = screen.getByRole("navigation", { name: "Conversations" })
    expect(await within(list).findByRole("region", { name: "Today" })).toHaveTextContent("Which call centre is furthest behind?")
    expect(within(list).getByRole("region", { name: "Earlier" })).toHaveTextContent("Best creatives this month")
    expect(within(list).getByText(/^Beaulea Clinic · /)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Summarise the week" }))
    expect(sendChatMessage).toHaveBeenCalledTimes(1)
  })

  it("sends what is typed, about the whole agency", async () => {
    render(<AgencyChat />)
    await userEvent.type(screen.getByRole("textbox", { name: "Message Agency Ops" }), "Why did closes drop?{Enter}")
    expect(sendChatMessage).toHaveBeenCalledWith("by_ops_chat", expect.objectContaining({ text: "Why did closes drop?", clientGroupId: null }), expect.any(Object))
  })

  it("opens a saved conversation and marks it", async () => {
    const view = render(<AgencyChat />)
    await userEvent.click(await screen.findByRole("button", { name: /^Which call centre/ }))
    await waitFor(() => expect(hydrateChat).toHaveBeenCalledWith("by_ops_chat", expect.objectContaining({ sessionId: "s1" })))
    view.rerender(<AgencyChat />)
    expect(screen.getByText("Beaulea Clinic.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Which call centre/ })).toHaveAttribute("aria-current", "true")
  })

  it("opens the conversation named in the address", async () => {
    route.search = "c=s1"
    render(<AgencyChat />)
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/chat/conversations/s1"))
  })

  it("deletes a conversation from the list", async () => {
    render(<AgencyChat />)
    await userEvent.click(await screen.findByRole("button", { name: "Delete conversation: Best creatives this month" }))
    expect(apiRequest).toHaveBeenCalledWith("/api/chat/conversations/s2", { method: "DELETE" })
    await waitFor(() => expect(screen.queryByText("Best creatives this month")).not.toBeInTheDocument())
  })

  it("starts over with New chat, and goes back to Bird's Eye keeping the client", async () => {
    route.search = "client=a"
    render(<AgencyChat />)
    expect(screen.getByText("Aura", { selector: "b" }).parentElement).toHaveTextContent("Scoped to Aura · At risk")
    resetChat.mockClear()
    await userEvent.click(screen.getByRole("button", { name: "New chat" }))
    expect(resetChat).toHaveBeenCalledWith("by_ops_chat")
    await userEvent.click(screen.getByRole("tab", { name: "Bird's Eye" }))
    expect(push).toHaveBeenCalledWith("/dashboard?client=a")
  })

  it("says so when the saved conversations cannot be loaded, and retries", async () => {
    apiRequest.mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))
    render(<AgencyChat />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load your conversations.")
    apiRequest.mockImplementation(() => ok({ conversations: LIST }))
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Best creatives this month")).toBeInTheDocument()
  })
})

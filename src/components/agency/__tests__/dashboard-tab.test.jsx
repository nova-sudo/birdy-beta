import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { DashboardTab } from "../dashboard-tab"

const push = vi.fn()
const sendChatMessage = vi.fn()
const list = { props: null }

vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 5 }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard/table", useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: (...a) => sendChatMessage(...a), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
// The table itself is covered by the Clients list's own tests; here it only has to be the same one.
vi.mock("@/components/clients/list/clients-list", () => ({
  ClientsList: (props) => {
    list.props = props
    return <div>{props.header({ dateMenu: <button type="button">Date range</button> })}<p>the clients table</p>{props.footer}</div>
  },
}))

beforeEach(() => vi.clearAllMocks())

describe("Agency Ops' Dashboard tab", () => {
  it("is the Clients table under the Agency Ops header, with the date range and the ask bar", () => {
    render(<DashboardTab />)
    expect(list.props.viewKey).toBe("clients")
    // The same centred column as Bird's Eye.
    expect(list.props.column).toBe(true)
    expect(screen.getByRole("heading", { level: 1, name: "Agency Ops" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("the clients table")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Date range" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /Ask Agency Ops/ })).toBeInTheDocument()
  })

  it("opens the conversation beside the table when a question is sent", async () => {
    render(<DashboardTab />)
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox", { name: /Ask Agency Ops/ }), "Who is over their limit?{Enter}")
    expect(sendChatMessage).toHaveBeenCalledWith("by_ops_ask_table", expect.objectContaining({ text: "Who is over their limit?", page: "dashboard" }), expect.any(Object))
    expect(screen.getByRole("complementary", { name: "Agency Ops conversation" })).toBeInTheDocument()
  })

  it("goes to the other tabs", async () => {
    render(<DashboardTab />)
    await userEvent.click(within(screen.getByRole("tablist", { name: "Agency Ops views" })).getByRole("tab", { name: "Bird's Eye" }))
    expect(push).toHaveBeenCalledWith("/dashboard")
  })
})

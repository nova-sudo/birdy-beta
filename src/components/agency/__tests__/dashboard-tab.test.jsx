import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { DashboardTab } from "../dashboard-tab"

const push = vi.fn()
const sendChatMessage = vi.fn()
const list = { props: null }

vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 5 }))
const route = { search: "" }
const replace = vi.fn()
const hubs = { leads: null, ads: null, calls: null }
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/dashboard/table", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/client-tables", () => ({
  LeadsTable: (p) => { hubs.leads = p; return <p>the leads table</p> },
  AdsTable: (p) => { hubs.ads = p; return <p>the ads table</p> },
  CallsTable: (p) => { hubs.calls = p; return <p>the calls table</p> },
}))
const tables = { client: null, preset: null }
vi.mock("@/components/agency/use-client-tables", () => ({ useClientTables: (client, preset) => { Object.assign(tables, { client, preset }); return { leads: { rows: [{}, {}], total: 34 }, ads: { rows: [{}, {}] }, calls: { rows: [{}, {}, {}] } } } }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => ({ clientGroups: [{ id: "a", name: "Aura", client_status: "Active", health: "Critical", targets: { cpl: 6 }, call_log_provider: "hotprospector" }, { id: "b", name: "Beaulea Clinic", client_status: "Active" }], loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(), invalidate: vi.fn() }) }))
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

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
})

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

describe("the Dashboard tab inside one client", () => {
  it("opens on the client's Leads table, with Ads and Calls beside it and how many each holds", () => {
    route.search = "client=a"
    render(<DashboardTab />)
    expect(screen.getByText("Aura", { selector: "b" }).parentElement).toHaveTextContent("Scoped to Aura · At risk")
    expect(tables.client.id).toBe("a")
    const views = screen.getByRole("tablist", { name: "Aura's tables" })
    // The Leads count is the range's real total, not the capped list.
    expect(within(views).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Leads34", "Ads2", "Calls3"])
    expect(screen.getByText("the leads table")).toBeInTheDocument()
    expect(screen.queryByText("the clients table")).not.toBeInTheDocument()
  })

  it("shows the ads against the client's limit, and the calls", async () => {
    route.search = "client=a&view=ads"
    const ads = render(<DashboardTab />)
    expect(screen.getByText("the ads table")).toBeInTheDocument()
    expect(hubs.ads.cplTarget).toBe(6)
    await userEvent.click(screen.getByRole("tab", { name: /^Calls/ }))
    expect(replace).toHaveBeenCalledWith("/dashboard/table?client=a&view=calls")
    ads.unmount()
    route.search = "client=a&view=calls"
    render(<DashboardTab />)
    expect(screen.getByText("the calls table")).toBeInTheDocument()
  })

  it("limits a question to this client, with a separate thread for each table", async () => {
    route.search = "client=a&view=calls"
    render(<DashboardTab />)
    await userEvent.type(screen.getByRole("textbox", { name: "Ask Agency Ops about Aura's calls" }), "How many were answered?{Enter}")
    expect(sendChatMessage).toHaveBeenCalledWith("by_ops_ask_calls_a", expect.objectContaining({ page: "client_detail", clientGroupId: "a", clientName: "Aura" }), expect.any(Object))
    expect(screen.getByRole("complementary", { name: "Agency Ops · Aura conversation" })).toBeInTheDocument()
  })

  it("says so for a client that is not in the account", () => {
    route.search = "client=zzz"
    render(<DashboardTab />)
    expect(screen.getByRole("heading", { name: "This client isn’t in your account" })).toBeInTheDocument()
  })
})

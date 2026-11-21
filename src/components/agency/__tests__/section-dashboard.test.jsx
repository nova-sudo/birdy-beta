import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SectionDashboard } from "../section-dashboard"

const push = vi.fn()
const replace = vi.fn()
const route = { search: "" }
const swr = { keys: [] }
const client = { props: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/media-buyer/table", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({
  useSuggestionCount: () => 1,
  useOpenSuggestions: () => [{ id: "s1", client: "Aura", title: "Pause it" }],
}))
vi.mock("swr", () => ({ default: (key) => { swr.keys.push(key); return { data: undefined, error: null, isLoading: false, mutate: vi.fn() } } }))
vi.mock("@/components/agency/client-dashboard", () => ({
  BUYER_CLIENT_VIEWS: [{ value: "ads" }], COACH_CLIENT_VIEWS: [{ value: "calls" }],
  ClientDashboard: (p) => { client.props = p; return <p>the client dashboard</p> },
}))
const group = (id, name, spend, leads, cpl, funnel) => ({
  id, name, client_status: "Active", targets: cpl ? { cpl } : {}, call_log_provider: "hotprospector",
  facebook: { metrics: { insights: { spend, results: leads } } },
  gohighlevel: { metrics: { opportunity_stats: { won: 1 }, funnel } },
  hotprospector: { call_stats: { total_calls: 10, answered_calls: 5 }, daily_calls: [] },
})
const GROUPS = [
  group("a", "Aura", 120, 10, 6, { leads: 10, in_crm: 8, called: 2, closes: 1 }),
  group("b", "Beaulea Clinic", 30, 10, 6, { leads: 10, in_crm: 9, called: 8, closes: 2 }),
]
const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn() })
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => groups() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  swr.keys = []
  client.props = null
})

describe("Media Buyer's Dashboard tab", () => {
  it("puts the client over its limit and with a suggestion waiting first", () => {
    render(<SectionDashboard section="buyer" />)
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Aura")
    expect(rows[0]).toHaveTextContent("£12.00")
    expect(rows[0]).toHaveTextContent("1 suggestion")
    expect(rows[1]).toHaveTextContent("Beaulea Clinic")
  })

  it("asks for the closes behind every client's campaigns in the range", () => {
    render(<SectionDashboard section="buyer" />)
    expect(swr.keys.find((k) => k?.startsWith("/api/campaigns/opp-rollup"))).toMatch(/groups=a%2Cb/)
  })

  it("narrows the table to a client's campaigns when its row is clicked", async () => {
    render(<SectionDashboard section="buyer" />)
    await userEvent.click(screen.getByText("Beaulea Clinic"))
    expect(push).toHaveBeenCalledWith("/media-buyer/table?level=campaigns&group=b")
  })

  it("still opens a client's own dashboard, from its filter chip", async () => {
    route.search = "level=campaigns&group=b"
    render(<SectionDashboard section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "Open Beaulea Clinic's own dashboard" }))
    expect(push).toHaveBeenCalledWith("/media-buyer/table?client=b")
  })

  it("hands a client to the client dashboard with Media Buyer's tables", () => {
    route.search = "client=a"
    render(<SectionDashboard section="buyer" />)
    expect(client.props).toMatchObject({ clientId: "a", views: [{ value: "ads" }] })
    expect(client.props.section.key).toBe("buyer")
  })
})

describe("Sales Coach's Dashboard tab", () => {
  it("lists every call centre with the clients behind on calling first", () => {
    render(<SectionDashboard section="coach" />)
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Aura")
    expect(rows[0]).toHaveTextContent("Under half called")
    expect(within(screen.getByRole("tablist", { name: "Show" })).getByRole("tab", { name: /Behind/ })).toHaveTextContent("1")
  })

  it("only fetches the agency's calls once the Calls table is opened", () => {
    render(<SectionDashboard section="coach" />)
    expect(swr.keys.filter(Boolean).some((k) => k.startsWith("/api/hotprospector/call-center"))).toBe(false)
    route.search = "view=calls"
    render(<SectionDashboard section="coach" />)
    expect(swr.keys.filter(Boolean).find((k) => k.startsWith("/api/hotprospector/call-center"))).toMatch(/has_calls=true/)
  })
})

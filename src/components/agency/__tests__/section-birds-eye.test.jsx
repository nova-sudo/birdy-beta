import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SectionBirdsEye } from "../section-birds-eye"

// Bird's Eye draws the old hubs' first section on top, and the section's own two cards under it.

const push = vi.fn()
const replace = vi.fn()
const route = { search: "", path: "/media-buyer" }
const seen = { marketing: null, overview: null }
const portfolio = { result: null }
const sendChatMessage = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0, useOpenSuggestions: () => [] }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/campaigns/MarketingContent", () => ({
  MarketingContent: (p) => {
    seen.marketing = p
    return <button type="button" onClick={() => p.onAskBirdy("Why did spend rise?")}>Ask Birdy about this</button>
  },
}))
vi.mock("@/components/saleshub/CallCentreOverview", () => ({
  CallCentreOverview: (p) => {
    seen.overview = p
    return <button type="button" onClick={() => p.onAsk("Why are calls down?")}>Ask Birdy about this</button>
  },
}))
vi.mock("@/app/dashboard/usePortfolioData", () => ({ usePortfolioData: () => portfolio.result }))
const GROUPS = [
  { id: "a", name: "Aura", client_status: "Active", health: "Healthy", targets: { cpl: 6 }, call_log_provider: "hotprospector", facebook: { metrics: { insights: { spend: 120, results: 10 } } } },
  { id: "b", name: "Beaulea Clinic", client_status: "Active", health: "Healthy", targets: { cpl: 6 }, call_log_provider: "hotprospector", facebook: { metrics: { insights: { spend: 30, results: 10 } } } },
]
const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(), invalidate: vi.fn() })
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: (...a) => sendChatMessage(...a), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

const result = (over = {}) => ({
  current: {}, previous: null, client: null, groups: GROUPS, previousGroups: null,
  chartMetrics: { spend: { valuePrefix: "£" } },
  hasClients: true, hasCallCentre: true, loading: false, error: null, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  route.path = "/media-buyer"
  seen.marketing = null
  seen.overview = null
  portfolio.result = result()
})

describe("Media Buyer's Bird's Eye", () => {
  it("opens on the Marketing Hub's first section for every client, with the section's cards under it", () => {
    render(<SectionBirdsEye section="buyer" />)
    expect(seen.marketing).toMatchObject({ part: "hero", showHeader: false, showGroupFilter: false, selectedClientGroup: null, datePreset: "last_7d", clientGroups: GROUPS })
    expect(seen.overview).toBeNull()
    expect(screen.getByText("Clients by cost per lead")).toBeInTheDocument()
    // The new design's tiles and chart are gone: the old section draws them.
    expect(screen.queryByRole("tablist", { name: "Chart figure" })).toBeNull()
  })

  it("takes the client from the rail's switcher and the range from the header", () => {
    route.search = "client=b&range=last_30d"
    portfolio.result = result({ client: GROUPS[1] })
    render(<SectionBirdsEye section="buyer" />)
    expect(seen.marketing).toMatchObject({ selectedClientGroup: "b", datePreset: "last_30d" })
    expect(screen.getByText(/Beaulea Clinic’s ads, by cost per lead/)).toBeInTheDocument()
  })

  it("drives the chart's granularity from the header, beside the one date range", async () => {
    render(<SectionBirdsEye section="buyer" />)
    expect(seen.marketing.granularity).toBe("Daily")
    expect(screen.getAllByRole("button", { name: /Date range/ })).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: /Chart granularity/ }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Weekly" }))
    expect(seen.marketing.granularity).toBe("Weekly")
  })

  it("sends “Ask Birdy about this” to Media Buyer's conversation", async () => {
    render(<SectionBirdsEye section="buyer" />)
    await userEvent.click(screen.getByRole("button", { name: "Ask Birdy about this" }))
    expect(sendChatMessage).toHaveBeenCalled()
    expect(JSON.stringify(sendChatMessage.mock.calls[0])).toContain("Why did spend rise?")
    expect(JSON.stringify(sendChatMessage.mock.calls[0])).toContain("media_buyer")
  })
})

describe("Sales Coach's Bird's Eye", () => {
  it("opens on the Sales Hub's first section, with the section's cards under it", () => {
    route.path = "/sales-coach"
    render(<SectionBirdsEye section="coach" />)
    expect(seen.overview).toMatchObject({ selectedClientGroup: "all", datePreset: "last_7d", granularity: "Daily", clientGroups: GROUPS })
    expect(seen.marketing).toBeNull()
    expect(screen.getByText("New lead to close")).toBeInTheDocument()
  })

  it("leaves the cards out when there is no call centre: the old section already says so", () => {
    route.path = "/sales-coach"
    portfolio.result = result({ hasCallCentre: false })
    render(<SectionBirdsEye section="coach" />)
    expect(screen.queryByText("New lead to close")).toBeNull()
  })

  it("sends “Ask Birdy about this” to Sales Coach's conversation", async () => {
    route.path = "/sales-coach"
    route.search = "client=a"
    portfolio.result = result({ client: GROUPS[0] })
    render(<SectionBirdsEye section="coach" />)
    expect(seen.overview.selectedClientGroup).toBe("a")
    await userEvent.click(screen.getByRole("button", { name: "Ask Birdy about this" }))
    expect(JSON.stringify(sendChatMessage.mock.calls[0])).toContain("Why are calls down?")
    expect(JSON.stringify(sendChatMessage.mock.calls[0])).toContain("sales_coach")
  })
})

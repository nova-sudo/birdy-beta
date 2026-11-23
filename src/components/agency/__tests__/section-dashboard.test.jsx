import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SectionDashboard } from "../section-dashboard"

// The Dashboard tab draws the old hubs' tables: what is checked here is what the section hands them.

const push = vi.fn()
const replace = vi.fn()
const route = { search: "", path: "/media-buyer/table" }
const seen = { marketing: null, calls: null }
const setDatePreset = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 1, useOpenSuggestions: () => [] }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/campaigns/MarketingContent", () => ({
  MarketingContent: (p) => { seen.marketing = p; return <p>the Marketing Hub table</p> },
}))
vi.mock("@/components/callcenter/CallCentreContent", () => ({
  CallCentreContent: (p) => {
    seen.calls = p
    return (
      <>
        <button type="button" onClick={() => p.onSelectClientGroup("b")}>Drill into Beaulea</button>
        <button type="button" onClick={() => p.onSelectClientGroup("all")}>Show all clients</button>
      </>
    )
  },
}))
const GROUPS = [
  { id: "a", name: "Aura", client_status: "Active", health: "Healthy" },
  { id: "b", name: "Beaulea Clinic", client_status: "Active", health: "Critical" },
]
const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset, refresh: vi.fn(), invalidate: vi.fn() })
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => groups() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  route.path = "/media-buyer/table"
  seen.marketing = null
  seen.calls = null
})

describe("Media Buyer's Dashboard tab", () => {
  it("is the Marketing Hub's table, for every client, filling the page", () => {
    render(<SectionDashboard section="buyer" />)
    expect(screen.getByText("the Marketing Hub table")).toBeInTheDocument()
    expect(seen.marketing).toMatchObject({
      part: "table", fill: true, showHeader: false, showGroupFilter: false,
      selectedClientGroup: null, datePreset: "last_7d", groupsLoading: false, clientGroups: GROUPS,
    })
    // The section's ask bar sits under it.
    expect(screen.getByPlaceholderText(/Ask Media Buyer about your ads/)).toBeInTheDocument()
  })

  it("takes the client from the rail's switcher and the range from the header", () => {
    route.search = "client=a&range=last_30d"
    render(<SectionDashboard section="buyer" />)
    expect(seen.marketing).toMatchObject({ selectedClientGroup: "a", datePreset: "last_30d", groupsLoading: true })
    expect(setDatePreset).toHaveBeenCalledWith("last_30d")
    expect(screen.getByText("Aura")).toBeInTheDocument()
  })

  it("has the one date range, in the header, and no chart granularity", () => {
    render(<SectionDashboard section="buyer" />)
    expect(screen.getAllByRole("button", { name: /Date range/ })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: /Chart granularity/ })).toBeNull()
  })
})

describe("Sales Coach's Dashboard tab", () => {
  it("is the Sales Hub's table, without its stat cards", () => {
    route.path = "/sales-coach/table"
    render(<SectionDashboard section="coach" />)
    expect(seen.calls).toMatchObject({ showGroupFilter: true, showStatCards: false, fill: true, selectedClientGroup: "all", datePreset: "last_7d" })
    expect(seen.marketing).toBeNull()
  })

  it("narrows the whole section to the client a row drills into, and back out", async () => {
    route.path = "/sales-coach/table"
    route.search = "range=last_30d"
    render(<SectionDashboard section="coach" />)
    await userEvent.click(screen.getByRole("button", { name: "Drill into Beaulea" }))
    expect(replace).toHaveBeenLastCalledWith("/sales-coach/table?range=last_30d&client=b")

    route.search = "client=b"
    render(<SectionDashboard section="coach" />)
    expect(seen.calls.selectedClientGroup).toBe("b")
    await userEvent.click(screen.getAllByRole("button", { name: "Show all clients" }).at(-1))
    expect(replace).toHaveBeenLastCalledWith("/sales-coach/table")
  })
})

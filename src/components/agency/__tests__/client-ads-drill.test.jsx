import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { BUYER_CLIENT_VIEWS, ClientDashboard } from "../client-dashboard"
import { BUYER_SECTION } from "../sections"

// A client's own Ads table: the agency table's levels and drill-down, without Clients, limited to that client.
// Media Buyer's Dashboard tab now draws the old Marketing Hub table (section-dashboard.test.jsx); the client
// dashboard is still Birdy's, and is drawn here with Media Buyer's views as well.

const push = vi.fn()
const replace = vi.fn()
const route = { search: "", path: "/media-buyer/table" }
const swr = { keys: [], data: {} }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0, useOpenSuggestions: () => [] }))
vi.mock("swr", () => ({
  default: (key) => {
    swr.keys.push(key)
    const prefix = key && Object.keys(swr.data).find((p) => key.startsWith(p))
    return { data: prefix ? swr.data[prefix] : undefined, error: null, isLoading: false, mutate: vi.fn() }
  },
}))
vi.mock("@/components/agency/lead/lead-modal", () => ({
  LeadModal: ({ contactId, name }) => (contactId ? <div role="dialog" aria-label={`Lead: ${name}`} data-contact={contactId} /> : null),
}))
vi.mock("@/components/clients/list/clients-list", () => ({ ClientsList: () => null }))

const GROUPS = [
  {
    id: "a", name: "Aura", client_status: "Active", targets: { cpl: 15 },
    facebook: {
      campaigns: [{ id: "c1", name: "Body Sculpt", spend: 100, results: 8 }, { id: "c2", name: "Lips", spend: 20, results: 1 }],
      adsets: [{ id: "s1", name: "Women 30+", campaign_id: "c1", spend: 60, results: 5 }, { id: "s2", name: "Lookalike", campaign_id: "c1", spend: 40, results: 3 }, { id: "s3", name: "Lips set", campaign_id: "c2", spend: 20, results: 1 }],
      ads: [
        { id: "1", name: "Timelapse", campaign_id: "c1", adset_id: "s1", spend: 60, results: 5 },
        { id: "2", name: "Testimonial", campaign_id: "c1", adset_id: "s2", spend: 40, results: 3 },
        { id: "3", name: "Lips promo", campaign_id: "c2", adset_id: "s3", spend: 20, results: 1 },
      ],
    },
  },
  { id: "b", name: "Beaulea Clinic", client_status: "Active", targets: {}, facebook: { campaigns: [{ id: "c9", name: "Facials", spend: 30, results: 1 }] } },
]
const lead = (id, name, group, campaign, adset, ad, over = {}) => ({
  lead_id: id, full_name: name, client_group_id: group, campaign_id: campaign, adset_id: adset, ad_id: ad, ad_name: "", campaign_name: "",
  created_time: "2026-11-04T18:31:00Z", lead_source: "instant_form", ghl_matched: false, ghl_tags: [], ghl_opportunity_status: "", ghl_opportunity_value: 0, ...over,
})
const LEADS = [
  lead("L1", "Leanne Turner", "a", "c1", "s1", "1", { lead_source: "ghl_attribution", ghl_matched: true }),
  lead("L2", "Priya Shah", "a", "c1", "s2", "2"),
  // Another client's lead the endpoint should not send; the table drops it all the same.
  lead("L3", "Mo Khan", "b", "c9", "s9", "9"),
]

const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn() })
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => groups() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

const levelTabs = () => within(screen.getByRole("tablist", { name: "Show by" }))
const bodyRows = () => screen.getAllByRole("row").slice(1)
let mounted = null
const BuyerClient = () => <ClientDashboard clientId={new URLSearchParams(route.search).get("client")} section={BUYER_SECTION} views={BUYER_CLIENT_VIEWS} />
const show = (search, Page = BuyerClient, path = "/media-buyer/table") => {
  mounted?.unmount()
  route.search = search
  route.path = path
  mounted = render(<Page />)
  return mounted
}

beforeEach(() => {
  vi.clearAllMocks()
  swr.keys = []
  swr.data = { "/api/facebook-leads/filtered": { leads: LEADS } }
})

describe("Media Buyer inside a client", () => {
  it("has Campaigns, Ad sets, Ads and Leads, counted for this client only", () => {
    show("client=a")
    expect(levelTabs().getAllByRole("tab").map((t) => t.textContent)).toEqual(["Campaigns2", "Ad sets3", "Ads3", "Leads2"])
    expect(screen.queryByRole("button", { name: /^Client:/ })).toBeNull()
    expect(swr.keys.find((k) => k?.startsWith("/api/facebook-leads/filtered"))).toMatch(/groups=a&limit=5000/)
  })

  it("drills a campaign to its ad sets, keeping the client in the address", async () => {
    show("client=a")
    await userEvent.click(screen.getByText("Body Sculpt"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?client=a&level=adsets&campaign=c1")

    show("client=a&level=adsets&campaign=c1")
    expect(bodyRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Women 30+"), expect.stringContaining("Lookalike")])
    await userEvent.click(screen.getByText("Women 30+"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?client=a&level=ads&campaign=c1&adset=s1")

    show("client=a&level=ads&campaign=c1&adset=s1")
    await userEvent.click(screen.getByText("Timelapse"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?client=a&level=leads&campaign=c1&adset=s1&ad=1")
  })

  it("lists the leads from one ad, and opens a lead the CRM knows in the modal", async () => {
    show("client=a&level=leads&campaign=c1&adset=s1&ad=1")
    expect(bodyRows()).toHaveLength(1)
    await userEvent.click(screen.getByText("Leanne Turner"))
    expect(screen.getByRole("dialog", { name: "Lead: Leanne Turner" })).toHaveAttribute("data-contact", "L1")
    // No Client column inside a client.
    expect(screen.queryByRole("columnheader", { name: /Client/ })).toBeNull()
  })

  it("shows the trail without a client chip, and steps back up from it", async () => {
    show("client=a&level=leads&campaign=c1&adset=s1&ad=1")
    const trail = within(screen.getByRole("navigation", { name: "Filtered to" }))
    expect(trail.getAllByRole("button", { name: /Show what is under it/ }).map((b) => b.getAttribute("aria-label").split(":")[0])).toEqual(["Campaign", "Ad set", "Ad"])
    await userEvent.click(trail.getByRole("button", { name: /Campaign: Body Sculpt/ }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?client=a&level=adsets&campaign=c1")
    await userEvent.click(trail.getByRole("button", { name: "Remove the ad set filter and those under it" }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?client=a&level=leads&campaign=c1")
  })

  it("is honest when an ad brought no leads, and when none came from the client's ads", () => {
    show("client=a&level=leads&campaign=c2&adset=s3&ad=3")
    expect(screen.getByText("No leads under this ad in this range")).toBeInTheDocument()
    swr.data = { "/api/facebook-leads/filtered": { leads: [] } }
    show("client=a&level=leads")
    expect(screen.getByText("No leads from this client’s ads in this range")).toBeInTheDocument()
  })

  it("ignores an agency drill left in the address", () => {
    show("client=a&level=clients&group=b")
    expect(levelTabs().getByRole("tab", { selected: true })).toHaveTextContent("Campaigns")
    expect(bodyRows()).toHaveLength(2)
  })

  it("marks a cost per lead over the client's limit", () => {
    show("client=a")
    // Lips: £20 for one lead, over the £15 limit. Spend and CPL are both £20; only the CPL is marked.
    const cells = within(bodyRows().find((r) => r.textContent.startsWith("Lips"))).getAllByText("£20.00")
    expect(cells.map((c) => c.classList.contains("text-by-danger"))).toEqual([false, true])
  })

  it("only asks for the ads' leads while the Ads table is open", () => {
    show("client=a&view=leads")
    expect(swr.keys.filter(Boolean).some((k) => k.startsWith("/api/facebook-leads/filtered"))).toBe(false)
  })
})

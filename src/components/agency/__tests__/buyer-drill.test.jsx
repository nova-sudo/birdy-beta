import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { SectionDashboard } from "../section-dashboard"

// Media Buyer's agency table: the Leads level, the client picker and the drill-down.

const push = vi.fn()
const route = { search: "" }
const swr = { keys: [], data: {} }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/media-buyer/table", useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0, useOpenSuggestions: () => [] }))
vi.mock("swr", () => ({
  default: (key) => {
    swr.keys.push(key)
    const prefix = key && Object.keys(swr.data).find((p) => key.startsWith(p))
    return { data: prefix ? swr.data[prefix] : undefined, error: null, isLoading: false, mutate: vi.fn() }
  },
}))
// The lead modal itself is tested on its own; here it only says which lead it shows.
vi.mock("@/components/agency/lead/lead-modal", () => ({
  LeadModal: ({ contactId, name, onClose }) => (contactId ? <div role="dialog" aria-label={`Lead: ${name}`} data-contact={contactId}><button onClick={onClose}>Close</button></div> : null),
}))
vi.mock("@/components/agency/client-dashboard", () => ({ BUYER_CLIENT_VIEWS: [], COACH_CLIENT_VIEWS: [], ClientDashboard: () => null }))

const GROUPS = [
  {
    id: "a", name: "Aura", client_status: "Active", targets: {},
    facebook: {
      metrics: { insights: { spend: 120, results: 10 } },
      campaigns: [{ id: "c1", name: "Body Sculpt", spend: 100, results: 8 }, { id: "c2", name: "Lips", spend: 20, results: 2 }],
      adsets: [{ id: "s1", name: "Women 30+", campaign_id: "c1", spend: 60, results: 5 }, { id: "s2", name: "Lookalike", campaign_id: "c1", spend: 40, results: 3 }, { id: "s3", name: "Lips set", campaign_id: "c2", spend: 20, results: 2 }],
      ads: [
        { id: "1", name: "Timelapse", campaign_id: "c1", adset_id: "s1", spend: 60, results: 5 },
        { id: "2", name: "Testimonial", campaign_id: "c1", adset_id: "s2", spend: 40, results: 3 },
        { id: "3", name: "Lips promo", campaign_id: "c2", adset_id: "s3", spend: 20, results: 2 },
      ],
    },
  },
  {
    id: "b", name: "Beaulea Clinic", client_status: "Active", targets: {},
    facebook: {
      metrics: { insights: { spend: 30, results: 1 } },
      campaigns: [{ id: "c9", name: "Facials", spend: 30, results: 1 }],
      adsets: [{ id: "s9", name: "Local", campaign_id: "c9", spend: 30, results: 1 }],
      ads: [{ id: "9", name: "Glow", campaign_id: "c9", adset_id: "s9", spend: 30, results: 1 }],
    },
  },
]
const lead = (id, name, group, campaign, adset, ad, over = {}) => ({
  lead_id: id, full_name: name, client_group_id: group, campaign_id: campaign, adset_id: adset, ad_id: ad, ad_name: "", campaign_name: "",
  created_time: "2026-11-04T18:31:00Z", lead_source: "instant_form", ghl_matched: false, ghl_tags: [], ghl_opportunity_status: "", ghl_opportunity_value: 0, ...over,
})
const LEADS = [
  lead("L1", "Leanne Turner", "a", "c1", "s1", "1", { lead_source: "ghl_attribution", ghl_matched: true }),
  lead("L2", "Priya Shah", "a", "c1", "s2", "2"),
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
// One table at a time: a later show() replaces the earlier one, as a new address would.
const show = (search) => { mounted?.unmount(); route.search = search; mounted = render(<SectionDashboard section="buyer" />); return mounted }

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  swr.keys = []
  swr.data = { "/api/facebook-leads/filtered": { leads: LEADS } }
})

describe("the Leads level", () => {
  it("comes after Ads, counted like the others, from the leads the Marketing Hub listed", () => {
    show("")
    expect(levelTabs().getAllByRole("tab").map((t) => t.textContent.replace(/\d+/g, ""))).toEqual(["Clients", "Campaigns", "Ad sets", "Ads", "Leads"])
    expect(levelTabs().getByRole("tab", { name: /Leads/ })).toHaveTextContent("3")
    expect(swr.keys.find((k) => k?.startsWith("/api/facebook-leads/filtered"))).toMatch(/groups=a%2Cb&limit=5000/)
  })

  it("lists each lead with its client and stage, in the client page's Leads table", () => {
    show("level=leads")
    expect(bodyRows()).toHaveLength(3)
    expect(screen.getByRole("row", { name: /Leanne Turner/ })).toHaveTextContent("Aura")
    expect(screen.getByRole("row", { name: /Priya Shah/ })).toHaveTextContent("Not in CRM")
    // The Leads table's own filter menu is there; no Calls column, since this source can't say.
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /Calls/ })).not.toBeInTheDocument()
  })

  it("opens only leads the CRM knows", async () => {
    show("level=leads")
    await userEvent.click(screen.getByText("Priya Shah"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("button", { name: "Priya Shah" })).toBeNull()
    await userEvent.click(screen.getByText("Leanne Turner"))
    expect(screen.getByRole("dialog", { name: "Lead: Leanne Turner" })).toHaveAttribute("data-contact", "L1")
    expect(push).not.toHaveBeenCalled()
  })

  it("is honest when an ad brought no leads", () => {
    show("level=leads&group=a&campaign=c2&adset=s3&ad=3")
    expect(screen.getByText("No leads under this ad in this range")).toBeInTheDocument()
  })
})

describe("drilling down", () => {
  it("goes from a campaign to its ad sets, an ad set to its ads, and an ad to its leads", async () => {
    show("level=campaigns")
    await userEvent.click(screen.getByText("Body Sculpt"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=adsets&group=a&campaign=c1")

    show("level=adsets&group=a&campaign=c1")
    await userEvent.click(screen.getByText("Women 30+"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=ads&group=a&campaign=c1&adset=s1")

    show("level=ads&group=a&campaign=c1&adset=s1")
    await userEvent.click(screen.getByText("Timelapse"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=leads&group=a&campaign=c1&adset=s1&ad=1")
  })

  it("narrows each level to the drill in the address", () => {
    show("level=adsets&group=a&campaign=c1")
    expect(bodyRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Women 30+"), expect.stringContaining("Lookalike")])
    // The counts follow the drill too.
    expect(levelTabs().getByRole("tab", { name: /Ad sets/ })).toHaveTextContent("2")
    expect(levelTabs().getByRole("tab", { name: /Leads/ })).toHaveTextContent("2")
  })

  it("shows the leads that came from one ad", () => {
    show("level=leads&group=a&campaign=c1&adset=s1&ad=1")
    expect(bodyRows()).toHaveLength(1)
    expect(bodyRows()[0]).toHaveTextContent("Leanne Turner")
  })

  it("shows the drill as a trail of named chips", () => {
    show("level=ads&group=a&campaign=c1&adset=s1")
    const trail = within(screen.getByRole("navigation", { name: "Filtered to" }))
    expect(trail.getByRole("button", { name: /Client: Aura/ })).toBeInTheDocument()
    expect(trail.getByRole("button", { name: /Campaign: Body Sculpt/ })).toBeInTheDocument()
    expect(trail.getByRole("button", { name: /Ad set: Women 30\+/ })).toBeInTheDocument()
  })

  it("widens back out when a chip is removed, taking the filters under it too", async () => {
    show("level=ads&group=a&campaign=c1&adset=s1")
    await userEvent.click(screen.getByRole("button", { name: "Remove the campaign filter and those under it" }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=ads&group=a")
  })

  it("steps back up to a chip when it is pressed", async () => {
    show("level=leads&group=a&campaign=c1&adset=s1&ad=1")
    await userEvent.click(screen.getByRole("button", { name: /Campaign: Body Sculpt/ }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=adsets&group=a&campaign=c1")
  })

  it("keeps the filters when the level is changed by hand, using those that apply", async () => {
    show("level=ads&group=a&campaign=c1&adset=s1")
    await userEvent.click(levelTabs().getByRole("tab", { name: /Campaigns/ }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=campaigns&group=a&campaign=c1&adset=s1")

    show("level=campaigns&group=a&campaign=c1&adset=s1")
    // On Campaigns only the client applies: both of Aura's campaigns show.
    expect(bodyRows().map((r) => r.textContent)).toEqual([expect.stringContaining("Body Sculpt"), expect.stringContaining("Lips")])
  })

  it("keeps the rest of the address, such as the range", async () => {
    show("range=last_7d&level=campaigns")
    await userEvent.click(screen.getByText("Facials"))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?range=last_7d&level=adsets&group=b&campaign=c9")
  })
})

describe("the client picker", () => {
  it("narrows every level to one client, and back to all", async () => {
    show("level=ads")
    await userEvent.click(screen.getByRole("button", { name: "Client: all clients" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Beaulea Clinic" }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=ads&group=b")

    show("level=ads&group=b&campaign=c9")
    expect(bodyRows()).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: "Client: Beaulea Clinic" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "All clients" }))
    expect(push).toHaveBeenLastCalledWith("/media-buyer/table?level=ads")
  })
})

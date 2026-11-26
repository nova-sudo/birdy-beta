import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { OpsClientsDashboard } from "../ops-clients"

// Agency Ops' Dashboard tab follows the client picked in the rail: the Clients table for the agency,
// and inside a client the old Leads hub table, limited to the client, with the lead's stages as tabs
// and the CRM's pipeline and stage in Filters.

const push = vi.fn()
const route = { search: "", path: "/dashboard/table" }
let mounted = null
// router.replace changes the address; the page is drawn again from it, as Next would.
const replace = vi.fn((url) => {
  route.search = url.split("?")[1] ?? ""
  mounted?.rerender(<OpsClientsDashboard />)
})

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }), usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0, useOpenSuggestions: () => [] }))
vi.mock("swr", () => ({ default: () => ({ data: undefined, error: null, isLoading: false, mutate: vi.fn() }) }))
vi.mock("@/components/clients/list/old-clients-table", () => ({
  OldClientsTable: ({ frame }) => frame({ dateRange: null, body: <div data-testid="clients-table">Clients table</div> }),
}))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

// Every request the table makes; the leads endpoint answers from `api.leads`.
const api = { calls: [], leads: () => ({}) }
const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })
vi.mock("@/lib/api", () => ({
  apiRequest: (url) => {
    api.calls.push(url)
    if (url.startsWith("/api/leads/unified")) return json(api.leads(new URL(url, "http://x").searchParams))
    if (url.startsWith("/api/leads/filter-options")) return json({ sources: ["Facebook"], types: [], tags: ["vip"] })
    if (url.startsWith("/api/custom-metrics")) return json({ custom_metrics: [] })
    return json({})
  },
}))

const GROUPS = [{ id: "cc", name: "Confidence Clinic", client_status: "Active", ghl_location_id: "loc1" }]
const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(), invalidate: vi.fn() })
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => groups() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))

const contact = (id, name) => ({ contactId: id, contactName: name, email: `${id}@mail.test`, phone: "+44 7700 900000", dateAdded: "2026-11-20T10:00:00Z", source: "Facebook", tags: [], opportunities: [], groupName: "Confidence Clinic" })
const ANN = contact("ann", "Ann Lee")
const BEN = contact("ben", "Ben Ode")
const MAIN = { id: "p1", name: "Main offer", stages: [{ id: "s1", name: "New leads", count: 41 }, { id: "s2", name: "Spicy leads", count: 12 }, { id: "s3", name: "Lead booked", count: 5 }] }
const REACTIVATION = { id: "p2", name: "Reactivation", stages: [{ id: "r1", name: "Re-engaged", count: 3 }] }
const STAGES = { all: 61, meta: 40, crm: 30, called: 20, closed: 6, lost: 5 }
const answer = (contacts, meta = {}) => ({ contacts, meta: { total_contacts: contacts.length, total_pages: 1, has_next: false, ...meta } })

const leadCalls = () => api.calls.filter((u) => u.startsWith("/api/leads/unified")).map((u) => new URL(u, "http://x").searchParams)
const lastLeadCall = () => leadCalls().at(-1)
const show = (search) => {
  mounted?.unmount()
  route.search = search
  mounted = render(<OpsClientsDashboard />)
  return mounted
}
const stageTabs = () => within(screen.getByRole("tablist", { name: "Lead stage" }))
const tabTexts = () => stageTabs().getAllByRole("tab").map((t) => t.textContent)
const openFilters = async () => userEvent.click(screen.getByRole("button", { name: /Filters/ }))
const filterTab = (name) => screen.queryAllByRole("button", { name: new RegExp(`^${name}`) }).find((b) => b.closest("[role=menu]"))

beforeEach(() => {
  vi.clearAllMocks()
  api.calls = []
  api.leads = (q) => {
    if (q.get("lead_stage") === "called") return answer([BEN], { total_contacts: 20, lead_stages: STAGES, pipelines: [MAIN] })
    if (q.get("stage_id") === "s2") return answer([BEN], { total_contacts: 12, lead_stages: { ...STAGES, all: 12 }, pipelines: [MAIN] })
    return answer([ANN, BEN], { total_contacts: 61, lead_stages: STAGES, pipelines: [MAIN] })
  }
})

describe("Agency Ops' Dashboard tab", () => {
  it("is the Clients table with no client picked", () => {
    show("")
    expect(screen.getByTestId("clients-table")).toBeInTheDocument()
    expect(screen.queryByRole("tablist", { name: "Lead stage" })).toBeNull()
    expect(leadCalls()).toEqual([])
  })

  it("is the client's leads table under Agency Ops' header, with the six lead tabs and their counts", async () => {
    show("client=cc")
    expect(screen.queryByTestId("clients-table")).toBeNull()
    expect(screen.getByRole("heading", { name: "Agency Ops" })).toBeInTheDocument()
    expect(screen.getByText("Confidence Clinic")).toBeInTheDocument()
    expect(within(screen.getByRole("tablist", { name: "Agency Ops views" })).getByRole("tab", { name: /Dashboard/ })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("button", { name: /Date range/ })).toBeInTheDocument()
    expect(await screen.findByText("Ann Lee")).toBeInTheDocument()
    expect(tabTexts()).toEqual(["All61", "Meta lead40", "In CRM30", "Called20", "Closed6", "Lost5"])
    expect(stageTabs().getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true")
    // Limited to the client, 15 a page, nothing narrowed yet.
    const q = lastLeadCall()
    expect(q.get("groups")).toBe("cc")
    expect(q.get("limit")).toBe("15")
    expect(q.get("lead_stage")).toBeNull()
    expect(q.get("stage_id")).toBeNull()
    expect(screen.getByPlaceholderText("Ask Agency Ops about Confidence Clinic’s leads")).toBeInTheDocument()
  })

  it("has no Ads or Calls views, and no Open / Won tabs", async () => {
    show("client=cc")
    await screen.findByText("Ann Lee")
    expect(screen.queryByRole("tablist", { name: /tables/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /^Ads/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /^Calls/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /^Won/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /^Open/ })).toBeNull()
  })

  it("asks for a picked tab's leads with lead_stage and keeps it in the address", async () => {
    show("client=cc&range=last_7d")
    await screen.findByText("Ann Lee")
    await userEvent.click(stageTabs().getByRole("tab", { name: /^Called/ }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&range=last_7d&leads=called")
    await waitFor(() => expect(screen.queryByText("Ann Lee")).toBeNull())
    expect(lastLeadCall().get("lead_stage")).toBe("called")
    expect(stageTabs().getByRole("tab", { name: /^Called/ })).toHaveAttribute("aria-selected", "true")
    // The counts ignore the tab itself.
    expect(tabTexts()[0]).toBe("All61")
  })

  it("shows the tabs without counts when the backend sends none, and still sends lead_stage", async () => {
    api.leads = () => answer([ANN, BEN], { total_contacts: 2 })
    show("client=cc&leads=lost")
    await screen.findByText("Ann Lee")
    expect(tabTexts()).toEqual(["All", "Meta lead", "In CRM", "Called", "Closed", "Lost"])
    expect(lastLeadCall().get("lead_stage")).toBe("lost")
    expect(screen.queryByRole("tab", { name: /^Won/ })).toBeNull()
  })

  it("lists the pipeline's stages in Filters in the CRM's order with counts, and a pick sends stage_id", async () => {
    show("client=cc")
    await screen.findByText("Ann Lee")
    await openFilters()
    // One pipeline: no Pipeline group.
    expect(filterTab("Pipeline")).toBeUndefined()
    await userEvent.click(filterTab("Stage"))
    const options = screen.getAllByRole("radio").map((o) => o.textContent)
    expect(options).toEqual(["New leads41", "Spicy leads12", "Lead booked5"])
    await userEvent.click(screen.getByRole("radio", { name: /Spicy leads/ }))
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&stage=s2")
    await waitFor(() => expect(screen.queryByText("Ann Lee")).toBeNull())
    expect(lastLeadCall().get("stage_id")).toBe("s2")
    expect(screen.getByRole("button", { name: "Remove the Spicy leads stage filter" })).toHaveTextContent("Stage: Spicy leads")
  })

  it("offers a Pipeline group only when the client has two pipelines, and its stages follow the pick", async () => {
    api.leads = () => answer([ANN, BEN], { total_contacts: 61, lead_stages: STAGES, pipelines: [REACTIVATION, MAIN] })
    show("client=cc")
    await screen.findByText("Ann Lee")
    await openFilters()
    await userEvent.click(filterTab("Pipeline"))
    // The busiest pipeline is the one picked.
    expect(screen.getByRole("radio", { name: /Main offer/ })).toHaveAttribute("aria-checked", "true")
    await userEvent.click(screen.getByRole("radio", { name: /Reactivation/ }))
    await userEvent.click(filterTab("Stage"))
    expect(screen.getAllByRole("radio").map((o) => o.textContent)).toEqual(["Re-engaged3"])
    await userEvent.click(screen.getByRole("radio", { name: /Re-engaged/ }))
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&pipeline=p2&stage=r1")
    await waitFor(() => expect(lastLeadCall().get("stage_id")).toBe("r1"))
    expect(await screen.findByRole("button", { name: "Remove the Re-engaged stage filter" })).toHaveTextContent("Stage: Re-engaged")
  })

  it("keeps Opportunities as a filter", async () => {
    show("client=cc")
    await screen.findByText("Ann Lee")
    await openFilters()
    await userEvent.click(filterTab("Opportunities"))
    expect(screen.getAllByRole("radio").map((o) => o.textContent)).toEqual(["Open", "Won", "Lost", "Abandoned"])
    await userEvent.click(screen.getByRole("radio", { name: "Won" }))
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }))
    await waitFor(() => expect(lastLeadCall().get("opportunity_status")).toBe("won"))
    expect(route.search).toBe("client=cc&opportunity=won")
  })

  it("takes the stage off from its chip, and Clear takes it off too", async () => {
    show("client=cc&leads=called&stage=s2&page=2")
    expect(await screen.findByRole("button", { name: "Remove the Spicy leads stage filter" })).toBeInTheDocument()
    expect(leadCalls()[0].get("stage_id")).toBe("s2")
    expect(leadCalls()[0].get("page")).toBe("2")
    await userEvent.click(screen.getByRole("button", { name: "Remove the Spicy leads stage filter" }))
    expect(route.search).toBe("client=cc&leads=called")

    show("client=cc&leads=called&stage=s2")
    await screen.findByRole("button", { name: "Remove the Spicy leads stage filter" })
    await userEvent.click(screen.getByRole("button", { name: "Clear" }))
    // The tab stays: it is not a filter.
    expect(route.search).toBe("client=cc&leads=called")
    await waitFor(() => expect(screen.queryByRole("button", { name: /stage filter/ })).toBeNull())
    expect(lastLeadCall().get("stage_id")).toBeNull()
  })

  it("drops a stage the CRM doesn't have", async () => {
    api.leads = () => answer([ANN], { lead_stages: STAGES })
    show("client=cc&stage=gone")
    await waitFor(() => expect(route.search).toBe("client=cc"))
    await waitFor(() => expect(lastLeadCall().get("stage_id")).toBeNull())
  })

  it("pages on the server, keeping the page in the address", async () => {
    api.leads = (q) => answer(q.get("page") === "2" ? [BEN] : [ANN], { total_contacts: 30, total_pages: 2, has_next: q.get("page") !== "2", lead_stages: STAGES })
    show("client=cc")
    await screen.findByText("Ann Lee")
    await userEvent.click(screen.getByRole("link", { name: /next/i }))
    expect(route.search).toBe("client=cc&page=2")
    expect(await screen.findByText("Ben Ode")).toBeInTheDocument()
    expect(lastLeadCall().get("page")).toBe("2")
  })

  it("opens a lead on its own page", async () => {
    show("client=cc")
    await userEvent.click(await screen.findByText("Ann Lee"))
    expect(push).toHaveBeenLastCalledWith("/contacts/ann")
  })

  it("keeps the client when another tab is picked", async () => {
    show("client=cc&range=last_30d&leads=called&stage=s2")
    await userEvent.click(within(screen.getByRole("tablist", { name: "Agency Ops views" })).getByRole("tab", { name: /Bird's Eye/ }))
    expect(push).toHaveBeenLastCalledWith("/dashboard?client=cc&range=last_30d")
  })
})

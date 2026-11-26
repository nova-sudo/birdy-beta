import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { OpsClientsDashboard } from "../ops-clients"

// Agency Ops' Dashboard tab follows the client picked in the rail: the Clients table for the agency,
// and inside a client its lead pipeline (the CRM's own stages), Ads and Calls.

const push = vi.fn()
const route = { search: "", path: "/dashboard/table" }
let mounted = null
// router.replace changes the address; the page is drawn again from it, as Next would.
const replace = vi.fn((url) => {
  route.search = url.split("?")[1] ?? ""
  mounted?.rerender(<OpsClientsDashboard />)
})
const swr = { keys: [], answer: () => undefined }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }), usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0, useOpenSuggestions: () => [] }))
vi.mock("swr", () => ({
  default: (key) => {
    swr.keys.push(key)
    return { data: key ? swr.answer(key) : undefined, error: null, isLoading: false, mutate: vi.fn() }
  },
}))
vi.mock("@/components/clients/list/old-clients-table", () => ({
  OldClientsTable: ({ frame }) => frame({ dateRange: null, body: <div data-testid="clients-table">Clients table</div> }),
}))
vi.mock("@/lib/chat-store", () => ({ useChat: () => ({ messages: [], loading: false, sessionId: null, submittedUIs: [] }), sendChatMessage: vi.fn(), markUISubmitted: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))

const GROUPS = [
  {
    id: "cc", name: "Confidence Clinic", client_status: "Active", ghl_location_id: "loc1", hotprospector: { connected: true },
    facebook: { campaigns: [{ id: "c1", name: "Botox", spend: 90, results: 6 }], adsets: [], ads: [{ id: "1", name: "Before and after", campaign_id: "c1", spend: 90, results: 6 }] },
  },
]
const groups = () => ({ clientGroups: GROUPS, loading: false, error: null, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(), invalidate: vi.fn() })
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => groups() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: () => groups() }))

const opp = (pipelineId, stageId, pipelineName, stageName, status = "open") => ({ pipelineId, pipelineStageId: stageId, pipelineName, pipelineStageName: stageName, status, monetaryValue: 0 })
const contact = (id, name, opps, over = {}) => ({ contactId: id, contactName: name, email: `${id}@mail.test`, phone: "+44 7700 900000", dateAdded: "2026-11-20T10:00:00Z", source: "Facebook", tags: [], opportunities: opps, ...over })
const ANN = contact("ann", "Ann Lee", [opp("p1", "s1", "Main funnel", "Opt-in")])
const BEN = contact("ben", "Ben Ode", [opp("p1", "s2", "Main funnel", "Application")])
const CAT = contact("cat", "Cat Roe", [opp("p1", "s3", "Main funnel", "Booking", "won"), opp("p2", "r1", "Reactivation", "Re-engaged")])
const MAIN = { id: "p1", name: "Main funnel", stages: [{ id: "s1", name: "Opt-in", count: 41 }, { id: "s2", name: "Application", count: 12 }, { id: "s3", name: "Booking", count: 5 }] }
const REACTIVATION = { id: "p2", name: "Reactivation", stages: [{ id: "r1", name: "Re-engaged", count: 3 }] }
const page = (contacts, meta = {}) => ({ contacts, meta: { total_contacts: contacts.length, total_pages: 1, ...meta } })

const leadKeys = () => swr.keys.filter((k) => k?.startsWith("/api/leads/unified"))
const show = (search) => {
  mounted?.unmount()
  route.search = search
  mounted = render(<OpsClientsDashboard />)
  return mounted
}
const stageTabs = () => within(screen.getByRole("tablist", { name: "Leads by stage" }))
const names = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)

beforeEach(() => {
  vi.clearAllMocks()
  swr.keys = []
  // The whole client: its three leads and the CRM's pipelines with their counts.
  swr.answer = (key) => {
    if (!key.startsWith("/api/leads/unified")) return undefined
    if (key.includes("stage_id=s2")) return page([BEN], { total_contacts: 12 })
    return page([ANN, BEN, CAT], { total_contacts: 61, pipelines: [MAIN] })
  }
})

describe("Agency Ops' Dashboard tab", () => {
  it("is the Clients table with no client picked", () => {
    show("")
    expect(screen.getByTestId("clients-table")).toBeInTheDocument()
    expect(screen.queryByRole("tablist", { name: "Leads by stage" })).toBeNull()
    expect(leadKeys()).toEqual([])
  })

  it("opens a client's lead pipeline under Agency Ops' header, with the CRM's stages in order and their counts", () => {
    show("client=cc")
    expect(screen.queryByTestId("clients-table")).toBeNull()
    expect(screen.getByRole("heading", { name: "Agency Ops" })).toBeInTheDocument()
    expect(screen.getByText("Confidence Clinic")).toBeInTheDocument()
    expect(within(screen.getByRole("tablist", { name: "Agency Ops views" })).getByRole("tab", { name: /Dashboard/ })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("button", { name: /Date range/ })).toBeInTheDocument()
    expect(stageTabs().getAllByRole("tab").map((t) => t.textContent)).toEqual(["All61", "Opt-in41", "Application12", "Booking5"])
    expect(stageTabs().getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true")
    // One page of the whole client; nothing per stage.
    expect(new Set(leadKeys())).toEqual(new Set(["/api/leads/unified?groups=cc&page=1&limit=500&start_date=" + leadKeys()[0].split("start_date=")[1]]))
    expect(leadKeys().some((k) => k.includes("stage_id"))).toBe(false)
  })

  it("lists every lead as a sheet row with its real stage name and contact details", () => {
    show("client=cc")
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(heads.slice(0, 10)).toEqual(["Name", "Stage", "Email", "Phone", "Added", "Came from", "Calls", "Value", "Tags", ""])
    const ben = screen.getAllByRole("row").find((r) => r.textContent.includes("Ben Ode"))
    expect(within(ben).getByText("Application")).toBeInTheDocument()
    expect(within(ben).getByText("ben@mail.test")).toBeInTheDocument()
    expect(names()).toHaveLength(3)
    expect(screen.getByText("61 leads")).toBeInTheDocument()
  })

  it("asks the server for a picked stage's leads and keeps it in the address", async () => {
    show("client=cc")
    await userEvent.click(stageTabs().getByRole("tab", { name: /^Application/ }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&stage=s2")
    expect(leadKeys().some((k) => k.includes("stage_id=s2") && k.includes("page=1"))).toBe(true)
    expect(names()).toEqual(["Ben Ode"])
    expect(stageTabs().getByRole("tab", { name: /^Application/ })).toHaveAttribute("aria-selected", "true")
    // The counts stay the whole client's.
    expect(stageTabs().getByRole("tab", { name: /^All/ }).textContent).toBe("All61")
  })

  it("offers a pipeline picker when the client has two, opening on the one with the most leads", async () => {
    swr.answer = (key) => (key.startsWith("/api/leads/unified") ? page([ANN, BEN, CAT], { total_contacts: 61, pipelines: [REACTIVATION, MAIN] }) : undefined)
    show("client=cc")
    expect(screen.getByRole("button", { name: "Pipeline: Main funnel" })).toBeInTheDocument()
    expect(stageTabs().getAllByRole("tab").map((t) => t.textContent)).toEqual(["All61", "Opt-in41", "Application12", "Booking5"])
    await userEvent.click(screen.getByRole("button", { name: "Pipeline: Main funnel" }))
    await userEvent.click(screen.getByRole("menuitem", { name: /Reactivation/ }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&pipeline=p2")
    expect(stageTabs().getAllByRole("tab").map((t) => t.textContent)).toEqual(["All61", "Re-engaged3"])
    // Each row shows its deal in the picked pipeline.
    const cat = screen.getAllByRole("row").find((r) => r.textContent.includes("Cat Roe"))
    expect(within(cat).getByText("Re-engaged")).toBeInTheDocument()
  })

  it("has no picker with one pipeline", () => {
    show("client=cc")
    expect(screen.queryByRole("button", { name: /^Pipeline:/ })).toBeNull()
  })

  it("falls back to Birdy's own stage tabs when the backend sends no pipelines", () => {
    swr.answer = (key) => (key.startsWith("/api/leads/unified") ? page([ANN, BEN, CAT]) : undefined)
    show("client=cc&stage=s2")
    expect(stageTabs().getAllByRole("tab").map((t) => t.textContent)).toEqual(["All3", "In CRM2", "Called0", "Closed1", "Lost0"])
    // A stage left in the address means nothing without pipelines; it is not sent.
    expect(leadKeys().some((k) => k.includes("stage_id"))).toBe(false)
    expect(names()).toHaveLength(3)
  })

  it("opens a lead on its own page", async () => {
    show("client=cc")
    await userEvent.click(screen.getByText("Ann Lee"))
    expect(push).toHaveBeenLastCalledWith("/contacts/ann")
  })

  it("shows the client's Ads and Calls tables", async () => {
    swr.answer = (key) => {
      if (key.startsWith("/api/leads/unified")) return page([ANN], { pipelines: [MAIN] })
      if (key.startsWith("/api/hotprospector/call-center")) return { data: [{ id: "h1", first_name: "Ann", last_name: "Lee", call_logs: [{ caller_name: "Sam", duration: 75, call_time_iso: "2026-11-21T09:00:00Z" }] }] }
      return undefined
    }
    show("client=cc")
    const views = within(screen.getByRole("tablist", { name: "Confidence Clinic’s tables" }))
    expect(views.getAllByRole("tab").map((t) => t.textContent.replace(/\d+$/, ""))).toEqual(["Leads", "Ads", "Calls"])
    await userEvent.click(views.getByRole("tab", { name: /^Ads/ }))
    expect(replace).toHaveBeenLastCalledWith("/dashboard/table?client=cc&view=ads")
    expect(screen.getByText("Before and after")).toBeInTheDocument()
    expect(screen.queryByRole("tablist", { name: "Leads by stage" })).toBeNull()
    show("client=cc&view=calls")
    expect(screen.getByRole("columnheader", { name: /Caller/ })).toBeInTheDocument()
    expect(screen.getByText("Sam")).toBeInTheDocument()
  })

  it("keeps the client when another tab is picked", async () => {
    show("client=cc&range=last_30d&stage=s2")
    await userEvent.click(within(screen.getByRole("tablist", { name: "Agency Ops views" })).getByRole("tab", { name: /Bird's Eye/ }))
    expect(push).toHaveBeenLastCalledWith("/dashboard?client=cc&range=last_30d")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Client workspace ────────────────────────────────────────────────────────
// A PageHeader with a back crumb over underline tabs. Overview is goals, the
// ds MetricTabsChart, the segmented FunnelBar and Birdy's read for this one
// client, then the history book.

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "g1" }),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }))
vi.mock("@/app/dashboard/useDashboardData", () => ({ useDashboardData: vi.fn() }))
vi.mock("@/hooks/useCurrency", () => ({ useCurrency: () => ({ currency: "GBP", currencySymbol: "£" }) }))
vi.mock("@/lib/useLandingFunnel", () => ({
  useLandingFunnel: () => ({ funnel: { applicable: false }, loading: false, error: null }),
}))
// Other hubs' content and shared forms are not this page's concern.
vi.mock("@/components/campaigns/MarketingContent", () => ({ MarketingContent: () => <div>marketing content</div> }))
vi.mock("@/components/contacts/LeadsContent", () => ({ LeadsContent: () => <div>leads content</div> }))
vi.mock("@/components/contacts/LeadHubOverview", () => ({ LeadHubOverview: () => null }))
vi.mock("@/components/callcenter/CallCentreContent", () => ({ CallCentreContent: () => <div>call centre content</div> }))
vi.mock("@/components/saleshub/CallCentreOverview", () => ({ CallCentreOverview: () => null }))
vi.mock("@/components/integrations/IntegrationsContent", () => ({ default: () => <div>integrations content</div> }))
vi.mock("@/components/clients/ClientTargetsForm", () => ({ ClientTargetsForm: () => <div>targets form</div> }))
vi.mock("@/components/clients/ClientAskBirdy", () => ({
  ClientAskBirdy: ({ initialMessage }) => <div>ask birdy tab {initialMessage}</div>,
}))

import { apiRequest } from "@/lib/api"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import { useDashboardData } from "@/app/dashboard/useDashboardData"
import ClientDetailsPage from "../page"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const GROUP = {
  id: "g1",
  name: "Glow Clinic",
  targets: { cpl: 10 },
  call_log_provider: "ghl",
  facebook: { currency: "GBP", metrics: { insights: { spend: 240, results: 20 } }, daily_spend: [] },
  gohighlevel: {
    metrics: { funnel: { leads: 100, in_crm: 70, called: 40, closes: 5, won_revenue: 900 } },
    daily_leads: [
      { date: "2026-10-01", new_leads: 10, won: 1 },
      { date: "2026-10-02", new_leads: 12, won: 0 },
    ],
  },
}

const DETAIL = {
  data: {
    group_info: { name: "Glow Clinic", client_status: "Active", health: "Warning", created_at: "2025-03-04T00:00:00Z" },
    meta_data: {},
  },
}

const groups = vi.fn()
function setup() {
  vi.mocked(useClientGroupsWithSeries).mockImplementation(() => ({
    clientGroups: [GROUP],
    loading: false,
    error: null,
    refresh: vi.fn(),
    invalidate: vi.fn(),
    datePreset: "last_30d",
    setDatePreset: groups,
  }))
  vi.mocked(useDashboardData).mockReturnValue({ activity: [], loading: false })
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    if (url === "/api/client-groups/g1") return { ok: true, json: async () => DETAIL }
    if (String(url).endsWith("/notes")) return { ok: true, json: async () => ({ notes: [] }) }
    return { ok: true, json: async () => ({ client_groups: [] }) }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setup()
})

describe("/clients/[id]", () => {
  it("renders a PageHeader with the client's name and a back crumb", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    expect(await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })).toBeInTheDocument()
    expect(document.querySelector('[data-ds="page-header"]')).toHaveTextContent("Client since Mar 2025")
    await user.click(screen.getByRole("button", { name: /back to clients/i }))
    expect(push).toHaveBeenCalledWith("/clients")
  })

  it("shows the manual health in the header", async () => {
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    expect(within(document.querySelector('[data-ds="page-header"]')).getByText("Warning")).toBeInTheDocument()
  })

  it("has five underline tabs and opens on Overview", async () => {
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    const tabs = screen.getAllByRole("tab").filter((t) => t.getAttribute("data-slot") === "tabs-trigger")
    expect(tabs.map((t) => t.textContent)).toEqual(["Overview", "Ask Birdy", "Marketing", "Call Centre", "Leads"])
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    expect(document.querySelector('[data-ds="tabs"]')).not.toBeNull()
  })

  it("overview draws goals, the metric chart, the funnel bar and Birdy's read from ds", async () => {
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })

    expect(document.querySelector('[data-ds="goals-strip"]')).not.toBeNull()
    expect(document.querySelector('[data-ds="metric-tabs-chart"]')).not.toBeNull()
    const bar = document.querySelector('[data-ds="funnel-bar"]')
    expect(bar).not.toBeNull()
    expect(bar).toHaveTextContent("100")
    const read = document.querySelector('[data-ds="birdy-read"]')
    expect(read).not.toBeNull()
    // £240 over 20 leads is £12 against a £10 target: at risk.
    expect(within(read).getByText("Cost per lead is at risk")).toBeInTheDocument()
    expect(within(read).getByText("100 leads from £240 of ad spend")).toBeInTheDocument()
    expect(document.querySelector("input[aria-label='Add a note']")).not.toBeNull()
  })

  it("the chart switches metric tabs", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    const chart = document.querySelector('[data-ds="metric-tabs-chart"]')
    expect(within(chart).getAllByRole("tab")).toHaveLength(4)
    await user.click(within(chart).getByRole("tab", { name: /Spend/ }))
    expect(within(chart).getByRole("tab", { name: /Spend/ })).toHaveAttribute("aria-selected", "true")
  })

  it("Birdy's read sends its question to the client's own Ask Birdy tab", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    await user.click(screen.getByRole("button", { name: /Ask Birdy about this/ }))
    expect(await screen.findByText(/ask birdy tab/)).toHaveTextContent("Glow Clinic is")
  })

  it("moves between tabs", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    await user.click(screen.getByRole("tab", { name: "Marketing" }))
    expect(await screen.findByText("marketing content")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Leads" }))
    expect(await screen.findByText("leads content")).toBeInTheDocument()
  })

  it("the period control changes the window", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    await user.click(screen.getByRole("tab", { name: "7 days" }))
    expect(groups).toHaveBeenCalledWith("last_7d")
  })

  it("opens the settings dialog on Details and offers the other sections", async () => {
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    await screen.findByRole("heading", { level: 1, name: "Glow Clinic" })
    await user.click(screen.getByRole("button", { name: "Client settings" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Client Status")).toBeInTheDocument()
    expect(within(dialog).getByText("Danger Zone")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("tab", { name: "Targets" }))
    expect(within(dialog).getByText("targets form")).toBeInTheDocument()
  })

  it("an unknown client shows a not-found EmptyState with a way back", async () => {
    vi.mocked(apiRequest).mockImplementation(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    const user = userEvent.setup()
    render(<ClientDetailsPage />)
    expect(await screen.findByText("Client not found")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="empty-state"]')).not.toBeNull()
    // The crumb and the empty state's own action both lead back.
    const [, action] = screen.getAllByRole("button", { name: /back to clients/i })
    await user.click(action)
    expect(push).toHaveBeenCalledWith("/clients")
  })

  it("while the client loads the header holds its place and the charts skeleton", () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}))
    vi.mocked(useClientGroupsWithSeries).mockImplementation(() => ({
      clientGroups: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
      invalidate: vi.fn(),
      datePreset: "last_30d",
      setDatePreset: groups,
    }))
    render(<ClientDetailsPage />)
    expect(document.querySelector('[data-ds="page-header"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-ds="skeleton"]').length).toBeGreaterThan(0)
  })
})

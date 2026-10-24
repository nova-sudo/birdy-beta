import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Marketing Hub ───────────────────────────────────────────────────────────
// Level tabs over a ds DataTable, the hero MetricTabsChart + BirdyRead, the
// drill-down, row selection and the status toggle.

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
const views = vi.hoisted(() => ({
  savedColumns: null, saveView: vi.fn(), saveViewDebounced: vi.fn(), viewsLoaded: true,
}))
vi.mock("@/lib/useColumnViews", () => ({ useColumnViews: () => views }))
vi.mock("@/lib/usePageViews", () => ({
  usePageViews: () => ({ views: [], activeViewId: null, activeView: null, applyView: vi.fn(), createView: vi.fn(), updateView: vi.fn(), deleteView: vi.fn() }),
}))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/lib/useLandingFunnel", () => ({
  useLandingFunnel: () => ({ funnel: null, loading: false, error: null }),
}))
vi.mock("@/components/attribution/LandingFunnel", () => ({ LandingFunnel: () => null }))
vi.mock("@/hooks/useCurrency", () => ({ useCurrency: () => ({ currency: "GBP", currencySymbol: "£" }) }))

const hub = vi.hoisted(() => ({
  current: { cpl: 10 },
  kpis: [
    { key: "activeCampaigns", label: "Active campaigns", value: "2", polarity: "higher-is-better" },
    { key: "spend", label: "Total ad spend", value: "£300.00", polarity: "higher-is-better", direction: "up", delta: "12%" },
    { key: "leads", label: "Total leads", value: "30", polarity: "higher-is-better" },
    { key: "cpl", label: "Average CPL", value: "£10.00", polarity: "lower-is-better" },
    { key: "impressions", label: "Impressions", value: "9K", polarity: "higher-is-better" },
    { key: "ctr", label: "Average CTR", value: "1.00%", polarity: "higher-is-better" },
  ],
  insight: { segments: [{ text: "Spend is up " }, { text: "12%", strong: true }, { text: "." }] },
  findings: [{ tone: "warning", parts: [{ text: "Alpha", strong: true }, { text: " runs above the blended CPL." }] }],
  chartMetrics: {
    spend: { values: [1, 2], labels: ["a", "b"], tooltipLabels: ["A", "B"], valuePrefix: "£", decimals: 2, coverage: "Line covers 2 of 7 days." },
    leads: { values: [1, 2], labels: ["a", "b"], tooltipLabels: ["A", "B"] },
    cpl: { values: [1, 2], labels: ["a", "b"], tooltipLabels: ["A", "B"] },
    impressions: { values: [], labels: [], tooltipLabels: [] },
  },
  seriesLoading: false,
  unlistedSpend: null,
}))
vi.mock("@/components/campaigns/useMarketingHubData", () => ({ useMarketingHubData: () => hub }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { MarketingContent } from "@/components/campaigns/MarketingContent"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

const GROUPS = [
  {
    id: "g1", name: "Acme", client_status: "active",
    facebook: {
      ad_account_id: "act_1", currency: "GBP",
      metrics: { insights: { spend: 300 } },
      campaigns: [
        { id: "c1", name: "Alpha campaign", status: "ACTIVE", spend: 200, results: 20, impressions: 5000, clicks: 50, reach: 4000 },
        { id: "c2", name: "Beta campaign", status: "PAUSED", spend: 100, results: 10, impressions: 4000, clicks: 40, reach: 3000 },
      ],
      adsets: [
        { id: "s1", campaign_id: "c1", name: "Alpha set", status: "ACTIVE", spend: 150, results: 15 },
        { id: "s2", campaign_id: "c2", name: "Beta set", status: "PAUSED", spend: 100, results: 10 },
      ],
      ads: [
        { id: "a1", campaign_id: "c1", adset_id: "s1", name: "Alpha ad", status: "ACTIVE", spend: 90, results: 9, creative_image: "https://cdn.example/a1.jpg" },
      ],
    },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  views.savedColumns = null
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith("/api/facebook/update-status")) return { ok: true, json: async () => ({}) }
    if (u.startsWith("/api/facebook-leads/filtered")) return { ok: true, json: async () => ({ leads: [] }) }
    if (u.startsWith("/api/custom-metrics")) return { ok: true, json: async () => ({ custom_metrics: [] }) }
    return { ok: true, json: async () => ({}) }
  })
})

const renderHub = (props = {}) =>
  render(
    <MarketingContent
      clientGroups={GROUPS}
      groupsLoading={false}
      groupsError={null}
      datePreset="last_7d"
      setDatePreset={vi.fn()}
      showGroupFilter
      showHeader
      onCacheInvalidate={vi.fn()}
      {...props}
    />
  )

// The table and its stacked cards are both in the DOM; read the table.
const inTable = () => within(screen.getByRole("table"))

describe("MarketingContent", () => {
  it("renders the Marketing Hub header, hero chart, Birdy's read and the ds table", async () => {
    const { container } = renderHub()

    expect(screen.getByRole("heading", { name: "Marketing Hub" })).toBeInTheDocument()
    expect(container.querySelector('[data-ds="page-header"]')).toBeInTheDocument()
    expect(container.querySelector('[data-ds="metric-tabs-chart"]')).toBeInTheDocument()
    expect(container.querySelector('[data-ds="birdy-read"]')).toBeInTheDocument()
    expect(container.querySelector('[data-ds="data-table"]')).toBeInTheDocument()

    // The four plottable figures are tabs; active campaigns and CTR are not.
    const chartTabs = within(screen.getByRole("tablist", { name: "Chart metric" })).getAllByRole("tab")
    expect(chartTabs.map((t) => t.textContent)).toEqual([
      expect.stringContaining("Total ad spend"),
      expect.stringContaining("Total leads"),
      expect.stringContaining("Average CPL"),
      expect.stringContaining("Impressions"),
    ])
    expect(screen.getByText("Line covers 2 of 7 days.")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()

    await waitFor(() => expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument())
  })

  it("lists campaigns spend-first with a select box and status switch per row", async () => {
    renderHub()
    await waitFor(() => expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument())

    const rows = inTable().getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Alpha Campaign")
    expect(rows[1]).toHaveTextContent("Beta Campaign")
    expect(inTable().getByRole("switch", { name: /Pause Alpha campaign/ })).toHaveAttribute("aria-checked", "true")
    expect(inTable().getByRole("switch", { name: /Activate Beta campaign/ })).toHaveAttribute("aria-checked", "false")
  })

  it("drills campaign -> ad sets on a row click and shows the breadcrumb", async () => {
    const user = userEvent.setup()
    renderHub()
    await waitFor(() => expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument())

    await user.click(inTable().getByText("Alpha Campaign"))

    expect(screen.getByRole("tab", { name: /Ad Sets/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Filtering by:")).toBeInTheDocument()
    expect(inTable().getByText("Alpha Set")).toBeInTheDocument()
    expect(inTable().queryByText("Beta Set")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear campaign filter" }))
    expect(screen.queryByText("Filtering by:")).not.toBeInTheDocument()
    expect(inTable().getByText("Beta Set")).toBeInTheDocument()
  })

  it("selecting a campaign row narrows the ad sets without drilling", async () => {
    const user = userEvent.setup()
    renderHub()
    await waitFor(() => expect(inTable().getByText("Beta Campaign")).toBeInTheDocument())

    await user.click(inTable().getByRole("checkbox", { name: "Select Beta campaign" }))
    // The box does not drill.
    expect(screen.getByRole("tab", { name: /Campaigns/ })).toHaveAttribute("aria-selected", "true")

    await user.click(screen.getByRole("tab", { name: /Ad Sets/ }))
    expect(inTable().getByText("Beta Set")).toBeInTheDocument()
    expect(inTable().queryByText("Alpha Set")).not.toBeInTheDocument()
  })

  it("toggles a campaign's status through the same endpoint and does not drill", async () => {
    const user = userEvent.setup()
    renderHub()
    await waitFor(() => expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument())

    await user.click(inTable().getByRole("switch", { name: /Pause Alpha campaign/ }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Campaign paused"))
    const call = vi.mocked(apiRequest).mock.calls.find(([u]) => u === "/api/facebook/update-status")
    expect(JSON.parse(call[1].body)).toEqual({ object_id: "c1", object_type: "campaign", status: "PAUSED" })
    expect(screen.getByRole("tab", { name: /Campaigns/ })).toHaveAttribute("aria-selected", "true")
  })

  it("switches the Ads tab between the table and the gallery", async () => {
    const user = userEvent.setup()
    const { container } = renderHub()
    await user.click(screen.getByRole("tab", { name: /^Ads/ }))

    expect(screen.getByRole("radio", { name: "Table view" })).toHaveAttribute("aria-checked", "true")
    await user.click(screen.getByRole("radio", { name: "Gallery view" }))

    expect(container.querySelector('[data-slot="ads-gallery-card"]')).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Alpha ad" })).toBeInTheDocument()
  })

  it("filters rows by search and says so when nothing matches", async () => {
    const user = userEvent.setup()
    renderHub()
    await waitFor(() => expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument())

    await user.type(screen.getByRole("searchbox", { name: "Search campaigns" }), "zzz")
    expect(screen.getByText("No campaigns match")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(inTable().getByText("Alpha Campaign")).toBeInTheDocument()
  })

  it("warns when a single active client's Meta connection has lapsed", async () => {
    const user = userEvent.setup()
    renderHub({ clientGroups: [{ ...GROUPS[0], meta_token_error: true }] })
    expect(screen.queryByText(/Meta connection has expired/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Client group" }))
    await user.click(await screen.findByRole("option", { name: "Acme" }))

    expect(await screen.findByText(/Meta connection has expired/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reconnect Meta" })).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("shows a retryable error when the client groups failed to load", async () => {
    const user = userEvent.setup()
    const onCacheInvalidate = vi.fn()
    renderHub({ groupsError: "Network down", onCacheInvalidate })

    expect(screen.getByText("Couldn't load your client data")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Try again/ }))
    expect(onCacheInvalidate).toHaveBeenCalled()
  })

  it("draws no header or group picker when embedded", () => {
    const { container } = renderHub({ showHeader: false, showGroupFilter: false })
    expect(screen.queryByRole("heading", { name: "Marketing Hub" })).not.toBeInTheDocument()
    expect(container.querySelector('[data-ds="page-header"]')).not.toBeInTheDocument()
  })
})

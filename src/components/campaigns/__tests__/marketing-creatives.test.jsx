import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

let search = ""
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/campaigns",
}))
vi.mock("@/components/creatives/CreativesTab", () => ({
  CreativesTab: ({ clientGroupId }) => <div data-testid="creatives-tab">tab:{String(clientGroupId)}</div>,
}))
vi.mock("@/components/creatives/CreativesHero", () => ({
  CreativesHero: ({ clientGroupId }) => <div data-testid="creatives-hero">hero:{String(clientGroupId)}</div>,
}))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}))
vi.mock("@/lib/useColumnViews", () => ({
  useColumnViews: () => ({ savedColumns: null, saveView: vi.fn(), saveViewDebounced: vi.fn(), viewsLoaded: true }),
}))
vi.mock("@/components/campaigns/useMarketingHubData", () => ({
  useMarketingHubData: () => ({
    current: {},
    kpis: [],
    insight: null,
    findings: [],
    chartMetrics: {},
    seriesLoading: false,
    unlistedSpend: null,
  }),
}))
vi.mock("@/lib/useLandingFunnel", () => ({
  useLandingFunnel: () => ({ funnel: null, loading: false, error: null }),
}))
vi.mock("@/components/attribution/LandingFunnel", () => ({ LandingFunnel: () => <div data-testid="funnel" /> }))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))
vi.mock("@/hooks/useCurrency", () => ({ useCurrency: () => ({ currency: "GBP", currencySymbol: "£" }) }))

import { MarketingContent } from "../MarketingContent"

const groups = [{ id: "g1", name: "Only client" }]
const mount = (props = {}) =>
  render(
    <MarketingContent
      clientGroups={groups}
      groupsLoading={false}
      datePreset="last_30_days"
      setDatePreset={() => {}}
      showGroupFilter={false}
      showHeader={false}
      {...props}
    />
  )

beforeEach(() => {
  search = ""
})

describe("MarketingContent creatives tab", () => {
  it("keeps search on the table tabs", () => {
    mount()
    expect(screen.getByPlaceholderText(/Search campaigns/)).toBeInTheDocument()
    expect(screen.queryByTestId("creatives-tab")).toBeNull()
  })

  it("?tab=creatives selects the tab, hides search and the funnel, scopes to the only group", async () => {
    search = "tab=creatives"
    mount()
    expect(await screen.findByTestId("creatives-tab")).toHaveTextContent("tab:g1")
    expect(screen.getByTestId("creatives-hero")).toHaveTextContent("hero:g1")
    expect(screen.queryByPlaceholderText(/Search/)).toBeNull()
    expect(screen.queryByTestId("funnel")).toBeNull()
  })

  it("several groups and no pick means all (undefined)", async () => {
    search = "tab=creatives"
    mount({ clientGroups: [...groups, { id: "g2", name: "Two" }] })
    expect(await screen.findByTestId("creatives-tab")).toHaveTextContent("tab:undefined")
  })
})

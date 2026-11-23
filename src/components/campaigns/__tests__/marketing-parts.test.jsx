import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// MarketingContent in halves, as Media Buyer's Bird's Eye (the hero) and Dashboard (the table) draw it.

let search = ""
const hub = { args: null }
const api = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
const askBirdy = vi.fn()
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/media-buyer",
}))
vi.mock("@/components/creatives/CreativesTab", () => ({ CreativesTab: () => <div data-testid="creatives-tab" /> }))
vi.mock("@/components/creatives/CreativesHero", () => ({ CreativesHero: () => <div data-testid="creatives-hero" /> }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => api(...a) }))
vi.mock("@/lib/ask-birdy", () => ({ askBirdy: (...a) => askBirdy(...a) }))
vi.mock("@/lib/useColumnViews", () => ({
  useColumnViews: () => ({ savedColumns: null, saveView: vi.fn(), saveViewDebounced: vi.fn(), viewsLoaded: true }),
}))
vi.mock("@/components/campaigns/useMarketingHubData", () => ({
  useMarketingHubData: (args) => {
    hub.args = args
    return {
      current: {}, kpis: [], findings: [], chartMetrics: {}, seriesLoading: false, unlistedSpend: null,
      insight: { segments: [{ text: "Spend is up " }, { text: "17.7%", strong: true }] },
    }
  },
}))
vi.mock("@/lib/useLandingFunnel", () => ({ useLandingFunnel: () => ({ funnel: null, loading: false, error: null }) }))
vi.mock("@/components/attribution/LandingFunnel", () => ({ LandingFunnel: () => <div data-testid="funnel" /> }))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))
vi.mock("@/hooks/useCurrency", () => ({ useCurrency: () => ({ currency: "GBP", currencySymbol: "£" }) }))

import { MarketingContent } from "../MarketingContent"

const groups = [{ id: "g1", name: "One" }, { id: "g2", name: "Two" }]
const mount = (props = {}) =>
  render(
    <MarketingContent clientGroups={groups} groupsLoading={false} datePreset="last_7d" showGroupFilter={false} showHeader={false} {...props} />
  )
const fetched = (part) => api.mock.calls.map(([url]) => url).filter((url) => url.includes(part))

beforeEach(() => {
  search = ""
  hub.args = null
  vi.clearAllMocks()
})

describe("MarketingContent's hero half", () => {
  it("draws Birdy's read and the funnel, and no table", () => {
    mount({ part: "hero" })
    expect(screen.getByRole("region", { name: "Birdy's read" })).toBeInTheDocument()
    expect(screen.getByTestId("funnel")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Search campaigns/)).toBeNull()
  })

  it("fetches nothing only the table needs, and the series the hero does", () => {
    mount({ part: "hero" })
    expect(fetched("/api/facebook-leads/filtered")).toHaveLength(0)
    expect(fetched("/api/campaigns/opp-rollup")).toHaveLength(0)
    expect(fetched("/api/campaigns/tag-rollup")).toHaveLength(0)
    expect(hub.args.withSeries).toBe(true)
  })

  it("takes the client and the granularity it is given", () => {
    mount({ part: "hero", selectedClientGroup: "g2", granularity: "Weekly" })
    expect(hub.args).toMatchObject({ selectedClientGroup: "g2", granularity: "Weekly" })
  })

  it("sends “Ask Birdy about this” where it is told to, not to the global modal", async () => {
    const onAskBirdy = vi.fn()
    mount({ part: "hero", onAskBirdy })
    await userEvent.click(screen.getByRole("button", { name: /Ask Birdy about this/ }))
    expect(onAskBirdy).toHaveBeenCalledWith(expect.stringContaining("17.7%"))
    expect(askBirdy).not.toHaveBeenCalled()
  })

  it("stays on the hero when the address asks for Creatives", () => {
    search = "tab=creatives"
    mount({ part: "hero" })
    expect(screen.queryByTestId("creatives-hero")).toBeNull()
    expect(screen.getByRole("region", { name: "Birdy's read" })).toBeInTheDocument()
  })
})

describe("MarketingContent's table half", () => {
  it("draws the tabs and the table, and no hero", () => {
    mount({ part: "table", fill: true })
    expect(screen.getByPlaceholderText(/Search campaigns/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Columns/ })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Birdy's read" })).toBeNull()
    expect(screen.queryByTestId("funnel")).toBeNull()
  })

  it("fetches the leads and the roll-ups, and skips the hero's series", () => {
    mount({ part: "table" })
    expect(fetched("/api/facebook-leads/filtered")).toHaveLength(1)
    expect(fetched("/api/campaigns/opp-rollup")).toHaveLength(1)
    expect(hub.args.withSeries).toBe(false)
  })
})

describe("MarketingContent whole, as /campaigns draws it", () => {
  it("still has both halves and the global Ask Birdy", async () => {
    mount()
    expect(screen.getByRole("region", { name: "Birdy's read" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Search campaigns/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Ask Birdy about this/ }))
    expect(askBirdy).toHaveBeenCalledWith(expect.stringContaining("17.7%"))
  })
})

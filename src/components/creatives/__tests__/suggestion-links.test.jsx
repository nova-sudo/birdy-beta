import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
const nav = { search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const fns = vi.hoisted(() => ({
  pauseCreativeAds: vi.fn(async () => ({})),
  retryCreativeAd: vi.fn(async () => ({})),
  applyWorkItem: vi.fn(),
  confirm: vi.fn(),
}))
const ACCOUNTS = vi.hoisted(() => [
  { ad_account_id: "act_1", currency: "GBP", clients: [{ id: "g1", name: "Harbour" }] },
  { ad_account_id: "act_2", currency: "GBP", clients: [{ id: "g2", name: "Keystone" }] },
  { ad_account_id: "act_3", currency: "GBP", clients: [{ id: "g3", name: "Linden" }] },
])
const NONE = vi.hoisted(() => [])
const state = vi.hoisted(() => ({ test: null }))
const tabTests = vi.hoisted(() => ({ list: [] }))

vi.mock("@/lib/creatives-api", () => ({
  pauseCreativeAds: (...a) => fns.pauseCreativeAds(...a),
  retryCreativeAd: (...a) => fns.retryCreativeAd(...a),
  useCreativeTests: (f) => ({ tests: f?.status === "archived" ? [] : tabTests.list, isLoading: false }),
  useCreativeTest: () => ({ test: state.test, isLoading: false, error: null }),
  updateCreativeTest: vi.fn(),
  createCreativeTest: vi.fn(),
  postCreativeTest: vi.fn(),
  addCreativeAccounts: vi.fn(),
  goLiveCreativeTest: vi.fn(),
  useCreativeTargetsPrefill: () => ({ prefill: null, isLoading: false }),
  useCreativeAdAccounts: () => ({ accounts: ACCOUNTS, isLoading: false, error: null }),
  useCreativeAdsets: () => ({ adsets: NONE, isLoading: false, error: null }),
  useCreativePages: () => ({ pages: NONE, isLoading: false, error: null }),
  useCreativeLeadForms: () => ({ forms: NONE, isLoading: false, error: null }),
}))
vi.mock("@/lib/agents-api", async (orig) => ({ ...(await orig()), applyWorkItem: (...a) => fns.applyWorkItem(...a) }))
vi.mock("@/components/ds", async (orig) => ({ ...(await orig()), confirm: (...a) => fns.confirm(...a) }))
vi.mock("@/lib/view-catalogues", () => ({ useRememberViewCatalogue: () => {} }))
vi.mock("@/lib/usePageViews", () => ({ usePageViews: () => ({ views: [] }) }))
vi.mock("@/components/views/ColumnsMenu", () => ({ default: () => <button type="button">Columns</button> }))
vi.mock("@/lib/creative-upload", () => ({ uploadCreativeMedia: vi.fn() }))

import { CreativesTab } from "../CreativesTab"
import { CreativeDetailSheet } from "../CreativeDetailSheet"
import { CreativeWizard } from "../wizard/CreativeWizard"
import { SuggestionCard } from "@/components/portfolio/SuggestionCard"
import { WorkItem } from "@/components/agents/WorkItem"

const ads = [
  { id: "r1", ad_account_id: "act_1", client: "Harbour", post_state: "active", score: { state: "fail", cpl: 60 }, meta: {} },
  { id: "r2", ad_account_id: "act_2", client: "Keystone", post_state: "failed", post_error: "boom", score: {}, meta: {} },
]
const baseTest = {
  id: "t1",
  code: "CT-0001",
  name: "Mortgage myth",
  slug: "mortgage-myth",
  origin: "new",
  status: "testing",
  creative: { format: "video", destination: "website", website_url: "https://x.co", media: { blob_url: "https://b/x" }, accounts: [] },
  targets: {},
  summary: { currency: "GBP", spend: 10, leads: 1, cpl: 10 },
  ads,
}

afterEach(cleanup)

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  vi.clearAllMocks()
  nav.search = ""
  state.test = baseTest
  fns.confirm.mockResolvedValue(true)
})

describe("row actions", () => {
  async function expandAndClick(name) {
    tabTests.list = [baseTest]
    const user = userEvent.setup()
    render(<CreativesTab />)
    await user.click(screen.getAllByRole("button", { name: "Expand Mortgage myth" })[0])
    await user.click((await screen.findAllByRole("button", { name }))[0])
    return user
  }

  it("Pause confirms, then pauses only that account", async () => {
    await expandAndClick("Pause here")
    await waitFor(() => expect(fns.pauseCreativeAds).toHaveBeenCalledWith("t1", ["act_1"]))
    expect(fns.confirm.mock.invocationCallOrder[0]).toBeLessThan(fns.pauseCreativeAds.mock.invocationCallOrder[0])
  })

  it("Pause does nothing when the confirm is declined", async () => {
    fns.confirm.mockResolvedValue(false)
    await expandAndClick("Pause here")
    await waitFor(() => expect(fns.confirm).toHaveBeenCalled())
    expect(fns.pauseCreativeAds).not.toHaveBeenCalled()
  })

  it("Retry re-queues that ad", async () => {
    await expandAndClick("Retry")
    await waitFor(() => expect(fns.retryCreativeAd).toHaveBeenCalledWith("t1", "r2"))
  })
})

describe("detail sheet", () => {
  it("Pause everywhere confirms, then pauses with no account list", async () => {
    render(<CreativeDetailSheet testId="t1" open onOpenChange={vi.fn()} />)
    await userEvent.click(await screen.findByRole("button", { name: "Pause everywhere" }))
    await waitFor(() => expect(fns.pauseCreativeAds).toHaveBeenCalledWith("t1"))
    expect(fns.confirm).toHaveBeenCalled()
  })
})

describe("suggestion links", () => {
  const s = { id: "s1", severity: "HIGH", client: "Harbour", title: "Pause CT-0001 in Harbour", why: "CPL high", creative_test_id: "t1" }

  it("SuggestionCard links a creative suggestion to its test", () => {
    render(<SuggestionCard suggestion={s} onApply={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByRole("link", { name: s.title })).toHaveAttribute("href", "/campaigns?tab=creatives&creative=t1")
  })

  it("SuggestionCard leaves other titles plain", () => {
    render(<SuggestionCard suggestion={{ ...s, creative_test_id: null }} onApply={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("WorkItem links the title and follows an apply redirect", async () => {
    fns.applyWorkItem.mockResolvedValue({ ok: true, redirect: "/campaigns/creatives/new?scale=t1" })
    const item = { ...s, status: "open", rule_kind: "revive_winner", rule_mode: "ask", has_action: true, description: "d", stats: [] }
    render(<WorkItem item={item} />)
    expect(screen.getByRole("link", { name: s.title })).toHaveAttribute("href", "/campaigns?tab=creatives&creative=t1")
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/campaigns/creatives/new?scale=t1"))
  })
})

describe("?scale=", () => {
  it("pre-checks only the accounts the test does not run in", async () => {
    nav.search = "scale=t1"
    render(<CreativeWizard testId={null} />)
    expect(await screen.findByRole("checkbox", { name: "Select Keystone" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Linden" })).toBeChecked()
    // The account the test already runs in stays locked, not part of the new selection.
    expect(screen.getByRole("checkbox", { name: "Select Harbour" })).toBeDisabled()
  })
})

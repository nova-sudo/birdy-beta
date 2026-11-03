import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
const nav = { search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

const api = { test: null }
const fns = {
  updateCreativeTest: vi.fn(async (id, body) => ({ id, ...body })),
  createCreativeTest: vi.fn(),
  postCreativeTest: vi.fn(),
  addCreativeAccounts: vi.fn(async () => ({ queued: 1 })),
}
// Stable references, like the real hooks: a fresh array per render would loop the step's effects.
const ACCOUNTS = vi.hoisted(() => [
  { ad_account_id: "act_1", currency: "GBP", clients: [{ id: "g1", name: "Harbour" }] },
  { ad_account_id: "act_2", currency: "GBP", clients: [{ id: "g2", name: "Keystone" }] },
])
const ADSETS = vi.hoisted(() => [{ id: "s2", name: "Birdy tests", compatible: true, owning_client_group_id: "g2" }])
const PAGES = vi.hoisted(() => [{ id: "p2", name: "Page Two" }])
const NONE = vi.hoisted(() => [])
vi.mock("@/lib/creatives-api", () => ({
  updateCreativeTest: (...a) => fns.updateCreativeTest(...a),
  createCreativeTest: (...a) => fns.createCreativeTest(...a),
  postCreativeTest: (...a) => fns.postCreativeTest(...a),
  addCreativeAccounts: (...a) => fns.addCreativeAccounts(...a),
  goLiveCreativeTest: vi.fn(),
  retryCreativeAd: vi.fn(),
  useCreativeTest: () => ({ test: api.test, isLoading: false, error: null }),
  useCreativeTargetsPrefill: () => ({ prefill: null, isLoading: false }),
  useCreativeAdAccounts: () => ({ accounts: ACCOUNTS, isLoading: false, error: null }),
  useCreativeAdsets: () => ({ adsets: ADSETS, isLoading: false, error: null }),
  useCreativePages: () => ({ pages: PAGES, isLoading: false, error: null }),
  useCreativeLeadForms: () => ({ forms: NONE, isLoading: false, error: null }),
}))
vi.mock("@/lib/creative-upload", () => ({ uploadCreativeMedia: vi.fn() }))

import { CreativeWizard } from "../CreativeWizard"

const liveTest = () => ({
  id: "t1",
  code: "CT-0001",
  name: "Mortgage myth",
  slug: "mortgage-myth",
  origin: "new",
  status: "testing",
  creative: { format: "video", destination: "website", website_url: "https://x.co", media: { blob_url: "https://b/x" }, accounts: [] },
  targets: { mode: "thresholds", metrics: { cpl: { op: "lte", value: 35 } }, min_spend: 150, min_days: 7, win_share: 0.6, baseline_pct: 15 },
  on_verdict: { notify_channels: ["in_app"], suggest_pause_failing: true, auto_pause_losers: false },
  ads: [{ id: "a1", ad_account_id: "act_1", post_state: "active" }],
})

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  vi.clearAllMocks()
  api.test = liveTest()
})

describe("CreativeWizard on a posted test", () => {
  it("edit-targets saves the targets and returns to the test without posting", async () => {
    nav.search = "test=t1&step=targets"
    render(<CreativeWizard testId="t1" />)
    const input = await screen.findByLabelText("Cost per lead target")
    await userEvent.clear(input)
    await userEvent.type(input, "30")
    await userEvent.click(screen.getByRole("button", { name: "Save targets" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/campaigns?tab=creatives&creative=CT-0001"))
    const sent = fns.updateCreativeTest.mock.calls.map(([, body]) => body)
    expect(sent.some((b) => b.targets?.metrics?.cpl?.value === 30)).toBe(true)
    expect(sent.every((b) => !("creative" in b))).toBe(true) // creative is read-only once posted
    expect(fns.postCreativeTest).not.toHaveBeenCalled()
    expect(fns.addCreativeAccounts).not.toHaveBeenCalled()
  })

  it("add-accounts goes accounts -> review (skipping targets) and posts the new rows to /accounts", async () => {
    nav.search = "test=t1&step=accounts"
    const user = userEvent.setup()
    render(<CreativeWizard testId="t1" />)
    await user.click(await screen.findByRole("checkbox", { name: "Select Keystone" }))
    await user.click(await screen.findByRole("combobox", { name: "Ad set for Keystone" }))
    await user.click(await screen.findByRole("option", { name: /Birdy tests/ }))
    await user.click(screen.getByRole("button", { name: /Continue/ }))
    // Review: only the new row, a Back button, no Targets step.
    expect(await screen.findByRole("button", { name: "Add 1 account" })).toBeInTheDocument()
    expect(screen.queryByText("Harbour")).toBeNull()
    expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add 1 account" }))
    await waitFor(() =>
      expect(fns.addCreativeAccounts).toHaveBeenCalledWith("t1", [
        { ad_account_id: "act_2", client_group_id: "g2", adset_id: "s2", adset_name: "Birdy tests", page_id: "p2" },
      ])
    )
    expect(fns.postCreativeTest).not.toHaveBeenCalled()
    expect(await screen.findByTestId("post-progress")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Back/ })).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const api = {
  test: null,
  adsets: [],
  postCreativeTest: vi.fn(async () => ({ queued: 2 })),
  addCreativeAccounts: vi.fn(async () => ({ queued: 1 })),
  goLiveCreativeTest: vi.fn(async () => ({ activated: 1 })),
  retryCreativeAd: vi.fn(async () => ({ queued: true })),
}
vi.mock("@/lib/creatives-api", () => ({
  useCreativeAdAccounts: () => ({
    accounts: [
      { ad_account_id: "act_1", currency: "GBP", clients: [{ id: "g1", name: "Harbour" }] },
      { ad_account_id: "act_2", currency: "USD", clients: [{ id: "g2", name: "Keystone" }] },
    ],
  }),
  useCreativeAdsets: () => ({ adsets: api.adsets, isLoading: false, error: null }),
  useCreativeTest: (id, opts) => {
    api.lastOpts = opts
    return { test: api.test, isLoading: false, error: null }
  },
  postCreativeTest: (...a) => api.postCreativeTest(...a),
  addCreativeAccounts: (...a) => api.addCreativeAccounts(...a),
  goLiveCreativeTest: (...a) => api.goLiveCreativeTest(...a),
  retryCreativeAd: (...a) => api.retryCreativeAd(...a),
}))

import { StepReview } from "../StepReview"
import { PostProgress } from "../PostProgress"

const rows = [
  { ad_account_id: "act_1", client_group_id: "g1", adset_id: "s1", adset_name: "Birdy tests", page_id: "p1", lead_form_id: "f1", targets_override: { cpl: 28 } },
  { ad_account_id: "act_2", client_group_id: "g2", adset_id: "s2", adset_name: "Other", page_id: "p2", lead_form_id: null },
]
const draft = (over = {}) => ({
  id: "t1",
  code: "CT-0001",
  status: "draft",
  creative: { format: "video", destination: "lead_form", accounts: rows },
  targets: { mode: "thresholds", metrics: { cpl: { op: "lte", value: 35 } } },
  ...over,
})
const ad = (id, act, state, extra = {}) => ({ id, ad_account_id: act, account_name: act, post_state: state, post_error: null, ...extra })

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.scrollIntoView ??= () => {}
  vi.clearAllMocks()
  api.adsets = []
  api.test = null
})

describe("StepReview", () => {
  it("posts the accounts array and then shows progress", async () => {
    api.test = { id: "t1", code: "CT-0001", status: "posting", ads: [ad("a1", "act_1", "pending"), ad("a2", "act_2", "pending")] }
    render(<StepReview draft={draft()} />)
    await userEvent.click(screen.getByRole("button", { name: "Post to 2 accounts" }))
    expect(api.postCreativeTest).toHaveBeenCalledWith("t1", [
      { ad_account_id: "act_1", client_group_id: "g1", adset_id: "s1", adset_name: "Birdy tests", page_id: "p1", lead_form_id: "f1", targets_override: { cpl: 28 } },
      { ad_account_id: "act_2", client_group_id: "g2", adset_id: "s2", adset_name: "Other", page_id: "p2" },
    ])
    expect(await screen.findByTestId("post-progress")).toBeInTheDocument()
  })

  it("add-accounts mode lists only the new rows and posts them to /accounts", async () => {
    api.test = { id: "t1", code: "CT-0001", status: "testing", ads: [] }
    render(<StepReview draft={draft({ status: "testing" })} rows={[rows[1]]} addMode />)
    expect(screen.queryByText("Harbour")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Add 1 account" }))
    expect(api.addCreativeAccounts).toHaveBeenCalledWith("t1", [{ ad_account_id: "act_2", client_group_id: "g2", adset_id: "s2", adset_name: "Other", page_id: "p2" }])
    expect(api.postCreativeTest).not.toHaveBeenCalled()
  })

  it("warns about a missing lead form, a paused ad set and hook rate on an image", () => {
    api.adsets = [{ id: "s1", name: "Birdy tests", status: "PAUSED" }]
    render(
      <StepReview
        draft={draft({
          creative: { format: "image", destination: "lead_form", accounts: rows },
          targets: { mode: "thresholds", metrics: { hook_rate: { op: "gte", value: 30 } } },
        })}
      />
    )
    expect(screen.getAllByText(/no lead form/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/ad set .* is paused/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/hook rate .* image/i)).toBeInTheDocument()
  })

  it("shows the server's message when posting fails", async () => {
    api.postCreativeTest.mockRejectedValueOnce(new Error("Already posted"))
    render(<StepReview draft={draft()} />)
    await userEvent.click(screen.getByRole("button", { name: "Post to 2 accounts" }))
    expect(await screen.findByText(/Already posted/)).toBeInTheDocument()
    expect(screen.queryByTestId("post-progress")).toBeNull()
  })
})

describe("PostProgress", () => {
  it("polls only while posting", () => {
    api.test = { id: "t1", code: "CT-0001", status: "posting", ads: [] }
    render(<PostProgress testId="t1" />)
    expect(api.lastOpts).toEqual({ pollWhilePosting: true })
  })

  it("website fix retries with the destination patch", async () => {
    api.test = {
      id: "t1", code: "CT-0001", status: "posting", creative: { website_url: "https://x.co" },
      ads: [ad("a1", "act_1", "failed", { post_error: { message: "WhatsApp isn't set up", step: "creative", fix: "use_website_url" } }), ad("a2", "act_2", "created")],
    }
    render(<PostProgress testId="t1" />)
    expect(screen.getByText("WhatsApp isn't set up")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /use website url/i }))
    expect(api.retryCreativeAd).toHaveBeenCalledWith("t1", "a1", { destination: "website" })
  })

  it("pick_adset fix retries with the chosen ad set", async () => {
    api.adsets = [{ id: "s9", name: "Fresh set", compatible: true }]
    api.test = {
      id: "t1", code: "CT-0001", status: "posting", creative: { destination: "lead_form" },
      ads: [ad("a1", "act_1", "failed", { post_error: { message: "Ad set is archived", fix: "pick_adset" } })],
    }
    render(<PostProgress testId="t1" />)
    await userEvent.selectOptions(screen.getByLabelText("Ad set for act_1"), "s9")
    await userEvent.click(screen.getByRole("button", { name: "Retry with this ad set" }))
    expect(api.retryCreativeAd).toHaveBeenCalledWith("t1", "a1", { adset_id: "s9", adset_name: "Fresh set" })
  })

  it("partial go-live shows only with at least one created and one failed", async () => {
    api.test = { id: "t1", code: "CT-0001", status: "posting", ads: [ad("a1", "act_1", "created"), ad("a2", "act_2", "created")] }
    const { rerender } = render(<PostProgress testId="t1" />)
    expect(screen.queryByRole("button", { name: /go live/i })).toBeNull()
    api.test = { ...api.test, ads: [ad("a1", "act_1", "failed", { post_error: { message: "x" } }), ad("a2", "act_2", "failed", { post_error: { message: "x" } })] }
    rerender(<PostProgress testId="t1" />)
    expect(screen.queryByRole("button", { name: /go live/i })).toBeNull()
    api.test = { ...api.test, ads: [ad("a1", "act_1", "created"), ad("a2", "act_2", "failed", { post_error: { message: "x" } })] }
    rerender(<PostProgress testId="t1" />)
    await userEvent.click(screen.getByRole("button", { name: "Go live with the 1 that worked" }))
    expect(api.goLiveCreativeTest).toHaveBeenCalledWith("t1", { partialOk: true })
  })

  it("opens the test in the creatives tab once it is no longer posting", async () => {
    api.test = { id: "t1", code: "CT-0001", status: "testing", ads: [ad("a1", "act_1", "active")] }
    render(<PostProgress testId="t1" />)
    await userEvent.click(screen.getByRole("button", { name: "Open test" }))
    expect(push).toHaveBeenCalledWith("/campaigns?tab=creatives&creative=CT-0001")
  })
})

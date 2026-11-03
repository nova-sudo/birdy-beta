import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConfirmHost } from "@/components/ds"
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast, Toaster: () => null }))

const archiveCreativeTest = vi.fn(() => Promise.resolve({}))
const refreshCreativeTest = vi.fn(() => Promise.resolve({}))
const pauseCreativeAds = vi.fn(() => Promise.resolve({}))
const retryCreativeAd = vi.fn(() => Promise.resolve({}))
let current = null
let allAccounts = ["act_1", "act_2", "act_3", "act_4", "act_5"]
vi.mock("@/lib/creatives-api", () => ({
  useCreativeTest: () => ({ test: current, isLoading: !current }),
  archiveCreativeTest: (...a) => archiveCreativeTest(...a),
  refreshCreativeTest: (...a) => refreshCreativeTest(...a),
  pauseCreativeAds: (...a) => pauseCreativeAds(...a),
  retryCreativeAd: (...a) => retryCreativeAd(...a),
  useCreativeAdAccounts: () => ({ accounts: allAccounts.map((id) => ({ ad_account_id: id })), isLoading: false }),
}))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { CreativeDetailSheet } from "../CreativeDetailSheet"
import { cumulativeRows } from "@/lib/creative-days"

const targets = { mode: "thresholds", metrics: { cpl: { op: "lte", value: 35 }, hook_rate: { op: "gte", value: 30 } }, min_spend: 150, min_days: 7 }
const ad = (id, name, cpl, state = "pass", extra = {}) => ({
  id,
  ad_account_id: `act_${id}`,
  account_name: name,
  adset_name: "Birdy tests",
  post_state: "active",
  meta: { ad_id: `m${id}` },
  score: { state, spend: 200, leads: cpl == null ? 0 : 10, cpl, ctr: 2, hook_rate: 40, days_live: 8 },
  ...extra,
})
const make = (over = {}) => ({
  id: "t1",
  code: "CT-0042",
  name: "Mortgage myth",
  status: "winner",
  origin: "new",
  targets,
  creative: { format: "video", destination: "lead_form", media: {} },
  summary: { currency: "GBP", spend: 1412, leads: 58, cpl: 24.34, ctr: 1.9, hook_rate: 38, accounts_total: 3, accounts_pass: 2 },
  ads: [ad("1", "Zeta Co", null, "fail"), ad("2", "Beta Co", 30), ad("3", "Alpha Co", 19.27)],
  days: { m2: [{ date: "2026-10-09", spend: "10", impressions: "100", link_clicks: "2", actions: [{ action_type: "lead", value: "1" }] }] },
  ...over,
})

const setup = (test = make()) => {
  current = test
  push.mockClear()
  archiveCreativeTest.mockClear()
  refreshCreativeTest.mockClear()
  pauseCreativeAds.mockClear()
  retryCreativeAd.mockClear()
  Object.values(toast).forEach((f) => f.mockClear())
  const onOpenChange = vi.fn()
  render(
    <>
      <CreativeDetailSheet testId="t1" open onOpenChange={onOpenChange} />
      <ConfirmHost />
    </>
  )
  return { onOpenChange }
}

describe("CreativeDetailSheet", () => {
  beforeEach(() => {
    current = null
  })

  it("KPI row shows the target captions", () => {
    setup()
    expect(screen.getByText("target ≤ £35")).toBeInTheDocument()
    expect(screen.getByText("target ≥ 30%")).toBeInTheDocument()
    expect(screen.getByText("£24.34")).toBeInTheDocument()
  })

  it("sorts accounts by CPL ascending with null last", () => {
    setup()
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1)
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      expect.stringContaining("Alpha Co"),
      expect.stringContaining("Beta Co"),
      expect.stringContaining("Zeta Co"),
    ])
    expect(within(rows[2]).getByText("— · 0 leads")).toBeInTheDocument()
  })

  it("archive asks for confirmation, then calls the API", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(archiveCreativeTest).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole("button", { name: "Archive test" }))
    await waitFor(() => expect(archiveCreativeTest).toHaveBeenCalledWith("t1"))
  })

  it("cancelling the confirmation does not archive", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull())
    expect(archiveCreativeTest).not.toHaveBeenCalled()
  })

  it("image test hides the Hook tab", () => {
    setup(make({ creative: { format: "image", media: {} } }))
    expect(screen.getByRole("tab", { name: "CPL" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Hook" })).toBeNull()
  })

  it("video test offers CPL, CTR, Hook and Leads", () => {
    setup()
    for (const l of ["CPL", "CTR", "Hook", "Leads"]) expect(screen.getByRole("tab", { name: l })).toBeInTheDocument()
  })

  it("footer routes to the wizard steps and shows Pause everywhere", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Add accounts" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/t1/edit?step=accounts")
    fireEvent.click(screen.getByRole("button", { name: "Edit targets" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/t1/edit?step=targets")
    expect(screen.getByRole("button", { name: /Pause everywhere/ })).toBeInTheDocument()
  })

  it("Refresh calls the API", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(refreshCreativeTest).toHaveBeenCalledWith("t1"))
  })

  it("removed account is labelled, not failed", () => {
    setup(make({ ads: [ad("9", "Gone Co", null, "removed", { post_state: "removed" })] }))
    expect(screen.getByText("Removed in Meta")).toBeInTheDocument()
  })
})

describe("CreativeDetailSheet header and actions", () => {
  beforeEach(() => {
    current = null
    allAccounts = ["act_1", "act_2", "act_3", "act_4", "act_5"]
  })

  it("KPI tiles sit directly on the sheet (no empty frame band) and go 4 across from lg", () => {
    setup()
    const cell = screen.getAllByText("Spend")[0].closest('[data-slot="metric-group-cell"]')
    expect(cell.closest('[data-slot="frame"]')).toBeNull()
    expect(cell.parentElement.className).toMatch(/lg:grid-cols-4/)
    expect(cell.parentElement.className).toMatch(/grid-cols-2/)
  })

  it("shows the verdict with the pass count", () => {
    setup()
    expect(screen.getByText("Winner · 2 of 3")).toBeInTheDocument()
  })

  it("a winner offers Scale to N more, opening the wizard with ?scale=", () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Scale to 2 more" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new?scale=t1")
  })

  it("no Scale button for a test that is not a winner or has nowhere to scale", () => {
    setup(make({ status: "testing" }))
    expect(screen.queryByRole("button", { name: /Scale to/ })).toBeNull()
    cleanup()
    allAccounts = ["act_1", "act_2", "act_3"]
    setup()
    expect(screen.queryByRole("button", { name: /Scale to/ })).toBeNull()
  })

  it("a failing account offers Pause here, after a confirm", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Pause here" }))
    expect(pauseCreativeAds).not.toHaveBeenCalled()
    const confirmBtn = (await screen.findAllByRole("button", { name: "Pause here" })).pop()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(pauseCreativeAds).toHaveBeenCalledWith("t1", ["act_1"]))
  })

  it("a failed post offers Retry", async () => {
    setup(make({ ads: [ad("5", "Fail Co", null, "scoring", { post_state: "failed", post_error: { message: "Page not allowed" } })] }))
    const btn = screen.getByRole("button", { name: "Retry" })
    expect(btn).toHaveAttribute("title", "Page not allowed")
    fireEvent.click(btn)
    await waitFor(() => expect(retryCreativeAd).toHaveBeenCalledWith("t1", "5"))
  })
})

describe("CreativeDetailSheet final review fixes", () => {
  beforeEach(() => {
    current = null
    allAccounts = ["act_1", "act_2", "act_3", "act_4", "act_5"]
  })

  it("hides Refresh on an archived test", () => {
    setup(make({ status: "archived" }))
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull()
  })

  it("archive confirm says the ads keep running and suggests pausing first", async () => {
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(await screen.findByText(/keep running and spending in Meta/)).toBeInTheDocument()
    expect(screen.getByText(/Pause everywhere first/)).toBeInTheDocument()
  })

  it("Pause everywhere with errors names the accounts that failed", async () => {
    pauseCreativeAds.mockResolvedValueOnce({ paused: 1, errors: [{ ad_account_id: "act_2", message: "Token expired" }] })
    setup()
    fireEvent.click(screen.getByRole("button", { name: /Pause everywhere/ }))
    fireEvent.click((await screen.findAllByRole("button", { name: "Pause everywhere" })).pop())
    await waitFor(() => expect(toast.warning).toHaveBeenCalled())
    const [title, opts] = toast.warning.mock.calls[0]
    expect(title).toBe("Paused 1, 1 couldn't be paused")
    expect(opts.description).toMatch(/Beta Co: Token expired/)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("Pause here that fails in Meta is an error, not a success", async () => {
    pauseCreativeAds.mockResolvedValueOnce({ paused: 0, errors: [{ ad_account_id: "act_1", message: "No permission" }] })
    setup()
    fireEvent.click(screen.getByRole("button", { name: "Pause here" }))
    fireEvent.click((await screen.findAllByRole("button", { name: "Pause here" })).pop())
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.error.mock.calls[0][0]).toBe("Couldn't pause")
    expect(toast.error.mock.calls[0][1].description).toMatch(/Zeta Co: No permission/)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("a clean pause is a success", async () => {
    pauseCreativeAds.mockResolvedValueOnce({ paused: 3, errors: [] })
    setup()
    fireEvent.click(screen.getByRole("button", { name: /Pause everywhere/ }))
    fireEvent.click((await screen.findAllByRole("button", { name: "Pause everywhere" })).pop())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Paused 3 ads", expect.anything()))
  })

  it("scoring progress shows the spend floor in the user's currency", () => {
    // A JPY account scored in GBP: the row carries the converted spend and currency GBP.
    setup(make({ ads: [ad("7", "Yen Co", null, "scoring", { currency: "GBP", account_currency: "JPY", fx_rate: 0.005, score: { state: "scoring", spend: 40, days_live: 1 } })] }))
    expect(screen.getByText("£40 / £150")).toBeInTheDocument()
  })

  it("an unconverted row (no rate) never compares its spend with the floor", () => {
    setup(make({ ads: [ad("8", "Odd Co", null, "scoring", { currency: "XYZ", score: { state: "scoring", spend: 90000, days_live: 2, rate_missing: true } })] }))
    expect(screen.getByText("day 2 of 7")).toBeInTheDocument()
  })

  it("chart CPL lines convert each account's day rows with its fx rate", () => {
    const days = { m1: [{ date: "2026-10-01", spend: "3000", actions: [{ action_type: "lead", value: "1" }] }] }
    const { rows } = cumulativeRows(days, "cpl", { m1: 0.005 })
    expect(rows[0].m1).toBeCloseTo(15)
  })
})

describe("cumulativeRows", () => {
  it("accumulates per ad and leaves CPL null until a lead lands", () => {
    const lead = (v) => [{ action_type: "lead", value: v }]
    const { rows } = cumulativeRows(
      {
        a: [
          { date: "2026-10-01", spend: "10", impressions: "100", actions: [] },
          { date: "2026-10-02", spend: "20", impressions: "100", actions: lead("2") },
        ],
      },
      "cpl"
    )
    expect(rows).toEqual([
      { date: "2026-10-01", a: null },
      { date: "2026-10-02", a: 15 },
    ])
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConfirmHost } from "@/components/ds"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const archiveCreativeTest = vi.fn(() => Promise.resolve({}))
const refreshCreativeTest = vi.fn(() => Promise.resolve({}))
let current = null
vi.mock("@/lib/creatives-api", () => ({
  useCreativeTest: () => ({ test: current, isLoading: !current }),
  archiveCreativeTest: (...a) => archiveCreativeTest(...a),
  refreshCreativeTest: (...a) => refreshCreativeTest(...a),
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
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new?test=t1&step=accounts")
    fireEvent.click(screen.getByRole("button", { name: "Edit targets" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new?test=t1&step=targets")
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

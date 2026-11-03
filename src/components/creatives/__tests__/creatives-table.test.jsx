import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { CreativesTable } from "../CreativesTable"
import { AccountDotStrip } from "../AccountDotStrip"
import { VerdictBadge } from "../VerdictBadge"

const targets = { mode: "thresholds", metrics: { cpl: { op: "lte", value: 35 } }, min_spend: 150, min_days: 7 }
const ad = (id, name, state, extra = {}) => ({
  id,
  ad_account_id: `act_${id}`,
  account_name: name,
  adset_name: "Birdy tests",
  post_state: "active",
  score: { state, spend: 200, leads: 10, cpl: 20, ctr: 0.02, hook_rate: 0.4, days_live: 8 },
  ...extra,
})
const tests = [
  {
    id: "t1",
    code: "CT-0042",
    name: "Mortgage myth",
    status: "winner",
    targets,
    created_at: "2026-10-09T00:00:00Z",
    summary: { currency: "GBP", spend: 1412, leads: 58, cpl: 24.34, ctr: 0.019, hook_rate: 0.38, accounts_pass: 1, accounts_total: 3 },
    creative: { format: "video", media: {} },
    ads: [
      ad("1", "Harbour Finance", "pass"),
      ad("2", "Oakline Wealth", "fail", { score: { state: "fail", spend: 198, leads: 0, cpl: null, days_live: 8 } }),
      ad("3", "Birch Mortgages", "removed", { score: { state: "removed", spend: 0, leads: 0 } }),
    ],
  },
  {
    id: "t2",
    code: "CT-0045",
    name: "Rate drop",
    status: "testing",
    targets,
    summary: { currency: "USD", spend: 10, leads: 1, cpl: 10, accounts_pass: 0, accounts_total: 1 },
    creative: { format: "image", media: {} },
    ads: [ad("4", "Keystone", "scoring", { post_state: "failed", post_error: "Lead form rejected" })],
  },
]

const T = () => within(screen.getByRole("table"))
const setup = (props = {}) => {
  const onOpen = vi.fn()
  const onAccountAction = vi.fn()
  render(<CreativesTable tests={tests} onOpen={onOpen} onAccountAction={onAccountAction} {...props} />)
  return { onOpen, onAccountAction }
}

describe("CreativesTable", () => {
  it("renders one parent row per test", () => {
    setup()
    expect(T().getByText("Mortgage myth")).toBeInTheDocument()
    expect(T().getByText("Rate drop")).toBeInTheDocument()
    expect(T().queryByText("Harbour Finance")).toBeNull()
    expect(T().getByText("£1,412")).toBeInTheDocument()
  })

  it("expands to N child rows without opening the test", () => {
    const { onOpen } = setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    expect(T().getByText("Harbour Finance")).toBeInTheDocument()
    expect(T().getByText("Oakline Wealth")).toBeInTheDocument()
    expect(T().getByText("Birch Mortgages")).toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("opens a test on parent row click", () => {
    const { onOpen } = setup()
    fireEvent.click(T().getByText("Rate drop"))
    expect(onOpen).toHaveBeenCalledWith("t2")
  })

  it("child Pause here calls onAccountAction(test, ad, 'pause')", () => {
    const { onAccountAction, onOpen } = setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    fireEvent.click(T().getByRole("button", { name: "Pause here" }))
    expect(onAccountAction).toHaveBeenCalledWith(tests[0], tests[0].ads[1], "pause")
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("failed post offers Retry", () => {
    const { onAccountAction } = setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Rate drop" }))
    fireEvent.click(T().getByRole("button", { name: "Retry" }))
    expect(onAccountAction).toHaveBeenCalledWith(tests[1], tests[1].ads[0], "retry")
  })

  it("zero-leads child shows '— · 0 leads'", () => {
    setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    expect(T().getByText("— · 0 leads")).toBeInTheDocument()
  })

  it("removed child shows 'Removed in Meta'", () => {
    setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    expect(T().getByText("Removed in Meta")).toBeInTheDocument()
  })

  it("child money uses the test currency when the ad has none", () => {
    setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    expect(T().getByText("£200")).toBeInTheDocument()
  })
})

describe("CreativesTable mobile card list", () => {
  it("keeps a child's metrics and action in the card list", () => {
    setup()
    fireEvent.click(T().getByRole("button", { name: "Expand Mortgage myth" }))
    const cards = [...document.querySelectorAll('[data-slot="data-table-card"][data-depth="1"]')]
    const oak = cards.find((c) => c.textContent.includes("Oakline Wealth"))
    expect(oak).toBeTruthy()
    expect(within(oak).getByText("£198")).toBeInTheDocument()
    expect(within(oak).getByText("— · 0 leads")).toBeInTheDocument()
    expect(within(oak).getByRole("button", { name: "Pause here" })).toBeInTheDocument()
  })
})

describe("AccountDotStrip", () => {
  it("shows pass count", () => {
    render(<AccountDotStrip ads={[{ score: { state: "pass" } }, { score: { state: "fail" } }, { score: { state: "pass" } }]} />)
    expect(screen.getByText("2/3 pass")).toBeInTheDocument()
  })
  it("excludes removed ads from the pass denominator", () => {
    render(<AccountDotStrip status="testing" ads={[{ post_state: "active", score: { state: "pass" } }, { post_state: "removed", score: { state: "removed" } }]} />)
    expect(screen.getByText("1/1 pass")).toBeInTheDocument()
  })
  it("shows posted/failed while posting", () => {
    const ads = [
      { post_state: "created", score: {} },
      { post_state: "created", score: {} },
      { post_state: "failed", score: {} },
      { post_state: "pending", score: {} },
    ]
    render(<AccountDotStrip ads={ads} status="posting" />)
    expect(screen.getByText("2 posted · 1 failed")).toBeInTheDocument()
  })
})

describe("VerdictBadge", () => {
  it("labels by status", () => {
    render(<VerdictBadge status="winner" />)
    expect(within(document.body).getByText("Winner")).toBeInTheDocument()
  })
})

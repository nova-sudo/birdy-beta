import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

const hooks = { prefill: null }
vi.mock("@/lib/creatives-api", () => ({
  useCreativeAdAccounts: () => ({
    accounts: [
      { ad_account_id: "act_1", currency: "GBP", clients: [{ id: "g1", name: "Harbour" }] },
      { ad_account_id: "act_2", currency: "USD", clients: [{ id: "g2", name: "Keystone" }] },
    ],
    isLoading: false,
    error: null,
  }),
  useCreativeTargetsPrefill: () => ({ prefill: hooks.prefill, isLoading: false, error: null }),
}))

import { StepTargets, targetsStepValid } from "../StepTargets"

const rows = [
  { ad_account_id: "act_1", client_group_id: "g1", adset_id: "s1" },
  { ad_account_id: "act_2", client_group_id: "g2", adset_id: "s2" },
]

function Harness({ initial, onField }) {
  const [draft, setDraft] = useState(initial)
  const setField = (path, value) => {
    onField?.(path, value)
    setDraft((d) => (path.startsWith("creative.") ? { ...d, creative: { ...d.creative, [path.slice(9)]: value } } : { ...d, [path]: value }))
  }
  return <StepTargets draft={draft} setField={setField} />
}
const mk = (over = {}) => ({ id: "t1", creative: { format: "video", accounts: rows, ...over.creative }, ...over.top })

beforeEach(() => {
  hooks.prefill = { metrics: { cpl: { op: "lte", value: 35, source: "client" } }, per_account: { g2: { cpl: 42 } } }
})

describe("StepTargets", () => {
  it("seeds the defaults with the prefilled CPL and its source", async () => {
    const calls = []
    render(<Harness initial={mk()} onField={(p, v) => calls.push([p, v])} />)
    const seeded = calls.find(([p]) => p === "targets")[1]
    expect(seeded).toMatchObject({ mode: "thresholds", baseline_pct: 15, min_spend: 150, min_days: 7, win_share: 0.6 })
    expect(seeded.metrics.cpl).toMatchObject({ op: "lte", value: 35, source: "client" })
    expect(within(screen.getByTestId("metric-cpl")).getByText("client default")).toBeInTheDocument()
    expect(screen.getByLabelText("Minimum spend")).toHaveValue(150)
    expect(screen.getByLabelText("Minimum days")).toHaveValue(7)
    expect(screen.getByLabelText("Call the test a winner when")).toHaveValue(60)
  })

  it("switching to CPL only hides the other metric rows", async () => {
    render(<Harness initial={mk()} />)
    expect(screen.getByTestId("metric-ctr")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: /CPL only/ }))
    expect(screen.queryByTestId("metric-ctr")).toBeNull()
    expect(screen.queryByTestId("metric-hook_rate")).toBeNull()
    expect(screen.getByLabelText("Cost per lead at most")).toHaveValue(35)
  })

  it("disables the hook rate row for an image", () => {
    render(<Harness initial={mk({ creative: { format: "image" } })} />)
    expect(screen.getByLabelText("Use Hook rate (3s views ÷ impressions)")).toBeDisabled()
    expect(within(screen.getByTestId("metric-hook_rate")).getByText("video only")).toBeInTheDocument()
  })

  it("removes a metric from targets.metrics when its checkbox is cleared", async () => {
    const calls = []
    render(<Harness initial={mk()} onField={(p, v) => calls.push([p, v])} />)
    await userEvent.click(screen.getByLabelText("Use Cost per lead"))
    const last = calls.filter(([p]) => p === "targets").at(-1)[1]
    expect("cpl" in last.metrics).toBe(false)
  })

  it("baseline mode keeps baseline_pct and an optional CTR requirement", async () => {
    const calls = []
    render(<Harness initial={mk()} onField={(p, v) => calls.push([p, v])} />)
    await userEvent.click(screen.getByRole("radio", { name: /Beat the account/ }))
    await userEvent.click(screen.getByLabelText("Also require CTR"))
    const last = calls.filter(([p]) => p === "targets").at(-1)[1]
    expect(last).toMatchObject({ mode: "baseline", baseline_pct: 15 })
    expect(last.metrics.ctr).toBeTruthy()
    expect("cpl" in last.metrics).toBe(false)
  })

  it("per-account drawer shows resolved CPLs and writes targets_override on the row", async () => {
    const calls = []
    render(<Harness initial={mk()} onField={(p, v) => calls.push([p, v])} />)
    await userEvent.click(screen.getByRole("button", { name: "Edit per account" }))
    expect(screen.getByText(/Resolved CPL ≤ £35/)).toBeInTheDocument() // Harbour: test default
    expect(screen.getByText(/Resolved CPL ≤ \$42/)).toBeInTheDocument() // Keystone: its own client target
    await userEvent.type(screen.getByLabelText("CPL override for Harbour"), "28")
    const written = calls.filter(([p]) => p === "creative.accounts").at(-1)[1]
    expect(written[0].targets_override).toEqual({ cpl: 28 })
    expect(written[1].targets_override).toBeUndefined()
  })

  it("writes verdict actions to on_verdict", async () => {
    const calls = []
    render(<Harness initial={mk()} onField={(p, v) => calls.push([p, v])} />)
    await userEvent.click(screen.getByLabelText("Auto-pause losers"))
    await userEvent.click(screen.getByLabelText("Notify in Slack"))
    const last = calls.filter(([p]) => p === "on_verdict").at(-1)[1]
    expect(last).toMatchObject({ auto_pause_losers: true, suggest_pause_failing: true })
    expect(last.notify_channels).toEqual(expect.arrayContaining(["in_app", "slack"]))
  })

  it("seeds a resumed draft that holds the server's empty thresholds, and stores on_verdict separately", () => {
    const calls = []
    const resumed = mk({ top: { status: "draft", targets: { mode: "thresholds", metrics: {}, min_spend: 150, min_days: 7, win_share: 0.6, baseline_pct: 15 } } })
    render(<Harness initial={resumed} onField={(p, v) => calls.push([p, v])} />)
    expect(calls.find(([p]) => p === "targets")[1].metrics.cpl).toMatchObject({ value: 35, source: "client" })
    expect(calls.find(([p]) => p === "on_verdict")[1]).toMatchObject({ suggest_pause_failing: true, auto_pause_losers: false })
  })

  it("does not reseed targets the user already set, but still stores missing on_verdict", () => {
    const calls = []
    const set = mk({ top: { status: "draft", targets: { mode: "thresholds", metrics: { ctr: { op: "gte", value: 1 } }, min_spend: 150, min_days: 7, win_share: 0.6 } } })
    render(<Harness initial={set} onField={(p, v) => calls.push([p, v])} />)
    expect(calls.find(([p]) => p === "targets")).toBeUndefined()
    expect(calls.find(([p]) => p === "on_verdict")).toBeTruthy()
  })

  it("drops the currency symbol for mixed currencies and says so", () => {
    render(<Harness initial={mk()} />)
    expect(screen.getByText(/in each account's currency/)).toBeInTheDocument()
    expect(within(screen.getByTestId("metric-cpl")).queryByText("£")).toBeNull()
    expect(within(screen.getByTestId("metric-cpl")).queryByText("$")).toBeNull()
  })

  it("keeps the symbol when every account shares a currency", () => {
    render(<Harness initial={mk({ creative: { accounts: [rows[0]] } })} />)
    expect(within(screen.getByTestId("metric-cpl")).getByText("£")).toBeInTheDocument()
    expect(screen.queryByText(/in each account's currency/)).toBeNull()
  })

  it("validates by mode", () => {
    const base = { mode: "thresholds", baseline_pct: 15, min_spend: 150, min_days: 7, win_share: 0.6 }
    expect(targetsStepValid({ targets: { ...base, metrics: {} } })).toBe(false)
    expect(targetsStepValid({ targets: { ...base, metrics: { cpl: { op: "lte", value: 35 } } } })).toBe(true)
    expect(targetsStepValid({ targets: { ...base, metrics: { cpl: { op: "lte", value: null } } } })).toBe(false)
    expect(targetsStepValid({ targets: { ...base, mode: "baseline", metrics: {} } })).toBe(true)
    expect(targetsStepValid({ targets: { ...base, mode: "cpl_only", metrics: {} } })).toBe(false)
  })
})

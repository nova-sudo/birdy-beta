import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

const state = vi.hoisted(() => ({
  config: {
    markup: 3, markup_min: 1, markup_max: 20, rate_mode: "managed", enforce: true,
    model: "test-model", model_pricing: { in: 1, out: 2 },
  },
  accounts: {
    total: 2,
    totals: { balance: 5000, used_total: 100, used_internal: 60, used_slack: 30, used_cron: 10, used_call_analysis: 0, purchased_total: 900 },
    accounts: [
      { email: "a@agency.com", name: "Ada Agency", plan: "Scale", balance: 0, topup_balance: 0, used_period: 5, allowance: 100, used_total: 100, used_internal: 60, used_slack: 30, used_cron: 10, used_call_analysis: 0, purchased_total: 0, granted_total: 0, topups: 0, questions: 4, last_used: null },
      { email: "b@agency.com", name: "Bo Builder", plan: "Free", balance: 250, topup_balance: 0, used_period: 0, allowance: 0, used_total: 0, used_call_analysis: 0, purchased_total: 40, granted_total: 10, topups: 1, questions: 0, last_used: null },
    ],
  },
}))

vi.mock("@/lib/admin-api", () => ({
  useCreditsConfig: () => ({ data: state.config, isLoading: false, mutate: vi.fn() }),
  useCreditsAccounts: () => ({ data: state.accounts, isLoading: false, mutate: vi.fn() }),
  updateCreditsConfig: vi.fn(),
  grantCredits: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import AdminCreditsPage from "../credits/page"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

beforeEach(() => vi.clearAllMocks())

describe("admin credits page", () => {
  it("renders its ds widgets", () => {
    const { container } = render(<AdminCreditsPage />)
    for (const ds of ["admin-header", "metric-group", "data-table", "notice", "switch", "surface"]) {
      expect(container.querySelector(`[data-ds="${ds}"]`), ds).not.toBeNull()
    }
    expect(screen.getByText("Outstanding balance")).toBeInTheDocument()
    expect(screen.getByText("Credits bought · all-time")).toBeInTheDocument()
  })

  it("flags an empty balance with a danger badge", () => {
    render(<AdminCreditsPage />)
    const zero = within(screen.getByRole("table")).getByText("0", { selector: '[data-ds="badge"]' })
    expect(zero.className).toMatch(/danger/)
  })

  it("clamps the markup to the configured min and max", () => {
    render(<AdminCreditsPage />)
    const markup = screen.getByLabelText("Credit markup", { selector: "input#markup" })
    fireEvent.change(markup, { target: { value: "999" } })
    expect(markup).toHaveValue(20)
    fireEvent.change(markup, { target: { value: "0" } })
    expect(markup).toHaveValue(1)
  })

  it("keeps the enforcement switch out of a live region", () => {
    render(<AdminCreditsPage />)
    const sw = screen.getByRole("switch", { name: "Enforce credit limits" })
    expect(sw.closest("[role='status']")).toBeNull()
    expect(sw.closest("[data-ds='notice']")).not.toBeNull()
  })

  it("has no legacy classes or inline hex", () => {
    const { container } = render(<AdminCreditsPage />)
    const legacy = new RegExp(["p", "d-"].join("") + "|font-" + ["p", "d"].join("") + "-display")
    const bad = [...container.querySelectorAll("*")].filter(
      (el) => legacy.test(el.getAttribute("class") || "") || /#[0-9a-f]{3,8}\b/i.test(el.getAttribute("style") || "")
    )
    expect(bad).toEqual([])
  })
})

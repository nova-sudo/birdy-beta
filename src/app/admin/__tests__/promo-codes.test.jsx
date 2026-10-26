import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const state = vi.hoisted(() => ({
  data: {
    targets: [{ plan_id: "plan_1", label: "Growth", group: "subscription" }],
    codes: [
      { id: 1, code: "LAUNCH30", promo_type: "percentage", amount_off: 30, target_labels: ["Growth"], status: "active", uses: 4, unlimited_stock: true, expires_at: null },
      { id: 2, code: "OLD10", promo_type: "flat_amount", amount_off: 10, target_labels: [], status: "expired", uses: 9, unlimited_stock: false, stock: 10, expires_at: null },
    ],
  },
}))
const createPromoCode = vi.fn()
vi.mock("@/lib/admin-api", () => ({
  usePromoCodes: () => ({ data: state.data, isLoading: false, mutate: vi.fn() }),
  createPromoCode: (...a) => createPromoCode(...a),
  deletePromoCode: vi.fn(),
}))
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import AdminPromoCodesPage from "../promo-codes/page"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

beforeEach(() => vi.clearAllMocks())

describe("admin promo codes page", () => {
  it("renders the table with monospace codes and status badges", () => {
    const { container } = render(<AdminPromoCodesPage />)
    expect(container.querySelector('[data-ds="data-table"]')).not.toBeNull()
    expect(container.querySelector('[data-ds="admin-header"]')).not.toBeNull()

    const table = within(screen.getByRole("table"))
    expect(table.getByText("LAUNCH30").className).toMatch(/font-mono/)
    expect(table.getByText("active").closest('[data-ds="badge"]').className).toMatch(/success/)
    expect(table.getByText("expired").closest('[data-ds="badge"]').className).toMatch(/subdued/)
    expect(table.getByText("Growth").closest('[data-ds="badge"]')).not.toBeNull()
  })

  it("won't create a code with no plan selected", async () => {
    const user = userEvent.setup()
    render(<AdminPromoCodesPage />)
    await user.click(screen.getByRole("button", { name: /create promo code/i }))

    const dialog = within(await screen.findByRole("dialog"))
    await user.type(dialog.getByLabelText("Code"), "save20")
    await user.type(dialog.getByLabelText("Discount", { selector: "input" }), "20")
    await user.click(dialog.getByRole("button", { name: /create promo code/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Select at least one plan to target"))
    expect(createPromoCode).not.toHaveBeenCalled()
  })

  it("has no legacy classes or inline hex", () => {
    const { container } = render(<AdminPromoCodesPage />)
    const legacy = new RegExp(["p", "d-"].join("") + "|font-" + ["p", "d"].join("") + "-display")
    const bad = [...container.querySelectorAll("*")].filter(
      (el) => legacy.test(el.getAttribute("class") || "") || /#[0-9a-f]{3,8}\b/i.test(el.getAttribute("style") || "")
    )
    expect(bad).toEqual([])
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const seen = { root: null, checkout: null, element: null }
const retry = vi.fn(() => Object.assign(Promise.resolve(null), { retry }))
vi.mock("@whop/elements", () => ({ loadWhop: () => Object.assign(Promise.resolve(null), { retry }) }))
vi.mock("@whop/elements-react", () => ({
  WhopElements: (props) => { seen.root = props; return props.children },
  Checkout: (props) => { seen.checkout = props; return <div data-testid="whop">{props.children}</div> },
  CheckoutElement: (props) => { seen.element = props; return null },
}))

import { WhopCheckout } from "../whop-checkout"

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem("user", JSON.stringify({ email: "sam@northside.test" }))
})
const open = (props) => render(<WhopCheckout planId="plan_x" returnUrl="https://birdy.test/settings" onComplete={() => {}} {...props} />)

describe("WhopCheckout", () => {
  it("opens the plan for the signed-in account", () => {
    open()
    expect(seen.checkout).toMatchObject({ plan: "plan_x", returnUrl: "https://birdy.test/settings", metadata: { user_id: "sam@northside.test" } })
    expect(seen.element.buyerEmail).toBe("sam@northside.test")
    expect(seen.root.environment).toBe("production")
  })

  it("passes completion on", () => {
    const onComplete = vi.fn()
    open({ onComplete })
    seen.checkout.onComplete({ result: "payment" })
    expect(onComplete).toHaveBeenCalled()
  })

  it("offers to try again when Whop's script doesn't load", async () => {
    open()
    act(() => seen.root.onLoadError(new Error("blocked"), () => {}))
    expect(screen.queryByTestId("whop")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalled()
    expect(screen.getByTestId("whop")).toBeInTheDocument()
  })

  it("says so when Whop doesn't sell the plan", () => {
    open()
    act(() => seen.element.onError({ message: "Variant not found", code: "CHECKOUT_UNAVAILABLE" }))
    expect(screen.getByText(/isn’t selling this/)).toBeInTheDocument()
  })
})

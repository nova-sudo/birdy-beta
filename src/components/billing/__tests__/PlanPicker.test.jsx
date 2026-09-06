import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/link", () => ({ default: ({ children, ...props }) => <a {...props}>{children}</a> }))

import { PlanPicker } from "../PlanPicker"

const onManage = vi.fn()
const onCancel = vi.fn()
const onReactivate = vi.fn()

const subscribed = (extra = {}) => ({
  subscribed: true,
  plan: { id: "growth", name: "Growth", max_clients: 10 },
  status: "active",
  client_count: 4,
  client_limit: 10,
  extra_clients_paid: 0,
  current_period_end: "2026-10-01T00:00:00Z",
  cancel_at_period_end: false,
  ...extra,
})

function renderPicker(billingStatus) {
  return render(
    <PlanPicker
      billingStatus={billingStatus}
      onManage={onManage}
      onCancel={onCancel}
      onReactivate={onReactivate}
    />
  )
}

beforeEach(() => {
  onManage.mockClear()
  onCancel.mockClear()
  onReactivate.mockClear()
})

describe("Settings → Billing plan picker", () => {
  it("offers a subscriber a way to cancel without leaving Birdy", () => {
    // The page used to not contain the word "cancel" at all — the only route
    // was guessing that "Manage billing" opened a portal that offered it.
    renderPicker(subscribed())

    expect(screen.getByRole("button", { name: /cancel your subscription/i })).toBeTruthy()
  })

  it("asks before cancelling anything", async () => {
    const user = userEvent.setup()
    renderPicker(subscribed())

    await user.click(screen.getByRole("button", { name: /cancel your subscription/i }))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByText(/cancel your subscription\?/i)).toBeTruthy()
  })

  it("says what they keep and until when, before they confirm", async () => {
    const user = userEvent.setup()
    renderPicker(subscribed())
    await user.click(screen.getByRole("button", { name: /cancel your subscription/i }))

    // Cancelling is at period end, so the date they keep access until is the
    // one fact that decides whether they go through with it. It shows twice
    // once the panel is open — the renewal line above still carries it.
    expect(screen.getAllByText(/1 Oct 2026/).length).toBeGreaterThan(1)
    expect(screen.getByText(/you can undo this any time before then/i)).toBeTruthy()
  })

  it("cancels only once confirmed", async () => {
    const user = userEvent.setup()
    renderPicker(subscribed())

    await user.click(screen.getByRole("button", { name: /cancel your subscription/i }))
    await user.click(screen.getByRole("button", { name: /yes, cancel it/i }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("lets someone back out of the confirmation", async () => {
    const user = userEvent.setup()
    renderPicker(subscribed())

    await user.click(screen.getByRole("button", { name: /cancel your subscription/i }))
    await user.click(screen.getByRole("button", { name: /keep my subscription/i }))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.queryByText(/cancel your subscription\?/i)).toBeNull()
  })

  it("undoes a scheduled cancellation in place", async () => {
    const user = userEvent.setup()
    // The banner used to announce the ending and offer no way to change their
    // mind — and when it did, it sent them to Whop's portal to do it.
    renderPicker(subscribed({ cancel_at_period_end: true }))

    expect(screen.getByText(/will cancel at the end of this billing period/i)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /keep my subscription/i }))

    expect(onReactivate).toHaveBeenCalledTimes(1)
    expect(onManage).not.toHaveBeenCalled()
  })

  it("does not offer to cancel a subscription that is already cancelling", () => {
    renderPicker(subscribed({ cancel_at_period_end: true }))

    expect(screen.queryByRole("button", { name: /cancel your subscription/i })).toBeNull()
  })

  it("says nothing about cancelling to someone with no plan", () => {
    renderPicker({ subscribed: false })

    expect(screen.queryByRole("button", { name: /cancel your subscription/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /manage billing/i })).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/link", () => ({ default: ({ children, ...props }) => <a {...props}>{children}</a> }))

import { PlanPicker } from "../PlanPicker"

const onManage = vi.fn()

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

beforeEach(() => onManage.mockClear())

describe("Settings → Billing plan picker", () => {
  it("tells a subscriber where cancelling happens", () => {
    // Whop has no cancel API, so the portal is the only route — but the page
    // used to never say "cancel", leaving people to guess that a button
    // labelled "Manage billing" was the way out.
    render(<PlanPicker billingStatus={subscribed()} onManage={onManage} />)

    expect(screen.getByText(/cancel your subscription/i)).toBeTruthy()
  })

  it("opens the portal from the cancellation copy, not just the Manage button", async () => {
    const user = userEvent.setup()
    render(<PlanPicker billingStatus={subscribed()} onManage={onManage} />)

    await user.click(screen.getByRole("button", { name: /open it here/i }))

    expect(onManage).toHaveBeenCalledTimes(1)
  })

  it("offers a way back to someone who already scheduled a cancellation", async () => {
    const user = userEvent.setup()
    render(
      <PlanPicker billingStatus={subscribed({ cancel_at_period_end: true })} onManage={onManage} />
    )

    expect(screen.getByText(/will cancel at the end of this billing period/i)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /reactivate it in the billing portal/i }))
    expect(onManage).toHaveBeenCalledTimes(1)
  })

  it("does not offer to cancel a subscription that is already cancelling", () => {
    // Two competing prompts about cancellation would just be noise; the
    // scheduled-cancellation banner is the one that applies.
    render(
      <PlanPicker billingStatus={subscribed({ cancel_at_period_end: true })} onManage={onManage} />
    )

    expect(screen.queryByText(/cancel your subscription\?/i)).toBeNull()
  })

  it("says nothing about cancelling to someone with no plan", () => {
    render(<PlanPicker billingStatus={{ subscribed: false }} onManage={onManage} />)

    expect(screen.queryByText(/cancel your subscription/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /manage billing/i })).toBeNull()
  })
})

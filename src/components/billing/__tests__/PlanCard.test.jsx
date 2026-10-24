import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({ default: ({ children, ...props }) => <a {...props}>{children}</a> }))

import { PlanCard } from "../PlanCard"
import { PLANS } from "../plans"

const growth = PLANS.find((p) => p.id === "growth")

describe("PlanCard", () => {
  it("disables the checkout button when told to", () => {
    render(<PlanCard plan={growth} billingStatus={null} onCheckout={() => {}} disabled />)
    expect(screen.getByRole("button", { name: /get started/i })).toBeDisabled()
  })

  it("can drop its corner badge", () => {
    const { rerender } = render(<PlanCard plan={growth} billingStatus={null} onCheckout={() => {}} />)
    expect(screen.getByText("Most popular")).toBeTruthy()
    rerender(<PlanCard plan={growth} billingStatus={null} onCheckout={() => {}} hideBadge />)
    expect(screen.queryByText("Most popular")).toBeNull()
  })
})

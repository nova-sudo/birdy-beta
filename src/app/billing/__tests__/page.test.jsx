import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.hoisted(() => { process.env.NEXT_PUBLIC_WHOP_PLAN_GROWTH = "plan_growth_test" })
vi.mock("next/link", () => ({ default: ({ children, ...props }) => <a {...props}>{children}</a> }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
const whop = vi.hoisted(() => ({ props: null }))
vi.mock("@whop/checkout/react", () => ({
  WhopCheckoutEmbed: (props) => {
    whop.props = props
    return <div data-testid="whop-embed" />
  },
}))
const credits = vi.hoisted(() => ({ setCheckoutPack: vi.fn() }))
vi.mock("@/components/settings/CreditsPanel", () => ({
  useCreditsData: () => ({
    usage: null,
    packs: [],
    packsLoading: false,
    checkoutPack: null,
    setCheckoutPack: credits.setCheckoutPack,
    successMsg: null,
    setSuccessMsg: vi.fn(),
    storedEmail: "",
    handleTopupComplete: vi.fn(),
  }),
  CreditBalanceCard: () => <div data-testid="credit-balance" />,
  TopupPacksCard: () => <div data-testid="topup-packs" />,
  CreditUsageCard: () => <div data-testid="credit-usage" />,
  TopupModal: () => null,
  SuccessBanner: ({ message }) => (message ? <div role="status">{message}</div> : null),
}))

import { apiRequest } from "@/lib/api"
import BillingPage from "../page"

const json = (body, ok = true) => ({ ok, json: async () => body })

const growth = (extra = {}) => ({
  subscribed: true,
  plan: { id: "growth", name: "Growth" },
  status: "active",
  client_count: 4,
  client_limit: 10,
  extra_clients_paid: 0,
  current_period_end: "2026-10-01T00:00:00Z",
  cancel_at_period_end: false,
  ...extra,
})

function mockStatus(status) {
  apiRequest.mockImplementation(async (url) => {
    if (url === "/api/billing/status") return json(status)
    if (url === "/api/billing/portal-url") return json({ portal_url: "https://whop.example/manage" })
    throw new Error(`unexpected ${url}`)
  })
}

beforeEach(() => {
  apiRequest.mockReset()
  credits.setCheckoutPack.mockClear()
  window.open = vi.fn()
})

describe("/billing", () => {
  it("renders the PageHeader title and the three plan cards from ds", async () => {
    mockStatus(growth())
    const { container } = render(<BillingPage />)

    expect(await screen.findByRole("heading", { level: 1, name: "Billing" })).toBeTruthy()
    expect(container.querySelector('[data-ds="page-header"]')).toBeTruthy()
    await waitFor(() => expect(container.querySelectorAll("[data-plan]").length).toBe(3))
    for (const card of container.querySelectorAll("[data-plan]")) {
      expect(card.getAttribute("data-ds")).toBe("surface")
    }
    expect(screen.getByRole("heading", { name: "Compare plans" })).toBeTruthy()
  })

  it("marks the subscribed tier Current and the top tier Best value", async () => {
    mockStatus(growth())
    const { container } = render(<BillingPage />)

    await waitFor(() => expect(container.querySelector('[data-plan="growth"]')).toBeTruthy())
    const growthCard = container.querySelector('[data-plan="growth"]')
    expect(growthCard.querySelector('[data-ds="badge"]').textContent).toBe("Current")
    expect(container.querySelector('[data-plan="scale"] [data-ds="badge"]').textContent).toBe("Best value")
    expect(container.querySelector('[data-plan="starter"] [data-ds="badge"]')).toBeNull()
  })

  it("Manage billing and Upgrade open the same portal URL", async () => {
    mockStatus(growth())
    render(<BillingPage />)
    const user = userEvent.setup()

    const manage = (await screen.findAllByRole("button", { name: /manage billing/i }))[0]
    await user.click(manage)
    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith("https://whop.example/manage", "_blank", "noopener,noreferrer")
    )
    expect(apiRequest).toHaveBeenCalledWith("/api/billing/portal-url")

    window.open.mockClear()
    await user.click(screen.getByRole("button", { name: "Upgrade to Scale" }))
    await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1))
  })

  it("shows the cancel-at-period-end warning in a SystemBanner", async () => {
    mockStatus(growth({ cancel_at_period_end: true }))
    const { container } = render(<BillingPage />)

    await waitFor(() => expect(container.querySelector('[data-ds="system-banner"]')).toBeTruthy())
    expect(container.querySelector('[data-ds="system-banner"]').textContent).toMatch(
      /will cancel at the end of this billing period/
    )
  })

  it("Get started with no plan reports the missing Whop plan id in a SystemBanner", async () => {
    mockStatus({ subscribed: false })
    const { container } = render(<BillingPage />)
    const user = userEvent.setup()

    expect(await screen.findByText("No plan yet")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Choose a plan" })).toBeTruthy()
    await user.click(screen.getAllByRole("button", { name: "Get started" })[0])

    // No NEXT_PUBLIC_WHOP_PLAN_* in the test env: the same "not available" error as before.
    await waitFor(() => {
      const banner = container.querySelector('[data-ds="system-banner"]')
      expect(banner).toBeTruthy()
      expect(banner.textContent).toMatch(/plan isn't available yet/)
    })
  })

  it("shows skeletons while loading", () => {
    apiRequest.mockReturnValue(new Promise(() => {}))
    const { container } = render(<BillingPage />)

    expect(container.querySelectorAll('[data-ds="skeleton"]').length).toBeGreaterThan(0)
    expect(container.querySelector("[data-plan]")).toBeNull()
  })

  it("shows an ErrorState with Try again when the status fails to load", async () => {
    apiRequest.mockResolvedValueOnce(json({}, false))
    const { container } = render(<BillingPage />)

    expect(await screen.findByText("Couldn't load billing")).toBeTruthy()
    expect(container.querySelector('[data-ds="error-state"]')).toBeTruthy()

    mockStatus(growth())
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(container.querySelector('[data-plan="growth"]')).toBeTruthy())
  })

  it("opens checkout on Get started and prefills the stored email", async () => {
    localStorage.setItem("user", JSON.stringify({ email: "owner@agency.test" }))
    mockStatus({ subscribed: false })
    const { container } = render(<BillingPage />)
    const user = userEvent.setup()

    await screen.findByText("No plan yet")
    const growthCard = container.querySelector('[data-plan="growth"]')
    await user.click(growthCard.querySelector("button"))

    expect(await screen.findByTestId("whop-embed")).toBeTruthy()
    expect(whop.props.planId).toBe("plan_growth_test")
    expect(whop.props.prefill).toEqual({ email: "owner@agency.test" })
    localStorage.removeItem("user")
  })

  it("surfaces a failed post-checkout poll when a status is already loaded", async () => {
    window.history.pushState({}, "", "/billing?checkout=success")
    let calls = 0
    apiRequest.mockImplementation(async () => {
      calls += 1
      return calls === 1 ? json(growth()) : json({}, false)
    })
    const { container } = render(<BillingPage />)

    await waitFor(() => expect(container.querySelector('[data-plan="growth"]')).toBeTruthy())
    await waitFor(
      () => expect(container.querySelector('[data-ds="system-banner"]')?.textContent).toMatch(/Failed to load billing status/),
      { timeout: 4000 }
    )
    // The loaded page stays; no full-page ErrorState replaces it.
    expect(container.querySelector('[data-ds="error-state"]')).toBeNull()
    expect(container.querySelector('[data-plan="growth"]')).toBeTruthy()
    window.history.pushState({}, "", "/")
  })

  it("keeps the cancel warning inside the plan summary card", async () => {
    mockStatus(growth({ cancel_at_period_end: true }))
    const { container } = render(<BillingPage />)

    await waitFor(() => expect(container.querySelector('[data-ds="system-banner"]')).toBeTruthy())
    expect(container.querySelector('[data-ds="system-banner"]').closest('[data-ds="surface"]')).toBeTruthy()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@whop/checkout/react", () => ({
  WhopCheckoutEmbed: ({ planId, returnUrl }) => <div data-testid="whop" data-plan={planId} data-return={returnUrl} />,
}))
vi.mock("@/components/billing/plans", () => ({
  PLAN_ORDER: ["starter", "growth", "scale"],
  PLANS: [
    { id: "starter", name: "Starter", price: 97, planId: "plan_s", features: ["Up to 3 client groups"] },
    { id: "growth", name: "Growth", price: 297, planId: "plan_g", popular: true, features: ["Up to 10 client groups"] },
    { id: "scale", name: "Scale", price: 497, planId: "plan_x", supportsExtraSlots: true, features: ["Up to 25 client groups"] },
  ],
}))

import { apiRequest } from "@/lib/api"
import { CreditsProvider } from "@/hooks/useCredits"
import { SWRConfig } from "swr"
import { PlanSection } from "../plan-section"

const SUBSCRIBED = {
  subscribed: true, plan: { id: "growth", name: "Growth", max_clients: 10 }, status: "active",
  client_count: 7, client_limit: 10, extra_clients_paid: 0, current_period_end: "2026-12-04T00:00:00Z", cancel_at_period_end: false,
}
const FREE = { subscribed: false, plan: { id: "free" }, status: "inactive", client_count: 0, client_limit: 0 }

let billing
const calls = []
function ok(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
}
beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  billing = SUBSCRIBED
  window.history.replaceState(null, "", "/settings?section=plan")
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    calls.push(`${opts.method || "GET"} ${url}`)
    if (url === "/api/billing/status") return ok(billing)
    if (url === "/api/credits/status") return ok({ balance: 4359, allowance: 10000, remaining_allowance: 4400, topup_balance: 0, enforced: true })
    if (url.startsWith("/api/credits/usage")) return ok({ total_credits: 5593, total_questions: 415, by_day: [{ date: "2026-11-20", credits: 120, questions: 9 }], by_feature: { ask_birdy: 4000, suggestions: 1593 } })
    if (url === "/api/credits/topup-packs") return ok({ packs: [{ id: "p1", credits: 1000, price: 10, plan_id: "plan_p1" }, { id: "p10", credits: 10000, price: 80, plan_id: "plan_p10" }] })
    if (url === "/api/billing/portal-url") return ok({ portal_url: "https://whop.example/portal" })
    if (url === "/api/billing/cancel") { billing = { ...SUBSCRIBED, cancel_at_period_end: true }; return ok({ cancelled: true }) }
    return ok({})
  })
})

function renderSection() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: (key) => apiRequest(key).then((r) => r.json()) }}>
      <CreditsProvider><PlanSection /></CreditsProvider>
    </SWRConfig>,
  )
}

describe("PlanSection", () => {
  it("shows the plan, its slots and the credits from the API", async () => {
    renderSection()
    expect(await screen.findByText("Growth")).toBeInTheDocument()
    expect(screen.getByText("Billed monthly · next bill 4 Dec 2026")).toBeInTheDocument()
    expect(screen.getByText("7 of 10")).toBeInTheDocument()
    expect(screen.getByText("$297 / month")).toBeInTheDocument()
    expect(await screen.findByText("5,593 used in 30 days · 415 questions asked")).toBeInTheDocument()
  })

  it("opens the Whop portal from Manage billing", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    renderSection()
    await userEvent.click(await screen.findByRole("button", { name: /Manage billing/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://whop.example/portal", "_blank", "noopener,noreferrer"))
  })

  it("cancels at period end after confirming, then offers to keep it", async () => {
    renderSection()
    await userEvent.click(await screen.findByRole("button", { name: "Cancel your subscription" }))
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }))
    await waitFor(() => expect(calls).toContain("POST /api/billing/cancel"))
    expect(await screen.findByText(/Your subscription ends 4 Dec 2026/)).toBeInTheDocument()
  })

  it("without a plan, a tier opens Whop's checkout returning to Settings", async () => {
    billing = FREE
    renderSection()
    await userEvent.click(await screen.findByRole("button", { name: "Choose a plan" }))
    const dialog = await screen.findByRole("dialog", { name: "Choose a plan" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Get started: Scale" }))
    const whop = await screen.findByTestId("whop")
    expect(whop.dataset.plan).toBe("plan_x")
    expect(whop.dataset.return).toMatch(/\/settings\?section=plan&checkout=success$/)
  })

  it("tops up from a pack, hiding the bulk tier", async () => {
    renderSection()
    await userEvent.click(await screen.findByRole("button", { name: "Top up" }))
    const dialog = await screen.findByRole("dialog", { name: "Top up credits" })
    expect(within(dialog).queryByText("10,000 credits")).toBeNull()
    await userEvent.click(within(dialog).getByRole("button", { name: /1,000 credits/ }))
    const whop = await screen.findByTestId("whop")
    expect(whop.dataset.plan).toBe("plan_p1")
    expect(whop.dataset.return).toMatch(/topup=success$/)
  })

  it("reads Whop's return flag and drops it from the address", async () => {
    window.history.replaceState(null, "", "/settings?section=plan&topup=success")
    renderSection()
    expect(await screen.findByText(/Credits added/)).toBeInTheDocument()
    expect(window.location.search).toBe("?section=plan")
  })
})

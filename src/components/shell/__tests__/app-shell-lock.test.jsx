import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, waitFor } from "@testing-library/react"
import "@/components/by/__tests__/jsdom"

// The shell holds an account in setup that belongs there but isn't held yet:
// a session from before plans were required, now without a plan.

const push = vi.fn()
const route = { pathname: "/campaigns" }
const setup = { current: null }
const me = { current: { email: "hadley@agency.test", impersonating: false } }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams() }))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ status: null }) }))
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isAdmin: false }) }))
vi.mock("@/lib/agents-api", () => ({ useAgentWorkCount: () => 0 }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [], loading: false, error: null, refresh: vi.fn(), invalidate: vi.fn() }) }))
vi.mock("@/components/ds", () => ({ confirm: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })) }))
vi.mock("@/lib/use-setup", () => ({ useSetup: () => setup.current }))
vi.mock("@/lib/admin-api", () => ({ fetchMe: vi.fn(async () => me.current) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => <span /> }))

import { deriveSteps } from "@/lib/setup-steps"
import { readSession, writeSession } from "@/lib/session"
import { AppShell } from "../app-shell"

const ob = (extra) => ({ completed: true, name: "Hadley", agency_name: "Agency", default_currency: "GBP", data: { sales_tool: "ghl" }, ...extra })
const account = (onboarding, billing = null) => {
  const facts = { onboarding, status: { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } }, hp: null, slack: null, clients: [], billing }
  return { facts, steps: deriveSteps(facts), ready: true, failed: false, completed: Boolean(onboarding.completed), refresh: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  route.pathname = "/campaigns"
  me.current = { email: "hadley@agency.test", impersonating: false }
  localStorage.setItem("user", JSON.stringify({ email: "hadley@agency.test", role: "user" }))
  writeSession({ expiresAt: new Date(Date.now() + 86400000).toISOString(), role: "user", onboardingIncomplete: false })
})

describe("AppShell: holding an account without a plan in setup", () => {
  it("sends a finished account that needs a plan to /welcome and keeps it there", async () => {
    setup.current = account(ob({ needs_plan: true }), { subscribed: false, needs_plan: true })
    render(<AppShell><p>Page</p></AppShell>)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome"))
    expect(localStorage.getItem("onboarding_incomplete")).toBe("1")
    // The proxy routes the next request on the cookie, so it says so too.
    expect(readSession().ob).toBe(true)
  })

  it("leaves an account with a plan alone", async () => {
    setup.current = account(ob({ needs_plan: false }), { subscribed: true, needs_plan: false })
    render(<AppShell><p>Page</p></AppShell>)
    await new Promise((r) => setTimeout(r, 20))
    expect(push).not.toHaveBeenCalled()
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
  })

  it("never holds an admin impersonating the account", async () => {
    me.current = { email: "hadley@agency.test", impersonating: true }
    setup.current = account(ob({ needs_plan: true }), { subscribed: false, needs_plan: true })
    render(<AppShell><p>Page</p></AppShell>)
    await new Promise((r) => setTimeout(r, 20))
    expect(push).not.toHaveBeenCalled()
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
  })
})

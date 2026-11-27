import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

const push = vi.fn()
const route = { pathname: "/campaigns" }
const role = { isAdmin: false }
const work = { count: 8 }
const credits = { status: { ok: true }, allowance: 1000, balance: 440, remainingAllowance: 440 }
const groups = { clientGroups: [], loading: false, error: null }
const confirm = vi.fn(() => Promise.resolve(false))
const clearSession = vi.fn()
// What GET /api/team/setup answers; null makes it fail, so every agent reads as unlocked.
const team = { body: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.search ?? "") }))
// The dialogs are loaded lazily and are covered by their own tests.
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => credits }))
vi.mock("@/hooks/useRole", () => ({ useRole: () => role }))
vi.mock("@/lib/agents-api", () => ({ useAgentWorkCount: () => work.count }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ ...groups, refresh: vi.fn(), invalidate: vi.fn() }) }))
vi.mock("@/components/ds", () => ({ confirm: (...args) => confirm(...args) }))
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn((url) => Promise.resolve(url === "/api/team/setup" && team.body
    ? { ok: true, status: 200, json: async () => team.body }
    : url === "/api/team/setup" ? { ok: false, status: 404, json: async () => ({ detail: "Not Found" }) } : { ok: true })),
}))
vi.mock("@/lib/session", () => ({ clearSession: () => clearSession() }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: ({ size }) => <span data-testid="birdy" style={{ width: size }} /> }))

import { apiRequest } from "@/lib/api"
import { AppShell } from "../app-shell"

const CLIENTS = [
  { id: "a", name: "Aura", client_status: "Active", health: "Critical" },
  { id: "b", name: "Healthy Glow", client_status: "Active", health: "Healthy" },
  { id: "c", name: "Old Clinic", client_status: "Inactive", health: "Critical" },
]
const shell = () => render(<AppShell><p>Page content</p></AppShell>)

beforeEach(() => {
  vi.clearAllMocks()
  route.pathname = "/campaigns"
  role.isAdmin = false
  work.count = 8
  Object.assign(groups, { clientGroups: CLIENTS, loading: false, error: null })
  team.body = null
  localStorage.setItem("user", JSON.stringify({ name: "Hadley", email: "hadley@agency.test", role: "user" }))
})

describe("AppShell: the rail", () => {
  it("renders the page beside the rail", () => {
    shell()
    expect(screen.getByText("Page content")).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument()
  })

  it.each([
    ["Agency Ops", "/dashboard"],
    ["Sales Coach", "/sales-coach"],
    ["Settings", "/settings"],
  ])("opens %s at %s", async (name, href) => {
    shell()
    await userEvent.click(screen.getByRole("button", { name }))
    expect(push).toHaveBeenCalledWith(href)
  })

  it("marks the section the current page belongs to", () => {
    route.pathname = "/hub/agents/media-buying"
    shell()
    expect(screen.getByRole("button", { name: /Marketing Guru/ })).toHaveAttribute("aria-current", "page")
    // Clients has no tile: Agency Ops' Dashboard tab is the Clients table.
    expect(screen.queryByRole("button", { name: "Clients" })).toBeNull()
  })

  it("flags Marketing Guru with the agent’s open work, and no section when there is none", () => {
    const { unmount } = shell()
    expect(screen.getByRole("button", { name: "Marketing Guru, 8 waiting" })).toBeInTheDocument()
    unmount()
    work.count = null
    shell()
    expect(screen.getByRole("button", { name: "Marketing Guru" })).toBeInTheDocument()
  })

  it("shows the credit balance, or no ring when credits are unavailable", () => {
    const { unmount } = shell()
    expect(screen.getByRole("img", { name: "440 credits left, 44%" })).toBeInTheDocument()
    unmount()
    const saved = credits.status
    credits.status = null
    shell()
    expect(screen.queryByRole("img", { name: /credits left/ })).not.toBeInTheDocument()
    credits.status = saved
  })
})

describe("AppShell: other pages", () => {
  it("has no Other pages tile", () => {
    shell()
    expect(screen.queryByRole("button", { name: "Other pages" })).toBeNull()
  })
})

describe("AppShell: the client switcher", () => {
  it("lists real clients and opens the one picked", async () => {
    shell()
    await userEvent.click(screen.getByRole("button", { name: "Switch client, showing all clients" }))
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Add new client", "Agency view3 clients", "Aura, at risk", "Healthy Glow, on track", "Old Clinic, inactive"])
    await userEvent.click(screen.getByRole("option", { name: /Healthy Glow/ }))
    expect(push).toHaveBeenCalledWith("/dashboard?client=b")
  })

  it("shows the client whose page is open, and returns to the list for the agency view", async () => {
    route.pathname = "/clients/a"
    shell()
    await userEvent.click(screen.getByRole("button", { name: "Switch client, showing Aura" }))
    await userEvent.click(await screen.findByRole("option", { name: /Agency view/ }))
    expect(push).toHaveBeenCalledWith("/clients")
  })

  it("follows the client Birdy is narrowed to, and returns to the whole agency there", async () => {
    Object.assign(route, { pathname: "/dashboard", search: "client=a" })
    shell()
    await userEvent.click(screen.getByRole("button", { name: "Switch client, showing Aura" }))
    await userEvent.click(await screen.findByRole("option", { name: /Agency view/ }))
    expect(push).toHaveBeenCalledWith("/dashboard")
    route.search = ""
  })

  it("shows the loading and failed states of the client list", async () => {
    Object.assign(groups, { clientGroups: [], loading: true })
    const { unmount } = shell()
    await userEvent.click(screen.getByRole("button", { name: /Switch client/ }))
    expect(await screen.findByRole("status", { name: "Loading clients" })).toBeInTheDocument()
    unmount()
    Object.assign(groups, { loading: false, error: "HTTP 500" })
    shell()
    await userEvent.click(screen.getByRole("button", { name: /Switch client/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t load your clients.")
  })
})

describe("AppShell: the account menu", () => {
  it("shows who is signed in, with Settings and Log out but no admin entry for a normal user", async () => {
    shell()
    await userEvent.click(await screen.findByRole("button", { name: "Account menu, Hadley" }))
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Settings", "Log out"])
    expect(screen.getByText("hadley@agency.test")).toBeInTheDocument()
  })

  it("adds the admin console for an admin", async () => {
    role.isAdmin = true
    shell()
    await userEvent.click(await screen.findByRole("button", { name: "Account menu, Hadley" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Admin console" }))
    expect(push).toHaveBeenCalledWith("/admin")
  })

  it("asks before logging out, and does nothing when cancelled", async () => {
    shell()
    await userEvent.click(await screen.findByRole("button", { name: "Account menu, Hadley" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Log out" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(apiRequest).not.toHaveBeenCalledWith("/api/logout", expect.anything())
    expect(localStorage.getItem("user")).not.toBeNull()
  })

  it("logs out when confirmed: tells the server, clears the session and local data", async () => {
    confirm.mockResolvedValueOnce(true)
    shell()
    await userEvent.click(await screen.findByRole("button", { name: "Account menu, Hadley" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Log out" }))
    await waitFor(() => expect(clearSession).toHaveBeenCalledOnce())
    expect(apiRequest).toHaveBeenCalledWith("/api/logout", { method: "POST" })
    expect(localStorage.getItem("user")).toBeNull()
  })
})

describe("AppShell: agents that aren't set up", () => {
  const agent = (status, extra = {}) => ({ status, waits_on: null, order: ["clients", "schedule"], steps: {}, current: null, known: [], values: {}, completed_at: null, ...extra })
  const fresh = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><AppShell><p>Page content</p></AppShell></SWRConfig>)

  it("puts a lock on the rail for each locked agent", async () => {
    team.body = { agents: { birdy: { status: "done" }, media_buyer: agent("open", { steps: { clients: true } }), sales_coach: agent("locked", { waits_on: "media_buyer" }), sub_agents: { status: "locked" } } }
    fresh()
    expect(await screen.findByRole("button", { name: "Sales Coach, locked" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Marketing Guru, 8 waiting" })).toBeInTheDocument()
  })

  it("puts no locks on the rail when the team state can't be read", async () => {
    fresh()
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/team/setup"))
    expect(screen.getByRole("button", { name: "Sales Coach" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /locked/ })).not.toBeInTheDocument()
  })
})

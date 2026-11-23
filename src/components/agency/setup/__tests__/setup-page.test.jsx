import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { deriveSteps } from "@/lib/setup-steps"
import { SetupPage } from "../setup-page"

const push = vi.fn()
const route = { search: "" }
const refresh = vi.fn()
const state = { facts: null }
const calls = []
const replies = {}
const handoff = vi.fn()
const openAddClient = vi.fn()
const openImport = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/use-setup", () => ({
  useSetup: () => ({ facts: state.facts, steps: deriveSteps(state.facts), ready: true, failed: false, completed: Boolean(state.facts.onboarding?.completed), refresh }),
}))
vi.mock("@/lib/oauth-handoff", () => ({ setOAuthHandoff: (p) => handoff(p), takeOAuthHandoff: () => null }))
vi.mock("@/components/shell/client-actions", () => ({ useClientActions: () => ({ openAddClient, openImport }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [], loading: false, error: null, invalidate: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/lib/api", () => ({
  apiRequest: async (url, opts = {}) => {
    const method = opts.method || "GET"
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined })
    const [status, body] = replies[`${method} ${url}`] ?? [200, { ok: true }]
    return { ok: status < 400, status, json: async () => body }
  },
}))

const ob = (extra = {}, data = {}) => ({ completed: false, name: "Sam Carter", agency_name: "Northside", default_currency: "GBP", data, ...extra })
const both = { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } }
const C = (id, extra = {}) => ({ id, name: `Client ${id}`, client_status: "Active", call_log_provider: "ghl", ...extra })
const OPS_DONE = {
  onboarding: ob({}, { sales_tool: "ghl" }),
  status: both,
  hp: { connected: false },
  slack: { installed: true, notify_channel_id: "C1", notify_channel_name: "alerts" },
  clients: [C("a", { targets: { cpa: 40, cpl: 6 } }), C("b"), C("c", { targets: { cpl: 9 } })],
}
const sent = (method, url) => calls.filter((c) => c.method === method && c.url === url)
const page = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
const locked = (waits) => ({ status: "locked", waits_on: waits, order: ["clients"], steps: {}, current: null, known: [], values: {}, completed_at: null })
// Birdy still setting up, so every agent after it is locked.
const FRESH_TEAM = { agents: { birdy: { status: "open" }, media_buyer: locked("birdy"), sales_coach: locked("media_buyer"), sub_agents: { status: "locked", waits_on: "sales_coach" } } }

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const k of Object.keys(replies)) delete replies[k]
  route.search = ""
  localStorage.clear()
  state.facts = { onboarding: ob({ agency_name: null, default_currency: null }), status: null, hp: null, slack: null, clients: [] }
})

describe("SetupPage", () => {
  it("shows the checklist from the account's state, with Media Buyer locked in the team", async () => {
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    page()
    const list = screen.getByRole("region", { name: "Set up Birdy" })
    expect(within(list).getByRole("button", { name: /Agency basics/ })).toHaveTextContent("In setup")
    expect(within(list).getByRole("button", { name: /Connect Meta/ })).toHaveTextContent("To do")
    const team = await screen.findByRole("navigation", { name: "Your team" })
    expect(within(team).getByRole("button", { name: /Agency Ops/ })).toHaveAttribute("aria-current", "step")
    expect(within(team).getByRole("button", { name: /Media Buyer/ })).toBeDisabled()
    expect(within(team).getByRole("button", { name: /Media Buyer/ })).toHaveAttribute("title", "Unlocks after Agency Ops")
  })

  it("saves the basics to the account", async () => {
    page()
    await userEvent.type(screen.getByLabelText("Agency name"), "Northside Media")
    await userEvent.click(screen.getByRole("radio", { name: "USD" }))
    await userEvent.click(screen.getByRole("button", { name: "Continue" }))
    expect(sent("PUT", "/api/onboarding/state")[0].body).toEqual({ data: { name: "Sam Carter", agency: "Northside Media", currency: "USD" } })
    expect(localStorage.getItem("user_default_currency")).toBe("USD")
    expect(refresh).toHaveBeenCalledWith("onboarding")
  })

  it("starts Meta's login with a way back to setup", async () => {
    state.facts = { ...state.facts, onboarding: ob() }
    replies["GET /api/connect/facebook"] = [200, { auth_url: "https://facebook.example/oauth" }]
    page()
    await userEvent.click(screen.getByRole("button", { name: "Connect Meta" }))
    expect(handoff).toHaveBeenCalledWith("/welcome")
    expect(sent("GET", "/api/connect/facebook")).toHaveLength(1)
  })

  it("says what the server said when a connection can't start", async () => {
    state.facts = { ...state.facts, onboarding: ob() }
    replies["GET /api/connect"] = [500, { detail: "GoHighLevel isn’t configured" }]
    page()
    await userEvent.click(screen.getByRole("button", { name: "Connect GoHighLevel" }))
    expect(await screen.findByText("GoHighLevel isn’t configured")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry GoHighLevel" })).toBeInTheDocument()
  })

  it("asks for a Hot Prospector key and sends it", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "hp" }), status: both, hp: { connected: false } }
    page()
    await userEvent.type(screen.getByLabelText("API UID"), "uid-1")
    await userEvent.type(screen.getByLabelText("API key"), "key-1")
    await userEvent.click(screen.getByRole("button", { name: "Connect Hot Prospector" }))
    expect(sent("POST", "/api/hotprospector/connect")[0].body).toEqual({ api_uid: "uid-1", api_key: "key-1" })
    await waitFor(() => expect(refresh).toHaveBeenCalledWith("hp"))
  })

  it("adds the first client with the app's Add client dialog", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both }
    page()
    await userEvent.click(screen.getByRole("button", { name: "Add your first client" }))
    expect(openAddClient).toHaveBeenCalled()
  })

  it("saves targets on the first client and on the others too", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both, clients: [C("a"), C("b"), C("c", { targets: { something_else: 3 } })] }
    page()
    await userEvent.type(screen.getByLabelText("Cost per acquisition"), "45")
    await userEvent.type(screen.getByLabelText("Close rate"), "15")
    await userEvent.click(screen.getByRole("button", { name: "Save targets" }))
    expect(sent("PUT", "/api/client-groups/a/targets")[0].body).toEqual({ cpa: 45, conversion_rate: 0.15, save_as_default: true })
    expect(sent("PUT", "/api/client-groups/b/targets")[0].body).toEqual({ cpa: 45, conversion_rate: 0.15, save_as_default: false })
    expect(sent("PUT", "/api/client-groups/c/targets")).toHaveLength(1)
    expect(refresh).toHaveBeenCalledWith("clients")
  })

  it("finishes Birdy and opens Media Buyer", async () => {
    state.facts = OPS_DONE
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    localStorage.setItem("onboarding_incomplete", "1")
    page()
    await userEvent.click(await screen.findByRole("button", { name: /Set up Media Buyer/ }))
    expect(sent("POST", "/api/onboarding/complete")).toHaveLength(1)
    // The server opens Media Buyer once Birdy is done, so its state is read again.
    await waitFor(() => expect(sent("GET", "/api/team/setup").length).toBeGreaterThan(1))
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
    expect(push).toHaveBeenCalledWith("/welcome?s=buyer")
  })

  it("opens Birdy instead of an agent that is still locked", async () => {
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    route.search = "s=mb"
    page()
    await screen.findByRole("navigation", { name: "Your team" })
    expect(screen.getByRole("heading", { name: "Agency Ops", level: 1 })).toBeInTheDocument()
  })

  it("shows only Birdy's setup when the team state can't be read", async () => {
    replies["GET /api/team/setup"] = [404, { detail: "Not Found" }]
    state.facts = OPS_DONE
    route.search = "s=buyer"
    page()
    expect(await screen.findByRole("heading", { name: "Agency Ops", level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("region", { name: "Set up Birdy" })).toBeInTheDocument())
    expect(screen.queryByRole("navigation", { name: "Your team" })).not.toBeInTheDocument()
    // No team to hand over to: the last step only opens the app.
    expect(screen.queryByRole("button", { name: /Set up Media Buyer/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Agency Ops" })).toBeInTheDocument()
  })

  it("folds the checklist to a bar", async () => {
    state.facts = { ...OPS_DONE, clients: OPS_DONE.clients.slice(0, 1) }
    page()
    await userEvent.click(screen.getByRole("button", { name: "Fold the checklist" }))
    expect(screen.getByRole("button", { name: /Setup 88% done. Show the checklist/ })).toBeInTheDocument()
    expect(localStorage.getItem("birdy_setup_checklist_folded")).toBe("true")
  })
})

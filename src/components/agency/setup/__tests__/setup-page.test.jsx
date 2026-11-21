import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
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

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const k of Object.keys(replies)) delete replies[k]
  route.search = ""
  localStorage.clear()
  state.facts = { onboarding: ob({ agency_name: null, default_currency: null }), status: null, hp: null, slack: null, clients: [] }
})

describe("SetupPage", () => {
  it("shows the checklist from the account's state, with Media Buyer locked", () => {
    render(<SetupPage />)
    const list = screen.getByRole("region", { name: "Set up Birdy" })
    expect(within(list).getByRole("button", { name: /Agency basics/ })).toHaveTextContent("In setup")
    expect(within(list).getByRole("button", { name: /Connect Meta/ })).toHaveTextContent("To do")
    expect(within(list).getByRole("button", { name: /CPL limits/ })).toBeDisabled()
    expect(screen.getByRole("tab", { name: /Media Buyer/ })).toHaveAttribute("title", "Unlocks after Agency Ops")
  })

  it("saves the basics to the account", async () => {
    render(<SetupPage />)
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
    render(<SetupPage />)
    await userEvent.click(screen.getByRole("button", { name: "Connect Meta" }))
    expect(handoff).toHaveBeenCalledWith("/welcome")
    expect(sent("GET", "/api/connect/facebook")).toHaveLength(1)
  })

  it("says what the server said when a connection can't start", async () => {
    state.facts = { ...state.facts, onboarding: ob() }
    replies["GET /api/connect"] = [500, { detail: "GoHighLevel isn’t configured" }]
    render(<SetupPage />)
    await userEvent.click(screen.getByRole("button", { name: "Connect GoHighLevel" }))
    expect(await screen.findByText("GoHighLevel isn’t configured")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry GoHighLevel" })).toBeInTheDocument()
  })

  it("asks for a Hot Prospector key and sends it", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "hp" }), status: both, hp: { connected: false } }
    render(<SetupPage />)
    await userEvent.type(screen.getByLabelText("API UID"), "uid-1")
    await userEvent.type(screen.getByLabelText("API key"), "key-1")
    await userEvent.click(screen.getByRole("button", { name: "Connect Hot Prospector" }))
    expect(sent("POST", "/api/hotprospector/connect")[0].body).toEqual({ api_uid: "uid-1", api_key: "key-1" })
    await waitFor(() => expect(refresh).toHaveBeenCalledWith("hp"))
  })

  it("adds the first client with the app's Add client dialog", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both }
    render(<SetupPage />)
    await userEvent.click(screen.getByRole("button", { name: "Add your first client" }))
    expect(openAddClient).toHaveBeenCalled()
  })

  it("saves targets on the first client and on the others too", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both, clients: [C("a"), C("b"), C("c", { targets: { something_else: 3 } })] }
    render(<SetupPage />)
    await userEvent.type(screen.getByLabelText("Cost per acquisition"), "45")
    await userEvent.type(screen.getByLabelText("Close rate"), "15")
    await userEvent.click(screen.getByRole("button", { name: "Save targets" }))
    expect(sent("PUT", "/api/client-groups/a/targets")[0].body).toEqual({ cpa: 45, conversion_rate: 0.15, save_as_default: true })
    expect(sent("PUT", "/api/client-groups/b/targets")[0].body).toEqual({ cpa: 45, conversion_rate: 0.15, save_as_default: false })
    expect(sent("PUT", "/api/client-groups/c/targets")).toHaveLength(1)
    expect(refresh).toHaveBeenCalledWith("clients")
  })

  it("finishes Agency Ops and opens Media Buyer", async () => {
    state.facts = OPS_DONE
    localStorage.setItem("onboarding_incomplete", "1")
    render(<SetupPage />)
    await userEvent.click(screen.getByRole("button", { name: /Set up Media Buyer/ }))
    expect(sent("POST", "/api/onboarding/complete")).toHaveLength(1)
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
    expect(push).toHaveBeenCalledWith("/welcome?s=buyer")
  })

  it("opens Agency Ops instead of a section that is still locked", () => {
    route.search = "s=mb"
    render(<SetupPage />)
    expect(screen.getByRole("heading", { name: "Agency Ops", level: 1 })).toBeInTheDocument()
  })

  it("gives the agency CPL limit to the clients that have none", async () => {
    state.facts = { ...OPS_DONE, onboarding: ob({ completed: true }, { sales_tool: "ghl" }) }
    route.search = "s=buyer"
    render(<SetupPage />)
    const field = screen.getByLabelText("Cost per lead limit")
    expect(field).toHaveValue("6")
    await userEvent.click(screen.getByRole("button", { name: /Use £6 for every client/ }))
    expect(calls.filter((c) => c.method === "PUT").map((c) => [c.url, c.body])).toEqual([["/api/client-groups/b/targets", { cpl: 6 }]])
  })

  it("folds the checklist to a bar and jumps to a step in another section", async () => {
    state.facts = OPS_DONE
    render(<SetupPage />)
    await userEvent.click(screen.getByRole("button", { name: /CPL limits/ }))
    expect(push).toHaveBeenCalledWith("/welcome?s=buyer")
    await userEvent.click(screen.getByRole("button", { name: "Fold the checklist" }))
    expect(screen.getByRole("button", { name: /Setup 89% done. Show the checklist/ })).toBeInTheDocument()
    expect(localStorage.getItem("birdy_setup_checklist_folded")).toBe("true")
  })
})

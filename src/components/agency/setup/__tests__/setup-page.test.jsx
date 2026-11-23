import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
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

const whop = []
vi.mock("@whop/checkout/react", () => ({
  WhopCheckoutEmbed: (props) => { whop.push(props); return <div data-testid="whop-checkout" data-plan={props.planId} /> },
}))
vi.mock("@/components/billing/plans", async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, PLANS: real.PLANS.map((p) => ({ ...p, planId: `plan_${p.id}` })) }
})
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
const PAID = { subscribed: true, needs_plan: false, sandbox: false, plan: { id: "growth", name: "Growth", max_clients: 10 } }
const OPS_DONE = {
  onboarding: ob({}, { sales_tool: "ghl" }),
  status: both,
  hp: { connected: false },
  slack: { installed: true, notify_channel_id: "C1", notify_channel_name: "alerts" },
  clients: [C("a", { targets: { cpa: 40, cpl: 6 } }), C("b"), C("c", { targets: { cpl: 9 } })],
  billing: PAID,
}
const sent = (method, url) => calls.filter((c) => c.method === method && c.url === url)
const page = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
const locked = (waits) => ({ status: "locked", waits_on: waits, order: ["clients"], steps: {}, current: null, known: [], values: {}, completed_at: null })
// Birdy still setting up, so every agent after it is locked.
const FRESH_TEAM = { agents: { birdy: { status: "open" }, media_buyer: locked("birdy"), sales_coach: locked("media_buyer"), sub_agents: { status: "locked", waits_on: "sales_coach" } } }

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  whop.length = 0
  for (const k of Object.keys(replies)) delete replies[k]
  route.search = ""
  localStorage.clear()
  state.facts = { onboarding: ob({ agency_name: null, default_currency: null }), status: null, hp: null, slack: null, clients: [] }
})

describe("SetupPage", () => {
  it("shows the checklist from the account's state, with Media Buyer locked in the team", async () => {
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    page()
    const list = screen.getByRole("complementary", { name: "Set up Birdy" })
    expect(within(list).getByRole("button", { name: /Agency basics/ })).toHaveTextContent("Now")
    expect(within(list).getByText("Connect Meta").closest("li")).toHaveTextContent("To do")
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
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both, billing: PAID }
    page()
    await userEvent.click(screen.getByRole("button", { name: "Add your first client" }))
    expect(openAddClient).toHaveBeenCalled()
  })

  it("saves targets on the first client and on the others too", async () => {
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }), status: both, billing: PAID, clients: [C("a"), C("b"), C("c", { targets: { something_else: 3 } })] }
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
    await waitFor(() => expect(screen.getByRole("complementary", { name: "Set up Birdy" })).toBeInTheDocument())
    expect(screen.queryByRole("navigation", { name: "Your team" })).not.toBeInTheDocument()
    // No team to hand over to: the last step only opens the app.
    expect(screen.queryByRole("button", { name: /Set up Media Buyer/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Agency Ops" })).toBeInTheDocument()
  })

})

describe("SetupPage: the checklist beside the chat", () => {
  it("lists the nine steps beside the chat, which starts with the greeting", () => {
    state.facts = TOOLS_IN()
    page()
    const list = screen.getByRole("complementary", { name: "Set up Birdy" })
    expect(list).toHaveTextContent("44% done · 5 to go")
    expect(within(list).getAllByRole("listitem")).toHaveLength(9)
    const row = (label) => within(list).getByText(label).closest("li")
    expect(row("Connect Meta")).toHaveTextContent("Done")
    expect(row("Pick your plan")).toHaveTextContent("Now")
    expect(row("Pick your plan")).toHaveAttribute("aria-current", "step")
    expect(row("Targets")).toHaveTextContent("To do")
    // Done and current rows jump to their step; a step still to do has nothing to show yet.
    expect(within(row("Connect Meta")).getByRole("button")).toBeInTheDocument()
    expect(within(row("Targets")).queryByRole("button")).not.toBeInTheDocument()
    // The checklist isn't in the chat: the chat's first message is Agency Ops' greeting.
    const chat = document.querySelector('[aria-live="polite"]')
    expect(chat.contains(list)).toBe(false)
    expect(chat.firstElementChild.firstElementChild).toHaveAttribute("id", "step-basics")
  })

  it("scrolls the chat to a step from its row", async () => {
    state.facts = TOOLS_IN()
    const spy = vi.spyOn(Element.prototype, "scrollIntoView")
    page()
    const list = screen.getByRole("complementary", { name: "Set up Birdy" })
    await userEvent.click(within(list).getByRole("button", { name: /Connect GoHighLevel/ }))
    expect(spy.mock.contexts.at(-1)).toBe(document.getElementById("step-ghl"))
    await userEvent.click(within(list).getByRole("button", { name: /Pick your plan/ }))
    expect(spy.mock.contexts.at(-1)).toBe(document.getElementById("step-plan"))
    spy.mockRestore()
  })

  it("folds into a bar on a phone, and the rail's ring opens it", async () => {
    state.facts = TOOLS_IN()
    const first = page()
    const toggle = screen.getByRole("button", { name: "Show the setup steps" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(toggle)
    expect(screen.getByRole("button", { name: "Hide the setup steps" })).toHaveAttribute("aria-expanded", "true")
    first.unmount()
    route.search = "checklist=1"
    page()
    expect(screen.getByRole("button", { name: "Hide the setup steps" })).toHaveAttribute("aria-expanded", "true")
  })
})

const NO_PLAN = { subscribed: false, needs_plan: true, sandbox: false, plan: { id: "free", name: "Free", max_clients: 0 } }
const subs = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`loc${i}`, { connected: true, name: `Loc ${i}` }]))
// Basics, Meta, GoHighLevel and calling done; no plan yet.
const TOOLS_IN = (extra = {}) => ({
  onboarding: ob({}, { sales_tool: "ghl" }),
  status: { ...both, gohighlevel: { agency: { connected: true }, subaccounts: subs(23) } },
  hp: { connected: false }, slack: null, clients: [], billing: NO_PLAN, ...extra,
})

describe("SetupPage: the plan step", () => {
  it("asks for the plan in the chat once the tools are in", async () => {
    state.facts = TOOLS_IN()
    page()
    // The chat stays: the answers so far, then Agency Ops' line and the plans under it.
    const step = document.getElementById("step-plan")
    const chat = document.querySelector('[aria-live="polite"]')
    expect(chat.contains(step)).toBe(true)
    expect(screen.getByText("GoHighLevel calling")).toBeInTheDocument()
    expect(within(step).getByText(/Your tools are connected\. I found 23 sub-accounts in GoHighLevel\. Pick a plan to carry on/)).toBeInTheDocument()
    expect(within(step).getByRole("radiogroup", { name: "Plans" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Pick your plan" })).not.toBeInTheDocument()
    // The composer stays, but can't skip the plan; nothing after the plan shows.
    expect(screen.getByPlaceholderText("Message Agency Ops")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add your first client" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Not now/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument()
    // The plan is the chat's newest message.
    expect(chat.firstElementChild.lastElementChild).toBe(step)
  })

  it("says to pick a plan when someone types instead", async () => {
    const { toast } = await import("sonner")
    state.facts = TOOLS_IN()
    page()
    await userEvent.type(screen.getByPlaceholderText("Message Agency Ops"), "skip this{Enter}")
    expect(toast).toHaveBeenCalledWith("Pick a plan in the chat to carry on")
    expect(screen.getByRole("radiogroup", { name: "Plans" })).toBeInTheDocument()
  })

  it("marks and picks the smallest plan that fits, and mounts its checkout", async () => {
    state.facts = TOOLS_IN()
    page()
    const scale = screen.getByRole("radio", { name: /Scale/ })
    expect(scale).toHaveAttribute("aria-checked", "true")
    expect(scale).toHaveTextContent("Fits 23 clients")
    expect((await screen.findByTestId("whop-checkout")).dataset.plan).toBe("plan_scale")
    await userEvent.click(screen.getByRole("radio", { name: /Growth/ }))
    await waitFor(() => expect(screen.getByTestId("whop-checkout").dataset.plan).toBe("plan_growth"))
    expect(whop.at(-1).returnUrl).toMatch(/\/welcome\?checkout=plan$/)
    expect(screen.getByText(/Growth · \$297 a month/)).toBeInTheDocument()
  })

  it("invents nothing when the number of clients is unknown", async () => {
    state.facts = TOOLS_IN({ status: both })
    page()
    expect(screen.queryByText(/Fits/)).not.toBeInTheDocument()
    expect(screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true)
    expect(screen.getByText("Pick a plan to see the checkout.")).toBeInTheDocument()
    expect(screen.queryByTestId("whop-checkout")).not.toBeInTheDocument()
  })

  it("says so when even Scale is too small", async () => {
    state.facts = TOOLS_IN({ status: { ...both, gohighlevel: { agency: { connected: true }, subaccounts: subs(30) } } })
    page()
    expect(screen.getByText(/more than any plan holds/)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Scale/ })).toHaveAttribute("aria-checked", "true")
  })

  it("waits for the payment to show up, then carries on", async () => {
    state.facts = TOOLS_IN()
    replies["GET /api/billing/status"] = [200, { ...PAID }]
    page()
    await screen.findByTestId("whop-checkout")
    await act(async () => { whop.at(-1).onComplete() })
    expect(screen.getByText("Waiting for the payment to show up")).toBeInTheDocument()
    await waitFor(() => expect(refresh).toHaveBeenCalledWith("billing"), { timeout: 4000 })
    expect(refresh).toHaveBeenCalledWith("onboarding")
  })

  it("carries on at once when Whop sends the browser back with the plan already on", async () => {
    state.facts = TOOLS_IN()
    route.search = "checkout=plan"
    replies["GET /api/billing/status"] = [200, { ...PAID }]
    page()
    await waitFor(() => expect(refresh).toHaveBeenCalledWith("billing"))
  })

  it("starts a sandbox account's plan without a checkout", async () => {
    state.facts = TOOLS_IN({ billing: { ...NO_PLAN, sandbox: true } })
    replies["POST /api/billing/sandbox-plan"] = [200, { ...PAID, sandbox: true }]
    page()
    expect(within(document.getElementById("step-plan")).getByText(/nothing is charged/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Start Scale" }))
    expect(sent("POST", "/api/billing/sandbox-plan")[0].body).toEqual({ plan_id: "scale" })
    await waitFor(() => expect(refresh).toHaveBeenCalledWith("billing"))
    expect(screen.queryByTestId("whop-checkout")).not.toBeInTheDocument()
    expect(whop).toHaveLength(0)
  })

  it("says plainly when the server won't start a sandbox plan", async () => {
    state.facts = TOOLS_IN({ billing: { ...NO_PLAN, sandbox: true } })
    replies["POST /api/billing/sandbox-plan"] = [403, { detail: { code: "not_sandbox" } }]
    page()
    await userEvent.click(screen.getByRole("button", { name: "Start Scale" }))
    expect(await screen.findByText(/isn’t a sandbox account/)).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalledWith("billing")
  })

  it("answers with the plan picked once it's active, and carries on at the first client", async () => {
    state.facts = TOOLS_IN({ billing: PAID })
    page()
    expect(screen.queryByRole("radiogroup", { name: "Plans" })).not.toBeInTheDocument()
    expect(screen.getByText("Growth · $297/mo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add your first client" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Message Agency Ops")).toBeInTheDocument()
  })

  it("swaps the picker for the reply in place when the plan turns on, without leaving the chat", async () => {
    state.facts = TOOLS_IN({ billing: { ...NO_PLAN, sandbox: true } })
    const view = page()
    const greeting = document.getElementById("step-basics")
    state.facts = TOOLS_IN({ billing: { ...PAID, sandbox: true, plan: { id: "scale", name: "Scale" } } })
    view.rerender(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
    expect(document.getElementById("step-basics")).toBe(greeting)
    expect(screen.getByText("Scale · $497/mo")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add your first client" })).toBeInTheDocument()
  })

  it("holds a finished account without a plan on /welcome, then lets it into the app", async () => {
    const finished = { ...OPS_DONE, onboarding: ob({ completed: true, needs_plan: true }, { sales_tool: "ghl" }), billing: { ...NO_PLAN, sandbox: true } }
    state.facts = finished
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    replies["POST /api/billing/sandbox-plan"] = [200, { ...PAID, sandbox: true }]
    route.search = "s=buyer"
    const view = page()
    // Whatever section was asked for, the plan is the step to do, in the chat; the rest shows done.
    expect(within(document.getElementById("step-plan")).getByText(/Every account now needs a plan/)).toBeInTheDocument()
    const list = screen.getByRole("complementary", { name: "Set up Birdy" })
    expect(within(list).getByText("Connect Meta").closest("li")).toHaveTextContent("Done")
    expect(within(list).getByText("Pick your plan").closest("li")).toHaveTextContent("Now")
    expect(localStorage.getItem("onboarding_incomplete")).toBe("1")

    // Its three clients fit Starter.
    expect(screen.getByText(/You have 3 clients in Birdy/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Start Starter" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()

    // Once the facts say the plan is on, the flag stays down.
    state.facts = { ...finished, onboarding: ob({ completed: true, needs_plan: false }, { sales_tool: "ghl" }), billing: PAID }
    view.rerender(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
  })

  it("no longer offers a plan when bringing in the rest of the clients", async () => {
    state.facts = { ...OPS_DONE, clients: OPS_DONE.clients.slice(0, 1) }
    page()
    await userEvent.click(screen.getByRole("button", { name: /Yes, show me my sub-accounts/ }))
    expect(openImport).toHaveBeenCalled()
    expect(sent("GET", "/api/billing/status")).toHaveLength(0)
    expect(screen.queryByText(/first client is free/i)).not.toBeInTheDocument()
    // Slack's report question has its own "Not now"; nothing from the import step on does.
    const importStep = document.getElementById("step-import")
    const after = screen.queryAllByRole("button", { name: "Not now" }).filter((b) => importStep.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after).toHaveLength(0)
    expect(screen.queryByRole("radiogroup", { name: "Plans" })).not.toBeInTheDocument()
  })
})

describe("SetupPage: answering keeps the chat in place", () => {
  // jsdom lays nothing out: the chat sits at the top of the window and its newest message 1200px down it.
  let rect
  beforeEach(() => {
    rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
      const top = this.getAttribute("aria-live") === "polite" ? 0 : 1200
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON() {} }
    })
    return () => rect.mockRestore()
  })
  const rerenderPage = (view) => view.rerender(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)

  it("keeps the chat mounted when a step saves, and scrolls only down to the next message", async () => {
    state.facts = { onboarding: ob(), status: both, hp: { connected: false }, slack: null, clients: [], billing: PAID }
    const view = page()
    const chat = document.querySelector('[aria-live="polite"]')
    const greeting = document.getElementById("step-basics")
    // A chat taller than its window, scrolled part way down.
    Object.defineProperty(chat, "scrollHeight", { configurable: true, value: 2000 })
    Object.defineProperty(chat, "clientHeight", { configurable: true, value: 600 })
    chat.scrollTop = 300
    const scrolls = []
    chat.scrollTo = (opts) => scrolls.push(opts)

    await userEvent.click(screen.getByRole("button", { name: "GoHighLevel calling" }))
    expect(sent("PUT", "/api/onboarding/state")[0].body).toEqual({ data: { sales_tool: "ghl" } })
    // The save lands: the account now says GoHighLevel calling.
    state.facts = { ...state.facts, onboarding: ob({}, { sales_tool: "ghl" }) }
    rerenderPage(view)
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })

    expect(document.querySelector('[aria-live="polite"]')).toBe(chat)
    expect(document.getElementById("step-basics")).toBe(greeting)
    expect(screen.queryByLabelText("Loading your setup")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add your first client" })).toBeInTheDocument()
    // Down to the new message, gently; never back to the top.
    expect(scrolls.length).toBeGreaterThan(0)
    expect(scrolls.every((s) => s.top > 300)).toBe(true)
    expect(scrolls.at(-1).behavior).toBe("smooth")
  })

  it("lands at the step being done when arriving, say back from Meta's login", async () => {
    state.facts = { onboarding: ob(), status: { facebook: { connected: true } }, hp: null, slack: null, clients: [], billing: NO_PLAN }
    const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight")
    const scrolls = []
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return this.getAttribute?.("aria-live") === "polite" ? 1500 : 0 } })
    const scrollTo = vi.fn((opts) => scrolls.push(opts))
    Element.prototype.scrollTo = scrollTo
    try {
      page()
      await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
      expect(scrolls).toHaveLength(1)
      expect(scrolls[0].behavior).toBe("auto")
      expect(scrolls[0].top).toBeGreaterThan(0)
      expect(scrollTo.mock.contexts[0]).toBe(document.querySelector('[aria-live="polite"]'))
    } finally {
      if (proto) Object.defineProperty(HTMLElement.prototype, "scrollHeight", proto)
      else delete HTMLElement.prototype.scrollHeight
      delete Element.prototype.scrollTo
    }
  })
})

describe("SetupPage: connect cards", () => {
  it("shows each tool's own logo, not a letter", () => {
    state.facts = { onboarding: ob({}, { sales_tool: "hp" }), status: both, hp: { connected: false }, slack: null, clients: [], billing: PAID }
    page()
    const card = (name) => screen.getByText(name, { selector: "b" }).closest(".rounded-by-lg")
    expect(card("Meta").querySelector('[data-logo="meta"]')).toBeInTheDocument()
    expect(card("GoHighLevel").querySelector('[data-logo="ghl"]')).toBeInTheDocument()
    expect(card("Hot Prospector").querySelector('[data-logo="hp"]')).toBeInTheDocument()
  })

  it("draws Slack's mark on its card", () => {
    state.facts = { ...OPS_DONE, slack: { installed: false }, clients: [C("a", { targets: { cpa: 40 } })] }
    page()
    const card = screen.getByText("Slack", { selector: "b" }).closest(".rounded-by-lg")
    expect(card.querySelector('svg[data-logo="slack"]')).toBeInTheDocument()
    expect(card.querySelector('svg[data-logo="slack"]').parentElement).toHaveTextContent("")
  })
})

describe("SetupPage: the celebration", () => {
  const rerenderPage = (view) => view.rerender(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
  const LAST_STEP = { ...OPS_DONE, clients: OPS_DONE.clients.slice(0, 1) }
  const user = () => localStorage.setItem("user", JSON.stringify({ email: "sam@northside.test", role: "user" }))

  it("opens the moment the last step is done, with what's now in place", async () => {
    user()
    replies["GET /api/team/setup"] = [200, FRESH_TEAM]
    state.facts = LAST_STEP
    const view = page()
    await screen.findByRole("navigation", { name: "Your team" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    state.facts = OPS_DONE
    rerenderPage(view)
    const dialog = await screen.findByRole("dialog", { name: "Agency Ops is set up" })
    expect(dialog).toHaveTextContent("3 clients in Birdy")
    expect(dialog).toHaveTextContent("Meta and GoHighLevel connected")
    expect(dialog).toHaveTextContent("Alerts and reports go to #alerts")
    expect(within(dialog).getByRole("button", { name: "Open Agency Ops" })).toBeInTheDocument()
    expect(localStorage.getItem("birdy_ops_celebrated:sam@northside.test")).toBe("1")

    await userEvent.click(within(dialog).getByRole("button", { name: /Set up Media Buyer/ }))
    expect(sent("POST", "/api/onboarding/complete")).toHaveLength(1)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome?s=buyer"))
  })

  it("closes back to the chat, with its own buttons still there", async () => {
    user()
    state.facts = LAST_STEP
    const view = page()
    state.facts = OPS_DONE
    rerenderPage(view)
    const dialog = await screen.findByRole("dialog", { name: "Agency Ops is set up" })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Open Agency Ops" })).toBeInTheDocument()
  })

  it("doesn't open on a visit to a setup that's already done", async () => {
    user()
    state.facts = OPS_DONE
    page()
    expect(await screen.findByRole("button", { name: "Open Agency Ops" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("shows once per account, even if the last step is done again", async () => {
    user()
    localStorage.setItem("birdy_ops_celebrated:sam@northside.test", "1")
    state.facts = LAST_STEP
    const view = page()
    state.facts = OPS_DONE
    rerenderPage(view)
    await screen.findByRole("button", { name: "Open Agency Ops" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

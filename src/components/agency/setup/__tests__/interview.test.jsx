import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"
import "@/components/by/__tests__/jsdom"
import { deriveSteps } from "@/lib/setup-steps"
import { SetupPage } from "../setup-page"

const push = vi.fn()
const route = { search: "" }
const calls = []
const replies = {}
// The setup chat, as useAgentChat hands it to the page. Sending is recorded in `calls` so its order against the PUT shows.
const chat = { messages: [], loading: false }
const send = vi.fn(async (text) => { calls.push({ url: "chat", method: "SEND", body: text }); return true })

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(route.search) }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const C = (id) => ({ id, name: `Client ${id}`, client_status: "Active", call_log_provider: "ghl", targets: { cpa: 40 } })
const FACTS = {
  onboarding: { completed: true, name: "Sam", agency_name: "Northside", default_currency: "GBP", data: { sales_tool: "ghl" } },
  status: { facebook: { connected: true }, gohighlevel: { agency: { connected: true } } },
  hp: { connected: false },
  slack: { installed: true, notify_channel_id: "C1" },
  clients: [C("a"), C("b")],
}
vi.mock("@/lib/use-setup", () => ({
  useSetup: () => ({ facts: FACTS, steps: deriveSteps(FACTS), ready: true, failed: false, completed: true, refresh: vi.fn() }),
}))
vi.mock("@/lib/oauth-handoff", () => ({ setOAuthHandoff: vi.fn(), takeOAuthHandoff: () => null }))
vi.mock("@/components/shell/client-actions", () => ({ useClientActions: () => ({ openAddClient: vi.fn(), openImport: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [], loading: false, error: null, invalidate: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/components/agency/chat/use-agent-chat", () => ({
  useAgentChat: () => ({ ...chat, send, submitUI: vi.fn(), submittedUIs: [], updateProposal: vi.fn(), configured: true, outOfCredits: false, locked: null, route: null }),
}))
vi.mock("@/lib/api", () => ({
  apiRequest: async (url, opts = {}) => {
    const method = opts.method || "GET"
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined })
    const [status, body] = replies[`${method} ${url}`] ?? [200, { ok: true }]
    return { ok: status < 400, status, json: async () => body }
  },
}))

const MB_ORDER = ["clients", "cpl", "playbook", "permissions", "schedule", "slack", "practice"]
const known = (over = {}) => [
  { step: "clients", label: "Clients", value: "All active clients" },
  { step: "cpl", label: "CPL limits", value: "£6 for every client" },
  { step: "playbook", label: "Playbook", value: "Your rules, reviewed" },
  { step: "permissions", label: "Permissions", value: "Asks before pausing" },
  { step: "schedule", label: "Schedule", value: over.schedule ?? null },
  { step: "slack", label: "Slack", value: null },
  { step: "practice", label: "Practice run", value: null },
]
const team = ({ mb = {}, sc = {}, subs = {} } = {}) => ({
  order: ["birdy", "media_buyer", "sales_coach", "sub_agents"],
  agents: {
    birdy: { status: "done" },
    media_buyer: {
      status: "open", waits_on: null, order: MB_ORDER,
      steps: { clients: true, cpl: true, playbook: true, permissions: true }, current: "schedule",
      known: known(), values: { clients: { client_group_ids: "all" }, cpl: { default: 6, clients: {} } }, completed_at: null, ...mb,
    },
    sales_coach: { status: "locked", waits_on: "media_buyer", order: ["clients", "outcomes", "speed", "schedule", "slack"], steps: {}, current: null, known: [], values: {}, completed_at: null, ...sc },
    sub_agents: { status: "locked", waits_on: "sales_coach", skipped: false, completed_at: null, ...subs },
  },
})
const page = () => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><SetupPage /></SWRConfig>)
const ask = (type, content = "When should I check the accounts?") => [
  { role: "user", content: "Hi, let’s get you set up." },
  { role: "assistant", content, agent_changes: [{ ui_block: { type } }] },
]

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  for (const k of Object.keys(replies)) delete replies[k]
  Object.assign(chat, { messages: [], loading: false })
  route.search = "s=buyer"
  localStorage.clear()
})

describe("The agent interview", () => {
  it("starts with what the agent is and how far it got, and asks to carry on", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    page()
    expect(await screen.findByRole("heading", { name: "Media Buyer", level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/We’ve done 4 of 7 questions/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Carry on/ }))
    expect(send).toHaveBeenCalledWith("Let’s carry on.")
    expect(within(screen.getByRole("navigation", { name: "Your team" })).getByRole("button", { name: /Sales Coach/ })).toBeDisabled()
  })

  it("draws the form a reply asks for, then saves it before telling the agent", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    replies["PUT /api/team/setup/media_buyer/schedule"] = [200, team({ mb: { known: known({ schedule: "Every day at 07:00" }), steps: { clients: true, cpl: true, playbook: true, permissions: true, schedule: true }, current: "slack" } })]
    chat.messages = ask("schedule")
    page()
    const form = await screen.findByRole("form", { name: "Schedule" })
    await userEvent.click(within(form).getByRole("button", { name: "Weekdays only" }))
    await userEvent.click(within(form).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(send).toHaveBeenCalledWith("Schedule: Every day at 07:00"))
    const put = calls.findIndex((c) => c.method === "PUT")
    expect(calls[put].url).toBe("/api/team/setup/media_buyer/schedule")
    expect(calls[put].body).toMatchObject({ time: "07:00", days: "weekdays" })
    expect(calls.findIndex((c) => c.method === "SEND")).toBeGreaterThan(put)
    // Answered: the form goes, and what the agent knows says so.
    await waitFor(() => expect(screen.queryByRole("form", { name: "Schedule" })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Change Schedule: Every day at 07:00" })).toBeInTheDocument()
  })

  it("says what the server refused and keeps the form", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    replies["PUT /api/team/setup/media_buyer/schedule"] = [409, { detail: "Answer Permissions first" }]
    chat.messages = ask("schedule")
    page()
    const form = await screen.findByRole("form", { name: "Schedule" })
    await userEvent.click(within(form).getByRole("button", { name: "Save" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent("Answer Permissions first")
    expect(send).not.toHaveBeenCalled()
  })

  it("shows no form for a reply that asks for nothing", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    chat.messages = [{ role: "user", content: "what does it do?" }, { role: "assistant", content: "It checks your ads." }]
    page()
    expect(await screen.findByText("It checks your ads.")).toBeInTheDocument()
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
  })

  it("lists the playbook the reply carries", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { steps: { clients: true, cpl: true }, current: "playbook" } })]
    chat.messages = [{ role: "assistant", content: "Here are your rules.", agent_changes: [{ ui_block: "playbook", playbook: [{ kind: "flag_no_spend", params: { hours: 24 } }] }] }]
    page()
    const form = await screen.findByRole("form", { name: "Playbook" })
    expect(within(form).getByText("Flag no spend: Live ad set with no spend for 24 hrs.")).toBeInTheDocument()
    await userEvent.click(within(form).getByRole("button", { name: "Change something" }))
    expect(send).toHaveBeenCalledWith("I want to change a rule")
  })

  it("changes an answer from what the agent knows, filled in with the saved one", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    replies["PUT /api/team/setup/media_buyer/cpl"] = [200, team()]
    page()
    await userEvent.click(await screen.findByRole("button", { name: "Change CPL limits: £6 for every client" }))
    const dialog = await screen.findByRole("dialog", { name: "Change CPL limits" })
    const field = within(dialog).getByLabelText("Cost per lead limit")
    expect(field).toHaveValue("6")
    await userEvent.clear(field)
    await userEvent.type(field, "8")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(calls.find((c) => c.method === "PUT")).toEqual({ url: "/api/team/setup/media_buyer/cpl", method: "PUT", body: { default: 8, clients: {} } })
    // An edit isn't an answer to the current question: the agent isn't told.
    expect(send).not.toHaveBeenCalled()
  })

  it("opens Sales Coach once Media Buyer is done", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { status: "done", current: null }, sc: { status: "open", waits_on: null } })]
    page()
    expect(await screen.findByText(/Media Buyer is ready/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Set up Sales Coach/ }))
    expect(push).toHaveBeenCalledWith("/welcome?s=coach")
  })
})

describe("The sub-agents step", () => {
  const ALL_DONE = () => team({ mb: { status: "done" }, sc: { status: "done", waits_on: null }, subs: { status: "open", waits_on: null } })
  const proposed = { id: "s1", parent: "media_buyer", name: "Lead watcher", purpose: "Checks new leads every hour", status: "proposed", tools: [{ name: "get_leads", label: "Read leads" }], clients: "all", schedule: null }

  it("shows each agent's proposals with their card, and finishes the step", async () => {
    route.search = "s=subs"
    replies["GET /api/team/setup"] = [200, ALL_DONE()]
    replies["GET /api/agents/sub?parent=media_buyer"] = [200, [proposed]]
    replies["GET /api/agents/sub?parent=sales_coach"] = [200, []]
    replies["POST /api/team/setup/sub_agents/finish"] = [200, team({ mb: { status: "done" }, sc: { status: "done" }, subs: { status: "done" } })]
    page()
    expect(await screen.findByRole("group", { name: "Setting up a sub-agent: Lead watcher" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Waiting for you · 1/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Finish/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(calls.find((c) => c.url === "/api/team/setup/sub_agents/finish").body).toEqual({ skipped: false })
  })

  it("can be skipped for now", async () => {
    route.search = "s=subs"
    replies["GET /api/team/setup"] = [200, ALL_DONE()]
    replies["POST /api/team/setup/sub_agents/finish"] = [200, ALL_DONE()]
    page()
    await userEvent.click(await screen.findByRole("button", { name: "Skip for now" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(calls.find((c) => c.url === "/api/team/setup/sub_agents/finish").body).toEqual({ skipped: true })
  })

  it("asks the chosen agent for ideas", async () => {
    route.search = "s=subs"
    replies["GET /api/team/setup"] = [200, ALL_DONE()]
    page()
    await userEvent.click(await screen.findByRole("button", { name: "Sales Coach" }))
    await userEvent.click(screen.getByRole("button", { name: "Ask Sales Coach for ideas" }))
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/Which sub-agents would help/))
  })
})

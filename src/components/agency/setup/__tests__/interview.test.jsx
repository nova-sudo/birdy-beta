import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
// A conversation of its own per session key, when a test gives one; the shared `chat` otherwise.
const sessions = {}
const updateProposal = vi.fn()
vi.mock("@/components/agency/chat/use-agent-chat", () => ({
  useAgentChat: ({ sessionKey }) => ({ ...(sessions[sessionKey] ?? chat), send, submitUI: vi.fn(), submittedUIs: [], updateProposal, configured: true, outOfCredits: false, locked: null, route: null }),
}))
vi.mock("@/lib/api", () => ({
  apiRequest: async (url, opts = {}) => {
    const method = opts.method || "GET"
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined })
    const [status, body] = replies[`${method} ${url}`] ?? [200, { ok: true }]
    return { ok: status < 400, status, json: async () => body }
  },
}))

const MB_ORDER = ["clients", "cpl", "playbook", "permissions", "schedule", "slack"]
const known = (over = {}) => [
  { step: "clients", label: "Clients", value: "All active clients" },
  { step: "cpl", label: "CPL limits", value: "£6 for every client" },
  { step: "playbook", label: "Playbook", value: "Your rules, reviewed" },
  { step: "permissions", label: "Permissions", value: "Asks before pausing" },
  { step: "schedule", label: "Schedule", value: over.schedule ?? null },
  { step: "slack", label: "Slack", value: null },
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
  for (const k of Object.keys(sessions)) delete sessions[k]
})

describe("The agent interview", () => {
  it("starts with what the agent is and how far it got, and asks to carry on", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    page()
    expect(await screen.findByRole("heading", { name: "Media Buyer", level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/We’ve done 4 of 6 questions/)).toBeInTheDocument()
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
    // No time is pre-set: a suggestion is only offered.
    expect(within(form).getByLabelText("Time")).toHaveValue("")
    fireEvent.change(within(form).getByLabelText("Time"), { target: { value: "07:00" } })
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
    fireEvent.change(within(form).getByLabelText("Time"), { target: { value: "07:00" } })
    await userEvent.click(within(form).getByRole("button", { name: "Save" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent("Answer Permissions first")
    expect(send).not.toHaveBeenCalled()
  })

  it("offers a suggestion without choosing it", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    chat.messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "When?", agent_changes: [{ ui_block: { type: "schedule", value: null, default: { time: "07:00", tz: "Europe/London", days: "daily" } } }] },
    ]
    page()
    const form = await screen.findByRole("form", { name: "Schedule" })
    expect(within(form).getByLabelText("Time")).toHaveValue("")
    expect(form).toHaveTextContent("Suggestion: 07:00, every day")
    await userEvent.click(within(form).getByRole("button", { name: "Use it" }))
    expect(within(form).getByLabelText("Time")).toHaveValue("07:00")
    expect(calls.some((c) => c.method === "PUT")).toBe(false)
  })

  it("shows the practice run only when the agent was asked for one, and says why it can't start", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    replies["GET /api/team/setup/media_buyer/practice"] = [200, { status: "none", summary: null }]
    replies["POST /api/team/setup/media_buyer/practice"] = [409, { detail: { code: "ad_history_loading", message: "Birdy is still loading the ad history for 1 client (Aura)." } }]
    chat.messages = ask("practice", "Here is a practice run.")
    page()
    const form = await screen.findByRole("form", { name: "Practice run" })
    await userEvent.click(await within(form).findByRole("button", { name: "Start the practice run" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent("still loading the ad history for 1 client (Aura)")
    expect(within(form).queryByRole("button", { name: "Looks right" })).not.toBeInTheDocument()
  })

  it("shows no form for a reply that asks for nothing", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    chat.messages = [{ role: "user", content: "what does it do?" }, { role: "assistant", content: "It checks your ads." }]
    page()
    expect(await screen.findByText("It checks your ads.")).toBeInTheDocument()
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
  })

  it("lists the playbook the reply carries, to confirm", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { steps: { clients: true, cpl: true }, current: "playbook" } })]
    replies["PUT /api/team/setup/media_buyer/playbook"] = [200, team()]
    chat.messages = [{ role: "assistant", content: "Here is how I’ll work.", agent_changes: [{ ui_block: { type: "playbook", agent: "media_buyer", value: null, modes: { remove: "ask", add: "flag", revive: "ask" }, scoring: { min_days: 7, lose_cpl_multiple: 1.3 } } }] }]
    page()
    const form = await screen.findByRole("form", { name: "Playbook" })
    expect(within(form).getByText("Pausing ads").nextSibling).toHaveTextContent("Asks you first")
    expect(within(form).getByText("Adding ads").nextSibling).toHaveTextContent("Only suggests")
    expect(within(form).getByText("Cost per lead over 1.3× the target")).toBeInTheDocument()
    await userEvent.click(within(form).getByRole("button", { name: "Yes, that’s it" }))
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")).toMatchObject({ url: "/api/team/setup/media_buyer/playbook", body: { confirmed: true } }))
  })

  it("uses the block's own data: the saved answer and the clients it lists", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { steps: { clients: true }, current: "cpl" } })]
    chat.messages = [{ role: "assistant", content: "What CPL limit?", agent_changes: [{ ui_block: { type: "cpl", agent: "media_buyer", value: { default: null, clients: { g9: 12 } }, currency: "USD", clients: [{ id: "g9", name: "Harbor Dental", currency: "USD", target: 10 }] } }] }]
    page()
    const form = await screen.findByRole("form", { name: "Cost per lead limits" })
    expect(within(form).getByLabelText("Harbor Dental’s cost per lead limit")).toHaveValue("12")
  })

  it("names the step to answer first when the server says they're out of order", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    replies["PUT /api/team/setup/media_buyer/schedule"] = [409, { detail: { code: "step_out_of_order", agent: "media_buyer", step: "schedule", expected: "permissions" } }]
    chat.messages = ask("schedule")
    page()
    const form = await screen.findByRole("form", { name: "Schedule" })
    fireEvent.change(within(form).getByLabelText("Time"), { target: { value: "07:00" } })
    await userEvent.click(within(form).getByRole("button", { name: "Save" }))
    expect(await within(form).findByRole("alert")).toHaveTextContent("Answer Permissions first")
  })

  it("reopens the interview's own conversation", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { chat_session_id: "sess-1" } })]
    replies["GET /api/chat/conversations/sess-1"] = [200, { messages: [{ role: "assistant", content: "Earlier question" }] }]
    page()
    await waitFor(() => expect(calls.some((c) => c.url === "/api/chat/conversations/sess-1")).toBe(true))
  })

  it("says what Media Buyer still misses before it can switch on", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { status: "done", current: null, activation: { status: "not_ready", missing: ["Connect a Meta ad account"] } }, sc: { status: "open", waits_on: null } })]
    page()
    expect(await screen.findByText("Connect a Meta ad account")).toBeInTheDocument()
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

describe("The interview chat", () => {
  const ROUTE = { status: "done", seconds: 9, credits: 3.9, steps: [
    { id: "a", agent: "media_buyer", name: "Media Buyer", kind: "main", status: "done", summary: "Looked at show setup step", tools: [{ name: "show_setup_step", label: "show setup step" }], credits: 3.9, seconds: 9 },
  ] }

  it("shows a reply as the agent's text and then its form, with no route card", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    chat.messages = [{ role: "user", content: "Hi" }, { role: "assistant", content: "When should I check the accounts?", route: ROUTE, agent_changes: [{ ui_block: { type: "schedule" } }] }]
    page()
    const form = await screen.findByRole("form", { name: "Schedule" })
    const question = screen.getByText("When should I check the accounts?")
    expect(question.className).toMatch(/font-medium/)
    expect(question.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole("group", { name: "Agents in this reply" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Looked at show setup step/)).not.toBeInTheDocument()
    expect(screen.queryByText(/credits/)).not.toBeInTheDocument()
  })

  it("shows one light thinking line while the agent works", async () => {
    replies["GET /api/team/setup"] = [200, team()]
    chat.messages = [{ role: "user", content: "Hi" }]
    chat.loading = true
    page()
    expect(await screen.findByRole("status", { name: "Media Buyer is replying" })).toBeInTheDocument()
    expect(screen.getByText("Thinking")).toBeInTheDocument()
  })

  it("puts the cursor in the message box to change the playbook, and sends nothing", async () => {
    replies["GET /api/team/setup"] = [200, team({ mb: { steps: { clients: true, cpl: true }, current: "playbook" } })]
    chat.messages = [{ role: "assistant", content: "Here is how I’ll work.", agent_changes: [{ ui_block: { type: "playbook", modes: { remove: "ask" }, scoring: { min_days: 7 } } }] }]
    page()
    const form = await screen.findByRole("form", { name: "Playbook" })
    expect(within(form).queryByRole("button", { name: "Ask about it" })).not.toBeInTheDocument()
    await userEvent.click(within(form).getByRole("button", { name: "Change something" }))
    expect(send).not.toHaveBeenCalled()
    const box = screen.getByRole("textbox", { name: /For example: judge ads after 10 days/ })
    expect(box).toHaveFocus()
    expect(form).toHaveTextContent("Type your change in the message box below, for example: judge ads after 10 days, keep 6 ads live, or pause losers on your own.")
    await userEvent.type(box, "judge ads after 10 days{Enter}")
    expect(send).toHaveBeenCalledWith("judge ads after 10 days")
    expect(screen.getByRole("textbox", { name: "Answer Media Buyer" })).toBeInTheDocument()
  })
})

describe("Finishing an agent", () => {
  const ALL_STEPS = { clients: true, cpl: true, playbook: true, permissions: true, schedule: true }
  const before = () => team({ mb: { steps: ALL_STEPS, current: "slack", known: known({ schedule: "Every day at 07:00" }) } })
  const after = () => team({
    mb: { status: "done", steps: { ...ALL_STEPS, slack: true }, current: null, known: [...known({ schedule: "Every day at 07:00" }).slice(0, 5), { step: "slack", label: "Slack", value: "#ads-team" }] },
    sc: { status: "open", waits_on: null },
  })
  const answerSlack = async () => {
    const form = await screen.findByRole("form", { name: "Slack" })
    await userEvent.click(within(form).getByRole("button", { name: "Not in Slack" }))
  }

  it("celebrates the moment Media Buyer's last answer is saved, with what it learned", async () => {
    replies["GET /api/team/setup"] = [200, before()]
    replies["GET /api/integrations/slack/channels"] = [200, { channels: [] }]
    replies["PUT /api/team/setup/media_buyer/slack"] = [200, after()]
    chat.messages = ask("slack", "Where should I post?")
    page()
    await answerSlack()
    const dialog = await screen.findByRole("dialog", { name: "Media Buyer is ready" })
    expect(dialog).toHaveTextContent("It now checks your clients’ ads")
    for (const line of ["Clients: All active clients", "CPL limits: £6 for every client", "Schedule: Every day at 07:00", "Slack: #ads-team"]) {
      expect(within(dialog).getByText(line)).toBeInTheDocument()
    }
    // Its own tile, not the mascot.
    expect(dialog.querySelector("svg.lucide-megaphone")).toBeTruthy()
    expect(within(dialog).getByRole("button", { name: "Open Media Buyer" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: /Set up Sales Coach/ }))
    expect(push).toHaveBeenCalledWith("/welcome?s=coach")
  })

  it("closing it leaves the end message and its buttons", async () => {
    replies["GET /api/team/setup"] = [200, before()]
    replies["GET /api/integrations/slack/channels"] = [200, { channels: [] }]
    replies["PUT /api/team/setup/media_buyer/slack"] = [200, after()]
    chat.messages = ask("slack", "Where should I post?")
    page()
    await answerSlack()
    await screen.findByRole("dialog", { name: "Media Buyer is ready" })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: /Set up Sales Coach/ })).toBeInTheDocument()
  })

  it("doesn't celebrate on a reload or a later visit", async () => {
    replies["GET /api/team/setup"] = [200, after()]
    page()
    expect(await screen.findByText(/Media Buyer is ready\./)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("celebrates once per account, even if it completes again", async () => {
    localStorage.setItem("user", JSON.stringify({ email: "sam@northside.test" }))
    localStorage.setItem("birdy_setup_celebrated:sam@northside.test:media_buyer", "1")
    replies["GET /api/team/setup"] = [200, before()]
    replies["GET /api/integrations/slack/channels"] = [200, { channels: [] }]
    replies["PUT /api/team/setup/media_buyer/slack"] = [200, after()]
    chat.messages = ask("slack", "Where should I post?")
    page()
    await answerSlack()
    expect(await screen.findByText(/Media Buyer is ready\./)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("The sub-agents step", () => {
  const ALL_DONE = () => team({ mb: { status: "done" }, sc: { status: "done", waits_on: null }, subs: { status: "open", waits_on: null } })
  const FINISHED = () => team({ mb: { status: "done" }, sc: { status: "done", waits_on: null }, subs: { status: "done", waits_on: null } })
  const idea = (over = {}) => ({
    id: "s1", parent: "media_buyer", name: "Ad Performance Monitor", purpose: "Checks every ad each morning and flags the ones over your cost per lead",
    status: "proposed", created_at: "2026-11-20T10:00:00Z",
    tools: [{ name: "get_ad_insights", label: "get_ad_insights" }, { name: "get_meta_insights_live", label: "get_meta_insights_live" }],
    clients: "all", schedule: { time: "14:10", timezone: "Europe/London", days: [] }, ...over,
  })
  const second = () => idea({ id: "s2", name: "Lead Watcher", purpose: "Checks new leads every hour", tools: [{ name: "get_facebook_leads" }], clients: [{ id: "a", name: "Aura" }], schedule: null, created_at: "2026-11-20T10:01:00Z" })
  const open = (mb = [], sc = []) => {
    route.search = "s=subs"
    replies["GET /api/team/setup"] = [200, ALL_DONE()]
    replies["GET /api/agents/sub?parent=media_buyer"] = [200, mb]
    replies["GET /api/agents/sub?parent=sales_coach"] = [200, sc]
    page()
  }

  it("opens with a short intro and two ways to start, not an empty list", async () => {
    open()
    const ask = await screen.findByRole("button", { name: "Ask Media Buyer for ideas" })
    expect(screen.getByRole("button", { name: "Ask Sales Coach for ideas" })).toBeInTheDocument()
    expect(screen.queryByText(/Nothing proposed yet/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Waiting for you/)).not.toBeInTheDocument()
    await userEvent.click(ask)
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/Which sub-agents would help/))
  })

  it("asks Sales Coach for ideas", async () => {
    open()
    await userEvent.click(await screen.findByRole("button", { name: "Ask Sales Coach for ideas" }))
    expect(send).toHaveBeenCalledWith(expect.stringMatching(/Which sub-agents would help/))
  })

  it("shows one idea at a time as a card in plain words, and says what the owner chose", async () => {
    replies["POST /api/agents/sub/s1/approve"] = [200, { ...idea(), status: "active" }]
    replies["POST /api/agents/sub/s2/reject"] = [200, { ok: true }]
    open([idea(), second()])
    const card = await screen.findByRole("group", { name: "Sub-agent idea: Ad Performance Monitor" })
    expect(within(card).getByText("1 of 2")).toBeInTheDocument()
    expect(within(card).getByText("Checks every ad each morning and flags the ones over your cost per lead")).toBeInTheDocument()
    expect(within(card).getByText("All your clients")).toBeInTheDocument()
    expect(within(card).getByText("Every day at 14:10")).toBeInTheDocument()
    expect(within(card).getByText("Ad results")).toBeInTheDocument()
    expect(within(card).getByText("Reports to").nextSibling).toHaveTextContent("Media Buyer")
    // Only one card, and no tool's raw name anywhere.
    expect(screen.queryByRole("group", { name: "Sub-agent idea: Lead Watcher" })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/get_ad_insights|get_meta_insights_live/)

    await userEvent.click(within(card).getByRole("button", { name: "Add it" }))
    expect(await screen.findByText("Added Ad Performance Monitor")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/agents/sub/s1/approve")).toBe(true)
    const next = await screen.findByRole("group", { name: "Sub-agent idea: Lead Watcher" })
    expect(within(next).getByText("2 of 2")).toBeInTheDocument()
    expect(within(next).getByText("Leads")).toBeInTheDocument()
    expect(within(next).getByText("When Media Buyer asks")).toBeInTheDocument()

    await userEvent.click(within(next).getByRole("button", { name: "Not now" }))
    expect(await screen.findByText("Not now: Lead Watcher")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/agents/sub/s2/reject")).toBe(true)
    expect(await screen.findByRole("button", { name: /Suggest another/ })).toBeInTheDocument()
  })

  it("changes an idea's details before adding it", async () => {
    replies["PATCH /api/agents/sub/s1"] = [200, { ...idea(), name: "Morning ad check" }]
    open([idea()])
    const card = await screen.findByRole("group", { name: "Sub-agent idea: Ad Performance Monitor" })
    await userEvent.click(within(card).getByRole("button", { name: /Change details/ }))
    const dialog = await screen.findByRole("dialog", { name: "Change Ad Performance Monitor" })
    const name = within(dialog).getByLabelText("Name")
    await userEvent.clear(name)
    await userEvent.type(name, "Morning ad check")
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(calls.find((c) => c.method === "PATCH")).toEqual({ url: "/api/agents/sub/s1", method: "PATCH", body: { name: "Morning ad check" } })
    // Saving details doesn't add it.
    expect(calls.some((c) => c.url.endsWith("/approve"))).toBe(false)
  })

  it("keeps a reply short when its ideas come as cards, without tool names", async () => {
    sessions.team_setup_subs_media_buyer = {
      messages: [
        { role: "user", content: "Which sub-agents would help my agency?" },
        {
          role: "assistant",
          content: "Here are two that would help. They watch the work you do by hand.\n\n- **Ad Performance Monitor**\n  - Purpose: flags ads\n  - Tools: `get_ad_insights`, `get_meta_insights_live`",
          proposals: [{ id: "p1", kind: "sub_agent", status: "pending", payload: { sub_agent: idea() } }],
        },
      ],
      loading: false,
    }
    open([idea()])
    expect(await screen.findByText("Here are two that would help. They watch the work you do by hand.")).toBeInTheDocument()
    expect(screen.queryByText(/Purpose/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/get_ad_insights|get_meta_insights_live/)
    // One card, drawn by the step: the reply's own wizard isn't shown.
    expect(await screen.findByRole("group", { name: "Sub-agent idea: Ad Performance Monitor" })).toBeInTheDocument()
    expect(screen.queryByText("What should it be called?")).not.toBeInTheDocument()
  })

  it("finishes the step with a celebration, once, then opens the app", async () => {
    replies["POST /api/team/setup/sub_agents/finish"] = [200, FINISHED()]
    sessions.team_setup_subs_media_buyer = { messages: [{ role: "user", content: "Ideas?" }, { role: "assistant", content: "I have nothing to add right now." }], loading: false }
    open([], [])
    await userEvent.click(await screen.findByRole("button", { name: /^Finish/ }))
    const dialog = await screen.findByRole("dialog", { name: "Your team is set up" })
    expect(calls.find((c) => c.url === "/api/team/setup/sub_agents/finish").body).toEqual({ skipped: false })
    expect(within(dialog).getByText("Media Buyer is set up")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: /Open Birdy/ }))
    expect(push).toHaveBeenCalledWith("/dashboard")
  })

  it("can be skipped for now, celebrating only the first time", async () => {
    replies["POST /api/team/setup/sub_agents/finish"] = [200, ALL_DONE()]
    open()
    await userEvent.click(await screen.findByRole("button", { name: "Skip for now" }))
    expect(await screen.findByRole("dialog", { name: "Your team is set up" })).toBeInTheDocument()
    expect(calls.find((c) => c.url === "/api/team/setup/sub_agents/finish").body).toEqual({ skipped: true })
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: (...a) => toastError(...a), success: vi.fn() }),
  Toaster: () => null,
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
vi.mock("@/lib/view-catalogues", () => ({ announceViewOps: vi.fn(), readViewCatalogues: () => [] }))

const log = []
const replace = vi.fn((path) => log.push(`replace ${path}`))
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, back: vi.fn() }) }))

const GROUPS = [
  { id: "g1", name: "Tylaesthetics", meta_ad_account_id: "act_1", ad_account_currency: "GBP", targets: { cpl: 20 } },
  { id: "g2", name: "No Meta Ltd", meta_ad_account_id: null },
]
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: GROUPS, loading: false }) }))

// The chat engine is tested on its own. This stand-in renders the store's transcript the way it
// does (Birdy's replies get renderAfterMessage) and exposes send through sendRef.
let lastProps
const sent = []
vi.mock("@/components/chat/ChatConversation", async () => {
  const { useChat } = await import("@/lib/chat-store")
  return {
    default: function ChatStandIn(props) {
      lastProps = props
      const { messages } = useChat(props.sessionKey)
      if (props.sendRef) {
        props.sendRef.current = async (text) => (props.interceptSend ? props.interceptSend(text) : (sent.push(text), true))
      }
      return (
        <div data-testid="chat" data-placeholder={props.composerPlaceholder}>
          {props.introMessage && <p>{props.introMessage}</p>}
          {messages.map((m, i) => (
            <div key={i}>
              <p>{m.content}</p>
              {m.role !== "user" && props.renderAfterMessage?.(m, i)}
            </div>
          ))}
          {props.aboveComposer}
        </div>
      )
    },
  }
})

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { hydrateChat, resetChat } from "@/lib/chat-store"
import { AgentSetupChat } from "../AgentSetupChat"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const NO_STEPS = { purpose: false, playbook: false, clients: false, permissions: false, schedule: false, slack: false }
const agentWith = (steps = {}, extra = {}) => ({
  id: "ag1",
  type: "custom",
  name: "New agent",
  status: "draft",
  description: "",
  scope: { client_group_ids: [], slack_channel_id: null },
  permissions: {},
  guardrails: {},
  client_caps: {},
  training: { steps: { ...NO_STEPS, ...steps } },
  ...extra,
})

let agent
let patchReply
const calls = (method, path) =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => (init?.method ?? "GET") === method && (!path || p === path))

beforeEach(() => {
  log.length = 0
  sent.length = 0
  replace.mockClear()
  push.mockClear()
  toastError.mockClear()
  sessionStorage.clear()
  for (const k of ["agent_setup:new", "agent_setup:ag1", "agent_setup:ag9"]) resetChat(k)
  agent = agentWith()
  patchReply = () => res({ ...agent, scope: { ...agent.scope, client_group_ids: ["g1"] } })
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
    const method = init.method ?? "GET"
    log.push(`${method} ${path}`)
    if (path === "/api/agents" && method === "POST") return Promise.resolve(res({ id: "ag9", type: "custom", name: "New agent" }))
    if (path === "/api/chat" && method === "POST") return Promise.resolve(res({ reply: "Got it.", tools_used: [], session_id: "s9" }))
    if (path === "/api/agents/ag1" && method === "PATCH") return Promise.resolve(patchReply(JSON.parse(init.body)))
    if (path === "/api/agents/ag1") return Promise.resolve(res(agent))
    if (path === "/api/agents/ag1/confidence") return Promise.resolve(res({ score: 0, ready: false, parts: {}, missing: [] }))
    if (path.startsWith("/api/chat/conversations/"))
      return Promise.resolve(
        res({
          session_id: "s1",
          messages: [
            { role: "user", content: "Pause ads that cost too much", tools_used: [] },
            { role: "assistant", content: "Here's the playbook I'd start it on.", tools_used: ["draft_playbook"] },
          ],
        })
      )
    return Promise.resolve(res([]))
  })
})

const renderChat = (props = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <AgentSetupChat {...props} />
    </SWRConfig>
  )

const birdySays = (agentChanges, content = "Here you go.") =>
  act(() =>
    hydrateChat("agent_setup:ag1", {
      sessionId: "s1",
      messages: [
        { role: "user", content: "Pause ads that cost too much" },
        { role: "assistant", content, tools_used: [], agent_changes: agentChanges },
      ],
    })
  )

describe("AgentSetupChat", () => {
  it("first message creates agent then routes and sends", async () => {
    renderChat()
    expect(screen.getByText(/What should the agent do\?/)).toBeInTheDocument()
    expect(lastProps.sessionKey).toBe("agent_setup:new")
    expect(lastProps.page).toBe("agent_setup")

    await userEvent.click(screen.getByRole("button", { name: "Pause ads that cost too much" }))

    await waitFor(() => expect(calls("POST", "/api/chat")).toHaveLength(1))
    expect(JSON.parse(calls("POST", "/api/agents")[0][1].body)).toEqual({ type: "custom", name: "New agent" })
    const body = JSON.parse(calls("POST", "/api/chat")[0][1].body)
    expect(body).toMatchObject({ message: "Pause ads that cost too much", page: "agent_setup", agent_id: "ag9" })
    expect(replace).toHaveBeenCalledWith("/hub/agents/custom/ag9/setup")
    const order = log.filter((l) => l === "POST /api/agents" || l.startsWith("replace") || l === "POST /api/chat")
    expect(order).toEqual(["POST /api/agents", "replace /hub/agents/custom/ag9/setup", "POST /api/chat"])
  })

  it("create failure keeps text", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init = {}) =>
      Promise.resolve(path === "/api/agents" && init.method === "POST" ? res({ detail: "Server down" }, 500) : res([]))
    )
    renderChat()
    let taken
    await act(async () => {
      taken = await lastProps.interceptSend("Pause expensive ads")
    })
    // false tells the composer to keep the text.
    expect(taken).toBe(false)
    expect(toastError).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(calls("POST", "/api/chat")).toHaveLength(0)
  })

  it("resumes existing draft without creating", async () => {
    agent = agentWith({ purpose: true }, { description: "Pause ads that cost too much" })
    sessionStorage.setItem("agent_setup:ag1", "s1")
    renderChat({ agentId: "ag1" })

    expect(await screen.findByText("Here's the playbook I'd start it on.")).toBeInTheDocument()
    expect(lastProps.sessionKey).toBe("agent_setup:ag1")
    expect(lastProps.agentId).toBe("ag1")
    expect(lastProps.interceptSend).toBeFalsy()
    expect(await screen.findByText("1 of 6")).toBeInTheDocument()
    expect(calls("POST", "/api/agents")).toHaveLength(0)
    expect(calls("GET", "/api/chat/conversations/s1")).toHaveLength(1)
  })

  it("example jobs hide after first answer", async () => {
    renderChat({ agentId: "ag1" })
    expect(screen.getByRole("button", { name: "Turn old winners back on" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Flag ad sets with no spend" })).toBeInTheDocument()
    expect(screen.getByTestId("chat")).toHaveAttribute("data-placeholder", "Tell Birdy what the agent should do…")

    await birdySays([])
    expect(screen.queryByRole("button", { name: "Turn old winners back on" })).not.toBeInTheDocument()
    expect(screen.getByTestId("chat")).toHaveAttribute("data-placeholder", "Type your answer…")
  })

  it("playbook ui_block renders PlaybookBlock with confirm buttons", async () => {
    renderChat({ agentId: "ag1" })
    await birdySays([
      {
        tool: "draft_playbook",
        changed: "playbook",
        ui_block: "playbook",
        playbook: [
          { kind: "pause_over_target", enabled: true, params: { patience_spend: 60, patience_days: 3, cpl_multiple: 1.5, zero_lead_spend: 80 } },
          { kind: "revive_winner", enabled: false, params: {} },
          { kind: "flag_no_spend", enabled: true, params: { hours: 24 } },
        ],
      },
    ])
    expect(screen.getByText("Its playbook · 2 rules")).toBeInTheDocument()
    expect(screen.getByText(/Pause ads over target: After £60 or 3 days, CPL over 1.5× target/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Change something" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Yes, that's it" }))
    expect(sent).toEqual(["Yes, that's it"])
    expect(screen.queryByRole("button", { name: "Yes, that's it" })).not.toBeInTheDocument()
  })

  it("clients block save patches agent and sends confirmation", async () => {
    renderChat({ agentId: "ag1" })
    await birdySays([{ tool: "show_block", ui_block: "clients" }])
    await userEvent.click(await screen.findByRole("button", { name: "Watch 1 client" }))

    await waitFor(() => expect(calls("PATCH", "/api/agents/ag1")).toHaveLength(1))
    expect(JSON.parse(calls("PATCH", "/api/agents/ag1")[0][1].body)).toEqual({ scope: { client_group_ids: ["g1"] } })
    await waitFor(() => expect(sent).toEqual(["Picked 1 client"]))
    expect(screen.getByText("Picked 1 client", { selector: "p" })).toBeInTheDocument()
  })

  it("claim conflict shows ClaimConflicts in block", async () => {
    let n = 0
    patchReply = (body) =>
      ++n === 1
        ? res({ detail: "Held", conflicts: [{ client_group_id: "g1", holder_id: "ag2", holder_name: "Lead rules" }] }, 409)
        : res({ ...agent, scope: { client_group_ids: body.scope.client_group_ids } })
    renderChat({ agentId: "ag1" })
    await birdySays([{ tool: "show_block", ui_block: "clients" }])
    await userEvent.click(await screen.findByRole("button", { name: "Watch 1 client" }))

    expect(await screen.findByText("Another agent already watches some of these clients")).toBeInTheDocument()
    expect(sent).toEqual([])
    await userEvent.click(screen.getByRole("button", { name: "Move it here" }))
    await waitFor(() => expect(calls("PATCH", "/api/agents/ag1")).toHaveLength(2))
    expect(JSON.parse(calls("PATCH", "/api/agents/ag1")[1][1].body)).toEqual({
      scope: { client_group_ids: ["g1"] },
      move_claims: true,
    })
    await waitFor(() => expect(sent).toEqual(["Picked 1 client"]))
  })
})

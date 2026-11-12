import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
const push = vi.fn()
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, back: vi.fn() }) }))

// The chat engine is exercised on its own; here it only has to mount with the right props.
let chatProps
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    chatProps = props
    return <div data-testid="setup-chat" data-page={props.page} />
  },
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import SetupPage from "../page"

// Next hands the page a promise; one already marked fulfilled lets `use` read it without suspending.
const PARAMS = Object.assign(Promise.resolve({ id: "ag1" }), { status: "fulfilled", value: { id: "ag1" } })

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const ALL_DONE = { purpose: true, playbook: true, clients: true, permissions: true, schedule: true, slack: true }
const AGENT = {
  id: "ag1",
  type: "custom",
  name: "Lead rules",
  status: "draft",
  description: "Pause ads that cost too much",
  scope: { client_group_ids: ["g1"], schedule: { time: "07:00", tz: "Europe/London" }, slack_channel_id: null },
  permissions: { ads: true },
  guardrails: {},
  client_caps: {},
  training: { steps: ALL_DONE },
}

let confidence
let activate
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/agents/ag1" && method === "GET") return Promise.resolve(res(AGENT))
  if (path === "/api/agents/ag1/rules") return Promise.resolve(res([{ kind: "pause_over_target", enabled: true }]))
  if (path === "/api/agents/ag1/confidence") return Promise.resolve(res(confidence))
  if (path === "/api/agents/ag1/activate") return Promise.resolve(activate())
  if (path === "/api/agents") return Promise.resolve(res([AGENT]))
  if (path.startsWith("/api/client-groups"))
    return Promise.resolve(res({ client_groups: [{ id: "g1", name: "Tylaesthetics", meta_ad_account_id: "act_1" }] }))
  return Promise.resolve(res({}, 404))
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <SetupPage params={PARAMS} />
    </SWRConfig>
  )

beforeEach(() => {
  chatProps = null
  confidence = { score: 85, ready: true, parts: {}, missing: [] }
  activate = () => res({ ...AGENT, status: "active" })
  push.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

const posts = (path) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && init?.method === "POST").length

describe("Custom agent setup page", () => {
  it("renders the setup chat for this agent and never creates one", async () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Set up your new agent" })).toBeInTheDocument()
    expect(screen.getByTestId("setup-chat")).toHaveAttribute("data-page", "agent_setup")
    expect(chatProps.agentId).toBe("ag1")
    expect(chatProps.sessionKey).toBe("agent_setup:ag1")
    expect(chatProps.interceptSend).toBeFalsy()
    expect(await screen.findByText("6 of 6")).toBeInTheDocument()
    expect(posts("/api/agents")).toBe(0)
  })

  it("Turn on activates the agent and opens its page", async () => {
    renderPage()
    const on = await screen.findByRole("button", { name: "Turn on" })
    await waitFor(() => expect(on).toBeEnabled())
    await userEvent.click(on)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1"))
    expect(posts("/api/agents/ag1/activate")).toBe(1)
  })

  it("a claimed client at Turn on offers to move it", async () => {
    let n = 0
    activate = () =>
      ++n === 1
        ? res({ detail: "Held", conflicts: [{ client_group_id: "g1", holder_id: "ag2", holder_name: "Other agent" }] }, 409)
        : res({ ...AGENT, status: "active" })
    renderPage()
    const on = await screen.findByRole("button", { name: "Turn on" })
    await waitFor(() => expect(on).toBeEnabled())
    await userEvent.click(on)
    await userEvent.click(await screen.findByRole("button", { name: "Move it here" }))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hub/agents/custom/ag1"))
    const bodies = vi.mocked(apiRequest).mock.calls.filter(([p]) => p === "/api/agents/ag1/activate").map(([, i]) => i.body)
    expect(JSON.parse(bodies[1])).toEqual({ move_claims: true })
  })

  it("keeps Turn on locked while the score is below the bar", async () => {
    confidence = { score: 50, ready: false, parts: {}, missing: ["Get the score to 80"] }
    renderPage()
    expect(await screen.findByText("Unlocks once I've asked everything")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }))

let chatProps
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    chatProps = props
    return <div data-testid="setup-chat" data-page={props.page} />
  },
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import NewAgentPage from "../page"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const posts = (path) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && init?.method === "POST")

beforeEach(() => {
  replace.mockReset()
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
    if (path === "/api/agents" && init.method === "POST") return Promise.resolve(res({ id: "ag9", type: "custom", name: "New agent" }))
    if (path === "/api/chat") return Promise.resolve(res({ reply: "Got it.", tools_used: [], session_id: "s9" }))
    return Promise.resolve(res([]))
  })
})

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <NewAgentPage />
    </SWRConfig>
  )

describe("New custom agent page", () => {
  it("opens the setup chat and creates nothing until the first message", async () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Set up your new agent" })).toBeInTheDocument()
    expect(screen.getByTestId("setup-chat")).toHaveAttribute("data-page", "agent_setup")
    expect(chatProps.agentId).toBeNull()
    expect(chatProps.introMessage).toMatch(/What should the agent do\?/)
    expect(posts("/api/agents")).toHaveLength(0)
  })

  it("the first message creates a draft named New agent and opens its setup", async () => {
    renderPage()
    await act(async () => {
      await chatProps.interceptSend("Pause ads that cost too much")
    })
    expect(JSON.parse(posts("/api/agents")[0][1].body)).toEqual({ type: "custom", name: "New agent" })
    expect(replace).toHaveBeenCalledWith("/hub/agents/custom/ag9/setup")
    await waitFor(() => expect(posts("/api/chat")).toHaveLength(1))
  })
})

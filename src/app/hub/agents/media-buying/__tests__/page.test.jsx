import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
const replace = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock("@/components/chat/ChatConversation", () => ({
  default: () => <div data-testid="training-chat" />,
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import AgentPage from "../page"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

let agent
const WORK = {
  open: [
    {
      id: "s1",
      status: "open",
      agent_id: "ag1",
      rule_kind: "pause_over_target",
      rule_mode: "ask",
      has_action: true,
      client: "Tylaesthetics",
      title: "Pause “Summer BBL – Video 3”",
      stats: [],
      blocked_reason: null,
    },
  ],
  auto_applied: [],
}

beforeEach(() => {
  search = ""
  replace.mockReset()
  agent = {
    id: "ag1",
    type: "media_buying",
    status: "active",
    scope: { client_group_ids: ["g1", "g2"], schedule: { time: "07:00", tz: "Europe/London" } },
  }
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path) => {
    if (path === "/api/agents") return Promise.resolve(res([agent]))
    if (path === "/api/agents/ag1") return Promise.resolve(res(agent))
    if (path === "/api/agents/ag1/work") return Promise.resolve(res(WORK))
    if (path === "/api/agents/ag1/rules") return Promise.resolve(res([]))
    return Promise.resolve(res({}, 404))
  })
})

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <AgentPage />
    </SWRConfig>
  )

describe("Media Buying Agent page", () => {
  it("shows the work list by default and keeps the tab in ?tab=", async () => {
    renderPage()
    expect(await screen.findByText("Pause “Summer BBL – Video 3”")).toBeInTheDocument()
    expect(screen.getByText(/Watching 2 clients/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: /Playbook/ }))
    expect(replace).toHaveBeenCalledWith("/hub/agents/media-buying?tab=playbook", { scroll: false })
  })

  it("shows the activity placeholder on ?tab=activity", async () => {
    search = "tab=activity"
    renderPage()
    expect(await screen.findByText("Activity arrives soon")).toBeInTheDocument()
  })

  it("sends an agent that isn't on yet to setup", async () => {
    agent = { ...agent, status: "draft" }
    renderPage()
    const link = await screen.findByRole("link", { name: /Continue setup/ })
    expect(link).toHaveAttribute("href", "/hub/agents/media-buying/setup")
  })
})

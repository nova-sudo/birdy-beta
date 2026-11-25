import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import "@/components/by/__tests__/jsdom"
import { AgentGate } from "../agent-locked"
import { ChatThread } from "../chat/thread"

const replies = {}
vi.mock("@/lib/api", () => ({
  apiRequest: async (url, opts = {}) => {
    const [status, body] = replies[`${opts.method || "GET"} ${url}`] ?? [404, { detail: "Not Found" }]
    return { ok: status < 400, status, json: async () => body }
  },
}))

const agent = (status, extra = {}) => ({ status, waits_on: null, order: [], steps: {}, current: null, known: [], values: {}, completed_at: null, ...extra })
const TEAM = {
  agents: {
    birdy: { status: "done" },
    media_buyer: agent("open", {
      order: ["clients", "schedule", "slack"], steps: { clients: true },
      known: [{ step: "clients", label: "Clients", value: "All active clients" }, { step: "schedule", label: "Schedule", value: null }, { step: "slack", label: "Slack", value: null }],
    }),
    sales_coach: agent("locked", { waits_on: "media_buyer", order: ["clients"] }),
    sub_agents: { status: "locked", waits_on: "sales_coach" },
  },
}
const wrap = (ui) => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>)

beforeEach(() => {
  for (const k of Object.keys(replies)) delete replies[k]
})

describe("AgentGate", () => {
  it("shows the locked screen for every page of a locked agent: what it waits on and what is left", async () => {
    replies["GET /api/team/setup"] = [200, TEAM]
    wrap(<AgentGate agent="sales_coach"><p>Sales Coach page</p></AgentGate>)
    const card = await screen.findByRole("region", { name: "Sales Coach is locked" })
    expect(within(card).getByText(/It unlocks once Marketing Guru is set up/)).toBeInTheDocument()
    expect(within(card).getByText("Agency Ops is ready")).toBeInTheDocument()
    expect(within(card).getByText("Marketing Guru: 2 left (Schedule, Slack)")).toBeInTheDocument()
    expect(within(card).getByRole("link", { name: /Continue Marketing Guru setup/ })).toHaveAttribute("href", "/welcome?s=buyer")
    expect(screen.queryByText("Sales Coach page")).not.toBeInTheDocument()
  })

  it("shows the page of an agent that is open", async () => {
    replies["GET /api/team/setup"] = [200, TEAM]
    wrap(<AgentGate agent="media_buyer"><p>Marketing Guru page</p></AgentGate>)
    expect(await screen.findByText("Marketing Guru page")).toBeInTheDocument()
  })

  it("shows the page when the team state can't be read", async () => {
    wrap(<AgentGate agent="sales_coach"><p>Sales Coach page</p></AgentGate>)
    expect(await screen.findByText("Sales Coach page")).toBeInTheDocument()
  })
})

describe("A locked agent's chat", () => {
  it("says what it waits on instead of an error", async () => {
    replies["GET /api/team/setup"] = [200, TEAM]
    const chat = { messages: [], loading: false, configured: true, outOfCredits: false, submittedUIs: [], locked: { agent: "sales_coach", waits_on: "media_buyer" } }
    wrap(<ChatThread chat={chat} name="Sales Coach" />)
    const card = screen.getByRole("region", { name: "Sales Coach is locked" })
    expect(card).toHaveTextContent("It unlocks once Marketing Guru is set up.")
    await waitFor(() => expect(within(card).getByRole("link", { name: /Continue Marketing Guru setup/ })).toHaveAttribute("href", "/welcome?s=buyer"))
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })
})

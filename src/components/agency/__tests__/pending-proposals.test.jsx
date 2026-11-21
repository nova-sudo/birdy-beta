import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, renderHook, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { PendingProposals, originOf } from "../pending-proposals"
import { useSectionTabs } from "../tabs"
import { BUYER_SECTION, OPS_SECTION } from "../sections"

const pending = { state: null, keys: [] }
const apply = vi.fn()
const convos = { conversations: [{ session_id: "c1", title: "Why did booked calls drop for Aura?", agent: "sales_coach" }] }

vi.mock("swr", () => ({ default: (key) => ({ data: key === "/api/chat/conversations" ? convos : undefined }) }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 3 }))
vi.mock("@/lib/proposals-api", async (orig) => ({
  ...(await orig()),
  usePendingProposals: (agent) => { pending.keys.push(agent); return agent ? pending.state : { proposals: [], unavailable: false, error: null, isLoading: false, mutate: vi.fn() } },
  applyProposal: (...a) => apply(...a),
}))
vi.mock("@/lib/sub-agents", async (orig) => ({ ...(await orig()), useSubAgents: () => ({ subAgents: [{ id: "s5", name: "Budget guard" }] }) }))
vi.mock("@/lib/section-chats", () => ({ rememberSectionChat: vi.fn() }))

const P = (o) => ({ id: "p1", agent: "media_buyer", title: "Put the old lead form back", detail: "", kind: "lead_form", payload: {}, status: "pending", can_undo: true, proposed_by: "media_buyer", client_group_id: "g0", origin: "chat", session_id: "c1", sub_agent_id: null, ...o })
const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  pending.keys = []
  pending.state = { proposals: [P(), P({ id: "p2", title: "Lower Healthy Glow's budget", client_group_id: "g2", origin: "sub_agent_run", session_id: null, sub_agent_id: "s5", proposed_by: "sub:s5" })], unavailable: false, error: null, isLoading: false, mutate }
})

describe("Waiting for your approval", () => {
  it("lists what waits in the agent's area, each with the approval card and where it came from", () => {
    render(<PendingProposals agent="media_buyer" />)
    const group = screen.getByRole("region", { name: "Waiting for your approval" })
    expect(within(group).getAllByRole("group", { name: /^Proposal:/ })).toHaveLength(2)
    expect(group).toHaveTextContent("From your chat “Why did booked calls drop for Aura?”")
    expect(within(group).getByRole("link", { name: "Open the chat" })).toHaveAttribute("href", "/sales-coach/chat?c=c1")
    expect(group).toHaveTextContent("From Budget guard’s run")
    expect(within(group).getByRole("link", { name: "See Budget guard" })).toHaveAttribute("href", "/media-buyer/context#sub-agent-s5")
    expect(within(group).getByText("Budget guard proposes")).toBeInTheDocument()
    expect(pending.keys).toContain("media_buyer")
  })

  it("inside a client lists only what is about it", () => {
    render(<PendingProposals agent="media_buyer" clientId="g0" />)
    expect(screen.getAllByRole("group", { name: /^Proposal:/ })).toHaveLength(1)
  })

  it("keeps an approved one on screen, with its Undo, and re-reads the list", async () => {
    apply.mockResolvedValue({ reply: "Done.", session_id: "mb-1" })
    render(<PendingProposals agent="media_buyer" />)
    await userEvent.click(screen.getAllByRole("button", { name: "Approve" })[0])
    expect(apply).toHaveBeenCalledWith("p1")
    expect(mutate).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Undo: Put the old lead form back" })).toBeInTheDocument()
    // Where it came from still reads right.
    expect(screen.getByText("From your chat “Why did booked calls drop for Aura?”")).toBeInTheDocument()
  })

  it("shows nothing when nothing waits, or when the server has no list yet", () => {
    pending.state = { ...pending.state, proposals: [] }
    const { container, rerender } = render(<PendingProposals agent="media_buyer" />)
    expect(container).toBeEmptyDOMElement()
    pending.state = { proposals: [], unavailable: true, error: null, isLoading: false, mutate }
    rerender(<PendingProposals agent="media_buyer" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("originOf", () => {
  it("stays generic when the chat or sub-agent is not known", () => {
    expect(originOf(P({ session_id: "zz" }), new Map(), new Map(), "media_buyer")).toEqual({ kind: "chat", text: "From a chat", href: "/dashboard/chat?c=zz", link: "Open the chat" })
    expect(originOf(P({ origin: "sub_agent_run", sub_agent_id: null, session_id: null }), new Map(), new Map(), "media_buyer")).toMatchObject({ text: "From a sub-agent’s run", href: null })
  })
})

describe("the Suggestions tab's count", () => {
  it("adds what waits for approval in Media Buyer's and Sales Coach's sections", () => {
    const { result } = renderHook(() => useSectionTabs(BUYER_SECTION))
    expect(result.current.find((t) => t.value === "suggestions").count).toBe(5)
  })
  it("leaves Birdy counting suggestions only", () => {
    const { result } = renderHook(() => useSectionTabs(OPS_SECTION))
    expect(result.current.find((t) => t.value === "suggestions").count).toBe(3)
  })
})

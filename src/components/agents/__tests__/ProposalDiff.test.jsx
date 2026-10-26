import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }))

import { SWRConfig } from "swr"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { ProposalDiff, ProposalList } from "../ProposalDiff"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const PROPOSAL = {
  id: "p1",
  agent_id: "ag1",
  rule_id: "r2",
  rule_kind: "revive_winner",
  rule_label: "Revive old winners",
  reason_code: "creative_stale",
  kind: "param_change",
  before: { max_creative_age_days: 90 },
  after: { max_creative_age_days: 60 },
  evidence: { reason_code: "creative_stale", count: 3, item_ids: ["s1", "s2", "s3"] },
  replay_effect: { removed: 3, of: 5, removed_were_denied: 3 },
  status: "open",
}

const calls = (path, method) =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  toastMock.mockClear()
  toastMock.error.mockClear()
})

const OVERRIDE = {
  ...PROPOSAL,
  id: "p2",
  rule_id: "r1",
  rule_kind: "pause_over_target",
  rule_label: "Pause over target",
  reason_code: "target_wrong",
  kind: "client_override",
  client_group_id: "g2",
  client_name: "Tylaesthetics",
  before: { zero_lead_spend: 80 },
  after: { zero_lead_spend: 120 },
  replay_effect: null,
}

const CLIENTS = [
  { id: "g1", name: "Glow Skin NYC", currency: "USD" },
  { id: "g2", name: "Tylaesthetics", currency: "GBP" },
]

describe("ProposalDiff", () => {
  it("shows before struck through, after, the evidence and the replay effect", () => {
    render(<ProposalDiff agentId="ag1" proposal={PROPOSAL} />)
    expect(screen.getByText("From 3 denials")).toBeInTheDocument()
    expect(screen.getByText("Creative is stale", { exact: false })).toBeInTheDocument()
    const before = screen.getByText("90 days")
    expect(before.tagName).toBe("DEL")
    expect(before.className).toContain("bg-danger-soft")
    const after = screen.getByText("60 days")
    expect(after.tagName).toBe("INS")
    expect(after.className).toContain("bg-success-soft")
    expect(screen.getByText(/removes 3 of 5 revives/)).toBeInTheDocument()
  })

  it("accept posts and replaces with Rule updated", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      res({ proposal: { ...PROPOSAL, status: "accepted" }, rule: { id: "r2", kind: "revive_winner" } })
    )
    const onDecided = vi.fn()
    render(<ProposalDiff agentId="ag1" proposal={PROPOSAL} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Update rule" }))

    expect(calls("/api/agents/ag1/proposals/p1/accept", "POST")).toHaveLength(1)
    expect(await screen.findByText("Rule updated")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Update rule" })).not.toBeInTheDocument()
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(PROPOSAL, "accepted", expect.anything()))
  })

  it("Keep rejects the proposal", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ proposal: { ...PROPOSAL, status: "rejected" } }))
    const onDecided = vi.fn()
    render(<ProposalDiff agentId="ag1" proposal={PROPOSAL} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Keep 90 days" }))

    expect(calls("/api/agents/ag1/proposals/p1/reject", "POST")).toHaveLength(1)
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(PROPOSAL, "rejected", expect.anything()))
  })

  it("a 409 on accept marks the suggestion out of date, leaves only Keep and re-reads proposals", async () => {
    let proposalGets = 0
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      const method = init?.method ?? "GET"
      if (path === "/api/agents/ag1/proposals" && method === "GET") {
        proposalGets += 1
        return Promise.resolve(res([PROPOSAL]))
      }
      if (path === "/api/agents/ag1/proposals/p1/accept") return Promise.resolve(res({ detail: "This proposal was already decided" }, 409))
      if (path === "/api/agents/ag1/proposals/p1/reject") return Promise.resolve(res({ detail: "This proposal was already decided" }, 409))
      return Promise.resolve(res([]))
    })
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <ProposalList agentId="ag1" />
      </SWRConfig>
    )

    await userEvent.click(await screen.findByRole("button", { name: "Update rule" }))

    expect(await screen.findByText(/This suggestion is out of date/)).toBeInTheDocument()
    expect(screen.queryByText("Rule updated")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Update rule" })).not.toBeInTheDocument()
    await waitFor(() => expect(proposalGets).toBeGreaterThan(1))

    // Keep dismisses it even though the server already closed it.
    await userEvent.click(screen.getByRole("button", { name: "Keep 90 days" }))
    expect(calls("/api/agents/ag1/proposals/p1/reject", "POST")).toHaveLength(1)
    await waitFor(() => expect(screen.queryByText(/This suggestion is out of date/)).not.toBeInTheDocument())
  })

  it("a failed Keep shows an error and leaves the proposal open", async () => {
    vi.mocked(apiRequest).mockResolvedValue(res({ detail: "boom" }, 500))
    const onDecided = vi.fn()
    render(<ProposalDiff agentId="ag1" proposal={PROPOSAL} onDecided={onDecided} />)

    await userEvent.click(screen.getByRole("button", { name: "Keep 90 days" }))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Couldn't keep the rule", expect.anything()))
    expect(onDecided).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Keep 90 days" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Update rule" })).toBeInTheDocument()
  })

  it("renders a client override in that client's currency", () => {
    render(<ProposalDiff agentId="ag1" proposal={OVERRIDE} currency="$" clients={CLIENTS} />)
    expect(screen.getByText("Client exception")).toBeInTheDocument()
    expect(screen.getByText(/for Tylaesthetics/)).toBeInTheDocument()
    expect(screen.getByText("£80").tagName).toBe("DEL")
    expect(screen.getByText("£120").tagName).toBe("INS")
    expect(screen.getByRole("button", { name: "Keep £80" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add exception" })).toBeInTheDocument()
    expect(screen.queryByText(/On the last 30 days/)).not.toBeInTheDocument()
  })

  it("a scope-wide change keeps the scope currency", () => {
    const spend = { ...PROPOSAL, rule_kind: "pause_over_target", before: { zero_lead_spend: 80 }, after: { zero_lead_spend: 120 } }
    render(<ProposalDiff agentId="ag1" proposal={spend} currency="$" clients={CLIENTS} />)
    expect(screen.getByText("$80").tagName).toBe("DEL")
  })
})

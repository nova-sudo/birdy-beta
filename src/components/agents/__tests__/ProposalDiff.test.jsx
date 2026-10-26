import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { ProposalDiff } from "../ProposalDiff"

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

beforeEach(() => vi.mocked(apiRequest).mockReset())

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
})

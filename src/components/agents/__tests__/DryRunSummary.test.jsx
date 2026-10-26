import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { apiRequest } from "@/lib/api"
import { DryRunSummary } from "../DryRunSummary"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const RESULT = {
  actions: 4,
  by_rule: { pause_over_target: 2, revive_winner: 1, flag_no_spend: 1, flag_declining: 0 },
  spend_saved: 690,
  leads_at_risk: 9,
  examples: [
    { day: "2026-10-20", rule_kind: "flag_no_spend", title: "“Set S5” spent nothing for 24 hrs", client_name: "Client g1", why: "Live with a budget but no spend" },
    { day: "2026-10-16", rule_kind: "pause_over_target", title: "Pause “Ad A3”", client_name: "Client g1", why: "£50 CPL vs £20 target" },
  ],
}

let polls
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  polls = 0
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init = {}) => {
    if (path === "/api/agents/ag1/dry-run" && init.method === "POST") return Promise.resolve(res({ job_id: "j1" }))
    if (path === "/api/agents/ag1/jobs/j1") {
      polls += 1
      return Promise.resolve(res(polls < 2 ? { status: "running" } : { status: "done", result: RESULT }))
    }
    return Promise.resolve(res({}, 404))
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("DryRunSummary", () => {
  it("polls until done and renders totals", async () => {
    const onResult = vi.fn()
    render(<DryRunSummary agentId="ag1" currency="£" onResult={onResult} />)

    expect(await screen.findByText(/Replaying the last 30 days/)).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(0)
    expect(polls).toBe(1)
    expect(screen.queryByText("£690")).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(2000)
    expect(polls).toBe(2)

    expect(await screen.findByText("£690")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("9")).toBeInTheDocument()
    const table = screen.getByRole("table")
    expect(within(table).getByText("Pause “Ad A3”")).toBeInTheDocument()
    expect(within(table).getByText("16 Oct")).toBeInTheDocument()
    expect(onResult).toHaveBeenCalledWith(RESULT)

    // Done: no more polling.
    await vi.advanceTimersByTimeAsync(6000)
    expect(polls).toBe(2)
    expect(vi.mocked(apiRequest).mock.calls.filter(([p]) => p.endsWith("/dry-run"))).toHaveLength(1)
  })
})

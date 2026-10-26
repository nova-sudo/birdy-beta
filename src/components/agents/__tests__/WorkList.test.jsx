import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useAgentWorkCount } from "@/lib/agents-api"
import { WorkList } from "../WorkList"

const res = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const base = {
  status: "open",
  agent_id: "ag1",
  rule_mode: "ask",
  has_action: true,
  client: "Tylaesthetics",
  description: "",
  stats: [],
  blocked_reason: null,
  auto_failed: false,
  undone_at: null,
}

const OPEN = [
  { ...base, id: "s1", rule_kind: "pause_over_target", title: "Pause “Summer BBL – Video 3”" },
  { ...base, id: "s2", rule_kind: "flag_no_spend", rule_mode: "flag", has_action: false, title: "“Lipo – Broad” spent £0" },
]

const AUTO = [
  { ...base, id: "a1", status: "applied", rule_kind: "pause_over_target", rule_mode: "auto", title: "Paused “Botox – Static 4”", applied_at: new Date(Date.now() - 3 * 3600_000).toISOString().replace("Z", "") },
  { ...base, id: "a2", status: "applied", rule_kind: "pause_over_target", rule_mode: "auto", title: "Paused 2 ads", client: "The Contour Co", undone_at: "2026-10-26T08:00:00Z" },
]

const AGENTS = [{ id: "ag1", type: "media_buying", status: "active" }]

let work
beforeEach(() => {
  work = { open: OPEN, auto_applied: AUTO }
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init) => {
    const method = init?.method ?? "GET"
    if (path === "/api/agents" && method === "GET") return Promise.resolve(res(AGENTS))
    if (path === "/api/agents/ag1/work" && method === "GET") return Promise.resolve(res(work))
    if (path === "/api/dashboard/suggestions/a1/undo") return Promise.resolve(res({ ok: true, outcome: "undone" }))
    if (path === "/api/dashboard/suggestions/s1/apply") {
      work = { ...work, open: work.open.filter((i) => i.id !== "s1") }
      return Promise.resolve(res({ ok: true, outcome: "applied", succeeded: ["ad1"], failed: [] }))
    }
    return Promise.resolve(res({}, 404))
  })
})

function Badge() {
  const count = useAgentWorkCount()
  return <output aria-label="nav badge">{count == null ? "none" : count}</output>
}

const renderList = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <Badge />
      <WorkList agentId="ag1" />
    </SWRConfig>
  )

const workGets = () =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === "/api/agents/ag1/work" && !init?.method).length

describe("WorkList", () => {
  it("lists the open items in a Needs you frame", async () => {
    renderList()
    expect(await screen.findByText("Pause “Summer BBL – Video 3”")).toBeInTheDocument()
    expect(screen.getByText("“Lipo – Broad” spent £0")).toBeInTheDocument()
    expect(screen.getByText("Needs you")).toBeInTheDocument()
  })

  it("auto-run today lists items with Undo", async () => {
    renderList()
    const frame = (await screen.findByText("Done on auto today")).closest("[data-ds='frame']")
    expect(within(frame).getByText("Paused “Botox – Static 4”")).toBeInTheDocument()
    expect(within(frame).getByText("Paused 2 ads")).toBeInTheDocument()

    // When it ran, from the naive UTC applied_at.
    expect(await within(frame).findByText("3 hours ago")).toBeInTheDocument()

    // Already undone: no button, says so.
    expect(within(frame).getAllByRole("button", { name: /^Undo/ })).toHaveLength(1)
    expect(within(frame).getByText("Undone")).toBeInTheDocument()

    await userEvent.click(within(frame).getByRole("button", { name: /^Undo/ }))
    const undo = vi.mocked(apiRequest).mock.calls.filter(
      ([p, init]) => p === "/api/dashboard/suggestions/a1/undo" && init?.method === "POST"
    )
    expect(undo).toHaveLength(1)
    await waitFor(() => expect(within(frame).getAllByText("Undone")).toHaveLength(2))
  })

  it("counts open items for the nav badge and revalidates after a decision", async () => {
    renderList()
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("2"))
    const before = workGets()

    await userEvent.click(await screen.findByRole("button", { name: "Approve" }))

    expect(await screen.findByText("Done in Meta")).toBeInTheDocument()
    await waitFor(() => expect(workGets()).toBeGreaterThan(before))
    await waitFor(() => expect(screen.getByLabelText("nav badge")).toHaveTextContent("1"))
    // The decided item stays on screen, marked done.
    expect(screen.getByText("Pause “Summer BBL – Video 3”")).toBeInTheDocument()
  })

  it("has no badge count without agents", async () => {
    vi.mocked(apiRequest).mockImplementation(() => Promise.resolve(res([])))
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <Badge />
      </SWRConfig>
    )
    await waitFor(() =>
      expect(vi.mocked(apiRequest).mock.calls.some(([p]) => p === "/api/agents")).toBe(true)
    )
    expect(screen.getByLabelText("nav badge")).toHaveTextContent("none")
  })
})

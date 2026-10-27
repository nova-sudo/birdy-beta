import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, useSWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))
vi.mock("@/components/agents/ConfidenceMeter", () => ({ ConfidenceMeter: () => null }))
vi.mock("@/components/agents/PlaybookDraft", () => ({ PlaybookDraft: () => null }))
vi.mock("@/components/agents/TrainingChat", () => ({ TrainingChat: () => null }))

import { apiRequest } from "@/lib/api"
import { AgentTraining } from "../AgentTraining"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const CASE = {
  case_id: "c1",
  rule_kind: "pause_over_target",
  client_name: "Client 1",
  title: "Pause “Ad A”",
  facts: [],
  options: ["Pause", "Leave it"],
  birdy_answer: "Pause",
  why: "Over target.",
}

let history
let practiceGets
beforeEach(() => {
  practiceGets = []
  apiRequest.mockReset()
  apiRequest.mockImplementation((path) => {
    if (path === "/api/agents/ag1/history") return Promise.resolve(res(history))
    if (path.startsWith("/api/agents/ag1/practice")) {
      practiceGets.push(path)
      return Promise.resolve(res(history.ready > 0 ? [CASE] : []))
    }
    return Promise.resolve(res({}, 404))
  })
})

const hist = (ready, total) => ({
  total,
  ready,
  clients: Array.from({ length: total }, (_, i) => ({
    client_group_id: `g${i}`,
    name: `Client ${i}`,
    status: i < ready ? "ready" : "pending",
    error: null,
  })),
})

let swrMutate
function GrabMutate() {
  swrMutate = useSWRConfig().mutate
  return null
}

const AGENT = { id: "ag1", scope: { client_group_ids: [] } }
const view = () => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <GrabMutate />
    <AgentTraining agent={AGENT} clients={[]} />
  </SWRConfig>
)

describe("Practice round with ad history", () => {
  it("keeps skeletons, not the empty text, while no client is ready", async () => {
    history = hist(0, 3)
    const { container } = render(view())

    expect(await screen.findByText("0 of 3 clients ready. Cases appear as each one finishes.")).toBeInTheDocument()
    await waitFor(() => expect(practiceGets.length).toBeGreaterThan(0))
    expect(screen.queryByText(/No past cases to practise on/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"], [data-ds="skeleton"]').length).toBeGreaterThan(0)
  })

  it("shows the empty text once every client is ready and there are no cases", async () => {
    history = hist(3, 3)
    apiRequest.mockImplementation((path) => {
      if (path === "/api/agents/ag1/history") return Promise.resolve(res(history))
      if (path.startsWith("/api/agents/ag1/practice")) return Promise.resolve(res([]))
      return Promise.resolve(res({}, 404))
    })
    render(view())
    expect(await screen.findByText(/No past cases to practise on/)).toBeInTheDocument()
  })

  it("asks for more cases when another client becomes ready", async () => {
    history = hist(1, 3)
    render(view())
    expect(await screen.findByText("1 of 3 clients ready. Cases appear as each one finishes.")).toBeInTheDocument()
    await waitFor(() => expect(practiceGets).toHaveLength(1))

    // The poll sees one more client ready.
    history = hist(2, 3)
    await act(async () => {
      await swrMutate("/api/agents/ag1/history")
    })
    expect(await screen.findByText("2 of 3 clients ready. Cases appear as each one finishes.")).toBeInTheDocument()
    await waitFor(() => expect(practiceGets).toHaveLength(2))
    expect(practiceGets).toHaveLength(2)
  })
})

describe("Practice round when every client errored", () => {
  it("shows the can't-read line and the empty text, no skeletons", async () => {
    history = {
      total: 2,
      ready: 0,
      clients: [0, 1].map((i) => ({ client_group_id: `g${i}`, name: `Client ${i}`, status: "error", error: "no_access" })),
    }
    apiRequest.mockImplementation((path) => {
      if (path === "/api/agents/ag1/history") return Promise.resolve(res(history))
      if (path.startsWith("/api/agents/ag1/practice")) return Promise.resolve(res([]))
      return Promise.resolve(res({}, 404))
    })
    const { container } = render(view())
    expect(await screen.findByText(/No past cases to practise on/)).toBeInTheDocument()
    expect(screen.getByText(/2 clients can't be read/)).toBeInTheDocument()
    expect(container.querySelectorAll('[data-ds="skeleton"].h-14')).toHaveLength(0)
  })
})

describe("Practice round while the history is still loading", () => {
  it("shows skeletons, not the empty text, before the history answers", async () => {
    let practiceDone
    const practiceSettled = new Promise((r) => (practiceDone = r))
    apiRequest.mockImplementation((path) => {
      if (path === "/api/agents/ag1/history") return new Promise(() => {}) // never answers
      if (path.startsWith("/api/agents/ag1/practice")) {
        practiceDone()
        return Promise.resolve(res([]))
      }
      return Promise.resolve(res({}, 404))
    })
    const { container } = render(view())
    await act(async () => {
      await practiceSettled
    })
    // Practice has answered with no cases; the history hasn't, so nothing is known yet.
    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument())
    expect(screen.queryByText(/No past cases to practise on/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-ds="skeleton"].h-14').length).toBeGreaterThan(0)
  })

  it("falls back to the empty text when the history can't be read", async () => {
    apiRequest.mockImplementation((path) => {
      if (path === "/api/agents/ag1/history") return Promise.resolve(res({ detail: "boom" }, 500))
      if (path.startsWith("/api/agents/ag1/practice")) return Promise.resolve(res([]))
      return Promise.resolve(res({}, 404))
    })
    render(view())
    expect(await screen.findByText(/No past cases to practise on/)).toBeInTheDocument()
  })
})

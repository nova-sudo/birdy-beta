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
import { TrustTable } from "../TrustTable"
import { LearnedList } from "../LearnedList"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const RULES = [
  {
    id: "r2",
    kind: "revive_winner",
    mode: "ask",
    stats: { streak: 2, last10: ["ok", "no", "undo", "ok"], approved: 2, denied: 1, offer_after: 10 },
  },
  { id: "r3", kind: "flag_no_spend", mode: "flag", stats: { streak: 0, last10: [] } },
]

const MEMORY = [
  { id: "m1", text: "Don't revive anything from the summer promo", kind: "fact", source: "denial", created_at: "2026-10-24T10:00:00" },
  { id: "m2", text: "Palm Peach CPL target is £24", kind: "fact", source: "chat", created_at: "2026-10-23T10:00:00" },
]

let memory
beforeEach(() => {
  memory = MEMORY
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init) => {
    const method = init?.method ?? "GET"
    if (path === "/api/agents/ag1/rules") return Promise.resolve(res(RULES))
    if (path === "/api/agents/ag1/memory" && method === "GET") return Promise.resolve(res(memory))
    if (path === "/api/agents/ag1/memory/m1" && method === "DELETE") {
      memory = memory.filter((m) => m.id !== "m1")
      return Promise.resolve(res({ ok: true }))
    }
    return Promise.resolve(res({}, 404))
  })
})

const wrap = (ui) =>
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>{ui}</SWRConfig>)

describe("TrustTable", () => {
  it("trust squares map ok/no/undo", async () => {
    wrap(<TrustTable agentId="ag1" />)
    const row = (await screen.findByText("Revive old winners")).closest("tr")
    const squares = row.querySelectorAll("[data-decision]")
    expect(squares).toHaveLength(10)
    expect([...squares].map((s) => s.dataset.decision)).toEqual([
      "ok", "no", "undo", "ok", "none", "none", "none", "none", "none", "none",
    ])
    expect(squares[0].className).toContain("bg-success")
    expect(squares[1].className).toContain("bg-danger")
    expect(squares[2].className).toContain("bg-warning")
    expect(within(row).getByText("Ask me")).toBeInTheDocument()
    expect(within(row).getByText("2 / 4")).toBeInTheDocument()

    const flag = screen.getByText("Flag no spend").closest("tr")
    expect(within(flag).getByText("Flag only")).toBeInTheDocument()
  })
})

describe("LearnedList", () => {
  it("remove memory calls DELETE", async () => {
    wrap(<LearnedList agentId="ag1" />)
    expect(await screen.findByText("Don't revive anything from the summer promo")).toBeInTheDocument()
    expect(screen.getByText(/From a denial note/)).toBeInTheDocument()
    expect(screen.getByText(/From training chat/)).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "Remove “Don't revive anything from the summer promo”" })
    )

    const del = vi.mocked(apiRequest).mock.calls.filter(
      ([p, init]) => p === "/api/agents/ag1/memory/m1" && init?.method === "DELETE"
    )
    expect(del).toHaveLength(1)
    await waitFor(() =>
      expect(screen.queryByText("Don't revive anything from the summer promo")).not.toBeInTheDocument()
    )
    expect(screen.getByText("Palm Peach CPL target is £24")).toBeInTheDocument()
  })

  it("puts the item back when DELETE fails", async () => {
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      const method = init?.method ?? "GET"
      if (path === "/api/agents/ag1/memory" && method === "GET") return Promise.resolve(res(MEMORY))
      if (path === "/api/agents/ag1/memory/m1" && method === "DELETE") return Promise.resolve(res({ detail: "nope" }, 500))
      return Promise.resolve(res({}, 404))
    })
    wrap(<LearnedList agentId="ag1" />)
    const text = "Don't revive anything from the summer promo"
    await userEvent.click(await screen.findByRole("button", { name: `Remove “${text}”` }))

    expect(
      vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === "/api/agents/ag1/memory/m1" && init?.method === "DELETE")
    ).toHaveLength(1)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: `Remove “${text}”` })).toBeInTheDocument()
  })
})

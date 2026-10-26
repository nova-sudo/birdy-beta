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
import { LearningOffers } from "../GraduationOffer"
import { TrustTable } from "../TrustTable"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const PAUSE = {
  id: "r1",
  kind: "pause_over_target",
  mode: "ask",
  enabled: true,
  params: {},
  stats: { streak: 10, last10: Array(10).fill("ok"), approved: 10, denied: 0, offer_after: 10 },
}
const REVIVE = {
  id: "r2",
  kind: "revive_winner",
  mode: "ask",
  enabled: true,
  params: {},
  stats: { streak: 0, last10: [], approved: 0, denied: 0, offer_after: 10 },
}

const GRAD = {
  id: "graduation:r1",
  type: "graduation",
  rule_id: "r1",
  rule_kind: "pause_over_target",
  rule_label: "Pause over target",
  streak: 10,
  last10: Array(10).fill("ok"),
  choices: ["auto_notify", "auto_silent", "keep_asking"],
}
const BRAKE = {
  id: "brake:r2",
  type: "brake",
  rule_id: "r2",
  rule_kind: "revive_winner",
  rule_label: "Revive old winners",
  undos: 2,
  at: "2026-10-25T09:00:00",
  choices: ["keep_asking"],
}

let rules
let offers
beforeEach(() => {
  rules = [PAUSE, REVIVE]
  offers = [GRAD]
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation((path, init) => {
    const method = init?.method ?? "GET"
    if (path === "/api/agents/ag1/rules" && method === "GET") return Promise.resolve(res(rules))
    if (path === "/api/agents/ag1/offers" && method === "GET") return Promise.resolve(res(offers))
    if (path === "/api/agents/ag1/rules/r1/graduate" && method === "POST") {
      const saved = { ...PAUSE, mode: "auto", notify: true }
      rules = [saved, REVIVE]
      offers = []
      return Promise.resolve(res(saved))
    }
    if (path === "/api/agents/ag1/rules/r2/graduate" && method === "POST") {
      offers = []
      return Promise.resolve(res(REVIVE))
    }
    return Promise.resolve(res([]))
  })
})

const renderBoth = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <LearningOffers agentId="ag1" />
      <TrustTable agentId="ag1" />
    </SWRConfig>
  )

const posts = (path) =>
  vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && init?.method === "POST")

describe("GraduationOffer", () => {
  it("graduate posts choice and updates mode badge", async () => {
    renderBoth()
    expect(await screen.findByText(/approved the last 10/)).toBeInTheDocument()
    const row = (await screen.findByText("Pause ads over target")).closest("tr")
    expect(within(row).getByText("Ask me")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Auto-run, tell me after" }))

    const sent = posts("/api/agents/ag1/rules/r1/graduate")
    expect(sent).toHaveLength(1)
    expect(JSON.parse(sent[0][1].body)).toEqual({ choice: "auto_notify" })
    await waitFor(() => expect(within(row).getByText("Auto-run")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Auto-run silently" })).not.toBeInTheDocument()
  })

  it("brake notice explains the move back to Ask and answers Keep asking", async () => {
    offers = [BRAKE]
    renderBoth()
    const notice = (await screen.findByText(/back on Ask me/)).closest("[data-slot='notice']")
    expect(notice.className).toContain("bg-warning-soft")
    expect(within(notice).getByText(/undid 2 of its auto-run actions within 7 days/)).toBeInTheDocument()
    expect(within(notice).queryByRole("button", { name: /Auto-run/ })).not.toBeInTheDocument()

    await userEvent.click(within(notice).getByRole("button", { name: "Keep asking" }))

    const sent = posts("/api/agents/ag1/rules/r2/graduate")
    expect(sent).toHaveLength(1)
    expect(JSON.parse(sent[0][1].body)).toEqual({ choice: "keep_asking" })
    await waitFor(() => expect(screen.queryByText(/back on Ask me/)).not.toBeInTheDocument())
  })
})

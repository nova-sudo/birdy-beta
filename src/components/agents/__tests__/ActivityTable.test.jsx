import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

vi.mock("@/components/ds/overlays/toaster", async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() } }
})

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { toast } from "@/components/ds/overlays/toaster"
import { toActivityRow } from "@/lib/agents-api"
import { ActivityTable } from "../ActivityTable"
import { ImpactTabs } from "../ImpactTabs"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

const row = (over) => ({
  id: over.id,
  at: "2026-10-20T07:01:00.000Z",
  title: `Paused ${over.id}`,
  client_name: "Tylaesthetics",
  client_group_id: "g1",
  suggestion_id: `sug_${over.id}`,
  rule_id: "r1",
  action_type: "pause_ads",
  decided: "auto",
  can_undo: false,
  currency: "GBP",
  ...over,
})

const table = () => screen.getByRole("table")

const renderTable = (raw, props = {}) =>
  render(<ActivityTable agentId="ag1" items={raw.map(toActivityRow)} {...props} />)

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe("ActivityTable", () => {
  it("badges per decision type", () => {
    renderTable([
      row({ id: "a1", decided: "auto" }),
      row({ id: "a2", decided: "approved" }),
      row({ id: "a3", decided: "denied", reason_code: "creative_stale" }),
      row({ id: "a4", decided: "undone", suggestion_id: "sug_other" }),
    ])
    const t = within(table())
    const tones = {
      "Auto-run": "bg-primary-soft",
      "You approved": "bg-success-soft",
      "You denied": "bg-danger-soft",
      "You undid": "bg-warning-soft",
    }
    for (const [label, cls] of Object.entries(tones)) {
      const badge = t.getByText(label).closest("[data-ds='badge']")
      expect(badge).not.toBeNull()
      expect(badge.className).toContain(cls)
    }
  })

  it("Undo only when can_undo", async () => {
    const onChanged = vi.fn()
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/api/agents/ag1/suggestions/sug_a1/undo-auto" && init?.method === "POST") {
        return Promise.resolve(res({ detail: "Auto-run actions can only be undone for 24 hours" }, 410))
      }
      return Promise.resolve(res({}, 404))
    })
    renderTable(
      [
        // Newest first: a2 was approved and later undone (the undo row is newer).
        row({ id: "u2", decided: "undone", suggestion_id: "sug_a2", at: "2026-10-21T09:00:00.000Z" }),
        row({ id: "a1", decided: "auto", can_undo: true, at: "2026-10-20T08:00:00.000Z" }),
        row({ id: "a2", decided: "approved", at: "2026-10-20T07:00:00.000Z" }),
        row({ id: "a3", decided: "auto", can_undo: false, at: "2026-10-19T07:00:00.000Z" }),
      ],
      { onChanged }
    )
    const t = within(table())
    const buttons = t.getAllByRole("button", { name: /undo/i })
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName("Undo Paused a1")

    // The approved row that was undone later is greyed with "Undone" context.
    const undoneRow = t.getByText("Paused a2").closest("tr")
    expect(undoneRow.querySelector("[data-undone='true']")).not.toBeNull()
    expect(within(undoneRow).getByText(/Undone/)).toBeInTheDocument()

    await userEvent.click(buttons[0])
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Undo window closed", expect.anything()))
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/agents/ag1/suggestions/sug_a1/undo-auto",
      expect.objectContaining({ method: "POST" })
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it("outcome text or Too early", () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString()
    renderTable([
      row({ id: "a1", title: "Paused Botox", at: new Date().toISOString() }),
      row({
        id: "a2",
        title: "Paused Summer",
        at: old,
        outcome_7d: { metric: "account_cpl", before: 26, after: 21, currency: "GBP" },
      }),
      row({
        id: "a3",
        title: "Turned on Skin",
        action_type: "enable_ads",
        currency: "USD",
        at: old,
        outcome_7d: { metric: "ad_cpl", after: 70, leads: 3, spend: 210, currency: "USD" },
      }),
      row({ id: "a4", title: "Revive Lips", decided: "denied", reason_code: "creative_stale", at: old }),
    ])
    const t = within(table())
    expect(within(t.getByText("Paused Botox").closest("tr")).getByText("Too early")).toBeInTheDocument()
    expect(t.getByText("Account CPL £26 → £21")).toBeInTheDocument()
    expect(t.getByText("3 leads at $70 CPL")).toBeInTheDocument()
    expect(t.queryByText(/£70/)).toBeNull()
    expect(t.getByText("“Creative is stale”")).toBeInTheDocument()
  })
})

const IMPACT = {
  month: "2026-10",
  actions: 47,
  auto: 29,
  wasted_spend_stopped: 2700,
  wasted_spend_by_currency: { GBP: 2300, USD: 400 },
  currency: "GBP",
  approval_rate: 0.94,
  approval_counts: { approved: 30, denied: 3, undone_user: 1 },
  vs_prev_month: { month: "2026-09", actions: 35, auto: 20, approval_rate: 0.9 },
}

describe("ImpactTabs", () => {
  it("shows each currency's wasted spend instead of one summed total", async () => {
    vi.mocked(apiRequest).mockImplementation((path) =>
      path === "/api/agents/ag1/impact" ? Promise.resolve(res(IMPACT)) : Promise.resolve(res({}, 404))
    )
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
        <ImpactTabs agentId="ag1" />
      </SWRConfig>
    )
    const wasted = await screen.findByRole("tab", { name: /wasted spend stopped/i })
    expect(wasted).toHaveTextContent("£2,300")
    expect(wasted).toHaveTextContent("$400")
    expect(wasted).not.toHaveTextContent("£2,700")

    // The actions tab compares with last month.
    const actions = screen.getByRole("tab", { name: /actions this month/i })
    expect(actions).toHaveTextContent("47")
    expect(actions).toHaveTextContent("12")
    expect(actions).toHaveTextContent("vs Sep")
  })
})

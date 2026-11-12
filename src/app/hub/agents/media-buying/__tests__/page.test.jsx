import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

const push = vi.fn()
const replace = vi.fn()
let params = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => params,
}))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))
vi.mock("@/components/hub/HubShell", () => ({ SalesHubHeaderTitle: () => null }))
vi.mock("@/components/agents/stock/AgentSettings", () => ({ AgentSettings: () => <div data-testid="settings" /> }))
vi.mock("@/components/agents/stock/LessonsList", () => ({ LessonsList: () => <div data-testid="lessons" /> }))
vi.mock("@/components/agents/stock/TurnOn", () => ({ TurnOn: () => null }))
vi.mock("@/lib/useClientGroups", () => ({
  useClientGroups: () => ({ clientGroups: [{ id: "g1", name: "Aura" }, { id: "g2", name: "Glow" }], loading: false, error: null, refresh: vi.fn() }),
}))

const state = {}
vi.mock("@/lib/agents-api", async (importOriginal) => ({ ...(await importOriginal()), useAgent: () => ({ agent: state.agent }) }))
vi.mock("@/lib/stock-agent-api", async (importOriginal) => ({
  ...(await importOriginal()),
  useStockAgent: () => ({ agent: state.agent, listUnavailable: false, error: null, isLoading: false, mutate: vi.fn() }),
  useLatestRun: () => state.latest,
  useRun: (id, runId) => (runId ? { report: state.report, error: undefined, mutate: vi.fn() } : { report: null, error: undefined, mutate: vi.fn() }),
  useRuns: () => ({ runs: state.runs, hasOlder: false, loadOlder: vi.fn(), error: null, mutate: vi.fn() }),
  useMonth: (id, m) => (m ? state.month : { month: null, range: null, rows: [], error: null, mutate: vi.fn() }),
  useStockActions: () => ({}),
}))

import Page from "../page"

const line = (id) => ({ id, kind: "remove", state: "proposed", mode: "ask", ad_name: `Ad ${id}` })
const RUN = { id: "r1", kind: "scheduled", local_date: "2026-11-09", phase: "done", batch_id: "a", alerts: [], clients: {} }
const OLD = { id: "r0", kind: "scheduled", local_date: "2026-10-26", phase: "done", batch_id: "a", alerts: [], clients: {} }

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  params = new URLSearchParams()
  state.agent = { id: "s1", type: "stock_media_buying", status: "active", settings: { batches: [{ id: "a", name: "Batch A" }] }, scope: { client_group_ids: ["g1", "g2"] } }
  state.latest = { run: RUN, openCards: 2, error: null, isLoading: false, mutate: vi.fn() }
  state.runs = [RUN, OLD]
  state.report = {
    run: RUN,
    cards: [
      { id: "c1", client_group_id: "g1", client_name: "Aura", status: "open", can_apply: true, zone: "red", current_cpl: 9, leads: 3, lines: [line("l1")] },
      { id: "c2", client_group_id: "g2", client_name: "Glow", status: "open", can_apply: true, zone: "green", current_cpl: 2, leads: 9, lines: [line("l1"), line("l2")] },
    ],
  }
  state.month = { month: "2026-10", range: "1 Oct – 31 Oct", rows: [{ client_group_id: "g1", client_name: "Aura", leads: 3, spend: 30, cpl: 10, zone: "red", decided: 1 }], error: null, mutate: vi.fn() }
})

describe("Media Buying page", () => {
  it("old tab=scoreboard lands on Report", () => {
    params = new URLSearchParams("tab=scoreboard")
    render(<Page />)
    expect(screen.getByRole("tab", { name: "Report" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Scoreboard" })).not.toBeInTheDocument()
    expect(screen.getByTestId("sheet")).toBeVisible()
  })

  it("summary shows N to decide and omits zero parts", () => {
    render(<Page />)
    const line = screen.getByTestId("sheet-summary")
    expect(line).toHaveTextContent("2 to decide")
    expect(line).not.toHaveTextContent("stopped")
    expect(line).not.toHaveTextContent("soon")
  })

  it("picking a month sets ?month and shows Read-only line", async () => {
    const { unmount } = render(<Page />)
    const trigger = screen.getByRole("button", { name: /Report:/ })
    expect(trigger).toHaveTextContent("Mon 9 Nov · Batch A · Today")
    fireEvent.keyDown(trigger, { key: "Enter" })
    const menu = await screen.findByRole("menu")
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "October 2026" }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?month=2026-10")
    unmount()

    params = new URLSearchParams("month=2026-10")
    render(<Page />)
    const summary = screen.getByTestId("sheet-summary")
    expect(summary).toHaveTextContent("Read-only")
    expect(summary).toHaveTextContent("1 Oct – 31 Oct")
    expect(screen.getByRole("button", { name: /Report:/ })).toHaveTextContent("October 2026 · Whole month")
  })

  it("draft agent shows Finish setup", () => {
    state.agent = { ...state.agent, status: "draft" }
    state.latest = { run: null, openCards: 0, error: null, isLoading: false, mutate: vi.fn() }
    state.runs = []
    render(<Page />)
    expect(screen.getByRole("link", { name: "Finish setup" })).toHaveAttribute("href", "/hub/agents/media-buying/setup")
  })

  it("keeps the other panels mounted but hidden", () => {
    render(<Page />)
    expect(screen.getByTestId("lessons").closest("[role=tabpanel]")).not.toBeVisible()
    expect(screen.getByTestId("settings").closest("[role=tabpanel]")).not.toBeVisible()
  })
})

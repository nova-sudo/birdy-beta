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
const seen = {}
vi.mock("@/components/agents/stock/AgentSettings", () => ({
  AgentSettings: (props) => {
    seen.settings = props
    return <div data-testid="settings" data-section={props.section ?? ""} data-client={props.focusClient ?? ""} />
  },
  SettingsStatus: () => <div data-testid="settings-status" />,
}))
vi.mock("@/components/agents/stock/LessonsTab", () => ({
  LessonsTab: (props) => {
    seen.lessons = props
    return <div data-testid="lessons" />
  },
}))
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
  useCardChat: () => ({ sessionId: null, messages: [], isLoading: false }),
}))
vi.mock("@/components/chat/ChatConversation", () => ({ default: (props) => <div data-testid="chat" data-card={props.cardId}>{props.intro}{props.composerTop}</div> }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => null }))

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
    expect(screen.getByRole("table")).toBeVisible()
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Aura: open Birdy's chat" })).toBeInTheDocument()
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

  it("a ?client= link is taken off the URL once read", () => {
    params = new URLSearchParams("client=aura&tab=report")
    render(<Page />)
    expect(replace).toHaveBeenCalledWith("/hub/agents/media-buying?tab=report")
  })

  it("a row opens Birdy's chat on its card, and Skip moves to the next client to decide", () => {
    render(<Page />)
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Aura: open Birdy's chat" }))
    const dialog = screen.getByRole("dialog", { name: "Aura" })
    expect(within(dialog).getByTestId("chat")).toHaveAttribute("data-card", "c1")
    expect(within(dialog).getByText("2 left to decide")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Skip for now: Glow ›" }))
    expect(screen.getByRole("dialog", { name: "Glow" })).toBeInTheDocument()
  })

  it("Set targets switches to Settings on that client", () => {
    render(<Page />)
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Aura: open Birdy's chat" }))
    fireEvent.click(screen.getByRole("button", { name: "Set targets" }))
    expect(push).toHaveBeenCalledWith("/hub/agents/media-buying?tab=settings&section=clients&client=g1")
  })

  it("keeps the other panels mounted but hidden", () => {
    render(<Page />)
    expect(screen.getByTestId("lessons").closest("[role=tabpanel]")).not.toBeVisible()
    expect(screen.getByTestId("settings").closest("[role=tabpanel]")).not.toBeVisible()
  })

  it("Settings reads ?section and ?client, shows the status line, and a sub-tab pick replaces ?section", () => {
    params = new URLSearchParams("tab=settings&section=clients&client=g1")
    render(<Page />)
    const settings = screen.getByTestId("settings")
    expect(settings).toHaveAttribute("data-section", "clients")
    expect(settings).toHaveAttribute("data-client", "g1")
    expect(screen.getByTestId("settings-status")).toBeInTheDocument()
    seen.settings.onSection("schedule")
    expect(replace).toHaveBeenCalledWith("/hub/agents/media-buying?tab=settings&section=schedule")
  })

  it("the status line is only on Settings, and ?client= is not a settings focus on Report", () => {
    render(<Page />)
    expect(screen.queryByTestId("settings-status")).not.toBeInTheDocument()
    expect(screen.getByTestId("settings")).toHaveAttribute("data-client", "")
  })

  it("a lesson's source opens that client's chat on the Report tab", () => {
    params = new URLSearchParams("tab=lessons")
    render(<Page />)
    seen.lessons.onOpenCard("r0", "g2")
    expect(push).toHaveBeenLastCalledWith("/hub/agents/media-buying?run=r0&client=g2")
    seen.lessons.onOpenCard(null, "g1")
    expect(push).toHaveBeenLastCalledWith("/hub/agents/media-buying?client=g1")
  })
})

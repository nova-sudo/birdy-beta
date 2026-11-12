import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => <div data-testid="chat" data-page={props.page} data-agent={props.agentId} data-session={props.sessionKey} />,
}))

import { BookOpen, CalendarDays, PoundSterling, RefreshCw, TriangleAlert } from "lucide-react"
import { ConfirmHost } from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useStockActions } from "@/lib/stock-agent-api"
import { LessonsTab, lessonIcon, sourceLabel } from "../LessonsTab"

const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const CLIENTS = { g1: "Aura", g2: "Cloud Nine Beauty" }
const nameOf = (gid) => CLIENTS[gid] ?? "A client"

let lessons
function mockApi(path, init = {}) {
  const method = init.method ?? "GET"
  if (path === "/api/agents/ag1/lessons" && method === "GET") return Promise.resolve(res(lessons))
  const mem = /^\/api\/agents\/ag1\/memory\/(\w+)$/.exec(path)
  if (mem && method === "DELETE") {
    lessons = lessons.map((l) => (l.id === mem[1] ? { ...l, active: false } : l))
    return Promise.resolve(res({ ok: true }))
  }
  const verdict = /^\/api\/agents\/ag1\/lessons\/(\w+)\/(keep|overrule)$/.exec(path)
  if (verdict && method === "POST") {
    lessons = lessons.map((l) => (l.id === verdict[1] ? { ...l, status: verdict[2] === "overrule" ? "overruled" : "active", active: verdict[2] !== "overrule" } : l))
    return Promise.resolve(res(lessons.find((l) => l.id === verdict[1])))
  }
  return Promise.resolve(res({}, 404))
}
const calls = (path, method) => vi.mocked(apiRequest).mock.calls.filter(([p, init]) => p === path && (init?.method ?? "GET") === method)

function Tab({ onOpenCard }) {
  const actions = useStockActions("ag1")
  return <LessonsTab agentId="ag1" actions={actions} nameOf={nameOf} onOpenCard={onOpenCard} />
}
const renderTab = (props = {}) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fetcher }}>
      <ConfirmHost />
      <Tab {...props} />
    </SWRConfig>
  )

const L = (over) => ({ status: "active", active: true, source: "chat", created_at: "2026-10-21T08:00:00", uses: 0, last_used: [], ...over })

beforeEach(() => {
  lessons = [
    L({ id: "l1", text: "Don't remove an ad with under 3 days of spend", source: "dismiss", client_group_id: "g1", created_at: "2026-10-28T08:00:00", uses: 6, last_used: [{ run_id: "r1", card_id: "c1", client_group_id: "g1", at: "2026-11-02T07:00:00" }] }),
    L({ id: "l2", text: "New creative tests can go to £7 a lead", source: "edit", client_group_id: "g2", created_at: "2026-10-27T08:00:00", uses: 3 }),
    L({ id: "l3", text: "Check the CRM before flagging no leads", source: "chat", created_at: "2026-10-15T08:00:00", uses: 0 }),
  ]
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockImplementation(mockApi)
})

describe("LessonsTab", () => {
  it("header shows count and Teach Birdy", async () => {
    renderTab()
    expect(await screen.findByText("3 lessons. Birdy uses these on every run.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Teach Birdy" })).toBeInTheDocument()
  })

  it("row shows scope source date text and used count", async () => {
    renderTab()
    const row = (await screen.findByText("Don't remove an ad with under 3 days of spend")).closest("button")
    expect(row).toHaveTextContent("Aura · You overruled a change on Aura · 28 Oct")
    expect(row).toHaveTextContent("6× used")
    const all = screen.getByText("Check the CRM before flagging no leads").closest("button")
    expect(all).toHaveTextContent("All clients · You told Birdy in chat · 15 Oct")
  })

  it("lists newest first", async () => {
    renderTab()
    await screen.findByText("Check the CRM before flagging no leads")
    const rows = screen.getAllByRole("button", { name: /used|Not used yet/ })
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Don't remove"),
      expect.stringContaining("New creative"),
      expect.stringContaining("Check the CRM"),
    ])
  })

  it("Not used yet when uses 0", async () => {
    renderTab()
    const row = (await screen.findByText("Check the CRM before flagging no leads")).closest("button")
    expect(row).toHaveTextContent("Not used yet")
    expect(row).not.toHaveTextContent("used 0")
  })

  it("overruled behind toggle", async () => {
    lessons.push(L({ id: "l4", text: "Pause on Sundays", status: "overruled", active: false }))
    lessons.push(L({ id: "l5", text: "Removed already", active: false }))
    renderTab()
    expect(await screen.findByText("3 lessons. Birdy uses these on every run.")).toBeInTheDocument()
    expect(screen.queryByText("Pause on Sundays")).toBeNull()
    expect(screen.queryByText("Removed already")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Show 1 overruled" }))
    expect(screen.getByText("Pause on Sundays")).toBeInTheDocument()
    expect(screen.queryByText("Removed already")).toBeNull()
  })

  it("an empty list offers Teach Birdy", async () => {
    lessons = []
    renderTab()
    expect(await screen.findByText("No lessons yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Teach Birdy" })).toBeInTheDocument()
  })

  it("sheet remove confirms then calls removeLesson", async () => {
    renderTab()
    await userEvent.click((await screen.findByText("Don't remove an ad with under 3 days of spend")).closest("button"))
    const sheet = await screen.findByRole("dialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Remove" }))
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }))
    expect(calls("/api/agents/ag1/memory/l1", "DELETE")).toHaveLength(0)

    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }))
    await userEvent.click(await screen.findByRole("button", { name: "Remove lesson" }))
    await waitFor(() => expect(calls("/api/agents/ag1/memory/l1", "DELETE")).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText("Don't remove an ad with under 3 days of spend")).toBeNull())
  })

  it("sheet keeps and overrules", async () => {
    renderTab()
    await userEvent.click((await screen.findByText("New creative tests can go to £7 a lead")).closest("button"))
    const sheet = await screen.findByRole("dialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Keep" }))
    await waitFor(() => expect(calls("/api/agents/ag1/lessons/l2/keep", "POST")).toHaveLength(1))
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Overrule" }))
    await waitFor(() => expect(calls("/api/agents/ag1/lessons/l2/overrule", "POST")).toHaveLength(1))
  })

  it("sheet lists last uses and opens the card", async () => {
    const onOpenCard = vi.fn()
    renderTab({ onOpenCard })
    await userEvent.click((await screen.findByText("Don't remove an ad with under 3 days of spend")).closest("button"))
    const sheet = await screen.findByRole("dialog")
    await userEvent.click(within(sheet).getByRole("button", { name: /Aura · 2 Nov/ }))
    expect(onOpenCard).toHaveBeenCalledWith("r1", "g1")
  })

  it("Teach Birdy opens the stock_lessons chat", async () => {
    renderTab()
    await userEvent.click(await screen.findByRole("button", { name: "Teach Birdy" }))
    const chat = await screen.findByTestId("chat")
    expect(chat).toHaveAttribute("data-page", "stock_lessons")
    expect(chat).toHaveAttribute("data-agent", "ag1")
    expect(chat).toHaveAttribute("data-session", "stock_lessons:ag1")
  })
})

describe("sourceLabel", () => {
  it("sourceLabel maps every source", () => {
    expect(sourceLabel({ source: "chat" }, nameOf)).toBe("You told Birdy in chat")
    expect(sourceLabel({ source: "edit" }, nameOf)).toBe("You edited a card")
    expect(sourceLabel({ source: "dismiss", client_group_id: "g1" }, nameOf)).toBe("You overruled a change on Aura")
    expect(sourceLabel({ source: "slack_mention" }, nameOf)).toBe("Your comment in Slack")
    expect(sourceLabel({ source: "promoted" }, nameOf)).toBe("From your results")
    expect(sourceLabel({ source: "chat_edit" }, nameOf)).toBe("You changed it in chat")
    expect(sourceLabel({ source: "overrule" }, nameOf)).toBe("Added by Birdy")
    expect(sourceLabel({}, nameOf)).toBe("Added by Birdy")
  })
})

describe("lessonIcon", () => {
  it("picks an icon from the lesson", () => {
    expect(lessonIcon({ text: "Don't remove an ad with under 3 days of spend" })).toBe(TriangleAlert)
    expect(lessonIcon({ text: "Don't turn back on an ad older than 90 days" })).toBe(RefreshCw)
    expect(lessonIcon({ text: "New creative tests can go to £7 a lead" })).toBe(PoundSterling)
    expect(lessonIcon({ text: "Leave Body Sculpting running through weekends" })).toBe(CalendarDays)
    expect(lessonIcon({ text: "Anything", filter: { weekdays: [5, 6] } })).toBe(CalendarDays)
    expect(lessonIcon({ text: "Check the CRM before flagging no leads" })).toBe(BookOpen)
  })
})

// The Agency chat thread with route maps. The thread lives in components/agency/chat;
// its test sits with the kit's because the map and the part are kit components.
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { ChatThread } from "@/components/agency/chat/thread"

const ROUTE = {
  status: "done", seconds: 34, credits: 18, limit_hit: null,
  steps: [
    { id: "s1", agent: "sales_coach", name: "Sales Coach", kind: "main", status: "done", summary: "212 calls checked", question: null, asked_by: null, tools: [], answer: null, credits: 7, seconds: 11 },
    { id: "s2", agent: "birdy", name: "Birdy", kind: "orchestrator", status: "done", summary: "Chose Marketing Guru", question: "Did leads change?", asked_by: "s1", tools: [], answer: null, credits: 2, seconds: 3 },
    {
      id: "s3", agent: "media_buyer", name: "Marketing Guru", kind: "main", status: "done", summary: "6 campaigns checked", question: "Did the leads change?", asked_by: "s2",
      tools: [{ name: "leads_by_ad", label: "Leads by ad", detail: "84 leads" }], answer: "The form was swapped on Tuesday.", credits: 9, seconds: 20,
    },
  ],
}

const chatWith = (over) => ({
  messages: [], loading: false, route: null, send: () => {}, submitUI: () => {}, submittedUIs: [], configured: true, outOfCredits: false, ...over,
})

describe("ChatThread with route maps", () => {
  it("leaves a reply without a route as it was", () => {
    render(<ChatThread name="Birdy" chat={chatWith({ messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello there" }] })} />)
    expect(screen.getByText("Hello there")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Agents in this reply" })).not.toBeInTheDocument()
  })

  it("puts the map above a reply that has a route and opens an agent's part under it", async () => {
    render(<ChatThread name="Sales Coach" partPlacement="inline" chat={chatWith({ messages: [{ role: "user", content: "Why?" }, { role: "assistant", content: "The leads changed.", route: ROUTE }] })} />)
    const map = screen.getByRole("group", { name: "Agents in this reply" })
    expect(map.compareDocumentPosition(screen.getByText("The leads changed.")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const box = screen.getByRole("button", { name: /^Marketing Guru/ })
    await userEvent.click(box)
    expect(box).toHaveAttribute("aria-pressed", "true")
    const part = screen.getByRole("region", { name: "Marketing Guru’s part" })
    expect(within(part).getByText("The form was swapped on Tuesday.")).toBeInTheDocument()
    await userEvent.click(within(part).getByRole("button", { name: "Close Marketing Guru’s part" }))
    expect(screen.queryByRole("region", { name: "Marketing Guru’s part" })).not.toBeInTheDocument()
    expect(box).toHaveFocus()
  })

  it("opens the part in a side panel on the full chat page", async () => {
    render(<ChatThread name="Sales Coach" partPlacement="side" chat={chatWith({ messages: [{ role: "user", content: "Why?" }, { role: "assistant", content: "The leads changed.", route: ROUTE }] })} />)
    await userEvent.click(screen.getByRole("button", { name: /^Birdy/ }))
    const panel = screen.getByRole("complementary", { name: "Agent’s part" })
    expect(within(panel).getByRole("region", { name: "Birdy’s part" })).toBeInTheDocument()
    expect(within(panel).getByText("Sales Coach asked")).toBeInTheDocument()
    // Pressing the open agent again closes it.
    await userEvent.click(screen.getByRole("button", { name: /^Birdy/ }))
    expect(screen.queryByRole("complementary", { name: "Agent’s part" })).not.toBeInTheDocument()
  })

  it("shows the live map instead of the typing dots while agents work, and keeps the open part when the reply lands", async () => {
    const live = { ...ROUTE, status: "working", credits: 0, seconds: 12, steps: [ROUTE.steps[0], ROUTE.steps[1], { ...ROUTE.steps[2], status: "working", answer: null }] }
    const messages = [{ role: "user", content: "Why?" }]
    const view = render(<ChatThread name="Sales Coach" partPlacement="inline" chat={chatWith({ messages, loading: true, route: live })} />)
    expect(screen.queryByRole("status", { name: "Sales Coach is replying" })).not.toBeInTheDocument()
    expect(screen.getByText("Working")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^Marketing Guru/ }))
    expect(screen.getByText("Still working on it.")).toBeInTheDocument()
    view.rerender(<ChatThread name="Sales Coach" partPlacement="inline" chat={chatWith({ messages: [...messages, { role: "assistant", content: "Done.", route: ROUTE }] })} />)
    expect(screen.getByText("The form was swapped on Tuesday.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Marketing Guru/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("shows the typing dots while no other agent is involved", () => {
    render(<ChatThread name="Birdy" chat={chatWith({ messages: [{ role: "user", content: "Hi" }], loading: true })} />)
    expect(screen.getByRole("status", { name: "Birdy is replying" })).toBeInTheDocument()
  })

  it("stacks the map in the narrow side conversation", () => {
    const { container } = render(<ChatThread name="Birdy" compact chat={chatWith({ messages: [{ role: "assistant", content: "Ok", route: ROUTE }] })} />)
    expect(container.querySelector("[data-layout]")).toHaveAttribute("data-layout", "stacked")
  })

  it("tells the page how the thread moved for a docked part, so the composer can follow, and when it closes", async () => {
    const onDock = vi.fn()
    const { container } = render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}>
        <div data-testid="box" style={{ paddingLeft: "28px", paddingRight: "28px" }}>
          <ChatThread name="Birdy" onDock={onDock} chat={chatWith({ messages: [{ role: "user", content: "Why?" }, { role: "assistant", content: "The leads changed.", route: ROUTE }] })} />
        </div>
      </div>,
    )
    const scroller = container.querySelector("[data-testid=scroller]")
    const box = container.querySelector("[data-testid=box]")
    Object.defineProperty(scroller, "clientWidth", { value: 1100 })
    Object.defineProperty(scroller, "offsetWidth", { value: 1115 })
    Object.defineProperty(scroller, "clientHeight", { value: 700 })
    scroller.getBoundingClientRect = () => ({ left: 300, top: 80, right: 1415, bottom: 780, width: 1115, height: 700 })
    box.getBoundingClientRect = () => ({ left: 450, top: 80, right: 1250, bottom: 780, width: 800, height: 700 })
    await userEvent.click(screen.getByRole("button", { name: /^Marketing Guru/ }))
    expect(screen.getByRole("complementary", { name: "Agent’s part" })).toBeInTheDocument()
    // Dock left edge 1400 - 340 = 1060; the column's right (1222) must clear 1036, moving left first (by 154).
    expect(onDock).toHaveBeenLastCalledWith({ shift: 154, pad: 186, gutter: 15 })
    await userEvent.click(screen.getByRole("button", { name: /^Marketing Guru/ }))
    expect(onDock).toHaveBeenLastCalledWith(null)
  })

  it("leaves the map out when asked, and shows one thinking line while it works", () => {
    const messages = [{ role: "user", content: "Why?" }, { role: "assistant", content: "The leads changed.", route: ROUTE }]
    const view = render(<ChatThread name="Marketing Guru" routeMap={false} bubbles chat={chatWith({ messages })} />)
    expect(screen.getByText("The leads changed.")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Agents in this reply" })).not.toBeInTheDocument()
    view.rerender(<ChatThread name="Marketing Guru" routeMap={false} bubbles chat={chatWith({ messages: messages.slice(0, 1), loading: true, route: ROUTE })} />)
    expect(screen.queryByRole("group", { name: "Agents in this reply" })).not.toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Marketing Guru is replying" })).toBeInTheDocument()
    expect(screen.getByText("Thinking")).toBeInTheDocument()
  })

  it("keeps the map by default", () => {
    render(<ChatThread name="Marketing Guru" chat={chatWith({ messages: [{ role: "user", content: "Why?" }, { role: "assistant", content: "The leads changed.", route: ROUTE }] })} />)
    expect(screen.getByRole("group", { name: "Agents in this reply" })).toBeInTheDocument()
  })
})

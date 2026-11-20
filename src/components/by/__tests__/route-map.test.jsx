import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { AgentPart, RouteMap } from ".."

const step = (over) => ({ id: "s1", agent: "sales_coach", name: "Sales Coach", kind: "main", status: "done", summary: "212 calls checked", question: null, asked_by: null, tools: [], answer: null, credits: 0, seconds: 0, ...over })
const DONE = {
  status: "done", seconds: 34, credits: 18, limit_hit: null,
  steps: [
    step({ question: "Why did booked calls drop?" }),
    step({ id: "s2", agent: "birdy", name: "Birdy", kind: "orchestrator", summary: "Chose Media Buyer", asked_by: "s1" }),
    step({
      id: "s3", agent: "media_buyer", name: "Media Buyer", summary: "6 campaigns checked", asked_by: "s2", question: "Did the leads change?",
      tools: [{ name: "a", label: "Campaign results, 7 days", detail: "6 campaigns" }, { name: "b", label: "Leads by ad", detail: null }],
      answer: "The Spring Promo form was swapped.", credits: 9, seconds: 20,
    }),
  ],
}

describe("RouteMap", () => {
  it("draws one button per agent with its summary, and the footer", () => {
    const { container } = render(<RouteMap route={DONE} />)
    const group = screen.getByRole("group", { name: "Agents in this reply" })
    expect(within(group).getAllByRole("button")).toHaveLength(3)
    // The mascot is decorative, so its glyphs stay out of the names.
    within(group).getByRole("button", { name: /^Sales Coach\s*212 calls checked\s*, Done$/ })
    within(group).getByRole("button", { name: /^Birdy\s*Chose Media Buyer\s*, Done$/ })
    within(group).getByRole("button", { name: /^Media Buyer\s*6 campaigns checked\s*, Done$/ })
    expect(screen.getByText("Answer came back to Sales Coach")).toBeInTheDocument()
    expect(screen.getByText("34s · 18 credits")).toBeInTheDocument()
    // Birdy only ever appears in its round frame.
    expect(container.querySelectorAll(".rounded-full.border").length).toBeGreaterThan(0)
  })

  it("draws nothing without a route", () => {
    const { container } = render(<RouteMap route={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("reports presses and marks the open agent with aria-pressed, by click and keyboard", async () => {
    const onSelect = vi.fn()
    const view = render(<RouteMap route={DONE} selected={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole("button", { name: /^Media Buyer/ }))
    expect(onSelect).toHaveBeenLastCalledWith("s3")
    view.rerender(<RouteMap route={DONE} selected="s3" onSelect={onSelect} />)
    const open = screen.getByRole("button", { name: /^Media Buyer/ })
    expect(open).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /^Birdy/ })).toHaveAttribute("aria-pressed", "false")
    open.focus()
    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenLastCalledWith(null)
    await userEvent.tab({ shift: true })
    await userEvent.keyboard(" ")
    expect(onSelect).toHaveBeenLastCalledWith("s2")
  })

  it("moves the line into the agent at work, and says who is working", () => {
    const working = { ...DONE, status: "working", credits: 0, seconds: 12, steps: [DONE.steps[0], DONE.steps[1], { ...DONE.steps[2], status: "working", summary: "Checking lead forms…" }] }
    const { container } = render(<RouteMap route={working} />)
    const wires = container.querySelectorAll('[role="group"] > span[aria-hidden="true"]')
    expect(wires).toHaveLength(2)
    expect(wires[0].className).not.toMatch(/by-flow/)
    // The moving dashes are motion-safe only, so "reduce motion" keeps them still.
    expect(wires[1].className).toMatch(/motion-safe:animate-\[by-flow/)
    expect(screen.getByRole("button", { name: /^Media Buyer.*Working/ })).toBeInTheDocument()
    expect(screen.getByText("Working")).toBeInTheDocument()
    expect(screen.getByText("12s")).toBeInTheDocument()
  })

  it("shows failed and skipped agents in words, not colour alone, and a limit in a sentence", () => {
    const failed = {
      ...DONE, status: "failed", limit_hit: "asks",
      steps: [DONE.steps[0], { ...DONE.steps[2], status: "failed", summary: "Timed out" }, step({ id: "s4", agent: "sub:x", name: "Form checker", kind: "sub", status: "skipped", summary: "" })],
    }
    render(<RouteMap route={failed} />)
    expect(screen.getByText("Couldn’t finish · Timed out")).toBeInTheDocument()
    expect(screen.getByText("Skipped")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Form checker.*Skipped, sub-agent of Media Buyer/ })).toBeInTheDocument()
    expect(screen.getByText("Stopped")).toBeInTheDocument()
    expect(screen.getByText(/limit of 3 agent asks/)).toBeInTheDocument()
  })

  it("stacks when asked to, and fits four agents in a row", () => {
    const four = { ...DONE, steps: [...DONE.steps, step({ id: "s4", agent: "sub:x", name: "Form checker", kind: "sub", asked_by: "s3" })] }
    const { container, rerender } = render(<RouteMap route={four} layout="stacked" />)
    expect(container.firstChild).toHaveAttribute("data-layout", "stacked")
    rerender(<RouteMap route={four} />)
    expect(container.firstChild).toHaveAttribute("data-layout", "row")
    expect(screen.getAllByRole("button")).toHaveLength(4)
  })

  it("picks the stacked layout by itself in a narrow container", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(380)
    const { container } = render(<RouteMap route={DONE} />)
    expect(container.firstChild).toHaveAttribute("data-layout", "stacked")
    spy.mockReturnValue(900)
    const wide = render(<RouteMap route={DONE} />)
    expect(wide.container.firstChild).toHaveAttribute("data-layout", "row")
    spy.mockRestore()
  })
})

describe("AgentPart", () => {
  it("shows who asked what, the tools with their detail, the answer, its share and a link to its chat", () => {
    render(<AgentPart route={DONE} stepId="s3" />)
    const part = screen.getByRole("region", { name: "Media Buyer’s part" })
    expect(within(part).getByText("Birdy asked")).toBeInTheDocument()
    expect(within(part).getByText("Did the leads change?")).toBeInTheDocument()
    const tools = within(part).getAllByRole("listitem")
    expect(tools.map((t) => t.textContent)).toEqual(["Campaign results, 7 days6 campaigns", "Leads by ad"])
    expect(within(part).getByText("The Spring Promo form was swapped.")).toBeInTheDocument()
    expect(within(part).getByText("Done · 20s · 9 credits")).toBeInTheDocument()
    expect(within(part).getByRole("link", { name: /Open Media Buyer’s chat/ })).toHaveAttribute("href", "/media-buyer/chat")
  })

  it("says 'You asked' for the first agent, and closes with the button or Escape", async () => {
    const onClose = vi.fn()
    render(<AgentPart route={DONE} stepId="s1" onClose={onClose} />)
    expect(screen.getByText("You asked")).toBeInTheDocument()
    expect(screen.getByText("No tools used")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Close Sales Coach’s part" }))
    expect(onClose).toHaveBeenCalledTimes(1)
    screen.getByRole("link").focus()
    await userEvent.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("names a sub-agent's main agent and links to that chat", () => {
    const route = { ...DONE, steps: [...DONE.steps, step({ id: "s4", agent: "sub:x", name: "Form checker", kind: "sub", asked_by: "s3", question: "Which form changed?" })] }
    render(<AgentPart route={route} stepId="s4" />)
    expect(screen.getByText("Sub-agent of Media Buyer")).toBeInTheDocument()
    expect(screen.getByText("Media Buyer asked")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open Media Buyer’s chat/ })).toHaveAttribute("href", "/media-buyer/chat")
  })

  it("links a sub-agent to its row on its main agent's Context page", () => {
    const route = { ...DONE, steps: [...DONE.steps, step({ id: "s4", agent: "sub:fc1", name: "Form checker", kind: "sub", asked_by: "s3" })] }
    render(<AgentPart route={route} stepId="s4" />)
    expect(screen.getByRole("link", { name: /See Form checker in Context/ })).toHaveAttribute("href", "/media-buyer/context#sub-agent-fc1")
  })

  it("says why a skipped agent was not asked, from the route's limit", () => {
    const route = { ...DONE, limit_hit: "asks", steps: [...DONE.steps, step({ id: "s4", agent: "sub:fc1", name: "Form checker", kind: "sub", asked_by: "s3", status: "skipped", summary: "Not asked: limit of 3 asks" })] }
    render(<AgentPart route={route} stepId="s4" />)
    expect(screen.getByText("Why it was skipped")).toBeInTheDocument()
    expect(screen.getByText(/Form checker wasn’t asked because this reply had already used its 3 agent asks/)).toBeInTheDocument()
    expect(screen.queryByText("This agent was not asked in the end.")).toBeNull()
  })

  it("says why an agent stopped, from its own data", () => {
    const route = { ...DONE, steps: [DONE.steps[0], { ...DONE.steps[2], status: "failed", summary: "Ran out of time", answer: null, seconds: 100 }] }
    render(<AgentPart route={route} stepId="s3" />)
    expect(screen.getByText("Why it stopped")).toBeInTheDocument()
    expect(screen.getByText(/Media Buyer ran out of time after 1m 40s before it could answer/)).toBeInTheDocument()
  })

  it("draws nothing for an unknown agent", () => {
    const { container } = render(<AgentPart route={DONE} stepId="nope" />)
    expect(container).toBeEmptyDOMElement()
  })
})

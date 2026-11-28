import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { AgentPart, RouteMap } from ".."

const step = (over) => ({ id: "s1", agent: "birdy", name: "Birdy", kind: "orchestrator", status: "done", summary: "", question: null, asked_by: null, tools: [], answer: null, credits: 0, seconds: 0, ...over })
const SLACK_TOOLS = [
  { name: "list_report_metrics", label: "Report metrics", kind: "slack" },
  { name: "list_slack_channels", label: "Checking channels", kind: "slack" },
]

describe("Slack on the route map (2A)", () => {
  it("draws a live Slack stop after the agent while it works in Slack, with the line into it moving", () => {
    const route = {
      status: "working", seconds: 6, credits: 0, limit_hit: null,
      steps: [step({ status: "working", summary: "Picked CPL, leads, spend", tools: [{ name: "get_daily_metrics", label: "Daily results" }, ...SLACK_TOOLS, { name: "preview_report", label: "Building the preview", kind: "slack" }], doing: "Building the preview", doing_kind: "slack" })],
    }
    const { container } = render(<RouteMap route={route} />)
    const group = screen.getByRole("group", { name: "Agents in this reply" })
    const boxes = within(group).getAllByRole("button")
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toHaveTextContent("Picked CPL, leads, spend")
    expect(boxes[1]).toHaveAccessibleName(/^Slack\s*Building the preview…\s*, Working, Birdy’s work in Slack$/)
    // The Slack box is the one highlighted, not the agent.
    expect(boxes[1].className).toMatch(/bg-by-sunken/)
    expect(boxes[0].className).not.toMatch(/bg-by-ops-bg/)
    expect(container.querySelector(".lucide-hash")).not.toBeNull()
    expect(container.querySelector("[class*='animate-[by-flow']")).not.toBeNull()
    expect(screen.getByText("Birdy is building the preview in Slack")).toBeInTheDocument()
  })

  it("after a delegated agent, the Slack stop follows that agent", () => {
    const route = {
      status: "working", seconds: 20, credits: 0, limit_hit: null,
      steps: [
        step({ summary: "Asked Marketing Guru" }),
        step({ id: "s2", agent: "media_buyer", name: "Marketing Guru", kind: "main", status: "working", asked_by: "s1", summary: "Picked campaign metrics", tools: SLACK_TOOLS, doing: "Checking channels", doing_kind: "slack" }),
      ],
    }
    render(<RouteMap route={route} />)
    const boxes = within(screen.getByRole("group", { name: "Agents in this reply" })).getAllByRole("button")
    expect(boxes).toHaveLength(3)
    expect(boxes[0]).toHaveAccessibleName(/^Birdy\s*Asked Marketing Guru/)
    expect(boxes[1]).toHaveAccessibleName(/^Marketing Guru\s*Picked campaign metrics/)
    expect(boxes[2]).toHaveAccessibleName(/^Slack\s*Checking channels…\s*, Working, Marketing Guru’s work in Slack$/)
    expect(screen.getByText("Marketing Guru is checking channels in Slack")).toBeInTheDocument()
  })

  it("between Slack tools the agent is live again and the Slack stop shows what it did", () => {
    const route = { status: "working", seconds: 4, credits: 0, limit_hit: null, steps: [step({ status: "working", tools: SLACK_TOOLS, doing: "Daily results", doing_kind: null })] }
    const { container } = render(<RouteMap route={route} />)
    const boxes = within(screen.getByRole("group", { name: "Agents in this reply" })).getAllByRole("button")
    expect(boxes[0]).toHaveTextContent("Looking at daily results…")
    expect(boxes[1]).toHaveTextContent("Report metrics · Checked channels")
    // No line moves into an agent that is first; the Slack stop is done.
    expect(container.querySelector("[class*='animate-[by-flow']")).toBeNull()
  })

  it("a finished reply shows a done Slack stop that opens its Slack steps", async () => {
    const route = {
      status: "done", seconds: 30, credits: 4, limit_hit: null,
      steps: [step({ summary: "Made the report", tools: [{ name: "get_daily_metrics", label: "Daily results" }, { name: "preview_report", label: "Building the preview", kind: "slack" }, { name: "list_slack_channels", label: "Checking channels", kind: "slack" }] })],
    }
    const onSelect = vi.fn()
    render(<RouteMap route={route} onSelect={onSelect} />)
    const slack = screen.getByRole("button", { name: /^Slack/ })
    expect(slack).toHaveTextContent("Built the preview · Checked channels")
    expect(slack).toHaveAccessibleName(/, Done, Birdy’s work in Slack$/)
    await userEvent.click(slack)
    expect(onSelect).toHaveBeenCalledWith("s1:slack")

    render(<AgentPart route={route} stepId="s1:slack" />)
    const part = screen.getByRole("region", { name: "Birdy in Slack" })
    expect(within(part).getByText("Slack steps")).toBeInTheDocument()
    expect(within(part).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Building the preview", "Checking channels"])
    expect(within(part).queryByText(/answered/)).toBeNull()
    expect(within(part).getByRole("link", { name: /Open Birdy’s chat/ })).toHaveAttribute("href", "/dashboard/chat")
  })

  it("stacks with the Slack stop under its agent", () => {
    const route = { status: "done", seconds: 3, credits: 0, limit_hit: null, steps: [step({ tools: [{ name: "list_slack_reports", label: "Slack reports" }] })] }
    const { container } = render(<RouteMap route={route} layout="stacked" />)
    expect(container.firstChild).toHaveAttribute("data-layout", "stacked")
    expect(within(screen.getByRole("group", { name: "Agents in this reply" })).getAllByRole("button")).toHaveLength(2)
    expect(screen.getByRole("button", { name: /^Slack\s*Slack reports/ })).toBeInTheDocument()
  })

  it("an agent that never touched Slack has no Slack stop", () => {
    render(<RouteMap route={{ status: "done", steps: [step({ tools: [{ name: "get_daily_metrics", label: "Daily results" }] })] }} />)
    expect(screen.queryByRole("button", { name: /^Slack/ })).toBeNull()
  })
})

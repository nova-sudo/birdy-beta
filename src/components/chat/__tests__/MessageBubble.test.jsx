// The dashboards chat's replies say what they changed on the dashboard (or
// why they couldn't), under the answer itself.
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MessageBubble from "@/components/chat/MessageBubble"

const reply = (extra) => ({ role: "assistant", content: "Done.", tools_used: [], ...extra })

describe("MessageBubble dashboard changes", () => {
  it("lists the diff when the ops were applied", () => {
    render(
      <MessageBubble
        message={reply({
          dashboard_ops: [{ op: "setTitle", title: "B" }],
          dashboard_applied: true,
          dashboard_diff: ['Renamed dashboard "A" → "B"', 'Added kpi "Spend"'],
        })}
        messageIndex={1}
      />,
    )

    const block = screen.getByRole("status", { name: "Updated your dashboard" })
    expect(block).toHaveTextContent('Renamed dashboard "A" → "B"')
    expect(block).toHaveTextContent('Added kpi "Spend"')
  })

  it("says why when the ops could not be applied", () => {
    render(
      <MessageBubble
        message={reply({
          dashboard_ops: [{ op: "removeWidget", widgetId: "x" }],
          dashboard_applied: false,
          dashboard_diff: [],
          dashboard_error: 'No widget with id "x"',
        })}
        messageIndex={1}
      />,
    )

    const block = screen.getByRole("status", { name: "Couldn't apply these changes" })
    expect(block).toHaveTextContent('No widget with id "x"')
  })

  it("shows nothing extra for an ordinary reply", () => {
    render(<MessageBubble message={reply()} messageIndex={1} />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("offers Undo on an applied reply and calls back once", async () => {
    const user = userEvent.setup()
    const onUndo = vi.fn(() => true)
    const message = reply({ dashboard_ops: [{ op: "setTitle", title: "B" }], dashboard_applied: true, dashboard_diff: ["x"] })
    render(<MessageBubble message={message} messageIndex={1} onUndoDashboardOps={onUndo} />)

    await user.click(screen.getByRole("button", { name: "Undo" }))

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
    expect(screen.getByText("Undone")).toBeInTheDocument()
  })

  it("explains when Undo is blocked by newer edits", async () => {
    const user = userEvent.setup()
    const message = reply({ dashboard_ops: [{ op: "setTitle", title: "B" }], dashboard_applied: true, dashboard_diff: ["x"] })
    render(<MessageBubble message={message} messageIndex={1} onUndoDashboardOps={() => false} />)

    await user.click(screen.getByRole("button", { name: "Undo" }))

    expect(screen.getByText(/Newer edits came after this change/)).toBeInTheDocument()
  })

  it("has no Undo without the callback or when nothing was applied", () => {
    const { rerender } = render(
      <MessageBubble message={reply({ dashboard_ops: [{ op: "x" }], dashboard_applied: true, dashboard_diff: [] })} messageIndex={1} />,
    )
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
    rerender(
      <MessageBubble
        message={reply({ dashboard_ops: [{ op: "x" }], dashboard_applied: false, dashboard_diff: [] })}
        messageIndex={1}
        onUndoDashboardOps={() => true}
      />,
    )
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })
})

// The dashboards chat's replies say what they changed on the dashboard (or
// why they couldn't), under the answer itself.
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
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
})

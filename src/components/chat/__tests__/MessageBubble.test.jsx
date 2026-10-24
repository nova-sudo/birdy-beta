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

// What the backend's render_ui tool writes into a reply (one line of JSON per
// block). The chat must draw these, not print them.
describe("MessageBubble inline visuals", () => {
  const blocks = [
    'Spend is up and CPL is down.',
    ':::metric\n{"label":"Cost per lead","value":14.2,"format":"currency","currency":"£","deltaPct":-12.5,"deltaLabel":"vs previous 30 days","polarity":"lower","sparkline":[18,16,15,14.2]}\n:::',
    ':::stats\n[{"label":"Spend","value":4210,"format":"currency","currency":"£","deltaPct":8.1},{"label":"Leads","value":296,"format":"integer","deltaPct":0}]\n:::',
    ':::chart\n{"type":"composed","title":"Ad spend vs CPL","subtitle":"All clients · last 3 days","format":"currency","currency":"£","data":[{"label":"Oct 1","spend":120.5,"cpl":14.1},{"label":"Oct 2","spend":98,"cpl":12.25}],"series":[{"key":"spend","name":"Ad spend","type":"bar","axis":"left","format":"currency","currency":"£"},{"key":"cpl","name":"CPL","type":"line","axis":"right","format":"currency","currency":"£"}],"sort":false}\n:::',
    'Most of the drop came from Aura.',
  ].join("\n\n")

  it("renders the KPI card, KPI row and chart instead of raw JSON", () => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    const { container } = render(<MessageBubble message={reply({ content: blocks })} messageIndex={1} />)

    expect(container).not.toHaveTextContent(":::")
    expect(container).not.toHaveTextContent('"deltaPct"')
    expect(screen.getByText("Cost per lead")).toBeInTheDocument()
    // CPL fell and lower is better, so the pill reads as an improvement.
    const pill = screen.getAllByText("12.5%")[0].closest("span")
    expect(pill.className).toContain("text-success-ink")
    expect(screen.getByText("Spend")).toBeInTheDocument()
    expect(screen.getByText("0%")).toBeInTheDocument()
    expect(screen.getByRole("figure", { name: "Ad spend vs CPL" })).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Legend" })).toHaveTextContent("Ad spendCPL(right)")
    expect(screen.getByText("Most of the drop came from Aura.")).toBeInTheDocument()
  })
})

describe("MessageBubble ds bubbles", () => {
  it("renders the user's message as an ink bubble and Birdy's as an unboxed reply", () => {
    const { container, rerender } = render(
      <MessageBubble message={{ role: "user", content: "How is CPL?" }} messageIndex={0} />,
    )
    const user = container.querySelector('[data-ds="message-bubble"][data-role="user"]')
    expect(user).toHaveTextContent("How is CPL?")
    expect(user.firstElementChild.className).toContain("bg-foreground")

    rerender(<MessageBubble message={reply({ content: "Down 12%." })} messageIndex={1} />)
    expect(container.querySelector('[data-ds="message-bubble"][data-role="assistant"]')).toHaveTextContent("Down 12%.")
  })
})

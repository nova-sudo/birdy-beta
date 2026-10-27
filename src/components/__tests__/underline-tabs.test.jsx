import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UnderlineTabs } from "@/components/portfolio"

function Icon() {
  return <svg data-testid="glyph" />
}

const TABS = [
  { key: "overview", label: "Overview", icon: Icon },
  { key: "ask-birdy", label: "Ask Birdy", icon: Icon },
  { key: "marketing", label: "Marketing" },
]

const setup = (value = "overview", onChange = () => {}) =>
  render(
    <UnderlineTabs
      tabs={TABS}
      value={value}
      onChange={onChange}
      label="Client workspace"
      panelId="client-panel"
    />
  )

describe("UnderlineTabs", () => {
  it("exposes one tab per entry under a named tablist", () => {
    setup()

    expect(screen.getByRole("tablist", { name: "Client workspace" })).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /Marketing/ })).toHaveAttribute("aria-selected", "false")
  })

  it("marks the selected tab with the rule and leaves the rest transparent", () => {
    // The handoff's whole treatment: a 2px purple rule under the tab you're on.
    setup("ask-birdy")

    expect(screen.getByRole("tab", { name: /Ask Birdy/ })).toHaveClass(
      "border-pd-primary", "text-pd-ink"
    )
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveClass(
      "border-transparent", "text-pd-subtle"
    )
  })

  it("renders a leading glyph only where a tab brings one", () => {
    setup()
    expect(screen.getAllByTestId("glyph")).toHaveLength(2)
  })

  it("reports the tab that was picked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setup("overview", onChange)

    await user.click(screen.getByRole("tab", { name: /Marketing/ }))
    expect(onChange).toHaveBeenCalledWith("marketing")
  })

  it("keeps only the selected tab in the tab order", () => {
    // Roving tabindex: one stop for the whole strip, then arrows within it.
    setup("marketing")

    expect(screen.getByRole("tab", { name: /Marketing/ })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("tabindex", "-1")
  })

  it("moves between tabs with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    setup("overview", onChange)

    const first = screen.getByRole("tab", { name: /Overview/ })
    first.focus()

    await user.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("ask-birdy")

    onChange.mockClear()
    await user.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenCalledWith("marketing")

    onChange.mockClear()
    await user.keyboard("{End}")
    expect(onChange).toHaveBeenCalledWith("marketing")
  })

  it("points every tab at the region it swaps", () => {
    setup()
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-controls", "client-panel")
    }
  })
})

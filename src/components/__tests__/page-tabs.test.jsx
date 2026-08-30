import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PageTabs } from "@/components/portfolio"

const TABS = [
  { key: "active", label: "Active Alerts", badge: 3 },
  { key: "triggered", label: "Triggered", badge: 2, badgeClassName: "bg-red-100 text-red-600" },
  { key: "paused", label: "Snoozed / Paused" },
]

const badgeFor = (name) =>
  screen.getByRole("tab", { name: new RegExp(name) }).querySelector("span:last-child")

describe("PageTabs", () => {
  it("renders one tab per entry, marking the active one", () => {
    render(<PageTabs tabs={TABS} value="triggered" onChange={() => {}} label="Alert state" />)

    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { name: /Triggered/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /Active Alerts/ })).toHaveAttribute("aria-selected", "false")
  })

  it("reports the tab that was picked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PageTabs tabs={TABS} value="active" onChange={onChange} label="Alert state" />)

    await user.click(screen.getByRole("tab", { name: /Snoozed/ }))
    expect(onChange).toHaveBeenCalledWith("paused")
  })

  it("shows no badge for a tab that has none", () => {
    // Alerts passes `count || undefined`, so a zero count renders nothing
    // rather than a "0" chip on an empty state.
    render(<PageTabs tabs={TABS} value="active" onChange={() => {}} label="Alert state" />)

    expect(screen.getByRole("tab", { name: /Snoozed/ })).not.toHaveTextContent("0")
    expect(badgeFor("Active Alerts")).toHaveTextContent("3")
  })

  it("keeps a semantic badge colour instead of tinting it by selection", () => {
    // Red on Triggered carries meaning; it must not become the strip's purple
    // just because the tab happens to be the one you're on, nor go neutral
    // when it isn't.
    const { rerender } = render(
      <PageTabs tabs={TABS} value="triggered" onChange={() => {}} label="Alert state" />
    )
    expect(badgeFor("Triggered")).toHaveClass("bg-red-100", "text-red-600")

    rerender(<PageTabs tabs={TABS} value="active" onChange={() => {}} label="Alert state" />)
    expect(badgeFor("Triggered")).toHaveClass("bg-red-100", "text-red-600")
  })

  it("tints an unopinionated badge by whether its tab is selected", () => {
    const { rerender } = render(
      <PageTabs tabs={TABS} value="active" onChange={() => {}} label="Alert state" />
    )
    expect(badgeFor("Active Alerts")).toHaveClass("bg-pd-primary-tint", "text-pd-primary")

    rerender(<PageTabs tabs={TABS} value="paused" onChange={() => {}} label="Alert state" />)
    expect(badgeFor("Active Alerts")).toHaveClass("bg-pd-neutral-badge", "text-pd-subtle")
  })

  it("uses the one page-tab scale rather than each page's own", () => {
    // The drift PageTabs exists to stop: Metrics had been passing 20/9 padding
    // where every other strip used 15/7.
    render(<PageTabs tabs={TABS} value="active" onChange={() => {}} label="Alert state" />)

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("px-[15px]", "py-[7px]", "text-[13px]")
    }
  })

  it("hugs its tabs instead of spanning whatever it sits in", () => {
    // self-start on its own does nothing in a block parent — which is what
    // Settings and Alerts give it — and the strip ran the full window width.
    render(<PageTabs tabs={TABS} value="active" onChange={() => {}} label="Alert state" />)

    expect(screen.getByRole("tablist")).toHaveClass("w-fit")
  })
})

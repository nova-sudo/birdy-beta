import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

import { SegmentedTabs } from "../primitives/segmented-tabs"

const items = ["Report", "Scoreboard", "Lessons", "Settings"].map((label) => ({ value: label.toLowerCase(), label }))

// jsdom has no layout: each tab is 100 wide, and the scroll box shows 250 of 400 with 4 of padding each side.
function fakeLayout() {
  const box = (el) => el.dataset.slot === "tabs-scroller"
  const rect = (left, width) => ({ left, right: left + width, width, top: 0, bottom: 0, height: 0 })
  const spies = [
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      if (box(this)) return rect(0, 250)
      if (this.getAttribute("role") !== "tab") return rect(0, 0)
      const scroller = this.closest("[data-slot=tabs-scroller]")
      return rect(4 + [...this.parentElement.querySelectorAll("[role=tab]")].indexOf(this) * 100 - scroller.scrollLeft, 100)
    }),
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () { return box(this) ? 250 : 0 }),
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function () { return box(this) ? 408 : 0 }),
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => ({ paddingLeft: box(el) ? "4px" : "0px", paddingRight: box(el) ? "4px" : "0px", getPropertyValue: () => "" })),
  ]
  return () => spies.forEach((s) => s.mockRestore())
}

describe("SegmentedTabs on a narrow screen", () => {
  let restore
  afterEach(() => restore?.())

  it("brings an active tab past the edge into view", () => {
    restore = fakeLayout()
    const { container } = render(<SegmentedTabs ariaLabel="Sections" value="settings" onValueChange={() => {}} items={items} />)
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument()
    expect(container.querySelector("[data-slot=tabs-scroller]").scrollLeft).toBe(158)
  })

  it("brings a tab before the edge back into view, clear of the padding", () => {
    restore = fakeLayout()
    const { container, rerender } = render(<SegmentedTabs ariaLabel="Sections" value="settings" onValueChange={() => {}} items={items} />)
    rerender(<SegmentedTabs ariaLabel="Sections" value="scoreboard" onValueChange={() => {}} items={items} />)
    expect(container.querySelector("[data-slot=tabs-scroller]").scrollLeft).toBe(100)
  })

  it("leaves the rail alone when the active tab already shows", () => {
    restore = fakeLayout()
    const { container } = render(<SegmentedTabs ariaLabel="Sections" value="report" onValueChange={() => {}} items={items} />)
    expect(container.querySelector("[data-slot=tabs-scroller]").scrollLeft).toBe(0)
  })
})

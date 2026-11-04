import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

import { SegmentedTabs } from "../primitives/segmented-tabs"

const items = ["Report", "Scoreboard", "Lessons", "Settings"].map((label) => ({ value: label.toLowerCase(), label }))

// jsdom has no layout: each tab is 100 wide, the scroll box shows 250 of 400.
function fakeLayout() {
  const spies = [
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function () { return this.getAttribute("role") === "tab" ? 100 : 0 }),
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function () {
      return this.getAttribute("role") === "tab" ? [...this.parentElement.querySelectorAll("[role=tab]")].indexOf(this) * 100 : 0
    }),
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () { return this.dataset.slot === "tabs-scroller" ? 250 : 0 }),
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function () { return this.dataset.slot === "tabs-scroller" ? 400 : 0 }),
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
    expect(container.querySelector("[data-slot=tabs-scroller]").scrollLeft).toBe(150)
  })

  it("leaves the rail alone when the active tab already shows", () => {
    restore = fakeLayout()
    const { container } = render(<SegmentedTabs ariaLabel="Sections" value="report" onValueChange={() => {}} items={items} />)
    expect(container.querySelector("[data-slot=tabs-scroller]").scrollLeft).toBe(0)
  })
})

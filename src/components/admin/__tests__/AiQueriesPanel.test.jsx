import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import AiQueriesPanel from "../AiQueriesPanel"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const data = {
  total: 120,
  window_days: 7,
  roadmap_signal: "Compare clients asked 64 times this week",
  clusters: [
    { category: "cost_per_lead", label: "Cost per lead", pct: 60 },
    { category: "lead_volume", label: "Lead volume", pct: 40 },
  ],
  volume: [],
  recent_queries: [
    { session_id: "s1", owner: "leo@kestrel.agency", category_label: "Cost per lead", source: "web", content: "Why did CPL jump?", created_at: "2026-10-01T10:00:00Z" },
    { session_id: "s2", owner: "sam@northwind.io", category_label: "Lead volume", source: "slack", content: "Which clients are under target?", created_at: "2026-10-01T11:00:00Z" },
  ],
}

describe("AiQueriesPanel", () => {
  it("renders its ds widgets", () => {
    const { container } = render(<AiQueriesPanel data={data} onOpenConversation={vi.fn()} />)
    for (const ds of ["bar-list", "notice", "data-table", "surface"]) {
      expect(container.querySelector(`[data-ds="${ds}"]`), ds).not.toBeNull()
    }
    expect(screen.getByText("Roadmap signal")).toBeInTheDocument()
  })

  it("opens the conversation when a recent query is clicked", async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<AiQueriesPanel data={data} onOpenConversation={onOpen} />)
    await user.click(within(screen.getByRole("table")).getByText(/Why did CPL jump/))
    expect(onOpen).toHaveBeenCalledWith("s1")
  })

  it("opens the conversation on Enter from a focused row", async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<AiQueriesPanel data={data} onOpenConversation={onOpen} />)
    const row = within(screen.getByRole("table")).getByText(/Which clients are under target/).closest("tr")
    row.focus()
    await user.keyboard("{Enter}")
    expect(onOpen).toHaveBeenCalledWith("s2")
  })

  it("says so when there are no queries", () => {
    render(<AiQueriesPanel data={{ ...data, clusters: [], recent_queries: [] }} onOpenConversation={vi.fn()} />)
    expect(screen.getAllByText("No queries yet.").length).toBeGreaterThan(0)
  })

  it("has no legacy classes or inline hex", () => {
    const { container } = render(<AiQueriesPanel data={data} onOpenConversation={vi.fn()} />)
    const legacy = new RegExp(["p", "d-"].join("") + "|font-" + ["p", "d"].join("") + "-display")
    const bad = [...container.querySelectorAll("*")].filter(
      (el) => legacy.test(el.getAttribute("class") || "") || /#[0-9a-f]{3,8}\b/i.test(el.getAttribute("style") || "")
    )
    expect(bad).toEqual([])
  })
})

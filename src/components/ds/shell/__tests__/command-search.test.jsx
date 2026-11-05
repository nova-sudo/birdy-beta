import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const push = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/ask-birdy", () => ({ askBirdy: vi.fn(), openBirdyChat: vi.fn() }))

import { CommandSearch, NAV_ITEMS } from "@/components/ds"

// cmdk measures and scrolls its list; jsdom has neither.
beforeEach(() => {
  push.mockClear()
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
})

describe("CommandSearch", () => {
  it("lists every rail page plus Ask Birdy", () => {
    render(<CommandSearch open onOpenChange={() => {}} />)
    for (const item of NAV_ITEMS) expect(screen.getByText(item.label)).toBeInTheDocument()
    expect(screen.getByText("Ask Birdy")).toBeInTheDocument()
  })

  it("jumps to /ask-birdy and closes", () => {
    const onOpenChange = vi.fn()
    render(<CommandSearch open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByText("Ask Birdy"))
    expect(push).toHaveBeenCalledWith("/ask-birdy")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

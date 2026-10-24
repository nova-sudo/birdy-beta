import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const askBirdy = vi.fn()
vi.mock("@/lib/ask-birdy", () => ({ askBirdy: (...a) => askBirdy(...a) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({
  default: ({ size }) => <span data-testid="birdy-avatar" data-size={size} />,
}))

import { BirdyRead } from "../birdy-read"

const finding = (i, extra = {}) => ({
  id: `f${i}`,
  tone: "danger",
  title: `Finding ${i}`,
  detail: `Detail ${i}`,
  ...extra,
})

describe("BirdyRead", () => {
  beforeEach(() => askBirdy.mockClear())

  it("renders the default title with the framed mascot", () => {
    render(<BirdyRead findings={[finding(1)]} />)
    expect(screen.getByRole("heading", { name: /Birdy's read/ })).toBeTruthy()
    expect(screen.getByTestId("birdy-avatar").getAttribute("data-size")).toBe("28")
  })

  it("shows the finding count in a primary badge", () => {
    render(<BirdyRead findings={[finding(1), finding(2), finding(3)]} />)
    const badge = document.querySelector('[data-slot="birdy-read-count"]')
    expect(badge.textContent).toBe("3")
    expect(badge.className).toContain("bg-primary")
  })

  it("fires an action's onClick", () => {
    const onClick = vi.fn()
    render(<BirdyRead findings={[finding(1, { action: { label: "Review", onClick } })]} />)
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("adds an icon-only dismiss button that names its finding and fires onDismiss", () => {
    const onDismiss = vi.fn()
    render(<BirdyRead findings={[finding(1, { onDismiss }), finding(2)]} />)
    const btn = screen.getByRole("button", { name: "Dismiss Finding 1" })
    expect(btn.textContent).toBe("")
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    // The row without one keeps the slot so actions line up.
    expect(screen.queryByRole("button", { name: "Dismiss Finding 2" })).toBeNull()
    expect(screen.getAllByRole("listitem")[1].querySelectorAll("span.size-8")).toHaveLength(1)
  })

  it("renders no dismiss slot when no finding can be dismissed", () => {
    render(<BirdyRead findings={[finding(1)]} />)
    expect(document.querySelector("li span.size-8")).toBeNull()
  })

  it("renders an href action as a link", () => {
    render(<BirdyRead findings={[finding(1, { action: { label: "Open", href: "/clients/1" } })]} />)
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/clients/1")
  })

  it("renders the default empty line with no findings, and no badge", () => {
    render(<BirdyRead findings={[]} />)
    expect(screen.getByText("Nothing needs you right now.")).toBeTruthy()
    expect(document.querySelector('[data-slot="birdy-read-count"]')).toBeNull()
  })

  it("renders a custom empty node", () => {
    render(<BirdyRead findings={[]} empty={<p>All quiet</p>} />)
    expect(screen.getByText("All quiet")).toBeTruthy()
  })

  it("caps rows at 5", () => {
    render(<BirdyRead findings={Array.from({ length: 7 }, (_, i) => finding(i + 1))} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(5)
    expect(screen.queryByText("Finding 6")).toBeNull()
  })

  it("asks Birdy with the prompt", () => {
    render(<BirdyRead findings={[finding(1)]} prompt="What changed this week?" />)
    fireEvent.click(screen.getByRole("button", { name: /Ask Birdy about this/ }))
    expect(askBirdy).toHaveBeenCalledWith("What changed this week?")
  })

  it("hands the prompt to onAsk instead of the global assistant when given", () => {
    const onAsk = vi.fn()
    render(<BirdyRead findings={[finding(1)]} prompt="About this client" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole("button", { name: /Ask Birdy about this/ }))
    expect(onAsk).toHaveBeenCalledWith("About this client")
    expect(askBirdy).not.toHaveBeenCalled()
  })

  it("gives truncated text its full string as a tooltip", () => {
    render(<BirdyRead findings={[finding(1, { detail: "A long detail sentence" })]} />)
    expect(screen.getByText("Finding 1")).toHaveAttribute("title", "Finding 1")
    expect(screen.getByText("A long detail sentence")).toHaveAttribute("title", "A long detail sentence")
  })

  it("lets titles and details wrap to two lines instead of cutting to one", () => {
    render(<BirdyRead findings={[finding(1, { detail: "A long detail sentence" })]} />)
    expect(screen.getByText("Finding 1").className).toContain("line-clamp-2")
    expect(screen.getByText("A long detail sentence").className).toContain("line-clamp-2")
  })

  it("omits the ask link without a prompt", () => {
    render(<BirdyRead findings={[finding(1)]} />)
    expect(screen.queryByText(/Ask Birdy about this/)).toBeNull()
  })
})

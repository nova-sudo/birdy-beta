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

  it("omits the ask link without a prompt", () => {
    render(<BirdyRead findings={[finding(1)]} />)
    expect(screen.queryByText(/Ask Birdy about this/)).toBeNull()
  })
})

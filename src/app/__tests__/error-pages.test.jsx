import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))

const { default: NotFound } = await import("@/app/not-found")
const { default: PageError } = await import("@/app/error")
const { default: GlobalError } = await import("@/app/global-error")

describe("not-found", () => {
  it("renders an EmptyState with a way back to the dashboard", () => {
    const { container } = render(<NotFound />)
    expect(container.querySelector('[data-ds="empty-state"]')).not.toBeNull()
    expect(screen.getByText("This page doesn't exist")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Go to the dashboard" }).getAttribute("href")).toBe("/dashboard")
  })
})

describe("error", () => {
  it("renders an ErrorState whose retry calls reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const reset = vi.fn()
    const { container } = render(<PageError error={new Error("boom")} reset={reset} />)
    expect(container.querySelector('[data-ds="error-state"]')).not.toBeNull()
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it("quotes the digest when there is one", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<PageError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={() => {}} />)
    expect(screen.getByText("abc123")).toBeTruthy()
  })
})

describe("global-error", () => {
  it("keeps its own copy and a retry button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const reset = vi.fn()
    render(<GlobalError error={new Error("boom")} reset={reset} />)
    expect(screen.getByText("Birdy hit a problem")).toBeTruthy()
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)
  })
})

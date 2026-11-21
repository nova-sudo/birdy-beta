import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "./jsdom"
import { Segmented } from ".."

const ITEMS = [{ value: "all", label: "All", count: 3 }, { value: "calls", label: "Calls", count: 0 }]

describe("Segmented", () => {
  it("is a named group of toggle buttons with the chosen one pressed", () => {
    render(<Segmented aria-label="Show" items={ITEMS} value="all" onValueChange={() => {}} />)
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All, 3" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Calls, 0" })).toHaveAttribute("aria-pressed", "false")
  })

  it("reports the value clicked and never submits a form", async () => {
    const onValueChange = vi.fn()
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(<form onSubmit={onSubmit}><Segmented aria-label="Show" items={ITEMS} value="all" onValueChange={onValueChange} /></form>)
    await userEvent.click(screen.getByRole("button", { name: "Calls, 0" }))
    expect(onValueChange).toHaveBeenCalledWith("calls")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("leaves the count out when an item has none", () => {
    render(<Segmented aria-label="Send as" items={[{ value: "sms", label: "SMS" }]} value="sms" onValueChange={() => {}} />)
    expect(screen.getByRole("button", { name: "SMS" })).toBeInTheDocument()
  })
})

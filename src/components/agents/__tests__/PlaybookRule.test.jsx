import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { PlaybookRule } from "../PlaybookRule"

const PAUSE = {
  id: "r1",
  kind: "pause_over_target",
  enabled: true,
  mode: "ask",
  params: { patience_spend: 60, patience_days: 3, cpl_multiple: 1.5, zero_lead_spend: 80, recent_window_days: 7 },
}

describe("PlaybookRule", () => {
  it("edits a value inline and calls onChange with the numeric patch", async () => {
    const onChange = vi.fn()
    render(<PlaybookRule rule={PAUSE} onChange={onChange} showMode editable currency="€" />)
    expect(screen.getByText("Pause ads over target")).toBeInTheDocument()
    const spend = screen.getByLabelText("Spend before judging")
    expect(spend).toHaveValue("60")
    await userEvent.clear(spend)
    await userEvent.type(spend, "70{Enter}")
    expect(onChange).toHaveBeenCalledWith({ params: { patience_spend: 70 } })
    expect(onChange).toHaveBeenCalledTimes(1)

    // Blur commits too; an unchanged value sends nothing.
    const days = screen.getByLabelText("Days before judging")
    fireEvent.blur(days)
    expect(onChange).toHaveBeenCalledTimes(1)
    await userEvent.clear(days)
    await userEvent.type(days, "5")
    fireEvent.blur(days)
    expect(onChange).toHaveBeenLastCalledWith({ params: { patience_days: 5 } })
    // Money values carry the given currency symbol.
    expect(screen.getAllByText("€").length).toBeGreaterThan(0)
  })

  it("Auto-run is disabled", async () => {
    const onChange = vi.fn()
    render(<PlaybookRule rule={PAUSE} onChange={onChange} showMode editable />)
    const auto = screen.getByRole("tab", { name: "Auto-run" })
    expect(auto).toBeDisabled()
    expect(screen.getByRole("tab", { name: "Ask me" })).toHaveAttribute("data-state", "active")

    await userEvent.click(screen.getByRole("tab", { name: "Flag only" }))
    expect(onChange).toHaveBeenCalledWith({ mode: "flag" })

    // The reason shows on hover or focus of the disabled option.
    act(() => {
      auto.parentElement.focus()
    })
    expect((await screen.findAllByText("Earned after 10 approvals in a row")).length).toBeGreaterThan(0)
  })
})

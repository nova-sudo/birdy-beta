import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProgressBar } from "@/components/ds"

const fill = () => document.querySelector('[data-ds="progress-bar"] [data-slot="progress-fill"]')

describe("ProgressBar", () => {
  it("is a labelled progressbar carrying data-ds", () => {
    render(<ProgressBar value={40} label="Progress to trigger" />)
    const bar = screen.getByRole("progressbar", { name: "Progress to trigger" })
    expect(bar).toHaveAttribute("data-ds", "progress-bar")
    expect(bar).toHaveAttribute("aria-valuenow", "40")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
    expect(fill().style.width).toBe("40%")
  })

  it("uses primary below 80%, warning within 20% of the threshold, danger once crossed", () => {
    const { rerender } = render(<ProgressBar value={79} />)
    expect(fill()).toHaveClass("bg-primary")
    rerender(<ProgressBar value={80} />)
    expect(fill()).toHaveClass("bg-warning")
    rerender(<ProgressBar value={100} />)
    expect(fill()).toHaveClass("bg-danger")
  })

  it("clamps the fill but not the meaning, and can be forced to danger", () => {
    const { rerender } = render(<ProgressBar value={240} />)
    expect(fill().style.width).toBe("100%")
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    rerender(<ProgressBar value={-5} />)
    expect(fill().style.width).toBe("0%")
    rerender(<ProgressBar value={10} triggered />)
    expect(fill()).toHaveClass("bg-danger")
  })

  it("holds a fixed tone regardless of the value", () => {
    render(<ProgressBar value={100} tone="primary" />)
    expect(fill()).toHaveClass("bg-primary")
  })
})

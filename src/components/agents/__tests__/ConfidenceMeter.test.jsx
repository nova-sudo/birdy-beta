import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { ConfidenceMeter } from "../ConfidenceMeter"

const PARTS = {
  targets: true,
  pause: true,
  revive: false,
  flags: false,
  practice_agreed: 2,
  practice_answered: 3,
}

describe("ConfidenceMeter", () => {
  it("amber below 80, green at 80", () => {
    const { container, rerender } = render(<ConfidenceMeter score={79} parts={PARTS} />)
    const meter = () => container.querySelector("[data-slot=confidence-meter]")
    expect(meter()).toHaveAttribute("data-tone", "warning")
    expect(screen.getByText("Keep training")).toBeInTheDocument()
    expect(screen.getByText("79%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "79")
    // The marker sits at the threshold.
    expect(container.querySelector("[data-slot=confidence-threshold]")).toHaveStyle({ left: "80%" })

    rerender(<ConfidenceMeter score={80} parts={PARTS} />)
    expect(meter()).toHaveAttribute("data-tone", "success")
    expect(screen.getByText("Ready to switch on")).toBeInTheDocument()
    expect(screen.queryByText("Keep training")).not.toBeInTheDocument()
  })

  it("respects a custom threshold", () => {
    const { container } = render(<ConfidenceMeter score={70} parts={PARTS} threshold={70} />)
    expect(container.querySelector("[data-slot=confidence-meter]")).toHaveAttribute("data-tone", "success")
    expect(container.querySelector("[data-slot=confidence-threshold]")).toHaveStyle({ left: "70%" })
  })

  it("the server's ready wins over the score for the badge and tone", () => {
    const { container } = render(<ConfidenceMeter score={85} parts={PARTS} ready={false} />)
    expect(container.querySelector("[data-slot=confidence-meter]")).toHaveAttribute("data-tone", "warning")
    expect(screen.getByText("Keep training")).toBeInTheDocument()
    expect(screen.queryByText("Ready to switch on")).not.toBeInTheDocument()
  })

  it("lists missing parts", () => {
    render(
      <ConfidenceMeter
        score={40}
        parts={PARTS}
        targets={{ set: 7, total: 8 }}
        missing={["Tell Birdy when to revive old winners", "Set a CPL target for Palm Peach"]}
      />
    )
    const chip = (name) => screen.getByText(name).closest("[data-slot=confidence-part]")
    expect(chip("Client targets 7/8")).toHaveAttribute("data-done", "false")
    expect(chip("When to pause")).toHaveAttribute("data-done", "true")
    expect(chip("When to revive")).toHaveAttribute("data-done", "false")
    expect(chip("What to flag")).toHaveAttribute("data-done", "false")
    const practice = chip("Practice cases agreed")
    expect(practice).toHaveAttribute("data-done", "false")
    expect(practice).toHaveTextContent("2/3")
    expect(screen.getByText(/Tell Birdy when to revive old winners/)).toBeInTheDocument()
    expect(screen.getByText(/Set a CPL target for Palm Peach/)).toBeInTheDocument()
  })

  it("counts targets from parts when no counts are given", () => {
    render(<ConfidenceMeter score={10} parts={{ ...PARTS, targets: false }} />)
    const chip = screen.getByText(/^Client targets/).closest("[data-slot=confidence-part]")
    expect(chip).toHaveAttribute("data-done", "false")
  })
})

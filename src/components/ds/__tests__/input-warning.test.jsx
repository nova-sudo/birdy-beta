import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Input } from "../primitives/input"

describe("Input warning", () => {
  it("marks the field and carries the warning ring classes, which outrank shadow-control", () => {
    render(<Input aria-label="Target" warning />)
    const el = screen.getByLabelText("Target")
    expect(el).toHaveAttribute("data-warning", "true")
    // `.x[data-warning=true]` is class + attribute specificity, above `.shadow-control`.
    expect(el.className).toContain("data-[warning=true]:shadow-field-warning")
    expect(el.className).toContain("data-[warning=true]:hover:shadow-field-warning")
  })

  it("has no warning attribute by default", () => {
    render(<Input aria-label="Plain" />)
    expect(screen.getByLabelText("Plain")).not.toHaveAttribute("data-warning")
  })
})

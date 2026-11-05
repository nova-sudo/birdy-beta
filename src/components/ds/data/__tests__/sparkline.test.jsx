import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Sparkline } from "@/components/ds"

const root = () => document.querySelector('[data-ds="sparkline"]')

describe("Sparkline", () => {
  it("carries data-ds on its root and draws one polyline", () => {
    render(<Sparkline values={[1, 4, 2, 6]} label="Acme calls" />)
    expect(root()).not.toBeNull()
    expect(root().querySelectorAll("polyline")).toHaveLength(1)
    expect(screen.getByRole("img", { name: "Acme calls trend" })).toBeInTheDocument()
  })

  it("is neutral: no status colour and no end-point marker", () => {
    render(<Sparkline values={[5, 3]} />)
    expect(root().querySelector("circle")).toBeNull()
    expect(root().getAttribute("class")).not.toMatch(/success|danger|warning|primary/)
  })

  it("draws a dash with fewer than two points", () => {
    render(<Sparkline values={[3]} label="Acme calls" />)
    expect(root().querySelector("polyline")).toBeNull()
    expect(screen.getByText("Acme calls: no trend")).toBeInTheDocument()
  })

  it("ignores non-finite values", () => {
    render(<Sparkline values={[1, NaN, 3]} />)
    expect(root().querySelector("polyline").getAttribute("points").split(" ")).toHaveLength(2)
  })
})

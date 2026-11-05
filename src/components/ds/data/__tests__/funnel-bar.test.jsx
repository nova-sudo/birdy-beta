import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { FunnelBar } from "@/components/ds"

const STEPS = [
  { key: "leads", label: "Leads", value: 1562, delta: 1.7 },
  { key: "in_crm", label: "In CRM", shortLabel: "CRM", value: 1049, delta: 3.9 },
  { key: "called", label: "Called", value: 462, delta: 1.4 },
  { key: "closes", label: "Closes", value: 29, delta: -32.6 },
]

const root = () => document.querySelector('[data-ds="funnel-bar"]')
const metaCells = () => root().querySelectorAll('[data-slot="funnel-meta"] > div')

describe("FunnelBar", () => {
  it("carries data-ds on its root", () => {
    render(<FunnelBar steps={STEPS} />)
    expect(root()).not.toBeNull()
  })

  it("shows step-to-step conversion above each join, rounded", () => {
    render(<FunnelBar steps={STEPS} />)
    const conv = root().querySelector('[data-slot="funnel-conversions"]')
    // 1049/1562 = 67.2%, 462/1049 = 44.0%, 29/462 = 6.3%
    expect(conv.children[1].textContent).toBe("→ 67%")
    expect(conv.children[2].textContent).toBe("→ 44%")
    expect(conv.children[3].textContent).toBe("→ 6.3%")
    // First cell is empty; the row is for sm and up only.
    expect(conv.children[0].textContent).toBe("")
    expect(conv).toHaveClass("hidden", "sm:grid")
  })

  it("says the conversions in words for screen readers", () => {
    render(<FunnelBar steps={STEPS} />)
    const sr = root().querySelector('[data-slot="funnel-conversions-sr"]')
    expect(sr).toHaveClass("sr-only")
    expect([...sr.children].map((li) => li.textContent)).toEqual([
      "Leads to In CRM: 67%",
      "In CRM to Called: 44%",
      "Called to Closes: 6.3%",
    ])
    // The visible row stays decorative.
    expect(root().querySelector('[data-slot="funnel-conversions"]')).toHaveAttribute("aria-hidden", "true")
  })

  it("shows a dash where the previous step is zero", () => {
    render(<FunnelBar steps={[{ key: "a", label: "A", value: 0 }, { key: "b", label: "B", value: 5 }]} />)
    const conv = root().querySelector('[data-slot="funnel-conversions"]')
    expect(conv.children[1].textContent).toBe("—")
  })

  it("shares are of the first step: one decimal from sm, whole % below except under 10%", () => {
    render(<FunnelBar steps={STEPS} />)
    const crm = metaCells()[1]
    expect(within(crm).getByText("67.2%")).toHaveClass("hidden", "sm:inline")
    expect(within(crm).getByText("67%")).toHaveClass("sm:hidden")
    // 1.9% stays at one decimal on both
    const closes = metaCells()[3]
    expect(within(closes).getByText("1.9%")).toBeInTheDocument()
    expect(within(closes).queryByText("2%")).toBeNull()
  })

  it("the first step shows its delta only, no share", () => {
    render(<FunnelBar steps={STEPS} />)
    const first = metaCells()[0]
    expect(first.textContent).toContain("1,562")
    expect(first.textContent).toContain("1.7%")
    expect(first.textContent).not.toContain("100")
  })

  it("an explicit share overrides the computed one, and null hides it", () => {
    render(
      <FunnelBar
        steps={[
          { key: "a", label: "A", value: 100 },
          { key: "b", label: "B", value: 50, share: 0.123 },
          { key: "c", label: "C", value: 25, share: null },
        ]}
      />
    )
    expect(within(metaCells()[1]).getByText("12%")).toBeInTheDocument()
    expect(metaCells()[2].textContent).not.toContain("%")
  })

  it("hides deltas below sm", () => {
    render(<FunnelBar steps={STEPS} />)
    const delta = metaCells()[1].querySelector('[data-ds="delta"]')
    expect(delta.parentElement).toHaveClass("hidden", "sm:inline")
  })

  it("renders shortLabel below sm and the full label from sm up (class based)", () => {
    render(<FunnelBar steps={STEPS} />)
    const bar = root().querySelector('[data-slot="funnel-segments"]')
    expect(within(bar).getByText("CRM")).toHaveClass("sm:hidden")
    expect(within(bar).getByText("In CRM")).toHaveClass("hidden", "sm:inline")
    // A step without a shortLabel shows the same label everywhere.
    expect(within(bar).getAllByText("Leads")).toHaveLength(1)
  })

  it("colours deltas by invert: a falling cost is good", () => {
    render(
      <FunnelBar
        steps={[
          { key: "a", label: "A", value: 10, delta: 5, invert: true },
          { key: "b", label: "B", value: 5, delta: -5, invert: true },
        ]}
      />
    )
    const deltas = root().querySelectorAll('[data-ds="delta"]')
    expect(deltas[0]).toHaveAttribute("data-tone", "bad") // cost rising
    expect(deltas[1]).toHaveAttribute("data-tone", "good") // cost falling
  })

  it("fills run from solid primary to a pale last step", () => {
    render(<FunnelBar steps={STEPS} />)
    const segs = root().querySelectorAll('[data-slot="funnel-segments"] > div')
    expect(segs[0]).toHaveClass("bg-primary", "text-primary-foreground")
    expect(segs[1]).toHaveClass("bg-primary/80", "text-primary-foreground")
    expect(segs[2]).toHaveClass("bg-primary/60", "text-primary-foreground")
    expect(segs[3]).toHaveClass("bg-primary/30", "text-foreground")
  })

  it("zero first step: values only, no NaN or Infinity", () => {
    render(
      <FunnelBar
        steps={[
          { key: "a", label: "A", value: 0 },
          { key: "b", label: "B", value: 0 },
          { key: "c", label: "C", value: 0 },
        ]}
      />
    )
    expect(root().textContent).not.toMatch(/NaN|Infinity/)
    const conv = root().querySelector('[data-slot="funnel-conversions"]')
    expect(conv.textContent).not.toContain("→")
    expect(root().querySelector('[data-slot="funnel-meta"]').textContent).not.toContain("%")
  })

  it("a step larger than the one before it is a slice, not a narrowing: no conversion", () => {
    render(<FunnelBar steps={[{ key: "a", label: "A", value: 10 }, { key: "b", label: "B", value: 40 }]} />)
    const conv = root().querySelector('[data-slot="funnel-conversions"]')
    expect(conv.children[1].textContent).toBe("—")
  })

  it("a hint becomes the segment's tooltip", () => {
    render(<FunnelBar steps={[{ key: "a", label: "A", value: 10, hint: "Counted from ad clicks" }]} />)
    expect(root().querySelector('[data-slot="funnel-segments"] > div')).toHaveAttribute("title", "Counted from ad clicks")
  })

  it("a null value reads as a dash and breaks the conversions around it", () => {
    render(
      <FunnelBar
        steps={[
          { key: "a", label: "A", value: 100 },
          { key: "b", label: "B", value: null },
          { key: "c", label: "C", value: 10 },
        ]}
      />
    )
    const conv = root().querySelector('[data-slot="funnel-conversions"]')
    expect(conv.children[1].textContent).toBe("—")
    expect(conv.children[2].textContent).toBe("—")
    expect(metaCells()[1].textContent).toContain("—")
  })

  it("loading draws skeletons instead of figures", () => {
    render(<FunnelBar steps={STEPS} loading />)
    expect(root().querySelectorAll('[data-ds="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByText("1,562")).toBeNull()
  })

  it("renders nothing for no steps", () => {
    const { container } = render(<FunnelBar steps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

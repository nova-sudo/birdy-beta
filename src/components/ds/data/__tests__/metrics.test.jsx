import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { fromPortfolioTabs, Delta, MetricCard, MetricGroup, MetricTabsChart, Breakdown, BarList } from "@/components/ds"

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("Delta", () => {
  it("positive is green up", () => {
    render(<Delta value={12.4} />)
    expect(screen.getByText(/12\.4%/)).toHaveClass("text-success-ink")
    expect(screen.getByText("↑")).toBeInTheDocument()
  })
  it("inverted falling cost is green down", () => {
    render(<Delta value={-6.1} invert />)
    expect(screen.getByText(/6\.1%/)).toHaveClass("text-success-ink")
    expect(screen.getByText("↓")).toBeInTheDocument()
  })
  it("inverted rising cost is red up", () => {
    render(<Delta value={3} invert />)
    expect(screen.getByText(/3\.0%/)).toHaveClass("text-danger-ink")
  })
  it("zero is neutral without arrow", () => {
    render(<Delta value={0} />)
    expect(screen.getByText(/0%/)).toHaveClass("text-muted-foreground")
    expect(screen.queryByText(/[↑↓]/)).toBeNull()
  })
  it("values rounding to 0.0 are neutral", () => {
    render(<Delta value={0.04} />)
    expect(screen.getByText("0%")).toHaveClass("text-muted-foreground")
    expect(screen.queryByText(/[↑↓]/)).toBeNull()
  })
  it("number format with null renders 0", () => {
    render(<Delta value={null} format="number" />)
    expect(screen.getByText("0")).toHaveClass("text-muted-foreground")
  })
  it("null is neutral", () => {
    render(<Delta value={null} />)
    expect(screen.getByText("0%")).toHaveClass("text-muted-foreground")
  })
  it("number format uses en-GB grouping, absolute value, and suffix", () => {
    render(<Delta value={-1234} format="number" suffix=" pts" />)
    expect(screen.getByText(/1,234 pts/)).toBeInTheDocument()
    expect(screen.getByText("↓")).toBeInTheDocument()
  })
})

describe("MetricCard / MetricGroup", () => {
  it("renders label, value, delta and caption", () => {
    render(<MetricCard label="Spend" value="£1,200" delta={5} caption="vs last week" />)
    expect(screen.getByText("Spend")).toBeInTheDocument()
    expect(screen.getByText("£1,200")).toHaveClass("text-figure")
    expect(screen.getByText(/5\.0%/)).toBeInTheDocument()
    expect(screen.getByText("vs last week")).toBeInTheDocument()
  })
  it("group renders title, meta, action and one card per item", () => {
    const { container } = render(
      <MetricGroup
        title="Delivery"
        meta="7d"
        action={<button>More</button>}
        items={[
          { label: "A", value: "1" },
          { label: "B", value: "2" },
        ]}
      />
    )
    expect(screen.getByText("Delivery")).toBeInTheDocument()
    expect(screen.getByText("More")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-ds="metric-card"]')).toHaveLength(2)
  })
})

const series = [
  { x: "Mon", current: 1, previous: 2 },
  { x: "Tue", current: 3, previous: 2 },
]
const metrics = ["a", "b", "c", "d"].map((k) => ({ key: k, label: k.toUpperCase(), value: `v${k}`, delta: 1, series }))

describe("MetricTabsChart", () => {
  it("tabs are a tablist; clicking selects", () => {
    const onValueChange = vi.fn()
    render(<MetricTabsChart metrics={metrics} value="a" onValueChange={onValueChange} />)
    expect(screen.getByRole("tablist")).toBeInTheDocument()
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(4)
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    fireEvent.click(tabs[1])
    expect(onValueChange).toHaveBeenCalledWith("b")
  })
  it("a metric without a series is shown but disabled", () => {
    const onValueChange = vi.fn()
    render(
      <MetricTabsChart
        metrics={[...metrics, { key: "z", label: "Z", value: "0" }]}
        value="a"
        onValueChange={onValueChange}
      />
    )
    const z = screen.getByRole("tab", { name: /Z/ })
    expect(z).toBeDisabled()
    fireEvent.click(z)
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("MetricTabsChart states and adapter", () => {
  it("adapter keeps inactive plottable tabs enabled and clickable", () => {
    const onValueChange = vi.fn()
    const adapted = fromPortfolioTabs({
      tabs: [
        { key: "a", label: "A", value: "1", direction: "down", delta: "2.0%", polarity: "lower-is-better" },
        { key: "b", label: "B", value: "2" },
        { key: "c", label: "C", value: "3", plottable: false },
      ],
      activeKey: "a",
      chart: { values: [1, 2], labels: ["x", "y"] },
    })
    expect(adapted[0]).toMatchObject({ delta: -2, invert: true })
    render(<MetricTabsChart metrics={adapted} value="a" onValueChange={onValueChange} />)
    const b = screen.getByRole("tab", { name: /B/ })
    expect(b).toBeEnabled()
    fireEvent.click(b)
    expect(onValueChange).toHaveBeenCalledWith("b")
    expect(screen.getByRole("tab", { name: /C/ })).toBeDisabled()
  })
  it("loading shows skeleton tabs and no tablist", () => {
    const { container } = render(<MetricTabsChart metrics={metrics} value="a" loading />)
    expect(screen.queryByRole("tablist")).toBeNull()
    expect(container.querySelectorAll('[data-ds="skeleton"]').length).toBeGreaterThan(4)
  })
  it("plotLoading keeps tabs but skeletons the plot", () => {
    const { container } = render(<MetricTabsChart metrics={metrics} value="a" plotLoading />)
    expect(screen.getAllByRole("tab")).toHaveLength(4)
    expect(container.querySelector('[role="tabpanel"] [data-ds="skeleton"]')).not.toBeNull()
  })
  it("emptyMessage replaces the default copy", () => {
    const m = [{ key: "a", label: "A", value: "1", plottable: true }]
    const { rerender } = render(<MetricTabsChart metrics={m} value="a" />)
    expect(screen.getByText("Nothing to plot for this window yet.")).toBeInTheDocument()
    rerender(<MetricTabsChart metrics={m} value="a" emptyMessage="No data" className="extra" />)
    expect(screen.getByText("No data")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="metric-tabs-chart"]')).toHaveClass("extra")
  })
})

describe("Breakdown / BarList", () => {
  it("shares render as tabular figures", () => {
    render(
      <Breakdown
        title="By source"
        total="£10"
        rows={[{ key: "m", label: "Meta", color: "var(--color-chart-1)", value: "£6", share: 60, delta: 2 }]}
      />
    )
    expect(screen.getByText("£6")).toHaveClass("num")
    expect(screen.getByText("60%")).toHaveClass("num")
  })
  it("sizes the share bar by proportion inside a shrinkable track, so it cannot overflow narrow screens", () => {
    // jsdom has no layout, so this pins the constraints that keep it in bounds:
    // no fixed or percentage widths on segments, and a clipped, min-w-0 track.
    const { container } = render(
      <Breakdown
        title="By client"
        rows={[
          { key: "a", label: "A", color: "red", value: "6", share: 60 },
          { key: "b", label: "B", color: "blue", value: "4", share: 40 },
        ]}
      />
    )
    const root = container.querySelector('[data-ds="breakdown"]')
    const track = root.querySelector('[aria-hidden="true"]')
    expect(root).toHaveClass("min-w-0")
    expect(track).toHaveClass("min-w-0", "w-full", "overflow-hidden")
    const [a, b] = track.children
    expect(a.style.flex).toBe("60 1 0%")
    expect(b.style.flex).toBe("40 1 0%")
    expect(a.style.width).toBe("")
  })
  it("BarList scales bars to the largest value", () => {
    const { container } = render(
      <BarList
        title="Top"
        rows={[
          { label: "A", value: 10 },
          { label: "B", value: 5 },
        ]}
      />
    )
    const bars = container.querySelectorAll("[data-bar]")
    expect(bars[0].style.width).toBe("100%")
    expect(bars[1].style.width).toBe("50%")
  })
})

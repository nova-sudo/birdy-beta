import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { fromPortfolioTabs, Delta, MetricCard, MetricGroup, MetricTabsChart, Breakdown, BarList } from "@/components/ds"
import { metricGroupColumns } from "@/components/ds/data/metric-group"

// recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const figure = (container) => container.querySelector('[data-slot="delta-figure"]')

describe("Delta", () => {
  it("a rise that is good news is a green up arrow and figure", () => {
    const { container } = render(<Delta change={12.4} />)
    expect(container.firstChild).toHaveAttribute("data-tone", "good")
    expect(figure(container)).toHaveClass("text-delta-good-ink")
    expect(figure(container).textContent).toBe("Up12.4%")
    expect(figure(container).querySelector("svg")).toHaveClass("text-delta-good", "size-3.5")
  })
  it("goodWhen down: a falling cost is good, a rising one bad", () => {
    const { container, rerender } = render(<Delta change={-6.1} goodWhen="down" />)
    expect(figure(container)).toHaveClass("text-delta-good-ink")
    expect(screen.getByText("Down")).toHaveClass("sr-only")
    rerender(<Delta change={3} goodWhen="down" />)
    expect(figure(container)).toHaveClass("text-delta-bad-ink")
  })
  it("reads count and points formats without a sign", () => {
    const { container, rerender } = render(<Delta change={-6} format="count" />)
    expect(figure(container).textContent).toBe("Down6")
    rerender(<Delta change={2} format="points" />)
    expect(figure(container).textContent).toBe("Up2 pts")
    rerender(<Delta change={1} format="points" />)
    expect(figure(container).textContent).toBe("Up1 pt")
  })
  it("zero, missing, and values rounding to 0 read No change in muted", () => {
    for (const change of [0, null, undefined, 0.04, Number.NaN]) {
      const { container, unmount } = render(<Delta change={change} />)
      expect(screen.getByText("No change")).toHaveClass("text-muted-foreground")
      expect(container.firstChild).toHaveAttribute("data-tone", "neutral")
      expect(container.querySelector("svg")).toBeNull()
      unmount()
    }
  })
  it("the comparison follows the figure in muted 13px text", () => {
    const { container } = render(<Delta change={6} format="count" comparison="vs previous 30 days" />)
    expect(container.firstChild).toHaveClass("text-xs", "leading-4")
    expect(screen.getByText("vs previous 30 days")).toHaveClass("text-muted-foreground")
  })
  it("neither keeps the change muted", () => {
    const { container } = render(<Delta change={5} goodWhen="neither" />)
    expect(figure(container)).toHaveClass("text-muted-foreground")
  })
  it("badge variant is a soft chip", () => {
    const { container } = render(<Delta change={-3} variant="badge" />)
    expect(container.firstChild).toHaveClass("h-7", "rounded-badge", "bg-delta-bad-soft", "text-delta-bad-ink")
  })
})

describe("MetricGroup", () => {
  const items = [
    {
      key: "live",
      label: "Live locations",
      value: 641,
      format: "number",
      description: "Live today.",
      delta: { change: 6, format: "count", comparison: "vs previous 30 days" },
      caption: "641 locs · 195 brands",
    },
    { key: "b", label: "B", value: "2" },
    { key: "c", label: "C", value: "3" },
    { key: "d", label: "D", value: "4" },
  ]

  it("one frame, one flush surface split into hairline cells", () => {
    const { container } = render(<MetricGroup title="Locations" meta="Today" action={<button>More</button>} items={items} />)
    const root = container.firstChild
    expect(root).toHaveAttribute("data-ds", "metric-group")
    expect(root).toHaveClass("bg-frame", "shadow-frame")
    expect(screen.getByRole("heading", { name: "Locations" })).toBeTruthy()
    expect(screen.getByText("Today")).toHaveAttribute("data-slot", "frame-description")
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy()
    const grid = root.querySelector('[data-slot="metric-group"]')
    expect(grid).toHaveClass("grid", "grid-cols-2", "@3xl/metric-group:grid-cols-4")
    const cells = grid.querySelectorAll('[data-slot="metric-group-cell"]')
    expect(cells).toHaveLength(4)
    expect(cells[0]).toHaveClass("p-5", "gap-1.5", "shadow-[-1px_0_0_var(--color-divider),0_-1px_0_var(--color-divider)]")
    expect(root.querySelectorAll('[data-ds="surface"], [data-ds="metric-card"]')).toHaveLength(0)
  })

  it("a cell is a muted label with info, a 24px value, the delta line and a caption", () => {
    const { container } = render(<MetricGroup title="Locations" items={items} />)
    const cell = within(container.querySelector('[data-slot="metric-group-cell"]'))
    expect(cell.getByText("Live locations").closest("span.text-muted-foreground")).toHaveClass("text-sm", "font-medium")
    expect(cell.getByRole("button", { name: "How live locations is counted" })).toBeTruthy()
    expect(cell.getByText("641")).toHaveClass("text-2xl", "leading-[30px]", "tracking-[-0.02em]")
    expect(cell.getByText("vs previous 30 days")).toBeTruthy()
    expect(cell.getByText("641 locs · 195 brands")).toHaveClass("text-xs", "text-muted-foreground")
  })

  it("columns follow the count: three go one-up then three across", () => {
    const { container } = render(<MetricGroup title="T" items={items.slice(0, 3)} />)
    expect(container.querySelector('[data-slot="metric-group"]')).toHaveClass("grid-cols-1", "@lg/metric-group:grid-cols-3")
  })

  it("odd counts pick columns that leave the fewest holes", () => {
    expect(metricGroupColumns(1)).toBe("grid-cols-1")
    expect(metricGroupColumns(4)).toBe("grid-cols-2 @3xl/metric-group:grid-cols-4")
    expect(metricGroupColumns(5)).toBe(
      "grid-cols-2 @3xl/metric-group:grid-cols-3 @6xl/metric-group:grid-cols-5"
    )
    expect(metricGroupColumns(6)).toBe("grid-cols-2 @3xl/metric-group:grid-cols-3")
    expect(metricGroupColumns(7)).toBe("grid-cols-2 @3xl/metric-group:grid-cols-4")
    expect(metricGroupColumns(8)).toBe("grid-cols-2 @3xl/metric-group:grid-cols-4")
    // Past eight the group still shows eight.
    expect(metricGroupColumns(12)).toBe(metricGroupColumns(8))
    const six = Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: i }))
    const { container } = render(<MetricGroup title="T" items={six} />)
    expect(container.querySelector('[data-slot="metric-group"]')).toHaveClass("grid-cols-2", "@3xl/metric-group:grid-cols-3")
  })

  it("loading keeps the labels and skeletons the figures", () => {
    const { container } = render(<MetricGroup title="T" items={items} loading />)
    expect(screen.getByText("Live locations")).toBeTruthy()
    expect(screen.queryByText("641")).toBeNull()
    expect(container.querySelectorAll('[data-ds="skeleton"]')).toHaveLength(8)
  })

  it("an href makes the cell a link", () => {
    render(<MetricGroup title="T" items={[{ key: "a", label: "Leads", value: 3, href: "/contacts" }]} />)
    expect(screen.getByRole("link", { name: "Leads" })).toHaveAttribute("href", "/contacts")
  })

  it("MetricCard is one free-standing cell", () => {
    const { container } = render(
      <MetricCard label="Spend" value="£1,200" delta={{ change: 5, comparison: "vs last week" }} />
    )
    expect(container.firstChild).toHaveAttribute("data-ds", "metric-card")
    expect(container.querySelectorAll('[data-slot="metric-group-cell"]')).toHaveLength(1)
    expect(screen.getByText("£1,200")).toHaveClass("text-2xl")
    expect(screen.getByText("vs last week")).toBeTruthy()
  })
})

const series = [
  { x: "Mon", current: 1, previous: 2 },
  { x: "Tue", current: 3, previous: 2 },
]
const metrics = ["a", "b", "c", "d"].map((k) => ({
  key: k,
  label: k.toUpperCase(),
  value: `v${k}`,
  delta: { change: 1, comparison: "vs previous period" },
  series,
}))

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
  it("sits in the frame shell; inactive figures are secondary ink, the active one foreground", () => {
    const { container } = render(<MetricTabsChart title="Overview" metrics={metrics} value="b" onValueChange={() => {}} />)
    expect(container.firstChild).toHaveClass("bg-frame", "shadow-frame", "rounded-frame")
    expect(screen.getByRole("heading", { name: "Overview" })).toBeTruthy()
    const [a, b] = screen.getAllByRole("tab")
    expect(a).toHaveAttribute("data-state", "inactive")
    expect(b).toHaveAttribute("data-state", "active")
    const value = within(a).getByText("va")
    expect(value).toHaveClass("text-[28px]", "tracking-[-0.02em]", "text-ink-secondary", "group-data-[state=active]/metric-tab:text-foreground")
    expect(within(a).getByText("A")).toHaveClass("text-muted-foreground")
    expect(within(a).getByText("vs previous period")).toBeTruthy()
    expect(screen.getByRole("tabpanel")).toHaveClass("rounded-frame", "shadow-surface")
  })
  it("the caption shows only without a delta", () => {
    render(
      <MetricTabsChart
        metrics={[{ key: "a", label: "A", value: "1", caption: "Last 7 days", series }]}
        value="a"
      />
    )
    expect(screen.getByText("Last 7 days")).toBeTruthy()
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
  it("adapter folds direction and polarity into a delta and goodWhen, with the comparison", () => {
    const onValueChange = vi.fn()
    const adapted = fromPortfolioTabs({
      tabs: [
        { key: "a", label: "A", value: "1", direction: "down", delta: "2.0%", polarity: "lower-is-better" },
        { key: "b", label: "B", value: "2" },
        { key: "c", label: "C", value: "3", plottable: false },
      ],
      activeKey: "a",
      chart: { values: [1, 2], labels: ["x", "y"] },
      comparison: "vs previous period",
    })
    expect(adapted[0]).toMatchObject({
      delta: { change: -2, format: "percent", comparison: "vs previous period" },
      goodWhen: "down",
    })
    expect(adapted[1].delta).toBeUndefined()
    render(<MetricTabsChart metrics={adapted} value="a" onValueChange={onValueChange} />)
    const b = screen.getByRole("tab", { name: /B/ })
    expect(b).toBeEnabled()
    fireEvent.click(b)
    expect(onValueChange).toHaveBeenCalledWith("b")
    expect(screen.getByRole("tab", { name: /C/ })).toBeDisabled()
    // A falling cost is good news.
    expect(screen.getByRole("tab", { name: /A/ }).querySelector('[data-ds="delta"]')).toHaveAttribute("data-tone", "good")
  })
  it("adapter reads a pts delta as points, and lower-is-better as goodWhen down", () => {
    const [ctr, lost, leads] = fromPortfolioTabs({
      tabs: [
        { key: "ctr", label: "CTR", value: "1.4%", direction: "up", delta: "0.3pts", polarity: "higher-is-better" },
        { key: "lost", label: "Lost leads", value: "9", direction: "down", delta: "71.9%", polarity: "lower-is-better" },
        { key: "leads", label: "Leads", value: "40", direction: "down", delta: "5.0%" },
      ],
      activeKey: "ctr",
    })
    expect(ctr.delta).toMatchObject({ change: 0.3, format: "points" })
    expect(lost).toMatchObject({ delta: { change: -71.9, format: "percent" }, goodWhen: "down" })
    expect(leads.goodWhen).toBe("up")
  })
  it("loading shows skeleton figures and no tablist", () => {
    const { container } = render(<MetricTabsChart metrics={metrics} value="a" loading />)
    expect(screen.queryByRole("tablist")).toBeNull()
    expect(screen.getByText("A")).toBeTruthy()
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

describe("MetricTabsChart plotFallback", () => {
  it("replaces the plot, even when the metric has a series, but not the loading skeleton", () => {
    const fallback = <p>No source for this</p>
    const { container, rerender } = render(
      <MetricTabsChart metrics={metrics} value="a" plotFallback={fallback} />
    )
    expect(screen.getByText("No source for this")).toBeInTheDocument()
    expect(screen.queryByText("Nothing to plot for this window yet.")).toBeNull()
    rerender(<MetricTabsChart metrics={metrics} value="a" plotFallback={fallback} plotLoading />)
    expect(screen.queryByText("No source for this")).toBeNull()
    expect(container.querySelector('[role="tabpanel"] [data-ds="skeleton"]')).not.toBeNull()
  })
})

describe("Breakdown / BarList", () => {
  it("sits in a Frame with the total in its header, rows as tabular figures", () => {
    const { container } = render(
      <Breakdown
        title="By source"
        total="£10"
        rows={[
          { key: "m", label: "Meta", color: "var(--color-chart-1)", value: "£6", share: 60, delta: { change: 2 } },
        ]}
      />
    )
    expect(container.firstChild).toHaveAttribute("data-ds", "breakdown")
    expect(container.firstChild).toHaveAttribute("data-slot", "frame")
    expect(screen.getByRole("heading", { name: "By source" })).toBeTruthy()
    expect(within(container.querySelector('[data-slot="frame-actions"]')).getByText("£10")).toBeTruthy()
    expect(screen.getByText("£6")).toHaveClass("num")
    expect(screen.getByText("60%")).toHaveClass("num", "text-faint")
    expect(container.querySelector('[data-ds="breakdown"] li')).toHaveClass("h-14")
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
    const root = container.querySelector('[data-slot="breakdown"]')
    const track = root.querySelector('[aria-hidden="true"]')
    expect(root).toHaveClass("min-w-0")
    expect(track).toHaveClass("min-w-0", "overflow-hidden")
    const [a, b] = track.children
    expect(a.style.flex).toBe("60 1 0%")
    expect(b.style.flex).toBe("40 1 0%")
    expect(a.style.width).toBe("")
  })
  it("BarList scales bars to the largest value, in a Frame when titled", () => {
    const { container } = render(
      <BarList
        title="Top"
        meta="7 days"
        rows={[
          { label: "A", value: 10 },
          { label: "B", value: 5 },
        ]}
      />
    )
    expect(container.firstChild).toHaveAttribute("data-ds", "bar-list")
    expect(container.firstChild).toHaveAttribute("data-slot", "frame")
    expect(screen.getByText("7 days")).toHaveAttribute("data-slot", "frame-description")
    const bars = container.querySelectorAll("[data-bar]")
    expect(bars[0].style.width).toBe("100%")
    expect(bars[1].style.width).toBe("50%")
  })
  it("BarList shows its empty copy with no rows", () => {
    render(<BarList title="Top" rows={[]} empty="No data yet." />)
    expect(screen.getByText("No data yet.")).toBeTruthy()
  })
})

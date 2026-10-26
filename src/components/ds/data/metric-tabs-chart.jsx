"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts"

import { cn } from "@/lib/utils"
import { Skeleton } from "../surfaces/skeleton"
import { Delta } from "./delta"

const DRAW_MS = 800
const TOOLTIP_MS = 120

function ChartTooltip({ active, payload, label, formatValue, metric }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div
      data-ds="chart-tooltip"
      className="rounded-control bg-foreground px-3 py-2 text-background shadow-floating"
    >
      <div className="font-mono text-xs opacity-70">{row.tooltipLabel ?? label}</div>
      <div className="num text-sm font-medium">{row.display ?? formatValue(row.current, metric)}</div>
      {row.previous != null && (
        <div className="num text-xs opacity-70">Previous {formatValue(row.previous, metric)}</div>
      )}
    </div>
  )
}

/**
 * An overview's metrics as tabs in a Frame. The chosen one rises into the white
 * surface and joins the chart beneath it; the others sit flat in the frame. A
 * metric that cannot be plotted is still drawn as a figure but is disabled, so
 * the row keeps its order.
 *
 * Adapter: `fromPortfolioTabs` turns the former portfolio `{tabs, activeKey, chart}`
 * props into this component's `metrics`.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] Header strip title; with none the tabs start at the frame's top edge
 * @param {React.ReactNode} [props.action] The header's right side
 * @param {{key: string, label: React.ReactNode, value: React.ReactNode, description?: string, delta?: {change: number|null, format?: "percent"|"points"|"count", comparison?: React.ReactNode}, goodWhen?: "up"|"down"|"neither", caption?: React.ReactNode, plottable?: boolean, series?: {x: string, current: number, previous?: number|null, tooltipLabel?: string, display?: string}[]}[]} props.metrics
 *   `caption` shows only when there is no `delta`. A point's `display`, when given, stands in for the formatted `current` in its tooltip ("—" for a bucket with no reading that is plotted at a carried value).
 * @param {string} props.value Active metric key
 * @param {(key: string) => void} props.onValueChange
 * @param {(n: number, metric: object) => React.ReactNode} [props.formatValue] Tooltip number formatter
 * @param {string} [props.xLabel] Accessible name for the x axis
 * @param {boolean} [props.loading] Figures not yet available: labels stay, figures and plot are skeletons
 * @param {boolean} [props.plotLoading] Series still counting: skeleton plot only
 * @param {React.ReactNode} [props.emptyMessage] Shown in the plot when the active metric has no series
 * @param {React.ReactNode} [props.plotFallback] Replaces the plot (after loading) with custom content, e.g. "this metric has no source"; wins over the series and `emptyMessage`
 * @param {string|number} [props.redrawKey] Changes when the same metric is re-bucketed (granularity, period): replays the draw
 *
 * A metric is selectable when `plottable` is not false, even with no `series` yet:
 * the panel shows the empty state until the hub supplies the series for the new tab.
 */
function MetricTabsChart({
  title,
  action,
  metrics,
  value,
  onValueChange,
  formatValue = (n) => n.toLocaleString("en-GB"),
  xLabel,
  loading = false,
  plotLoading = false,
  emptyMessage = "Nothing to plot for this window yet.",
  plotFallback,
  redrawKey = "",
  className,
  ...props
}) {
  const panelId = React.useId()
  const titleId = `${panelId}-title`
  const gradientId = `${panelId.replace(/:/g, "")}-fill`
  const active = metrics.find((m) => m.key === value) ?? metrics[0]
  const series = active?.series
  const firstChosen = !loading && metrics[0]?.key === active?.key
  const lastChosen = !loading && metrics.length > 1 && metrics.at(-1)?.key === active?.key

  return (
    <section
      data-ds="metric-tabs-chart"
      aria-labelledby={title ? titleId : undefined}
      aria-busy={loading || undefined}
      className={cn("flex min-w-0 flex-col rounded-frame bg-frame text-foreground shadow-frame", className)}
      {...props}
    >
      {title && (
        <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 pr-3 pl-4">
          <h2 id={titleId} className="truncate text-base leading-5 font-semibold">
            {title}
          </h2>
          {action && (
            <div className="-m-1 flex max-w-[calc(100%+8px)] min-w-0 items-center gap-1 overflow-x-auto p-1">
              {action}
            </div>
          )}
        </header>
      )}
      <div
        role={loading ? undefined : "tablist"}
        aria-label={loading || title ? undefined : "Chart metric"}
        aria-labelledby={!loading && title ? titleId : undefined}
        className="-mx-px -mt-px flex overflow-x-auto overscroll-x-contain px-px pt-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {metrics.map((m) => {
          const selected = !loading && m.key === active?.key
          const plottable = m.plottable ?? m.series?.length > 0
          // While loading the figures are placeholders, so there is nothing to select yet.
          const Tab = loading ? "div" : "button"
          const tabProps = loading
            ? {}
            : {
                type: "button",
                role: "tab",
                id: `${panelId}-tab-${m.key}`,
                "aria-selected": selected,
                "aria-controls": plottable ? `${panelId}-panel` : undefined,
                disabled: !plottable,
                title: m.description,
                onClick: () => onValueChange?.(m.key),
              }
          return (
            <Tab
              key={m.key}
              {...tabProps}
              data-state={selected ? "active" : "inactive"}
              className={cn(
                "group/metric-tab relative z-[1] flex min-w-40 flex-auto flex-col items-start gap-1.5 rounded-t-frame px-5 py-[18px] text-left outline-none",
                "focus-visible:shadow-focus data-[state=active]:bg-background data-[state=active]:shadow-[1px_0_0_var(--color-surface-ring),-1px_0_0_var(--color-surface-ring),0_-1px_0_var(--color-surface-ring)]",
                "transition-colors disabled:cursor-default data-[state=inactive]:enabled:hover:bg-choice-hover"
              )}
            >
              <span className="text-sm leading-[18px] font-medium whitespace-nowrap text-muted-foreground group-data-[state=active]/metric-tab:text-foreground">
                {m.label}
                {!loading && !plottable && <span className="sr-only">, no trend available</span>}
              </span>
              {loading ? (
                <>
                  <Skeleton className="my-1 h-[26px] w-28 rounded-control-sm bg-skeleton" />
                  <Skeleton className="h-3 w-16 rounded-sm bg-skeleton" />
                </>
              ) : (
                <>
                  <span
                    data-slot="metric-tab-value"
                    className="text-[28px] leading-[34px] font-medium tracking-[-0.02em] text-ink-secondary tabular-nums group-data-[state=active]/metric-tab:text-foreground"
                  >
                    {m.value}
                  </span>
                  {m.delta ? (
                    <Delta
                      change={m.delta.change}
                      format={m.delta.format}
                      goodWhen={m.goodWhen}
                      comparison={m.delta.comparison}
                    />
                  ) : m.caption ? (
                    <span className="text-xs leading-4 text-muted-foreground">{m.caption}</span>
                  ) : null}
                </>
              )}
            </Tab>
          )
        })}
      </div>

      <div
        id={`${panelId}-panel`}
        role="tabpanel"
        aria-labelledby={active ? `${panelId}-tab-${active.key}` : undefined}
        className={cn(
          "flex flex-col gap-3 rounded-frame bg-background px-5 pt-5 pb-4 shadow-surface outline-none",
          firstChosen && "rounded-tl-none",
          lastChosen && "rounded-tr-none"
        )}
      >
        {loading || plotLoading ? (
          <Skeleton className="h-56 w-full rounded-control bg-skeleton" />
        ) : plotFallback ? (
          <div className="flex min-h-56 items-center justify-center">{plotFallback}</div>
        ) : series?.length > 0 ? (
          <div className="h-56" aria-label={xLabel}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                <XAxis
                  dataKey="x"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12, fontFamily: "var(--font-mono)" }}
                />
                <Tooltip
                  animationDuration={TOOLTIP_MS}
                  cursor={{ stroke: "var(--color-border)" }}
                  content={<ChartTooltip formatValue={formatValue} metric={active} />}
                />
                {/* Keyed on the metric (and redrawKey) so switching tabs or buckets replays the draw. */}
                <Area
                  key={`prev-${active.key}-${redrawKey}`}
                  dataKey="previous"
                  type="monotone"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="4 5"
                  fill="none"
                  dot={false}
                  activeDot={false}
                  animationDuration={DRAW_MS}
                />
                <Area
                  key={`cur-${active.key}-${redrawKey}`}
                  dataKey="current"
                  type="monotone"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-chart-1)", stroke: "var(--color-background)", strokeWidth: 2 }}
                  animationDuration={DRAW_MS}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center">
            <p className="max-w-[40ch] text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Adapter from `portfolio/MetricTabsChart` props to this component's `metrics`.
 * `tabs[].delta` is a pre-formatted string and `direction`/`polarity` carry the sign
 * and meaning, so they are folded back into a signed `delta.change` plus `goodWhen`.
 * Only the active tab receives a series (the portfolio chart only has that one); the others
 * stay selectable via `plottable` and the hub re-derives `chart` when the active key changes.
 * Spread `loading`, `plotLoading`, `emptyMessage` onto MetricTabsChart directly (same names).
 *
 * @param {{tabs: object[], activeKey: string, chart?: {values: number[], labels: string[], tooltipLabels?: string[]}|null, comparison?: React.ReactNode}} input
 *   `comparison` is what every delta is measured against ("vs previous period")
 */
function fromPortfolioTabs({ tabs, activeKey, chart, comparison }) {
  return tabs.map((tab) => {
    const magnitude = parseFloat(String(tab.delta ?? ""))
    const change =
      tab.direction && Number.isFinite(magnitude) ? (tab.direction === "down" ? -magnitude : magnitude) : undefined
    const plotted = tab.plottable !== false && tab.key === activeKey && chart?.values?.length > 0
    return {
      key: tab.key,
      label: tab.label,
      value: tab.value,
      plottable: tab.plottable !== false,
      delta: change === undefined ? undefined : { change, format: "percent", comparison },
      goodWhen: tab.polarity === "lower-is-better" ? "down" : "up",
      series: plotted
        ? chart.values.map((current, i) => ({
            x: chart.labels?.[i] ?? "",
            current,
            tooltipLabel: chart.tooltipLabels?.[i],
          }))
        : undefined,
    }
  })
}

export { MetricTabsChart, fromPortfolioTabs, ChartTooltip }

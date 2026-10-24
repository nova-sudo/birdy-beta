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
      <div className="num text-sm font-medium">{formatValue(row.current, metric)}</div>
      {row.previous != null && (
        <div className="num text-xs opacity-70">Previous {formatValue(row.previous, metric)}</div>
      )}
    </div>
  )
}

/**
 * Metric tabs that rise into a white chart surface. The tabs are a tablist;
 * the active one joins the chart panel below it. A metric with no `series`
 * is still drawn as a figure but is disabled, so the row keeps its order.
 *
 * Adapter: `portfolio/MetricTabsChart` takes `{tabs, activeKey, onChange, chart}` with
 * pre-formatted strings and one series (`chart.values`/`labels`). Use `fromPortfolioTabs`
 * to turn that into this component's `metrics`; only the active metric gets a series there.
 *
 * @param {object} props
 * @param {{key: string, label: React.ReactNode, value: React.ReactNode, delta?: number|null, invert?: boolean, caption?: React.ReactNode, series?: {x: string, current: number, previous?: number|null, tooltipLabel?: string}[]}[]} props.metrics
 * @param {string} props.value Active metric key
 * @param {(key: string) => void} props.onValueChange
 * @param {(n: number, metric: object) => React.ReactNode} [props.formatValue] Tooltip number formatter
 * @param {string} [props.xLabel] Accessible name for the x axis
 * @param {boolean} [props.loading] Figures not yet available: skeleton tabs and plot
 * @param {boolean} [props.plotLoading] Series still counting: skeleton plot only
 * @param {React.ReactNode} [props.emptyMessage] Shown in the plot when the active metric has no series
 *
 * A metric is selectable when `plottable` is not false, even with no `series` yet:
 * the panel shows the empty state until the hub supplies the series for the new tab.
 */
function MetricTabsChart({
  metrics,
  value,
  onValueChange,
  formatValue = (n) => n.toLocaleString("en-GB"),
  xLabel,
  loading = false,
  plotLoading = false,
  emptyMessage = "Nothing to plot for this window yet.",
  className,
  ...props
}) {
  const panelId = React.useId()
  const gradientId = `${panelId.replace(/:/g, "")}-fill`
  const active = metrics.find((m) => m.key === value) ?? metrics[0]
  const series = active?.series
  const columns = metrics.length
  const smallColumns = columns >= 6 ? 3 : 2

  return (
    <div
      data-ds="metric-tabs-chart"
      className={cn("flex min-w-0 flex-col rounded-frame bg-muted p-1 pb-0", className)}
      {...props}
    >
      <div
        role={loading ? undefined : "tablist"}
        aria-label={loading ? undefined : "Chart metric"}
        // Two or three across below lg (as the portfolio chart did), the full row from lg up.
        className="grid gap-1 [grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
        style={{ "--cols": columns, "--cols-sm": smallColumns }}
      >
        {loading
          ? metrics.map((m) => (
              <div key={m.key} className="flex flex-col items-start gap-2 px-4 pt-3 pb-3">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-sm" />
              </div>
            ))
          : metrics.map((m) => {
          const selected = m.key === active?.key
          const plottable = m.plottable ?? m.series?.length > 0
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              id={`${panelId}-tab-${m.key}`}
              aria-selected={selected}
              aria-controls={plottable ? `${panelId}-panel` : undefined}
              disabled={!plottable}
              onClick={() => onValueChange?.(m.key)}
              className={cn(
                "flex min-w-0 flex-col items-start gap-1 rounded-t-surface px-4 pt-3 pb-3 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                selected ? "bg-background shadow-surface" : "hover:bg-background/60 disabled:cursor-default disabled:hover:bg-transparent"
              )}
            >
              <span className="truncate text-sm font-medium text-body">
                {m.label}
                {!plottable && <span className="sr-only">, no trend available</span>}
              </span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="num text-figure font-medium text-foreground">{m.value}</span>
                {m.delta !== undefined && <Delta value={m.delta} invert={m.invert} />}
              </span>
              {m.caption && <span className="truncate text-xs text-muted-foreground">{m.caption}</span>}
            </button>
          )
        })}
      </div>

      <div
        id={`${panelId}-panel`}
        role="tabpanel"
        aria-labelledby={active ? `${panelId}-tab-${active.key}` : undefined}
        className="rounded-b-frame bg-background px-4 pt-4 pb-3 shadow-surface"
      >
        {loading || plotLoading ? (
          <Skeleton className="h-56 w-full rounded-surface" />
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
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
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
                {/* Keyed on the metric so switching tabs replays the draw. */}
                <Area
                  key={`prev-${active.key}`}
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
                  key={`cur-${active.key}`}
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
    </div>
  )
}

/**
 * Adapter from `portfolio/MetricTabsChart` props to this component's `metrics`.
 * `tabs[].delta` is a pre-formatted string and `direction`/`polarity` carry the sign
 * and meaning, so they are folded back into a signed number plus `invert`.
 * Only the active tab receives a series (the portfolio chart only has that one); the others
 * stay selectable via `plottable` and the hub re-derives `chart` when the active key changes.
 * Spread `loading`, `plotLoading`, `emptyMessage` onto MetricTabsChart directly (same names).
 *
 * @param {{tabs: object[], activeKey: string, chart?: {values: number[], labels: string[], tooltipLabels?: string[]}|null}} input
 */
function fromPortfolioTabs({ tabs, activeKey, chart }) {
  return tabs.map((tab) => {
    const magnitude = parseFloat(String(tab.delta ?? ""))
    const delta = tab.direction && Number.isFinite(magnitude) ? (tab.direction === "down" ? -magnitude : magnitude) : undefined
    const plotted = tab.plottable !== false && tab.key === activeKey && chart?.values?.length > 0
    return {
      key: tab.key,
      label: tab.label,
      value: tab.value,
      plottable: tab.plottable !== false,
      delta,
      invert: tab.polarity === "lower-is-better",
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

export { MetricTabsChart, fromPortfolioTabs }

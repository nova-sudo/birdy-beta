"use client"
import { Component, useId } from "react"
import { useReducedMotion } from "framer-motion"
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart,
  ResponsiveContainer, Text, Tooltip, XAxis, YAxis,
} from "recharts"
import { formatTick, formatValue, SERIES_COLORS, shapeChart } from "@/lib/chat-viz"

// A recharts crash shouldn't wipe the whole answer: say the chart failed and
// leave the prose around it standing.
class ChartErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) {
    if (typeof console !== "undefined") console.error("InlineChart render error:", error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="not-prose my-3 rounded-control bg-warning-soft p-3 text-xs text-warning-ink">
          <div className="mb-1 font-semibold">Chart failed to render</div>
          <div className="opacity-75">{String(this.state.error?.message || this.state.error)}</div>
        </div>
      )
    }
    return this.props.children
  }
}

const AXIS_TICK = { fontSize: 10.5, fill: "var(--color-muted-foreground)" }

// A handful of categories (clients, campaigns) each get their label, wrapped
// to two lines in their own slot, instead of recharts dropping the ones that
// would collide in a narrow panel.
function CategoryTick({ x, y, payload, width, visibleTicksCount }) {
  const slot = Math.max(40, (width || 0) / Math.max(1, visibleTicksCount || 1) - 6)
  return (
    <Text x={x} y={y} width={slot} maxLines={2} textAnchor="middle" verticalAnchor="start" {...AXIS_TICK}>
      {payload.value}
    </Text>
  )
}

/**
 * An inline chart from a :::chart block — line, area, bar, combo or donut,
 * drawn in the hubs' chart language: chart tokens, a gradient under
 * lines, baseline-only grid, and a dark tooltip.
 *
 * Payload (render_ui, birdy-backend ai/tools/render_ui_tools.py):
 *   { type, title?, subtitle?, format?, currency?, data: [{label, value}] }
 *   { type, ..., data: [{label, spend, cpl}], series: [{key, name, type, axis, format, currency}] }
 * Older hand-typed payloads (color, orientation, sort, inferred series) still render.
 */
export default function InlineChart({ payload }) {
  return (
    <ChartErrorBoundary>
      <InlineChartInner payload={payload} />
    </ChartErrorBoundary>
  )
}

function InlineChartInner({ payload }) {
  const chart = shapeChart(payload)
  const reduceMotion = useReducedMotion()
  const gradientId = useId().replace(/:/g, "")

  if (!chart) {
    return (
      <figure className="not-prose my-3 rounded-surface border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
        {payload?.title ? `${payload.title}: no data to chart.` : "No data to chart."}
      </figure>
    )
  }

  const animate = !reduceMotion
  const height = chart.kind === "donut"
    ? 200
    : chart.horizontal
      ? Math.min(Math.max(chart.rows.length * 30 + 24, 150), 520)
      : 240

  return (
    <figure
      className="not-prose my-3 overflow-hidden rounded-surface bg-background px-4 pb-3 pt-3.5 shadow-surface"
      aria-label={chart.title || "Chart"}
    >
      <ChartHeader chart={chart} />
      {chart.kind === "donut" ? (
        <Donut chart={chart} height={height} animate={animate} />
      ) : (
        <div style={{ height }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chart.horizontal
              ? <HorizontalBars chart={chart} animate={animate} />
              : <Cartesian chart={chart} animate={animate} gradientId={gradientId} />}
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}

function ChartHeader({ chart }) {
  const showLegend = chart.multi
  if (!chart.title && !chart.subtitle && !showLegend) return null
  return (
    <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
      <div className="min-w-0">
        {chart.title && (
          <div className="text-sm font-semibold leading-snug text-foreground">{chart.title}</div>
        )}
        {chart.subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{chart.subtitle}</div>}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5" aria-label="Legend">
          {chart.series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs font-medium text-body">
              <span
                className={s.type === "bar" ? "size-2.5 rounded-[3px]" : "h-[3px] w-3 rounded-full"}
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.name}
              {s.axis === "right" && <span className="text-muted-foreground">(right)</span>}
            </li>
          ))}
        </ul>
      )}
    </figcaption>
  )
}

/** A dark pill hung off the hovered point, one line per series. */
function DarkTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-control bg-foreground px-2.5 py-2 text-background shadow-floating">
      <div className="mb-1 text-xs text-background/70">{label}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey) || series[0]
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-xs leading-5">
            {series.length > 1 && (
              <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            )}
            {series.length > 1 && <span className="text-background/70">{s.name}</span>}
            <span className="num ml-auto font-semibold">{formatValue(p.value, s.format, s.currency)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Cartesian({ chart, animate, gradientId, ...rest }) {
  const left = chart.series.find((s) => s.axis === "left") || chart.series[0]
  const right = chart.series.find((s) => s.axis === "right")
  const manyPoints = chart.rows.length > 12
  const fewCategories = chart.rows.length <= 6
  return (
    <ComposedChart {...rest} data={chart.rows} margin={{ top: 18, right: right ? 4 : 8, bottom: 0, left: 0 }}>
      <defs>
        {chart.series.map((s, i) => (
          <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid vertical={false} stroke="var(--color-border)" />
      <XAxis
        dataKey="label"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={{ stroke: "var(--color-border)" }}
        {...(fewCategories
          ? { interval: 0, tick: <CategoryTick />, height: 38 }
          : { interval: "preserveStartEnd", minTickGap: 18 })}
        tickMargin={8}
      />
      <YAxis
        yAxisId="left"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(v) => formatTick(v, left.format, left.currency)}
      />
      {right && (
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={(v) => formatTick(v, right.format, right.currency)}
        />
      )}
      <Tooltip
        cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3", fill: "var(--color-primary-soft)", fillOpacity: 0.5 }}
        content={<DarkTooltip series={chart.series} />}
      />
      {chart.series.map((s, i) => {
        const common = {
          dataKey: s.key,
          name: s.name,
          yAxisId: s.axis,
          isAnimationActive: animate,
          animationDuration: 700,
        }
        if (s.type === "bar") {
          return (
            <Bar key={s.key} {...common} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={chart.multi ? 22 : 36}>
              {!chart.multi && !manyPoints && (
                <LabelList
                  dataKey={s.key}
                  position="top"
                  formatter={(v) => formatTick(v, s.format, s.currency)}
                  style={{ fontSize: 10.5, fill: "var(--color-body)", fontWeight: 600 }}
                />
              )}
            </Bar>
          )
        }
        // A lone line gets the hubs' gradient underneath; overlaid lines stay
        // bare so their fills don't muddy each other.
        const filled = s.type === "area" || (!chart.multi && s.type === "line")
        const lineProps = {
          ...common,
          type: "monotone",
          stroke: s.color,
          strokeWidth: 2.5,
          dot: manyPoints ? false : { r: 3, strokeWidth: 2, stroke: "var(--color-background)", fill: s.color },
          activeDot: { r: 5, strokeWidth: 2, stroke: "var(--color-background)", fill: s.color },
          connectNulls: true,
        }
        return filled
          ? <Area key={s.key} {...lineProps} fill={`url(#${gradientId}-${i})`} fillOpacity={1} />
          : <Line key={s.key} {...lineProps} />
      })}
    </ComposedChart>
  )
}

function HorizontalBars({ chart, animate, ...rest }) {
  const s = chart.series[0]
  return (
    <ComposedChart {...rest} layout="vertical" data={chart.rows} margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
      <XAxis type="number" hide />
      <YAxis
        dataKey="label"
        type="category"
        tick={{ fontSize: 11.5, fill: "var(--color-body)" }}
        tickLine={false}
        axisLine={false}
        width={128}
        interval={0}
        tickFormatter={(v) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
      />
      <Tooltip cursor={{ fill: "var(--color-primary-soft)", fillOpacity: 0.6 }} content={<DarkTooltip series={chart.series} />} />
      <Bar
        dataKey={s.key}
        name={s.name}
        fill={s.color}
        radius={[0, 6, 6, 0]}
        barSize={16}
        background={{ fill: "var(--color-muted)", radius: 6 }}
        isAnimationActive={animate}
        animationDuration={700}
      >
        <LabelList
          dataKey={s.key}
          position="right"
          formatter={(v) => formatValue(v, s.format, s.currency)}
          style={{ fontSize: 11, fill: "var(--color-foreground)", fontWeight: 600 }}
        />
      </Bar>
    </ComposedChart>
  )
}

function Donut({ chart, height, animate }) {
  const s = chart.series[0]
  return (
    <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chart.rows}
              dataKey={s.key}
              nameKey="label"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={1.5}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={animate}
              animationDuration={700}
            >
              {chart.rows.map((_, i) => (
                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip series={s} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-lg font-semibold text-foreground">{formatTick(chart.total, s.format, s.currency)}</span>
          <span className="text-xs text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {chart.rows.map((r, i) => (
          <li key={r.label + i} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden="true" />
            <span className="min-w-0 truncate text-body">{r.label}</span>
            <span className="num ml-auto font-semibold text-foreground">{formatValue(r[s.key], s.format, s.currency)}</span>
            <span className="num w-10 text-right text-muted-foreground">
              {chart.total ? `${Math.round((r[s.key] / chart.total) * 100)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DonutTooltip({ active, payload, series }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-control bg-foreground px-2.5 py-1.5 text-background shadow-floating">
      <div className="num text-xs font-semibold">{formatValue(p.value, series.format, series.currency)}</div>
      <div className="mt-0.5 text-xs text-background/70">{p.name}</div>
    </div>
  )
}

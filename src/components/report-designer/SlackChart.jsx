"use client"

// Slack's native chart block (type "data_visualization"), drawn for the preview:
// line, bar, area and pie, one or many series, negative values included. The
// shape is Slack's own — chart.series[].data[{label, value}] against
// chart.axis_config.categories, or chart.segments for a pie — so what renders
// here is exactly the payload that will be posted.
//
// Palette: the dataviz reference categorical hues, stepped for a dark surface
// and validated against Slack's dark surface (all six checks pass). Assigned in
// fixed order; a legend appears from two series up, and the tooltip carries the
// values, so identity never rests on colour alone.

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"

import { SLACK_CHART_COLORS, SLACK_CHART_EXTRA, SLACK_PREVIEW } from "@/lib/brand-colors"

export const CHART_COLORS = SLACK_CHART_COLORS

const color = (i) => CHART_COLORS[i] ?? SLACK_CHART_EXTRA

const compact = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k`
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

const axis = { stroke: "rgba(255,255,255,0.18)", tick: { fill: "rgba(255,255,255,0.6)", fontSize: 11 } }
const tooltipStyle = {
  contentStyle: { background: SLACK_PREVIEW.raised, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "rgba(255,255,255,0.85)", fontWeight: 600 },
  itemStyle: { color: "rgba(255,255,255,0.85)" },
}

/** Slack's series shape → recharts rows: [{ label, [seriesName]: value }]. */
export function toRows(chart) {
  const cats = chart?.axis_config?.categories || []
  return cats.map((label) => {
    const row = { label }
    for (const s of chart.series || []) {
      row[s.name] = s.data?.find((d) => d.label === label)?.value ?? 0
    }
    return row
  })
}

export default function SlackChart({ block }) {
  const chart = block.chart || {}
  const series = chart.series || []
  const multi = series.length > 1
  const hasNegative = series.some((s) => s.data?.some((d) => d.value < 0))

  let body = null
  if (chart.type === "pie") {
    const segs = chart.segments || []
    const total = segs.reduce((a, s) => a + s.value, 0) || 1
    body = (
      <PieChart>
        <Pie data={segs} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={1.5}
          stroke={SLACK_PREVIEW.surface} strokeWidth={2} isAnimationActive={false}>
          {segs.map((s, i) => <Cell key={s.label} fill={color(i)} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${compact(v)} (${((v / total) * 100).toFixed(0)}%)`, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }} />
      </PieChart>
    )
  } else if (["line", "bar", "area"].includes(chart.type)) {
    const rows = toRows(chart)
    // Recharts finds axes, legend and tooltip among the chart's direct
    // children only — wrapped in a fragment they silently don't render.
    const common = [
      <CartesianGrid key="grid" vertical={false} stroke="rgba(255,255,255,0.08)" />,
      <XAxis key="x" dataKey="label" {...axis} tickLine={false} interval="preserveStartEnd"
        label={chart.axis_config?.x_label ? { value: chart.axis_config.x_label, position: "insideBottom", offset: -2, fill: "rgba(255,255,255,0.5)", fontSize: 11 } : undefined} />,
      <YAxis key="y" {...axis} tickLine={false} axisLine={false} width={44} tickFormatter={compact}
        label={chart.axis_config?.y_label ? { value: chart.axis_config.y_label, angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.5)", fontSize: 11 } : undefined} />,
      hasNegative && <ReferenceLine key="zero" y={0} stroke="rgba(255,255,255,0.35)" />,
      <Tooltip key="tip" {...tooltipStyle} formatter={(v) => compact(v)} cursor={{ fill: "rgba(255,255,255,0.05)", stroke: "rgba(255,255,255,0.25)" }} />,
      multi && <Legend key="legend" verticalAlign="top" align="left" height={26} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }} />,
    ].filter(Boolean)
    if (chart.type === "bar") {
      body = (
        <BarChart data={rows} barCategoryGap="22%" barGap={2} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
          {common}
          {series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={color(i)} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={36} />)}
        </BarChart>
      )
    } else if (chart.type === "area") {
      body = (
        <AreaChart data={rows} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
          {common}
          {series.map((s, i) => (
            <Area key={s.name} type="monotone" dataKey={s.name} stroke={color(i)} strokeWidth={2}
              fill={color(i)} fillOpacity={0.18} isAnimationActive={false} />
          ))}
        </AreaChart>
      )
    } else {
      body = (
        <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
          {common}
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={color(i)} strokeWidth={2}
              dot={rows.length <= 12 ? { r: 3, strokeWidth: 0, fill: color(i) } : false}
              activeDot={{ r: 5, stroke: SLACK_PREVIEW.surface, strokeWidth: 2 }} isAnimationActive={false} />
          ))}
        </LineChart>
      )
    }
  }

  return (
    <figure className="rounded-lg border border-white/10 bg-white/[0.03] px-3 pb-2 pt-2.5" aria-label={block.title}>
      <figcaption className="mb-1.5 text-xs font-semibold text-white">{block.title}</figcaption>
      {body ? (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">{body}</ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-white/50">This chart has no data yet.</p>
      )}
    </figure>
  )
}

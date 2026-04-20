"use client"
import {
  BarChart, Bar, LineChart, Line, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Legend,
} from "recharts"
import { formatCompact } from "@/lib/format-metric"

const PALETTE = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7", "#f97316"]

/**
 * Renders an inline chart from a :::chart block.
 *
 * Single-series payload:
 *   { type?: "bar"|"line"|"donut", title?, data: [{label, value}], color?, currency?, orientation?, sort? }
 *
 * Multi-series payload (for overlaying lines, combo charts, etc.):
 *   {
 *     type?: "line"|"bar"|"composed",
 *     title?,
 *     data: [{label: "Jan", spend: 1200, cpl: 3.5}, ...],
 *     series: [
 *       {key: "spend", name: "Ad Spend", type: "line"|"bar", color, axis: "left"|"right", currency: "£"},
 *       {key: "cpl",   name: "CPL",      type: "line",       color, axis: "right",        currency: "£"}
 *     ]
 *   }
 */
export default function InlineChart({ payload }) {
  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) return null

  const {
    type = "bar",
    title,
    data,
    color = "#8b5cf6",
    currency,
    orientation = "auto",
    sort = true,
    series,
  } = payload

  // Detect multi-series mode (either explicit `series` or data rows with multiple numeric keys besides "label")
  const seriesList = normalizeSeries(series, data, color, currency)
  const isMultiSeries = seriesList.length > 1

  // Normalize data rows for recharts: keep `label` and all series keys
  let normalized = data.map(d => {
    const row = { label: String(d.label ?? d.name ?? "") }
    if (isMultiSeries) {
      for (const s of seriesList) {
        const v = d[s.key]
        row[s.key] = v === null || v === undefined ? null : Number(v)
      }
    } else {
      row.value = Number(d.value ?? d[seriesList[0].key] ?? 0)
    }
    return row
  })

  // Sort (single-series only; multi-series is usually time ordered)
  if (!isMultiSeries && sort && type !== "line") {
    normalized = [...normalized].sort((a, b) => b.value - a.value)
  }
  // Drop zero-valued rows from single-series bar charts
  if (!isMultiSeries && type === "bar") {
    normalized = normalized.filter(d => d.value > 0)
  }

  if (normalized.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-border/50 bg-white p-4 shadow-sm text-sm text-muted-foreground text-center">
        No data to display.
      </div>
    )
  }

  const singleValueFormatter = (v) => currency ? `${currency}${formatCompact(v)}` : formatCompact(v)

  // Bar orientation decision for single-series bar charts
  const longestLabel = normalized.reduce((m, d) => Math.max(m, d.label.length), 0)
  const isHorizontal = !isMultiSeries && type === "bar" && (
    orientation === "horizontal" ||
    (orientation === "auto" && (normalized.length > 5 || longestLabel > 12))
  )

  const rowHeight = 28
  const chartHeight = isHorizontal
    ? Math.min(Math.max(normalized.length * rowHeight + 40, 160), 560)
    : isMultiSeries
      ? 320
      : 260

  // Whether we need a dual-axis composed chart
  const hasRightAxis = isMultiSeries && seriesList.some(s => s.axis === "right")

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-white p-3 shadow-sm">
      {title && (
        <div className="mb-2 px-1 text-xs font-semibold text-foreground/80">{title}</div>
      )}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {isMultiSeries ? (
            <ComposedChart data={normalized} margin={{ top: 16, right: hasRightAxis ? 44 : 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10 }}
                stroke={seriesList.find(s => s.axis === "left")?.color || "#94a3b8"}
                tickFormatter={formatCompact}
                width={48}
              />
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  stroke={seriesList.find(s => s.axis === "right")?.color || "#94a3b8"}
                  tickFormatter={formatCompact}
                  width={44}
                />
              )}
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v, name, entry) => {
                  const key = entry?.dataKey
                  const s = seriesList.find(s => s.key === key)
                  const cur = s?.currency || ""
                  return [`${cur}${formatCompact(Number(v))}`, s?.name || name]
                }}
              />
              <Legend
                iconType="line"
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              />
              {seriesList.map((s, i) => {
                const axisId = s.axis === "right" ? "right" : "left"
                const commonProps = {
                  yAxisId: axisId,
                  dataKey: s.key,
                  name: s.name,
                  isAnimationActive: false,
                }
                if ((s.type || type) === "bar") {
                  return <Bar key={s.key} {...commonProps} fill={s.color || PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
                }
                return (
                  <Line
                    key={s.key}
                    {...commonProps}
                    type="monotone"
                    stroke={s.color || PALETTE[i % PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                )
              })}
            </ComposedChart>
          ) : type === "line" ? (
            <LineChart data={normalized} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={formatCompact} width={44} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v) => [singleValueFormatter(v), ""]}
              />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          ) : type === "donut" ? (
            <PieChart>
              <Pie
                data={normalized}
                dataKey="value"
                nameKey="label"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {normalized.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v, n) => [singleValueFormatter(v), n]}
              />
            </PieChart>
          ) : isHorizontal ? (
            <BarChart
              layout="vertical"
              data={normalized}
              margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={formatCompact} />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fontSize: 11 }}
                stroke="#64748b"
                width={140}
                interval={0}
                tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + "…" : v}
              />
              <Tooltip
                cursor={{ fill: "rgba(139,92,246,0.06)" }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v) => [singleValueFormatter(v), ""]}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={singleValueFormatter}
                  style={{ fontSize: 10, fill: "#475569", fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={normalized} margin={{ top: 20, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-15} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={formatCompact} width={44} />
              <Tooltip
                cursor={{ fill: "rgba(139,92,246,0.06)" }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v) => [singleValueFormatter(v), ""]}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={singleValueFormatter}
                  style={{ fontSize: 10, fill: "#475569", fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {!isMultiSeries && type === "donut" && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {normalized.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="text-muted-foreground truncate max-w-[100px]">{d.label}</span>
              <span className="font-medium tabular-nums">{singleValueFormatter(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Build a canonical series list from the payload.
 * - If explicit `series` is provided, use it (fill in defaults).
 * - Else if data rows have multiple numeric keys (beyond "label"), infer series from keys.
 * - Else return a single-series list with key="value".
 */
function normalizeSeries(series, data, fallbackColor, fallbackCurrency) {
  // Explicit series list provided
  if (Array.isArray(series) && series.length > 0) {
    return series.map((s, i) => ({
      key: s.key,
      name: s.name || s.key,
      type: s.type,                    // undefined → inherits from parent `type`
      color: s.color || PALETTE[i % PALETTE.length],
      axis: s.axis === "right" ? "right" : "left",
      currency: s.currency || "",
    }))
  }

  // Infer from data: look at the first row's numeric keys other than "label"/"name"
  const first = data[0] || {}
  const numericKeys = Object.keys(first).filter(
    k => k !== "label" && k !== "name" && k !== "value" && typeof first[k] === "number"
  )
  if (numericKeys.length > 1) {
    return numericKeys.map((k, i) => ({
      key: k,
      name: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
      type: undefined,
      color: PALETTE[i % PALETTE.length],
      axis: i === 0 ? "left" : "right",
      currency: fallbackCurrency || "",
    }))
  }

  // Single-series fallback
  return [{
    key: "value",
    name: "Value",
    type: undefined,
    color: fallbackColor,
    axis: "left",
    currency: fallbackCurrency || "",
  }]
}

"use client"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
} from "recharts"
import { formatCompact } from "@/lib/format-metric"

const PALETTE = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7", "#f97316"]

/**
 * Renders an inline chart from a :::chart block.
 *
 * Payload shape:
 *   { type?: "bar"|"line"|"donut", title?, data: [{label, value}], color?, currency?, orientation?: "auto"|"horizontal"|"vertical", sort?: boolean }
 *
 * Chart type auto-selection:
 *   - `line`   → time series
 *   - `donut`  → proportion of a whole
 *   - `bar`    → default; horizontal layout auto-chosen when there are >5 categories or long labels
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
  } = payload

  // Normalize + sort (descending by default, except for line charts)
  let normalized = data.map(d => ({
    label: String(d.label ?? d.name ?? ""),
    value: Number(d.value ?? 0),
  }))
  if (sort && type !== "line") {
    normalized = [...normalized].sort((a, b) => b.value - a.value)
  }
  // Drop zero-valued entries for bar charts — they clutter the chart
  if (type === "bar") {
    normalized = normalized.filter(d => d.value > 0)
  }

  if (normalized.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-border/50 bg-white p-4 shadow-sm text-sm text-muted-foreground text-center">
        No data to display.
      </div>
    )
  }

  const valueFormatter = (v) => currency ? `${currency}${formatCompact(v)}` : formatCompact(v)

  // Decide orientation for bar charts
  const longestLabel = normalized.reduce((m, d) => Math.max(m, d.label.length), 0)
  const isHorizontal = type === "bar" && (
    orientation === "horizontal" ||
    (orientation === "auto" && (normalized.length > 5 || longestLabel > 12))
  )

  // Dynamic height so we don't cram a lot of rows into 180px
  const rowHeight = 26
  const chartHeight = isHorizontal
    ? Math.min(Math.max(normalized.length * rowHeight + 30, 140), 520)
    : 200

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-white p-3 shadow-sm">
      {title && (
        <div className="mb-2 px-1 text-xs font-semibold text-foreground/80">{title}</div>
      )}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={normalized} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={formatCompact} width={44} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v) => [valueFormatter(v), ""]}
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
                formatter={(v, n) => [valueFormatter(v), n]}
              />
            </PieChart>
          ) : isHorizontal ? (
            // Horizontal bar chart — one row per category, labels on the left, values on the right of each bar
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
                formatter={(v) => [valueFormatter(v), ""]}
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={valueFormatter}
                  style={{ fontSize: 10, fill: "#475569", fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          ) : (
            // Vertical bar chart — small # of categories
            <BarChart data={normalized} margin={{ top: 20, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-15} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={formatCompact} width={44} />
              <Tooltip
                cursor={{ fill: "rgba(139,92,246,0.06)" }}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                formatter={(v) => [valueFormatter(v), ""]}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={valueFormatter}
                  style={{ fontSize: 10, fill: "#475569", fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {type === "donut" && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
          {normalized.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="text-muted-foreground truncate max-w-[100px]">{d.label}</span>
              <span className="font-medium tabular-nums">{valueFormatter(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

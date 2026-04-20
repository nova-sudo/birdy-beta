"use client"
import { TrendingUp, TrendingDown, Minus, DollarSign, Target, Users, Activity, BarChart3 } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { formatMetric, formatDelta } from "@/lib/format-metric"

const ICONS = {
  "dollar-sign": DollarSign,
  target: Target,
  users: Users,
  activity: Activity,
  "bar-chart": BarChart3,
}

/**
 * Renders a single headline KPI card from a :::metric block.
 *
 * Payload shape:
 *   { label, value, format?, delta?, deltaLabel?, sparkline?, icon?, variant?, currency? }
 */
export default function MetricCard({ payload }) {
  if (!payload || typeof payload !== "object") return null

  const {
    label,
    value,
    format = "integer",
    delta,
    deltaLabel,
    sparkline,
    icon,
    variant,
    currency = "$",
  } = payload

  const Icon = ICONS[icon] || null
  const deltaInfo = delta !== undefined ? formatDelta(delta, format, currency) : null
  const sparklineData = Array.isArray(sparkline) && sparkline.length > 1
    ? sparkline.map((v, i) => ({ i, v: Number(v) || 0 }))
    : null

  // Accent color based on variant or delta
  const accentClass = variant === "success" ? "text-emerald-600"
    : variant === "warning" ? "text-amber-600"
    : variant === "error" ? "text-rose-600"
    : "text-purple-600"

  return (
    <div className="my-3 rounded-xl border border-border/50 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span className="truncate">{label}</span>
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
            {formatMetric(value, format, currency)}
          </div>
          {deltaInfo && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              <DeltaChip info={deltaInfo} />
              {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
            </div>
          )}
        </div>

        {sparklineData && (
          <div className="h-12 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="currentColor"
                  strokeWidth={2}
                  dot={false}
                  className={accentClass}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function DeltaChip({ info }) {
  if (!info) return null
  const { label, variant } = info
  const Icon = variant === "positive" ? TrendingUp
    : variant === "negative" ? TrendingDown
    : Minus
  const classes = variant === "positive" ? "bg-emerald-50 text-emerald-700"
    : variant === "negative" ? "bg-rose-50 text-rose-700"
    : "bg-slate-100 text-slate-600"
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${classes}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

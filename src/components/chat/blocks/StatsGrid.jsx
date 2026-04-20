"use client"
import { formatMetric } from "@/lib/format-metric"
import { TrendingUp, TrendingDown } from "lucide-react"

/**
 * Renders a compact multi-KPI grid from a :::stats block.
 *
 * Payload: array of stat objects:
 *   [{ label, value, format?, variant?, delta? }, ...]
 */
export default function StatsGrid({ payload }) {
  if (!Array.isArray(payload) || payload.length === 0) return null

  const cols = payload.length === 2 ? "grid-cols-2"
    : payload.length === 3 ? "grid-cols-3"
    : payload.length >= 4 ? "grid-cols-2 md:grid-cols-4"
    : "grid-cols-1"

  return (
    <div className={`my-3 grid ${cols} gap-2`}>
      {payload.map((s, i) => <Stat key={i} stat={s} />)}
    </div>
  )
}

function Stat({ stat }) {
  const {
    label,
    value,
    format = "integer",
    variant,
    delta,
    currency = "$",
  } = stat || {}

  const accent = variant === "success" ? "text-emerald-600"
    : variant === "warning" ? "text-amber-600"
    : variant === "error" ? "text-rose-600"
    : "text-foreground"

  const deltaNum = typeof delta === "number" ? delta : null
  const DeltaIcon = deltaNum != null
    ? (deltaNum > 0 ? TrendingUp : deltaNum < 0 ? TrendingDown : null)
    : null
  const deltaColor = deltaNum > 0 ? "text-emerald-600"
    : deltaNum < 0 ? "text-rose-600"
    : "text-muted-foreground"

  return (
    <div className="rounded-lg border border-border/50 bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${accent}`}>
        {formatMetric(value, format, currency)}
      </div>
      {DeltaIcon && (
        <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium tabular-nums ${deltaColor}`}>
          <DeltaIcon className="h-3 w-3" />
          {Math.abs(deltaNum).toFixed(format === "percentage" ? 1 : 0)}
          {format === "percentage" ? "%" : ""}
        </div>
      )}
    </div>
  )
}

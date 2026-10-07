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

  const accent = variant === "success" ? "text-pd-success"
    : variant === "warning" ? "text-pd-warning"
    : variant === "error" ? "text-pd-danger"
    : "text-pd-ink"

  const deltaNum = typeof delta === "number" ? delta : null
  const DeltaIcon = deltaNum != null
    ? (deltaNum > 0 ? TrendingUp : deltaNum < 0 ? TrendingDown : null)
    : null
  const deltaColor = deltaNum > 0 ? "text-pd-success"
    : deltaNum < 0 ? "text-pd-danger"
    : "text-pd-subtle"

  return (
    <div className="rounded-2xl border border-pd-border bg-pd-surface px-3.5 py-3 shadow-sm">
      <div className="text-[10.5px] uppercase tracking-[.04em] text-pd-faint font-bold truncate">
        {label}
      </div>
      <div className={`mt-0.5 font-pd-display text-[19px] font-bold tabular-nums ${accent}`}>
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

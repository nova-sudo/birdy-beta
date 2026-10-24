"use client"
import { CountUp } from "@/components/motion"
import { Delta } from "@/components/chat/blocks/MetricCard"
import { formatValue, shapeDelta } from "@/lib/chat-viz"

const VARIANT_TEXT = { success: "text-success-ink", warning: "text-warning-ink", error: "text-danger-ink" }

/**
 * 2-4 related KPIs from a :::stats block: one surface split into cells, like
 * the metric group on the hubs, rather than a row of separate boxes.
 *
 * Payload: [{ label, value, format?, currency?, deltaPct?, deltaLabel?, polarity? }, ...]
 * (older replies: { variant, delta }).
 */
export default function StatsGrid({ payload }) {
  if (!Array.isArray(payload) || payload.length === 0) return null
  const items = payload.slice(0, 4)
  const cols = items.length === 1 ? "grid-cols-1"
    : items.length === 2 ? "grid-cols-2"
    : items.length === 3 ? "grid-cols-3"
    : "grid-cols-2 sm:grid-cols-4"

  return (
    <div
      data-ds="metric-group"
      className={`not-prose my-3 grid ${cols} gap-px overflow-hidden rounded-surface bg-border shadow-surface`}
    >
      {items.map((stat, i) => <Stat key={i} stat={stat || {}} />)}
    </div>
  )
}

function Stat({ stat }) {
  const { label, value, format = "integer", currency, variant } = stat
  const delta = shapeDelta(stat)
  return (
    <div className="min-w-0 bg-background p-4">
      <div className="truncate text-sm font-medium text-body">{label}</div>
      <div className={`num mt-1 text-xl font-medium ${VARIANT_TEXT[variant] || "text-foreground"}`}>
        <CountUp value={formatValue(value, format, currency)} />
      </div>
      {delta && (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
          <Delta delta={delta} />
          {delta.label && <span className="truncate text-xs text-muted-foreground">{delta.label}</span>}
        </div>
      )}
    </div>
  )
}

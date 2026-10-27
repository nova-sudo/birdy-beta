"use client"
import { CountUp } from "@/components/motion"
import { Delta } from "@/components/chat/blocks/MetricCard"
import { formatValue, shapeDelta } from "@/lib/chat-viz"

const VARIANT_TEXT = { success: "text-pd-success", warning: "text-pd-amber", error: "text-pd-danger" }

/**
 * 2-4 related KPIs from a :::stats block: one card split into cells, like the
 * KPI strip on the hubs, rather than a row of separate boxes.
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
    <div className={`not-prose my-3 grid ${cols} overflow-hidden rounded-2xl border border-pd-border bg-pd-border shadow-sm`} style={{ gap: 1 }}>
      {items.map((stat, i) => <Stat key={i} stat={stat || {}} />)}
    </div>
  )
}

function Stat({ stat }) {
  const { label, value, format = "integer", currency, variant } = stat
  const delta = shapeDelta(stat)
  return (
    <div className="min-w-0 bg-pd-surface px-4 py-3.5">
      <div className="truncate text-[12px] font-medium text-pd-subtle">{label}</div>
      <div className={`mt-1.5 font-pd-display text-[21px] font-bold leading-none tabular-nums ${VARIANT_TEXT[variant] || "text-pd-ink"}`}>
        <CountUp value={formatValue(value, format, currency)} />
      </div>
      {delta && (
        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          <Delta delta={delta} size="sm" />
          {delta.label && <span className="truncate text-[11px] text-pd-faint">{delta.label}</span>}
        </div>
      )}
    </div>
  )
}

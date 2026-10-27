"use client"
import { useId } from "react"
import { Activity, ArrowDown, ArrowUp, BarChart3, DollarSign, Target, Users } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { CountUp } from "@/components/motion"
import { DeltaPill } from "@/components/portfolio/DeltaPill"
import { toneClass } from "@/components/portfolio/tones"
import { formatValue, shapeDelta } from "@/lib/chat-viz"

const ICONS = {
  "dollar-sign": DollarSign,
  target: Target,
  users: Users,
  activity: Activity,
  "bar-chart": BarChart3,
}

const VARIANT_TONE = { success: "success", warning: "warning", error: "danger" }

/**
 * One headline KPI from a :::metric block, in the hubs' stat-tile language:
 * the figure, its label, a polarity-aware delta pill and a sparkline.
 *
 * Payload: { label, value, format?, currency?, deltaPct?, deltaLabel?, polarity?: "lower"|"higher",
 *            sparkline?, subtitle? } — plus the older { delta, icon, variant }.
 */
export default function MetricCard({ payload }) {
  const gradientId = useId().replace(/:/g, "")
  if (!payload || typeof payload !== "object") return null

  const { label, value, format = "integer", currency, sparkline, subtitle, icon, variant } = payload
  const delta = shapeDelta(payload)
  const Icon = ICONS[icon]
  const spark = Array.isArray(sparkline) && sparkline.length > 1
    ? sparkline.map((v, i) => ({ i, v: Number(v) || 0 }))
    : null

  return (
    <div className="not-prose my-3 flex max-w-[460px] items-end justify-between gap-4 rounded-2xl border border-pd-border bg-pd-surface px-[18px] py-4 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${toneClass(VARIANT_TONE[variant] || "primary")}`}>
              <Icon className="size-[14px]" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-[12.5px] font-medium text-pd-subtle">{label}</span>
        </div>
        <div className="mt-2 font-pd-display text-[30px] font-bold leading-none tabular-nums text-pd-ink">
          <CountUp value={formatValue(value, format, currency)} />
        </div>
        {(delta || subtitle) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {delta && <Delta delta={delta} size="md" />}
            {(delta?.label || subtitle) && (
              <span className="text-[12px] text-pd-faint">{delta?.label || subtitle}</span>
            )}
          </div>
        )}
      </div>

      {spark && (
        <div className="h-14 w-32 shrink-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pd-primary)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--pd-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--pd-primary)"
                strokeWidth={2.25}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/**
 * The hubs' delta pill. Grey when nothing moved, or when the metric is
 * neutral (spend going up isn't good or bad by itself): the arrow still
 * says which way.
 */
export function Delta({ delta, size = "md" }) {
  if (!delta.direction || delta.polarity === "neutral") {
    const Arrow = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : null
    return (
      <span className={`inline-flex shrink-0 items-center rounded-full bg-pd-neutral-badge font-bold text-pd-subtle ${size === "md" ? "gap-[5px] px-[9px] py-[5px] text-[12px]" : "gap-1 px-[7px] py-1 text-[10.5px]"}`}>
        {Arrow && <Arrow className={size === "md" ? "size-3" : "size-[11px]"} strokeWidth={3} aria-hidden="true" />}
        {Arrow && <span className="sr-only">{delta.direction} </span>}
        {delta.value}
      </span>
    )
  }
  return <DeltaPill direction={delta.direction} value={delta.value} polarity={delta.polarity} size={size} />
}

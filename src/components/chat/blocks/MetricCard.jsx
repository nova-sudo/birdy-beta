"use client"
import { useId } from "react"
import { Activity, BarChart3, DollarSign, Target, Users } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { CountUp } from "@/components/motion"
import { cn } from "@/lib/utils"
import { formatValue, shapeDelta } from "@/lib/chat-viz"
import { LOWER_IS_BETTER } from "@/lib/portfolio-metrics"

const ICONS = {
  "dollar-sign": DollarSign,
  target: Target,
  users: Users,
  activity: Activity,
  "bar-chart": BarChart3,
}

const VARIANT_TONE = {
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  error: "bg-danger-soft text-danger-ink",
}

/**
 * One headline KPI from a :::metric block, in the ds MetricCard's layout:
 * label, the figure, a polarity-aware change and a sparkline.
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
    <div
      data-ds="metric-card"
      className="not-prose my-3 flex max-w-[460px] items-end justify-between gap-4 rounded-surface bg-background p-4 shadow-surface"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-sm", VARIANT_TONE[variant] || "bg-primary-soft text-primary")}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-sm font-medium text-body">{label}</span>
        </div>
        <div className="num mt-2 text-figure font-medium text-foreground">
          <CountUp value={formatValue(value, format, currency)} />
        </div>
        {(delta || subtitle) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {delta && <Delta delta={delta} />}
            {(delta?.label || subtitle) && (
              <span className="text-xs text-muted-foreground">{delta?.label || subtitle}</span>
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
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-chart-1)"
                strokeWidth={1.5}
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
 * The ds Delta's look (literal arrow, green good / red bad) for a figure the
 * server already formatted. Grey when nothing moved, or when the metric is
 * neutral (spend going up isn't good or bad by itself): the arrow still says
 * which way. ds `Delta` takes a raw percent only, and chat deltas also arrive
 * as currency or counts, so this takes the shaped string.
 */
export function Delta({ delta }) {
  const up = delta.direction === "up"
  const neutral = !delta.direction || delta.polarity === "neutral"
  const good = delta.polarity === LOWER_IS_BETTER ? !up : up
  return (
    <span
      data-ds="delta"
      data-direction={delta.direction ?? "flat"}
      className={cn(
        "num inline-flex shrink-0 items-center gap-0.5 text-sm font-medium",
        neutral ? "text-muted-foreground" : good ? "text-success-ink" : "text-danger-ink"
      )}
    >
      {delta.direction && <span aria-hidden="true">{up ? "↑" : "↓"}</span>}
      {delta.direction && <span className="sr-only">{up ? "Up " : "Down "}</span>}
      {delta.value}
    </span>
  )
}

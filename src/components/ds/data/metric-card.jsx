import * as React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"
import { Delta } from "./delta"

/**
 * One headline figure: label, value, change and an optional sparkline.
 *
 * @param {object} props
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} props.value Already formatted
 * @param {number|null} [props.delta] Signed percent change; omit for none
 * @param {boolean} [props.invert] Cost metric: falling is good
 * @param {React.ReactNode} [props.caption] Muted line under the value
 * @param {number[]} [props.spark] Sparkline points
 */
function MetricCard({ label, value, delta, invert, caption, spark, className, ...props }) {
  const points = spark?.map((v, i) => ({ i, v }))
  return (
    <div
      data-ds="metric-card"
      className={cn("flex min-w-0 flex-col gap-1 rounded-surface bg-background p-4 shadow-surface", className)}
      {...props}
    >
      <span className="truncate text-sm font-medium text-body">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="num text-figure font-medium text-foreground">{value}</span>
        {delta !== undefined && <Delta value={delta} invert={invert} />}
      </div>
      {caption && <span className="truncate text-xs text-muted-foreground">{caption}</span>}
      {points?.length > 1 && (
        <div className="mt-2 h-10" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Area
                dataKey="v"
                type="monotone"
                stroke="var(--color-chart-1)"
                strokeWidth={1.5}
                fill="var(--color-chart-1)"
                fillOpacity={0.1}
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

export { MetricCard }

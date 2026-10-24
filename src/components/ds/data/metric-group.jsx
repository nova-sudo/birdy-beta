import * as React from "react"

import { cn } from "@/lib/utils"
import { MetricCard } from "./metric-card"

/**
 * Titled row of MetricCards on a muted frame.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.meta]
 * @param {React.ReactNode} [props.action] Right-aligned control
 * @param {object[]} props.items MetricCard props, plus an optional `key`
 */
function MetricGroup({ title, meta, action, items, className, ...props }) {
  return (
    <section
      data-ds="metric-group"
      className={cn("flex flex-col gap-3 rounded-frame bg-muted p-3", className)}
      {...props}
    >
      <header className="flex min-h-control-sm items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          {meta && <span className="truncate text-sm text-muted-foreground">{meta}</span>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
        {items.map(({ key, ...item }, i) => (
          <MetricCard key={key ?? i} {...item} />
        ))}
      </div>
    </section>
  )
}

export { MetricGroup }

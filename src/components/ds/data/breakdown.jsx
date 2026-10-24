import * as React from "react"

import { cn } from "@/lib/utils"
import { Delta } from "./delta"

/**
 * Share-of-total list with a segmented bar on top.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.total] Already formatted
 * @param {{key?: string, label: React.ReactNode, color: string, delta?: number|null, invert?: boolean, value: React.ReactNode, share: number}[]} props.rows
 *   `color` is a CSS colour value, e.g. "var(--color-chart-2)"; `share` is 0-100
 */
function Breakdown({ title, total, rows, className, ...props }) {
  return (
    <div
      data-ds="breakdown"
      className={cn("flex flex-col gap-3 rounded-surface bg-background p-4 shadow-surface", className)}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-body">{title}</h3>
        {total != null && <span className="num text-lg font-medium text-foreground">{total}</span>}
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {rows.map((r, i) => (
          <span key={r.key ?? i} className="h-full" style={{ width: `${r.share}%`, background: r.color }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key ?? i} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-body">{r.label}</span>
            {r.delta !== undefined && <Delta value={r.delta} invert={r.invert} className="text-xs" />}
            <span className="num w-16 text-right font-medium text-foreground">{r.value}</span>
            <span className="num w-10 text-right text-muted-foreground">{r.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { Breakdown }

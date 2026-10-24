import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Ranked capsule bars, each scaled to the largest value.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.meta]
 * @param {{key?: string, label: React.ReactNode, value: number, display?: React.ReactNode, icon?: React.ReactNode}[]} props.rows
 *   `value` drives the bar; `display` overrides the printed figure (default: the en-GB value)
 */
function BarList({ title, meta, rows, className, ...props }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  return (
    <div
      data-ds="bar-list"
      className={cn("flex flex-col gap-3 rounded-surface bg-background p-4 shadow-surface", className)}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-body">{title}</h3>
        {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={r.key ?? i} className="relative flex h-control-sm items-center gap-2 px-3 text-sm">
            <span
              data-bar
              className="absolute inset-y-0 left-0 rounded-full bg-primary-soft"
              style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%` }}
              aria-hidden="true"
            />
            {r.icon && <span className="relative shrink-0 text-muted-foreground">{r.icon}</span>}
            <span className="relative min-w-0 flex-1 truncate text-foreground">{r.label}</span>
            <span className="num relative font-medium text-foreground">
              {r.display ?? r.value.toLocaleString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { BarList }

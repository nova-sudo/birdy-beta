import * as React from "react"

import { cn } from "@/lib/utils"
import { Frame } from "../surfaces/frame"

/**
 * A ranked list of 32-tall rows: a tinted bar sized to the value carries the
 * label inside it, and the tabular figure sits right of it. With a title it
 * sits in a Frame.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] Frame title; without one the list renders bare
 * @param {React.ReactNode} [props.description] Under the title; `meta` is an alias
 * @param {{key?: string, label: React.ReactNode, value: number, display?: React.ReactNode, icon?: React.ReactNode}[]} props.rows
 *   `value` drives the bar; `display` overrides the printed figure (default: the en-GB value)
 * @param {React.ReactNode} [props.empty] Shown in place of the rows when there are none
 */
function BarList({ title, description, meta, rows, empty, className, ...props }) {
  const max = Math.max(0, ...rows.map((r) => r.value))

  // Titled, the Frame is the root and carries data-ds; bare, the list does.
  const bare = title === undefined
  const list =
    rows.length === 0 && empty ? (
      <p
        data-ds={bare ? "bar-list" : undefined}
        data-slot="bar-list"
        className={cn("px-4 py-6 text-center text-sm text-muted-foreground", bare && className)}
      >
        {empty}
      </p>
    ) : (
      <ul
        data-ds={bare ? "bar-list" : undefined}
        data-slot="bar-list"
        className={cn("flex flex-col gap-1", bare ? className : "p-3")}
      >
        {rows.map((r, i) => (
          <li key={r.key ?? i} className="flex w-full items-center gap-3">
            <span className="relative flex h-8 min-w-0 flex-1 items-center">
              <span
                data-bar
                className="absolute inset-y-0 left-0 rounded-control-sm bg-primary-soft"
                style={{ width: `${max > 0 ? (r.value / max) * 100 : 0}%` }}
                aria-hidden="true"
              />
              <span className="relative flex min-w-0 items-center gap-2 px-2.5">
                {r.icon && <span className="shrink-0 text-muted-foreground">{r.icon}</span>}
                <span className="truncate text-sm leading-[18px] text-foreground">{r.label}</span>
              </span>
            </span>
            <span className="num min-w-9 shrink-0 text-right text-sm leading-[18px] whitespace-nowrap text-foreground">
              {r.display ?? r.value.toLocaleString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
    )

  if (bare) return list

  return (
    <Frame data-ds="bar-list" title={title} description={description ?? meta} className={className} {...props}>
      {list}
    </Frame>
  )
}

export { BarList }

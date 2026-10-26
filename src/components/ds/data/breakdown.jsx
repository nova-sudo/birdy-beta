import * as React from "react"

import { cn } from "@/lib/utils"
import { Frame } from "../surfaces/frame"
import { Delta } from "./delta"

/**
 * Parts of a whole as a ranked list of 56-tall rows: a 14px colour square, the
 * name, the change, the amount and its share, under one segmented share bar.
 * With a title it sits in a Frame that reads the total in its header.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] Frame title; without one the list renders bare
 * @param {React.ReactNode} [props.description] Under the title; `meta` is an alias
 * @param {React.ReactNode} [props.total] Already formatted, read in the frame header
 * @param {{key?: string, label: React.ReactNode, color: string, delta?: {change: number|null, format?: "percent"|"points"|"count"}, goodWhen?: "up"|"down"|"neither", value: React.ReactNode, share: number}[]} props.rows
 *   `color` is a CSS colour value, e.g. "var(--color-chart-2)"; `share` is 0-100. A row's
 *   delta carries no comparison: the frame names the period once.
 * @param {boolean} [props.bar=true] The segmented share bar above the rows
 */
function Breakdown({ title, description, meta, total, rows, bar = true, className, ...props }) {
  const hasDelta = rows.some((r) => r.delta)
  // Titled, the Frame is the root and carries data-ds; bare, the list does.
  const bare = title === undefined

  const list = (
    <div
      data-ds={bare ? "breakdown" : undefined}
      data-slot="breakdown"
      className={cn("flex min-w-0 flex-col gap-2 p-2", bare && className)}
    >
      {bar && (
        <div
          className="mx-3 mt-2 flex h-2.5 min-w-0 gap-0.5 overflow-hidden rounded-full bg-chart-track"
          aria-hidden="true"
        >
          {/* Grow by share from a zero basis, so segments always fit the track. */}
          {rows.map((r, i) => (
            <span key={r.key ?? i} className="h-full min-w-0" style={{ flex: `${r.share} 1 0%`, background: r.color }} />
          ))}
        </div>
      )}
      <ul className="flex flex-col [&:has(>li:hover)>li:not(:hover)]:opacity-45">
        {rows.map((r, i) => (
          <li
            key={r.key ?? i}
            className="flex h-14 w-full shrink-0 items-center gap-3 rounded-control px-3 text-foreground transition-[opacity,background-color] duration-150 hover:bg-chart-row-hover motion-reduce:transition-none"
          >
            <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: r.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-base leading-5">{r.label}</span>
            {hasDelta && (
              <span className="flex w-16 shrink-0 justify-end max-sm:hidden">
                {r.delta && <Delta change={r.delta.change} format={r.delta.format} goodWhen={r.goodWhen} />}
              </span>
            )}
            <span className="num shrink-0 text-right text-base leading-5 sm:min-w-24">{r.value}</span>
            <span className="num w-11 shrink-0 text-right text-sm leading-[18px] text-faint">{r.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  )

  if (bare) return list

  return (
    <Frame
      data-ds="breakdown"
      title={title}
      description={description ?? meta}
      action={
        total != null ? <span className="num text-sm leading-[18px] text-muted-foreground">{total}</span> : undefined
      }
      className={className}
      {...props}
    >
      {list}
    </Frame>
  )
}

export { Breakdown }

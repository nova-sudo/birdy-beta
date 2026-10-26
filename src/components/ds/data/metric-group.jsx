"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Frame } from "../surfaces/frame"
import { Skeleton } from "../surfaces/skeleton"
import { Delta } from "./delta"
import { formatMetricValue } from "./format-metric-value"
import { MetricLabel } from "./metric-label"

/**
 * @typedef {object} MetricGroupItem
 * @property {string} key
 * @property {React.ReactNode} label
 * @property {number|React.ReactNode} value A number is formatted by `format`; anything else is shown as given
 * @property {"number"|"percent"|"duration"|"currency"|"string"} [format]
 * @property {string} [currency] ISO code for `format: "currency"`
 * @property {React.ReactNode} [unit] Faint text after the value ("/ £10.00")
 * @property {React.ReactNode} [description] Info tooltip beside the label
 * @property {{change: number|null, format?: "percent"|"points"|"count", comparison?: React.ReactNode}} [delta]
 * @property {"up"|"down"|"neither"} [goodWhen="up"]
 * @property {{total: number, label?: React.ReactNode, tone?: "warning"}} [ratio] "212 of 219" with a 6px progress bar
 * @property {React.ReactNode} [caption] A muted line under the value
 * @property {string} [href] Makes the cell a link to the records behind the figure
 */

const numberFormat = new Intl.NumberFormat("en-GB")

/** Static class strings per item count so Tailwind can see them. Two across on a phone. */
const COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 @lg/metric-group:grid-cols-3",
  4: "grid-cols-2 @3xl/metric-group:grid-cols-4",
}

/**
 * One cell: label (with info), 24px value, delta line, caption. Hairline seams
 * on its right and bottom edges, drawn as shadows so the grid clips the outer ones.
 *
 * @param {{item: MetricGroupItem, loading?: boolean}} props
 */
function MetricGroupCell({ item, loading = false }) {
  const ratio = item.ratio && typeof item.value === "number" ? item.ratio : undefined
  const share = ratio && ratio.total > 0 ? Math.min(1, item.value / ratio.total) : 0
  const href = loading ? undefined : item.href

  return (
    <div
      data-slot="metric-group-cell"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 p-5 shadow-[1px_0_0_var(--color-divider),0_1px_0_var(--color-divider)]",
        href &&
          "group/cell relative transition-colors has-[a:focus-visible]:bg-muted/60 hover:bg-muted/60 [&_button]:relative [&_button]:z-10"
      )}
    >
      {href && (
        <Link
          href={href}
          aria-label={typeof item.label === "string" ? item.label : undefined}
          className="absolute inset-0 outline-none"
        />
      )}
      <span className="flex items-center justify-between gap-2 text-sm leading-[18px] font-medium text-muted-foreground">
        <MetricLabel label={item.label} description={item.description} />
        {href && (
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-faint transition-colors group-hover/cell:text-foreground"
          />
        )}
      </span>
      {loading ? (
        <>
          <Skeleton className="h-[30px] w-28 rounded-control-sm bg-skeleton" />
          <Skeleton className="h-3 w-16 rounded-sm bg-muted" />
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span
              data-slot="metric-value"
              className="text-2xl leading-[30px] font-medium tracking-[-0.02em] text-foreground tabular-nums"
            >
              {formatMetricValue(item.value, item)}
            </span>
            {ratio && (
              <span className="text-sm leading-[18px] text-faint tabular-nums">
                {ratio.label ?? `of ${numberFormat.format(ratio.total)}`}
              </span>
            )}
            {item.unit && <span className="text-sm leading-[18px] text-faint">{item.unit}</span>}
          </div>
          {ratio && (
            <div
              role="progressbar"
              aria-label={`${item.value} of ${ratio.total}`}
              aria-valuemin={0}
              aria-valuemax={ratio.total}
              aria-valuenow={item.value}
              className="mt-1 h-1.5 shrink-0 overflow-hidden rounded-[3px] bg-neutral-soft"
            >
              <div
                className={cn("h-full rounded-[3px]", ratio.tone === "warning" ? "bg-warning" : "bg-foreground")}
                style={{ width: `${share * 100}%` }}
              />
            </div>
          )}
          {item.delta && (
            <Delta
              change={item.delta.change}
              format={item.delta.format}
              goodWhen={item.goodWhen}
              comparison={item.delta.comparison}
            />
          )}
          {item.caption && (
            <span className="text-xs leading-4 text-muted-foreground tabular-nums">{item.caption}</span>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Several peer metrics in one frame, split by hairlines instead of separate cards: up to four
 * across and two down, under the frame's title strip.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.description] Under the title; `meta` is an alias
 * @param {React.ReactNode} [props.action] Right of the header; `actions` is an alias
 * @param {string} [props.href]
 * @param {string} [props.hrefLabel]
 * @param {React.ReactNode} [props.footer] Muted strip under the cells
 * @param {MetricGroupItem[]} props.items At most 8 are shown
 * @param {boolean} [props.loading] Labels stay; values and deltas become skeletons
 */
function MetricGroup({ items, loading = false, className, ...frame }) {
  const shown = items.slice(0, 8)
  const columns = COLUMNS[Math.min(4, Math.max(1, shown.length))]

  return (
    <Frame data-ds="metric-group" aria-busy={loading || undefined} className={className} {...frame}>
      <div className="@container/metric-group">
        <div data-slot="metric-group" className={cn("grid overflow-clip", columns)}>
          {shown.map((item, i) => (
            <MetricGroupCell key={item.key ?? i} item={item} loading={loading} />
          ))}
        </div>
      </div>
    </Frame>
  )
}

export { MetricGroup, MetricGroupCell }

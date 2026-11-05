import * as React from "react"

import { cn } from "@/lib/utils"

const W = 64
const H = 20
const PAD = 2

/**
 * A row-sized trend for table cells: one neutral polyline, no axes, no end
 * marker, no red or green. The last bucket is usually today and half-measured,
 * so a verdict colour would report the clock rather than the client; the
 * figures sit in the neighbouring columns.
 *
 * @param {object} props
 * @param {number[]} props.values In time order; fewer than two points draws a dash
 * @param {string} [props.label] What the series is, for the accessible name
 */
function Sparkline({ values, label, className, ...props }) {
  const series = (values ?? []).filter((v) => Number.isFinite(v))

  if (series.length < 2) {
    return (
      <span data-ds="sparkline" className={cn("inline-block text-muted-foreground", className)} {...props}>
        <span aria-hidden="true">–</span>
        {label && <span className="sr-only">{label}: no trend</span>}
      </span>
    )
  }

  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = Math.max(max - min, 1e-9)
  const step = (W - PAD * 2) / (series.length - 1)
  const points = series
    .map((v, i) => `${(PAD + i * step).toFixed(1)},${(H - PAD - ((v - min) / span) * (H - PAD * 2)).toFixed(1)}`)
    .join(" ")

  return (
    <svg
      data-ds="sparkline"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={cn("inline-block shrink-0 align-middle text-muted-foreground", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label ? `${label} trend` : undefined}
      {...props}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export { Sparkline }

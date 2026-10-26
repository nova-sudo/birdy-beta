import * as React from "react"

import { cn } from "@/lib/utils"

const FILL = {
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
}

/** Fill colour for a percentage of the way to a threshold: amber within 20% of it, red once crossed. */
function progressTone(value, triggered = false) {
  if (triggered || value >= 100) return "danger"
  if (value >= 80) return "warning"
  return "primary"
}

/**
 * Thin progress-to-threshold bar: 6px track, primary fill, amber within 20% of
 * the threshold and red once it is crossed. The fill is clamped to 0-100% of the track.
 *
 * @param {object} props
 * @param {number} props.value Percent of the way to the threshold (may exceed 100)
 * @param {boolean} [props.triggered] Forces the crossed (red) tone
 * @param {string} [props.label] Accessible name, e.g. "Progress to trigger"
 * @param {"primary"|"warning"|"danger"|"success"} [props.tone] Fixes the fill colour, for progress that is not measured against a threshold (a sync, an import), or that is good once full (a confidence score)
 */
function ProgressBar({ value = 0, triggered = false, tone, label = "Progress", className, ...props }) {
  const pct = Number.isFinite(value) ? value : 0
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div
      data-ds="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-surface", className)}
      {...props}
    >
      <div
        data-slot="progress-fill"
        className={cn("h-full rounded-full transition-[width] duration-300 ease-edge motion-reduce:transition-none", FILL[tone ?? progressTone(pct, triggered)])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { ProgressBar, progressTone }

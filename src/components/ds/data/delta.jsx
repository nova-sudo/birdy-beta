import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Change figure with a literal arrow. Green is the good direction, red the bad one.
 * Zero or missing values are neutral and carry no arrow.
 *
 * @param {object} props
 * @param {number|null} [props.value] Signed change; > 0 shows ↑, < 0 shows ↓
 * @param {"percent"|"number"} [props.format="percent"] percent: one decimal; number: en-GB grouping
 * @param {boolean} [props.invert=false] Cost metrics: falling is good
 * @param {string} [props.suffix] Appended after the figure
 */
function Delta({ value, format = "percent", invert = false, suffix, className, ...props }) {
  const neutral = value == null || value === 0 || Number.isNaN(value)
  const up = !neutral && value > 0
  const good = invert ? !up : up
  const abs = neutral ? 0 : Math.abs(value)
  const figure =
    format === "number" ? abs.toLocaleString("en-GB") : neutral ? "0%" : `${abs.toFixed(1)}%`

  return (
    <span
      data-ds="delta"
      data-direction={neutral ? "flat" : up ? "up" : "down"}
      className={cn(
        "num inline-flex items-center gap-0.5 text-sm font-medium",
        neutral ? "text-muted-foreground" : good ? "text-success-ink" : "text-danger-ink",
        className
      )}
      {...props}
    >
      {!neutral && <span aria-hidden="true">{up ? "↑" : "↓"}</span>}
      {!neutral && <span className="sr-only">{up ? "Up " : "Down "}</span>}
      {figure}
      {suffix}
    </span>
  )
}

export { Delta }

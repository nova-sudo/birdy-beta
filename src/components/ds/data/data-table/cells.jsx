import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "../../primitives/badge"

const hasContent = (node) => node !== undefined && node !== null && node !== ""

/**
 * Right-aligned amount; zero or negative reads quietly.
 *
 * @param {object} props
 * @param {number} props.value
 * @param {string} [props.currency="GBP"] ISO 4217 code
 * @param {React.ReactNode} [props.sub] Qualifier under the amount
 */
function MoneyCell({ value, currency = "GBP", sub, className }) {
  const formatted = new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value ?? 0)
  return (
    <div
      data-ds="cells"
      data-slot="money-cell"
      className={cn("flex flex-col items-end gap-1 text-right", className)}
    >
      <span className={cn("num text-sm leading-5", value > 0 ? "text-foreground" : "text-muted-foreground")}>
        {formatted}
      </span>
      {hasContent(sub) && <span className="num whitespace-nowrap text-xs leading-4 text-muted-foreground">{sub}</span>}
    </div>
  )
}

/**
 * Status dot beside a label. Colour never carries the meaning alone.
 *
 * @param {object} props
 * @param {"neutral"|"primary"|"success"|"warning"|"danger"|"info"} [props.tone="neutral"]
 * @param {React.ReactNode} props.label
 */
function StatusCell({ tone = "neutral", label, className }) {
  return (
    <Badge data-ds="cells" data-slot="status-cell" variant="dot" tone={tone} className={className}>
      {label}
    </Badge>
  )
}

/**
 * Primary line over a muted secondary line.
 *
 * @param {object} props
 * @param {React.ReactNode} props.primary
 * @param {React.ReactNode} [props.secondary] Omitted when empty
 */
function TwoLineCell({ primary, secondary, className }) {
  return (
    <div
      data-ds="cells"
      data-slot="two-line-cell"
      className={cn("flex min-w-0 flex-col gap-1", className)}
    >
      <span className="truncate text-sm font-medium leading-5 text-foreground">{primary}</span>
      {hasContent(secondary) && <span className="truncate text-xs leading-4 text-muted-foreground">{secondary}</span>}
    </div>
  )
}

export { MoneyCell, StatusCell, TwoLineCell }

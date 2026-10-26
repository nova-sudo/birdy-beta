import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Which direction is good news. Leads and closes are `up`; cost per lead, lost
 * leads and missed calls are `down`. `neither` keeps the change muted.
 * @typedef {"up"|"down"|"neither"} GoodWhen
 */

/** The colour a change earns: the arrow follows the direction, the colour follows the polarity. */
function deltaTone(change, goodWhen = "up") {
  if (change === 0 || !Number.isFinite(change) || goodWhen === "neither") return "neutral"
  const up = change > 0
  return up === (goodWhen === "up") ? "good" : "bad"
}

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

/**
 * How the change reads. `percent` is a relative change ("12%"), `points` a
 * difference between two rates ("2 pts"), `count` a plain difference ("3").
 */
function formatChange(change, format = "percent") {
  const magnitude = oneDecimal.format(Math.abs(change))
  switch (format) {
    case "points":
      return `${magnitude} ${magnitude === "1" ? "pt" : "pts"}`
    case "count":
      return magnitude
    case "percent":
    default:
      return `${magnitude}%`
  }
}

const TONE_ICON = {
  good: "text-delta-good",
  bad: "text-delta-bad",
  neutral: "text-muted-foreground",
}

const TONE_TEXT = {
  good: "text-delta-good-ink",
  bad: "text-delta-bad-ink",
  neutral: "text-muted-foreground",
}

const TONE_BADGE = {
  good: "bg-delta-good-soft",
  bad: "bg-delta-bad-soft",
  neutral: "bg-neutral-soft",
}

/**
 * An arrow and a tabular figure, coloured by whether the change is good rather than its direction.
 * A missing change, zero, or one that rounds to zero reads "No change".
 *
 * @param {object} props
 * @param {number|null} props.change Signed change
 * @param {"percent"|"points"|"count"} [props.format="percent"]
 * @param {GoodWhen} [props.goodWhen="up"]
 * @param {React.ReactNode} [props.comparison] What the change is measured against ("vs previous period"), muted after the figure
 * @param {"text"|"badge"} [props.variant="text"] `text` is the 13 inline line; `badge` the 28-tall tinted chip beside a hero figure
 */
function Delta({ change, format = "percent", goodWhen = "up", comparison, variant = "text", className, ...props }) {
  const value = change == null ? NaN : Number(change)
  // A change that rounds to 0 at one decimal reads as flat, so it carries no arrow either.
  const flat = !Number.isFinite(value) || formatChange(value, "count") === "0"
  const tone = flat ? "neutral" : deltaTone(value, goodWhen)
  const up = value > 0
  const Arrow = up ? ArrowUp : ArrowDown

  if (variant === "badge") {
    return (
      <span
        data-ds="delta"
        data-slot="delta"
        data-tone={tone}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-badge pr-2.5 pl-2 text-sm leading-[18px] font-medium tabular-nums",
          TONE_BADGE[tone],
          TONE_TEXT[tone],
          className
        )}
        {...props}
      >
        {flat ? (
          "No change"
        ) : (
          <>
            <Arrow aria-hidden className={cn("size-4", TONE_ICON[tone])} />
            <span className="sr-only">{up ? "Up" : "Down"}</span>
            {formatChange(value, format)}
          </>
        )}
      </span>
    )
  }

  return (
    <span
      data-ds="delta"
      data-slot="delta"
      data-tone={tone}
      className={cn("inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-2 text-xs leading-4", className)}
      {...props}
    >
      {flat ? (
        <span className="shrink-0 text-muted-foreground">No change</span>
      ) : (
        <span data-slot="delta-figure" className={cn("inline-flex shrink-0 items-center gap-0.5 tabular-nums", TONE_TEXT[tone])}>
          <Arrow aria-hidden className={cn("size-3.5", TONE_ICON[tone])} />
          <span className="sr-only">{up ? "Up" : "Down"}</span>
          {formatChange(value, format)}
        </span>
      )}
      {comparison && <span className="min-w-0 truncate text-muted-foreground">{comparison}</span>}
    </span>
  )
}

export { Delta, deltaTone, formatChange }

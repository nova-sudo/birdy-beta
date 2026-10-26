import * as React from "react"

import { cn } from "@/lib/utils"
import { BADGE_TONE_CLASSES, Badge } from "../primitives/badge"
import { Frame } from "../surfaces/frame"
import { Delta } from "./delta"
import { stepConversion } from "./funnel-bar"
import { formatMetricValue } from "./format-metric-value"
import { metricGroupColumns } from "./metric-group"

/**
 * @typedef {object} FunnelGroupStage
 * @property {string} key
 * @property {React.ReactNode} label
 * @property {React.ElementType} [icon] Drawn in a 32px chip in the stage's tone
 * @property {"primary"|"info"|"warning"|"success"|"danger"|"purple"|"muted"|"neutral"} [tone="neutral"]
 * @property {number|React.ReactNode} value A number is formatted and feeds the step conversions; a node (a placeholder) is shown as given
 * @property {{change: number|null, format?: "percent"|"points"|"count", comparison?: React.ReactNode}} [delta]
 * @property {"up"|"down"|"neither"} [goodWhen="up"]
 * @property {React.ReactNode} [caption] A muted line under the value ("5.1% of leads")
 * @property {boolean} [unavailable] Nobody measures this stage: its chip goes neutral
 */

/**
 * The step-to-step rate into stage `i`, or null where there is nothing to say:
 * the first stage, a figure missing on either side, a previous stage of 0, or a
 * rate above 100% (the stage is a slice beside the one before, not a narrowing).
 */
function stepRate(stages, i) {
  if (i === 0) return null
  const current = stages[i]
  const previous = stages[i - 1]
  if (current.unavailable || previous.unavailable) return null
  if (typeof current.value !== "number" || typeof previous.value !== "number") return null
  return stepConversion(current.value, previous.value)
}

function FunnelGroupCell({ stage, rate, previousLabel }) {
  const Icon = stage.icon
  const tone = stage.unavailable ? "neutral" : (stage.tone ?? "neutral")

  return (
    <div
      data-slot="funnel-group-cell"
      className="relative flex min-w-0 flex-col gap-1.5 p-5 shadow-[-1px_0_0_var(--color-divider),0_-1px_0_var(--color-divider)]"
    >
      {rate && (
        // Sits on the seam before this stage, level with the chips. On a 2×2
        // grid half the seams are rows, so the pills only show four across.
        <Badge
          data-slot="funnel-step"
          size="sm"
          className="absolute top-7.5 left-0 z-10 hidden -translate-x-1/2 bg-background px-2 text-muted-foreground shadow-control @3xl/metric-group:inline-flex"
        >
          <span className="sr-only">
            {previousLabel} to {stage.label}:{" "}
          </span>
          {rate}
        </Badge>
      )}
      <div className="mb-1.5 flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span
            data-slot="funnel-group-chip"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-control-sm [&>svg]:size-[18px]",
              BADGE_TONE_CLASSES[tone]
            )}
          >
            <Icon aria-hidden />
          </span>
        )}
        <span
          data-slot="funnel-group-label"
          className="truncate text-sm leading-[18px] font-medium text-muted-foreground"
        >
          {stage.label}
        </span>
      </div>
      <span
        data-slot="metric-value"
        className="text-2xl leading-[30px] font-medium tracking-[-0.02em] text-foreground tabular-nums"
      >
        {formatMetricValue(stage.value)}
      </span>
      {stage.delta && (
        <Delta
          change={stage.delta.change}
          format={stage.delta.format}
          goodWhen={stage.goodWhen}
          comparison={stage.delta.comparison}
        />
      )}
      {stage.caption && (
        <span className="text-xs leading-4 text-muted-foreground tabular-nums">{stage.caption}</span>
      )}
    </div>
  )
}

/**
 * A funnel shaped like a MetricGroup (Birdy-only, mock A "Stage cells"): one
 * surface split into a cell per stage, each with an icon chip, label, value and
 * delta, and a pill on the seam between stages with the step conversion. Two
 * across on a narrow container, where the pills hide; the Frame's footer takes
 * the diagnosis.
 *
 * @param {object} props
 * @param {FunnelGroupStage[]} props.stages In funnel order; renders nothing when empty
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.footer] Under the cells, in the frame's muted strip
 */
function FunnelGroup({ stages = [], className, ...frame }) {
  if (!stages.length) return null

  return (
    <Frame data-ds="funnel-group" className={className} {...frame}>
      <div className="@container/metric-group">
        <div data-slot="funnel-group" className={cn("grid overflow-clip", metricGroupColumns(stages.length))}>
          {stages.map((stage, i) => (
            <FunnelGroupCell
              key={stage.key}
              stage={stage}
              rate={stepRate(stages, i)}
              previousLabel={stages[i - 1]?.label}
            />
          ))}
        </div>
      </div>
    </Frame>
  )
}

export { FunnelGroup }

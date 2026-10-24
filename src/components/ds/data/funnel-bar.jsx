import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "../surfaces/skeleton"
import { Delta } from "./delta"

// Fills step down the primary ramp: solid first, pale last, white text on all
// but the pale one. Middle steps take the next tint along; a longer funnel
// reuses the last middle tint rather than going invisible.
const FIRST = "bg-primary text-primary-foreground"
const MIDDLE = ["bg-primary/80 text-primary-foreground", "bg-primary/60 text-primary-foreground", "bg-primary/45 text-primary-foreground"]
const LAST = "bg-primary/30 text-foreground"

const fill = (i, n) => (i === 0 ? FIRST : i === n - 1 ? LAST : MIDDLE[Math.min(i - 1, MIDDLE.length - 1)])

const present = (v) => v != null && Number.isFinite(v)

// Step-to-step conversion: 67%, but 6.3% so a small rate keeps its decimal.
// Above 100% the step is not downstream of the one before it (a slice, not a
// narrowing), so there is no conversion to state.
const conversion = (current, previous) => {
  if (!present(current) || !present(previous) || previous <= 0 || current > previous) return null
  const pct = (current / previous) * 100
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`
}

const wide = (fraction) => `${(fraction * 100).toFixed(1)}%`
const narrow = (fraction) => (fraction < 0.1 ? wide(fraction) : `${Math.round(fraction * 100)}%`)

function Label({ step }) {
  if (!step.shortLabel) return <span className="truncate">{step.label}</span>
  return (
    <>
      <span className="truncate sm:hidden">{step.shortLabel}</span>
      <span className="hidden truncate sm:inline">{step.label}</span>
    </>
  )
}

function Share({ fraction }) {
  const long = wide(fraction)
  const short = narrow(fraction)
  if (long === short) return <span>{long}</span>
  return (
    <>
      <span className="hidden sm:inline">{long}</span>
      <span className="sm:hidden">{short}</span>
    </>
  )
}

/**
 * One funnel as a single segmented bar: equal parts, one per step, stepping
 * from solid primary to pale. Above each join sits the step-to-step conversion
 * (sm and up); below each part sits its count, its share of the first step and
 * its change against the previous period.
 *
 * @param {object} props
 * @param {{key: string, label: string, shortLabel?: string, hint?: string, value: number|null, share?: number|null, delta?: number|null, invert?: boolean}[]} props.steps
 *   `value` null is a step nobody measures: it reads "—" and breaks the conversions either side.
 *   `share` is a fraction of the first step; left out it is computed, `null` hides it.
 *   `delta` is a signed percent change; `invert` marks a cost (falling is good).
 *   `shortLabel` replaces `label` below sm; `hint` is the step's caveat, shown as its tooltip.
 *   A conversion above 100% reads "—".
 * @param {boolean} [props.loading] Skeleton bar and figures
 */
function FunnelBar({ steps = [], loading = false, className, ...props }) {
  if (!steps.length) return null

  const n = steps.length
  const grid = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  const first = steps[0].value
  const rate = (i) => conversion(steps[i].value, steps[i - 1].value)

  if (loading) {
    return (
      <div data-ds="funnel-bar" aria-busy="true" className={cn("flex flex-col gap-3", className)} {...props}>
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-0.5" style={grid}>
          {steps.map((s) => (
            <div key={s.key} className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-ds="funnel-bar" className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      <div
        data-slot="funnel-conversions"
        aria-hidden="true"
        className="num hidden gap-0.5 text-xs text-muted-foreground sm:grid"
        style={grid}
      >
        {steps.map((s, i) => (
          <span key={s.key} className="truncate font-mono">
            {i === 0 ? "" : rate(i) ? `→ ${rate(i)}` : "—"}
          </span>
        ))}
      </div>
      {/* The visible row is decorative; screen readers get the same rates in words. */}
      <ul data-slot="funnel-conversions-sr" className="sr-only">
        {steps.map((s, i) =>
          i > 0 && rate(i) ? (
            <li key={s.key}>
              {steps[i - 1].label} to {s.label}: {rate(i)}
            </li>
          ) : null
        )}
      </ul>

      <div data-slot="funnel-segments" className="grid gap-0.5" style={grid}>
        {steps.map((s, i) => (
          <div
            key={s.key}
            title={s.hint || undefined}
            className={cn(
              "flex h-9 min-w-0 items-center px-3 text-xs font-medium",
              fill(i, n),
              i === 0 && "rounded-l-control",
              i === n - 1 && "rounded-r-control"
            )}
          >
            <Label step={s} />
          </div>
        ))}
      </div>

      <div data-slot="funnel-meta" className="grid gap-0.5" style={grid}>
        {steps.map((s, i) => {
          const fraction =
            s.share !== undefined
              ? s.share
              : i > 0 && present(s.value) && present(first) && first > 0
                ? s.value / first
                : null
          const showDelta = s.delta != null
          return (
            <div key={s.key} className="flex min-w-0 flex-col gap-0.5 px-1">
              <span className="num text-base text-foreground sm:text-lg">
                {present(s.value) ? s.value.toLocaleString("en-GB") : "—"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {fraction != null && <Share fraction={fraction} />}
                {showDelta && (
                  <span className="hidden sm:inline">
                    {fraction != null && " · "}
                    <Delta value={s.delta} invert={s.invert} className="text-xs" />
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { FunnelBar }

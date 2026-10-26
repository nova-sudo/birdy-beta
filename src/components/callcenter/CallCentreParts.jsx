import { CheckIcon } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Badge } from "@/components/ds"
import { cn } from "@/lib/utils"

// Small pieces the call-centre dialogs and the Calls table share.

/** Inbound / Outbound as a ds Badge. */
export function DirectionBadge({ direction }) {
  const outbound = direction === "outbound"
  return <Badge tone={outbound ? "info" : "success"}>{outbound ? "Outbound" : "Inbound"}</Badge>
}

/** One figure in a dialog strip: value over a muted label. */
export function StatTile({ value, label, className }) {
  return (
    <div className={cn("min-w-0 flex-1 rounded-surface bg-muted px-4 py-3", className)}>
      <div className="num text-lg font-semibold leading-tight text-foreground">{value}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

/** The header row of a Birdy answer: avatar, name, and whatever sits beside them. */
export function BirdyRow({ state, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state ? <BirdyAvatar size={28} state={state} /> : <BirdyAvatar size={28} paused />}
      <span className="text-sm font-semibold text-foreground">Birdy</span>
      {children}
    </div>
  )
}

/** A labelled block of analysis text. */
export function AnalysisSection({ label, text }) {
  if (!text) return null
  return (
    <div className="rounded-surface bg-muted px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  )
}

/**
 * Determinate bar. Colour is the primary action colour; the numbers carry the
 * meaning, so it is a progressbar for assistive tech as well.
 */
export function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-edge" style={{ width: `${pct}%` }} />
    </div>
  )
}

/**
 * Steps in order; the current one is marked with aria-current, earlier ones
 * are ticked.
 *
 * @param {{label: string}[]} steps
 * @param {number} current Index of the active step; steps.length means all done
 */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step.label} className="flex items-center gap-2">
            <span
              data-step
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5",
                active ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs",
                  done ? "bg-primary text-primary-foreground" : active ? "bg-primary-soft text-primary" : "bg-muted"
                )}
              >
                {done ? <CheckIcon className="size-3" /> : i + 1}
              </span>
              {step.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden="true" className="h-px w-6 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

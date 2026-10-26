import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export const WIZARD_STEPS = ["Scope & safety", "Teach your strategy", "Check & turn on"]

/**
 * The setup wizard's progress line: done steps get a tick, the current one is filled.
 *
 * @param {object} props
 * @param {number} props.current 1-based
 */
export function WizardSteps({ current, className }) {
  return (
    <ol aria-label="Setup steps" className={cn("flex flex-wrap items-center gap-2 text-sm text-muted-foreground", className)}>
      {WIZARD_STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const on = n === current
        return (
          <React.Fragment key={label}>
            {i > 0 && <li aria-hidden className="h-px w-7 bg-border max-sm:hidden" />}
            <li
              aria-current={on ? "step" : undefined}
              className={cn("flex items-center gap-1.5", on && "font-medium text-foreground")}
            >
              <span
                className={cn(
                  "flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                  on
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-success-soft text-success-ink"
                      : "bg-neutral-soft text-neutral-ink"
                )}
              >
                {done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : n}
              </span>
              <span className={cn(!on && "max-sm:sr-only")}>
                {label}
                {done && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          </React.Fragment>
        )
      })}
    </ol>
  )
}

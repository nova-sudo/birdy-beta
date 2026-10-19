"use client"

import { STARTERS, starterOps } from "@/lib/dashboard-starters"
import { PdIcon } from "@/lib/dashkit/primitives"

/**
 * An empty dashboard's way in: three starters, each one click away from a
 * widget already bound to real numbers. `onStart(ops)` gets the starter's ops
 * as one batch, aimed at `sectionId` (a section is added first when there is
 * none).
 */
export function EmptyStarters({ sectionId, onStart }) {
  return (
    <section aria-labelledby="dashboard-starters-title" className="rounded-2xl border border-dashed border-pd-border bg-pd-surface px-6 py-7">
      <h2 id="dashboard-starters-title" className="font-pd-display text-[15px] font-semibold text-pd-ink">
        Start with
      </h2>
      <p className="mt-1 text-[13px] text-pd-muted">
        Add a ready-made widget, use Add widget above, or ask Birdy for what you want to see.
      </p>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {STARTERS.map((starter) => (
          <button
            key={starter.kind}
            type="button"
            onClick={() => onStart(starterOps(starter.kind, { sectionId }))}
            className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border border-pd-border bg-pd-canvas px-3.5 py-3 text-left text-[13px] font-medium text-pd-ink transition-colors hover:border-pd-primary hover:bg-pd-primary-tint/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <PdIcon name={starter.icon} className="mt-px size-4 shrink-0 text-pd-primary" />
            <span className="min-w-0">{starter.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

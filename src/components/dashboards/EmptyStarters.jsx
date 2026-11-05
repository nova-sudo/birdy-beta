"use client"

import { STARTERS } from "@/lib/dashboard-starters"
import { WidgetIcon } from "./WidgetIcon"

/**
 * An empty dashboard's way in: the default board and three single widgets,
 * each one click away and already bound to real numbers. `onStart(kind)` gets
 * the starter's kind; the caller builds its ops (`starterOps`) against the
 * live doc.
 */
export function EmptyStarters({ onStart }) {
  return (
    <section aria-labelledby="dashboard-starters-title" className="rounded-surface border border-dashed border-border bg-background px-6 py-7">
      <h2 id="dashboard-starters-title" className="text-base font-semibold text-foreground">
        Start with
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a ready-made widget, use Add widget above, or ask Birdy for what you want to see.
      </p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {STARTERS.map((starter) => (
          <button
            key={starter.kind}
            type="button"
            onClick={() => onStart(starter.kind)}
            className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-control border border-border bg-muted px-3.5 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-soft focus-visible:shadow-control-focus focus-visible:outline-none"
          >
            <WidgetIcon name={starter.icon} className="mt-px size-4 shrink-0 text-primary" />
            <span className="min-w-0">{starter.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

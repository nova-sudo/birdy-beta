import * as React from "react"

import { cn } from "@/lib/utils"

// A shine sweeps across the bar every 1.4s; under reduced motion the bar is the flat skeleton grey.
const SWEEP =
  "bg-skeleton motion-safe:animate-skeleton motion-safe:bg-[linear-gradient(90deg,var(--color-skeleton)_25%,var(--color-skeleton-shine)_50%,var(--color-skeleton)_75%)] motion-safe:bg-[length:200%_100%]"

/** Loading placeholder block; size it with className. */
function Skeleton({ className, ...props }) {
  return (
    <div
      data-ds="skeleton"
      data-slot="skeleton"
      aria-hidden
      className={cn("rounded-control", SWEEP, className)}
      {...props}
    />
  )
}

export { Skeleton }

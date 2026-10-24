import * as React from "react"

import { cn } from "@/lib/utils"

/** Pulsing placeholder block; size it with className. Pulse is off under reduced motion. */
function Skeleton({ className, ...props }) {
  return (
    <div
      data-ds="skeleton"
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-control bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }

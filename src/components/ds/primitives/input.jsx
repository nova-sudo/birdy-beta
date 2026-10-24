import * as React from "react"

import { cn } from "@/lib/utils"

/** Text input at control height. Focus swaps the ring shadow for the primary focus shadow. */
function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-ds="input"
      data-slot="input"
      className={cn(
        "h-control w-full min-w-0 rounded-control bg-background px-3 text-sm text-foreground shadow-control outline-none transition-shadow duration-150 placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-control-focus",
        "aria-invalid:shadow-[0_0_0_1px_var(--color-danger)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }

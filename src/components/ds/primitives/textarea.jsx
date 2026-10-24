import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-ds="textarea"
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-control bg-background px-3 py-2.5 text-sm text-foreground shadow-control outline-none transition-shadow duration-150 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:shadow-control-focus",
        "aria-invalid:shadow-control-invalid",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

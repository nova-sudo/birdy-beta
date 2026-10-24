import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border hover:border-muted-foreground/60 bg-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:hover:border-primary focus-visible:ring-primary/15 aria-invalid:ring-danger/20  aria-invalid:border-danger  flex field-sizing-content min-h-16 w-full rounded-2xl border px-4 py-2.5 text-base shadow-xs transition-[color,box-shadow,border-color] duration-200 outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props} />
  );
}

export { Textarea }

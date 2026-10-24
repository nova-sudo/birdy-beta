import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:text-primary-foreground border-border hover:border-muted-foreground/60 h-9 w-full min-w-0 rounded-full border bg-background px-4 py-1 text-base shadow-xs transition-[color,box-shadow,border-color] duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary focus-visible:hover:border-primary focus-visible:ring-primary/15 focus-visible:ring-4",
        "aria-invalid:ring-danger/20  aria-invalid:border-danger",
        className
      )}
      {...props} />
  );
}

export { Input }

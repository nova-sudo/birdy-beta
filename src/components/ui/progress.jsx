"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

const colorClasses = {
  primary: "bg-primary",
  secondary: "bg-primary/50",
  destructive: "bg-destructive",
  accent: "bg-purple-300",
  muted: "bg-muted-foreground",
}

const Progress = React.forwardRef(
  ({ className, value, size = "md", color = "primary", showLabel = false, animated = true, ...props }, ref) => {
    const displayValue = Math.min(Math.max(value || 0, 0), 100)

    return (
      <div className="w-full space-y-2">
        <ProgressPrimitive.Root
          ref={ref}
          data-slot="progress"
          className={cn("relative w-full overflow-hidden rounded-full bg-pd-divider", sizeClasses[size], className)}
          value={displayValue}
          {...props}
        >
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn(
              "h-full w-full flex-1",
              colorClasses[color],
              animated && "transition-all duration-500 ease-out",
            )}
            style={{ transform: `translateX(-${100 - displayValue}%)` }}
          />
        </ProgressPrimitive.Root>
        {showLabel && <p className="text-xs font-medium text-pd-ink text-right tabular-nums">{displayValue}%</p>}
      </div>
    )
  },
)

Progress.displayName = "Progress"

export { Progress }

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../primitives/button"

/**
 * Failed-load block with an optional retry. Replaces portfolio/LoadError.
 * The missing figures are missing, not zero, so say so.
 *
 * @param {object} props
 * @param {string} [props.title="Couldn't load this"]
 * @param {React.ReactNode} [props.description="The request failed."]
 * @param {() => void} [props.onRetry] Shows a "Try again" button when given
 */
function ErrorState({ title = "Couldn't load this", description = "The request failed.", onRetry, className, ...props }) {
  return (
    <div
      data-ds="error-state"
      data-slot="error-state"
      className={cn("flex flex-wrap items-center gap-3", className)}
      {...props}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-danger-soft text-danger-ink">
        <AlertTriangle aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw aria-hidden className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}

export { ErrorState }

"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "../overlays/tooltip"

/**
 * A metric's label with, when given, an info icon that explains how it is counted.
 *
 * @param {object} props
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} [props.description] Tooltip copy; line breaks are kept
 */
function MetricLabel({ label, description, className }) {
  return (
    <span data-ds="metric-label" className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{label}</span>
      {description && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`How ${typeof label === "string" ? label.toLowerCase() : "this"} is counted`}
              className="inline-flex shrink-0 cursor-help text-faint outline-none hover:text-muted-foreground focus-visible:text-foreground"
            >
              <Info aria-hidden className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] whitespace-pre-line text-pretty">
            {description}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}

export { MetricLabel }

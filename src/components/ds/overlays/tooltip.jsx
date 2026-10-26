"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ delayDuration = 0, ...props }) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip(props) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger(props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

// Radix marks a tooltip that opened without its delay `instant-open`; it skips the entrance too,
// so sliding along a toolbar reads as one tooltip moving rather than a row of them popping.
const MOTION =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=instant-open]:animate-none motion-safe:data-[side=bottom]:slide-in-from-top-1 motion-safe:data-[side=left]:slide-in-from-right-1 motion-safe:data-[side=right]:slide-in-from-left-1 motion-safe:data-[side=top]:slide-in-from-bottom-1"

/** The ink pill: 14/500 on the tooltip ink, r8, no arrow. */
function TooltipContent({ className, side = "top", sideOffset = 6, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-ds="tooltip"
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-[1000] flex w-fit max-w-[320px] origin-(--radix-tooltip-content-transform-origin) items-center gap-2 rounded-[8px] bg-tooltip px-2.5 py-1.5 font-sans text-sm leading-[18px] font-medium text-balance text-tooltip-foreground shadow-tooltip",
          MOTION,
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

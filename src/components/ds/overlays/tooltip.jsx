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

function TooltipContent({ className, side = "top", sideOffset = 6, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-ds="tooltip"
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-[1000] w-fit origin-(--radix-tooltip-content-transform-origin) rounded-control bg-foreground px-3 py-1.5 font-sans text-xs font-medium text-balance text-background shadow-floating animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 motion-reduce:animate-none",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-[1000] size-2.5 fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

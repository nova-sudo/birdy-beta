"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { LIST_MOTION, LIST_SURFACE } from "./list-variants"

function Popover(props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

/**
 * The floating surface: white r14 on the floating shadow, 6 of padding for a list. A list that
 * follows its trigger's width sets `w-(--radix-popover-trigger-width)`; a form sets its own width
 * and padding.
 */
function PopoverContent({ className, align = "start", sideOffset = 8, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-ds="popover"
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(LIST_SURFACE, LIST_MOTION, "w-72 origin-(--radix-popover-content-transform-origin)", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor(props) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }

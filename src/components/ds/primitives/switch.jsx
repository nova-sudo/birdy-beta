"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitives.Root
      ref={ref}
      data-ds="switch"
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-[background-color,box-shadow] duration-150 focus-visible:shadow-control-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-border",
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb className="pointer-events-none block size-5 rounded-full bg-background shadow-control transition-transform duration-150 ease-press data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 motion-reduce:transition-none" />
    </SwitchPrimitives.Root>
  )
})

export { Switch }

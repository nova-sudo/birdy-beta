"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({ className, ...props }) {
  return (
    <CheckboxPrimitive.Root
      data-ds="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-sm bg-background shadow-control outline-none transition-[box-shadow,background-color] duration-150 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:shadow-control-focus aria-invalid:shadow-control-invalid disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

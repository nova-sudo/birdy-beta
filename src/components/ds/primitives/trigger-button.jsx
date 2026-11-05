import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { triggerVariants } from "./field-variants"

/**
 * The button that opens a menu, popover or command list. It is drawn exactly like a Select
 * trigger, double arrow included, so every dropdown on a page reads as the same control.
 * Wrap it in a `DropdownMenuTrigger` or `PopoverTrigger` with `asChild`.
 *
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"]  md (40px) beside tab rails and in table toolbars
 */
const TriggerButton = React.forwardRef(function TriggerButton({ className, size = "md", children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-ds="trigger-button"
      data-slot="trigger-button"
      data-size={size}
      className={cn(triggerVariants({ size }), "w-fit", className)}
      {...props}
    >
      {children}
      <ChevronsUpDownIcon aria-hidden />
    </button>
  )
})

export { TriggerButton }

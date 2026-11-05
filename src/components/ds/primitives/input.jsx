import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldVariants } from "./field-variants"

/**
 * Text input on the shared field surface.
 * @param {object} props
 * @param {"sm"|"md"|"lg"} [props.size="md"] `md` (40) matches a default Button. `sm` (32) is for toolbars and dense rows whose buttons are `sm`. `lg` (48) is for sheets and checkout forms.
 * @param {boolean} [props.warning] An amber ring: the field needs attention but is not wrong (use `aria-invalid` for wrong)
 */
function Input({ className, type, size = "md", warning = false, ...props }) {
  return (
    <input
      type={type}
      data-ds="input"
      data-slot="input"
      data-size={size}
      data-warning={warning || undefined}
      className={cn(fieldVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input }

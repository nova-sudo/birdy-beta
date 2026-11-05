import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * @param {object} props
 * @param {number} [props.size=16] Width and height in px
 * @param {string} [props.label] Announced to screen readers; without it the spinner is aria-hidden
 */
function Spinner({ size = 16, label, className, ...props }) {
  const icon = (
    <Loader2
      data-ds="spinner"
      width={size}
      height={size}
      aria-hidden={label ? undefined : true}
      className={cn("animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
  if (!label) return icon
  return (
    <span role="status" className="inline-flex">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }

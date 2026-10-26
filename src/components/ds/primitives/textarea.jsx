import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldVariants } from "./field-variants"

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-ds="textarea"
      data-slot="textarea"
      className={cn(fieldVariants(), "field-sizing-content h-auto min-h-26 py-2.5 leading-6", className)}
      {...props}
    />
  )
}

export { Textarea }

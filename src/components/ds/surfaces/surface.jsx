import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * White card on the page or inside a `Frame`.
 *
 * @param {object} props
 * @param {React.ElementType} [props.as="div"]
 * @param {boolean} [props.padded=true] 16px padding; turn off for edge-to-edge content like tables
 */
function Surface({ as: Comp = "div", padded = true, className, ...props }) {
  return (
    <Comp
      data-ds="surface"
      data-slot="surface"
      className={cn("rounded-surface bg-background text-foreground shadow-surface", padded && "p-4", className)}
      {...props}
    />
  )
}

export { Surface }

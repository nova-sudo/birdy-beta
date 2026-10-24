import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Centered "nothing here yet" block.
 *
 * @param {object} props
 * @param {React.ElementType|React.ReactNode} [props.icon] A lucide component or a rendered node
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.action] Usually a `Button`
 */
function EmptyState({ icon: Icon, title, description, action, className, ...props }) {
  // lucide icons are forwardRef objects, so a typeof-function check alone misses them.
  const isComponent = Icon && !React.isValidElement(Icon) && (typeof Icon === "function" || typeof Icon === "object")
  return (
    <div
      data-ds="empty-state"
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center gap-3 p-8 text-center", className)}
      {...props}
    >
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-control bg-muted text-muted-foreground [&>svg]:size-5">
          {isComponent ? <Icon aria-hidden /> : Icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }

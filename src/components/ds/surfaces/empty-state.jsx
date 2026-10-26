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
 * @param {React.ElementType} [props.titleAs] Element for the title, default `p`
 * @param {"plain"|"surface"} [props.variant="plain"] `surface` sets it on its own white card with the faint empty ring, for one that stands alone on a frame. `plain` is for one inside a card, table or chart that already draws its own.
 */
function EmptyState({ icon: Icon, title, titleAs: TitleTag = "p", description, action, variant = "plain", className, ...props }) {
  // lucide icons are forwardRef objects, so a typeof-function check alone misses them.
  const isComponent = Icon && !React.isValidElement(Icon) && (typeof Icon === "function" || typeof Icon === "object")
  return (
    <div
      data-ds="empty-state"
      data-slot="empty-state"
      data-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        variant === "surface" && "rounded-control bg-background shadow-empty-surface",
        className
      )}
      {...props}
    >
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-raised text-foreground shadow-control [&>svg]:size-5">
          {isComponent ? <Icon aria-hidden /> : Icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <TitleTag className="text-base font-semibold text-foreground">{title}</TitleTag>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }

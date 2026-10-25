import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Muted panel with a header row (title, meta, actions) above its children.
 * Put `Surface` cards inside it.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title 16/600 heading
 * @param {React.ReactNode} [props.meta] Muted line beside the title
 * @param {React.ReactNode} [props.actions] Right-aligned controls
 * @param {"h1"|"h2"|"h3"|"h4"} [props.titleAs="h2"] Heading element for the title
 */
function Frame({ title, meta, actions, titleAs: Title = "h2", children, className, ...props }) {
  return (
    <section
      data-ds="frame"
      data-slot="frame"
      className={cn("flex min-w-0 flex-col gap-3 rounded-frame bg-frame p-3", className)}
      {...props}
    >
      <header className="flex min-h-control-sm items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <Title className="truncate text-base font-semibold text-foreground">{title}</Title>
          {meta && <span className="truncate text-sm text-muted-foreground">{meta}</span>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export { Frame }

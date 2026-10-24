import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * In-page heading block: optional eyebrow, 32/600 title, 16 muted description,
 * actions on the right (wrapping under the title on narrow screens).
 *
 * @param {object} props
 * @param {React.ReactNode} [props.eyebrow] Small label above the title
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.period] Period / date-range control, shown before the actions
 */
function PageHeader({ eyebrow, title, description, actions, period, className }) {
  return (
    <div
      data-ds="page-header"
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3 font-sans", className)}
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-base text-muted-foreground">{description}</p>}
      </div>
      {(period || actions) && (
        // max-w-full lets the controls wrap onto further lines on a phone instead of pushing the page wider.
        <div data-slot="page-header-actions" className="flex max-w-full flex-wrap items-center gap-2">
          {period}
          {actions}
        </div>
      )}
    </div>
  )
}

export { PageHeader }

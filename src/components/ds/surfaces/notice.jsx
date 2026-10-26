import * as React from "react"

import { cn } from "@/lib/utils"

const TONES = {
  info: "bg-info-soft text-info-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
}

// Birdy extra: a leading icon in the tone's solid colour.
const ICON_TONES = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-neutral",
}

/**
 * Inline callout in a status tone.
 *
 * @param {object} props
 * @param {"info"|"success"|"warning"|"danger"|"neutral"} [props.tone="info"]
 * @param {React.ReactNode} [props.title] Bold first line
 * @param {React.ElementType} [props.icon] Leading icon; the text then aligns to its top
 * @param {React.ReactNode} [props.action] Rendered trailing on the right
 */
function Notice({ tone = "info", title, icon: Icon, action, children, className, ...props }) {
  return (
    <div
      data-ds="notice"
      data-slot="notice"
      role="status"
      className={cn(
        "flex justify-between gap-3 rounded-control px-3 py-2 text-sm",
        Icon ? "items-start" : "items-center",
        TONES[tone],
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <Icon aria-hidden className={cn("mt-px size-[18px] shrink-0", ICON_TONES[tone])} />}
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="leading-relaxed">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { Notice }

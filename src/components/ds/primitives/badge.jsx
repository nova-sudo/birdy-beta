import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Soft: tinted fill + dark ink. Dot: no fill, status dot + ink text.
const SOFT = {
  neutral: "bg-neutral-soft text-neutral-ink",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
}

const DOT = {
  neutral: "bg-neutral-ink",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
}

const INK = {
  neutral: "text-neutral-ink",
  primary: "text-primary",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
}

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        soft: "rounded-sm px-2 py-0.5",
        dot: "",
      },
    },
    defaultVariants: { variant: "soft" },
  }
)

/**
 * @param {object} props
 * @param {"neutral"|"primary"|"success"|"warning"|"danger"|"info"} [props.tone="neutral"]
 * @param {"soft"|"dot"} [props.variant="soft"]
 */
function Badge({ className, tone = "neutral", variant = "soft", children, ...props }) {
  return (
    <span
      data-ds="badge"
      data-slot="badge"
      className={cn(badgeVariants({ variant }), variant === "dot" ? INK[tone] : SOFT[tone], className)}
      {...props}
    >
      {variant === "dot" && (
        <span aria-hidden data-badge-dot className={cn("size-1.5 rounded-full", DOT[tone])} />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }

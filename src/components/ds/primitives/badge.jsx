import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

export const BADGE_TONES = ["success", "warning", "danger", "info", "purple", "primary", "muted", "neutral"]

/** A tone's fill, ink and icon colour, for marks that share the badge palette without its shape. */
export const BADGE_TONE_CLASSES = {
  success: "bg-success-soft text-success-ink [&>svg]:text-success",
  warning: "bg-warning-soft text-warning-ink [&>svg]:text-warning",
  danger: "bg-danger-soft text-danger-ink [&>svg]:text-danger",
  info: "bg-info-soft text-info-ink [&>svg]:text-info",
  purple: "bg-purple-soft text-purple-ink [&>svg]:text-purple",
  primary: "bg-primary-soft text-primary-ink [&>svg]:text-primary",
  muted: "bg-subdued-soft text-subdued-ink [&>svg]:text-subdued",
  neutral: "bg-neutral-soft text-neutral-ink [&>svg]:text-neutral",
}

/** A tone's ink alone, for a status word shown without the badge. */
export const BADGE_TONE_TEXT = {
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
  purple: "text-purple-ink",
  primary: "text-primary-ink",
  muted: "text-subdued-ink",
  neutral: "text-neutral-ink",
}

// Birdy extra: the dot variant has no fill, only a status dot and the tone's ink.
const DOT = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  purple: "bg-purple",
  primary: "bg-primary",
  muted: "bg-subdued",
  neutral: "bg-neutral",
}

// The leading icon or logo sits as far from the left edge as from the top and bottom.
const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center overflow-hidden font-medium whitespace-nowrap tabular-nums [&>img]:shrink-0 [&>img]:object-cover [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: { soft: "", dot: "" },
      tone: BADGE_TONE_CLASSES,
      size: {
        sm: "h-6 gap-[5px] rounded-[6px] pr-2 pl-2 has-[>svg:first-child,>img:first-child]:pl-1 text-xs leading-4 [&>img]:size-4 [&>img]:rounded-[4px] [&>svg]:size-4",
        md: "h-7 gap-1.5 rounded-badge pr-2.5 pl-2.5 has-[>svg:first-child,>img:first-child]:pl-[5px] text-sm leading-[18px] has-[>img]:gap-[7px] [&>img]:size-[18px] [&>img]:rounded-[5px] [&>svg]:size-[18px]",
      },
    },
    compoundVariants: [{ variant: "dot", className: "h-auto gap-1.5 rounded-none bg-transparent p-0" }],
    defaultVariants: { variant: "soft", tone: "neutral", size: "md" },
  }
)

/**
 * Every status badge leads with a mark: an icon drawn in the tone's solid colour, a logo image
 * URL (a provider, a channel), or for a joined chip a `mark` node. A mark wins over a logo, a
 * logo over the icon. Counts, tags and plan names may go without one.
 *
 * @param {object} props
 * @param {"success"|"warning"|"danger"|"info"|"purple"|"primary"|"muted"|"neutral"} [props.tone="neutral"]
 * @param {"sm"|"md"} [props.size="md"]  md is 28px tall, sm 24px
 * @param {"soft"|"dot"} [props.variant="soft"]  dot is a Birdy extra: status dot and ink, no fill
 * @param {React.ElementType} [props.icon]  leading icon component
 * @param {string} [props.logo]  leading image URL
 * @param {React.ReactElement} [props.mark]  leading node
 */
function Badge({ className, tone = "neutral", size = "md", variant = "soft", icon: Icon, logo, mark, children, ...props }) {
  const dot = variant === "dot"
  return (
    <span
      data-ds="badge"
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, tone, size }),
        dot && BADGE_TONE_TEXT[tone],
        // The short left padding is sized for a leading mark; a text-only badge stays even.
        mark && !dot && (size === "sm" ? "pl-1" : "pl-[5px]"),
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden data-badge-dot className={cn("size-1.5 rounded-full", DOT[tone])} />}
      {!dot &&
        (mark ??
          (logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo chips take any remote URL
            <img src={logo} alt="" aria-hidden />
          ) : (
            Icon && <Icon aria-hidden />
          )))}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }

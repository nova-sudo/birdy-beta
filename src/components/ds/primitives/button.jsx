"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// The press sinks the button 1.5px and shrinks it 2% in 90ms, then lets it go over 160ms. The
// ::before hit area reaches 2% past the edge so the shrink never moves the edge out from under a
// pointer that pressed right on it.
const OUTLINE =
  "bg-raised text-foreground shadow-control hover:shadow-control-hover focus-visible:shadow-[0_0_0_1px_var(--color-hairline),var(--shadow-focus)] active:bg-raised-held active:shadow-control-held"

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap tabular-nums transition-[translate,scale,background-color,box-shadow,color,border-color] duration-160 ease-press outline-none select-none before:absolute before:-inset-[2%] before:content-[''] focus-visible:shadow-focus disabled:pointer-events-none disabled:not-aria-busy:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 motion-safe:active:translate-y-[1.5px] motion-safe:active:scale-[0.98] motion-safe:active:duration-90 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover focus-visible:shadow-[0_0_0_1px_var(--color-primary-edge),var(--shadow-focus)] active:bg-primary-held active:shadow-primary-held",
        // `outline` is the Bytes `secondary` look. `secondary` is its alias; `outline` stays the default.
        outline: OUTLINE,
        secondary: OUTLINE,
        destructive:
          "bg-destructive text-destructive-foreground shadow-destructive hover:bg-destructive-hover focus-visible:shadow-[0_0_0_1px_var(--color-destructive-edge),var(--shadow-focus)] active:bg-destructive-held active:shadow-destructive-held",
        ghost: "text-foreground hover:bg-ghost-hover active:bg-ghost-held",
        dashed:
          "border-[1.5px] border-dashed border-dashed-edge text-dashed-foreground hover:border-dashed-edge-hover hover:bg-ghost-hover hover:text-foreground active:border-dashed-edge-held active:bg-ghost-held",
        link: "text-soft-fg underline-offset-4 hover:underline motion-safe:active:translate-y-0 motion-safe:active:scale-100",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-control-sm px-3 text-sm [&_svg]:size-4",
        md: "h-10 gap-2 rounded-control px-4 text-base [&_svg]:size-[18px]",
        lg: "h-12 gap-2 rounded-control-lg px-5 text-base [&_svg]:size-5",
        "icon-sm": "size-8 rounded-control-sm [&_svg]:size-4",
        icon: "size-10 rounded-control [&_svg]:size-[18px]",
        "icon-lg": "size-12 rounded-control-lg [&_svg]:size-5",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "outline", size: "md" },
  }
)

const SPINNER_SIZE = {
  sm: "size-4",
  md: "size-[18px]",
  lg: "size-5",
  "icon-sm": "size-4",
  icon: "size-[18px]",
  "icon-lg": "size-5",
}

/**
 * @param {object} props
 * @param {"primary"|"outline"|"secondary"|"ghost"|"destructive"|"dashed"|"link"} [props.variant="outline"] `secondary` is an alias of `outline` (the Bytes name for that look).
 * @param {"sm"|"md"|"lg"|"icon-sm"|"icon"|"icon-lg"} [props.size="md"]
 * @param {boolean} [props.loading] Overlays a spinner, sets aria-busy and disables. The label stays in the layout so width holds.
 * @param {React.ReactNode} [props.badge] A count or short marker shown as a pill after the label. Hidden while loading.
 * @param {boolean} [props.asChild] Render the single child element with the button styles (Radix Slot).
 */
const Button = React.forwardRef(function Button(
  { className, variant = "outline", size = "md", loading = false, badge, asChild = false, disabled, children, ...props },
  ref
) {
  const classes = cn(buttonVariants({ variant, size }), className)

  // Slot needs a lone child, so asChild skips the badge and loading scaffolding.
  if (asChild) {
    return (
      <Slot ref={ref} data-ds="button" data-slot="button" data-variant={variant} className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      data-ds="button"
      data-slot="button"
      data-variant={variant}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2Icon aria-hidden className={cn("animate-spin motion-reduce:animate-none", SPINNER_SIZE[size])} />
        </span>
      )}
      {/* opacity does nothing on display:contents, so the loading label gets a real box that borrows the button's gap */}
      <span className={cn(loading ? "inline-flex items-center justify-center gap-[inherit] opacity-0" : "contents")}>
        {children}
        {badge != null && badge !== false && !loading && (
          <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-xs leading-none text-primary-foreground tabular-nums">
            {badge}
          </span>
        )}
      </span>
    </button>
  )
})

export { Button, buttonVariants }

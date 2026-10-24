"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// Press is CSS, not JS: 90ms down, 160ms release on the ease-press curve.
// `motion-reduce:transform-none` drops the movement but keeps the colour change.
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control text-sm font-medium outline-none transition-[transform,box-shadow,background-color,color] duration-[160ms] ease-press active:translate-y-[1.5px] active:scale-[.98] active:duration-[90ms] motion-reduce:transform-none focus-visible:shadow-control-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-control hover:bg-primary/90",
        outline: "bg-background text-foreground shadow-control hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        destructive: "bg-danger text-primary-foreground shadow-control hover:bg-danger/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-control-sm px-3",
        md: "h-control px-4",
        lg: "h-control-lg px-5 text-base [&_svg]:size-5",
        "icon-sm": "h-control-sm w-control-sm",
        icon: "h-control w-control",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  }
)

/**
 * @param {object} props
 * @param {"primary"|"outline"|"ghost"|"secondary"|"destructive"|"link"} [props.variant="outline"]
 * @param {"sm"|"md"|"lg"|"icon-sm"|"icon"} [props.size="md"]
 * @param {boolean} [props.loading] Overlays a spinner, sets aria-busy and disables. The label stays in the layout so width holds.
 * @param {boolean} [props.asChild] Render the single child element with the button styles (Radix Slot).
 */
const Button = React.forwardRef(function Button(
  { className, variant = "outline", size = "md", loading = false, asChild = false, disabled, children, ...props },
  ref
) {
  const classes = cn(buttonVariants({ variant, size }), className)

  // Slot needs a lone child, so asChild skips the loading scaffolding.
  if (asChild) {
    return (
      <Slot ref={ref} data-ds="button" data-slot="button" className={classes} {...props}>
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
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center justify-center gap-1.5">{children}</span>
          <Loader2Icon aria-hidden className="absolute size-4 animate-spin motion-reduce:animate-none" />
        </>
      ) : (
        children
      )}
    </button>
  )
})

export { Button, buttonVariants }

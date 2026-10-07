import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-pd-primary-tint text-pd-primary [a&]:hover:bg-purple-200",
        secondary:
          "border-transparent bg-pd-divider text-pd-body [a&]:hover:bg-pd-border",
        success:
          "border-transparent bg-pd-success-bg text-pd-success [a&]:hover:bg-pd-healthy-border",
        warning:
          "border-transparent bg-pd-warning-bg text-pd-amber [a&]:hover:bg-pd-amber-bg",
        destructive:
          "border-transparent bg-pd-danger-bg text-pd-danger [a&]:hover:bg-pd-danger-border focus-visible:ring-destructive/20 ",
        outline:
          "border-border bg-background text-foreground [a&]:hover:bg-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }

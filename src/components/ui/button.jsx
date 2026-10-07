import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,box-shadow,transform,color,border-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[.96] active:duration-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:cursor-pointer motion-reduce:transform-none motion-reduce:transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_rgba(91,63,214,.45),inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-purple-700 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgba(91,63,214,.5),inset_0_1px_0_rgba(255,255,255,.18)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_2px_8px_-2px_rgba(229,72,77,.4)] hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-border bg-background shadow-xs hover:bg-secondary hover:border-gray-300",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "hover:bg-foreground/5 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        md: "h-8 gap-1.5 px-2.5 has-[>svg]:px-2 text-xs",
        xs: "h-7 gap-1.5 px-2 has-[>svg]:px-2 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }

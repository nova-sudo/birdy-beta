"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "./cn";

/**
 * A short label that appears on hover or keyboard focus.
 *
 * @param {React.ReactNode} props.label the tooltip's text
 * @param {React.ReactNode} props.children the single element it describes
 * @param {"top"|"right"|"bottom"|"left"} [props.side]
 */
export function Tooltip({ label, children, side = "top", sideOffset = 8, className, ...props }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root {...props}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            className={cn(
              "z-50 max-w-64 rounded-by-sm bg-by-text px-2.5 py-1.5 font-by-body text-by-caption font-medium text-by-surface shadow-by-floating",
              "motion-safe:animate-[by-fade_var(--by-dur-fast)_var(--by-ease-out)]",
              className,
            )}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

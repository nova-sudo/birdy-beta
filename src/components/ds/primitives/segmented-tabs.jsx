"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

// Thumb spring from the design spec. The app wraps in MotionConfig reducedMotion="user",
// which turns the layout slide into an instant swap.
const THUMB_SPRING = { type: "spring", damping: 22, stiffness: 260 }

/**
 * Muted track with a white thumb that slides to the active item.
 *
 * @param {object} props
 * @param {string} props.value Active item value.
 * @param {(value: string) => void} props.onValueChange
 * @param {{ value: string, label: React.ReactNode, count?: React.ReactNode }[]} props.items
 * @param {"sm"|"md"} [props.size="md"]
 * @param {string} [props.ariaLabel]
 */
function SegmentedTabs({ value, onValueChange, items, size = "md", ariaLabel, className }) {
  const thumbId = React.useId()

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-ds="segmented-tabs"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control bg-muted p-1",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange?.(item.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:shadow-control-focus",
              size === "sm" ? "h-6 px-2.5 text-xs" : "h-8 px-3 text-sm",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                aria-hidden
                className="absolute inset-0 rounded-sm bg-background shadow-control"
                transition={THUMB_SPRING}
              />
            )}
            <span className="relative">{item.label}</span>
            {item.count != null && (
              <span className="num relative text-xs text-muted-foreground">{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedTabs }

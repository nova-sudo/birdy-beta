"use client";

import { useId, useRef } from "react";
import { motion } from "framer-motion";
import { EASE_SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

// The chart metric tabs and the right rail's Suggestions/Activity toggle are
// the same control at two widths, so they share one implementation.
//
// Both get roving focus: the group is a single tab stop and arrow keys move
// between options, which is what a screen-reader user expects from a tablist or
// radiogroup and what they get from the native <select> this replaces visually.
//
// `role` differs by use. The rail genuinely swaps panels, so it is a tablist.
// The chart tabs pick which series is plotted rather than revealing a different
// region, so they are a radiogroup.

export function PdSegmented({
  options,
  value,
  onChange,
  label,
  role = "radiogroup",
  className,
  itemClassName,
  panelId,
}) {
  const itemsRef = useRef([]);
  const isTablist = role === "tablist";
  // One white pill slides between the options (a shared layoutId), so each
  // control needs its own id or two strips on one page would trade pills.
  const pillId = useId();

  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;

    if (step) next = (index + step + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next === null) return;

    event.preventDefault();
    onChange(options[next].key);
    itemsRef.current[next]?.focus();
  };

  return (
    <div
      role={role}
      aria-label={label}
      className={cn(
        // A pill track with pill chips: concentric by construction.
        "flex gap-[5px] rounded-full bg-pd-divider p-1",
        className
      )}
    >
      {options.map((option, i) => {
        const selected = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            ref={(el) => {
              itemsRef.current[i] = el;
            }}
            role={isTablist ? "tab" : "radio"}
            {...(isTablist
              ? { "aria-selected": selected, "aria-controls": panelId }
              : { "aria-checked": selected })}
            // Roving tabindex: only the selected option is in the tab order.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative flex min-w-0 cursor-pointer items-center justify-center gap-[7px] rounded-full font-pd-display text-[12.5px] font-semibold transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
              selected ? "text-pd-ink" : "bg-transparent text-pd-muted hover:text-pd-ink",
              itemClassName
            )}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-pd-surface shadow-pd-segment"
                transition={{ duration: 0.5, ease: EASE_SPRING }}
              />
            )}
            {/* Section tabs carry a 14px leading glyph; metric tabs don't. */}
            {option.icon && <option.icon className="size-[14px] shrink-0" aria-hidden="true" />}
            {/* A third panel makes these tight in a 340px rail; the label gives
                way before the count does, since the count is the scannable bit. */}
            <span className="truncate">{option.label}</span>
            {option.badge != null && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-bold",
                  option.badgeClassName
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

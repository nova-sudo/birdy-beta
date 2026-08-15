"use client";

import { useRef } from "react";
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
        "flex gap-[5px] rounded-[10px] border border-pd-border bg-pd-divider p-1",
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
              "flex min-w-0 cursor-pointer items-center justify-center gap-[7px] rounded-lg font-pd-display text-[12.5px] font-semibold",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
              selected ? "bg-pd-surface text-pd-ink shadow-pd-segment" : "bg-transparent text-pd-muted",
              itemClassName
            )}
          >
            {/* A third panel makes these tight in a 340px rail; the label gives
                way before the count does, since the count is the scannable bit. */}
            <span className="truncate">{option.label}</span>
            {option.badge != null && (
              <span
                className={cn(
                  "shrink-0 rounded-[5px] px-1.5 py-px text-[10.5px] font-bold",
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

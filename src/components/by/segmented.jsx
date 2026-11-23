"use client";

import { cn } from "./cn";
import { FOCUS_RING } from "./motion";

/**
 * A small row of toggle buttons where one is on: a filter (All · Messages · Calls)
 * or a choice inside a form (SMS · Email). Lighter than TabPill: it switches what
 * one panel shows, not between panels, so its buttons are pressed toggles, not tabs.
 *
 * @param {{value: string, label: string, count?: number}[]} props.items a count shows after the label, muted when zero
 * @param {string} props.value the pressed item
 * @param {(value: string) => void} props.onValueChange
 * @param {string} props["aria-label"] what the buttons choose
 */
export function Segmented({ items, value, onValueChange, "aria-label": ariaLabel, className, ...props }) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("inline-flex shrink-0 gap-0.5 rounded-full border border-by-line-strong/70 bg-by-line p-0.5", className)} {...props}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={on}
            aria-label={item.count != null ? `${item.label}, ${item.count}` : undefined}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-by-body text-by-body-sm font-semibold",
              "transition-colors duration-(--by-dur-fast) ease-by-out",
              on ? "bg-by-surface text-by-text shadow-by-raised" : "text-by-text-2 hover:text-by-text",
              FOCUS_RING,
            )}
          >
            {item.label}
            {item.count != null && <span className={cn("tabular-nums font-medium", item.count === 0 || !on ? "text-by-muted" : "text-by-text-2")}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

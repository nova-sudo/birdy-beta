"use client";

import { useLayoutEffect, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";
import { CountBadge } from "./pill";

/** The look of one entry in the pill. Tabs use it; so should a `trailing` button. */
export const PILL_EXTRA = cn(
  "relative z-10 inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5",
  "font-by-body text-by-body font-semibold text-by-text-2 transition-colors duration-(--by-dur-fast) ease-by-out",
  "hover:text-by-text [&_svg]:size-3.5",
  FOCUS_RING,
);

/**
 * The grey pill of tabs with a white chip that slides to the open one.
 *
 * @param {{value: string, label: string, count?: number, disabled?: boolean, hint?: string, badge?: React.ReactNode}[]} props.items
 *   `disabled` greys a tab that is not built yet; `hint` replaces its "Coming soon" tooltip (e.g. why it is locked).
 *   `badge` sits after the label, e.g. a lock icon or a "New" pill
 * @param {string} props.value the open tab
 * @param {(value: string) => void} props.onValueChange
 * @param {string} props["aria-label"] what the tabs switch between
 * @param {React.ReactNode} [props.trailing] sits inside the pill after the tabs, e.g. a "More" menu trigger (use PILL_EXTRA for its classes).
 *   Give it `data-pill-current` while a page it leads to is open, and the chip moves under it.
 * @param {React.ReactNode} [props.toolbar] controls on the same row as the pill, pushed to the right (sort, search, columns)
 * @param {boolean} [props.fill] take the remaining height of a flex column, so a panel can hold a table that scrolls inside itself
 * @param {React.ReactNode} [props.children] TabPanel elements, one per item
 */
export function TabPill({ items, value, onValueChange, "aria-label": ariaLabel, trailing, toolbar, fill = false, className, children, ...props }) {
  const listRef = useRef(null);
  const [chip, setChip] = useState(null);

  // Measure the open tab and move the chip under it. Re-measured when the tab
  // changes and whenever the row resizes (fonts loading, counts changing).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // A `trailing` element marked `data-pill-current` (the More menu while one of its pages is open)
    // wears the chip when no tab is open.
    const measure = () => {
      const active = list.querySelector('[role="tab"][data-state="active"]') ?? list.querySelector("[data-pill-current]");
      setChip(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, items]);

  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={fill ? "flex min-h-0 flex-1 flex-col" : undefined} {...props}>
      <div className={toolbar ? "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5" : undefined}>
      <TabsPrimitive.List
        ref={listRef}
        aria-label={ariaLabel}
        className={cn("relative inline-flex gap-0.5 rounded-full border border-by-line bg-by-sunken p-1", className)}
      >
        {chip && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-0 rounded-full bg-by-surface shadow-by-raised [transition:transform_var(--by-dur-tab)_var(--by-ease-spring),width_var(--by-dur-tab)_var(--by-ease-spring)] motion-reduce:transition-none"
            style={{ width: chip.width, transform: `translateX(${chip.left}px)` }}
          />
        )}
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            title={item.disabled ? item.hint ?? "Coming soon" : undefined}
            className={cn(PILL_EXTRA, "data-[state=active]:text-by-text disabled:cursor-not-allowed disabled:text-by-muted disabled:opacity-60 disabled:hover:text-by-muted")}
          >
            {item.label}
            {item.badge}
            {item.count > 0 && <CountBadge>{item.count}</CountBadge>}
          </TabsPrimitive.Trigger>
        ))}
        {trailing}
      </TabsPrimitive.List>
      {toolbar && <div className="ml-auto flex items-center gap-2.5">{toolbar}</div>}
      </div>
      {children}
    </TabsPrimitive.Root>
  );
}

/** The content for one tab of a TabPill. @param {string} props.value */
export function TabPanel({ className, ...props }) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

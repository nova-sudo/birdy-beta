"use client";

import { useLayoutEffect, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";
import { CountBadge } from "./pill";

/**
 * The grey pill of tabs with a white chip that slides to the open one.
 *
 * @param {{value: string, label: string, count?: number}[]} props.items
 * @param {string} props.value the open tab
 * @param {(value: string) => void} props.onValueChange
 * @param {string} props["aria-label"] what the tabs switch between
 * @param {React.ReactNode} [props.children] TabPanel elements, one per item
 */
export function TabPill({ items, value, onValueChange, "aria-label": ariaLabel, className, children, ...props }) {
  const listRef = useRef(null);
  const [chip, setChip] = useState(null);

  // Measure the open tab and move the chip under it. Re-measured when the tab
  // changes and whenever the row resizes (fonts loading, counts changing).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector('[data-state="active"]');
      if (active) setChip({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, items]);

  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} {...props}>
      <TabsPrimitive.List
        ref={listRef}
        aria-label={ariaLabel}
        className={cn("relative inline-flex gap-0.5 rounded-by-lg border border-by-line bg-by-sunken p-1", className)}
      >
        {chip && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-0 rounded-by-md bg-by-surface shadow-by-raised [transition:transform_var(--by-dur-tab)_var(--by-ease-spring),width_var(--by-dur-tab)_var(--by-ease-spring)] motion-reduce:transition-none"
            style={{ width: chip.width, transform: `translateX(${chip.left}px)` }}
          />
        )}
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "relative z-10 inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-by-md px-3.5",
              "font-by-body text-by-body font-semibold text-by-text-2 transition-colors duration-(--by-dur-fast) ease-by-out",
              "hover:text-by-text data-[state=active]:text-by-text",
              FOCUS_RING,
            )}
          >
            {item.label}
            {item.count > 0 && <CountBadge>{item.count}</CountBadge>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

/** The content for one tab of a TabPill. @param {string} props.value */
export function TabPanel({ className, ...props }) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

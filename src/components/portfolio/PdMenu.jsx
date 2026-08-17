"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared dropdown for the Portfolio Dashboard's two chip menus: the header
// timeframe picker and the top-clients metric picker. Same popover treatment at
// two sizes — the design gives the header chip a taller trigger and a slightly
// rounder menu than the in-card one.
//
// The prototype only closed on selection; the handoff calls for outside-click
// and Escape in production, so both live here.

const SIZES = {
  // Header chip: 38px tall, 10px radius, 160px menu.
  lg: {
    trigger: "h-[38px] gap-2 rounded-[10px] px-[13px] text-[13px]",
    menu: "top-[44px] w-[160px] rounded-[12px] p-[6px]",
    option: "px-[11px] py-[9px] text-[13px]",
  },
  // In-card chip: shorter, 9px radius, 170px menu.
  sm: {
    trigger: "gap-[7px] rounded-[9px] px-[11px] py-[7px] text-[12.5px]",
    menu: "top-9 w-[170px] rounded-[11px] p-[5px]",
    option: "px-[10px] py-2 text-[12.5px]",
  },
};

/** Options may be plain strings or {value, label} pairs. */
function normalise(options) {
  return (options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export function PdMenu({ value, options: rawOptions, onChange, icon, label, size = "lg", className }) {
  const options = normalise(rawOptions);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionsRef = useRef([]);
  const menuId = useId();
  const s = SIZES[size];

  const close = ({ refocus = false } = {}) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      // Escape hands focus back to the trigger; a Tab out just closes, so the
      // user carries on through the page rather than being pulled backwards.
      if (e.key === "Escape") close({ refocus: true });
      else if (e.key === "Tab") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Opening moves focus onto the current selection, so a keyboard user lands
  // where they are rather than at the top of the list.
  useLayoutEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(options.findIndex((o) => o.value === value), 0);
    optionsRef.current[selectedIndex]?.focus();
  }, [open, options, value]);

  const onOptionKeyDown = (event, index) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    let next = null;

    if (step) next = (index + step + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    if (next === null) return;

    event.preventDefault();
    optionsRef.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex cursor-pointer items-center border border-pd-border bg-pd-surface font-semibold text-pd-body",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary",
          s.trigger
        )}
      >
        {icon}
        {selectedLabel}
        <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute right-0 z-20 border border-pd-border bg-pd-surface shadow-pd-popover",
            s.menu
          )}
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                ref={(el) => {
                  optionsRef.current[i] = el;
                }}
                onKeyDown={(e) => onOptionKeyDown(e, i)}
                // The prototype's real bug: without stopPropagation the click
                // bubbles to the trigger and reopens the menu immediately.
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(option.value);
                  close({ refocus: true });
                }}
                className={cn(
                  "block w-full cursor-pointer rounded-lg text-left font-medium",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pd-primary",
                  s.option,
                  selected ? "bg-pd-primary-tint text-pd-primary" : "bg-transparent text-pd-body"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

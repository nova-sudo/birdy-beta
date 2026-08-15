"use client";

import { useEffect, useId, useRef, useState } from "react";
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

export function PdMenu({ value, options, onChange, icon, label, size = "lg", className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const s = SIZES[size];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex cursor-pointer items-center border border-pd-border bg-pd-surface font-semibold text-pd-body",
          s.trigger
        )}
      >
        {icon}
        {value}
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
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                // The prototype's real bug: without stopPropagation the click
                // bubbles to the trigger and reopens the menu immediately.
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(option);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full cursor-pointer rounded-lg text-left font-medium",
                  s.option,
                  selected ? "bg-pd-primary-tint text-pd-primary" : "bg-transparent text-pd-body"
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

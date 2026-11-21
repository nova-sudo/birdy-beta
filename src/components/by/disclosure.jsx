"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING } from "./motion";

/**
 * A folded extra: a dashed row with a chevron that opens to show more, for
 * detail most people skip (lead tracking per client, where credits went, a
 * password change).
 *
 * @param {React.ReactNode} props.label the row's text
 * @param {React.ReactNode} [props.count] a quiet chip after the label, e.g. "41 need setup"
 * @param {boolean} [props.defaultOpen]
 * @param {boolean} [props.open] controlled; pass with `onOpenChange`
 * @param {(open: boolean) => void} [props.onOpenChange]
 */
export function Disclosure({ label, count, defaultOpen = false, open: controlled, onOpenChange, className, children, ...props }) {
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const panelId = useId();
  const toggle = () => {
    if (controlled === undefined) setOwn(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className={cn("rounded-by-lg border border-dashed border-by-line bg-by-surface/60", className)} {...props}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn("flex w-full cursor-pointer items-center gap-2 rounded-by-lg px-4 py-3 text-left font-by-body text-by-body font-semibold text-by-text-2 hover:text-by-text", FOCUS_RING)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 text-by-muted transition-transform duration-(--by-dur-fast) ease-by-out", open && "rotate-90")}
        />
        <span className="min-w-0">{label}</span>
        {count != null && count !== "" && (
          <span className="rounded-by-sm bg-by-sunken px-2 py-0.5 text-by-label font-semibold uppercase tracking-[0.05em] text-by-text-2">{count}</span>
        )}
      </button>
      {open && (
        <div id={panelId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

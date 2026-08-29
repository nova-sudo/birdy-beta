"use client";

import { Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY = {
  HIGH: { text: "text-pd-danger", dot: "bg-pd-danger" },
  OPPORTUNITY: { text: "text-pd-success", dot: "bg-pd-success" },
  MEDIUM: { text: "text-pd-warning", dot: "bg-pd-warning" },
};

/**
 * One Birdy recommendation: what it is, which client, why, and the two things
 * you can do about it.
 *
 * @param {{id, severity, client, title, why}} suggestion
 */
export function SuggestionCard({ suggestion, onApply, onDismiss, applyLabel = "Do it" }) {
  const severity = SEVERITY[suggestion.severity] ?? SEVERITY.MEDIUM;

  return (
    <article className="mb-2 rounded-[10px] border border-pd-border px-3 py-[11px]">
      <div className="flex items-center gap-[7px]">
        <span className={cn("size-[7px] shrink-0 rounded-full", severity.dot)} aria-hidden="true" />
        <span className={cn("shrink-0 text-[10.5px] font-bold", severity.text)}>
          {suggestion.severity}
        </span>
        <span className="truncate text-[11px] text-pd-faint">{suggestion.client}</span>
      </div>

      <h3 className="mt-[5px] font-pd-display text-[13px] font-semibold leading-[1.3] text-pd-ink">
        {suggestion.title}
      </h3>

      <div className="mt-[5px] flex items-end gap-2.5">
        <p className="min-w-0 flex-1 text-[11.5px] leading-[1.4] text-pd-muted">{suggestion.why}</p>

        <div className="flex shrink-0 items-center gap-[5px]">
          {/* "Do it" alone is ambiguous once there are four cards in the rail;
              the accessible name carries which suggestion it acts on. */}
          <button
            type="button"
            title="Do it for me"
            aria-label={`Do it for me: ${suggestion.title} for ${suggestion.client}`}
            onClick={() => onApply(suggestion)}
            className="flex cursor-pointer items-center gap-[5px] rounded-[7px] bg-pd-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <Zap className="size-3 shrink-0" aria-hidden="true" />
            {applyLabel}
          </button>
          <button
            type="button"
            title="Dismiss"
            aria-label={`Dismiss: ${suggestion.title} for ${suggestion.client}`}
            onClick={() => onDismiss(suggestion)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-[7px] border border-pd-border text-pd-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <Trash2 className="size-[13px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

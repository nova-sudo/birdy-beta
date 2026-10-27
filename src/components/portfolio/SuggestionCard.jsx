"use client";

import { Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  // An agent rule set to "flag" only reports; there is nothing to do for it.
  const flagOnly =
    Boolean(suggestion.agent_id) && suggestion.rule_mode === "flag" && Boolean(suggestion.has_action);

  return (
    <article className="mb-2 rounded-xl border border-pd-border bg-pd-surface px-3.5 py-3 shadow-sm">
      <div className="flex items-center gap-[7px]">
        <span className={cn("size-[7px] shrink-0 rounded-full", severity.dot)} aria-hidden="true" />
        <span className={cn("shrink-0 text-[10.5px] font-bold", severity.text)}>
          {suggestion.severity}
        </span>
        <span className="truncate text-[11px] text-pd-faint">{suggestion.client}</span>
        {suggestion.agent_id && (
          <span className="ml-auto shrink-0 text-[10.5px] font-semibold text-pd-primary">
            Media Buying Agent
          </span>
        )}
      </div>

      <h3 className="mt-[5px] font-pd-display text-[13px] font-semibold leading-[1.3] text-pd-ink">
        {suggestion.title}
      </h3>

      <div className="mt-[5px] flex items-end gap-2.5">
        <p className="min-w-0 flex-1 text-[11.5px] leading-[1.4] text-pd-muted">{suggestion.why}</p>

        <div className="flex shrink-0 items-center gap-[5px]">
          {/* "Do it" alone is ambiguous once there are four cards in the rail;
              the accessible name carries which suggestion it acts on. */}
          {!flagOnly && (
          <Button
            size="xs"
            title="Do it for me"
            aria-label={`Do it for me: ${suggestion.title} for ${suggestion.client}`}
            onClick={() => onApply(suggestion)}
            className="gap-[5px] px-3 text-[11.5px] [&_svg]:size-3"
          >
            <Zap className="shrink-0" aria-hidden="true" />
            {applyLabel}
          </Button>
          )}
          <button
            type="button"
            title="Dismiss"
            aria-label={`Dismiss: ${suggestion.title} for ${suggestion.client}`}
            onClick={() => onDismiss(suggestion)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-pd-border text-pd-faint transition-colors hover:bg-pd-divider hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <Trash2 className="size-[13px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

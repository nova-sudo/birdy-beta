"use client";

import { Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY_COLOR = {
  HIGH: "text-pd-danger",
  OPPORTUNITY: "text-pd-success",
  MEDIUM: "text-pd-warning",
};

const SEVERITY_DOT = {
  HIGH: "bg-pd-danger",
  OPPORTUNITY: "bg-pd-success",
  MEDIUM: "bg-pd-warning",
};

const MODES = {
  "Auto-run": { glyph: "⚡", className: "bg-pd-primary-tint text-pd-primary" },
  Approved: { glyph: "✓", className: "bg-pd-success-bg text-pd-success" },
};

function SuggestionCard({ suggestion, onApply, onDismiss }) {
  return (
    <article className="mb-2 rounded-[10px] border border-pd-border px-3 py-[11px]">
      <div className="flex items-center gap-[7px]">
        <span
          className={cn("size-[7px] shrink-0 rounded-full", SEVERITY_DOT[suggestion.severity])}
          aria-hidden="true"
        />
        <span
          className={cn(
            "shrink-0 text-[10.5px] font-bold",
            SEVERITY_COLOR[suggestion.severity]
          )}
        >
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
          <button
            type="button"
            title="Do it for me"
            onClick={() => onApply(suggestion)}
            className="flex cursor-pointer items-center gap-[5px] rounded-[7px] bg-pd-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white"
          >
            <Zap className="size-3 shrink-0" aria-hidden="true" />
            Do it
          </button>
          <button
            type="button"
            title="Dismiss"
            aria-label={`Dismiss: ${suggestion.title}`}
            onClick={() => onDismiss(suggestion)}
            className="flex size-7 cursor-pointer items-center justify-center rounded-[7px] border border-pd-border text-pd-faint"
          >
            <Trash2 className="size-[13px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ActivityRow({ entry }) {
  const mode = MODES[entry.mode] ?? MODES.Approved;

  return (
    <li className="mb-[15px] flex gap-[11px]">
      <span
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          mode.className
        )}
        aria-hidden="true"
      >
        {mode.glyph}
      </span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold leading-[1.35] text-pd-ink">{entry.action}</div>
        <div className="mt-0.5 text-[11.5px] text-pd-subtle">{entry.client}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-[5px] px-[7px] py-0.5 text-[10.5px] font-bold",
              mode.className
            )}
          >
            {entry.mode}
          </span>
          <span className="text-[11px] text-pd-faint">{entry.time}</span>
        </div>
      </div>
    </li>
  );
}

/**
 * Suggestions and activity, sharing one scroll area.
 *
 * Only the selected panel renders. That is deliberate and was a design
 * decision, not an optimisation: an earlier stacked two-pane version put two
 * scrollbars in a 340px rail and was rejected.
 */
export function RightRail({
  panel,
  onPanelChange,
  suggestions,
  activity,
  activityCount,
  onApply,
  onDismiss,
  emptyMessage = "Nothing here right now",
}) {
  const tabs = [
    { key: "suggestions", label: "Suggestions", count: suggestions.length, badge: "bg-pd-primary-tint text-pd-primary" },
    { key: "activity", label: "Activity", count: activityCount ?? activity.length, badge: "bg-pd-neutral-badge text-pd-subtle" },
  ];

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-pd-border bg-pd-surface">
      <div className="shrink-0 border-b border-pd-divider px-5 py-4">
        <div className="flex gap-[5px] rounded-[10px] border border-pd-border bg-pd-divider p-1">
          {tabs.map((tab) => {
            const selected = tab.key === panel;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onPanelChange(tab.key)}
                className={cn(
                  "flex flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-lg p-2 font-pd-display text-[12.5px] font-semibold",
                  selected ? "bg-pd-surface text-pd-ink shadow-pd-segment" : "text-pd-muted"
                )}
              >
                {tab.label}
                <span className={cn("rounded-[5px] px-1.5 py-px text-[10.5px] font-bold", tab.badge)}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pd-scrolly min-h-0 flex-1 px-5 py-4">
        {panel === "suggestions" ? (
          suggestions.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-pd-faint">{emptyMessage}</p>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApply={onApply}
                onDismiss={onDismiss}
              />
            ))
          )
        ) : activity.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-pd-faint">{emptyMessage}</p>
        ) : (
          <ul>
            {activity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

"use client";

import { useMemo } from "react";
import {
  ChevronRight,
  CircleCheck,
  Eye,
  MessageCircle,
  MessageCircleMore,
  TriangleAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaTone, diagnoseFunnel } from "@/lib/portfolio-metrics";

// Chip tints run purple → blue → amber → red → green down the funnel, matching
// the KPI strip so a stage and its headline number read as the same thing.
const STAGE_CHIPS = {
  leads: { Icon: Users, className: "bg-pd-primary-tint text-pd-primary" },
  engaged: { Icon: MessageCircle, className: "bg-pd-info-bg text-pd-info" },
  convos: { Icon: MessageCircleMore, className: "bg-pd-warning-bg text-pd-warning" },
  closes: { Icon: CircleCheck, className: "bg-pd-danger-bg text-pd-danger" },
  shows: { Icon: Eye, className: "bg-pd-success-bg text-pd-success" },
};

const DIAGNOSTIC_STATES = {
  problem: {
    Icon: TriangleAlert,
    banner: "bg-pd-danger-surface border-pd-danger-border",
    chip: "bg-pd-danger-bg text-pd-danger",
    title: "text-pd-danger",
  },
  healthy: {
    Icon: CircleCheck,
    banner: "bg-pd-healthy-surface border-pd-healthy-border",
    chip: "bg-pd-success-bg text-pd-success",
    title: "text-pd-success",
  },
};

/**
 * Funnel stepper plus the banner that reads it.
 *
 * The banner isn't fixed copy — it's derived, so it stays true when the numbers
 * move. It finds the worst materially declining stage and, when the stage
 * feeding it is rising, says so: that contrast is what tells an agency owner
 * the problem is a step in the process rather than the top of the funnel.
 */
export function PerformanceFunnel({ stages }) {
  const diagnosis = useMemo(() => diagnoseFunnel(stages), [stages]);
  const state = DIAGNOSTIC_STATES[diagnosis.state];
  const DiagnosticIcon = state.Icon;

  return (
    <section className="min-w-0 flex-[1.45] rounded-[16px] border border-pd-border bg-pd-surface px-[22px] py-5">
      <h2 className="mb-[18px] font-pd-display text-[15px] font-semibold text-pd-ink">
        Performance funnel
      </h2>

      <ol className="flex items-start gap-1">
        {stages.map((stage, i) => {
          const chip = STAGE_CHIPS[stage.key];
          const Icon = chip.Icon;
          const tone = deltaTone(stage.direction);

          return (
            <li key={stage.key} className="flex min-w-0 flex-1 items-start gap-1">
              <div className="min-w-0 flex-1 text-center">
                <span
                  className={cn(
                    "mx-auto mb-[9px] flex size-[42px] items-center justify-center rounded-xl",
                    chip.className
                  )}
                >
                  <Icon className="size-[19px]" aria-hidden="true" />
                </span>
                <div className="text-[12px] text-pd-faint">{stage.stage}</div>
                <div className="mt-[3px] font-pd-display text-[22px] font-bold text-pd-ink">
                  {stage.count}
                </div>
                <div className={cn("mt-1 text-[12px] font-semibold", tone.text)}>
                  <span aria-hidden="true">{stage.direction === "up" ? "↑" : "↓"}</span>
                  <span className="sr-only">{stage.direction} </span> {stage.delta}%
                </div>
              </div>

              {/* Sits level with the icon chips rather than the row centre. */}
              {i < stages.length - 1 && (
                <ChevronRight
                  className="mt-[52px] size-[15px] shrink-0 text-pd-chevron"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          "mt-5 flex items-center gap-[11px] rounded-xl border px-4 py-[14px]",
          state.banner
        )}
      >
        <span
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
            state.chip
          )}
        >
          <DiagnosticIcon className="size-[15px]" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className={cn("font-pd-display text-[13.5px] font-semibold", state.title)}>
            {diagnosis.title}
          </div>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-pd-body">{diagnosis.body}</p>
        </div>
      </div>
    </section>
  );
}

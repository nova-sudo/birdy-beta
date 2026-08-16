"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { deltaTone } from "@/lib/portfolio-metrics";
import { toneClass } from "./tones";

/**
 * Horizontal funnel: an icon chip, stage name, count and delta per step, with
 * a chevron between steps that sits level with the chips rather than the row
 * centre.
 *
 * @param {{key, stage, count, tone, icon, direction?, delta?}[]} stages in funnel order
 */
export function FunnelStepper({ stages }) {
  if (!stages?.length) return null;

  return (
    <ol className="flex items-start gap-1">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        const tone = stage.direction ? deltaTone(stage.direction) : null;

        return (
          <li key={stage.key} className="flex min-w-0 flex-1 items-start gap-1">
            <div className="min-w-0 flex-1 text-center">
              <span
                className={cn(
                  "mx-auto mb-[9px] flex size-[42px] items-center justify-center rounded-xl",
                  toneClass(stage.tone)
                )}
              >
                <Icon className="size-[19px]" aria-hidden="true" />
              </span>
              <div className="text-[12px] text-pd-faint">{stage.stage}</div>
              <div
                className="mt-[3px] font-pd-display text-[22px] font-bold text-pd-ink"
                // An estimate says so rather than wearing the same exactness as
                // a counted figure.
                title={stage.estimated ? `${stage.count} — estimated from a sample` : undefined}
              >
                {stage.estimated && (
                  <span aria-hidden="true" className="text-pd-faint">
                    ≈
                  </span>
                )}
                {stage.estimated && <span className="sr-only">approximately </span>}
                {stage.count}
              </div>
              {tone && (
                <div className={cn("mt-1 text-[12px] font-semibold", tone.text)}>
                  <span aria-hidden="true">{stage.direction === "up" ? "↑" : "↓"}</span>
                  <span className="sr-only">{stage.direction} </span> {stage.delta}%
                </div>
              )}
            </div>

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
  );
}

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
 * @param {{key, stage, count, share?, hint?, tone, icon, direction?, delta?}[]} stages
 *        in funnel order; `share` is the stage as a percentage of the cohort
 * @param {string} shareOf names that cohort, since it is not always leads —
 *        the landing-page funnel's stages are shares of landing views
 */
export function FunnelStepper({ stages, shareOf = "leads" }) {
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
              {/* The hint is the stage's own caveat — what an "ad click" is
                  counted from, why an embedded form's starts are a floor. It
                  belongs on the label rather than in the card, where four of
                  them would bury the figures they annotate. */}
              <div className="text-[12px] text-pd-faint" title={stage.hint || undefined}>
                {stage.stage}
              </div>
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
              {stage.share && (
                // The point of the card: what fraction of the cohort reached
                // this stage. On Closes this is the close rate.
                <div className="mt-[2px] text-[12px] text-pd-faint">
                  {stage.share} of {shareOf}
                </div>
              )}
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

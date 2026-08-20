import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Birdy's own voice on the page.
 *
 * The style guide allows exactly one saturated purple surface per screen and
 * reserves it for this card — everything else is white on the canvas. That is
 * what marks the difference between a figure the screen is reporting and a
 * reading Birdy is offering, so this component should not be reused for
 * ordinary content.
 *
 * `segments` is pre-split rather than a string because the figures and client
 * names inside the sentence are emphasised, and building that from markup in
 * the generator would mean the copy carried its own styling.
 *
 * @param {{text: string, strong?: boolean}[]} segments
 * @param {() => void} [onAsk] opens the assistant seeded with this period
 */
export function InsightCard({ segments, onAsk, className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#5A3FD6] bg-[linear-gradient(135deg,#6B4EE6,#8B6BF0)] px-[18px] py-4",
        "shadow-[0_10px_26px_-12px_rgba(107,78,230,.6)]",
        className
      )}
    >
      <div className="mb-[9px] flex items-center gap-2">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
          <Sparkles className="size-[14px]" aria-hidden="true" />
        </span>
        <span className="font-pd-display text-[13.5px] font-semibold text-white">
          Birdy Insights
        </span>
        <span className="ml-auto rounded-[5px] bg-white/[.22] px-2 py-0.5 text-[10.5px] font-bold text-white">
          AI
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-white/[.88] text-pretty">
        {segments.map((segment, i) =>
          segment.strong ? (
            <strong key={i} className="font-semibold text-white">
              {segment.text}
            </strong>
          ) : (
            <span key={i}>{segment.text}</span>
          )
        )}
      </p>

      {onAsk && (
        <button
          type="button"
          onClick={onAsk}
          className="mt-[11px] flex items-center gap-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Ask Birdy about this
          <ChevronRight className="size-[13px]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

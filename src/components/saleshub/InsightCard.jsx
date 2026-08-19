"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { askBirdy } from "@/lib/ask-birdy";

// ─── Birdy Insights ─────────────────────────────────────────────────────────
// The one saturated surface on the screen. The style guide is firm about that:
// "max one saturated purple surface per screen — reserved for the Birdy AI
// card. Everything else is white on #F7F7FB." It marks Birdy's own voice, and
// it stops being a signal the moment a second gradient appears beside it.
//
// The copy is generated per period (see lib/saleshub-insight.js), not written
// here — this component only knows how to draw it.

/**
 * @param {{text: string, strong: boolean}[]} parts the generated copy
 * @param {string} [prompt] seeds the assistant when the footer link is used
 */
export function InsightCard({ parts, prompt, className }) {
  return (
    <section
      className={cn(
        "rounded-[16px] border border-[#5A3FD6] bg-gradient-to-br from-pd-primary to-[#8B6BF0] px-[18px] py-4 shadow-[0_10px_26px_-12px_rgba(107,78,230,.6)]",
        className
      )}
    >
      <div className="mb-[9px] flex items-center gap-2">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
          <Sparkles className="size-[14px]" aria-hidden="true" />
        </span>
        <h2 className="font-pd-display text-[13.5px] font-semibold text-white">Birdy Insights</h2>
        <span className="ml-auto rounded-[5px] bg-white/[.22] px-2 py-0.5 text-[10.5px] font-bold text-white">
          AI
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-white/[.88] text-pretty">
        {parts.map((part, i) =>
          part.strong ? (
            <strong key={i} className="font-semibold text-white">
              {part.text}
            </strong>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </p>

      {prompt && (
        <button
          type="button"
          onClick={() => askBirdy(prompt)}
          className="mt-[11px] flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Ask Birdy about this
          <ChevronRight className="size-[13px]" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

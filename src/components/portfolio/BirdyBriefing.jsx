"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pop } from "@/components/motion";
import BirdyAvatar from "@/components/birdy/BirdyAvatar";
import { askBirdy } from "@/lib/ask-birdy";

// ─── Birdy's read ───────────────────────────────────────────────────────────
// Birdy's own voice on a hub, beside the chart. A white card like every other
// section; what marks it as Birdy speaking rather than the screen reporting is
// the framed mascot and the first person. The violet surface this replaced did
// the same job by shouting, and competed with the buttons.
//
// Copy arrives pre-split into parts (the figures and names inside the sentence
// are emphasised) and findings arrive as a list, each with a tone — so the
// insight generators under lib/ decide what is said and this decides only how
// it is drawn.

const FINDING_DOT = {
  warning: "bg-pd-amber",
  danger: "bg-pd-danger",
  success: "bg-pd-success",
  info: "bg-pd-info",
  neutral: "bg-pd-primary",
};

function Parts({ parts }) {
  return parts.map((part, i) =>
    part.strong ? (
      <strong key={i} className="font-semibold text-pd-ink">
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

/**
 * @param {{text: string, strong?: boolean}[]} parts the headline sentence
 * @param {{tone?: string, parts: {text, strong?}[]}[]} [findings] up to three
 *   bullets beneath it; omit or pass an empty list for the sentence alone
 * @param {string} [prompt] seeds the assistant from the footer link; omit to
 *   render no link
 * @param {string} [title] defaults to "Birdy's read"
 */
export function BirdyBriefing({ parts, findings = [], prompt, title = "Birdy's read", className }) {
  return (
    <Pop
      as="section"
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-pd-border bg-pd-surface px-[18px] py-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-[10px]">
        <BirdyAvatar size={36} />
        <h2 className="font-pd-display text-[14.5px] font-bold tracking-[-0.01em] text-pd-ink">
          {title}
        </h2>
        <span className="ml-auto rounded-full bg-pd-primary-tint px-2 py-0.5 text-[10.5px] font-bold text-pd-primary">
          AI
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.55] text-pd-body text-pretty">
        <Parts parts={parts} />
      </p>

      {findings.length > 0 && (
        <ul className="flex flex-col gap-[7px]">
          {findings.slice(0, 3).map((finding, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] leading-[1.45] text-pd-body text-pretty"
            >
              <span
                className={cn(
                  "mt-[6px] size-[6px] shrink-0 rounded-full",
                  FINDING_DOT[finding.tone] ?? FINDING_DOT.neutral
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <Parts parts={finding.parts} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {prompt && (
        <button
          type="button"
          onClick={() => askBirdy(prompt)}
          className="mt-auto flex w-fit cursor-pointer items-center gap-1 pt-1 text-[12.5px] font-semibold text-pd-primary transition-colors hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
        >
          Ask Birdy about this
          <ChevronRight className="size-[14px]" aria-hidden="true" />
        </button>
      )}
    </Pop>
  );
}

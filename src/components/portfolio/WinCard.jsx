"use client";

import { Check, TrendingUp } from "lucide-react";

/**
 * A client win: something that went right, which the user marks off once
 * they've told the client about it.
 *
 * @param {{id, client, title, why}} win
 */
export function WinCard({ win, onComplete }) {
  return (
    <article className="mb-2 rounded-[10px] border border-pd-border px-3 py-[11px]">
      <div className="flex items-center gap-[7px]">
        <TrendingUp className="size-3 shrink-0 text-pd-success" aria-hidden="true" />
        <span className="shrink-0 text-[10.5px] font-bold text-pd-success">WIN</span>
        <span className="truncate text-[11px] text-pd-faint">{win.client}</span>
      </div>

      <h3 className="mt-[5px] font-pd-display text-[13px] font-semibold leading-[1.3] text-pd-ink">
        {win.title}
      </h3>

      <div className="mt-[5px] flex items-end gap-2.5">
        <p className="min-w-0 flex-1 text-[11.5px] leading-[1.4] text-pd-muted">{win.why}</p>
        <button
          type="button"
          title="Mark done"
          aria-label={`Mark done: ${win.title} for ${win.client}`}
          onClick={() => onComplete(win)}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-pd-healthy-border bg-pd-success-bg text-pd-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
        >
          <Check className="size-[13px]" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

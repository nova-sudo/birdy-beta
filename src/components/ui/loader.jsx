import React from "react";

import { Progress } from "@/components/ui/progress"; // Adjust import based on your project structure
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page loading state. A skeleton in the shape of the page that is about
 * to arrive — a title row and a card of rows — with the real progress bar
 * underneath, so the wait reads as the page filling in rather than a spinner
 * holding it back. The title is kept for assistive tech.
 *
 * @param {{ progress: number, title?: string }} props
 */
export function Loading({ progress, title = "Loading your contacts" }) {
  const pct = Math.round(progress);

  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-pd-canvas">
      <div
        className="flex flex-col gap-6 w-full max-w-md px-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{title} — {pct}% complete</span>

        {/* Title row: avatar, heading, subheading */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-1/3 rounded-full" />
          </div>
        </div>

        {/* A card of rows, shaped like the table that is on its way */}
        <div className="rounded-2xl border border-pd-border bg-pd-surface p-4" aria-hidden="true">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-3 shrink-0 rounded-full" />
                <Skeleton className={`h-3.5 rounded-full ${i % 2 === 0 ? "w-2/5" : "w-1/3"}`} />
                <Skeleton className="ml-auto h-3.5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar container */}
        <div className="w-full flex flex-col gap-2">
          <Progress value={progress} className="w-full h-2" showLabel={false} />
          <p className="text-xs text-pd-subtle text-center font-medium">
            {pct}% complete
          </p>
          <p className="text-xs text-pd-faint text-center">
            Preparing your data. This should only take a moment.
          </p>
        </div>
      </div>
    </div>
  );
}

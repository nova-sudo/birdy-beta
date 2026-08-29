"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { PdCard } from "./PdCard";

/**
 * Shown when the client-groups fetch failed.
 *
 * Without it these screens rendered the failure as data: `loading` goes false,
 * `clientGroups` stays empty, and every KPI tile sums an empty list to a
 * confident 0 while the chart says "no calls logged in this window yet". A
 * reader has no way to tell that apart from a genuinely quiet week. Say the
 * numbers are missing, and offer the retry.
 *
 * @param {string} error message from useClientGroups
 * @param {() => void} [onRetry] the hook's `refresh`
 */
export function LoadError({ error, onRetry, className }) {
  return (
    <PdCard className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-pd-danger-bg text-pd-danger">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-pd-ink">
            Couldn&rsquo;t load your client data
          </p>
          <p className="mt-0.5 text-[12.5px] text-pd-subtle">
            {/* The figures below are missing, not zero. */}
            {error || "The request failed."}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-[9px] border border-pd-border px-3 py-2 text-[13px] font-semibold text-pd-body hover:bg-pd-divider"
          >
            <RefreshCw className="size-[14px]" />
            Try again
          </button>
        )}
      </div>
    </PdCard>
  );
}

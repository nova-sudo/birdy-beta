"use client";

import { cn } from "@/lib/utils";
import { deltaTone } from "@/lib/portfolio-metrics";

/**
 * A ranked list of anything: rank badge, name and supporting meta, a bar
 * showing its share of the leader, the value, and an optional delta.
 *
 * Ranks are rendered from list position rather than stored on the row, so a
 * re-rank can't leave one numbered wrong.
 *
 * @param {{id?, name, meta?, bar, value, direction?, delta?}[]} rows already ordered
 * @param {string} emptyMessage shown when there is nothing to rank
 */
export function Leaderboard({ rows, emptyMessage = "Nothing to rank yet" }) {
  if (!rows?.length) {
    return <p className="py-8 text-center text-[12px] text-pd-faint">{emptyMessage}</p>;
  }

  return (
    <ol>
      {rows.map((row, i) => {
        const tone = row.direction ? deltaTone(row.direction) : null;

        return (
          <li key={row.id ?? row.name} className="mb-[14px] flex items-center gap-3">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-pd-primary-tint text-[11px] font-bold text-pd-primary">
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-pd-ink">{row.name}</div>
              {row.meta && <div className="truncate text-[11.5px] text-pd-faint">{row.meta}</div>}
            </div>

            {/* Restates the value to its right — decorative to a reader. */}
            <div className="shrink-0 basis-[88px]" aria-hidden="true">
              <div className="h-1.5 rounded-[3px] bg-pd-divider">
                <div
                  className="h-full rounded-[3px] bg-pd-primary"
                  style={{ width: `${Math.max(0, Math.min(100, row.bar))}%` }}
                />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="font-pd-display text-[14px] font-bold text-pd-ink">{row.value}</div>
              {tone && (
                <div className={cn("text-[11px]", tone.text)}>
                  <span aria-hidden="true">{row.direction === "up" ? "▲" : "▼"}</span>
                  <span className="sr-only">{row.direction} </span> {row.delta}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

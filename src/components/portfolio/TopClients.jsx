"use client";

import { cn } from "@/lib/utils";
import { deltaTone } from "@/lib/portfolio-metrics";
import { PdMenu } from "./PdMenu";

/**
 * Client leaderboard, rankable by CPL, closes, leads or revenue.
 *
 * Switching the metric re-ranks the list rather than re-sorting one fixed set
 * of rows: "best" means something different per metric, and the supporting meta
 * line changes with it — spend and leads when ranking by CPL, closes and AOV
 * when ranking by revenue.
 */
export function TopClients({ metric, metrics, onMetricChange, clients }) {
  return (
    <section className="min-w-0 flex-[0.85] rounded-[16px] border border-pd-border bg-pd-surface px-[22px] py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-pd-display text-[15px] font-semibold text-pd-ink">
          Top performing clients
        </h2>
        <PdMenu
          size="sm"
          label="Rank clients by"
          value={metric}
          options={metrics}
          onChange={onMetricChange}
        />
      </div>

      <ol>
        {clients.map((client, i) => {
          const tone = deltaTone(client.direction);

          return (
            <li key={client.name} className="mb-[14px] flex items-center gap-3">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-pd-primary-tint text-[11px] font-bold text-pd-primary">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-pd-ink">
                  {client.name}
                </div>
                <div className="text-[11.5px] text-pd-faint">{client.meta}</div>
              </div>

              {/* Restates the value to its right — decorative to a reader. */}
              <div className="shrink-0 basis-[88px]" aria-hidden="true">
                <div className="h-1.5 rounded-[3px] bg-pd-divider">
                  <div
                    className="h-full rounded-[3px] bg-pd-primary"
                    style={{ width: `${client.bar}%` }}
                  />
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-pd-display text-[14px] font-bold text-pd-ink">
                  {client.value}
                </div>
                <div className={cn("text-[11px]", tone.text)}>
                  <span aria-hidden="true">{client.direction === "up" ? "▲" : "▼"}</span>
                  <span className="sr-only">{client.direction} </span> {client.delta}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { Calendar, Clock } from "lucide-react";
import { PdMenu } from "./PdMenu";

// The design's header bar, minus the avatar — UserMenu already sits in the
// global header from src/app/layout.jsx, so a second one here would be a
// duplicate control rather than a missing one.
//
// The two controls do different jobs, which the handoff blurred: the date
// range picks *which window* every figure covers, and is the app's own preset
// list because that is what the API speaks; the granularity picks how finely
// the chart buckets that window.
export function PortfolioHeader({
  clientCount,
  granularity,
  granularities,
  onGranularityChange,
  preset,
  presets,
  onPresetChange,
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-pd-border bg-pd-surface px-[26px]">
      <div>
        <h1 className="font-pd-display text-[19px] font-bold tracking-[-0.02em] text-pd-ink">
          Portfolio Dashboard
        </h1>
        <p className="mt-px text-[12px] text-pd-faint">
          {clientCount
            ? `${clientCount.toLocaleString()} ${clientCount === 1 ? "client" : "clients"} · portfolio-level performance`
            : "Portfolio-level performance"}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-[10px]">
        <PdMenu
          label="Chart granularity"
          value={granularity}
          options={granularities}
          onChange={onGranularityChange}
          icon={<Clock className="size-[14px] shrink-0 text-pd-primary" aria-hidden="true" />}
        />

        <PdMenu
          label="Date range"
          value={preset}
          options={presets}
          onChange={onPresetChange}
          className="[&_[role=listbox]]:w-[180px]"
          icon={<Calendar className="size-[14px] shrink-0" aria-hidden="true" />}
        />
      </div>
    </header>
  );
}

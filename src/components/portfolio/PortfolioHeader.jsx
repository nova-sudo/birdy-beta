"use client";

import { Calendar, ChevronDown, Clock } from "lucide-react";
import { PdMenu } from "./PdMenu";

export const TIMEFRAMES = ["Daily", "Weekly", "Monthly"];

// The design's header bar, minus the avatar — UserMenu already sits in the
// global header from src/app/layout.jsx, so a second one here would be a
// duplicate control rather than a missing one.
//
// The date range is display-only in the handoff, so it stays a static chip;
// wiring it to a real range picker is out of scope for this screen.
export function PortfolioHeader({ clientCount, timeframe, onTimeframeChange, dateRange }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-pd-border bg-pd-surface px-[26px]">
      <div>
        <h1 className="font-pd-display text-[19px] font-bold tracking-[-0.02em] text-pd-ink">
          Portfolio Dashboard
        </h1>
        <p className="mt-px text-[12px] text-pd-faint">
          {clientCount == null ? "Portfolio-level performance" : `${clientCount} clients · portfolio-level performance`}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-[10px]">
        <PdMenu
          label="Timeframe"
          value={timeframe}
          options={TIMEFRAMES}
          onChange={onTimeframeChange}
          icon={<Clock className="size-[14px] shrink-0 text-pd-primary" aria-hidden="true" />}
        />

        <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body">
          <Calendar className="size-[14px] shrink-0" aria-hidden="true" />
          {dateRange}
          <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}

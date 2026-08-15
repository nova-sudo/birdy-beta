"use client";

import { useMemo, useState } from "react";
import { KpiStrip } from "@/components/portfolio/KpiStrip";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { TopClients } from "@/components/portfolio/TopClients";
import { TrendChart } from "@/components/portfolio/TrendChart";
import {
  CHART_METRICS,
  TOP_CLIENTS,
  TOP_CLIENT_METRICS,
  chartForMetric,
  kpisForTimeframe,
} from "./fixtures";
import { portfolioFontClass } from "./fonts";

// Tab order is deliberate: Leads · Ad spend · Calls · Closes.
const CHART_TABS = Object.entries(CHART_METRICS).map(([key, metric]) => ({ key, tab: metric.tab }));

// ─── Portfolio Dashboard ────────────────────────────────────────────────────
// Agency-level view: across all clients, what is happening and where is the
// problem? Built from the "variant 3e" handoff.
//
// The handoff draws a full 1600×1040 app frame — a 68px icon rail and a 64px
// header with an avatar. Birdy already renders both globally from
// src/app/layout.jsx (AppSidebar + the search header + UserMenu), so the rail
// and the avatar are dropped here rather than duplicated, and the design's
// title block and timeframe controls become a page-level header. What is kept
// is the frame itself: canvas background, 1px border, 16px radius, with the
// content column and right rail scrolling independently inside it.

export default function PortfolioDashboardPage() {
  // Timeframe drives the KPI strip and the trend chart together, so it lives
  // at the page level rather than inside either.
  const [timeframe, setTimeframe] = useState("Monthly");
  const [chartMetric, setChartMetric] = useState("leads");
  const [topMetric, setTopMetric] = useState("Avg CPL");

  const kpis = useMemo(() => kpisForTimeframe(timeframe), [timeframe]);
  const chart = useMemo(() => chartForMetric(chartMetric, timeframe), [chartMetric, timeframe]);

  return (
    <div
      className={`${portfolioFontClass} flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-pd-border-strong bg-pd-canvas`}
    >
      <PortfolioHeader
        clientCount={55}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        dateRange="1 – 31 Jul 2026"
      />

      <div className="flex min-h-0 flex-1">
        {/* Content column */}
        <div className="pd-scrolly min-w-0 flex-1 px-6 py-[22px]">
          <KpiStrip kpis={kpis} />

          <TrendChart
            chart={chart}
            metrics={CHART_TABS}
            activeMetric={chartMetric}
            onMetricChange={setChartMetric}
            redrawKey={`${chartMetric}-${timeframe}`}
          />

          <div className="mb-[18px] flex gap-[18px]">
            <TopClients
              metric={topMetric}
              metrics={TOP_CLIENT_METRICS}
              onMetricChange={setTopMetric}
              clients={TOP_CLIENTS[topMetric]}
            />

            {/* Performance funnel — PR-07 */}
            <div className="h-[280px] min-w-0 flex-[1.45] rounded-[16px] border border-pd-border bg-pd-surface" />
          </div>

          {/* Call insights — PR-08 */}
          <div className="h-[150px] rounded-[16px] border border-pd-border bg-pd-surface" />
        </div>

        {/* Right rail — PR-09 */}
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-pd-border bg-pd-surface" />
      </div>
    </div>
  );
}

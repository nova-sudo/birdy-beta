"use client";

import { useMemo, useState } from "react";
import { CallInsights } from "@/components/portfolio/CallInsights";
import { KpiStrip } from "@/components/portfolio/KpiStrip";
import { PerformanceFunnel } from "@/components/portfolio/PerformanceFunnel";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { RightRail } from "@/components/portfolio/RightRail";
import { TopClients } from "@/components/portfolio/TopClients";
import { TrendChart } from "@/components/portfolio/TrendChart";
import { Skeleton } from "@/components/ui/skeleton";
import { chartForMetric, chartTabs, kpisForTimeframe } from "@/lib/portfolio-view";
import { portfolioFontClass } from "./fonts";
import { usePortfolioData } from "./usePortfolioData";

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

function LoadingColumn() {
  return (
    <div className="min-w-0 flex-1 px-6 py-[22px]">
      <Skeleton className="mb-[18px] h-[74px] rounded-[14px]" />
      <Skeleton className="mb-[18px] h-[340px] rounded-[16px]" />
      <div className="mb-[18px] flex gap-[18px]">
        <Skeleton className="h-[280px] flex-[0.85] rounded-[16px]" />
        <Skeleton className="h-[280px] flex-[1.45] rounded-[16px]" />
      </div>
      <Skeleton className="h-[150px] rounded-[16px]" />
    </div>
  );
}

export default function PortfolioDashboardPage() {
  // Timeframe drives the KPI strip and the trend chart together, so it lives at
  // the page level rather than inside either. The summary carries every
  // timeframe, so switching is a redraw rather than a fetch.
  const [timeframe, setTimeframe] = useState("Monthly");
  const [chartMetric, setChartMetric] = useState("leads");
  const [topMetric, setTopMetric] = useState(null);
  const [panel, setPanel] = useState("suggestions");

  const {
    clientCount,
    dateRange,
    kpis,
    chartMetrics,
    chartAxis,
    topClients,
    topClientMetrics,
    funnel,
    callInsights,
    suggestions,
    activity,
    activityCount,
    loading,
    unavailable,
    usingFixtures,
    applySuggestion,
    dismissSuggestion,
  } = usePortfolioData();

  const kpiRows = useMemo(() => kpisForTimeframe(kpis, timeframe), [kpis, timeframe]);
  const tabs = useMemo(() => chartTabs(chartMetrics), [chartMetrics]);
  const chart = useMemo(
    () => chartForMetric(chartMetrics, chartAxis, chartMetric, timeframe),
    [chartMetrics, chartAxis, chartMetric, timeframe]
  );

  // The leaderboard defaults to whichever metric the payload lists first, so a
  // backend that drops or renames one doesn't leave the card blank.
  const metrics = topClientMetrics?.length ? topClientMetrics : Object.keys(topClients ?? {});
  const activeTopMetric = topMetric && metrics.includes(topMetric) ? topMetric : metrics[0];

  return (
    <div
      className={`${portfolioFontClass} flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-pd-border-strong bg-pd-canvas`}
    >
      <PortfolioHeader
        clientCount={clientCount}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        dateRange={dateRange}
      />

      {usingFixtures && (
        <p className="shrink-0 border-b border-pd-warning-bg bg-pd-warning-bg px-[26px] py-2 text-[12px] font-semibold text-pd-amber">
          Design reference data — the portfolio API isn&apos;t connected. Development only.
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {loading ? (
          <LoadingColumn />
        ) : unavailable ? (
          <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-[22px]">
            <div className="max-w-sm text-center">
              <p className="font-pd-display text-[15px] font-semibold text-pd-ink">
                Portfolio data isn&apos;t available
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.45] text-pd-body">
                We couldn&apos;t reach the portfolio summary. Nothing here is out of date — there
                is simply nothing to show yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="pd-scrolly min-w-0 flex-1 px-6 py-[22px]">
            <KpiStrip kpis={kpiRows} />

            {chart && (
              <TrendChart
                chart={chart}
                metrics={tabs}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                redrawKey={`${chartMetric}-${timeframe}`}
              />
            )}

            <div className="mb-[18px] flex gap-[18px]">
              <TopClients
                metric={activeTopMetric}
                metrics={metrics}
                onMetricChange={setTopMetric}
                clients={topClients?.[activeTopMetric] ?? []}
              />

              <PerformanceFunnel stages={funnel} />
            </div>

            <CallInsights insights={callInsights} />
          </div>
        )}

        <RightRail
          panel={panel}
          onPanelChange={setPanel}
          suggestions={suggestions}
          activity={activity}
          activityCount={activityCount}
          onApply={applySuggestion}
          onDismiss={dismissSuggestion}
        />
      </div>
    </div>
  );
}

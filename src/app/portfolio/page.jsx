"use client";

import { useMemo, useState } from "react";
import { KpiStrip } from "@/components/portfolio/KpiStrip";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { CallInsights } from "@/components/portfolio/CallInsights";
import { PerformanceFunnel } from "@/components/portfolio/PerformanceFunnel";
import { RightRail } from "@/components/portfolio/RightRail";
import { TopClients } from "@/components/portfolio/TopClients";
import { TrendChart } from "@/components/portfolio/TrendChart";
import {
  ACTIVITY,
  ACTIVITY_TOTAL,
  CALL_INSIGHTS,
  CHART_METRICS,
  FUNNEL_STAGES,
  SUGGESTIONS,
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
  const [panel, setPanel] = useState("suggestions");
  const [suggestions, setSuggestions] = useState(SUGGESTIONS);
  const [activity, setActivity] = useState(ACTIVITY);
  const [activityTotal, setActivityTotal] = useState(ACTIVITY_TOTAL);

  const kpis = useMemo(() => kpisForTimeframe(timeframe), [timeframe]);
  const chart = useMemo(() => chartForMetric(chartMetric, timeframe), [chartMetric, timeframe]);

  // Acting on a suggestion takes it off the list and writes what happened into
  // the feed, which is where the record of Birdy's changes lives. PR-10 puts
  // the API call behind these; the optimistic move is the same either way.
  const handleApply = (suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    setActivity((prev) => [
      {
        id: `applied-${suggestion.id}`,
        action: suggestion.title,
        client: suggestion.client,
        mode: "Approved",
        time: "just now",
      },
      ...prev,
    ]);
    setActivityTotal((n) => n + 1);
  };

  // Dismissing is not an action on the ad platform — nothing joins the feed.
  const handleDismiss = (suggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

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

            <PerformanceFunnel stages={FUNNEL_STAGES} />
          </div>

          <CallInsights insights={CALL_INSIGHTS} />
        </div>

        <RightRail
          panel={panel}
          onPanelChange={setPanel}
          suggestions={suggestions}
          activity={activity}
          activityCount={activityTotal}
          onApply={handleApply}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}

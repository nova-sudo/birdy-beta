"use client";

import { useMemo, useState } from "react";
import {
  ActivityRow,
  DiagnosticBanner,
  FunnelStepper,
  Leaderboard,
  PdCard,
  PdMenu,
  PortfolioHeader,
  SidePanel,
  StatStrip,
  SuggestionCard,
  TrendChart,
} from "@/components/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import { chartForMetric, chartTabs, kpisForTimeframe } from "@/lib/portfolio-view";
import {
  CALL_PRESENTATION,
  FUNNEL_PRESENTATION,
  KPI_PRESENTATION,
  withPresentation,
} from "./presentation";
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
//
// This file is only composition and wiring. Everything it renders comes from
// @/components/portfolio, which knows nothing about where the figures came
// from, and the shaping lives in @/lib/portfolio-*.

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
  // the page level rather than inside either.
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

  const kpiStats = useMemo(
    () => withPresentation(kpisForTimeframe(kpis, timeframe), KPI_PRESENTATION),
    [kpis, timeframe]
  );
  const callStats = useMemo(
    () => withPresentation(callInsights, CALL_PRESENTATION),
    [callInsights]
  );
  const funnelStages = useMemo(
    () => withPresentation(funnel, FUNNEL_PRESENTATION),
    [funnel]
  );
  const diagnosis = useMemo(() => diagnoseFunnel(funnel), [funnel]);

  const tabs = useMemo(() => chartTabs(chartMetrics), [chartMetrics]);
  const chart = useMemo(
    () => chartForMetric(chartMetrics, chartAxis, chartMetric, timeframe),
    [chartMetrics, chartAxis, chartMetric, timeframe]
  );

  // The leaderboard defaults to whichever metric the payload lists first, so a
  // backend that drops or renames one doesn't leave the card blank.
  const metrics = topClientMetrics?.length ? topClientMetrics : Object.keys(topClients ?? {});
  const activeTopMetric = topMetric && metrics.includes(topMetric) ? topMetric : metrics[0];

  const panels = [
    {
      key: "suggestions",
      label: "Suggestions",
      badge: suggestions.length,
      badgeClassName: "bg-pd-primary-tint text-pd-primary",
      isEmpty: suggestions.length === 0,
      status: `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} outstanding`,
      render: () =>
        suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApply={applySuggestion}
            onDismiss={dismissSuggestion}
          />
        )),
    },
    {
      key: "activity",
      label: "Activity",
      badge: activityCount ?? activity.length,
      badgeClassName: "bg-pd-neutral-badge text-pd-subtle",
      isEmpty: activity.length === 0,
      render: () => (
        <ul>
          {activity.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </ul>
      ),
    },
  ];

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
            <StatStrip stats={kpiStats} label="Portfolio KPIs" className="mb-[18px]" />

            {chart && (
              <TrendChart
                className="mb-[18px]"
                chart={chart}
                metrics={tabs}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                redrawKey={`${chartMetric}-${timeframe}`}
              />
            )}

            <div className="mb-[18px] flex gap-[18px]">
              <PdCard
                className="min-w-0 flex-[0.85]"
                title="Top performing clients"
                action={
                  metrics.length > 0 && (
                    <PdMenu
                      size="sm"
                      label="Rank clients by"
                      value={activeTopMetric}
                      options={metrics}
                      onChange={setTopMetric}
                    />
                  )
                }
              >
                <Leaderboard rows={topClients?.[activeTopMetric] ?? []} />
              </PdCard>

              <PdCard
                className="min-w-0 flex-[1.45]"
                title="Performance funnel"
                headerClassName="mb-[18px]"
              >
                <FunnelStepper stages={funnelStages} />
                <DiagnosticBanner
                  className="mt-5"
                  state={diagnosis.state}
                  title={diagnosis.title}
                  body={diagnosis.body}
                />
              </PdCard>
            </div>

            <PdCard
              title="Call insights"
              action={<span className="text-[12px] text-pd-faint">Across all client call centres</span>}
            >
              <StatStrip stats={callStats} variant="separate" label="Call insights" />
            </PdCard>
          </div>
        )}

        <SidePanel panels={panels} active={panel} onChange={setPanel} label="Rail panel" />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
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
  WinCard,
} from "@/components/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import { GRANULARITIES } from "@/lib/portfolio-series";
import {
  CALL_PRESENTATION,
  FUNNEL_PRESENTATION,
  KPI_PRESENTATION,
  withPresentation,
} from "./presentation";
import { portfolioFontClass } from "./fonts";
import {
  applySuggestionRequest,
  completeWinRequest,
  dismissSuggestionRequest,
  usePortfolioData,
} from "./usePortfolioData";

// ─── Portfolio Dashboard ────────────────────────────────────────────────────
// Agency-level view: across all clients, what is happening and where is the
// problem? Built from the "variant 3e" handoff, on Birdy's own data.
//
// The handoff draws a full 1600×1040 app frame — a 68px icon rail and a 64px
// header with an avatar. Birdy already renders both globally from
// src/app/layout.jsx (AppSidebar + the search header + UserMenu), so the rail
// and the avatar are dropped here rather than duplicated, and the design's
// title block and controls become a page-level header. What is kept is the
// frame itself: canvas background, 1px border, 16px radius, with the content
// column and right rail scrolling independently inside it.
//
// This file is only composition and wiring. What it renders comes from
// @/components/portfolio, which knows nothing about where figures came from;
// the fetching is in usePortfolioData and the arithmetic in @/lib/portfolio-*.

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

function EmptyState({ title, body }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center px-6 py-[22px]">
      <div className="max-w-sm text-center">
        <p className="font-pd-display text-[15px] font-semibold text-pd-ink">{title}</p>
        <p className="mt-1.5 text-[12px] leading-[1.45] text-pd-body">{body}</p>
      </div>
    </div>
  );
}

export default function PortfolioDashboardPage() {
  // The date preset picks the window every figure covers; granularity only
  // changes how finely the chart buckets that same window.
  const [preset, setPreset] = useState(DEFAULT_DATE_PRESET);
  const [granularity, setGranularity] = useState("Daily");
  const [chartMetric, setChartMetric] = useState("leads");
  const [topMetric, setTopMetric] = useState(null);
  const [panel, setPanel] = useState("suggestions");

  const {
    clientCount,
    kpis,
    callInsights,
    funnel,
    leaderboards,
    chartMetrics,
    suggestions,
    activity,
    activityCount,
    wins,
    loading,
    seriesLoading,
    error,
    hasClients,
    hasComparison,
  } = usePortfolioData({ preset, granularity });

  // Optimistic rail state layered over what the hook fetched, so acting on a
  // card is immediate and a failed request puts it back.
  const [removed, setRemoved] = useState({});
  const [applied, setApplied] = useState([]);

  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !removed[s.id]),
    [suggestions, removed]
  );
  const visibleActivity = useMemo(() => [...applied, ...activity], [applied, activity]);
  const visibleWins = useMemo(() => wins.filter((w) => !removed[w.id]), [wins, removed]);

  const handleCompleteWin = useCallback(async (win) => {
    setRemoved((prev) => ({ ...prev, [win.id]: true }));
    const ok = await completeWinRequest(win.id);
    if (!ok) {
      setRemoved((prev) => ({ ...prev, [win.id]: false }));
      toast.error("Couldn't mark that done", { description: win.title });
      return;
    }
    toast.success("Marked as done", { description: win.title });
  }, []);

  const handleApply = useCallback(async (suggestion) => {
    setRemoved((prev) => ({ ...prev, [suggestion.id]: true }));
    const entry = {
      id: `applied-${suggestion.id}`,
      action: suggestion.title,
      client: suggestion.client,
      mode: "Approved",
      time: "just now",
    };
    setApplied((prev) => [entry, ...prev]);

    const result = await applySuggestionRequest(suggestion.id);
    if (!result) {
      setRemoved((prev) => ({ ...prev, [suggestion.id]: false }));
      setApplied((prev) => prev.filter((a) => a.id !== entry.id));
      toast.error("Couldn't apply that", { description: suggestion.title });
      return;
    }

    const count = (result.succeeded ?? []).length;
    toast.success(count ? `Applied to ${count} ad${count === 1 ? "" : "s"}` : "Applied", {
      description: suggestion.title,
    });
  }, []);

  const handleDismiss = useCallback(async (suggestion) => {
    setRemoved((prev) => ({ ...prev, [suggestion.id]: true }));
    const ok = await dismissSuggestionRequest(suggestion.id);
    if (!ok) {
      setRemoved((prev) => ({ ...prev, [suggestion.id]: false }));
      toast.error("Couldn't dismiss that", { description: suggestion.title });
      return;
    }
    toast("Suggestion dismissed", { description: suggestion.title });
  }, []);

  const kpiStats = useMemo(() => withPresentation(kpis, KPI_PRESENTATION), [kpis]);
  const callStats = useMemo(
    () => withPresentation(callInsights, CALL_PRESENTATION),
    [callInsights]
  );
  const funnelStages = useMemo(() => withPresentation(funnel, FUNNEL_PRESENTATION), [funnel]);
  const diagnosis = useMemo(() => diagnoseFunnel(funnel), [funnel]);

  const chartTabs = useMemo(
    () => Object.entries(chartMetrics).map(([key, m]) => ({ key, tab: m.tab })),
    [chartMetrics]
  );

  const chart = useMemo(() => {
    const metric = chartMetrics[chartMetric] ?? chartMetrics.leads;
    if (!metric?.values?.length) return null;

    // The chart's headline delta is the same period-over-period figure the KPI
    // strip shows for that metric — one number, computed once.
    const kpi = kpis.find((k) => k.key === chartMetric);

    return {
      ...metric,
      subtitle: `${granularity} · ${metric.subtitle}`,
      pointValues: metric.values.map((v) => Math.round(v).toLocaleString()),
      direction: kpi?.direction,
      delta: kpi?.delta,
    };
  }, [chartMetrics, chartMetric, granularity, kpis]);

  const leaderboardMetrics = Object.keys(leaderboards);
  const activeTopMetric =
    topMetric && leaderboardMetrics.includes(topMetric) ? topMetric : leaderboardMetrics[0];

  const panels = [
    {
      key: "suggestions",
      label: "Suggestions",
      badge: visibleSuggestions.length,
      badgeClassName: "bg-pd-primary-tint text-pd-primary",
      isEmpty: visibleSuggestions.length === 0,
      emptyMessage: "No suggestions right now",
      status: `${visibleSuggestions.length} suggestion${
        visibleSuggestions.length === 1 ? "" : "s"
      } outstanding`,
      render: () =>
        visibleSuggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApply={handleApply}
            onDismiss={handleDismiss}
          />
        )),
    },
    {
      key: "wins",
      label: "Wins",
      badge: visibleWins.length,
      badgeClassName: "bg-pd-success-bg text-pd-success",
      isEmpty: visibleWins.length === 0,
      emptyMessage: "No wins to report yet",
      render: () =>
        visibleWins.map((win) => <WinCard key={win.id} win={win} onComplete={handleCompleteWin} />),
    },
    {
      key: "activity",
      label: "Activity",
      badge: activityCount + applied.length,
      badgeClassName: "bg-pd-neutral-badge text-pd-subtle",
      isEmpty: visibleActivity.length === 0,
      emptyMessage: "Nothing has happened yet",
      render: () => (
        <ul>
          {visibleActivity.map((entry) => (
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
        granularity={granularity}
        granularities={GRANULARITIES}
        onGranularityChange={setGranularity}
        preset={preset}
        presets={DATE_PRESETS}
        onPresetChange={setPreset}
      />

      <div className="flex min-h-0 flex-1">
        {loading ? (
          <LoadingColumn />
        ) : error ? (
          <EmptyState
            title="Couldn't load your portfolio"
            body={`${error}. Nothing here is out of date — we just couldn't reach your client data.`}
          />
        ) : !hasClients ? (
          <EmptyState
            title="No active clients yet"
            body="Once a client group is connected and has Meta or GoHighLevel data, its figures roll up here."
          />
        ) : (
          <div className="pd-scrolly min-w-0 flex-1 px-6 py-[22px]">
            <StatStrip stats={kpiStats} label="Portfolio KPIs" className="mb-[18px]" />

            {seriesLoading ? (
              <Skeleton className="mb-[18px] h-[340px] rounded-[16px]" />
            ) : chart ? (
              <TrendChart
                className="mb-[18px]"
                chart={chart}
                metrics={chartTabs}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                redrawKey={`${chartMetric}-${granularity}-${preset}`}
              />
            ) : (
              <PdCard className="mb-[18px]" title="Trend">
                <p className="py-8 text-center text-[12px] text-pd-faint">
                  No dated leads in this window yet.
                </p>
              </PdCard>
            )}

            <div className="mb-[18px] flex gap-[18px]">
              <PdCard
                className="min-w-0 flex-[0.85]"
                title="Top performing clients"
                action={
                  leaderboardMetrics.length > 0 && (
                    <PdMenu
                      size="sm"
                      label="Rank clients by"
                      value={activeTopMetric}
                      options={leaderboardMetrics}
                      onChange={setTopMetric}
                    />
                  )
                }
              >
                <Leaderboard
                  rows={leaderboards[activeTopMetric] ?? []}
                  emptyMessage={`No client has ${activeTopMetric.toLowerCase()} data in this window`}
                />
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
                  body={
                    hasComparison
                      ? diagnosis.body
                      : "Pick Today, Last 7 Days, This Month, This Quarter or This Year to compare against the period before it."
                  }
                />
              </PdCard>
            </div>

            <PdCard
              title="Call insights"
              action={
                <span className="text-[12px] text-pd-faint">Across all client call centres</span>
              }
            >
              <StatStrip stats={callStats} variant="separate" label="Call insights" />
            </PdCard>
          </div>
        )}

        <SidePanel
          panels={panels}
          active={panel}
          onChange={setPanel}
          label="Rail panel"
          itemClassName="flex-1 px-1.5 py-2"
        />
      </div>
    </div>
  );
}

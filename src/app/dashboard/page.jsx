"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BirdyRead,
  Breakdown,
  EmptyState,
  ErrorState,
  MetricTabsChart,
  PageHeader,
  SegmentedTabs,
  Skeleton,
  fromPortfolioTabs,
} from "@/components/ds";
import { useDashboardControls } from "@/components/dashboard-controls";
import { usePageHeader } from "@/components/page-header";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import {
  briefingFromDiagnosis,
  clientBreakdown,
  comparableFunnel,
  costPerLeadSeries,
  greeting,
  portfolioSummary,
  toFindings,
} from "./presentation";
import {
  applySuggestionRequest,
  usePortfolioData,
} from "./usePortfolioData";

// ─── Portfolio Dashboard ────────────────────────────────────────────────────
// Agency-level view: across all clients, what is happening and where is the
// problem? Hub layout, option A: a greeting and the period, four metrics that
// rise into one chart, then "By client" beside Birdy's read.
//
// This file is only composition and wiring. The fetching is in
// usePortfolioData, the arithmetic in @/lib/portfolio-*, and the wording and
// shaping into component props in ./presentation.

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "last_7d", label: "7 days" },
  { value: "last_30d", label: "30 days" },
];

// Booked calls are the won opportunities the CRM reports as closes.
const METRIC_TABS = [
  { key: "leads", label: "Leads", kpi: "leads" },
  { key: "closes", label: "Booked calls", kpi: "closes" },
  { key: "cpl", label: "Cost per lead", kpi: "cpl" },
  { key: "spend", label: "Ad spend", kpi: "spend" },
];

const CLIENT_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];
const OTHER_COLOR = "var(--color-muted-foreground)";

const BIRDY_PROMPT = "What should I focus on across my clients right now?";

const toSeries = (s) =>
  (s?.values ?? []).map((current, i) => ({
    x: s.labels?.[i] ?? "",
    current,
    tooltipLabel: s.tooltipLabels?.[i],
  }));

// The signed-in user's first name, as stored at login; null until known.
function useFirstName() {
  const [name, setName] = useState(null);
  useEffect(() => {
    try {
      const full = JSON.parse(localStorage.getItem("user") || "null")?.name;
      setName(full ? String(full).trim().split(/\s+/)[0] : null);
    } catch {
      setName(null);
    }
  }, []);
  return name;
}

function LoadingBody() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1.35fr_1fr]">
      <Skeleton className="h-64 rounded-surface" />
      <Skeleton className="h-64 rounded-frame" />
    </div>
  );
}

export default function PortfolioDashboardPage() {
  const { preset, setPreset } = useDashboardControls();
  const [chartMetric, setChartMetric] = useState("leads");
  const firstName = useFirstName();

  const {
    clientCount,
    clientRows,
    kpis,
    funnel,
    chartMetrics,
    suggestions,
    loading,
    seriesLoading,
    error,
    hasClients,
    hasComparison,
    hasCallCentre,
  } = usePortfolioData({ preset });

  // The top bar shows the page's name; the greeting below is the page's own.
  const topBar = useMemo(() => ({ title: "Dashboard" }), []);
  usePageHeader(topBar);

  // Optimistic state layered over what the hook fetched, so acting on a
  // finding is immediate and a failed request puts it back.
  const [removed, setRemoved] = useState({});

  const handleApply = useCallback(async (suggestion) => {
    setRemoved((prev) => ({ ...prev, [suggestion.id]: true }));

    const result = await applySuggestionRequest(suggestion.id);
    if (!result) {
      setRemoved((prev) => ({ ...prev, [suggestion.id]: false }));
      toast.error("Couldn't apply that", { description: suggestion.title });
      return;
    }

    const count = (result.succeeded ?? []).length;
    toast.success(count ? `Applied to ${count} ad${count === 1 ? "" : "s"}` : "Applied", {
      description: suggestion.title,
    });
  }, []);

  const metrics = useMemo(() => {
    const symbol = chartMetrics.spend.valuePrefix ?? "£";
    const series = {
      leads: toSeries(chartMetrics.leads),
      closes: toSeries(chartMetrics.closes),
      cpl: costPerLeadSeries(chartMetrics.leads, chartMetrics.spend),
      spend: toSeries(chartMetrics.spend),
    };
    const tabs = METRIC_TABS.map(({ key, label, kpi }) => ({
      ...kpis.find((k) => k.key === kpi),
      key,
      label,
    }));

    return fromPortfolioTabs({ tabs, activeKey: chartMetric, chart: null }).map((m) => ({
      ...m,
      series: series[m.key],
      caption: m.delta !== undefined ? "vs previous period" : undefined,
      symbol,
    }));
  }, [chartMetrics, kpis, chartMetric]);

  const formatValue = useCallback((n, metric) => {
    if (metric?.key === "cpl") return `${metric.symbol}${n.toFixed(2)}`;
    const rounded = Math.round(n).toLocaleString("en-GB");
    return metric?.key === "spend" ? `${metric.symbol}${rounded}` : rounded;
  }, []);

  const breakdown = useMemo(
    () => clientBreakdown(clientRows, { colors: CLIENT_COLORS, otherColor: OTHER_COLOR }),
    [clientRows]
  );

  // Diagnosed from the funnel rows with the call-centre stage blanked where no
  // client dials, so the verdict never names a stage the data cannot see.
  const findings = useMemo(() => {
    const diagnosis = diagnoseFunnel(comparableFunnel(funnel, hasCallCentre));
    return toFindings(
      briefingFromDiagnosis(diagnosis, { hasComparison }),
      suggestions.filter((s) => !removed[s.id]),
      { onApply: handleApply }
    );
  }, [funnel, hasCallCentre, hasComparison, suggestions, removed, handleApply]);

  const showData = !loading && !error && hasClients;
  const summary = showData ? portfolioSummary({ clientCount, kpis }) : null;
  const activeMetric = metrics.find((m) => m.key === chartMetric);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={greeting(new Date().getHours(), firstName)}
        description={summary ?? "Portfolio-level performance"}
        period={
          <SegmentedTabs
            ariaLabel="Period"
            value={preset}
            onValueChange={setPreset}
            items={PERIODS}
          />
        }
      />

      {error ? (
        <ErrorState
          title="Couldn't load your portfolio"
          description={`${error}. Nothing here is out of date — we just couldn't reach your client data.`}
          onRetry={() => window.location.reload()}
        />
      ) : !loading && !hasClients ? (
        <EmptyState
          title="No active clients yet"
          description="Once a client group is connected and has Meta or GoHighLevel data, its figures roll up here."
        />
      ) : (
        <>
          <MetricTabsChart
            metrics={metrics}
            value={chartMetric}
            onValueChange={setChartMetric}
            formatValue={formatValue}
            xLabel={`${activeMetric?.label ?? "Metric"} over the period`}
            loading={loading}
            plotLoading={seriesLoading}
            emptyMessage={
              chartMetric === "spend"
                ? "No daily spend in this window yet."
                : "No dated leads in this window yet."
            }
          />

          {loading ? (
            <LoadingBody />
          ) : (
            <div className="grid items-start gap-10 lg:grid-cols-[1.35fr_1fr]">
              {breakdown.rows.length > 0 ? (
                <Breakdown
                  title="By client"
                  total={`${breakdown.total.toLocaleString()} leads`}
                  rows={breakdown.rows}
                />
              ) : (
                <EmptyState
                  title="No leads in this window"
                  description="Client figures appear here once leads come in."
                />
              )}
              <BirdyRead findings={findings} prompt={BIRDY_PROMPT} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

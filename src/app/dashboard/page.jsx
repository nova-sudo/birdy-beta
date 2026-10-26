"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  BirdyRead,
  Breakdown,
  EmptyState,
  ErrorState,
  FunnelGroup,
  MetricGroup,
  MetricTabsChart,
  Notice,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  fromPortfolioTabs,
} from "@/components/ds";
import {
  CallCentreUnavailable,
  LinkSalesToolLink,
  UnavailableValue,
} from "@/components/callcenter/CallCentreUnavailable";
import { GRANULARITIES } from "@/lib/portfolio-series";
import { useGranularity } from "@/lib/useGranularity";
import { useDashboardControls } from "@/components/dashboard-controls";
import { usePageHeader } from "@/components/page-header";
import { PeriodControl } from "./PeriodControl";
import { diagnoseFunnel } from "@/lib/portfolio-metrics";
import {
  briefingFromDiagnosis,
  callInsightItems,
  callsTabValue,
  clientBreakdown,
  comparableFunnel,
  costPerLeadSeries,
  funnelNotice,
  funnelStageItems,
  greeting,
  portfolioSummary,
  toFindings,
} from "./presentation";
import {
  applySuggestionRequest,
  dismissSuggestionRequest,
  usePortfolioData,
} from "./usePortfolioData";

// ─── Portfolio Dashboard ────────────────────────────────────────────────────
// Agency-level view: across all clients, what is happening and where is the
// problem? Hub layout, option A: a greeting and the period, five metrics that
// rise into one chart, then "By client" beside Birdy's read, then the
// performance funnel with its diagnosis, then the call insights.
//
// This file is only composition and wiring. The fetching is in
// usePortfolioData, the arithmetic in @/lib/portfolio-*, and the wording and
// shaping into component props in ./presentation.

// Closes are the leads that reached a won opportunity in the CRM.
const METRIC_TABS = [
  { key: "leads", label: "Leads", kpi: "leads" },
  { key: "closes", label: "Closes", kpi: "closes" },
  // The Calls tab stays in the row rather than being hidden: the reader picked
  // a metric and deserves an answer about it, and a tab that quietly
  // disappears when a client is onboarded a certain way is harder to explain
  // than one that says why. It has no KPI of its own; see callsTabValue.
  { key: "calls", label: "Calls", kpi: "calls" },
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

const NOTICE_ICONS = { warning: TriangleAlert, success: CircleCheck, info: Info };

const BIRDY_PROMPT = "What should I focus on across my clients right now?";

const toSeries = (s) =>
  (s?.values ?? []).map((current, i) => ({
    x: s.labels?.[i] ?? "",
    current,
    tooltipLabel: s.tooltipLabels?.[i],
  }));

// A trend needs at least two points; one bucket (Today) is a figure, not a line.
const MIN_TREND_POINTS = 2;

// grid-cols-1 keeps the single column shrinkable below lg; the implicit column
// would size to its widest content and push the Breakdown past the screen.
const BODY_GRID = "grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.35fr_1fr]";

// What the greeting needs from the browser: the signed-in user's first name
// (as stored at login) and the local hour. Both are null on the server and on
// the first client render, so the prerendered markup and the first hydrated
// render agree; the effect fills them in straight after.
function useGreetingParts() {
  const [parts, setParts] = useState({ firstName: null, hour: null });
  useEffect(() => {
    let firstName = null;
    try {
      const full = JSON.parse(localStorage.getItem("user") || "null")?.name;
      firstName = full ? String(full).trim().split(/\s+/)[0] : null;
    } catch {
      firstName = null;
    }
    setParts({ firstName, hour: new Date().getHours() });
  }, []);
  return parts;
}

function LoadingBody() {
  return (
    <div className={BODY_GRID}>
      <Skeleton className="h-64 rounded-surface" />
      <Skeleton className="h-64 rounded-frame" />
      <Skeleton className="h-52 rounded-frame lg:col-span-2" />
      <Skeleton className="h-40 rounded-frame lg:col-span-2" />
    </div>
  );
}

export default function PortfolioDashboardPage() {
  const { preset, setPreset } = useDashboardControls();
  const [chartMetric, setChartMetric] = useState("leads");
  // The date preset picks the window every figure covers; granularity only
  // changes how finely the chart buckets that same window. Auto from the
  // range until the reader picks one, as on the other hubs.
  const { granularity, setGranularity } = useGranularity(preset);
  const { firstName, hour } = useGreetingParts();

  const {
    clientCount,
    clientRows,
    kpis,
    callInsights,
    funnel,
    chartMetrics,
    suggestions,
    loading,
    seriesLoading,
    callsLoading,
    error,
    hasClients,
    hasComparison,
    hasCallCentre,
  } = usePortfolioData({ preset, granularity, chartMetric });

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

  const metrics = useMemo(() => {
    const symbol = chartMetrics.spend.valuePrefix ?? "£";
    const raw = {
      leads: toSeries(chartMetrics.leads),
      closes: toSeries(chartMetrics.closes),
      cpl: costPerLeadSeries(chartMetrics.leads, chartMetrics.spend),
      calls: toSeries(chartMetrics.calls),
      spend: toSeries(chartMetrics.spend),
    };
    // Too short to draw is withheld, but counted, so the empty message can say
    // "too short" rather than "nothing".
    const series = Object.fromEntries(
      Object.entries(raw).map(([key, points]) => [
        key,
        points.length >= MIN_TREND_POINTS ? points : [],
      ])
    );
    const tabs = METRIC_TABS.map(({ key, label, kpi }) => ({
      ...(kpi === "calls"
        ? { value: callsTabValue(callInsights, hasCallCentre) }
        : kpis.find((k) => k.key === kpi)),
      key,
      label,
    }));

    return fromPortfolioTabs({
      tabs,
      activeKey: chartMetric,
      chart: null,
      comparison: "vs previous period",
    }).map((m) => ({
      ...m,
      series: series[m.key],
      points: raw[m.key].length,
      symbol,
    }));
  }, [chartMetrics, kpis, callInsights, hasCallCentre, chartMetric]);

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
  // client dials, so the verdict never names a stage the data cannot see. The
  // one verdict feeds both Birdy's read and the funnel's own notice.
  const diagnosis = useMemo(
    () => diagnoseFunnel(comparableFunnel(funnel, hasCallCentre)),
    [funnel, hasCallCentre]
  );

  const findings = useMemo(
    () =>
      toFindings(
        briefingFromDiagnosis(diagnosis, { hasComparison }),
        suggestions.filter((s) => !removed[s.id]),
        { onApply: handleApply, onDismiss: handleDismiss }
      ),
    [diagnosis, hasComparison, suggestions, removed, handleApply, handleDismiss]
  );

  // Called goes to the placeholder where nobody dials, as the call cells do.
  const funnelStages = useMemo(
    () =>
      funnelStageItems(funnel, hasCallCentre).map((stage) =>
        stage.unavailable ? { ...stage, value: <UnavailableValue /> } : stage
      ),
    [funnel, hasCallCentre]
  );
  const verdict = funnelNotice(diagnosis, { hasComparison });

  // Where no client has a dialler, the call-centre figures show the placeholder
  // rather than the zeroes they sum to. Which cells that touches is enumerated
  // in presentation.js — notably not conversion rate, which comes from the CRM.
  const callCells = useMemo(
    () =>
      callInsightItems(callInsights, hasCallCentre).map(({ unavailable, ...cell }) =>
        unavailable ? { ...cell, value: <UnavailableValue /> } : cell
      ),
    [callInsights, hasCallCentre]
  );

  const callsSelected = chartMetric === "calls";
  // The calls series is its own request, so it has its own loading state; the
  // lead series' says nothing about it.
  const plotLoading = callsSelected
    ? hasCallCentre && (callsLoading || Boolean(chartMetrics.calls?.pending))
    : seriesLoading;

  const showData = !loading && !error && hasClients;
  const summary = showData ? portfolioSummary({ clientCount, kpis }) : null;
  const activeMetric = metrics.find((m) => m.key === chartMetric);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={greeting(hour, firstName)}
        description={summary ?? "Portfolio-level performance"}
        period={<PeriodControl value={preset} onChange={setPreset} />}
        actions={
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger size="sm" aria-label="Chart granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {GRANULARITIES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {error ? (
        <ErrorState
          title="Couldn't load your portfolio"
          description={`${String(error).replace(/\.+$/, "")}. Nothing here is out of date — we just couldn't reach your client data.`}
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
            plotLoading={plotLoading}
            redrawKey={`${granularity}-${preset}`}
            plotFallback={
              callsSelected && !hasCallCentre ? (
                <CallCentreUnavailable
                  className="bg-transparent shadow-none"
                  title="No call data across your clients"
                  body="None of your clients use a call centre, so there's no call volume to plot. Ad spend, leads and closes are unaffected."
                />
              ) : undefined
            }
            emptyMessage={
              activeMetric?.points === 1
                ? "Pick 7 days or longer to see a trend."
                : chartMetric === "spend"
                  ? "No daily spend in this window yet."
                  : callsSelected
                    ? "No dated calls in this window yet."
                    : "No dated leads in this window yet."
            }
          />

          {loading ? (
            <LoadingBody />
          ) : (
            <>
              <div className={BODY_GRID}>
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

              <FunnelGroup
                title="Performance funnel"
                description="From lead to close, across all clients"
                stages={funnelStages}
                footer={
                  <Notice
                    tone={verdict.tone}
                    icon={NOTICE_ICONS[verdict.tone]}
                    title={verdict.title}
                    className="my-1 flex-1"
                  >
                    {verdict.body || undefined}
                  </Notice>
                }
              />

              {/* The cells stay even when none of them can be filled in — the
                  reader still needs to know which six figures Birdy tracks here,
                  and an empty group answers "what am I missing out on?" with
                  nothing at all. The note carries the reason and the way out. */}
              <div className="flex flex-col gap-3">
                {!hasCallCentre && (
                  <Notice tone="neutral" action={<LinkSalesToolLink />}>
                    None of your clients use a call centre, so these figures have no source.
                    Conversion rate is unaffected — it comes from your CRM.
                  </Notice>
                )}
                <MetricGroup
                  title="Call insights"
                  meta="Across all client call centres"
                  items={callCells}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";

import { presetToDateRange } from "@/lib/date-utils";
import { buildSalesSeries, granularityForRange, SALES_CHART_METRICS } from "@/lib/saleshub-series";
import { formatTotal, mergeDailyCalls } from "@/lib/saleshub-totals";

// ─── The trend chart's series ───────────────────────────────────────────────
// Counted server-side (birdy-backend's hp_service._compute_daily_call_series),
// from each client's precomputed hotprospector.daily_calls. The API serves the
// whole retained window in one go — same shape as Meta's daily_spend — so the
// window is applied here instead of by refetching whenever the preset or the
// client filter changes.
//
// This used to page /api/hotprospector/call-center in full on every load: the
// endpoint orders leads by creation date rather than call recency, so one page
// was a biased slice of the window rather than a sample of it, and drawing a
// curve off it needed every page fetched — thousands of lead records, when the
// chart only ever wanted four numbers a day. See the Sales-Hub README.

export function useSalesHubSeries({ clientGroups, groupsLoading, datePreset, selectedClientGroup }) {
  const dailyRows = useMemo(
    () => mergeDailyCalls(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  );

  const chartMetrics = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    const windowRows = dailyRows.filter(
      (d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date)
    );
    const series = buildSalesSeries(windowRows, granularityForRange(start_date, end_date));

    return SALES_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key];
      const plotted = s.values.reduce((sum, v) => sum + v, 0);

      acc[metric.key] = {
        ...metric,
        ...s,
        total: formatTotal(metric.key, plotted),
        pointValues: s.values.map((v) => formatTotal(metric.key, v)),
        // Nothing is fetched here any more, so there is no partial state to
        // qualify — the figure is either not loaded yet or it's complete.
        coverage: null,
        pending: groupsLoading,
      };
      return acc;
    }, {});
  }, [dailyRows, datePreset, groupsLoading]);

  return {
    chartMetrics,
    metrics: SALES_CHART_METRICS,
    loading: groupsLoading,
    streaming: false,
    error: null,
  };
}

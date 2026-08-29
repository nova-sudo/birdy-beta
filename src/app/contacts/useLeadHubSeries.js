"use client";

import { useMemo } from "react";

import { presetToDateRange } from "@/lib/date-utils";
import { buildLeadSeries, granularityForRange, LEAD_CHART_METRICS } from "@/lib/leadhub-series";
import { mergeDailyLeads, previousWindow } from "@/lib/leadhub-totals";
import { percentDelta } from "@/lib/portfolio-aggregate";

// ─── The trend chart's series ───────────────────────────────────────────────
// See Sales-Hub's useSalesHubSeries.js — same shape, same reasoning: the API
// serves the whole retained daily series in one go, so the window is applied
// here instead of by refetching whenever the preset or the client filter
// changes.

const formatSeriesValue = (key, value) =>
  key === "conversion" ? `${value.toFixed(1)}%` : Math.round(value).toLocaleString();

/** won/(won+open+lost+abandoned) — a conversion rate for whatever slice of rows is passed. */
function conversionRate(rows) {
  const sums = rows.reduce(
    (acc, d) => ({
      won: acc.won + (d.won ?? 0),
      open: acc.open + (d.open ?? 0),
      lost: acc.lost + (d.lost ?? 0),
      abandoned: acc.abandoned + (d.abandoned ?? 0),
    }),
    { won: 0, open: 0, lost: 0, abandoned: 0 }
  );
  const denom = sums.won + sums.open + sums.lost + sums.abandoned;
  return denom > 0 ? (sums.won / denom) * 100 : 0;
}

const totalForMetric = (key, rows) => {
  if (key === "conversion") return conversionRate(rows);
  const field = key === "leads" ? "new_leads" : key === "contacts" ? "new_contacts" : "open";
  return rows.reduce((sum, d) => sum + (d[field] ?? 0), 0);
};

/**
 * @param {string} [granularity] Daily | Weekly | Monthly. Omitted, the window
 *   picks for itself — see useGranularity.
 */
export function useLeadHubSeries({
  clientGroups,
  groupsLoading,
  datePreset,
  selectedClientGroup,
  granularity,
}) {
  const dailyRows = useMemo(
    () => mergeDailyLeads(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  );

  const chartMetrics = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    const inWindow = (d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date);
    const windowRows = dailyRows.filter(inWindow);

    const prev = previousWindow(datePreset);
    const prevRows = prev
      ? dailyRows.filter((d) => d.date >= prev.start_date && d.date <= prev.end_date)
      : null;

    const series = buildLeadSeries(
      windowRows,
      granularity ?? granularityForRange(start_date, end_date)
    );

    return LEAD_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key];
      const plotted = totalForMetric(metric.key, windowRows);
      // A window with no comparable period before it (e.g. "maximum") renders
      // no delta at all — TrendChart already treats a missing direction as
      // "say nothing" rather than "flat", the same rule the KPI tiles follow.
      const delta = prevRows ? percentDelta(plotted, totalForMetric(metric.key, prevRows)) : null;

      acc[metric.key] = {
        ...metric,
        ...s,
        total: formatSeriesValue(metric.key, plotted),
        pointValues: s.values.map((v) => formatSeriesValue(metric.key, v)),
        coverage: null,
        pending: groupsLoading,
        ...(delta ?? {}),
      };
      return acc;
    }, {});
  }, [dailyRows, datePreset, granularity, groupsLoading]);

  return {
    chartMetrics,
    metrics: LEAD_CHART_METRICS,
    loading: groupsLoading,
    streaming: false,
    error: null,
  };
}

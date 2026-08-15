// Shaping the Portfolio Dashboard payload into what the cards render.
//
// These take the data as arguments rather than importing it, so the same
// functions serve the live API response and the design fixtures — and so they
// can be tested without a fetch.

/** Tooltips carry the period an axis label alone leaves ambiguous. */
export const AXIS_SUFFIX = {
  // The monthly axis runs Aug–Dec 2025 then Jan–Jul 2026; the year turns at 5.
  Monthly: (i) => (i < 5 ? " 2025" : " 2026"),
  Weekly: () => " · Jul 2026",
  Daily: () => " Jul 2026",
};

/** Formats a normalised chart point back into the figure the tooltip shows. */
export function formatChartValue(metric, rawValue) {
  return (metric.prefix ?? "") + Math.round(rawValue * metric.scale).toLocaleString();
}

/**
 * Flattens the KPI table for one timeframe into the strip's row shape.
 * Falls back to Monthly for any timeframe the payload doesn't carry.
 */
export function kpisForTimeframe(kpis, timeframe) {
  return Object.entries(kpis ?? {}).map(([key, kpi]) => {
    const period = kpi[timeframe] ?? kpi.Monthly ?? {};
    return {
      key,
      label: kpi.label,
      polarity: kpi.polarity,
      value: period.value,
      direction: period.direction,
      delta: period.delta,
    };
  });
}

/** Everything the chart card needs for one metric/timeframe pairing. */
export function chartForMetric(chartMetrics, chartAxis, metricKey, timeframe) {
  const metric = chartMetrics?.[metricKey];
  if (!metric) return null;

  const values = metric[timeframe] ?? metric.Monthly ?? [];
  const totals = metric.totals?.[timeframe] ?? metric.totals?.Monthly ?? {};
  const labels = chartAxis?.[timeframe] ?? chartAxis?.Monthly ?? [];
  const suffix = AXIS_SUFFIX[timeframe] ?? AXIS_SUFFIX.Monthly;

  return {
    key: metricKey,
    title: metric.title,
    subtitle: `${timeframe} · ${metric.subtitle}`,
    values,
    labels,
    tooltipLabels: labels.map((label, i) => label + suffix(i)),
    pointValues: values.map((v) => formatChartValue(metric, v)),
    ...totals,
  };
}

/** Chart tab list, in payload order — Leads · Ad spend · Calls · Closes. */
export function chartTabs(chartMetrics) {
  return Object.entries(chartMetrics ?? {}).map(([key, metric]) => ({ key, tab: metric.tab }));
}

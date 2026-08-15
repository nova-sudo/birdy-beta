import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

// Design-reference figures from the handoff, keyed by timeframe.
//
// These are placeholders that let the screen be built and reviewed against the
// design before the portfolio endpoints exist. PR-10 puts usePortfolioData in
// front of them, so the components keep this shape and only the source changes.

export const KPIS = {
  spend: {
    label: "Total ad spend",
    icon: "spend",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "£142,860", direction: "up", delta: "8.4%" },
    Weekly: { value: "£33,410", direction: "down", delta: "1.6%" },
    Daily: { value: "£4,772", direction: "up", delta: "5.7%" },
  },
  leads: {
    label: "Total leads",
    icon: "leads",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "24,918", direction: "up", delta: "12.1%" },
    Weekly: { value: "5,842", direction: "up", delta: "4.8%" },
    Daily: { value: "812", direction: "down", delta: "2.1%" },
  },
  cpl: {
    label: "Average CPL",
    icon: "cpl",
    // Cheaper leads are better — a fall here is the good news.
    polarity: LOWER_IS_BETTER,
    Monthly: { value: "£5.73", direction: "down", delta: "3.3%" },
    Weekly: { value: "£5.72", direction: "up", delta: "1.4%" },
    Daily: { value: "£5.88", direction: "up", delta: "2.7%" },
  },
  closes: {
    label: "Closed Leads",
    icon: "closes",
    polarity: HIGHER_IS_BETTER,
    Monthly: { value: "3,182", direction: "up", delta: "6.9%" },
    Weekly: { value: "744", direction: "up", delta: "9.2%" },
    Daily: { value: "106", direction: "up", delta: "3.4%" },
  },
};

// ─── Trend chart ────────────────────────────────────────────────────────────
// Series are in normalised units; the chart scales them between their own min
// and max. Each timeframe has a deliberately different shape — monthly trends
// upward, weekly and daily are choppier with genuine peaks and dips — so metric
// and timeframe switching visibly changes the line rather than just its labels.

export const CHART_METRICS = {
  leads: {
    tab: "Leads",
    title: "Total leads",
    subtitle: "Lead volume across the portfolio",
    // Multiplier turning a normalised point back into a readable figure.
    scale: 27,
    Monthly: [52, 61, 58, 70, 66, 74, 69, 80, 86, 79, 92, 100],
    Weekly: [74, 68, 81, 77, 63, 88, 72, 95, 84, 70, 91, 86],
    Daily: [41, 58, 49, 72, 38, 66, 54, 83, 45, 77, 62, 90],
    totals: {
      Monthly: { total: "24,918", direction: "up", delta: "12.1%" },
      Weekly: { total: "5,842", direction: "up", delta: "4.8%" },
      Daily: { total: "812", direction: "down", delta: "2.1%" },
    },
  },
  spend: {
    tab: "Ad spend",
    title: "Total ad spend",
    subtitle: "Combined Meta spend across the portfolio",
    scale: 148,
    prefix: "£",
    Monthly: [60, 64, 58, 72, 68, 76, 71, 82, 78, 88, 84, 95],
    Weekly: [88, 72, 79, 64, 91, 70, 83, 58, 76, 94, 67, 81],
    Daily: [47, 83, 55, 91, 62, 74, 40, 88, 57, 79, 66, 95],
    totals: {
      Monthly: { total: "£142,860", direction: "up", delta: "8.4%" },
      Weekly: { total: "£33,410", direction: "down", delta: "1.6%" },
      Daily: { total: "£4,772", direction: "up", delta: "5.7%" },
    },
  },
  calls: {
    tab: "Calls",
    title: "Total calls",
    subtitle: "Outbound and inbound call volume",
    scale: 21,
    Monthly: [48, 55, 62, 58, 66, 72, 64, 78, 70, 84, 80, 90],
    Weekly: [80, 64, 92, 71, 58, 86, 66, 94, 73, 61, 88, 76],
    Daily: [66, 44, 88, 52, 79, 37, 91, 58, 70, 48, 84, 61],
    totals: {
      Monthly: { total: "18,402", direction: "up", delta: "9.2%" },
      Weekly: { total: "4,318", direction: "up", delta: "2.9%" },
      Daily: { total: "624", direction: "down", delta: "4.3%" },
    },
  },
  conversions: {
    tab: "Closes",
    title: "Total closes",
    subtitle: "Consultations booked across the portfolio",
    scale: 4.3,
    Monthly: [44, 50, 47, 56, 61, 55, 64, 58, 72, 68, 80, 88],
    Weekly: [62, 71, 55, 68, 80, 59, 74, 66, 88, 72, 61, 79],
    Daily: [55, 38, 67, 44, 72, 51, 83, 46, 60, 88, 42, 69],
    totals: {
      Monthly: { total: "3,182", direction: "up", delta: "6.9%" },
      Weekly: { total: "744", direction: "up", delta: "9.2%" },
      Daily: { total: "106", direction: "up", delta: "3.4%" },
    },
  },
};

export const CHART_AXIS = {
  Monthly: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  Weekly: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
  Daily: ["1", "3", "6", "9", "12", "14", "17", "20", "23", "25", "28", "31"],
};

// Tooltips carry the period the axis label alone leaves ambiguous. The monthly
// axis runs Aug–Dec 2025 then Jan–Jul 2026, so the year turns at index 5.
export const CHART_AXIS_SUFFIX = {
  Monthly: (i) => (i < 5 ? " 2025" : " 2026"),
  Weekly: () => " · Jul 2026",
  Daily: () => " Jul 2026",
};

/** Formats a normalised point back into the figure the tooltip shows. */
export function formatChartValue(metricKey, rawValue) {
  const metric = CHART_METRICS[metricKey];
  return (metric.prefix ?? "") + Math.round(rawValue * metric.scale).toLocaleString();
}

/** Everything the chart card needs for one metric/timeframe pairing. */
export function chartForMetric(metricKey, timeframe) {
  const metric = CHART_METRICS[metricKey];
  const values = metric[timeframe] ?? metric.Monthly;
  const totals = metric.totals[timeframe] ?? metric.totals.Monthly;
  const labels = CHART_AXIS[timeframe] ?? CHART_AXIS.Monthly;
  const suffix = CHART_AXIS_SUFFIX[timeframe] ?? CHART_AXIS_SUFFIX.Monthly;

  return {
    key: metricKey,
    title: metric.title,
    subtitle: `${timeframe} · ${metric.subtitle}`,
    values,
    labels,
    tooltipLabels: labels.map((label, i) => label + suffix(i)),
    pointValues: values.map((v) => formatChartValue(metricKey, v)),
    ...totals,
  };
}

/** Flattens the KPI table for one timeframe into the strip's row shape. */
export function kpisForTimeframe(timeframe) {
  return Object.entries(KPIS).map(([key, kpi]) => {
    const period = kpi[timeframe] ?? kpi.Monthly;
    return {
      key,
      label: kpi.label,
      icon: kpi.icon,
      polarity: kpi.polarity,
      value: period.value,
      direction: period.direction,
      delta: period.delta,
    };
  });
}

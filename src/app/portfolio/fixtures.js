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

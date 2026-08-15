import { describe, it, expect } from "vitest";
import { chartForMetric, chartTabs, formatChartValue, kpisForTimeframe } from "@/lib/portfolio-view";
import { CHART_AXIS, CHART_METRICS, KPIS } from "@/app/portfolio/fixtures";

describe("kpisForTimeframe", () => {
  it("reads the figures for the requested timeframe", () => {
    const rows = kpisForTimeframe(KPIS, "Weekly");
    const cpl = rows.find((r) => r.key === "cpl");

    expect(cpl.value).toBe("£5.72");
    expect(cpl.direction).toBe("up");
  });

  it("keeps the inverted polarity on average CPL", () => {
    const cpl = kpisForTimeframe(KPIS, "Monthly").find((r) => r.key === "cpl");
    expect(cpl.polarity).toBe("lower-is-better");
  });

  it("falls back to Monthly for a timeframe the payload doesn't carry", () => {
    const rows = kpisForTimeframe(KPIS, "Hourly");
    expect(rows.find((r) => r.key === "leads").value).toBe("24,918");
  });

  it("returns nothing for an empty payload rather than throwing", () => {
    expect(kpisForTimeframe(undefined, "Monthly")).toEqual([]);
  });
});

describe("chartForMetric", () => {
  it("prefixes the subtitle with the timeframe", () => {
    const chart = chartForMetric(CHART_METRICS, CHART_AXIS, "leads", "Daily");
    expect(chart.subtitle).toBe("Daily · Lead volume across the portfolio");
  });

  it("turns the monthly axis over to 2026 at January", () => {
    const chart = chartForMetric(CHART_METRICS, CHART_AXIS, "leads", "Monthly");

    expect(chart.tooltipLabels[0]).toBe("Aug 2025");
    expect(chart.tooltipLabels[4]).toBe("Dec 2025");
    expect(chart.tooltipLabels[5]).toBe("Jan 2026");
    expect(chart.tooltipLabels[11]).toBe("Jul 2026");
  });

  it("gives every timeframe its own series shape", () => {
    const monthly = chartForMetric(CHART_METRICS, CHART_AXIS, "leads", "Monthly");
    const daily = chartForMetric(CHART_METRICS, CHART_AXIS, "leads", "Daily");
    expect(monthly.values).not.toEqual(daily.values);
  });

  it("formats spend with its currency prefix and leads without", () => {
    expect(formatChartValue(CHART_METRICS.spend, 100)).toBe("£14,800");
    expect(formatChartValue(CHART_METRICS.leads, 100)).toBe("2,700");
  });

  it("returns null for a metric the payload doesn't carry", () => {
    expect(chartForMetric(CHART_METRICS, CHART_AXIS, "nonsense", "Monthly")).toBeNull();
  });
});

describe("chartTabs", () => {
  it("keeps the design's tab order", () => {
    expect(chartTabs(CHART_METRICS).map((t) => t.tab)).toEqual([
      "Leads",
      "Ad spend",
      "Calls",
      "Closes",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  aggregateCampaignRows,
  isOverCplCeiling,
  mergeDailyMetrics,
} from "@/lib/marketing-aggregate";

const group = (id, dailySpend) => ({
  id,
  facebook: { daily_spend: dailySpend },
});

describe("mergeDailyMetrics", () => {
  it("sums spend across groups by date", () => {
    const days = mergeDailyMetrics([
      group("a", [{ date: "2026-07-01", spend: 20 }]),
      group("b", [{ date: "2026-07-01", spend: 30 }]),
    ]);

    expect(days).toEqual([
      { date: "2026-07-01", spend: 50, impressions: 0, impressionDays: 0 },
    ]);
  });

  it("carries impressions where the cached row reports them", () => {
    const days = mergeDailyMetrics([
      group("a", [{ date: "2026-07-01", spend: 20, impressions: 4000 }]),
      group("b", [{ date: "2026-07-01", spend: 30, impressions: 6000 }]),
    ]);

    expect(days[0]).toMatchObject({ spend: 50, impressions: 10000, impressionDays: 2 });
  });

  it("tells a day that served none from a day that cached none", () => {
    // The distinction the Impressions chart is built on: a row reporting zero
    // is a real reading and plots; a row with no impressions field at all is a
    // gap in the cache and must not plot as zero.
    const days = mergeDailyMetrics([
      group("a", [
        { date: "2026-07-01", spend: 20, impressions: 0 },
        { date: "2026-07-02", spend: 25 },
      ]),
    ]);

    expect(days[0]).toMatchObject({ impressions: 0, impressionDays: 1 });
    expect(days[1]).toMatchObject({ impressions: 0, impressionDays: 0 });
    expect(days.filter((d) => d.impressionDays > 0)).toHaveLength(1);
  });

  it("sorts by date and skips rows with no date", () => {
    const days = mergeDailyMetrics([
      group("a", [
        { date: "2026-07-03", spend: 1 },
        { spend: 99 },
        { date: "2026-07-01", spend: 2 },
      ]),
    ]);

    expect(days.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("keeps only the requested group when one is selected", () => {
    const days = mergeDailyMetrics(
      [
        group("a", [{ date: "2026-07-01", spend: 20 }]),
        group("b", [{ date: "2026-07-01", spend: 30 }]),
      ],
      "b"
    );

    expect(days[0].spend).toBe(30);
  });
});

describe("the impressions fallback", () => {
  // The shape-from-spend fallback lives in useMarketingHubData, but the two
  // properties that make it defensible are arithmetic and worth pinning here:
  // the line must sum to the real total, and it must keep spend's shape.
  const scaleToTotal = (values, total) => {
    const sum = values.reduce((s, v) => s + v, 0);
    if (sum <= 0 || total <= 0) return [];
    return values.map((v) => (v * total) / sum);
  };

  it("makes the estimated curve sum to the real impression total", () => {
    const out = scaleToTotal([20, 55, 25], 1_420_000);
    expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(1_420_000, 6);
  });

  it("keeps the ratios between days that spend had", () => {
    const spend = [20, 55, 25];
    const out = scaleToTotal(spend, 1_420_000);
    expect(out[1] / out[0]).toBeCloseTo(spend[1] / spend[0], 9);
    expect(out[2] / out[0]).toBeCloseTo(spend[2] / spend[0], 9);
  });

  it("draws nothing when there is no spend to shape against", () => {
    expect(scaleToTotal([], 1_420_000)).toEqual([]);
    expect(scaleToTotal([0, 0], 1_420_000)).toEqual([]);
  });
});

describe("aggregateCampaignRows", () => {
  const rows = [
    { status: "active", spend: 100, results: 50, impressions: 10000, clicks: 400, reach: 8000 },
    { status: "paused", spend: 50, results: 10, impressions: 5000, clicks: 100, reach: 4000 },
  ];

  it("blends rates rather than averaging each row's own", () => {
    const totals = aggregateCampaignRows(rows);

    // 500 clicks over 15,000 impressions — not the mean of 4% and 2%.
    expect(totals.ctr).toBeCloseTo((500 / 15000) * 100, 6);
    expect(totals.cpl).toBeCloseTo(150 / 60, 6);
  });

  it("counts only active rows as active campaigns", () => {
    expect(aggregateCampaignRows(rows).activeCampaigns).toBe(1);
  });

  it("returns zeroed rates rather than dividing by nothing", () => {
    const totals = aggregateCampaignRows([]);
    expect(totals.cpl).toBe(0);
    expect(totals.ctr).toBe(0);
  });
});

describe("isOverCplCeiling", () => {
  const blended = 3;

  it("flags a row paying more than twice the blended CPL", () => {
    expect(isOverCplCeiling({ spend: 100, cpl: 6.58 }, blended)).toBe(true);
  });

  it("leaves a row at the blended rate alone", () => {
    expect(isOverCplCeiling({ spend: 100, cpl: 2.78 }, blended)).toBe(false);
  });

  it("ignores a row that has not spent enough to judge", () => {
    // £8 on one lead is an £8 CPL, but there is no evidence in it yet.
    expect(isOverCplCeiling({ spend: 8, cpl: 8 }, blended)).toBe(false);
  });

  it("flags nothing when there is no blended CPL to compare against", () => {
    expect(isOverCplCeiling({ spend: 100, cpl: 9 }, 0)).toBe(false);
  });
});

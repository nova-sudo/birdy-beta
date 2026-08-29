import { describe, it, expect } from "vitest";

import { buildSalesSeries, granularityForRange } from "../saleshub-series";

// Two days of precomputed daily rows — the shape hp_service.py's
// _compute_daily_call_series writes as hotprospector.daily_calls.
const dailyRows = [
  { date: "2026-07-01", calls: 1, inbound: 0, talk_min: 1, called: 1 },
  { date: "2026-07-02", calls: 3, inbound: 1, talk_min: 4, called: 1 },
];

describe("granularityForRange", () => {
  it("buckets all-time by month — anything finer is unreadable across years", () => {
    expect(granularityForRange(null, null)).toBe("Monthly");
  });

  it.each([
    ["2026-07-01", "2026-07-07", "Daily"],
    ["2026-06-01", "2026-07-01", "Daily"],
    ["2026-04-01", "2026-07-01", "Weekly"],
    ["2025-07-01", "2026-07-01", "Monthly"],
  ])("buckets %s → %s as %s", (start, end, expected) => {
    expect(granularityForRange(start, end)).toBe(expected);
  });
});

describe("buildSalesSeries", () => {
  it("reads each metric straight off the precomputed daily rows", () => {
    const series = buildSalesSeries(dailyRows, "Daily");

    expect(series.calls.values).toEqual([1, 3]);
    expect(series.called.values).toEqual([1, 1]);
    expect(series.inbound.values).toEqual([0, 1]);
    expect(series.talk.values).toEqual([1, 4]);
  });

  it("draws every metric on one axis, so switching tabs can't move the dates", () => {
    const series = buildSalesSeries(dailyRows, "Daily");
    const axis = series.calls.tooltipLabels;

    for (const key of ["called", "inbound", "talk"]) {
      expect(series[key].tooltipLabels).toEqual(axis);
      expect(series[key].values).toHaveLength(axis.length);
    }

    // 1 July had no inbound call. That is a zero on the shared axis, not a
    // missing bucket — every metric is bucketed from the same row set, so a
    // day present for Total calls is present for Inbound too, at whatever
    // value it actually had.
    expect(series.inbound.values[0]).toBe(0);
  });

  it("sums multiple daily rows into one bucket at coarser granularity", () => {
    const series = buildSalesSeries(dailyRows, "Weekly");

    expect(series.calls.values).toEqual([4]);
    expect(series.talk.values).toEqual([5]);
  });

  it("returns empty series rather than throwing when nothing is cached yet", () => {
    const series = buildSalesSeries(null, "Daily");

    expect(series.calls.values).toEqual([]);
    expect(series.talk.values).toEqual([]);
  });
});

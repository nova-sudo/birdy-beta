import { describe, it, expect } from "vitest";
import {
  MAX_BUCKETS,
  PREVIOUS_PERIOD,
  bucketSeries,
  subtractPeriods,
} from "@/lib/portfolio-series";

const lead = (created_time) => ({ created_time });

describe("bucketSeries", () => {
  it("counts rows into daily buckets", () => {
    const rows = [
      lead("2026-07-01T09:00:00Z"),
      lead("2026-07-01T18:00:00Z"),
      lead("2026-07-03T09:00:00Z"),
    ];
    const series = bucketSeries(rows, (r) => r.created_time, "Daily");

    expect(series.values).toEqual([2, 1]);
    expect(series.labels).toHaveLength(2);
  });

  it("orders buckets oldest to newest regardless of row order", () => {
    const rows = [lead("2026-07-05T09:00:00Z"), lead("2026-07-01T09:00:00Z")];
    const series = bucketSeries(rows, (r) => r.created_time, "Daily");
    expect(series.tooltipLabels).toEqual(["1 Jul 2026", "5 Jul 2026"]);
  });

  it("collapses a week into one bucket", () => {
    // Mon 29 Jun through Sun 5 Jul 2026 is a single ISO week.
    const rows = [
      lead("2026-06-29T09:00:00Z"),
      lead("2026-07-02T09:00:00Z"),
      lead("2026-07-05T09:00:00Z"),
    ];
    expect(bucketSeries(rows, (r) => r.created_time, "Weekly").values).toEqual([3]);
  });

  it("collapses a month into one bucket", () => {
    const rows = [lead("2026-07-01T09:00:00Z"), lead("2026-07-31T09:00:00Z")];
    const series = bucketSeries(rows, (r) => r.created_time, "Monthly");

    expect(series.values).toEqual([2]);
    expect(series.tooltipLabels).toEqual(["July 2026"]);
  });

  it("plots only the periods that exist rather than filling gaps with zeroes", () => {
    const rows = [lead("2026-07-01T09:00:00Z"), lead("2026-07-20T09:00:00Z")];
    expect(bucketSeries(rows, (r) => r.created_time, "Daily").values).toEqual([1, 1]);
  });

  it("skips rows with a missing or unparseable timestamp", () => {
    // Without this they'd all land in one bucket and invent a spike.
    const rows = [lead("2026-07-01T09:00:00Z"), lead(null), lead("not a date"), lead(undefined)];
    expect(bucketSeries(rows, (r) => r.created_time, "Daily").values).toEqual([1]);
  });

  it("keeps the most recent buckets when a range is too long to read", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      lead(`2026-05-${String((i % 28) + 1).padStart(2, "0")}T09:00:00Z`)
    );
    expect(bucketSeries(rows, (r) => r.created_time, "Daily").values.length).toBeLessThanOrEqual(
      MAX_BUCKETS
    );
  });

  it("can weight buckets instead of counting them", () => {
    const rows = [
      { created_time: "2026-07-01T09:00:00Z", spend: 10 },
      { created_time: "2026-07-01T10:00:00Z", spend: 5 },
    ];
    const series = bucketSeries(rows, (r) => r.created_time, "Daily", (r) => r.spend);
    expect(series.values).toEqual([15]);
  });

  it("returns an empty series for no rows", () => {
    expect(bucketSeries([], (r) => r.created_time, "Daily").values).toEqual([]);
    expect(bucketSeries(undefined, (r) => r.created_time, "Daily").values).toEqual([]);
  });
});

describe("PREVIOUS_PERIOD", () => {
  it("maps last_7d onto last_14d minus the current week", () => {
    // There is no "previous 7 days" preset, but every figure summed here is
    // additive, so the subtraction is exact rather than an estimate.
    expect(PREVIOUS_PERIOD.last_7d).toEqual({ preset: "last_14d", subtractCurrent: true });
  });

  it("uses the natural predecessor where one exists", () => {
    expect(PREVIOUS_PERIOD.this_month).toEqual({ preset: "last_month" });
    expect(PREVIOUS_PERIOD.today).toEqual({ preset: "yesterday" });
  });

  it("has no entry for presets with no expressible predecessor", () => {
    // These render without delta pills rather than with invented ones.
    expect(PREVIOUS_PERIOD.last_30d).toBeUndefined();
    expect(PREVIOUS_PERIOD.maximum).toBeUndefined();
  });
});

describe("subtractPeriods", () => {
  it("takes the current period out of the enclosing one", () => {
    const prev = subtractPeriods(
      { spend: 300, leads: 150, closes: 12 },
      { spend: 100, leads: 50, closes: 5 }
    );
    expect(prev).toMatchObject({ spend: 200, leads: 100, closes: 7 });
  });

  it("re-derives CPL from the subtracted figures", () => {
    const prev = subtractPeriods({ spend: 300, leads: 150 }, { spend: 100, leads: 50 });
    expect(prev.cpl).toBe(2);
  });

  it("floors at zero when caches disagree", () => {
    // Each integration refreshes on its own schedule, so an enclosing window
    // can briefly read lower than the one inside it.
    expect(subtractPeriods({ spend: 50 }, { spend: 80 }).spend).toBe(0);
  });

  it("returns null when either period is missing", () => {
    expect(subtractPeriods(null, { spend: 1 })).toBeNull();
    expect(subtractPeriods({ spend: 1 }, null)).toBeNull();
  });
});

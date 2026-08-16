import { describe, it, expect } from "vitest";
import {
  MAX_BUCKETS,
  PREVIOUS_PERIOD,
  bucketSeries,
  callTimestamps,
  scaleSeriesToTotal,
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

describe("callTimestamps", () => {
  it("walks into each lead's nested call logs", () => {
    const rows = [
      { call_logs: [{ call_time_iso: "2026-07-01T09:00:00Z" }, { call_time_iso: "2026-07-01T10:00:00Z" }] },
      { call_logs: [{ call_time_iso: "2026-07-02T09:00:00Z" }] },
    ];
    expect(callTimestamps(rows)).toHaveLength(3);
  });

  it("skips logs with no timestamp, and leads with no logs", () => {
    const rows = [
      { call_logs: [{ call_time_iso: null }, { call_time_iso: "2026-07-01T09:00:00Z" }] },
      { call_logs: [] },
      {},
    ];
    expect(callTimestamps(rows)).toEqual([{ at: "2026-07-01T09:00:00Z" }]);
  });

  it("handles no rows at all", () => {
    expect(callTimestamps(null)).toEqual([]);
  });
});

describe("scaleSeriesToTotal", () => {
  const series = { values: [1, 2, 1], labels: ["a", "b", "c"] };

  it("leaves an uncapped series exactly as counted", () => {
    const out = scaleSeriesToTotal(series, 999, false);
    expect(out.values).toEqual([1, 2, 1]);
    expect(out.estimated).toBe(false);
  });

  it("scales a capped series onto the real total", () => {
    // The sample saw 4; the window really held 400. Every bucket ×100.
    const out = scaleSeriesToTotal(series, 400, true);
    expect(out.values).toEqual([100, 200, 100]);
    expect(out.estimated).toBe(true);
  });

  it("preserves the shape it scales", () => {
    const out = scaleSeriesToTotal(series, 400, true);
    expect(out.values[1] / out.values[0]).toBeCloseTo(2, 5);
  });

  it("makes the scaled series sum to the total it was given", () => {
    // This is the whole point — the curve has to agree with the figure
    // printed directly above it.
    const out = scaleSeriesToTotal(series, 400, true);
    expect(out.values.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 5);
  });

  it("keeps other series fields intact", () => {
    expect(scaleSeriesToTotal(series, 400, true).labels).toEqual(["a", "b", "c"]);
  });

  it("does not scale when there is nothing to scale from or to", () => {
    expect(scaleSeriesToTotal({ values: [0, 0] }, 400, true).values).toEqual([0, 0]);
    expect(scaleSeriesToTotal(series, 0, true).values).toEqual([1, 2, 1]);
    expect(scaleSeriesToTotal(series, null, true).estimated).toBe(false);
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

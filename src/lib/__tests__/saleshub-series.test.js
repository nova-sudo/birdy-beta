import { describe, it, expect } from "vitest";

import {
  buildSalesSeries,
  callLogEntries,
  firstCallPerLead,
  granularityForRange,
} from "../saleshub-series";

// One lead, three calls across two days; one inbound. Durations in seconds.
const leads = [
  {
    id: "a",
    call_logs: [
      { call_time_iso: "2026-07-02T09:00:00Z", call_status: "outbound", duration: 120 },
      { call_time_iso: "2026-07-01T09:00:00Z", call_status: "outbound", duration: 60 },
      { call_time_iso: "2026-07-02T15:00:00Z", call_status: "inbound", duration: 30 },
    ],
  },
  {
    id: "b",
    call_logs: [{ call_time_iso: "2026-07-02T11:00:00Z", call_status: "outbound", duration: 90 }],
  },
  // Never dialled — must not count as a lead called, and must not land in a bucket.
  { id: "c", call_logs: [] },
];

describe("callLogEntries", () => {
  it("flattens every log and converts duration to minutes", () => {
    const entries = callLogEntries(leads);

    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.minutes)).toEqual([2, 1, 0.5, 1.5]);
  });

  it("treats anything that is not explicitly outbound as inbound", () => {
    const entries = callLogEntries(leads);

    expect(entries.filter((e) => !e.outbound)).toHaveLength(1);
  });

  it("drops logs with no timestamp rather than bucketing them at the epoch", () => {
    const entries = callLogEntries([{ call_logs: [{ call_status: "outbound", duration: 60 }] }]);

    expect(entries).toEqual([]);
  });
});

describe("firstCallPerLead", () => {
  it("counts each called lead once, at its earliest call", () => {
    // Lead a was called three times; it must appear once, dated 1 July — not
    // 2 July, and not three times, or the series becomes a copy of Total calls.
    expect(firstCallPerLead(leads)).toEqual([
      { at: "2026-07-01T09:00:00Z" },
      { at: "2026-07-02T11:00:00Z" },
    ]);
  });
});

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
  const totals = { calls: 4, called: 2, inbound: 1, talk: 5 };

  it("counts each metric off the same logs, bucketed by day", () => {
    const series = buildSalesSeries(leads, false, totals, "Daily");

    // 1 July: one call. 2 July: three.
    expect(series.calls.values).toEqual([1, 3]);
    // One lead first called on each day.
    expect(series.called.values).toEqual([1, 1]);
    // The single inbound call landed on 2 July.
    expect(series.inbound.values).toEqual([0, 1]);
    // Minutes: 1 on the first day, 2 + 0.5 + 1.5 on the second.
    expect(series.talk.values).toEqual([1, 4]);
  });

  it("draws every metric on one axis, so switching tabs can't move the dates", () => {
    const series = buildSalesSeries(leads, false, totals, "Daily");
    const axis = series.calls.tooltipLabels;

    for (const key of ["called", "inbound", "talk"]) {
      expect(series[key].tooltipLabels).toEqual(axis);
      expect(series[key].values).toHaveLength(axis.length);
    }

    // 1 July had no inbound call. That is a zero on the shared axis, not a
    // missing bucket — otherwise inbound would plot one point where calls
    // plots two, and the x-axis would change under the reader mid-tab-switch.
    expect(series.inbound.values[0]).toBe(0);
  });

  it("leaves an uncapped sample alone — its own sum is the truth", () => {
    const series = buildSalesSeries(leads, false, totals, "Daily");

    expect(series.calls.estimated).toBe(false);
    expect(series.calls.values.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("scales a capped sample onto the real total, and says it did", () => {
    // The rows endpoint capped out, so these 4 logs are a sample of 400 calls.
    const series = buildSalesSeries(leads, true, { ...totals, calls: 400 }, "Daily");

    expect(series.calls.estimated).toBe(true);
    expect(series.calls.values.reduce((a, b) => a + b, 0)).toBeCloseTo(400);
    // Shape survives the scaling: the second day still carries three times the first.
    expect(series.calls.values[1] / series.calls.values[0]).toBeCloseTo(3);
  });

  it("returns empty series rather than throwing when nothing was fetched", () => {
    const series = buildSalesSeries(null, false, totals, "Daily");

    expect(series.calls.values).toEqual([]);
    expect(series.talk.values).toEqual([]);
  });
});

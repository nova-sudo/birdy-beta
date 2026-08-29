/**
 * When a chart's line covers less than the figure above it, say so.
 *
 * The Marketing cards print a period total (account-level, full history) above
 * a line drawn from cached daily rows, which can cover less: meta_daily_spend
 * retains 400 days, and today has no row until the first refresh after
 * midnight. On an all-time window that produced £428,479 printed above a line
 * summing £278,161, with nothing on screen to explain it.
 *
 * Deriving the headline from the line would be the wrong repair — the total is
 * the accurate number and the line is the truncated one.
 */

import { describe, it, expect } from "vitest";
import { coverageNote } from "@/lib/marketing-aggregate";

const days = (...dates) => dates.map((date) => ({ date }));

describe("coverageNote", () => {
  it("names the covered range when the line falls short of the total", () => {
    // The all-time case: 400 days of rows under a full-lifetime total.
    const note = coverageNote(days("2025-07-18", "2026-08-22"), 278161, 428479);
    expect(note).toContain("18 Jul");
    expect(note).toContain("22 Aug");
    expect(note).toContain("full period");
  });

  it("stays silent when the line covers the total", () => {
    // The normal case — a note on every card would be noise.
    expect(coverageNote(days("2026-08-01", "2026-08-22"), 1000, 1000)).toBeNull();
  });

  it("absorbs rounding and same-day restatement", () => {
    // Meta restates recent days as attribution settles; a 1% wobble is not a
    // coverage gap.
    expect(coverageNote(days("2026-08-01"), 990, 1000)).toBeNull();
    expect(coverageNote(days("2026-08-01"), 1010, 1000)).toBeNull();
  });

  it("flags a gap once it is material", () => {
    expect(coverageNote(days("2026-08-01", "2026-08-21"), 900, 1000)).not.toBeNull();
  });

  it("handles the missing-today case", () => {
    // Today has no daily row yet, so the line ends yesterday.
    const note = coverageNote(days("2026-08-16", "2026-08-22"), 4192, 4845);
    expect(note).toContain("22 Aug");
  });

  it("finds the real bounds even when rows are unordered", () => {
    const note = coverageNote(days("2026-08-22", "2026-07-18", "2026-08-01"), 100, 1000);
    expect(note).toContain("18 Jul");
    expect(note).toContain("22 Aug");
  });

  it("says nothing when there is no line to describe", () => {
    expect(coverageNote([], 0, 1000)).toBeNull();
    expect(coverageNote(null, 0, 1000)).toBeNull();
  });

  it("says nothing when there is no total to compare against", () => {
    // A zero or missing headline is its own problem; a coverage note would
    // imply the line is at fault.
    expect(coverageNote(days("2026-08-01"), 0, 0)).toBeNull();
    expect(coverageNote(days("2026-08-01"), 5, undefined)).toBeNull();
    expect(coverageNote(days("2026-08-01"), 5, NaN)).toBeNull();
  });

  it("describes an over-covering line without claiming the total is bigger", () => {
    const note = coverageNote(days("2026-08-01", "2026-08-22"), 1500, 1000);
    expect(note).toContain("1 Aug");
    expect(note).not.toContain("full period");
  });
});

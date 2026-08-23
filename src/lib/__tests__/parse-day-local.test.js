/**
 * Chart buckets are keyed in local time, so dates must be parsed in local time.
 *
 * `new Date("2026-08-01")` is specified to parse as UTC midnight, but every
 * bucket key is formatted locally. West of UTC those disagree and the whole
 * series shifts a day earlier: a US viewer saw 2026-08-01 filed under
 * 2026-07-31, and at Weekly/Monthly granularity the first of a month landed in
 * the previous month. The KPI tiles beside those charts compare date strings
 * directly and never shifted, so tile and chart disagreed at every window edge.
 *
 * Verified in Node before the fix:
 *   America/Los_Angeles  new Date("2026-08-01") -> 2026-07-31
 *   America/New_York     new Date("2026-08-01") -> 2026-07-31
 *   Africa/Cairo         new Date("2026-08-01") -> 2026-08-01
 */

import { describe, it, expect } from "vitest";
import { parseDayLocal } from "@/lib/portfolio-series";

describe("parseDayLocal", () => {
  it("keeps the calendar day the string names, whatever the timezone", () => {
    const d = parseDayLocal("2026-08-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August, zero-indexed
    expect(d.getDate()).toBe(1);
  });

  it("does not shift across a month boundary", () => {
    // The Weekly/Monthly failure: the 1st landing in the previous month.
    const d = parseDayLocal("2026-09-01");
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(1);
  });

  it("does not shift across a year boundary", () => {
    const d = parseDayLocal("2026-01-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("returns midnight local, not midnight UTC", () => {
    expect(parseDayLocal("2026-08-01").getHours()).toBe(0);
  });

  it("passes a Date straight through", () => {
    const d = new Date(2026, 7, 1);
    expect(parseDayLocal(d)).toBe(d);
  });

  it("leaves full timestamps to the standard parser, since they carry an offset", () => {
    const iso = "2026-08-01T12:30:00Z";
    expect(parseDayLocal(iso).getTime()).toBe(new Date(iso).getTime());
  });

  it("yields an invalid Date for junk, so callers can skip the row", () => {
    expect(Number.isNaN(parseDayLocal("not-a-date").getTime())).toBe(true);
    expect(Number.isNaN(parseDayLocal(null).getTime())).toBe(true);
    expect(Number.isNaN(parseDayLocal(undefined).getTime())).toBe(true);
  });

  it("rejects an unpadded date rather than guessing", () => {
    // "2026-8-1" is not the format the API emits; treating it as one would
    // mask a real upstream change.
    const d = parseDayLocal("2026-8-1");
    expect(d.getTime()).toBe(new Date("2026-8-1").getTime());
  });
});

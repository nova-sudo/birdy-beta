import { describe, it, expect } from "vitest";

import { buildLeadSeries } from "../leadhub-series";

const rows = [
  { date: "2026-08-13", new_leads: 5, new_contacts: 2, open: 1, won: 1, lost: 0, abandoned: 0 },
  { date: "2026-08-14", new_leads: 3, new_contacts: 1, open: 0, won: 0, lost: 0, abandoned: 0 },
];

describe("buildLeadSeries", () => {
  it("buckets leads/contacts/open straight from the daily rows", () => {
    const series = buildLeadSeries(rows, "Daily");

    expect(series.leads.values).toEqual([5, 3]);
    expect(series.contacts.values).toEqual([2, 1]);
    expect(series.open.values).toEqual([1, 0]);
  });

  it("computes conversion as won / (won+open+lost+abandoned) per bucket", () => {
    const series = buildLeadSeries(rows, "Daily");

    // Day 1: 1 won of 2 opportunities (1 won + 1 open) = 50%.
    // Day 2: no opportunities at all — reads as 0%, not NaN or a divide-by-zero.
    expect(series.conversion.values).toEqual([50, 0]);
  });

  it("returns empty series rather than throwing for a missing series", () => {
    const series = buildLeadSeries(null, "Daily");

    expect(series.leads.values).toEqual([]);
    expect(series.conversion.values).toEqual([]);
  });
});

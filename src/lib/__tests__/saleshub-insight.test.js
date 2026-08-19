import { describe, it, expect } from "vitest";

import { buildSalesInsight } from "../saleshub-insight";

const text = (parts) => parts.map((p) => p.text).join("");
const emphasised = (parts) => parts.filter((p) => p.strong).map((p) => p.text);

const totals = {
  clients: 12,
  calls: 17687,
  called: 8260,
  inbound: 1322,
  outbound: 16365,
};

describe("buildSalesInsight", () => {
  it("states the window's figures, with each one emphasised", () => {
    const parts = buildSalesInsight(totals);

    expect(text(parts)).toBe(
      "Your call centres placed 17,687 calls to 8,260 leads across 12 clients this period: " +
        "16,365 outbound and 1,322 inbound."
    );
    expect(emphasised(parts)).toEqual([
      "17,687 calls",
      "8,260 leads",
      "12 clients",
      "16,365 outbound",
      "1,322 inbound",
    ]);
  });

  it("reports only what was summed — no ratios, rankings or comparisons", () => {
    const body = text(buildSalesInsight(totals));

    // The design's card names a movement and a worst offender. Both are derived
    // claims, and this one only restates the figures the tiles show.
    expect(body).not.toMatch(/%/);
    expect(body).not.toMatch(/up |down |slipped|biggest|untouched/);
  });

  it("drops the client count when the view is scoped to one", () => {
    // "across 1 client" tells the reader nothing the picker doesn't already say.
    const parts = buildSalesInsight({ ...totals, clients: 1 });

    expect(text(parts)).not.toContain("across");
    expect(text(parts)).toContain("placed 17,687 calls to 8,260 leads this period");
  });

  it("says nothing about inbound for a pure-outbound portfolio", () => {
    const parts = buildSalesInsight({ ...totals, inbound: 0 });

    expect(text(parts)).not.toContain("inbound");
    expect(text(parts)).toContain("16,365 outbound.");
  });

  it("says what is true rather than nothing when no calls were logged", () => {
    const parts = buildSalesInsight({ clients: 0, calls: 0, called: 0, inbound: 0, outbound: 0 });

    expect(text(parts)).toContain("No calls logged in this window yet");
  });

  it("does not throw on missing totals", () => {
    expect(() => buildSalesInsight(undefined)).not.toThrow();
  });
});

import { describe, it, expect } from "vitest";

import { biggestUntouchedPool, buildSalesInsight } from "../saleshub-insight";

const text = (parts) => parts.map((p) => p.text).join("");
const emphasised = (parts) => parts.filter((p) => p.strong).map((p) => p.text);

const rows = [
  { name: "Tylaesthetics", total_leads: 1305, leads: 328 },
  { name: "Thee Vision Studio", total_leads: 235, leads: 7 },
  { name: "The Contour Co", total_leads: 1080, leads: 378 },
];

describe("biggestUntouchedPool", () => {
  it("ranks by the size of the pool, not the share called", () => {
    // Thee Vision Studio has called the smallest *share* (7 of 235), but
    // Tylaesthetics is sitting on 977 uncalled leads against its 228 — the
    // bigger miss, and the one worth a sentence.
    expect(biggestUntouchedPool(rows).name).toBe("Tylaesthetics");
  });

  it("skips clients with no leads at all — there is nothing to act on", () => {
    expect(biggestUntouchedPool([{ name: "Empty", total_leads: 0, leads: 0 }])).toBeUndefined();
  });

  it("never reports a negative pool when more leads were called than counted", () => {
    const pool = biggestUntouchedPool([{ name: "Odd", total_leads: 10, leads: 14 }]);

    expect(pool.untouched).toBe(0);
  });
});

describe("buildSalesInsight", () => {
  const totals = { calls: 17687, called: 8260, inbound: 1322 };

  it("leads with the period's volume, with the figures emphasised", () => {
    const parts = buildSalesInsight(totals, rows);

    expect(text(parts)).toContain("placed 17,687 calls to 8,260 leads this period");
    expect(emphasised(parts)).toContain("17,687 calls");
    expect(emphasised(parts)).toContain("8,260 leads");
  });

  it("names the inbound share when there is one", () => {
    expect(text(buildSalesInsight(totals, rows))).toContain("7.5% coming inbound");
  });

  it("says nothing about inbound for a pure-outbound portfolio", () => {
    const parts = buildSalesInsight({ ...totals, inbound: 0 }, rows);

    expect(text(parts)).not.toContain("inbound");
  });

  it("calls out the biggest untouched pool, naming the client", () => {
    const parts = buildSalesInsight(totals, rows);

    expect(text(parts)).toContain("Tylaesthetics has called only 328 of 1,305 leads");
    expect(emphasised(parts)).toContain("Tylaesthetics");
  });

  it("stays quiet about a client that has mostly been worked", () => {
    // 300 of 320 called: a 20-lead remainder is not the story, and saying it
    // is would train the reader to stop believing this card.
    const parts = buildSalesInsight(totals, [{ name: "Worked", total_leads: 320, leads: 300 }]);

    expect(text(parts)).not.toContain("untouched pool");
  });

  it("says what is true rather than nothing when no calls were logged", () => {
    const parts = buildSalesInsight({ calls: 0, called: 0, inbound: 0 }, []);

    expect(text(parts)).toContain("No calls logged in this window yet");
  });
});

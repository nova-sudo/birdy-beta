import { describe, it, expect } from "vitest";

import { buildSalesFindings, buildSalesInsight } from "../saleshub-insight";

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

// Three clients under the all-time preset, so every daily row is in window.
// Aura dials the most; Bbl has a big pool it barely touches; Cove is the
// small-pool control that must never be named as the weakest reach.
const group = (id, name, { leads, called, transfers, daily, provider }) => ({
  id,
  name,
  call_log_provider: provider,
  hotprospector: {
    metrics: { total_leads: leads },
    call_stats: { total_calls: daily.reduce((s, d) => s + d.calls, 0), leads_with_calls: called, transfers },
    daily_calls: daily,
  },
});

const day = (date, calls, inbound, talk_min) => ({ date, calls, inbound, talk_min, called: 0 });

const findingsGroups = [
  group("aura", "Aura", {
    leads: 400,
    called: 300,
    transfers: 0,
    daily: [day("2026-08-13", 200, 10, 100), day("2026-08-14", 123, 5, 60)],
  }),
  group("bbl", "Bbl Lanarkshire", {
    leads: 946,
    called: 113,
    transfers: 0,
    daily: [day("2026-08-13", 100, 0, 30)],
  }),
  group("cove", "Cove", {
    leads: 10,
    called: 1,
    transfers: 0,
    daily: [day("2026-08-13", 2, 0, 1)],
  }),
];

describe("buildSalesFindings", () => {
  it("names the weakest reach among clients with a real pool, the top dialler, and the talk time per call", () => {
    const findings = buildSalesFindings(findingsGroups, "all", "maximum");

    expect(findings.map((f) => f.tone)).toEqual(["warning", "success", "neutral"]);
    expect(text(findings[0].parts)).toBe(
      "Bbl Lanarkshire reached only 12% of its 946 leads: the lowest reach of the 2 clients with 50+ leads."
    );
    expect(emphasised(findings[0].parts)).toEqual(["Bbl Lanarkshire", "12%"]);
    // 323 of 425 calls.
    expect(text(findings[1].parts)).toBe("Aura made the most calls this period: 323, 76% of the total.");
    expect(emphasised(findings[1].parts)).toEqual(["Aura", "323"]);
    // 191 minutes over 425 calls is 27 seconds each.
    expect(text(findings[2].parts)).toBe("Average talk time is 27s per call.");
  });

  it("ignores a tiny pool when ranking reach — one call would move it ten points", () => {
    const findings = buildSalesFindings(findingsGroups, "all", "maximum");

    expect(findings.map((f) => text(f.parts)).join(" ")).not.toContain("Cove");
  });

  it("says nothing about reach when every client with a pool reaches a quarter of it", () => {
    const reached = findingsGroups.map((g) =>
      g.id === "bbl"
        ? { ...g, hotprospector: { ...g.hotprospector, call_stats: { ...g.hotprospector.call_stats, leads_with_calls: 300 } } }
        : g
    );
    const findings = buildSalesFindings(reached, "all", "maximum");

    expect(findings.map((f) => f.tone)).toEqual(["success", "neutral"]);
  });

  it("drops the ranking lines when the view is one client, and never ranks it against itself", () => {
    const findings = buildSalesFindings(findingsGroups, "bbl", "maximum");

    expect(findings.map((f) => f.tone)).toEqual(["warning", "neutral"]);
    expect(text(findings[0].parts)).toBe("Bbl Lanarkshire reached only 12% of its 946 leads.");
    expect(findings.map((f) => text(f.parts)).join(" ")).not.toMatch(/most calls|in view|of the total/);
  });

  it("flags transfers that outnumber calls ahead of anything else about the mix", () => {
    const overcounted = findingsGroups.map((g) =>
      g.id === "aura"
        ? { ...g, hotprospector: { ...g.hotprospector, call_stats: { ...g.hotprospector.call_stats, transfers: 5360 } } }
        : g
    );
    const findings = buildSalesFindings(overcounted, "all", "maximum");
    const mix = findings[2];

    expect(mix.tone).toBe("info");
    expect(text(mix.parts)).toBe("Transfers (5,360) outnumber calls, so check the Hot Prospector transfer rule.");
    expect(emphasised(mix.parts)).toEqual(["5,360"]);
  });

  it("reports the inbound share once it is a fifth of the calls", () => {
    const inboundHeavy = findingsGroups.map((g) =>
      g.id === "aura"
        ? { ...g, hotprospector: { ...g.hotprospector, daily_calls: [day("2026-08-13", 200, 90, 100), day("2026-08-14", 123, 10, 60)] } }
        : g
    );
    const findings = buildSalesFindings(inboundHeavy, "all", "maximum");

    // 100 inbound of 425 calls.
    expect(text(findings[2].parts)).toBe("Inbound is 24% of all calls.");
    expect(findings[2].tone).toBe("info");
  });

  it("leaves a client with no call centre out of every ranking", () => {
    const withNone = [
      ...findingsGroups,
      group("dune", "Dune", { leads: 500, called: 0, transfers: 0, daily: [], provider: "none" }),
    ];
    const findings = buildSalesFindings(withNone, "all", "maximum");

    // Dune's 0% reach would otherwise top the warning; it has no dialler to reach with.
    expect(text(findings[0].parts)).toContain("Bbl Lanarkshire");
    expect(findings.map((f) => text(f.parts)).join(" ")).not.toContain("Dune");
  });

  it("has nothing to say when no calls were logged", () => {
    expect(buildSalesFindings([], "all", "maximum")).toEqual([]);
    expect(buildSalesFindings(undefined, "all", "maximum")).toEqual([]);
  });

  it("never returns more than three findings", () => {
    expect(buildSalesFindings(findingsGroups, "all", "maximum").length).toBeLessThanOrEqual(3);
  });
});

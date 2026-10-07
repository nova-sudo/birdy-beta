import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";

import { buildLeadFindings, buildLeadInsight, insightPrompt } from "../leadhub-insight";

const asText = (parts) => parts.map((p) => p.text).join("");

describe("buildLeadInsight", () => {
  it("reports the empty-window message when nothing has been captured", () => {
    const parts = buildLeadInsight({ lead_count: 0, contact_count: 0, conversion_rate: 0 }, null);

    expect(asText(parts)).toMatch(/no leads or contacts captured/i);
  });

  it("states the raw lead count when there's no previous window to compare against", () => {
    const parts = buildLeadInsight({ lead_count: 1525, contact_count: 448, conversion_rate: 2.6 }, null);

    expect(asText(parts)).toContain("1,525 leads");
    expect(asText(parts)).toContain("2.6%");
  });

  it("states a relative movement when a previous window exists", () => {
    const parts = buildLeadInsight(
      { lead_count: 1525, contact_count: 448, conversion_rate: 2.6 },
      { lead_count: 1422, contact_count: 400, conversion_rate: 3.0 }
    );

    expect(asText(parts)).toMatch(/up 7\.2%/);
    expect(asText(parts)).toMatch(/fallen to 2\.6%/);
  });

  it("stays one sentence — the anomaly now lives in the findings", () => {
    const parts = buildLeadInsight({ lead_count: 100, contact_count: 50, conversion_rate: 10 }, null);

    expect(asText(parts)).not.toContain("no email captured");
  });
});

// The clock is pinned so last_7d is 2026-09-30..10-07 and its previous window
// 09-22..09-29; the daily rows below land in one or the other, giving each
// group both a current and a previous total.
const day = (date, fields) => ({
  date,
  new_leads: 0,
  new_contacts: 0,
  open: 0,
  won: 0,
  lost: 0,
  abandoned: 0,
  ...fields,
});

const group = (id, name, daily_leads, ghl_location_id = `loc-${id}`) => ({
  id,
  name,
  ghl_location_id,
  gohighlevel: { daily_leads },
});

const fakeIt = group("g1", "Fake It Aesthetics", [
  day("2026-09-27", { new_leads: 29 }), // previous window
  day("2026-10-03", { new_leads: 17, won: 1, open: 12, lost: 2 }), // current window: 1 of 15 = 6.7%
]);
const aura = group("g2", "Aura", [
  day("2026-09-28", { new_leads: 40 }),
  day("2026-10-04", { new_leads: 42, won: 4, open: 30, lost: 10, abandoned: 4 }),
]);

describe("buildLeadFindings", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  });
  afterAll(() => vi.useRealTimers());

  it("leads with the no-email anomaly as a warning", () => {
    const findings = buildLeadFindings({
      clientGroups: [],
      selectedClientGroup: "all",
      datePreset: "last_7d",
      anomaly: { name: "Fallon Physique", count: 214 },
    });

    expect(findings[0].tone).toBe("warning");
    expect(asText(findings[0].parts)).toContain("Fallon Physique has 214 contacts with no email captured");
  });

  it("names the client whose leads fell furthest against the previous window", () => {
    const findings = buildLeadFindings({
      clientGroups: [fakeIt, aura],
      selectedClientGroup: "all",
      datePreset: "last_7d",
      anomaly: null,
    });

    const danger = findings.find((f) => f.tone === "danger");
    expect(asText(danger.parts)).toBe(
      "Fake It Aesthetics leads are down 41% on the previous period (17 from 29)."
    );
    // Aura grew — it must not be reported as a drop.
    expect(findings.filter((f) => f.tone === "danger")).toHaveLength(1);
  });

  it("names the best-converting client once it has enough opportunities", () => {
    const findings = buildLeadFindings({
      clientGroups: [fakeIt, aura],
      selectedClientGroup: "all",
      datePreset: "last_7d",
      anomaly: null,
    });

    const success = findings.find((f) => f.tone === "success");
    expect(asText(success.parts)).toBe("Aura converts best at 8.3% of 48 opportunities.");
  });

  it("drops the superlative when only one client is in scope", () => {
    const findings = buildLeadFindings({
      clientGroups: [fakeIt, aura],
      selectedClientGroup: "g2",
      datePreset: "last_7d",
      anomaly: null,
    });

    expect(asText(findings.find((f) => f.tone === "success").parts)).toBe(
      "Aura converts 8.3% of 48 opportunities."
    );
    expect(findings.find((f) => f.tone === "danger")).toBeUndefined();
  });

  it("reports the contact share only when contacts are a sizeable part of the capture", () => {
    const heavy = group("g3", "Glow", [day("2026-10-05", { new_leads: 62, new_contacts: 38 })]);
    const light = group("g4", "Lumen", [day("2026-10-05", { new_leads: 90, new_contacts: 10 })]);

    const withShare = buildLeadFindings({ clientGroups: [heavy], selectedClientGroup: "all", datePreset: "last_7d" });
    const without = buildLeadFindings({ clientGroups: [light], selectedClientGroup: "all", datePreset: "last_7d" });

    expect(asText(withShare.find((f) => f.tone === "info").parts)).toBe(
      "38% of captures were contacts with no form fill."
    );
    expect(without.find((f) => f.tone === "info")).toBeUndefined();
  });

  it("skips comparisons the data can't back", () => {
    // Too few previous leads for a drop to mean anything, too few
    // opportunities for a rate, and no daily series at all for the last —
    // the same gate the headline totals use, so nothing is said about a
    // client the figures above don't count.
    const thin = group("g5", "Thin", [
      day("2026-09-27", { new_leads: 4 }),
      day("2026-10-03", { new_leads: 1, won: 1, open: 1 }),
    ]);
    const noGhl = group("g6", "Spreadsheet Co", [], null);

    const findings = buildLeadFindings({
      clientGroups: [thin, noGhl],
      selectedClientGroup: "all",
      datePreset: "last_7d",
      anomaly: null,
    });

    expect(findings).toEqual([]);
  });

  it("never returns more than three findings", () => {
    const findings = buildLeadFindings({
      clientGroups: [fakeIt, aura, group("g7", "Glow", [day("2026-10-05", { new_contacts: 50 })])],
      selectedClientGroup: "all",
      datePreset: "last_7d",
      anomaly: { name: "Aura", count: 12 },
    });

    expect(findings).toHaveLength(3);
    expect(findings.map((f) => f.tone)).toEqual(["warning", "danger", "success"]);
  });

  it("makes no previous-period claim for all-time windows", () => {
    const findings = buildLeadFindings({
      clientGroups: [fakeIt, aura],
      selectedClientGroup: "all",
      datePreset: "maximum",
      anomaly: null,
    });

    expect(findings.find((f) => f.tone === "danger")).toBeUndefined();
  });
});

describe("insightPrompt", () => {
  it("wraps the card's copy as a question for the assistant", () => {
    const parts = [{ text: "Lead volume is up.", strong: false }];
    expect(insightPrompt(parts)).toBe("About my Lead Hub this period: Lead volume is up. What should I do about it?");
  });
});

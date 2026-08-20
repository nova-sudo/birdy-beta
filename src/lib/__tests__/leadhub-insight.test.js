import { describe, it, expect } from "vitest";

import { buildLeadInsight, insightPrompt } from "../leadhub-insight";

const asText = (parts) => parts.map((p) => p.text).join("");

describe("buildLeadInsight", () => {
  it("reports the empty-window message when nothing has been captured", () => {
    const parts = buildLeadInsight({ lead_count: 0, contact_count: 0, conversion_rate: 0 }, null, null);

    expect(asText(parts)).toMatch(/no leads or contacts captured/i);
  });

  it("states the raw lead count when there's no previous window to compare against", () => {
    const parts = buildLeadInsight({ lead_count: 1525, contact_count: 448, conversion_rate: 2.6 }, null, null);

    expect(asText(parts)).toContain("1,525 leads");
    expect(asText(parts)).toContain("2.6%");
  });

  it("states a relative movement when a previous window exists", () => {
    const parts = buildLeadInsight(
      { lead_count: 1525, contact_count: 448, conversion_rate: 2.6 },
      { lead_count: 1422, contact_count: 400, conversion_rate: 3.0 },
      null
    );

    expect(asText(parts)).toMatch(/up 7\.2%/);
    expect(asText(parts)).toMatch(/fallen to 2\.6%/);
  });

  it("appends the anomaly clause only when one was found", () => {
    const withAnomaly = buildLeadInsight(
      { lead_count: 100, contact_count: 50, conversion_rate: 10 },
      null,
      { name: "Fallon Physique", count: 214 }
    );
    const without = buildLeadInsight({ lead_count: 100, contact_count: 50, conversion_rate: 10 }, null, null);

    expect(asText(withAnomaly)).toContain("Fallon Physique");
    expect(asText(withAnomaly)).toContain("214 contacts with no email captured");
    expect(asText(without)).not.toContain("no email captured");
  });
});

describe("insightPrompt", () => {
  it("wraps the card's copy as a question for the assistant", () => {
    const parts = [{ text: "Lead volume is up.", strong: false }];
    expect(insightPrompt(parts)).toBe("About my Lead Hub this period: Lead volume is up. What should I do about it?");
  });
});

import { describe, it, expect } from "vitest";

import {
  mergeDailyLeads,
  windowLeadTotals,
  previousWindow,
  previousLeadTotals,
  formatStat,
} from "../leadhub-totals";
import { presetToDateRange } from "../date-utils";

const clientGroups = [
  {
    id: "g1",
    gohighlevel: {
      daily_leads: [
        { date: "2026-08-13", new_leads: 5, new_contacts: 2, open: 3, won: 1, lost: 0, abandoned: 0 },
        { date: "2026-08-20", new_leads: 4, new_contacts: 1, open: 2, won: 1, lost: 1, abandoned: 0 },
      ],
    },
  },
  {
    id: "g2",
    gohighlevel: {
      daily_leads: [
        { date: "2026-08-13", new_leads: 3, new_contacts: 0, open: 1, won: 0, lost: 0, abandoned: 1 },
      ],
    },
  },
];

describe("mergeDailyLeads", () => {
  it("sums same-date rows across scoped clients", () => {
    const merged = mergeDailyLeads(clientGroups, "all");
    const aug13 = merged.find((d) => d.date === "2026-08-13");

    expect(aug13).toEqual({
      date: "2026-08-13",
      new_leads: 8,
      new_contacts: 2,
      open: 4,
      won: 1,
      lost: 0,
      abandoned: 1,
    });
  });

  it("scopes to one client when selected", () => {
    const merged = mergeDailyLeads(clientGroups, "g2");

    expect(merged).toEqual([
      { date: "2026-08-13", new_leads: 3, new_contacts: 0, open: 1, won: 0, lost: 0, abandoned: 1 },
    ]);
  });
});

describe("windowLeadTotals", () => {
  it("sums every row under the all-time preset and derives total_opportunities/conversion_rate", () => {
    const totals = windowLeadTotals(
      [
        { date: "2026-08-13", new_leads: 8, new_contacts: 2, open: 4, won: 1, lost: 0, abandoned: 1 },
        { date: "2026-08-20", new_leads: 4, new_contacts: 1, open: 2, won: 1, lost: 1, abandoned: 0 },
      ],
      "maximum"
    );

    expect(totals).toEqual({
      lead_count: 12,
      contact_count: 3,
      open: 6,
      won: 2,
      lost: 1,
      abandoned: 1,
      total_opportunities: 10,
      conversion_rate: 20,
    });
  });

  it("returns zeros for a missing series rather than throwing", () => {
    expect(windowLeadTotals(null, "maximum")).toEqual({
      lead_count: 0,
      contact_count: 0,
      open: 0,
      won: 0,
      lost: 0,
      abandoned: 0,
      total_opportunities: 0,
      conversion_rate: 0,
    });
  });
});

describe("previousWindow", () => {
  it("returns null for the all-time preset", () => {
    expect(previousWindow("maximum")).toBeNull();
  });

  it("returns an equal-length window that ends the day before the current window starts", () => {
    const cur = presetToDateRange("last_7d");
    const prev = previousWindow("last_7d");

    const dayBefore = new Date(`${cur.start_date}T00:00:00Z`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

    expect(prev.end_date).toBe(dayBefore.toISOString().slice(0, 10));

    const curSpan =
      Math.round(
        (new Date(`${cur.end_date}T00:00:00Z`) - new Date(`${cur.start_date}T00:00:00Z`)) / 86_400_000
      ) + 1;
    const prevSpan =
      Math.round(
        (new Date(`${prev.end_date}T00:00:00Z`) - new Date(`${prev.start_date}T00:00:00Z`)) / 86_400_000
      ) + 1;
    expect(prevSpan).toBe(curSpan);
  });
});

describe("previousLeadTotals", () => {
  it("returns null when there is no previous window (all-time)", () => {
    expect(previousLeadTotals([{ date: "2026-08-13", new_leads: 1 }], "maximum")).toBeNull();
  });
});

describe("formatStat", () => {
  it("formats conversion_rate to one decimal with a percent sign", () => {
    expect(formatStat("conversion_rate", 2.649)).toBe("2.6%");
    expect(formatStat("conversion_rate", 0)).toBe("0.0%");
  });

  it("formats everything else as a rounded, comma-grouped count", () => {
    expect(formatStat("lead_count", 1525)).toBe("1,525");
    expect(formatStat("open", undefined)).toBe("0");
  });
});

import { describe, it, expect } from "vitest";
import {
  activeGroups,
  aggregatePortfolio,
  buildCallInsights,
  buildFunnel,
  buildKpis,
  buildLeaderboards,
  groupMetrics,
  percentDelta,
} from "@/lib/portfolio-aggregate";
import { LOWER_IS_BETTER } from "@/lib/portfolio-metrics";

const money = (n, d = 0) => `£${Number(n || 0).toFixed(d)}`;

/** A client group in the shape GET /api/client-groups actually returns. */
function group({
  id = "g1",
  name = "Client",
  status = "Active",
  spend = 0,
  results = 0,
  campaigns = null,
  totalLeads = 0,
  won = 0,
  revenue = 0,
  contacts = 0,
  calls = {},
} = {}) {
  return {
    id,
    name,
    client_status: status,
    facebook: {
      currency: "GBP",
      campaigns,
      metrics: { insights: { spend, results, total_leads: totalLeads } },
    },
    gohighlevel: {
      metrics: { total_contacts: contacts, opportunity_stats: { won, won_revenue: revenue } },
    },
    hotprospector: { call_stats: calls },
  };
}

describe("groupMetrics", () => {
  it("reads Meta spend and lead results off the insights cache", () => {
    const m = groupMetrics(group({ spend: 120.5, results: 40 }));
    expect(m.spend).toBe(120.5);
    expect(m.leads).toBe(40);
  });

  it("parses string numbers, which the Meta cache sometimes returns", () => {
    expect(groupMetrics(group({ spend: "120.50" })).spend).toBe(120.5);
  });

  it("falls back to summing campaigns when results is empty", () => {
    const m = groupMetrics(group({ results: 0, campaigns: [{ results: 7 }, { results: 5 }] }));
    expect(m.leads).toBe(12);
  });

  it("falls back to total_leads when there are no campaign rows either", () => {
    // Older cached insights only carry total_leads; without this ladder a whole
    // client reads as zero-lead.
    expect(groupMetrics(group({ results: 0, totalLeads: 9 })).leads).toBe(9);
  });

  it("survives a group with no integrations connected", () => {
    const m = groupMetrics({ id: "x", name: "Bare" });
    expect(m).toMatchObject({ spend: 0, leads: 0, closes: 0, totalCalls: 0 });
  });
});

describe("aggregatePortfolio", () => {
  const groups = [
    group({ id: "a", spend: 100, results: 50, won: 5, revenue: 1000, contacts: 40 }),
    group({ id: "b", spend: 200, results: 50, won: 3, revenue: 500, contacts: 30 }),
    group({ id: "c", status: "Inactive", spend: 999, results: 999, won: 99 }),
  ];

  it("counts only active clients", () => {
    expect(activeGroups(groups)).toHaveLength(2);
    expect(aggregatePortfolio(groups).clientCount).toBe(2);
  });

  it("excludes inactive clients from every total", () => {
    const totals = aggregatePortfolio(groups);
    expect(totals.spend).toBe(300);
    expect(totals.leads).toBe(100);
    expect(totals.closes).toBe(8);
  });

  it("derives CPL from the summed spend and leads, not an average of averages", () => {
    // £300 over 100 leads is £3.00; averaging the two clients' CPLs would give
    // £3.00 here too, so use an uneven split to tell them apart.
    const uneven = [
      group({ id: "a", spend: 100, results: 100 }),
      group({ id: "b", spend: 300, results: 100 }),
    ];
    expect(aggregatePortfolio(uneven).cpl).toBe(2);
  });

  it("reports zero CPL rather than dividing by zero", () => {
    expect(aggregatePortfolio([group({ spend: 50, results: 0 })]).cpl).toBe(0);
  });

  it("handles an empty portfolio", () => {
    const totals = aggregatePortfolio([]);
    expect(totals.clientCount).toBe(0);
    expect(totals.spend).toBe(0);
  });
});

describe("percentDelta", () => {
  it("reports a rise", () => {
    expect(percentDelta(110, 100)).toMatchObject({ direction: "up", delta: "10.0%" });
  });

  it("reports a fall", () => {
    expect(percentDelta(90, 100)).toMatchObject({ direction: "down", delta: "10.0%" });
  });

  it("says nothing when there is no previous period", () => {
    expect(percentDelta(100, null)).toBeNull();
    expect(percentDelta(100, undefined)).toBeNull();
  });

  it("says nothing when the previous period was zero", () => {
    // Going from nothing to something has no meaningful percentage, and
    // "+100%" on a client's first week of spend would be worse than silence.
    expect(percentDelta(100, 0)).toBeNull();
  });

  it("says nothing when the change rounds to flat", () => {
    expect(percentDelta(100.01, 100)).toBeNull();
  });

  it("carries polarity through so callers can colour it", () => {
    expect(percentDelta(90, 100, LOWER_IS_BETTER).polarity).toBe(LOWER_IS_BETTER);
  });
});

describe("buildKpis", () => {
  const current = { spend: 300, leads: 100, cpl: 3, closes: 10 };

  it("keeps average CPL inverted", () => {
    const cpl = buildKpis(current, null, money).find((k) => k.key === "cpl");
    expect(cpl.polarity).toBe(LOWER_IS_BETTER);
  });

  it("renders no delta at all when there is no previous period", () => {
    for (const kpi of buildKpis(current, null, money)) {
      expect(kpi.direction).toBeUndefined();
    }
  });

  it("compares against the previous period when there is one", () => {
    const previous = { spend: 250, leads: 80, cpl: 3.125, closes: 8 };
    const kpis = buildKpis(current, previous, money);

    expect(kpis.find((k) => k.key === "leads")).toMatchObject({ direction: "up", delta: "25.0%" });
    // Cheaper leads: CPL fell, which is the good direction.
    expect(kpis.find((k) => k.key === "cpl").direction).toBe("down");
  });
});

describe("buildFunnel", () => {
  // The unrelated portfolio totals are deliberately different from the cohort
  // figures, so a stage reading off the wrong field is visible here.
  const current = {
    funnelCached: 2,
    funnelLeads: 1000,
    funnelInCrm: 400,
    funnelCalled: 650,
    funnelCloses: 50,
    leads: 7777,
    contacts: 99999,
    leadsWithCalls: 800,
    closes: 500,
  };

  it("counts the four stages off the cohort cache", () => {
    const stages = buildFunnel(current, null);

    expect(stages.map((s) => s.key)).toEqual(["leads", "engaged", "called", "closes"]);
    expect(stages.map((s) => s.stage)).toEqual(["Leads", "In CRM", "Called", "Closes"]);
    expect(stages.map((s) => s.count)).toEqual(["1,000", "400", "650", "50"]);
  });

  it("shows each stage as a share of the cohort — Closes is the close rate", () => {
    const stages = buildFunnel(current, null);

    // 50 of the window's 1,000 leads closed.
    expect(stages.find((s) => s.key === "closes").share).toBe("5.0%");
    expect(stages.find((s) => s.key === "engaged").share).toBe("40.0%");
  });

  it("leaves the first stage without a share — it is the cohort itself", () => {
    const stages = buildFunnel(current, null);
    expect(stages.find((s) => s.key === "leads").share).toBeNull();
  });

  it("has no share to report for a cohort of nobody", () => {
    const empty = { ...current, funnelLeads: 0, funnelInCrm: 0, funnelCalled: 0, funnelCloses: 0 };
    const stages = buildFunnel(empty, null);

    expect(stages).toHaveLength(4);
    expect(stages.every((s) => s.share === null)).toBe(true);
  });

  it("renders nothing until the backend has cached this preset", () => {
    // Four zeroes would read as a portfolio with no leads, which is a
    // different claim from "not computed yet".
    expect(buildFunnel({ ...current, funnelCached: 0 }, null)).toEqual([]);
  });

  it("gives every stage a numeric delta for diagnoseFunnel to read", () => {
    const previous = {
      funnelLeads: 900,
      funnelInCrm: 500,
      funnelCalled: 600,
      funnelCloses: 40,
    };
    const stages = buildFunnel(current, previous);

    expect(stages.map((s) => s.direction)).toEqual(["up", "down", "up", "up"]);
    for (const stage of stages) expect(typeof stage.delta).toBe("number");
  });

  it("keeps Closes inside In CRM inside Leads", () => {
    // The invariant the close rate depends on. The backend counts all three
    // off one cohort, so this must survive whatever the other caches say.
    const stages = buildFunnel(current, null);
    const count = (key) => Number(stages.find((s) => s.key === key).count.replace(/,/g, ""));

    expect(count("closes")).toBeLessThanOrEqual(count("engaged"));
    expect(count("engaged")).toBeLessThanOrEqual(count("leads"));
  });
});

describe("buildCallInsights", () => {
  const current = {
    totalCalls: 200,
    answeredCalls: 100,
    talkTime: 340,
    hpLeads: 100,
    closes: 20,
    leads: 200,
  };

  it("keeps the metrics that improve as they fall marked as such", () => {
    const rows = buildCallInsights(current);
    expect(rows.find((r) => r.key === "perLead").polarity).toBe(LOWER_IS_BETTER);
    expect(rows.find((r) => r.key === "perClose").polarity).toBe(LOWER_IS_BETTER);
  });

  it("computes the ratios", () => {
    const rows = buildCallInsights(current);
    expect(rows.find((r) => r.key === "answer").value).toBe("50.0%");
    expect(rows.find((r) => r.key === "perLead").value).toBe("2.0");
    expect(rows.find((r) => r.key === "perClose").value).toBe("10.0");
    expect(rows.find((r) => r.key === "conversion").value).toBe("10.0%");
  });

  it("shows a dash rather than a divide-by-zero", () => {
    const rows = buildCallInsights({ totalCalls: 0, answeredCalls: 0, talkTime: 0, hpLeads: 0, closes: 0, leads: 0 });
    expect(rows.find((r) => r.key === "answer").value).toBe("—");
    expect(rows.find((r) => r.key === "perLead").value).toBe("—");
  });
});

describe("buildLeaderboards", () => {
  const current = aggregatePortfolio([
    group({ id: "a", name: "Cheap", spend: 100, results: 100, won: 2, revenue: 500 }),
    group({ id: "b", name: "Mid", spend: 300, results: 100, won: 9, revenue: 900 }),
    group({ id: "c", name: "Dear", spend: 500, results: 100, won: 5, revenue: 100 }),
  ]);

  it("ranks CPL ascending, because cheap is good", () => {
    const rows = buildLeaderboards(current, money);
    expect(rows["Avg CPL"].map((r) => r.name)).toEqual(["Cheap", "Mid", "Dear"]);
  });

  it("ranks everything else descending", () => {
    const rows = buildLeaderboards(current, money);
    expect(rows.Closes.map((r) => r.name)).toEqual(["Mid", "Dear", "Cheap"]);
    expect(rows.Revenue.map((r) => r.name)).toEqual(["Mid", "Cheap", "Dear"]);
  });

  it("gives the leader a full bar and scales the rest against it", () => {
    const rows = buildLeaderboards(current, money);
    expect(rows.Closes[0].bar).toBe(100);
    expect(rows.Closes[1].bar).toBeCloseTo((5 / 9) * 100, 5);
  });

  it("scales ascending bars the other way, so the cheapest is still full", () => {
    const rows = buildLeaderboards(current, money);
    expect(rows["Avg CPL"][0].bar).toBe(100);
    // £1 vs £3 CPL — the dearer client's bar is a third as long.
    expect(rows["Avg CPL"][1].bar).toBeCloseTo(33.333, 2);
  });

  it("leaves out clients with nothing to rank on", () => {
    const withBlank = aggregatePortfolio([
      group({ id: "a", name: "Has data", spend: 100, results: 10, won: 1, revenue: 50 }),
      group({ id: "b", name: "No revenue", spend: 100, results: 10, won: 1, revenue: 0 }),
    ]);
    expect(buildLeaderboards(withBlank, money).Revenue.map((r) => r.name)).toEqual(["Has data"]);
  });

  it("caps the list at the requested length", () => {
    const many = aggregatePortfolio(
      Array.from({ length: 9 }, (_, i) => group({ id: `g${i}`, name: `C${i}`, results: i + 1, spend: 10 }))
    );
    expect(buildLeaderboards(many, money, 5).Leads).toHaveLength(5);
  });
});

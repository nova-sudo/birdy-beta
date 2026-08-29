import { describe, it, expect } from "vitest";

import { sumCallStats, mergeDailyCalls, windowCallTotals } from "../saleshub-totals";

const clientGroups = [
  {
    id: "g1",
    hotprospector: {
      call_stats: { total_calls: 999, leads_with_calls: 50, transfers: 999 },
      daily_calls: [
        { date: "2026-08-13", calls: 5, inbound: 2, talk_min: 12, called: 3 },
        { date: "2026-08-20", calls: 4, inbound: 1, talk_min: 8, called: 1 },
      ],
    },
  },
  {
    id: "g2",
    hotprospector: {
      call_stats: { total_calls: 999, leads_with_calls: 20, transfers: 999 },
      daily_calls: [{ date: "2026-08-13", calls: 3, inbound: 0, talk_min: 6, called: 2 }],
    },
  },
];

describe("mergeDailyCalls", () => {
  it("sums same-date rows across scoped clients", () => {
    const merged = mergeDailyCalls(clientGroups, "all");
    const aug13 = merged.find((d) => d.date === "2026-08-13");

    expect(aug13).toEqual({ date: "2026-08-13", calls: 8, inbound: 2, talk_min: 18, called: 5 });
  });

  it("scopes to one client when selected", () => {
    const merged = mergeDailyCalls(clientGroups, "g2");

    expect(merged).toEqual([{ date: "2026-08-13", calls: 3, inbound: 0, talk_min: 6, called: 2 }]);
  });
});

describe("windowCallTotals", () => {
  it("sums only rows inside the window and derives outbound from calls minus inbound", () => {
    const totals = windowCallTotals(
      [
        { date: "2026-08-13", calls: 5, inbound: 2, talk_min: 12 },
        { date: "2026-01-01", calls: 100, inbound: 100, talk_min: 100 },
      ],
      "today"
    );

    // "today" excludes both rows on a fixed test date — the point here is
    // just that a window preset filters, not what it resolves to right now.
    expect(totals).toEqual({ calls: 0, inbound: 0, outbound: 0, talk: 0 });
  });

  it("includes everything under the all-time preset and derives outbound", () => {
    const totals = windowCallTotals(
      [
        { date: "2026-08-13", calls: 5, inbound: 2, talk_min: 12 },
        { date: "2026-01-01", calls: 3, inbound: 1, talk_min: 4 },
      ],
      "maximum"
    );

    expect(totals).toEqual({ calls: 8, inbound: 3, outbound: 5, talk: 16 });
  });

  it("returns zeros for a missing series rather than throwing", () => {
    expect(windowCallTotals(null, "maximum")).toEqual({ calls: 0, inbound: 0, outbound: 0, talk: 0 });
  });
});

describe("sumCallStats", () => {
  it("sources calls/inbound/outbound/talk from the daily series, not call_stats", () => {
    const totals = sumCallStats(clientGroups, "all", "maximum");

    // 12 calls across both clients' daily rows (5+3 on 08-13, 4 on 08-20) —
    // not call_stats' 999+999.
    expect(totals.calls).toBe(12);
    expect(totals.inbound).toBe(3);
    expect(totals.outbound).toBe(9);
  });

  it("still sources leads-called and transfers from call_stats, unchanged", () => {
    const totals = sumCallStats(clientGroups, "all", "maximum");

    expect(totals.called).toBe(70);
    expect(totals.transfers).toBe(1998);
  });

  it("counts a client as active off call_stats.total_calls, not the windowed daily sum", () => {
    const totals = sumCallStats(clientGroups, "all", "maximum");

    expect(totals.clients).toBe(2);
  });
});

/**
 * Marketing Hub KPI totals come from the account, not from summing campaigns.
 *
 * `/{account}/campaigns` omits deleted and archived campaigns, so the rows
 * under-report by however much of an account's history sits on campaigns Meta
 * no longer lists. Measured on this portfolio: the campaign rows totalled
 * £4,845.99 against £4,973.19 at account level, and one client returning zero
 * campaigns showed £0 against £4,532 of real spend.
 */

import { describe, it, expect } from "vitest";
import { aggregateCampaignRows, aggregateGroupInsights } from "@/lib/marketing-aggregate";

const group = (id, insights, campaigns = []) => ({
  id,
  facebook: { metrics: insights ? { insights } : undefined, campaigns },
});

const INSIGHTS = { spend: 4973.19, results: 120, impressions: 100000, clicks: 2000, reach: 50000 };

describe("aggregateGroupInsights", () => {
  it("totals the account-level figures across groups", () => {
    const t = aggregateGroupInsights([
      group("a", { spend: 100, results: 5, impressions: 10, clicks: 2, reach: 8 }),
      group("b", { spend: 250, results: 7, impressions: 20, clicks: 3, reach: 9 }),
    ]);
    expect(t).toEqual({ spend: 350, leads: 12, impressions: 30, clicks: 5, reach: 17 });
  });

  it("captures spend the campaign rows cannot see", () => {
    // The real failure: zero campaigns returned, real money spent.
    const g = group("a", { spend: 4532.08, results: 40 }, []);
    expect(aggregateCampaignRows(g.facebook.campaigns).spend).toBe(0);
    expect(aggregateGroupInsights([g]).spend).toBe(4532.08);
  });

  it("honours the group picker", () => {
    const groups = [group("a", { spend: 100 }), group("b", { spend: 250 })];
    expect(aggregateGroupInsights(groups, "b").spend).toBe(250);
    expect(aggregateGroupInsights(groups, "all").spend).toBe(350);
    expect(aggregateGroupInsights(groups).spend).toBe(350);
  });

  it("returns null when nothing carries insights, so callers can fall back", () => {
    // Rendering a measured-looking zero would be worse than showing the
    // campaign sum we do have.
    expect(aggregateGroupInsights([group("a", null)])).toBeNull();
    expect(aggregateGroupInsights([])).toBeNull();
    expect(aggregateGroupInsights(null)).toBeNull();
  });

  it("skips groups without insights but still totals the ones that have them", () => {
    const t = aggregateGroupInsights([group("a", { spend: 100 }), group("b", null)]);
    expect(t.spend).toBe(100);
  });

  it("falls back to total_leads when results is absent", () => {
    expect(aggregateGroupInsights([group("a", { spend: 1, total_leads: 9 })]).leads).toBe(9);
  });

  it("prefers results over total_leads when both are present", () => {
    const t = aggregateGroupInsights([group("a", { spend: 1, results: 4, total_leads: 9 })]);
    expect(t.leads).toBe(4);
  });

  it("coerces string figures, which Meta returns", () => {
    const t = aggregateGroupInsights([group("a", { spend: "125.17", results: "3" })]);
    expect(t.spend).toBeCloseTo(125.17);
    expect(t.leads).toBe(3);
  });

  it("reproduces the measured portfolio gap", () => {
    expect(aggregateGroupInsights([group("all", INSIGHTS)]).spend).toBe(4973.19);
  });
});

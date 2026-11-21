import { describe, expect, it } from "vitest";
import { baseMetrics, catalogRows, customFromApi, nextSort, tabCounts, tagId, viewFromParams, viewToHref, visibleRows } from "../metrics-catalog";

const fields = {
  base_metrics: [
    { id: "meta_spend", label: "Meta Spend", category: "Meta Ads", level: "group", description: "Amount spent." },
    { id: "ghl_contacts", label: "GHL Contacts", category: "GoHighLevel", level: "group" },
    { id: "hp_total_calls", label: "Total Calls", category: "Call Center", level: "group" },
    { id: "roas", label: "ROAS", category: "Calculated", level: "group" },
  ],
  tags: ["VIP Client"],
};
const custom = [customFromApi({ id: "custom_1", name: "CPA", description: "", formula_parts: [{ type: "metric", value: "meta_spend" }], formula_display: "Meta Spend", dashboards: ["clients"] })];

describe("the catalogue", () => {
  const base = baseMetrics(fields);

  it("adds Birdy's own metrics once and a metric per tag", () => {
    expect(base.filter((m) => m.id === "roas")).toHaveLength(1);
    expect(base.find((m) => m.id === tagId("VIP Client"))).toMatchObject({ label: "Tag: VIP Client", category: "Tags" });
    expect(tagId("VIP Client")).toBe("tag_vip_client");
  });

  it("maps saved custom metrics with the old defaults", () => {
    expect(custom[0]).toMatchObject({ formatType: "integer", aggregation: "total", formula: "Meta Spend" });
  });

  it("lists base metrics, then custom formulas, each with its source", () => {
    const rows = catalogRows(base, custom);
    expect(rows.map((r) => r.source).slice(0, 3)).toEqual(["meta", "ghl", "sales"]);
    expect(rows.at(-1)).toMatchObject({ id: "custom_1", source: "custom" });
  });
});

describe("the view", () => {
  const rows = catalogRows(baseMetrics(fields), custom);
  const hidden = new Set(["ghl_contacts"]);

  it("filters by tab, search words and the hidden filter", () => {
    expect(visibleRows(rows, { tab: "meta", hidden }).map((r) => r.id)).toEqual(["meta_spend"]);
    expect(visibleRows(rows, { tab: "all", query: "total calls", hidden }).map((r) => r.id)).toEqual(["hp_total_calls"]);
    expect(visibleRows(rows, { tab: "all", query: "hotprospector", hidden }).map((r) => r.id)).toEqual(["hp_total_calls"]);
    expect(visibleRows(rows, { tab: "all", hiddenOnly: true, hidden }).map((r) => r.id)).toEqual(["ghl_contacts"]);
  });

  it("counts every tab, under the search when there is one", () => {
    expect(tabCounts(rows, "")).toMatchObject({ all: rows.length, custom: 1, tag: 1 });
    expect(tabCounts(rows, "cpa")).toMatchObject({ all: 1, custom: 1, meta: 0 });
  });

  it("sorts by name either way, and keeps rows without a note last", () => {
    expect(visibleRows(rows, { tab: "all", hidden, sort: { key: "name", dir: "asc" } })[0].name).toBe("CPA");
    expect(visibleRows(rows, { tab: "all", hidden, sort: { key: "note", dir: "desc" } })[0].id).toBe("meta_spend");
    expect(nextSort(null, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toBeNull();
  });

  it("round-trips through the address", () => {
    const view = { tab: "custom", query: "cpa", sort: { key: "name", dir: "desc" }, hiddenOnly: true };
    const href = viewToHref(view);
    expect(href).toBe("/settings?section=metrics&tab=custom&q=cpa&sort=name-desc&hidden=1");
    expect(viewFromParams(new URL(href, "http://x").searchParams)).toEqual(view);
    expect(viewFromParams(new URLSearchParams("tab=nope&sort=bad"))).toEqual({ tab: "all", query: "", sort: null, hiddenOnly: false });
  });
});

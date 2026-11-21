// Settings › Metrics: the catalogue the table lists, built from
// /api/custom-metrics/available-fields, /api/custom-metrics and Birdy's own
// metrics, and the tab, search, hidden filter and sort over it.

import { DEFAULT_METRICS } from "./default-metrics";
import { sourceForCategory } from "./metric-sources";

/** The table's tabs, in the reference's order. */
export const METRIC_TABS = [
  { key: "all", label: "All" },
  { key: "ghl", label: "GoHighLevel" },
  { key: "meta", label: "Meta" },
  { key: "sales", label: "Sales" },
  { key: "birdy", label: "Birdy" },
  { key: "tag", label: "Tags" },
  { key: "custom", label: "Custom formulas" },
];

/** What a source is called on a row. */
export const SOURCE_NAME = { meta: "Meta Ads", ghl: "GoHighLevel", sales: "HotProspector", birdy: "Birdy", tag: "Tags", custom: "Formula" };

/** A tag's metric id, as the backend names it. */
export const tagId = (tag) => `tag_${tag.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;

/**
 * Every base metric: the backend's, Birdy's own (computed in the app, added
 * unless the backend already ships one) and one per GoHighLevel tag.
 * @param {{base_metrics?: object[], tags?: string[]}} fields
 */
export function baseMetrics(fields) {
  const metrics = (fields?.base_metrics || []).map((m) => ({ id: m.id, label: m.label, category: m.category, level: m.level, description: m.description || "" }));
  for (const dm of DEFAULT_METRICS) {
    if (metrics.some((m) => m.id === dm.id)) continue;
    metrics.push({ id: dm.id, label: dm.label, category: dm.category, level: dm.level, description: dm.description || "" });
  }
  for (const tag of fields?.tags || []) metrics.push({ id: tagId(tag), label: `Tag: ${tag}`, category: "Tags", level: "group", description: "" });
  return metrics;
}

/** A saved custom metric as the page uses it. */
export function customFromApi(m) {
  return {
    id: m.id,
    name: m.name,
    description: m.description || "",
    dashboards: m.dashboards || [],
    formula: m.formula_display || "",
    formulaParts: m.formula_parts || [],
    formatType: m.format_type || "integer",
    aggregation: m.aggregation || "total",
  };
}

/**
 * The table's rows: base metrics first, then the custom formulas.
 * @returns {{id: string, name: string, note: string, source: string, order: number, custom?: object}[]}
 */
export function catalogRows(base, custom) {
  return [
    ...base.map((m, i) => ({ id: m.id, name: m.label, note: m.description || "", source: sourceForCategory(m.category), order: i })),
    ...custom.map((c, i) => ({ id: c.id, name: c.name, note: c.description || "", source: "custom", order: base.length + i, custom: c })),
  ];
}

const inTab = (tab, row) => tab === "all" || row.source === tab;

const matches = (row, words) => {
  if (!words.length) return true;
  const hay = [row.name, row.note, SOURCE_NAME[row.source], row.custom?.formula].filter(Boolean).join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
};
const wordsOf = (query) => (query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);

/** How many rows each tab holds, or how many match the search when there is one. */
export function tabCounts(rows, query) {
  const words = wordsOf(query);
  return Object.fromEntries(METRIC_TABS.map((t) => [t.key, rows.filter((r) => inTab(t.key, r) && matches(r, words)).length]));
}

/** The next sort a header press gives: ascending, then descending, then back to the usual order. */
export function nextSort(sort, key) {
  if (sort?.key !== key) return { key, dir: "asc" };
  if (sort.dir === "asc") return { key, dir: "desc" };
  return null;
}

/**
 * The rows one tab shows.
 * @param {object[]} rows catalogRows
 * @param {{tab: string, query?: string, hiddenOnly?: boolean, hidden: Set<string>, sort?: {key: "name"|"note"|"source", dir: "asc"|"desc"}|null}} view
 */
export function visibleRows(rows, { tab, query, hiddenOnly = false, hidden, sort = null }) {
  const words = wordsOf(query);
  const hits = rows.filter((r) => inTab(tab, r) && (!hiddenOnly || hidden.has(r.id)) && matches(r, words));
  if (!sort) return hits;
  const m = sort.dir === "asc" ? 1 : -1;
  const by = (a, b) => m * a.localeCompare(b, "en-GB", { numeric: true, sensitivity: "base" });
  return [...hits].sort((a, b) => {
    if (sort.key === "name") return by(a.name, b.name);
    if (sort.key === "source") return by(SOURCE_NAME[a.source], SOURCE_NAME[b.source]) || a.order - b.order;
    // Rows without a note stay last whichever way.
    if (a.note && b.note) return by(a.note, b.note);
    return a.note ? -1 : b.note ? 1 : a.order - b.order;
  });
}

/** The tab, search, sort and hidden filter, read from the address. */
export function viewFromParams(params) {
  const tab = METRIC_TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all";
  const m = /^(name|note|source)-(asc|desc)$/.exec(params.get("sort") ?? "");
  return { tab, query: params.get("q") ?? "", sort: m ? { key: m[1], dir: m[2] } : null, hiddenOnly: params.get("hidden") === "1" };
}

/** The address for a view, on Settings' Metrics section. */
export function viewToHref(view) {
  const u = new URLSearchParams({ section: "metrics" });
  if (view.tab !== "all") u.set("tab", view.tab);
  if (view.query) u.set("q", view.query);
  if (view.sort) u.set("sort", `${view.sort.key}-${view.sort.dir}`);
  if (view.hiddenOnly) u.set("hidden", "1");
  return `/settings?${u.toString()}`;
}

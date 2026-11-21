// The drill-down on Media Buyer's Dashboard table: Clients → Campaigns → Ad sets → Ads → Leads.
// Clicking a row narrows the next level to it; the narrowing lives in the address so a refresh
// and the back button keep it. Plain functions; the page draws them.

/** The levels, in drill order. */
export const DRILL_LEVELS = ["clients", "campaigns", "adsets", "ads", "leads"];

/**
 * What a level can be narrowed to, outermost first. `param` is its name in the address,
 * `field` the row field it matches, `at` the level whose row sets it.
 */
export const DRILL_FILTERS = [
  { key: "group", param: "group", field: "groupId", at: "clients", noun: "Client" },
  { key: "campaign", param: "campaign", field: "campaignId", at: "campaigns", noun: "Campaign" },
  { key: "adset", param: "adset", field: "adsetId", at: "adsets", noun: "Ad set" },
  { key: "ad", param: "ad", field: "adId", at: "ads", noun: "Ad" },
];

const indexOf = (level) => DRILL_LEVELS.indexOf(level);

/**
 * The filters that apply at a level. A client applies everywhere, Clients included;
 * a campaign, ad set or ad only below its own level.
 */
export function filtersAt(level) {
  const at = indexOf(level);
  return DRILL_FILTERS.filter((f) => f.key === "group" || indexOf(f.at) < at);
}

/** The level and filters an address holds. An unknown level is Clients. */
export function readDrill(search) {
  const get = (k) => (typeof search?.get === "function" ? search.get(k) : null) || "";
  const level = DRILL_LEVELS.includes(get("level")) ? get("level") : "clients";
  const drill = {};
  for (const f of DRILL_FILTERS) if (get(f.param)) drill[f.key] = get(f.param);
  return { level, drill };
}

/**
 * The query string for a level and filters, keeping every other parameter of `search` (the range and so on).
 * Clients and an empty filter are left out, so the plain table has the plain address.
 */
export function drillQuery(search, level, drill) {
  const next = new URLSearchParams(search?.toString?.() ?? "");
  next.delete("level");
  for (const f of DRILL_FILTERS) next.delete(f.param);
  if (level && level !== "clients") next.set("level", level);
  for (const f of DRILL_FILTERS) if (drill?.[f.key]) next.set(f.param, drill[f.key]);
  return next.toString();
}

/** Rows of a level narrowed by every filter that applies there. Rows carry `groupId`, `campaignId`, `adsetId`, `adId`. */
export function applyDrill(rows, level, drill) {
  const active = filtersAt(level).filter((f) => drill?.[f.key]);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => String(row[f.field] ?? "") === String(drill[f.key])));
}

/**
 * Where clicking a row goes: the next level, narrowed to the row and to everything it sits under.
 * Null on the Leads level, the bottom.
 */
export function drillInto(level, row) {
  const next = DRILL_LEVELS[indexOf(level) + 1];
  if (!next || !row) return null;
  const drill = {};
  for (const f of DRILL_FILTERS) {
    if (indexOf(f.at) > indexOf(level)) break;
    const value = f.key === "group" && level === "clients" ? row.id : row[f.field];
    if (value) drill[f.key] = String(value);
  }
  return { level: next, drill };
}

/** The filters with one removed, and everything under it: an ad set means nothing without its campaign. */
export function clearDrill(drill, key) {
  const at = DRILL_FILTERS.findIndex((f) => f.key === key);
  if (at < 0) return { ...drill };
  const out = {};
  for (const f of DRILL_FILTERS.slice(0, at)) if (drill?.[f.key]) out[f.key] = drill[f.key];
  return out;
}

/** Back up to one filter: everything under it removed, and the level just below it shown. */
export function stepTo(drill, key) {
  const at = DRILL_FILTERS.findIndex((f) => f.key === key);
  const kept = {};
  for (const f of DRILL_FILTERS.slice(0, at + 1)) if (drill?.[f.key]) kept[f.key] = drill[f.key];
  return { level: DRILL_LEVELS[indexOf(DRILL_FILTERS[at].at) + 1], drill: kept };
}

/**
 * The trail of chips for the filters that are on, outermost first, each with a name.
 * `nameOf(key, id)` looks the name up; a filter whose name can't be found says so rather than showing an id.
 */
export function drillTrail(drill, nameOf) {
  return DRILL_FILTERS.filter((f) => drill?.[f.key]).map((f) => ({
    key: f.key,
    noun: f.noun,
    id: drill[f.key],
    name: nameOf(f.key, drill[f.key]) || null,
  }));
}

/**
 * The name lookup the trail uses, from the client groups and their Meta lists.
 * Looks through every campaign, ad set and ad, not only those that spent, so a filter
 * stays named when the range changes under it.
 */
export function drillNames(groups) {
  const maps = { group: new Map(), campaign: new Map(), adset: new Map(), ad: new Map() };
  for (const g of groups ?? []) {
    maps.group.set(String(g.id), g.name);
    const fb = g.facebook ?? {};
    for (const c of fb.campaigns ?? []) maps.campaign.set(String(c.id), c.name);
    for (const a of fb.adsets ?? []) maps.adset.set(String(a.id), a.name);
    for (const a of fb.ads ?? []) maps.ad.set(String(a.id), a.name);
  }
  return (key, id) => maps[key]?.get(String(id)) ?? "";
}

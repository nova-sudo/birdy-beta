// Settings' sections and the address that opens each one.
//
// /settings?section=<key> opens a section; plain /settings opens Connections.
// The page used to be /settings?tab=<general|integrations|tracking|billing|ai>,
// and /metrics, /billing and /credits were pages of their own: their links
// still land on the section that now holds what they showed.

export const SETTINGS_SECTIONS = [
  { key: "connections", label: "Connections", title: "Connections", sub: "Where your numbers come from" },
  { key: "plan", label: "Plan & credits", title: "Plan & credits", sub: "Your plan, client slots and AI credits" },
  { key: "account", label: "Account", title: "Account", sub: "Your login and preferences" },
  { key: "agents", label: "Media Buyer", title: "Media Buyer", sub: "How Birdy's media buying works for you" },
  { key: "alerts", label: "Alerts", title: "Alerts", sub: "What Birdy watches for, and what it has caught" },
  { key: "metrics", label: "Metrics", title: "Metrics", sub: "Every metric powering your dashboards and formulas" },
];

export const DEFAULT_SECTION = "connections";

/** The old ?tab= values, and the section that holds what each showed. */
const OLD_TABS = {
  integrations: "connections",
  tracking: "connections",
  ai: "connections",
  general: "account",
  billing: "plan",
  account: "plan",
  capabilities: "agents",
};

const isSection = (key) => SETTINGS_SECTIONS.some((s) => s.key === key);

/**
 * The section an address opens.
 * @param {URLSearchParams | {get: (key: string) => string | null}} params
 */
export function sectionFromParams(params) {
  const section = params?.get?.("section");
  if (isSection(section)) return section;
  const tab = params?.get?.("tab");
  if (OLD_TABS[tab]) return OLD_TABS[tab];
  return DEFAULT_SECTION;
}

/** The address of a section. Connections is plain /settings. */
export function sectionHref(key) {
  return key === DEFAULT_SECTION || !isSection(key) ? "/settings" : `/settings?section=${key}`;
}

/**
 * Where an old page's link goes: a Settings section, keeping the rest of the
 * old query string (Metrics' tab and search, Whop's checkout and top-up
 * return flags).
 * @param {string} section
 * @param {Record<string, string | string[] | undefined>} [query] Next's searchParams
 */
export function sectionRedirect(section, query = {}) {
  const next = new URLSearchParams();
  next.set("section", section);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === "section" || value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
  }
  return `/settings?${next.toString()}`;
}

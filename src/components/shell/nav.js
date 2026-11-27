
// Where the rail's items go while the redesign is in progress. Each section
// opens the nearest page that exists today; as a section's own screens are
// rebuilt its entry here changes.

/** Rail item id -> the page it opens. */
export const DESTINATIONS = {
  ops: "/dashboard",
  buyer: "/media-buyer",
  coach: "/sales-coach",
  clients: "/clients",
  settings: "/settings",
};

/** The agent sections: the ones a client and a date range carry across. */
const AGENT_SECTIONS = ["ops", "buyer", "coach"];

/**
 * Where a rail tile goes. Between the agent sections the client and the date
 * range on the current address come along, so picking a client and then
 * opening another agent stays inside that client. Clients and Settings open plain.
 * @param {string} id the tile's id
 * @param {string} [search] the current address's query
 */
export function railHref(id, search = "") {
  const base = DESTINATIONS[id];
  if (!AGENT_SECTIONS.includes(id)) return base;
  const from = new URLSearchParams(search);
  const keep = new URLSearchParams();
  for (const key of ["client", "range"]) {
    const value = from.get(key);
    if (value) keep.set(key, value);
  }
  const query = keep.toString();
  return query ? `${base}?${query}` : base;
}

const under = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Which rail item the current page belongs to: a section id, "settings",
 * or null when the page belongs to none of them.
 */
export function activeRailId(pathname) {
  if (under(pathname, "/dashboard")) return "ops";
  // The Media Buying Agent lives under BirdyHub today but belongs to Marketing Guru.
  if (under(pathname, "/media-buyer") || under(pathname, "/campaigns") || under(pathname, "/hub/agents/media-buying")) return "buyer";
  if (under(pathname, "/sales-coach") || under(pathname, "/Sales-Hub")) return "coach";
  if (under(pathname, "/clients")) return "clients";
  if (under(pathname, "/settings") || under(pathname, "/metrics") || under(pathname, "/billing") || under(pathname, "/credits") || under(pathname, "/alerts")) return "settings";
  return null;
}

/**
 * Pages already rebuilt in the redesign. They bring their own header and
 * canvas, so the shell gives them the whole content area instead of the padded
 * frame the older pages expect.
 */
export const isRebuilt = (pathname) => pathname === "/clients" || pathname === "/welcome" || pathname === "/settings" || /^\/contacts\/[^/]+$/.test(pathname)
  || SECTION_BASES.some((base) => SECTION_TABS.some((tab) => pathname === `${base}${tab}`))
  // One report's page under Reports.
  || SECTION_BASES.some((base) => pathname.startsWith(`${base}/reports/`));

/** The three agent sections' addresses. Each has the same four tabs under it, and Context under "More". */
const SECTION_BASES = ["/dashboard", "/media-buyer", "/sales-coach"];
const SECTION_TABS = ["", "/chat", "/table", "/suggestions", "/context", "/reports", "/projections"];

/** The agent section a path is in ("/dashboard", "/media-buyer" or "/sales-coach"), or null. */
export const sectionBase = (pathname) => SECTION_BASES.find((base) => under(pathname, base)) ?? null;

/** The client a `/clients/<id>` page is showing, or null on any other page. */
export function clientIdFromPath(pathname) {
  const match = /^\/clients\/([^/]+)/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * The client a page is showing: `/clients/<id>`, or an agent section narrowed
 * to one client with `?client=<id>`. Null on any other page.
 */
export function clientIdFromLocation(pathname, search = "") {
  const fromPath = clientIdFromPath(pathname);
  if (fromPath) return fromPath;
  if (!sectionBase(pathname)) return null;
  return new URLSearchParams(search).get("client") || null;
}

/** The page for one client: Birdy's Bird's Eye, narrowed to that client. */
export const clientHref = (id) => `${DESTINATIONS.ops}?client=${encodeURIComponent(id)}`;

/**
 * Where picking a client in the switcher goes from the current page. Inside
 * Marketing Guru or Sales Coach it stays in that section, on the same tab, and
 * on any section's Context it stays on Context; anywhere else it opens Agency
 * Ops for that client.
 */
export function clientHrefFrom(pathname, id) {
  const base = sectionBase(pathname);
  // Context is the same page with or without a client, Birdy's included.
  const stays = base && isRebuilt(pathname) && (base !== DESTINATIONS.ops || pathname === `${base}/context`);
  if (!stays) return clientHref(id);
  return `${pathname}?client=${encodeURIComponent(id)}`;
}

/** The older, full client page. Still the only place for a client's settings, notes and tracking. */
export const clientDetailHref = (id) => `/clients/${encodeURIComponent(id)}`;

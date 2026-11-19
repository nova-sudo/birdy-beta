import { Bell, Calculator, LayoutGrid, List, Sparkles } from "lucide-react";

// Where the rail's items go while the redesign is in progress. Each section
// opens the nearest page that exists today; as a section's own screens are
// rebuilt its entry here changes, and "Other pages" shrinks.

/** Rail item id -> the page it opens. */
export const DESTINATIONS = {
  ops: "/dashboard",
  buyer: "/campaigns",
  coach: "/Sales-Hub",
  clients: "/clients",
  settings: "/settings",
};

/** Pages with no tile of their own, listed under the dashed "Other pages" tile. */
export const OTHER_PAGES = [
  { label: "BirdyHub", href: "/hub", icon: LayoutGrid },
  { label: "Ask Birdy", href: "/ask-birdy", icon: Sparkles },
  { label: "Leads", href: "/contacts", icon: List },
  { label: "Metrics", href: "/metrics", icon: Calculator },
  { label: "Alerts", href: "/alerts", icon: Bell },
];

const under = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Which rail item the current page belongs to: a section id, "settings",
 * "other", or null when the page belongs to none of them.
 */
export function activeRailId(pathname) {
  if (under(pathname, "/dashboard")) return "ops";
  // The Media Buying Agent lives under BirdyHub today but belongs to Media Buyer.
  if (under(pathname, "/campaigns") || under(pathname, "/hub/agents/media-buying")) return "buyer";
  if (under(pathname, "/Sales-Hub")) return "coach";
  if (under(pathname, "/clients")) return "clients";
  if (under(pathname, "/settings") || under(pathname, "/billing") || under(pathname, "/credits")) return "settings";
  if (OTHER_PAGES.some((page) => under(pathname, page.href))) return "other";
  return null;
}

/**
 * Pages already rebuilt in the redesign. They bring their own header and
 * canvas, so the shell gives them the whole content area instead of the padded
 * frame the older pages expect.
 */
export const isRebuilt = (pathname) => pathname === "/clients";

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

/** The page for one client. Until scoped section views exist this is the client's detail page. */
export const clientHref = (id) => `/clients/${encodeURIComponent(id)}`;

// The Leads hub (/contacts) is retired. Leads live in Media Buyer's Dashboard, on its Leads tab.
// The hub's old address sends people there.

import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";

/** Every lead from the agency's ads: Media Buyer's Dashboard on its Leads tab. */
export const LEADS_HREF = "/media-buyer/table?view=leads";

// The names a link to the hub might have used for one client.
const CLIENT_KEYS = ["group", "client", "client_group", "clientGroup", "groups"];

/**
 * Where an old /contacts link goes. A single client and a known date range carry over;
 * the hub's other state (search, filters, page) lived in the page, never the address.
 * @param {Record<string, string|string[]>|URLSearchParams} [params]
 */
export function leadsHubRedirect(params = {}) {
  const get = (k) => {
    const v = typeof params.get === "function" ? params.get(k) : params[k];
    return (Array.isArray(v) ? v[0] : v) || "";
  };
  const client = CLIENT_KEYS.map(get).find((v) => v && v !== "all" && !v.includes(","));
  const next = new URLSearchParams();
  if (client) next.set("client", client);
  next.set("view", "leads");
  const range = get("range");
  if (range && range !== DEFAULT_DATE_PRESET && DATE_PRESETS.some((p) => p.value === range)) next.set("range", range);
  return `/media-buyer/table?${next.toString()}`;
}

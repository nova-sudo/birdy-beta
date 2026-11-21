// The Leads hub (/contacts) is retired. Leads live in Media Buyer's table, at its Leads level,
// and in each client's Leads table. Its old address sends people to the first.

import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";

/** Every lead from the agency's ads: Media Buyer's table at its Leads level. */
export const LEADS_HREF = "/media-buyer/table?level=leads";

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
  const next = new URLSearchParams(LEADS_HREF.split("?")[1]);
  const range = get("range");
  if (range && range !== DEFAULT_DATE_PRESET && DATE_PRESETS.some((p) => p.value === range)) next.set("range", range);
  const client = CLIENT_KEYS.map(get).find((v) => v && v !== "all" && !v.includes(","));
  if (client) next.set("group", client);
  return `${LEADS_HREF.split("?")[0]}?${next.toString()}`;
}

// The Leads hub's table lives on as Agency Ops' Dashboard tab. The hub's old address (/contacts)
// sends people there.

import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";

/** Every lead across the agency: Agency Ops' Dashboard tab, the Leads hub's table. */
export const LEADS_HREF = "/dashboard/table";

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
  const next = new URLSearchParams();
  const client = CLIENT_KEYS.map(get).find((v) => v && v !== "all" && !v.includes(","));
  if (client) next.set("client", client);
  const range = get("range");
  if (range && range !== DEFAULT_DATE_PRESET && DATE_PRESETS.some((p) => p.value === range)) next.set("range", range);
  const query = next.toString();
  return query ? `${LEADS_HREF}?${query}` : LEADS_HREF;
}

"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { apiRequest } from "@/lib/api";
import { AD_LEADS_LIMIT, adLeadRow, adLevelRows, callRows, leadRow } from "@/lib/client-tables";
import { presetToDateRange } from "@/lib/date-utils";

const LEADS_LIMIT = 500;
const CALLS_LIMIT = 500;
const json = async (url) => {
  const res = await apiRequest(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const range = (preset) => {
  const { start_date, end_date } = presetToDateRange(preset);
  return `${start_date ? `&start_date=${start_date}` : ""}${end_date ? `&end_date=${end_date}` : ""}`;
};
const OPTIONS = { revalidateOnFocus: false, keepPreviousData: true };

/**
 * The rows behind a client's Leads, Ads and Calls tables for one date range.
 * All three load together, so each tab can show its count before it is opened.
 *
 * The leads its ads brought in (the Ads table's Leads level) are asked for only while the Ads table is open.
 *
 * @param {object|null} client the client group, with its Meta data
 * @param {string} preset the date range
 * @param {{adLeads?: boolean}} [options] `adLeads` loads the Ads table's Leads level
 */
export function useClientTables(client, preset, { adLeads: wantAdLeads = false } = {}) {
  const id = client?.id;
  const leads = useSWR(id ? `/api/leads/unified?groups=${encodeURIComponent(id)}&page=1&limit=${LEADS_LIMIT}${range(preset)}` : null, json, OPTIONS);
  const rollup = useSWR(id ? `/api/campaigns/opp-rollup?groups=${encodeURIComponent(id)}${range(preset)}` : null, json, OPTIONS);
  const location = client?.ghl_location_id;
  const calls = useSWR(location ? `/api/hotprospector/call-center?location_id=${encodeURIComponent(location)}&skip=0&limit=${CALLS_LIMIT}${range(preset)}` : null, json, OPTIONS);

  // The same ad-attributed leads Media Buyer's agency table lists, for this client alone.
  const adLeads = useSWR(id && wantAdLeads ? `/api/facebook-leads/filtered?groups=${encodeURIComponent(id)}&limit=${AD_LEADS_LIMIT}${range(preset)}` : null, json, OPTIONS);

  // Every ad level carries the client's CPL limit, which the table marks rows against.
  const adLevels = useMemo(() => {
    const limit = Number(client?.targets?.cpl) > 0 ? Number(client.targets.cpl) : null;
    const of = (level) => adLevelRows(client, rollup.data, level).map((row) => ({ ...row, groupId: String(id ?? ""), adId: level === "ads" ? row.id : "", limit }));
    return { campaigns: of("campaigns"), adsets: of("adsets"), ads: of("ads") };
  }, [client, id, rollup.data]);
  const adLeadRows = useMemo(() => (adLeads.data?.leads ?? []).map(adLeadRow).filter((r) => r.groupId === String(id)), [adLeads.data, id]);

  const leadsTotal = leads.data?.meta?.total_contacts ?? null;
  return {
    leads: {
      rows: (leads.data?.contacts ?? []).map(leadRow),
      // The list is capped; the real total says how many are not shown.
      total: leadsTotal,
      loading: leads.isLoading,
      error: leads.error && !leads.data,
      retry: () => leads.mutate(),
    },
    ads: {
      // `rows` is the ads level, which the Ads tab counts; `levels` has all three.
      rows: adLevels.ads,
      levels: adLevels,
      // The ads themselves come with the client; only the CRM figures wait on a request.
      loading: false,
      error: false,
      retry: () => rollup.mutate(),
    },
    adLeads: {
      rows: adLeadRows,
      fetched: adLeads.data?.leads?.length ?? 0,
      loading: Boolean(id && wantAdLeads) && adLeads.isLoading,
      error: Boolean(adLeads.error) && !adLeads.data,
      retry: () => adLeads.mutate(),
    },
    calls: {
      rows: callRows(calls.data?.data),
      loading: Boolean(location) && calls.isLoading,
      error: calls.error && !calls.data,
      retry: () => calls.mutate(),
      // A client with no call centre has no calls to list, which is not the same as none this week.
      unavailable: !location,
    },
  };
}

"use client";

import useSWR from "swr";
import { apiRequest } from "@/lib/api";
import { adLevelRows, callRows, leadRow } from "@/lib/client-tables";
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
 * @param {object|null} client the client group, with its Meta data
 * @param {string} preset the date range
 */
export function useClientTables(client, preset) {
  const id = client?.id;
  const leads = useSWR(id ? `/api/leads/unified?groups=${encodeURIComponent(id)}&page=1&limit=${LEADS_LIMIT}${range(preset)}` : null, json, OPTIONS);
  const rollup = useSWR(id ? `/api/campaigns/opp-rollup?groups=${encodeURIComponent(id)}${range(preset)}` : null, json, OPTIONS);
  const location = client?.ghl_location_id;
  const calls = useSWR(location ? `/api/hotprospector/call-center?location_id=${encodeURIComponent(location)}&skip=0&limit=${CALLS_LIMIT}${range(preset)}` : null, json, OPTIONS);

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
      rows: adLevelRows(client, rollup.data, "ads"),
      levels: {
        campaigns: adLevelRows(client, rollup.data, "campaigns"),
        adsets: adLevelRows(client, rollup.data, "adsets"),
        ads: adLevelRows(client, rollup.data, "ads"),
      },
      // The ads themselves come with the client; only the CRM figures wait on a request.
      loading: false,
      error: false,
      retry: () => rollup.mutate(),
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

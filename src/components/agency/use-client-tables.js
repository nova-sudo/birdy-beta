"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { apiRequest } from "@/lib/api";
import { AD_LEADS_LIMIT, adLeadRow, adLevelRows, busiestPipeline, callRows, leadPipelines, leadRow } from "@/lib/client-tables";
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
 * Leads come a page at a time. The first page of all the client's leads is always asked for: its
 * `meta.pipelines` holds the CRM's stages with their counts, and its total counts the Leads tab, so
 * no stage needs every lead downloaded to be counted. A picked stage or a later page is a second
 * request the server narrows (`stage_id`), and only that one changes as stages are picked.
 *
 * The pipeline and stage asked for are checked against the CRM's: an unknown pipeline gives way to
 * the one with the most leads, and a stage outside it (or any stage, from a backend that sends no
 * pipelines) is not asked for.
 *
 * @param {{adLeads?: boolean, pipeline?: string|null, stage?: string|null, page?: number}} [options]
 *   `adLeads` loads the Ads table's Leads level; `pipeline`, `stage` and `page` pick the leads listed
 */
export function useClientTables(client, preset, { adLeads: wantAdLeads = false, pipeline: askedPipeline = null, stage: askedStage = null, page = 1 } = {}) {
  const id = client?.id;
  const leadsBase = id ? `/api/leads/unified?groups=${encodeURIComponent(id)}` : null;
  const leadsTail = `&limit=${LEADS_LIMIT}${range(preset)}`;
  const allLeads = useSWR(leadsBase ? `${leadsBase}&page=1${leadsTail}` : null, json, OPTIONS);
  const pipelines = useMemo(() => leadPipelines(allLeads.data?.meta), [allLeads.data]);
  const pipeline = pipelines.find((p) => p.id === askedPipeline) ?? busiestPipeline(pipelines);
  const stage = pipeline?.stages.find((st) => st.id === askedStage) ?? null;
  const stageId = stage?.id ?? null;
  const narrowed = Boolean(stageId) || page > 1;
  const pickedLeads = useSWR(
    leadsBase && narrowed ? `${leadsBase}&page=${page}${leadsTail}${stageId ? `&stage_id=${encodeURIComponent(stageId)}` : ""}` : null,
    json,
    OPTIONS,
  );
  const leads = narrowed ? pickedLeads : allLeads;
  const rollup = useSWR(id ? `/api/campaigns/opp-rollup?groups=${encodeURIComponent(id)}${range(preset)}` : null, json, OPTIONS);
  const location = client?.ghl_location_id;
  const calls = useSWR(location ? `/api/hotprospector/call-center?location_id=${encodeURIComponent(location)}&skip=0&limit=${CALLS_LIMIT}${range(preset)}` : null, json, OPTIONS);

  // The same ad-attributed leads Marketing Guru's agency table lists, for this client alone.
  const adLeads = useSWR(id && wantAdLeads ? `/api/facebook-leads/filtered?groups=${encodeURIComponent(id)}&limit=${AD_LEADS_LIMIT}${range(preset)}` : null, json, OPTIONS);

  // Every ad level carries the client's CPL limit, which the table marks rows against.
  const adLevels = useMemo(() => {
    const limit = Number(client?.targets?.cpl) > 0 ? Number(client.targets.cpl) : null;
    const of = (level) => adLevelRows(client, rollup.data, level).map((row) => ({ ...row, groupId: String(id ?? ""), adId: level === "ads" ? row.id : "", limit }));
    return { campaigns: of("campaigns"), adsets: of("adsets"), ads: of("ads") };
  }, [client, id, rollup.data]);
  const adLeadRows = useMemo(() => (adLeads.data?.leads ?? []).map(adLeadRow).filter((r) => r.groupId === String(id)), [adLeads.data, id]);

  const leadsTotal = leads.data?.meta?.total_contacts ?? null;
  const pipelineId = pipeline?.id ?? null;
  const leadRows = useMemo(() => (leads.data?.contacts ?? []).map((c) => leadRow(c, { stageId, pipelineId })), [leads.data, stageId, pipelineId]);
  return {
    leads: {
      rows: leadRows,
      // The list is capped; the real total says how many are not shown.
      total: leadsTotal,
      // Every lead the client has in this range, whichever stage is picked: the Leads tab's count and the All tab's.
      allTotal: allLeads.data?.meta?.total_contacts ?? null,
      // The CRM's pipelines with their stage counts; empty from an older backend or without a CRM.
      pipelines,
      // The pipeline and stage listed (null: no pipelines, or All).
      pipeline,
      stage,
      // Whether the first page has answered, so the table knows which stage tabs to draw.
      known: Boolean(allLeads.data),
      page,
      pages: Math.max(1, Number(leads.data?.meta?.total_pages) || 1),
      limit: LEADS_LIMIT,
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

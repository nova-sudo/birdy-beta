"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { percentDelta } from "@/lib/portfolio-aggregate";
import { PREVIOUS_PERIOD, subtractPeriods } from "@/lib/portfolio-series";
import { MAX_LEADS_TO_FETCH } from "@/constants";
import { buildSalesSeries, granularityForRange, SALES_CHART_METRICS } from "@/lib/saleshub-series";
import { buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight";

// ─── Sales Hub data ─────────────────────────────────────────────────────────
// Everything the redesigned screen plots, from endpoints that already existed.
//
// | Source                            | Feeds                                |
// |-----------------------------------|--------------------------------------|
// | client groups (passed in)         | the totals above the chart           |
// | /api/hotprospector/call-center    | the shape of all four series         |
//
// The split matters. Call stats on the client groups are aggregates the
// backend computed over the whole window, so they are exact; the row endpoint
// caps what it returns, so the rows are a *sample* of that window. Taking the
// magnitude from the first and the shape from the second is what keeps the
// curve and the figure above it agreeing — see scaleSeriesToTotal.
//
// Deltas need a second window. /api/client-groups only speaks in date presets,
// so a previous period has to be expressible as one: PREVIOUS_PERIOD maps the
// five that can be, and the rest render no pills at all rather than invented
// ones. Where only a longer window exists (last_7d against last_14d), the
// current one is subtracted out of it — every figure summed here is additive,
// so that subtraction is exact rather than an estimate.

/** Sums the windowed call stats across whichever clients are in scope. */
export function sumCallStats(clientGroups, selectedClientGroup) {
  const scoped =
    selectedClientGroup && selectedClientGroup !== "all"
      ? (clientGroups ?? []).filter((g) => g.id === selectedClientGroup)
      : (clientGroups ?? []);

  return scoped.reduce(
    (acc, g) => {
      const cs = g.hotprospector?.call_stats ?? {};
      return {
        called: acc.called + (cs.leads_with_calls ?? 0),
        calls: acc.calls + (cs.total_calls ?? 0),
        inbound: acc.inbound + (cs.inbound_count ?? 0),
        outbound: acc.outbound + (cs.outbound_count ?? 0),
        transfers: acc.transfers + (cs.transfers ?? 0),
        talk: acc.talk + (cs.total_talk_min ?? 0),
      };
    },
    { called: 0, calls: 0, inbound: 0, outbound: 0, transfers: 0, talk: 0 }
  );
}

/**
 * One row per client in scope, with the window's call figures.
 *
 * Clients with no calls in the window are dropped: the hub is a view of what
 * the dialler did, and a page of zero-rows buries the clients that did move.
 * The full pool (`total_leads`) is not windowed — HotProspector leads carry no
 * creation date, so call activity is the only windowable lead metric there is.
 */
export function buildClientRows(clientGroups, selectedClientGroup) {
  return (clientGroups ?? [])
    .filter((g) => selectedClientGroup === "all" || g.id === selectedClientGroup)
    .map((g) => {
      const cs = g.hotprospector?.call_stats ?? {};
      return {
        id: g.id,
        name: g.name || "Unnamed Client",
        ghl_location_id: g.ghl_location_id,
        total_leads: g.hotprospector?.metrics?.total_leads ?? 0,
        leads: cs.leads_with_calls ?? 0,
        total_calls: cs.total_calls ?? 0,
        inbound: cs.inbound_count ?? 0,
        outbound: cs.outbound_count ?? 0,
        transfers: cs.transfers ?? 0,
        talk_time: cs.total_talk_min ?? 0,
        original: g,
      };
    })
    .filter((r) => r.total_calls > 0);
}

/** Talk time reads as minutes everywhere on this screen, to one decimal. */
const formatTalk = (v) => (Math.round(v * 10) / 10).toLocaleString();
const formatCount = (v) => Math.round(v).toLocaleString();

const FORMAT = { calls: formatCount, called: formatCount, inbound: formatCount, talk: formatTalk };

/**
 * Render a figure the way its metric is read. Everything is a whole count
 * except talk time, which is minutes and keeps a decimal — the table has
 * always shown 251.7 rather than 252, and the tile above it should agree.
 */
export function formatTotal(key, value) {
  return (FORMAT[key] ?? formatCount)(value);
}

/**
 * @param {object[]} clientGroups
 * @param {string} datePreset the window every figure covers
 * @param {string} selectedClientGroup "all" or a client group id
 */
export function useSalesHubData({ clientGroups, groupsLoading, datePreset, selectedClientGroup }) {
  const [callRows, setCallRows] = useState(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [error, setError] = useState(null);

  // The scope and window this fetch was for, so a change to either invalidates
  // what we hold rather than showing one client's calls under another's name.
  const locationId = useMemo(() => {
    if (!selectedClientGroup || selectedClientGroup === "all") return null;
    return (clientGroups ?? []).find((g) => g.id === selectedClientGroup)?.ghl_location_id ?? null;
  }, [clientGroups, selectedClientGroup]);

  const fetchedFor = useRef(null);
  const fetchKey = `${datePreset}|${locationId ?? "all"}`;

  useEffect(() => {
    if (groupsLoading) return;
    if (fetchedFor.current === fetchKey) return;

    let cancelled = false;
    const controller = new AbortController();
    fetchedFor.current = fetchKey;
    setCallRows(null);

    (async () => {
      setSeriesLoading(true);
      setError(null);
      try {
        const { start_date, end_date } = presetToDateRange(datePreset);
        const params = new URLSearchParams({ skip: "0", limit: String(MAX_LEADS_TO_FETCH) });
        if (locationId) params.set("location_id", locationId);
        if (start_date) params.set("start_date", start_date);
        if (end_date) params.set("end_date", end_date);

        const res = await apiRequest(`/api/hotprospector/call-center?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`call-center → ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCallRows(data.data ?? []);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setCallRows([]);
          setError(err.message);
          // Let a later visit retry rather than caching the failure.
          fetchedFor.current = null;
        }
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchKey, groupsLoading, datePreset, locationId]);

  // ── Previous period, for the delta pills ────────────────────────────────
  const [previousGroups, setPreviousGroups] = useState(null);

  useEffect(() => {
    const comparison = PREVIOUS_PERIOD[datePreset];
    if (!comparison) {
      setPreviousGroups(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest(`/api/client-groups?date_preset=${comparison.preset}`);
        if (!res.ok) throw new Error(`client-groups ${comparison.preset} → ${res.status}`);
        const data = await res.json();
        if (!cancelled) setPreviousGroups(data.client_groups ?? []);
      } catch {
        // No comparison is a fine outcome — the pills just don't render.
        if (!cancelled) setPreviousGroups(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [datePreset]);

  const totals = useMemo(
    () => sumCallStats(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  );

  const previousTotals = useMemo(() => {
    if (!previousGroups) return null;
    const enclosing = sumCallStats(previousGroups, selectedClientGroup);
    const comparison = PREVIOUS_PERIOD[datePreset];
    return comparison?.subtractCurrent ? subtractPeriods(enclosing, totals) : enclosing;
  }, [previousGroups, selectedClientGroup, datePreset, totals]);

  // Every figure on this screen is a volume — more calls, more leads reached
  // and more talk time are all good news — so none of them inverts. The
  // Marketing Hub's CPL is the sibling screen's counter-example.
  const deltas = useMemo(() => {
    if (!previousTotals) return null;
    return Object.keys(totals).reduce((acc, key) => {
      const d = percentDelta(totals[key], previousTotals[key]);
      if (d) acc[key] = d;
      return acc;
    }, {});
  }, [totals, previousTotals]);

  const clientRows = useMemo(
    () => buildClientRows(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  );

  const insight = useMemo(
    () => buildSalesInsight(totals, clientRows, deltas),
    [totals, clientRows, deltas]
  );

  const chartMetrics = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    const granularity = granularityForRange(start_date, end_date);
    const capped = (callRows?.length ?? 0) >= MAX_LEADS_TO_FETCH;
    const series = buildSalesSeries(callRows, capped, totals, granularity);

    return SALES_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key];
      const format = FORMAT[metric.key];

      acc[metric.key] = {
        ...metric,
        ...s,
        ...(deltas?.[metric.key] ?? {}),
        total: format(totals[metric.key]),
        pointValues: s.values.map(format),
        estimateNote: "shape estimated from a sample of calls",
        // Distinguishes "not fetched yet" from "fetched and there were none".
        pending: callRows === null,
      };
      return acc;
    }, {});
  }, [callRows, totals, datePreset, deltas]);

  return {
    totals,
    deltas,
    hasComparison: previousTotals != null,
    clientRows,
    insight,
    insightPrompt: insightPrompt(insight),
    chartMetrics,
    metrics: SALES_CHART_METRICS,
    seriesLoading,
    error,
    hasCalls: totals.calls > 0,
  };
}

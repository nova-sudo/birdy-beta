"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useClientGroups } from "@/lib/useClientGroups";
import { useCurrency } from "@/hooks/useCurrency";
import { presetToDateRange } from "@/lib/date-utils";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import {
  aggregatePortfolio,
  attributionStats,
  buildCallInsights,
  buildFunnel,
  buildKpis,
  buildLeaderboards,
} from "@/lib/portfolio-aggregate";
import {
  PREVIOUS_PERIOD,
  bucketSeries,
  callTimestamps,
  scaleSeriesToTotal,
  subtractPeriods,
} from "@/lib/portfolio-series";
import { MAX_LEADS_TO_FETCH } from "@/constants/sales-hub-constants";

// ─── Where the figures come from ───────────────────────────────────────────
//
// Everything on this screen is real, from endpoints that already exist:
//
//   /api/client-groups?date_preset=      per-client Meta / GHL / HotProspector
//                                        caches → KPIs, leaderboards, funnel,
//                                        call insights
//   /api/client-groups?date_preset=<prev> the preceding period, for deltas
//   /api/facebook-leads/filtered         individual Meta leads with
//                                        created_time, ghl_matched and
//                                        ghl_opportunity_status → the trend
//                                        series and the funnel's attribution
//   /api/hotprospector/call-center       leads with nested call logs →
//                                        the calls series, fetched only when
//                                        that tab is opened
//   /api/dashboard/summary               Birdy suggestions and activity
//
// Two things the design asks for that no endpoint provides, and which are
// therefore absent rather than invented:
//
//   * A spend-over-time curve. Meta insights arrive pre-aggregated per date
//     preset — there is no daily breakdown anywhere in the payload — so spend
//     is a KPI here but not a chart metric. Unlocking it means asking Meta for
//     time_increment=1 on the backend, not more client-side arithmetic.
//   * A "Shows" funnel stage. GHL opportunity stats carry won/lost/open/
//     abandoned and nothing about attendance.
//
// The funnel takes its attribution from the lead rows rather than from
// portfolio totals, so each stage is genuinely a subset of the one above it.
// Those rows are capped at LEADS_FETCH_LIMIT, so they are read as a sample:
// rates off the sample, magnitude off the true lead total. See buildFunnel.
//
// Deltas appear only for presets whose previous period is expressible as
// another preset (see PREVIOUS_PERIOD). Elsewhere the pills are simply absent.

const LEADS_FETCH_LIMIT = 5000;

/** Lead rows that reached a won opportunity — the closes series. */
function isWon(lead) {
  return String(lead.ghl_opportunity_status ?? "").toLowerCase() === "won";
}

export function usePortfolioData({
  preset = DEFAULT_DATE_PRESET,
  granularity = "Daily",
  chartMetric = "leads",
} = {}) {
  // useClientGroups takes its argument as an *initial* value — it holds the
  // preset in its own state and expects callers to move it with setDatePreset.
  // Passing a new one on re-render does nothing, so the date range has to be
  // pushed in explicitly or the client groups stay on whatever was asked for
  // first while everything fetched here quietly moves on without them.
  const {
    clientGroups,
    loading: groupsLoading,
    error: groupsError,
    datePreset,
    setDatePreset,
  } = useClientGroups(preset);

  useEffect(() => {
    if (datePreset !== preset) setDatePreset(preset);
  }, [preset, datePreset, setDatePreset]);

  // The lead fetch keys off this rather than the array itself: which clients
  // are in the portfolio is what the request depends on, and an identity check
  // on the array would re-fire on any render that happened to rebuild it.
  const groupIds = useMemo(
    () => (clientGroups ?? []).map((g) => g.id).join(","),
    [clientGroups]
  );

  // One render sits between asking for a window and the fetch for it starting.
  // Without this the screen would show the old window's figures under the new
  // window's label — the one wrong state worse than a spinner.
  const presetSyncing = datePreset !== preset;

  const { currencySymbol } = useCurrency("GBP");

  const [previousGroups, setPreviousGroups] = useState(null);
  const [leads, setLeads] = useState([]);
  const [rail, setRail] = useState({
    suggestions: [],
    activity: [],
    activityCount: 0,
    wins: [],
  });
  const [seriesLoading, setSeriesLoading] = useState(true);
  // Call logs are only fetched once the Calls tab is opened — it is a second
  // heavyweight request, and most visits never look at it.
  const [callRows, setCallRows] = useState(null);
  const [callsLoading, setCallsLoading] = useState(false);
  const callsFetchedFor = useRef(null);

  const formatMoney = useCallback(
    (value, decimals = 0) =>
      `${currencySymbol}${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`,
    [currencySymbol]
  );

  // ── Previous period, for the delta pills ────────────────────────────────
  useEffect(() => {
    const comparison = PREVIOUS_PERIOD[preset];
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
  }, [preset]);

  // ── Lead rows, for the trend chart and its closes series ────────────────
  useEffect(() => {
    // Wait for the groups to match the requested window before fetching leads
    // for it — otherwise the series is built for one window and the group ids
    // come from another.
    if (groupsLoading || presetSyncing) return;
    if (!groupIds) {
      setLeads([]);
      setSeriesLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setSeriesLoading(true);
      try {
        const { start_date, end_date } = presetToDateRange(preset);
        const params = new URLSearchParams({ groups: groupIds, limit: String(LEADS_FETCH_LIMIT) });
        if (start_date) params.set("start_date", start_date);
        if (end_date) params.set("end_date", end_date);

        const res = await apiRequest(`/api/facebook-leads/filtered?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`facebook-leads → ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLeads(data.leads ?? []);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) setLeads([]);
      } finally {
        if (!cancelled) setSeriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [groupIds, groupsLoading, presetSyncing, preset]);

  // ── Call logs, for the calls series ─────────────────────────────────────
  useEffect(() => {
    if (chartMetric !== "calls") return;
    if (groupsLoading || presetSyncing) return;
    if (callsFetchedFor.current === preset) return;

    let cancelled = false;
    const controller = new AbortController();
    callsFetchedFor.current = preset;

    (async () => {
      setCallsLoading(true);
      try {
        const { start_date, end_date } = presetToDateRange(preset);
        const params = new URLSearchParams({ skip: "0", limit: String(MAX_LEADS_TO_FETCH) });
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
          // Let a later visit retry rather than caching the failure.
          callsFetchedFor.current = null;
        }
      } finally {
        if (!cancelled) setCallsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chartMetric, preset, groupsLoading, presetSyncing]);

  // A new window invalidates whatever calls we hold.
  useEffect(() => {
    if (callsFetchedFor.current !== preset) setCallRows(null);
  }, [preset]);

  // ── Suggestions and activity ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiRequest("/api/dashboard/summary");
        if (!res.ok) throw new Error(`dashboard/summary → ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setRail({
          suggestions: (data.suggestions ?? []).map((s) => ({
            id: s.id,
            severity: s.severity ?? "MEDIUM",
            client: s.client ?? "",
            title: s.title ?? "",
            why: s.description ?? s.why ?? "",
          })),
          activity: (data.activity ?? [])
            .filter((a) => a.kind !== "suggestion_created")
            .map((a) => ({
              id: a.id,
              action: a.title ?? a.action ?? "",
              client: a.client ?? "",
              // The feed distinguishes what Birdy did on standing approval from
              // what the user signed off; `actor` is where that lives.
              mode: a.actor === "birdy" ? "Auto-run" : "Approved",
              time: a.time ?? "",
            })),
          activityCount: (data.activity ?? []).length,
          // Client wins had no home outside the page this screen replaces, so
          // they move into the rail rather than disappearing with it.
          wins: (data.wins ?? []).map((w) => ({
            id: w.id,
            client: w.client ?? "",
            title: w.title ?? "",
            why: w.description ?? "",
          })),
        });
      } catch {
        if (!cancelled) {
          setRail({ suggestions: [], activity: [], activityCount: 0, wins: [] });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Shaping ─────────────────────────────────────────────────────────────

  const current = useMemo(() => aggregatePortfolio(clientGroups), [clientGroups]);

  const previous = useMemo(() => {
    if (!previousGroups) return null;
    const enclosing = aggregatePortfolio(previousGroups);
    const comparison = PREVIOUS_PERIOD[preset];
    return comparison?.subtractCurrent ? subtractPeriods(enclosing, current) : enclosing;
  }, [previousGroups, preset, current]);

  const chartMetrics = useMemo(() => {
    const leadsCapped = leads.length >= LEADS_FETCH_LIMIT;
    const wonLeads = leads.filter(isWon);

    // Both row endpoints cap what they return, so each series is a sample.
    // Scaling it onto the real total keeps the shape the sample showed while
    // making the magnitude agree with the figure printed directly above it.
    const leadSeries = scaleSeriesToTotal(
      bucketSeries(leads, (l) => l.created_time, granularity),
      current.leads,
      leadsCapped
    );
    const closeSeries = scaleSeriesToTotal(
      bucketSeries(wonLeads, (l) => l.created_time, granularity),
      current.closes,
      leadsCapped
    );

    const calls = callTimestamps(callRows);
    const callsCapped = (callRows?.length ?? 0) >= MAX_LEADS_TO_FETCH;
    const callSeries = scaleSeriesToTotal(
      bucketSeries(calls, (c) => c.at, granularity),
      current.totalCalls,
      callsCapped
    );

    return {
      leads: {
        tab: "Leads",
        title: "Total leads",
        subtitle: "Lead volume across the portfolio",
        total: Math.round(current.leads).toLocaleString(),
        ...leadSeries,
      },
      spend: {
        tab: "Ad spend",
        title: "Total ad spend",
        subtitle: "Combined Meta spend across the portfolio",
        total: formatMoney(current.spend),
        valuePrefix: currencySymbol,
        // Meta reports spend only as a total for the whole date range — there
        // is no daily breakdown in the payload and no endpoint that returns
        // one. The total is exact; the curve is the real spend spread across
        // the window in proportion to that day's leads, which assumes CPL held
        // steady. The card says so, because on a day of heavy spend and few
        // leads this line will understate and that is worth knowing.
        ...scaleSeriesToTotal({ ...leadSeries, estimated: false }, current.spend, true),
        estimateNote:
          "spread across days by lead share — Meta reports spend only as a range total",
      },
      calls: {
        tab: "Calls",
        title: "Total calls",
        subtitle: "Call volume across client call centres",
        total: Math.round(current.totalCalls).toLocaleString(),
        loading: callsLoading,
        // Distinguishes "not fetched yet" from "fetched and there were none".
        pending: callRows === null,
        ...callSeries,
      },
      closes: {
        tab: "Closes",
        title: "Total closes",
        subtitle: "Leads that reached a won opportunity",
        total: Math.round(current.closes).toLocaleString(),
        ...closeSeries,
      },
    };
  }, [
    leads,
    callRows,
    callsLoading,
    granularity,
    formatMoney,
    currencySymbol,
    current.leads,
    current.closes,
    current.totalCalls,
    current.spend,
  ]);

  // Attribution comes off the sampled lead rows; the funnel scales its rates
  // onto the true lead total so it shares an axis with the KPI strip.
  const attribution = useMemo(
    () => attributionStats(leads, LEADS_FETCH_LIMIT),
    [leads]
  );

  const dateRangeLabel = useMemo(
    () => DATE_PRESETS.find((p) => p.value === preset)?.label ?? preset,
    [preset]
  );

  return {
    clientCount: current.clientCount,
    dateRangeLabel,

    kpis: buildKpis(current, previous, formatMoney),
    callInsights: buildCallInsights(current),
    funnel: buildFunnel(current, previous, attribution),
    funnelEstimated: attribution.capped,
    leaderboards: buildLeaderboards(current, formatMoney),
    chartMetrics,

    ...rail,

    loading: groupsLoading || presetSyncing,
    seriesLoading: seriesLoading || presetSyncing,
    callsLoading,
    error: groupsError,
    hasClients: current.clientCount > 0,
    hasComparison: previous != null,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────
// The rail's two buttons act against the same endpoints the old homepage used,
// so a suggestion applied here and one applied there do the same thing.

export async function applySuggestionRequest(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}/apply`, { method: "POST" });
    if (!res.ok) return null;
    return await res.json().catch(() => ({ ok: true }));
  } catch {
    return null;
  }
}

export async function completeWinRequest(id) {
  try {
    const res = await apiRequest(`/api/dashboard/wins/${id}/complete`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function dismissSuggestionRequest(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

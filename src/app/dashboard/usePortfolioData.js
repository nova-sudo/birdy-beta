"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useClientGroups } from "@/lib/useClientGroups";
import { useCurrency } from "@/hooks/useCurrency";
import { presetToDateRange } from "@/lib/date-utils";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import {
  aggregatePortfolio,
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
//   /api/facebook-leads/series           per-day lead and close counts across
//                                        the whole range → the leads and
//                                        closes trend series
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
// The funnel is a cohort: every stage counts the contacts created inside the
// selected window, so Closes as a share of Leads is a real close rate. The
// backend derives it (ghl_funnel_cache) because doing it per request meant
// scanning ghl_contacts on every load. See buildFunnel.
//
// Deltas appear only for presets whose previous period is expressible as
// another preset (see PREVIOUS_PERIOD). Elsewhere the pills are simply absent.

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
    // The portfolio trend chart reads the daily series.
  } = useClientGroups(preset, { includeDaily: true });

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
  // One row per day: { date, leads, closes }. Counted in Mongo, so this is the
  // whole range rather than the newest 5,000 rows.
  const [leadDays, setLeadDays] = useState([]);
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
      setLeadDays([]);
      setSeriesLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setSeriesLoading(true);
      try {
        const { start_date, end_date } = presetToDateRange(preset);
        const params = new URLSearchParams({ groups: groupIds });
        if (start_date) params.set("start_date", start_date);
        if (end_date) params.set("end_date", end_date);

        const res = await apiRequest(`/api/facebook-leads/series?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`facebook-leads/series → ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLeadDays(data.series ?? []);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) setLeadDays([]);
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
    // Leads and closes are counted server-side across the whole range, so
    // there is no sample to scale — the days roll straight up into whichever
    // granularity is selected.
    const leadSeries = {
      ...bucketSeries(leadDays, (d) => d.date, granularity, (d) => d.leads),
      estimated: false,
    };
    const closeSeries = {
      ...bucketSeries(leadDays, (d) => d.date, granularity, (d) => d.closes),
      estimated: false,
    };

    // Measured per-day spend, summed across clients. The API serves the whole
    // retained window in one go, so the range is applied here rather than by
    // refetching whenever the preset changes.
    //
    // Falls back to nothing rather than to a derived shape: an absent curve
    // reads as "not cached yet", where a fabricated one reads as fact.
    const { start_date, end_date } = presetToDateRange(preset);
    const spendDays = (current.dailySpend ?? []).filter(
      (d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date)
    );
    const spendSeries = {
      ...bucketSeries(spendDays, (d) => d.date, granularity, (d) => d.spend),
      estimated: false,
    };

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
        // Measured, not inferred. This used to be the preset total spread
        // across days in proportion to that day's leads, which assumed CPL
        // held steady AND inherited every gap in lead capture: while lead
        // ingestion was running at 37%, the all-time curve drew £2,554 for a
        // day that actually cost £718. The backend now asks Meta for
        // time_increment=1 rows, so each day is what that day cost.
        ...spendSeries,
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
    leadDays,
    callRows,
    callsLoading,
    granularity,
    formatMoney,
    currencySymbol,
    current.leads,
    current.closes,
    current.totalCalls,
    current.spend,
    current.dailySpend,
    preset,
  ]);

  const dateRangeLabel = useMemo(
    () => DATE_PRESETS.find((p) => p.value === preset)?.label ?? preset,
    [preset]
  );

  return {
    clientCount: current.clientCount,
    dateRangeLabel,

    kpis: buildKpis(current, previous, formatMoney),
    callInsights: buildCallInsights(current),
    funnel: buildFunnel(current, previous),
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

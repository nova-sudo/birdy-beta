"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { PREVIOUS_PERIOD, bucketSeries, subtractPeriods } from "@/lib/portfolio-series";

// ─── Where the figures come from ───────────────────────────────────────────
//
// Everything on this screen is real, from endpoints that already exist:
//
//   /api/client-groups?date_preset=      per-client Meta / GHL / HotProspector
//                                        caches → KPIs, leaderboards, funnel,
//                                        call insights
//   /api/client-groups?date_preset=<prev> the preceding period, for deltas
//   /api/facebook-leads/filtered         lead rows with created_time →
//                                        the leads and closes series
//   /api/dashboard/summary               Birdy suggestions and activity
//
// Two things the design asks for that no endpoint provides, and which are
// therefore absent rather than invented:
//
//   * A spend-over-time curve. Meta insights arrive pre-aggregated per preset,
//     so spend is a KPI here but not a chart metric.
//   * A "Shows" funnel stage. GHL opportunity stats carry won/lost/open/
//     abandoned and nothing about attendance.
//
// Deltas appear only for presets whose previous period is expressible as
// another preset (see PREVIOUS_PERIOD). Elsewhere the pills are simply absent.

const LEADS_FETCH_LIMIT = 5000;

/** Lead rows that reached a won opportunity — the closes series. */
function isWon(lead) {
  return String(lead.ghl_opportunity_status ?? "").toLowerCase() === "won";
}

export function usePortfolioData({ preset = DEFAULT_DATE_PRESET, granularity = "Daily" } = {}) {
  const { clientGroups, loading: groupsLoading, error: groupsError } = useClientGroups(preset);
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
    if (groupsLoading) return;
    if (!clientGroups?.length) {
      setLeads([]);
      setSeriesLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setSeriesLoading(true);
      try {
        const groupIds = clientGroups.map((g) => g.id).join(",");
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
  }, [clientGroups, groupsLoading, preset]);

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
    const leadSeries = bucketSeries(leads, (l) => l.created_time, granularity);
    const wonLeads = leads.filter(isWon);
    const closeSeries = bucketSeries(wonLeads, (l) => l.created_time, granularity);

    return {
      leads: {
        tab: "Leads",
        title: "Total leads",
        subtitle: "Lead volume across the portfolio",
        total: Math.round(current.leads).toLocaleString(),
        ...leadSeries,
      },
      closes: {
        tab: "Closes",
        title: "Total closes",
        subtitle: "Leads that reached a won opportunity",
        total: Math.round(current.closes).toLocaleString(),
        ...closeSeries,
      },
    };
  }, [leads, granularity, current.leads, current.closes]);

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

    loading: groupsLoading,
    seriesLoading,
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { buildSalesSeries, granularityForRange, SALES_CHART_METRICS } from "@/lib/saleshub-series";
import { formatTotal } from "@/lib/saleshub-totals";

// ─── The trend chart's series ───────────────────────────────────────────────
// The one thing on this screen that cannot be read straight off the client
// groups. Their call stats are per-client aggregates for the whole window —
// exact, but with no time dimension in them — so there is nothing in them to
// plot. A curve has to be counted from the call logs themselves, which is what
// /api/hotprospector/call-center returns nested inside its lead rows.
//
// **It pages through the whole window, with no ceiling.** One page is not a
// sample of it: src/constants/sales-hub-constants.js records that this endpoint
// orders leads by lead *creation* date rather than call recency, so the first N
// rows are not N random leads — most of the newest-created ones may have no
// calls in the window at all. A single 2,000-row page against a window where
// 6,879 leads were called drew a curve off a biased third of the data.
//
// Every page is fetched, however many that is, so the series counts every call
// the window holds. Rows accumulate as pages land and the series rebuilds on
// each, so the chart fills in rather than waiting on the whole set, and the
// coverage note says how far through it is.
//
// Nothing is scaled and no previous period is fetched: the curve is a straight
// count, and there is no delta anywhere on this screen.

// A small first page so a curve appears quickly, then the rest at the largest
// page the endpoint serves. There is deliberately no ceiling on the number of
// pages: a partial count is what this screen was doing wrong, and a chart that
// silently stops at some round number is worse than a slow one, because nothing
// on it says which calls are missing.
const FIRST_BATCH = 500;
const BATCH = 2000;
const CONCURRENCY = 6;

export function useSalesHubSeries({ clientGroups, groupsLoading, datePreset, selectedClientGroup }) {
  const [callRows, setCallRows] = useState(null);
  const [expected, setExpected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const locationId = useMemo(() => {
    if (!selectedClientGroup || selectedClientGroup === "all") return null;
    return (clientGroups ?? []).find((g) => g.id === selectedClientGroup)?.ghl_location_id ?? null;
  }, [clientGroups, selectedClientGroup]);

  // The scope and window this fetch was for, so a change to either drops what
  // we hold rather than showing one client's calls under another's name.
  const fetchedFor = useRef(null);
  const fetchKey = `${datePreset}|${locationId ?? "all"}`;

  useEffect(() => {
    if (groupsLoading) return;
    if (fetchedFor.current === fetchKey) return;

    let cancelled = false;
    const controller = new AbortController();
    fetchedFor.current = fetchKey;
    setCallRows(null);
    setExpected(0);

    const { start_date, end_date } = presetToDateRange(datePreset);
    const base = {};
    if (locationId) base.location_id = locationId;
    if (start_date) base.start_date = start_date;
    if (end_date) base.end_date = end_date;

    const fetchBatch = async (skip, limit) => {
      const qs = new URLSearchParams({ ...base, skip: String(skip), limit: String(limit) });
      const res = await apiRequest(`/api/hotprospector/call-center?${qs}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`call-center → ${res.status}`);
      return res.json();
    };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // One small page first, so a curve appears quickly, then the rest
        // behind it. meta.total is how many leads the window actually holds.
        const first = await fetchBatch(0, FIRST_BATCH);
        if (cancelled) return;

        const firstRows = first.data ?? [];
        const total = first.meta?.total ?? firstRows.length;
        setCallRows(firstRows);
        setExpected(total);
        setLoading(false);

        const skips = [];
        for (let skip = firstRows.length; skip < total; skip += BATCH) skips.push(skip);

        if (skips.length === 0) return;

        setStreaming(true);
        try {
          for (let i = 0; i < skips.length; i += CONCURRENCY) {
            if (cancelled) return;
            const chunk = skips.slice(i, i + CONCURRENCY);
            const pages = await Promise.all(chunk.map((skip) => fetchBatch(skip, BATCH)));
            if (cancelled) return;
            const rows = pages.flatMap((p) => p.data ?? []);
            setCallRows((prev) => [...(prev ?? []), ...rows]);
          }
        } catch (err) {
          // A curve is already on screen by now, so a failed page leaves what
          // landed in place rather than wiping it — same call the Leads tab
          // makes for the same reason.
          if (err.name !== "AbortError" && !cancelled) setError(err.message);
        } finally {
          if (!cancelled) setStreaming(false);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setCallRows([]);
          setError(err.message);
          // Let a later visit retry rather than caching the failure.
          fetchedFor.current = null;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchKey, groupsLoading, datePreset, locationId]);

  const chartMetrics = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    const series = buildSalesSeries(callRows, granularityForRange(start_date, end_date));
    const have = callRows?.length ?? 0;
    // Pages still arriving: the curve is not yet the whole window, so it says
    // so rather than letting a partial count read as the period's total.
    const partial = have > 0 && expected > 0 && have < expected;

    return SALES_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key];
      const plotted = s.values.reduce((sum, v) => sum + v, 0);

      acc[metric.key] = {
        ...metric,
        ...s,
        // The sum of what was drawn, so the curve and the figure above it
        // always agree. Once every page has landed this is the window's real
        // count, and it matches the tile.
        total: formatTotal(metric.key, plotted),
        pointValues: s.values.map((v) => formatTotal(metric.key, v)),
        coverage: partial
          ? `counting ${have.toLocaleString()} of ${expected.toLocaleString()} leads so far`
          : null,
        // Distinguishes "not fetched yet" from "fetched and there were none".
        pending: callRows === null,
      };
      return acc;
    }, {});
  }, [callRows, expected, datePreset]);

  return { chartMetrics, metrics: SALES_CHART_METRICS, loading, streaming, error };
}

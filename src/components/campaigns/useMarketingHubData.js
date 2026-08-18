"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { bucketSeries, PREVIOUS_PERIOD } from "@/lib/portfolio-series";
import {
  aggregateCampaignRows,
  buildMarketingInsight,
  buildMarketingKpis,
  campaignRowsFromGroups,
  mergeDailySpend,
} from "@/lib/marketing-aggregate";

// ─── Where the Marketing Hub's figures come from ────────────────────────────
//
// The KPI tiles run on the same campaign rows the table beneath them draws. The
// page passes those in, so the client-group picker and the date preset filter
// every part of the screen at once, and the tiles can never disagree with the
// table.
//
// What this hook adds on top of those rows:
//
//   /api/client-groups?date_preset=<prev>   the preceding period, run back
//                                           through the same row builder, for
//                                           the delta pills
//   /api/facebook-leads/series              per-day lead counts across the
//                                           range, for the leads curve
//   group.facebook.daily_spend              measured per-day spend, already on
//                                           the payload the page holds
//
// The design asks for a fourth chart tab, Impressions. There is no per-day
// impression source anywhere in the API — Meta insights arrive pre-aggregated
// per preset, and the time_increment=1 rows the backend caches carry spend
// only. So Impressions is a KPI tile, where the figure is real, and not a chart
// metric. Inventing the curve would mean spreading the period total across days
// in proportion to leads, which assumes CPM held steady and inherits every gap
// in lead capture; that exact approach once drew £2,554 of spend for a day that
// cost £718. Adding `impressions` beside `spend` in the backend's daily rows is
// what unlocks the tab.
//
// Deltas appear only for presets whose previous period is expressible as
// another preset (see PREVIOUS_PERIOD): /api/client-groups speaks only in
// presets, so a previous period has to be one. today, last_7d, this_month,
// this_quarter and this_year have one; last_30d and maximum do not, and render
// with no pill at all rather than a zero.

/**
 * @param {object[]} clientGroups the current period's groups, from the page
 * @param {object[]} rows the page's campaign rows for this period
 * @param {string} datePreset
 * @param {string|null} selectedClientGroup group id, "all", or null
 * @param {string} granularity Daily | Weekly | Monthly
 * @param {string} currencySymbol
 */
export function useMarketingHubData({
  clientGroups,
  rows,
  datePreset,
  selectedClientGroup,
  granularity = "Daily",
  currencySymbol = "£",
}) {
  const [previousGroups, setPreviousGroups] = useState(null);
  const [leadDays, setLeadDays] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const groupIds = useMemo(
    () => (clientGroups ?? []).map((g) => g.id).join(","),
    [clientGroups]
  );

  const formatMoney = useCallback(
    (value, decimals = 0) =>
      `${currencySymbol}${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`,
    [currencySymbol]
  );

  // ── The preceding period, for the delta pills ───────────────────────────
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

  // ── Per-day lead counts, for the leads and CPL curves ───────────────────
  useEffect(() => {
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
        const { start_date, end_date } = presetToDateRange(datePreset);
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
  }, [groupIds, datePreset]);

  // ── Shaping ─────────────────────────────────────────────────────────────

  const current = useMemo(() => aggregateCampaignRows(rows), [rows]);

  const previous = useMemo(() => {
    if (!previousGroups) return null;
    const enclosing = aggregateCampaignRows(
      campaignRowsFromGroups(previousGroups, selectedClientGroup)
    );
    const comparison = PREVIOUS_PERIOD[datePreset];
    if (!comparison?.subtractCurrent) return enclosing;

    // The only expressible predecessor of "last 7 days" is "last 14 days", so
    // the previous week is that window minus this one. Every figure summed
    // here is additive, which makes the subtraction exact rather than an
    // estimate — but the rates have to be re-derived from the differences
    // rather than subtracted themselves.
    const spend = Math.max(enclosing.spend - current.spend, 0);
    const leads = Math.max(enclosing.leads - current.leads, 0);
    const impressions = Math.max(enclosing.impressions - current.impressions, 0);
    const clicks = Math.max(enclosing.clicks - current.clicks, 0);

    return {
      ...enclosing,
      spend,
      leads,
      impressions,
      clicks,
      reach: Math.max(enclosing.reach - current.reach, 0),
      // A campaign count is a population, not a flow — it doesn't subtract.
      activeCampaigns: enclosing.activeCampaigns,
      cpl: leads > 0 ? spend / leads : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    };
  }, [previousGroups, selectedClientGroup, datePreset, current]);

  const kpis = useMemo(
    () => buildMarketingKpis(current, previous, formatMoney),
    [current, previous, formatMoney]
  );

  const insight = useMemo(
    () => buildMarketingInsight(current, previous, rows, formatMoney),
    [current, previous, rows, formatMoney]
  );

  const chartMetrics = useMemo(() => {
    const { start_date, end_date } = presetToDateRange(datePreset);
    const inRange = (d) =>
      (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date);

    const spendDays = mergeDailySpend(clientGroups, selectedClientGroup).filter(inRange);
    const leadRows = (leadDays ?? []).filter(inRange);

    // CPL is only defined on days that have both a spend row and a lead count.
    // A day present in one series and missing from the other is a gap in a
    // cache, not a day that cost nothing or produced nothing, and dividing
    // across it would draw a reading that never happened.
    const leadsByDate = new Map(leadRows.map((d) => [d.date, Number(d.leads) || 0]));
    const cplDays = spendDays
      .filter((d) => leadsByDate.has(d.date))
      .map((d) => ({ date: d.date, spend: d.spend, leads: leadsByDate.get(d.date) }));

    // Bucketed over one array, so the two series share a bucket set and can be
    // divided index by index.
    const cplSpend = bucketSeries(cplDays, (d) => d.date, granularity, (d) => d.spend);
    const cplLeads = bucketSeries(cplDays, (d) => d.date, granularity, (d) => d.leads);

    return {
      spend: {
        tab: "Ad spend",
        title: "Total ad spend",
        subtitle: "Combined spend across all connected ad accounts",
        total: formatMoney(current.spend, 2),
        valuePrefix: currencySymbol,
        decimals: 2,
        ...bucketSeries(spendDays, (d) => d.date, granularity, (d) => d.spend),
      },
      leads: {
        tab: "Leads",
        title: "Total leads",
        subtitle: "Lead volume across all campaigns",
        total: Math.round(current.leads).toLocaleString(),
        ...bucketSeries(leadRows, (d) => d.date, granularity, (d) => Number(d.leads) || 0),
      },
      cpl: {
        tab: "CPL",
        title: "Average CPL",
        subtitle: "Blended cost per lead across all campaigns",
        total: current.leads > 0 ? formatMoney(current.cpl, 2) : "—",
        valuePrefix: currencySymbol,
        decimals: 2,
        values: cplSpend.values.map((spend, i) => {
          const leads = cplLeads.values[i];
          return leads > 0 ? spend / leads : 0;
        }),
        labels: cplSpend.labels,
        tooltipLabels: cplSpend.tooltipLabels,
      },
    };
  }, [
    clientGroups,
    selectedClientGroup,
    leadDays,
    datePreset,
    granularity,
    formatMoney,
    currencySymbol,
    current.spend,
    current.leads,
    current.cpl,
  ]);

  return {
    current,
    previous,
    kpis,
    insight,
    chartMetrics,
    seriesLoading,
    hasComparison: previous != null,
  };
}

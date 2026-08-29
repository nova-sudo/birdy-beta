"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { bucketSeries, PREVIOUS_PERIOD } from "@/lib/portfolio-series";
import {
  abbreviate,
  aggregateCampaignRows,
  aggregateGroupInsights,
  buildMarketingInsight,
  buildMarketingKpis,
  campaignRowsFromGroups,
  coverageNote,
  mergeDailyMetrics,
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
// The Impressions tab reads `impressions` off those same daily rows. Meta's
// time_increment=1 breakdown carries it alongside spend, so where the backend
// puts it on the cached row the curve is measured the same way the spend curve
// is. Where it doesn't, the tab renders its empty state rather than a line:
// absent reads as "not cached yet", where a fabricated one reads as fact.
//
// It is specifically *not* derived from the period total. Spreading 1.42M
// impressions across days in proportion to leads or spend would assume CPM held
// steady and would inherit every gap in lead capture — the same reasoning that
// once drew £2,554 of spend for a day that actually cost £718, which is why
// the spend curve is measured today rather than inferred.
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

  // Tiles read account-level totals; the table below them keeps the campaign
  // rows. The two differ because /{account}/campaigns omits deleted and
  // archived campaigns — the rows are the drill-down and may legitimately
  // account for less than the whole, but the headline must not.
  // `count` and `activeCampaigns` stay row-derived: they are genuinely
  // campaign-level facts, not account ones.
  const current = useMemo(() => {
    const fromRows = aggregateCampaignRows(rows);
    const fromAccount = aggregateGroupInsights(clientGroups, selectedClientGroup);
    if (!fromAccount) return fromRows;
    return {
      ...fromRows,
      ...fromAccount,
      cpl: fromAccount.leads > 0 ? fromAccount.spend / fromAccount.leads : 0,
      ctr:
        fromAccount.impressions > 0
          ? (fromAccount.clicks / fromAccount.impressions) * 100
          : 0,
    };
  }, [rows, clientGroups, selectedClientGroup]);

  const previous = useMemo(() => {
    if (!previousGroups) return null;
    // Must come from the same level as `current`, or the delta pills compare
    // an account-level figure against a campaign-summed one and report a
    // change that is really just the difference between two definitions.
    const rowTotals = aggregateCampaignRows(
      campaignRowsFromGroups(previousGroups, selectedClientGroup)
    );
    const accountTotals = aggregateGroupInsights(previousGroups, selectedClientGroup);
    const enclosing = accountTotals
      ? { ...rowTotals, ...accountTotals }
      : rowTotals;
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

    const spendDays = mergeDailyMetrics(clientGroups, selectedClientGroup).filter(inRange);
    const leadRows = (leadDays ?? []).filter(inRange);

    // Only the days whose cached row actually reported impressions. A day that
    // carried spend but no impression figure is a gap in the cache, not an ad
    // that served to nobody, so it is left out rather than plotted as zero.
    const impressionDays = spendDays.filter((d) => d.impressionDays > 0);

    // ── The impressions curve, in order of preference ────────────────────
    //
    // 1. Measured, when the cached daily rows carry `impressions`. Identical
    //    in kind to the spend curve.
    // 2. Otherwise the shape of daily spend, scaled so the buckets sum to the
    //    period's real impression total, and flagged `estimated` so the card
    //    prints a note under the headline figure saying the line is not
    //    counted. Impressions and spend move together within an account at a
    //    roughly steady CPM, which makes spend the closest honest proxy for
    //    *when* delivery happened — but only the total is a measurement, and
    //    the reader is told so rather than left to assume.
    //
    // The estimate is deliberately anchored to the real total: without that
    // the line would be spend wearing an impressions label. With it, the
    // magnitude is right and only the distribution is inferred.
    const impressionSeries = (() => {
      if (impressionDays.length) {
        return {
          ...bucketSeries(impressionDays, (d) => d.date, granularity, (d) => d.impressions),
          estimated: false,
        };
      }

      const shape = bucketSeries(spendDays, (d) => d.date, granularity, (d) => d.spend);
      const spendTotal = shape.values.reduce((sum, v) => sum + v, 0);
      if (!shape.values.length || spendTotal <= 0 || current.impressions <= 0) {
        return { values: [], labels: [], tooltipLabels: [], estimated: false };
      }

      const factor = current.impressions / spendTotal;
      return {
        ...shape,
        values: shape.values.map((v) => v * factor),
        estimated: true,
        estimateNote: "daily shape follows ad spend — Meta caches no impression breakdown",
      };
    })();

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

    // Each headline is the period total; each line is drawn from cached daily
    // rows that can cover less of the window (400-day retention, and today has
    // no row until the first refresh after midnight). Where they disagree, say
    // so on the card rather than letting the two numbers look contradictory.
    const spendSeries = bucketSeries(spendDays, (d) => d.date, granularity, (d) => d.spend);
    const leadSeries = bucketSeries(leadRows, (d) => d.date, granularity, (d) => Number(d.leads) || 0);
    const sum = (vs) => (vs ?? []).reduce((a, b) => a + b, 0);

    return {
      spend: {
        tab: "Ad spend",
        title: "Total ad spend",
        subtitle: "Combined spend across all connected ad accounts",
        total: formatMoney(current.spend, 2),
        valuePrefix: currencySymbol,
        decimals: 2,
        ...spendSeries,
        coverage: coverageNote(spendDays, sum(spendSeries.values), current.spend),
      },
      leads: {
        tab: "Leads",
        title: "Total leads",
        subtitle: "Lead volume across all campaigns",
        total: Math.round(current.leads).toLocaleString(),
        ...leadSeries,
        coverage: coverageNote(leadRows, sum(leadSeries.values), current.leads),
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
      impressions: {
        tab: "Impressions",
        title: "Impressions",
        subtitle: "Total impressions served",
        // The total is the period figure from the campaign rows, which is
        // always real, even on the windows where no day carried a breakdown.
        total: abbreviate(current.impressions),
        ...impressionSeries,
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
    current.impressions,
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

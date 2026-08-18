"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { PREVIOUS_PERIOD } from "@/lib/portfolio-series";
import {
  aggregateCampaignRows,
  buildMarketingKpis,
  campaignRowsFromGroups,
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
 * @param {string} currencySymbol
 */
export function useMarketingHubData({
  clientGroups,
  rows,
  datePreset,
  selectedClientGroup,
  currencySymbol = "£",
}) {
  const [previousGroups, setPreviousGroups] = useState(null);

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

  return {
    current,
    previous,
    kpis,
    hasComparison: previous != null,
  };
}

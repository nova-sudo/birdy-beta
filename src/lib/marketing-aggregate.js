// Turning Marketing Hub campaign rows into what the screen renders.
//
// Everything here is derived from the campaign rows the page already builds in
// MarketingContent — the same rows the table below draws. That is deliberate:
// the KPI tiles and the table are then guaranteed to agree, and the
// client-group picker filters both at once because it filters the rows they
// share.
//
// The one thing rows cannot supply is a previous period. That comes from a
// second /api/client-groups call at the preceding preset, run back through the
// same row builder — see useMarketingHubData.

import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./portfolio-metrics";
import { percentDelta } from "./portfolio-aggregate";

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sum a set of campaign/adset/ad rows into the figures the KPI tiles show.
 *
 * Rates are blended — total clicks over total impressions — not the mean of
 * each row's own rate. Those differ, and the mean is the wrong one: it weights
 * a campaign that served 200 impressions the same as one that served 200,000.
 */
export function aggregateCampaignRows(rows) {
  const list = rows ?? [];

  const totals = list.reduce(
    (acc, row) => {
      acc.spend += num(row.spend);
      acc.leads += num(row.results ?? row.leads);
      acc.impressions += num(row.impressions);
      acc.clicks += num(row.clicks);
      acc.reach += num(row.reach);
      if (String(row.status).toLowerCase() === "active") acc.activeCampaigns += 1;
      return acc;
    },
    { spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0, activeCampaigns: 0 }
  );

  return {
    ...totals,
    count: list.length,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
  };
}

/**
 * The campaign rows hiding inside a /api/client-groups payload.
 *
 * MarketingContent builds far richer rows than this — GHL attribution, tag
 * rollups, custom formula metrics — but none of that is needed to total a
 * period up. This is the narrow version, used for the *previous* period, where
 * the only question asked of it is "what did these figures come to?".
 *
 * Keeping it here rather than reusing the page's builder is what lets the
 * comparison run without a second round of opportunity and tag fetches.
 *
 * @param {object[]} groups client-group documents
 * @param {string} [groupId] restrict to one group, matching the page's picker
 */
export function campaignRowsFromGroups(groups, groupId) {
  const rows = [];

  for (const group of groups ?? []) {
    if (groupId && groupId !== "all" && group.id !== groupId) continue;

    for (const c of group.facebook?.campaigns ?? []) {
      const spend = num(c.spend);
      const results = num(c.results);
      rows.push({
        id: c.id,
        name: c.name,
        status: String(c.status ?? "inactive").toLowerCase(),
        spend,
        results,
        leads: results,
        impressions: num(c.impressions),
        clicks: num(c.clicks),
        reach: num(c.reach),
        cpl: results > 0 ? spend / results : 0,
      });
    }
  }

  return rows;
}

/**
 * One spend-per-day series across the selected groups.
 *
 * Measured, not inferred: the backend asks Meta for time_increment=1 rows and
 * caches them on the group as `daily_spend`. Days the cache has no row for are
 * absent rather than zero — a gap in the cache is not a day that cost nothing.
 */
export function mergeDailySpend(groups, groupId) {
  const byDate = new Map();

  for (const group of groups ?? []) {
    if (groupId && groupId !== "all" && group.id !== groupId) continue;
    for (const day of group.facebook?.daily_spend ?? []) {
      if (!day?.date) continue;
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + num(day.spend));
    }
  }

  return [...byDate.entries()]
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Compact 1.42M / 298k for figures too long to read in a 17px tile. */
export function abbreviate(value) {
  const n = num(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return Math.round(n).toLocaleString();
}

/**
 * The six KPI tiles, with deltas wherever a previous period exists.
 *
 * CTR moves in points, not percent: a rise from 3.6% to 3.9% is "▲ 0.3pts". A
 * percentage change of a percentage reads as though the rate itself were 8%.
 */
export function buildMarketingKpis(current, previous, formatMoney) {
  const prev = previous ?? null;
  const ctrDelta =
    prev && Number.isFinite(prev.ctr) && prev.ctr > 0
      ? (() => {
          const points = current.ctr - prev.ctr;
          if (Math.abs(points) < 0.05) return null;
          return {
            direction: points > 0 ? "up" : "down",
            delta: `${Math.abs(points).toFixed(1)}pts`,
            polarity: HIGHER_IS_BETTER,
          };
        })()
      : null;

  return [
    {
      key: "activeCampaigns",
      label: "Active campaigns",
      value: Math.round(current.activeCampaigns).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.activeCampaigns, prev?.activeCampaigns) ?? {}),
    },
    {
      key: "spend",
      label: "Total ad spend",
      value: formatMoney(current.spend, 2),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.spend, prev?.spend) ?? {}),
    },
    {
      key: "leads",
      label: "Total leads",
      value: Math.round(current.leads).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.leads, prev?.leads) ?? {}),
    },
    {
      key: "cpl",
      label: "Average CPL",
      value: current.leads > 0 ? formatMoney(current.cpl, 2) : "—",
      // Cheaper leads are better, so a rise here renders red with an up arrow.
      polarity: LOWER_IS_BETTER,
      ...(percentDelta(current.cpl, prev?.cpl, LOWER_IS_BETTER) ?? {}),
    },
    {
      key: "impressions",
      label: "Impressions",
      value: abbreviate(current.impressions),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.impressions, prev?.impressions) ?? {}),
    },
    {
      key: "ctr",
      label: "Average CTR",
      value: current.impressions > 0 ? `${current.ctr.toFixed(2)}%` : "—",
      polarity: HIGHER_IS_BETTER,
      ...(ctrDelta ?? {}),
    },
  ];
}

// The Sales Hub trend chart's four series, from each client's precomputed
// daily call series (`hotprospector.daily_calls`, written server-side by
// birdy-backend's hp_service._compute_daily_call_series). One row per day
// already carries every metric this chart plots:
//
//   Total calls   every call that day
//   Leads called  leads whose first-ever call fell on that day (a lifetime
//                 cohort count — see the backend docstring for the tradeoff
//                 that accepts: a lead first contacted before the selected
//                 window reads as zero even if called again inside it)
//   Inbound       the inbound subset of that day's calls
//   Talk time     minutes that day
//
// Because every metric is bucketed from the same row set, they share the same
// buckets by construction — a day with zero inbound calls still has a row, so
// no separate axis-alignment pass is needed the way it was when inbound was a
// filtered subset of raw call logs.
//
// This used to page /api/hotprospector/call-center to build the same shape
// client-side, fetching every lead's full call history on every load. See
// the Sales-Hub README for why that existed and what replaced it.

import { bucketSeries } from "./portfolio-series";

/**
 * Pick how finely to bucket a window.
 *
 * The design draws twelve monthly points, but it draws one fixed year — a real
 * window is whatever the user picked, and bucketing "today" by month would
 * plot a single point. There is no granularity control on this screen (the
 * design has none), so the window chooses for itself, aiming for a readable
 * number of points rather than a fixed one.
 *
 * @param {string|null} startDate yyyy-MM-dd, or null for all-time
 * @param {string|null} endDate
 */
export function granularityForRange(startDate, endDate) {
  // All-time spans years; anything finer than months is unreadable.
  if (!startDate) return "Monthly";

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const days = Math.max(1, Math.round((end - start) / 86_400_000));

  if (days <= 31) return "Daily";
  if (days <= 120) return "Weekly";
  return "Monthly";
}

/**
 * Build all four series for the window.
 *
 * @param {object[]} dailyRows [{date, calls, inbound, talk_min, called}, ...]
 * @param {string} granularity Daily | Weekly | Monthly
 */
export function buildSalesSeries(dailyRows, granularity) {
  const rows = dailyRows ?? [];
  const on = (weight) => bucketSeries(rows, (d) => d.date, granularity, weight);

  return {
    calls: on((d) => d.calls ?? 0),
    called: on((d) => d.called ?? 0),
    inbound: on((d) => d.inbound ?? 0),
    talk: on((d) => d.talk_min ?? 0),
  };
}

/** Title, subtitle and tab label for each metric, in the design's order. */
export const SALES_CHART_METRICS = [
  {
    key: "calls",
    tab: "Total calls",
    title: "Total calls",
    subtitle: "Call volume across your Hot Prospector clients",
  },
  {
    key: "called",
    tab: "Leads called",
    title: "Leads called",
    subtitle: "Leads contacted across the period",
  },
  {
    key: "inbound",
    tab: "Inbound",
    title: "Inbound calls",
    subtitle: "Calls received from leads",
  },
  {
    key: "talk",
    tab: "Talk time",
    title: "Total talk time",
    subtitle: "Minutes spent on the phone",
  },
];

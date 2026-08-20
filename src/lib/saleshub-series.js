// The Sales Hub trend chart's four series, derived from call-centre lead rows.
//
// `/api/hotprospector/call-center` returns leads with their call logs nested,
// and every metric on this chart is a different reading of the same logs — so
// all four come from one fetch rather than four. What differs is what each one
// counts and which timestamp it hangs the count on:
//
//   Total calls   every log, at its own call time
//   Leads called  each lead once, at its *first* call in the window
//   Inbound       the logs the lead placed, at their call time
//   Talk time     minutes, at the log's call time
//
// "Leads called" is the one worth reading twice. Counting a lead at every call
// would make it a second, quieter copy of Total calls; counting it at its first
// call is what makes it answer a different question — how far through the pool
// the dialler has got, rather than how hard it worked.

import { bucketSeries } from "./portfolio-series";

/** A log counts as outbound unless it says otherwise, matching the tables. */
const isOutbound = (log) => log.call_status === "outbound";

/**
 * Flatten lead rows to one entry per call log, carrying what the series need.
 * Logs without a usable timestamp are dropped — bucketSeries would skip them
 * anyway, and counting them into a total the curve can't place would put the
 * curve and its headline figure into disagreement.
 */
export function callLogEntries(leadRows) {
  return (leadRows ?? []).flatMap((lead) =>
    (lead.call_logs ?? [])
      .filter((log) => log.call_time_iso)
      .map((log) => ({
        at: log.call_time_iso,
        outbound: isOutbound(log),
        minutes: (Number(log.duration) || 0) / 60,
      }))
  );
}

/**
 * One entry per lead that was called, dated at its earliest call in the window.
 */
export function firstCallPerLead(leadRows) {
  return (leadRows ?? [])
    .map((lead) => {
      const times = (lead.call_logs ?? []).map((l) => l.call_time_iso).filter(Boolean);
      if (times.length === 0) return null;
      return { at: times.reduce((a, b) => (a < b ? a : b)) };
    })
    .filter(Boolean);
}

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
 * Put a metric's series onto another series' axis, filling gaps with zero.
 *
 * `bucketSeries` builds buckets from the data it is given, which is right for a
 * single series — a range with gaps plots the periods that exist rather than a
 * run of zeroes. Across four series it is wrong: inbound calls happen on fewer
 * days than calls do, so inbound would come back with fewer points and its own
 * dates, and switching tabs would silently redraw the x-axis under the reader.
 *
 * Every entry in all four series is a call log, so the Total calls axis is a
 * superset of the other three. Aligning to it means a day with no inbound calls
 * reads as a zero on the same axis, which is what it is.
 *
 * Buckets are matched on their tooltip label, which is the one thing
 * bucketSeries emits that is unique per bucket and not thinned for the axis.
 */
function alignTo(axis, series) {
  const byLabel = new Map(series.tooltipLabels.map((label, i) => [label, series.values[i]]));

  return {
    values: axis.tooltipLabels.map((label) => byLabel.get(label) ?? 0),
    labels: axis.labels,
    tooltipLabels: axis.tooltipLabels,
  };
}

/**
 * Build all four series for the window.
 *
 * Every value plotted is a straight count of the call logs that were fetched.
 * Nothing is scaled onto another figure or inferred — what the curve shows is
 * what the rows said. Where the fetch hit its row limit the series therefore
 * covers only the leads that came back, and the chart says so rather than
 * multiplying itself up to match a bigger number.
 *
 * @param {object[]} leadRows rows from /api/hotprospector/call-center
 * @param {string} granularity Daily | Weekly | Monthly
 */
export function buildSalesSeries(leadRows, granularity) {
  const logs = callLogEntries(leadRows);
  const inbound = logs.filter((l) => !l.outbound);

  // Every other series is aligned to this one — see alignTo.
  const axis = bucketSeries(logs, (l) => l.at, granularity);
  const on = (rows, getDate, weight) =>
    alignTo(axis, bucketSeries(rows, getDate, granularity, weight));

  return {
    calls: axis,
    called: on(firstCallPerLead(leadRows), (l) => l.at),
    inbound: on(inbound, (l) => l.at),
    talk: on(logs, (l) => l.at, (l) => l.minutes),
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

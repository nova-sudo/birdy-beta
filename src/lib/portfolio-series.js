// Building the trend chart's series from timestamped rows.
//
// There is no time-series endpoint. What there is: lead rows carrying
// `created_time`, and call rows carrying a call timestamp — both fetchable for
// an arbitrary date range. Bucketing those by day, week or month is a real
// series, which is why the chart's granularity control is worth keeping.
//
// Ad spend has no daily breakdown anywhere in the API — Meta insights arrive
// pre-aggregated per date preset — so spend is a KPI here but not a chart
// metric. Nothing on this screen invents a spend curve.

import { format, startOfMonth, startOfWeek } from "date-fns";

export const GRANULARITIES = ["Daily", "Weekly", "Monthly"];

const BUCKET = {
  Daily: {
    key: (d) => format(d, "yyyy-MM-dd"),
    label: (d) => format(d, "d MMM"),
    tooltip: (d) => format(d, "d MMM yyyy"),
  },
  Weekly: {
    key: (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    label: (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "d MMM"),
    tooltip: (d) => `Week of ${format(startOfWeek(d, { weekStartsOn: 1 }), "d MMM yyyy")}`,
  },
  Monthly: {
    key: (d) => format(startOfMonth(d), "yyyy-MM"),
    label: (d) => format(d, "MMM"),
    tooltip: (d) => format(d, "MMMM yyyy"),
  },
};

/** How many buckets we're willing to plot before the axis becomes a smear. */
export const MAX_BUCKETS = 31;

/**
 * Bucket timestamped rows into a series.
 *
 * Buckets come from the data rather than from a generated calendar, so a range
 * with gaps plots the periods that exist instead of a run of zeroes. Rows
 * without a usable timestamp are skipped rather than dropped into bucket zero.
 *
 * @param {object[]} rows
 * @param {(row) => string|Date|undefined} getDate
 * @param {string} granularity Daily | Weekly | Monthly
 * @param {(row) => number} [weight] defaults to counting rows
 */
export function bucketSeries(rows, getDate, granularity, weight = () => 1) {
  const bucket = BUCKET[granularity] ?? BUCKET.Daily;
  const totals = new Map();

  for (const row of rows ?? []) {
    const raw = getDate(row);
    if (!raw) continue;
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) continue;

    const key = bucket.key(date);
    const existing = totals.get(key);
    if (existing) existing.value += weight(row);
    else totals.set(key, { key, date, value: weight(row) });
  }

  const ordered = [...totals.values()].sort((a, b) => a.date - b.date);
  // Keep the most recent window when a range is too long to read.
  const kept = ordered.slice(-MAX_BUCKETS);

  return {
    values: kept.map((b) => b.value),
    labels: kept.map((b) => bucket.label(b.date)),
    tooltipLabels: kept.map((b) => bucket.tooltip(b.date)),
  };
}

/**
 * Flatten call-centre lead rows down to their individual call timestamps.
 *
 * `/api/hotprospector/call-center` returns leads with their call logs nested,
 * so a call series means walking into `call_logs` rather than counting rows.
 */
export function callTimestamps(leadRows) {
  return (leadRows ?? []).flatMap((lead) =>
    (lead.call_logs ?? [])
      .map((log) => log.call_time_iso)
      .filter(Boolean)
      .map((at) => ({ at }))
  );
}

/**
 * Put a sampled series onto the same axis as its real total.
 *
 * Both series on this chart come from row endpoints that cap what they return,
 * so a series built straight from them undercounts — and sits directly beneath
 * a headline figure that does not. Scaling every bucket by the same factor
 * keeps the shape the sample actually showed while making the magnitude agree
 * with the total above it.
 *
 * @param {{values: number[]}} series
 * @param {number} total the real, uncapped figure for the window
 * @param {boolean} capped whether the sample hit its limit
 */
export function scaleSeriesToTotal(series, total, capped) {
  const values = series?.values ?? [];
  const sampleTotal = values.reduce((sum, v) => sum + v, 0);

  if (!capped || sampleTotal <= 0 || !Number.isFinite(total) || total <= 0) {
    return { ...series, estimated: false };
  }

  const factor = total / sampleTotal;
  return { ...series, values: values.map((v) => v * factor), estimated: true };
}

/**
 * Which preset to fetch to get the period immediately before this one.
 *
 * `/api/client-groups` only speaks in presets, so a previous period has to be
 * expressible as one. Where the natural predecessor exists it's used directly;
 * where only a longer window exists, the previous period is that window minus
 * the current one — every figure this screen sums is additive, so the
 * subtraction is exact rather than an estimate.
 *
 * Presets absent from this table simply get no deltas, which is why StatTile
 * renders without a pill rather than with a zero.
 */
export const PREVIOUS_PERIOD = {
  today: { preset: "yesterday" },
  last_7d: { preset: "last_14d", subtractCurrent: true },
  this_month: { preset: "last_month" },
  this_quarter: { preset: "last_quarter" },
  this_year: { preset: "last_year" },
};

/** Subtracts the current period out of an enclosing one, figure by figure. */
export function subtractPeriods(enclosing, current) {
  if (!enclosing || !current) return null;

  const out = {};
  for (const key of Object.keys(enclosing)) {
    const a = enclosing[key];
    const b = current[key];
    if (typeof a === "number" && typeof b === "number") {
      // Caches refresh at different moments per integration, so an enclosing
      // window can briefly read lower than the one inside it.
      out[key] = Math.max(a - b, 0);
    }
  }

  out.cpl = out.leads > 0 ? out.spend / out.leads : 0;
  return out;
}

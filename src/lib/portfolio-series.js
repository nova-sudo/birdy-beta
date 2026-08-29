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
    // Carries the year: an all-time range spans several, and a run of bare
    // "Jan … Jan … Jan" reads as one repeated month rather than three.
    label: (d) => format(d, "MMM yy"),
    tooltip: (d) => format(d, "MMMM yyyy"),
  },
};

/**
 * How many axis labels we're willing to print before they smear together.
 *
 * This thins *labels*, not data. It used to be a cap on buckets — the series
 * kept the most recent 31 and dropped the rest, so Daily granularity drew a
 * 31-day window whatever date range you picked, and "all time" quietly meant
 * "the last month". Every bucket in the range is plotted now; only some of
 * them get their date printed underneath.
 */
export const MAX_LABELS = 12;

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
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a date the way the rest of this module reads it back: locally.
 *
 * `new Date("2026-08-01")` is specified to parse as UTC midnight, but every
 * bucket key below is formatted in local time. For anyone west of UTC those
 * disagree and the whole series shifts a day earlier — a US viewer saw
 * 2026-08-01 filed under 2026-07-31, and at Weekly/Monthly granularity the
 * first of a month landed in the previous month. The KPI tiles beside these
 * charts compare the same strings directly and never shifted, so tile and
 * chart disagreed at every window edge.
 *
 * Anything that is not a bare yyyy-mm-dd (a full timestamp, say) already
 * carries its own offset and is left to the standard parser.
 */
export function parseDayLocal(value) {
  if (value instanceof Date) return value;
  // Nullish has to be handled before falling through: `new Date(null)` is the
  // epoch, not an invalid date, so a missing date would silently bucket at
  // 1970 instead of being skipped.
  if (value === null || value === undefined || value === "") return new Date(NaN);
  const m = DAY_ONLY.exec(String(value));
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function bucketSeries(rows, getDate, granularity, weight = () => 1) {
  const bucket = BUCKET[granularity] ?? BUCKET.Daily;
  const totals = new Map();

  for (const row of rows ?? []) {
    const raw = getDate(row);
    if (!raw) continue;
    const date = raw instanceof Date ? raw : parseDayLocal(raw);
    if (Number.isNaN(date.getTime())) continue;

    const key = bucket.key(date);
    const existing = totals.get(key);
    if (existing) existing.value += weight(row);
    else totals.set(key, { key, date, value: weight(row) });
  }

  const ordered = [...totals.values()].sort((a, b) => a.date - b.date);

  // Print every nth date and blank the rest. The blanks keep their slot, so
  // each printed label still sits under the point it belongs to.
  const step = Math.ceil(ordered.length / MAX_LABELS) || 1;

  return {
    values: ordered.map((b) => b.value),
    labels: ordered.map((b, i) => (i % step === 0 ? bucket.label(b.date) : "")),
    // Tooltips stay complete — thinning is about the axis, not the data.
    tooltipLabels: ordered.map((b) => bucket.tooltip(b.date)),
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
/**
 * The comparable period before each preset — and only where one exists.
 *
 * `/api/client-groups` speaks only in preset names (it serves from
 * `facebook_cache.<preset>`), so a previous period has to be expressible as
 * another preset. For `today` and `last_7d` one is: yesterday is a whole day
 * against a whole day, and the seven days before last_7d are exactly
 * last_14d minus last_7d.
 *
 * For `this_month`, `this_quarter` and `this_year` none is. Pairing them with
 * `last_month` / `last_quarter` / `last_year` compares elapsed days against a
 * complete period: on the 23rd that is 23 days against 31, which rendered as
 * "Spend ▼ 46.8%" — a calendar artifact presented as a performance signal.
 * Measured: £14,295.77 against £26,896.29, when nothing had actually dropped.
 *
 * Those now carry no delta at all. It is the same rule the trend charts
 * already follow — an unknown movement is not a flat one, and it is certainly
 * not a 46.8% fall. A true month-over-month comparison needs a window the API
 * cannot currently express; that is the metric-resolver work, not a pairing
 * table.
 */
export const PREVIOUS_PERIOD = {
  today: { preset: "yesterday" },
  last_7d: { preset: "last_14d", subtractCurrent: true },
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

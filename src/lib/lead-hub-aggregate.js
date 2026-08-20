// Turning the Lead Hub's lead aggregates into what the screen renders.
//
// Everything here is pure. The figures come from `meta.stats` on
// /api/leads/unified — the same endpoint the table below runs — so the tiles
// and the rows cannot disagree about what a lead is, and the client-group
// picker filters both at once because it filters the query they share.
//
// The one thing a single call cannot supply is a previous period. That comes
// from a second call over the window `previousWindow` works out — see
// components/contacts/useLeadHubData.

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./portfolio-metrics";
import { percentDelta } from "./portfolio-aggregate";
import { presetToDateRange } from "./date-utils";

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmt = (d) => format(d, "yyyy-MM-dd");

/**
 * Presets that are a *prefix* of a calendar unit still running.
 *
 * Month-to-date on the 9th covers nine days, so its predecessor is the first
 * nine days of last month rather than the nine days immediately before it.
 * Comparing a part-month against the tail of the previous one would put a
 * quiet start of month beside a busy end of month and read the difference as
 * a change in performance.
 */
const OPENS_UNIT_BEFORE = {
  this_week_mon_today: (start) => subDays(startOfWeek(start, { weekStartsOn: 1 }), 7),
  this_month: (start) => startOfMonth(subMonths(start, 1)),
  this_quarter: (start) => startOfQuarter(subQuarters(start, 1)),
  this_year: (start) => startOfYear(subYears(start, 1)),
};

/** Presets that are a whole calendar unit, whose predecessor is the whole one before. */
const WHOLE_UNIT_BEFORE = {
  last_month: (start) => [startOfMonth(subMonths(start, 1)), endOfMonth(subMonths(start, 1))],
  last_quarter: (start) => [
    startOfQuarter(subQuarters(start, 1)),
    endOfQuarter(subQuarters(start, 1)),
  ],
  last_year: (start) => [startOfYear(subYears(start, 1)), endOfYear(subYears(start, 1))],
};

/**
 * The window this preset should be compared against.
 *
 * /api/leads/unified takes explicit dates rather than presets, so — unlike the
 * Portfolio Dashboard and the Marketing Hub, which can only compare presets
 * /api/client-groups happens to name — every dated preset here has an exact
 * predecessor and every tile can carry a pill.
 *
 * "Maximum" is the one exception: an all-time window has nothing before it, so
 * it renders with no pills at all rather than invented ones.
 *
 * @returns {{start_date: string, end_date: string} | null}
 */
export function previousWindow(preset) {
  const { start_date, end_date } = presetToDateRange(preset);
  if (!start_date || !end_date) return null;

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  // Inclusive span, so a single-day window has a span of 0 and lands on the
  // single day before it.
  const span = differenceInCalendarDays(end, start);

  const whole = WHOLE_UNIT_BEFORE[preset];
  if (whole) {
    const [s, e] = whole(start);
    return { start_date: fmt(s), end_date: fmt(e) };
  }

  const opens = OPENS_UNIT_BEFORE[preset];
  if (opens) {
    const prevStart = opens(start);
    return { start_date: fmt(prevStart), end_date: fmt(addDays(prevStart, span)) };
  }

  // Rolling windows — today, yesterday, last 7/14/30 days — compare against the
  // equal-length window ending the day before this one starts.
  const prevEnd = subDays(start, 1);
  return { start_date: fmt(subDays(prevEnd, span)), end_date: fmt(prevEnd) };
}

/**
 * `meta.stats` off /api/leads/unified, in the names this screen uses.
 *
 * Returns null for a missing payload rather than a row of zeroes: no data and
 * a period that genuinely produced nothing are different claims, and only one
 * of them should draw a delta pill.
 */
export function normaliseLeadStats(stats) {
  if (!stats) return null;

  return {
    leads: num(stats.lead_count),
    contacts: num(stats.contact_count),
    opportunities: num(stats.total_opportunities),
    open: num(stats.open),
    lost: num(stats.lost),
    // Already in percentage units on the wire — 2.6 means 2.6%.
    conversionRate: num(stats.conversion_rate),
  };
}

/**
 * A rate moves in points, not percent.
 *
 * A conversion rate going 3.0% → 2.6% has fallen 0.4pts. Reporting it as
 * -13.3% is arithmetically true and reads as though the rate itself were 13%.
 *
 * Unlike percentDelta this accepts a previous of zero, because 0% → 2.6% is a
 * real movement of 2.6 points rather than a division by nothing.
 */
export function pointsDelta(current, previous, polarity = HIGHER_IS_BETTER) {
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) return null;

  const points = current - previous;
  if (Math.abs(points) < 0.05) return null; // flat to one decimal — say nothing

  return {
    direction: points > 0 ? "up" : "down",
    delta: `${Math.abs(points).toFixed(1)}pts`,
    polarity,
  };
}

/**
 * The six KPI tiles, with deltas wherever a previous period exists.
 *
 * Two of them are inverted, and the design is explicit that they are coloured
 * by **meaning** rather than by arrow direction: lost leads rising is bad news
 * and renders red with an up arrow, and a conversion rate falling is bad news
 * and renders red with a down arrow. `polarity` is what carries that — get it
 * backwards and the tile says the opposite of what happened.
 *
 * @param {ReturnType<typeof normaliseLeadStats>} current
 * @param {ReturnType<typeof normaliseLeadStats>|null} previous
 */
export function buildLeadKpis(current, previous) {
  const now = current ?? { leads: 0, contacts: 0, opportunities: 0, open: 0, lost: 0, conversionRate: 0 };
  const prev = previous ?? null;
  const count = (n) => Math.round(n).toLocaleString();

  return [
    {
      key: "leads",
      label: "Total leads",
      value: count(now.leads),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(now.leads, prev?.leads) ?? {}),
    },
    {
      key: "contacts",
      label: "Total contacts",
      value: count(now.contacts),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(now.contacts, prev?.contacts) ?? {}),
    },
    {
      key: "opportunities",
      label: "Opportunities",
      value: count(now.opportunities),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(now.opportunities, prev?.opportunities) ?? {}),
    },
    {
      key: "open",
      label: "Open leads",
      value: count(now.open),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(now.open, prev?.open) ?? {}),
    },
    {
      key: "lost",
      label: "Lost leads",
      value: count(now.lost),
      // Fewer lost leads is better, so a rise renders red with an up arrow.
      polarity: LOWER_IS_BETTER,
      ...(percentDelta(now.lost, prev?.lost, LOWER_IS_BETTER) ?? {}),
    },
    {
      key: "conversionRate",
      label: "Conversion rate",
      value: `${now.conversionRate.toFixed(1)}%`,
      polarity: HIGHER_IS_BETTER,
      ...(pointsDelta(now.conversionRate, prev?.conversionRate) ?? {}),
    },
  ];
}

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
 * How many rows the chart asks for to draw its curves.
 *
 * There is no per-day endpoint for GHL contacts, so the shape of every series
 * on this screen is bucketed from rows. Windows longer than this return a
 * sample, and `scaleSeriesToTotal` puts that sample's shape onto the real
 * total from meta.stats — see the hook for what that does and does not fix.
 */
export const LEAD_SERIES_LIMIT = 2000;

/**
 * How finely to slice the selected window.
 *
 * The Portfolio Dashboard makes this a control because its window and its
 * granularity are separate questions there. Here the header already carries
 * two chips and the handoff draws no third, so the window picks its own: a
 * week of daily points is a curve, a year of them is a smear.
 */
export function granularityFor(preset) {
  if (preset === "this_quarter" || preset === "last_quarter") return "Weekly";
  if (preset === "this_year" || preset === "last_year" || preset === "maximum") return "Monthly";
  return "Daily";
}

/**
 * Lead or contact?
 *
 * This is the core distinction on the screen: a *lead* submitted a form and
 * carries an email, tags, an opportunity status and a value, while a *contact*
 * was captured some other way — usually an inbound call — and often carries
 * none of them. The backend classifies on first-touch attribution
 * (services/contact_classifier.py); this only reads the answer, from whichever
 * of the two field names the row happens to use.
 */
export function isLeadRow(row) {
  return String(row?.contactType ?? row?.type ?? "").toLowerCase() === "lead";
}

/**
 * A row's opportunity stage, or null where it has no opportunity at all.
 *
 * Contacts have no status, and the design renders that as an explicit em dash
 * rather than as a blank or a zero-th stage.
 */
export function rowStatus(row) {
  const status = row?.opportunities?.[0]?.status ?? row?.opportunityStatus;
  return status ? String(status).toLowerCase() : null;
}

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
 * Does this row carry an address anyone could actually reach?
 *
 * GHL fills a synthetic `no_email_…` address where a contact arrived without
 * one, so an absent email and a placeholder email are the same thing — a
 * record nobody can email. The table's Email column already treats them alike.
 */
export function hasEmail(row) {
  const email = row?.email;
  return Boolean(email) && !String(email).startsWith("no_email_");
}

/**
 * How many unreachable records a group needs before it is worth naming.
 *
 * Below this the sentence would be pointing at ordinary noise, and an insight
 * that cries wolf on a healthy account stops being read at all.
 */
export const LEAD_POOL_FLOOR = 10;

/**
 * The client group leaking the most reachable records, and how many.
 *
 * A record with no email can be called but not emailed, which makes it the
 * cheapest untouched pool an agency has — and it is nearly always one client's
 * form dropping the field rather than a spread across all of them, which is
 * what makes naming the group actionable rather than a statistic.
 *
 * @returns {{group: string, count: number} | null}
 */
export function largestUnreachablePool(rows, floor = LEAD_POOL_FLOOR) {
  const byGroup = new Map();

  for (const row of rows ?? []) {
    if (hasEmail(row)) continue;
    const group = row?.groupName;
    if (!group) continue;
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
  }

  const [group, count] = [...byGroup.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!group || count < floor) return null;

  return { group, count };
}

/**
 * The Birdy Insights copy for this period.
 *
 * The handoff asks for two sentences generated from the data: the headline
 * movement, then the single most actionable anomaly with its numbers. Both come
 * from figures already on the screen — no extra endpoint, and nothing asserted
 * that the rows don't say.
 *
 * Returns null when there is nothing worth claiming, so the card can render a
 * plain waiting state rather than a sentence with holes in it.
 *
 * Segments are pre-split rather than a string because the figures and client
 * names inside the sentence are emphasised; building that from markup here
 * would mean the copy carried its own styling.
 *
 * @param {ReturnType<typeof normaliseLeadStats>} current
 * @param {ReturnType<typeof normaliseLeadStats>|null} previous
 * @param {object[]} rows the sampled rows the chart is bucketed from
 * @param {boolean} sampled whether those rows hit their limit
 * @returns {{segments: {text: string, strong?: boolean}[]} | null}
 */
export function buildLeadInsight(current, previous, rows, sampled = false) {
  if (!current || current.leads + current.contacts <= 0) return null;

  const segments = [];
  const say = (text) => segments.push({ text });
  const emphasise = (text) => segments.push({ text, strong: true });

  // ── Sentence one: the headline movement ────────────────────────────────
  const leadMove = percentDelta(current.leads, previous?.leads);
  const rate = `${current.conversionRate.toFixed(1)}%`;
  const rateMove = pointsDelta(current.conversionRate, previous?.conversionRate);

  if (leadMove) {
    say("Lead volume is ");
    say(leadMove.direction === "up" ? "up " : "down ");
    emphasise(leadMove.delta);
    if (rateMove) {
      // The interesting period is the one where the two disagree — volume
      // rising while the rate falls is the whole reason both are on the card.
      const agrees = (leadMove.direction === "up") === (rateMove.direction === "up");
      say(agrees ? " and conversion has " : " but conversion has ");
      say(rateMove.direction === "up" ? "risen to " : "fallen to ");
      emphasise(rate);
      say(". ");
    } else {
      say(" at ");
      emphasise(rate);
      say(" conversion. ");
    }
  } else {
    // No comparable previous period — state the position rather than a move.
    say("You're at ");
    emphasise(Math.round(current.leads).toLocaleString());
    say(" leads and ");
    emphasise(Math.round(current.contacts).toLocaleString());
    say(" contacts this period, converting at ");
    emphasise(rate);
    say(". ");
  }

  // ── Sentence two: the largest pool nobody can email ─────────────────────
  const pool = largestUnreachablePool(rows);
  if (!pool) {
    say("Every client group is capturing an email on nearly all of its records — nothing is going unreachable right now.");
    return { segments };
  }

  emphasise(pool.group);
  // The count comes from a sample on long windows, so it is a floor rather
  // than a total. Saying "at least" is what keeps it a fact.
  say(sampled ? " has at least " : " has ");
  emphasise(pool.count.toLocaleString());
  say(" records with no email captured — fixing that form would unlock your largest untouched pool.");

  return { segments };
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

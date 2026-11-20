// What Media Buyer's and Sales Coach's Bird's Eye show, worked out from the
// client groups the app already loads. No React here: plain figures in,
// what to draw out. Agency Ops' own Bird's Eye is in ./birds-eye.js.
//
// Media Buyer reads only the ads side (Meta spend, leads, cost per lead and
// each client's limit); Sales Coach reads only the call side (the CRM funnel's
// called step, and each client's per-day call series from Hot Prospector).

import { change, comparisonLabel, previousValues, previousWindow } from "./birds-eye";
import { groupHasCallCentre } from "./call-centre-availability";
import { activeGroups } from "./client-status";
import { presetToDateRange } from "./date-utils";
import { aggregatePortfolio, groupMetrics } from "./portfolio-aggregate";
import { PREVIOUS_PERIOD, bucketSeries, subtractPeriods } from "./portfolio-series";
import { mergeDailyCalls } from "./saleshub-totals";

const whole = (n) => Math.round(n).toLocaleString("en-GB");
const percent = (part, all) => (all > 0 ? (part / all) * 100 : null);

// ── Media Buyer ─────────────────────────────────────────────────────────────

/**
 * Where a client's cost per lead sits against the limit set for it.
 * @returns {"under"|"over"|"nolimit"|"none"} "none": no leads (or no spend) to price
 */
export function cplStanding(cpl, limit) {
  if (cpl == null || !(cpl > 0)) return "none";
  if (!(limit > 0)) return "nolimit";
  return cpl > limit ? "over" : "under";
}

/** One row per active client: what its ads spent and brought in, and how that sits against its limit. */
export function buyerClientRows(groups) {
  return activeGroups(groups).map((g) => {
    const m = groupMetrics(g);
    const cpl = m.leads > 0 && m.spend > 0 ? m.spend / m.leads : null;
    const limit = Number(g.targets?.cpl) > 0 ? Number(g.targets.cpl) : null;
    return { id: g.id, name: m.name, spend: m.spend, leads: m.leads, closes: m.closes, cpl, limit, standing: cplStanding(cpl, limit) };
  });
}

/**
 * Media Buyer's tiles for the agency: Spend, Leads, CPL. The CPL tile says how many clients are over their own limit.
 * @returns {{key, label, value, kind, delta, goodWhen, note, noteTone}[]}
 */
export function buyerTiles({ current, previous, preset, rows }) {
  const vs = comparisonLabel(preset);
  const prev = previous ?? {};
  const limited = rows.filter((r) => r.limit != null && r.standing !== "none");
  const over = limited.filter((r) => r.standing === "over").length;
  return [
    { key: "spend", label: "Spend", value: current.spend, kind: "money", delta: change(current.spend, prev.spend), goodWhen: "neither", note: vs },
    { key: "leads", label: "Leads", value: current.leads, kind: "count", delta: change(current.leads, prev.leads), goodWhen: "up", note: vs },
    {
      key: "cpl", label: "CPL", value: current.leads > 0 ? current.cpl : null, kind: "money2",
      delta: change(current.cpl, prev.cpl), goodWhen: "down",
      note: limited.length ? `${over} of ${limited.length} client${limited.length === 1 ? "" : "s"} over their limit` : vs,
      noteTone: over > 0 ? "bad" : undefined,
    },
  ];
}

/** Which series Media Buyer's chart switches between. Inside a client it adds Closed, as Agency Ops does. */
export const buyerChartKeys = (scoped) => (scoped ? ["leads", "spend", "cpl", "closes"] : ["leads", "spend", "cpl"]);

/** The bands of the "Clients by cost per lead" card, in the order they are drawn. */
export const CPL_BANDS = [
  { key: "under", label: "Under their limit", tone: "success" },
  { key: "over", label: "Over their limit", tone: "danger" },
  { key: "nolimit", label: "No limit set", tone: "accent" },
  { key: "none", label: "No leads in this range", tone: "neutral" },
];

/** How many clients fall in each band. */
export function cplBands(rows) {
  return CPL_BANDS.map((b) => ({ ...b, count: rows.filter((r) => r.standing === b.key).length }));
}

/**
 * Each client's figures for the comparison period, by id. Last 7 days compares
 * with the 7 before (the last 14 less this week), Today with yesterday; other
 * ranges have no comparison and give an empty map.
 */
export function previousByClient(previousGroups, groups, preset) {
  const out = new Map();
  const comparison = PREVIOUS_PERIOD[preset];
  if (!comparison || !previousGroups) return out;
  const now = new Map(activeGroups(groups).map((g) => [g.id, g]));
  for (const g of activeGroups(previousGroups)) {
    const before = aggregatePortfolio([g]);
    const current = now.get(g.id);
    out.set(g.id, comparison.subtractCurrent ? (current ? subtractPeriods(before, aggregatePortfolio([current])) : null) : before);
  }
  return out;
}

/**
 * Each client's cost per lead against the period before, the biggest rise first.
 * Only clients with leads in both periods are compared.
 * @returns {{id, name, meta, value, bar, tone, pct}[]}
 */
export function cplChanges(rows, previousById, { limit = 6, money = (n) => String(n) } = {}) {
  const moved = rows
    .map((r) => {
      const before = previousById.get(r.id);
      const pct = r.cpl != null && before?.leads > 0 ? change(r.cpl, before.spend / before.leads) : null;
      return pct == null ? null : { ...r, pct, before: before.spend / before.leads };
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
  const most = Math.max(0, ...moved.map((r) => Math.abs(r.pct)));
  return moved.map((r) => ({
    id: r.id,
    name: r.name,
    meta: `${money(r.before, 2)} to ${money(r.cpl, 2)} a lead`,
    value: `${r.pct > 0 ? "+" : r.pct < 0 ? "-" : ""}${Math.abs(Math.round(r.pct))}%`,
    bar: most > 0 ? (Math.abs(r.pct) / most) * 100 : 0,
    tone: r.pct > 0 ? "danger" : "accent",
    pct: r.pct,
  }));
}

/**
 * Clients by cost per lead, cheapest first: the fallback when there is no period to compare with.
 * @returns {{id, name, meta, value, bar, tone}[]}
 */
export function cheapestClients(rows, { limit = 6, money = (n) => String(n) } = {}) {
  const priced = rows.filter((r) => r.cpl != null).sort((a, b) => a.cpl - b.cpl).slice(0, limit);
  const dearest = Math.max(0, ...priced.map((r) => r.cpl));
  return priced.map((r) => ({
    id: r.id,
    name: r.name,
    meta: `${money(r.spend, 2)} spend · ${whole(r.leads)} lead${Math.round(r.leads) === 1 ? "" : "s"}`,
    value: money(r.cpl, 2),
    bar: dearest > 0 ? (r.cpl / dearest) * 100 : 0,
    tone: r.standing === "over" ? "danger" : "accent",
  }));
}

// ── Sales Coach ─────────────────────────────────────────────────────────────

/** The active clients that have a call centre: the only ones Sales Coach has anything to say about. */
export const callCentreGroups = (groups) => activeGroups(groups).filter(groupHasCallCentre);

/** Sums a run of daily call rows. */
const sumDays = (days) => days.reduce((acc, d) => ({ calls: acc.calls + (d.calls ?? 0), talk: acc.talk + (d.talk_min ?? 0), called: acc.called + (d.called ?? 0) }), { calls: 0, talk: 0, called: 0 });

/**
 * Calls made, minutes talked and leads called for the first time, in the range and in the window before it,
 * from each client's per-day call series (`hotprospector.daily_calls`).
 */
export function callTotals(groups, preset) {
  const days = mergeDailyCalls(callCentreGroups(groups), "all");
  const { start_date, end_date } = presetToDateRange(preset);
  const inside = days.filter((d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date));
  const before = previousWindow(start_date, end_date);
  const earlier = before ? days.filter((d) => d.date >= before.start && d.date <= before.end) : null;
  return { ...sumDays(inside), previous: earlier && earlier.length ? sumDays(earlier) : null, days };
}

/**
 * Sales Coach's four tiles: New in CRM, Leads called (with the share reached), Calls made, Closed.
 * "New in CRM" and "Leads called" are the CRM funnel's cohort for the range; calls come from the dialler's own days.
 */
export function coachTiles({ current, previous, preset, calls }) {
  const vs = comparisonLabel(preset);
  const prev = previous ?? {};
  const ready = current.funnelCached > 0;
  const reached = ready ? percent(current.funnelCalled, current.funnelInCrm) : null;
  const callsBefore = vs ? calls.previous?.calls : null;
  return [
    {
      key: "crm", label: "New in CRM", value: ready ? current.funnelInCrm : null, kind: "count",
      delta: ready && prev.funnelCached ? change(current.funnelInCrm, prev.funnelInCrm) : null, goodWhen: "up",
      note: ready ? `of ${whole(current.funnelLeads)} Meta leads` : "Not ready for this range",
    },
    {
      key: "called", label: "Leads called", value: ready ? current.funnelCalled : null, kind: "count",
      delta: ready && prev.funnelCached ? change(current.funnelCalled, prev.funnelCalled) : null, goodWhen: "up",
      note: reached == null ? (ready ? "None new to call" : "Not ready for this range") : `${Math.round(reached)}% of new leads reached`,
      noteTone: reached != null && reached < 50 ? "bad" : undefined,
    },
    {
      key: "calls", label: "Calls made", value: calls.calls, kind: "count",
      delta: callsBefore > 0 ? change(calls.calls, callsBefore) : null, goodWhen: "up",
      note: `${whole(calls.talk)} min on the phone`,
    },
    {
      key: "closes", label: "Closed", value: current.closes, kind: "count", delta: change(current.closes, prev.closes), goodWhen: "up",
      note: Number.isFinite(prev.closes) && prev.closes > 0 && Math.round(prev.closes) !== Math.round(current.closes) ? `${current.closes < prev.closes ? "down" : "up"} from ${whole(prev.closes)}` : vs,
    },
  ];
}

/** Which series Sales Coach's chart switches between, and their wording. */
export const COACH_CHART_KEYS = ["calls", "called", "talk", "closes"];
export const COACH_CHART_COPY = {
  calls: { tab: "Calls", title: "Calls per day", kind: "count" },
  called: { tab: "Leads called", title: "Leads called for the first time, per day", kind: "count" },
  talk: { tab: "Talk time", title: "Minutes on the phone per day", kind: "minutes" },
  closes: { tab: "Closed", title: "Closed per day", kind: "count" },
};

/**
 * The call series for the chart, one point per day of the range, each with the matching day of the window before.
 * @param {{date: string, calls: number, called: number, talk_min: number}[]} days every day the dialler has, merged across clients
 * @returns {Record<"calls"|"called"|"talk", {values, labels, tooltipLabels, previousValues, sum}>}
 */
export function callSeries(days, preset) {
  const { start_date, end_date } = presetToDateRange(preset);
  const inside = (days ?? []).filter((d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date));
  const before = previousWindow(start_date, end_date);
  const dates = [...new Set(inside.map((d) => d.date))].sort();
  const build = (valueOf) => {
    const series = bucketSeries(inside, (d) => d.date, "Daily", valueOf);
    return {
      ...series,
      previousValues: before ? previousValues(dates, days, before.days, valueOf) : null,
      sum: series.values.reduce((a, b) => a + b, 0),
    };
  };
  return { calls: build((d) => d.calls ?? 0), called: build((d) => d.called ?? 0), talk: build((d) => d.talk_min ?? 0) };
}

/**
 * One row per client with a call centre: its new leads in the CRM, how many got a call, what the dialler did and what closed.
 * `behind` names what is wrong when under half of its new leads got a call, or none of its leads reached the CRM.
 */
export function coachClientRows(groups, preset) {
  return callCentreGroups(groups).map((g) => {
    const m = groupMetrics(g);
    const own = callTotals([g], preset);
    const ready = m.funnelCached > 0;
    const share = ready ? percent(m.funnelCalled, m.funnelInCrm) : null;
    const behind = !ready ? null
      : m.funnelInCrm === 0 && m.funnelLeads > 0 ? `0 of ${whole(m.funnelLeads)} leads in the CRM`
        : share != null && share < 50 ? `${whole(m.funnelCalled)} of ${whole(m.funnelInCrm)} new in CRM called`
          : null;
    return {
      id: g.id,
      name: m.name,
      ready,
      inCrm: ready ? m.funnelInCrm : null,
      called: ready ? m.funnelCalled : null,
      share,
      calls: own.calls,
      talk: own.talk,
      answered: m.totalCalls > 0 ? percent(m.answeredCalls, m.totalCalls) : null,
      closes: m.closes,
      behind,
    };
  });
}

/**
 * Clients by the share of their new leads that got a call, lowest first.
 * @returns {{id, name, meta, value, bar, tone}[]}
 */
export function calledByClient(rows, { limit = 6 } = {}) {
  return rows
    .filter((r) => r.share != null)
    .sort((a, b) => a.share - b.share || b.inCrm - a.inCrm)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      name: r.name,
      meta: `${whole(r.called)} of ${whole(r.inCrm)} new in CRM`,
      value: `${Math.round(r.share)}%`,
      bar: r.share,
      tone: r.share < 50 ? "danger" : "accent",
    }));
}

/**
 * The call side of the funnel: new in the CRM, called, closed. Each step after the first carries its share of the first.
 * @returns {{stages: {key, label, count, share}[], diagnosis: {state: "problem"|"ok", title, body}} | null} null when the funnel is not cached for the range
 */
export function callFunnel(totals) {
  if (!totals?.funnelCached || !(totals.funnelInCrm > 0)) return null;
  const share = (n) => `${Math.round((n / totals.funnelInCrm) * 100)}%`;
  const stages = [
    { key: "crm", label: "New in CRM", count: totals.funnelInCrm, share: null },
    { key: "called", label: "Called", count: totals.funnelCalled, share: share(totals.funnelCalled) },
    { key: "closes", label: "Closed", count: totals.funnelCloses, share: share(totals.funnelCloses) },
  ];
  const reached = (totals.funnelCalled / totals.funnelInCrm) * 100;
  const facts = `${whole(totals.funnelCalled)} of ${whole(totals.funnelInCrm)} new leads in the CRM got a call (${Math.round(reached)}%).`;
  const diagnosis = reached < 50
    ? { state: "problem", title: "Problem found: calling", body: `${facts} Leads that are never called cannot close.` }
    : { state: "ok", title: "Calling is keeping up", body: facts };
  return { stages, diagnosis };
}

// ── The line under the caption ──────────────────────────────────────────────

const AGAINST = { today: "yesterday", last_7d: "the previous 7 days" };
const NOTABLE = 10;

/**
 * Media Buyer's one line: the biggest move in spend, leads or cost per lead, and how many clients are over their limit.
 * @returns {{lead: string, rest: string} | null}
 */
export function buyerFinding({ current, previous, preset, rows }) {
  const limited = rows.filter((r) => r.limit != null && r.standing !== "none");
  const over = limited.filter((r) => r.standing === "over").length;
  const overLine = limited.length ? `${over} of ${limited.length} clients with a limit ${over === 1 ? "is" : "are"} over it.` : "";
  const against = AGAINST[preset];
  const moves = previous && against ? [
    { name: "Cost per lead", pct: current.leads > 0 ? change(current.cpl, previous.cpl) : null, verb: "is" },
    { name: "Leads", pct: change(current.leads, previous.leads), verb: "are" },
    { name: "Ad spend", pct: change(current.spend, previous.spend), verb: "is" },
  ].filter((m) => m.pct != null) : [];
  if (moves.length === 0) return overLine ? { lead: overLine.replace(/\.$/, ""), rest: "." } : null;
  const biggest = [...moves].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
  if (Math.abs(biggest.pct) < NOTABLE) {
    return { lead: "A steady stretch", rest: `: spend, leads and cost per lead are all within ${NOTABLE}% of ${against}.${overLine ? ` ${overLine}` : ""}` };
  }
  return { lead: `${biggest.name} ${biggest.verb} ${biggest.pct < 0 ? "down" : "up"} ${Math.abs(biggest.pct).toFixed(0)}% on ${against}`, rest: `.${overLine ? ` ${overLine}` : ""}` };
}

/**
 * Sales Coach's one line: the share of new leads that got a call, against the period before when there is one.
 * @returns {{lead: string, rest: string} | null}
 */
export function coachFinding({ current, previous, preset }) {
  const share = current?.funnelCached ? percent(current.funnelCalled, current.funnelInCrm) : null;
  if (share == null) return null;
  const before = previous?.funnelCached ? percent(previous.funnelCalled, previous.funnelInCrm) : null;
  const against = AGAINST[preset];
  const lead = `${Math.round(share)}% of new leads got a call`;
  if (before == null || !against) return { lead, rest: "." };
  return { lead, rest: `, against ${Math.round(before)}% ${against === "yesterday" ? "yesterday" : `in ${against}`}.` };
}

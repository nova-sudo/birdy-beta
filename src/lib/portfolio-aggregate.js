// Turning real client-group data into what the Portfolio Dashboard renders.
//
// GET /api/client-groups returns one document per client with three caches
// hanging off it — Meta insights, GoHighLevel opportunity stats, HotProspector
// call stats. Everything on this screen is either a sum across those, a ratio
// of two sums, or a ranking by one of them.
//
// The field paths mirror what StyledTable already reads in
// components/ui/table-container.jsx, so the dashboard and the clients table
// can't drift into disagreeing about what "leads" means.

import { HIGHER_IS_BETTER, LOWER_IS_BETTER } from "./portfolio-metrics";
import { activeGroups } from "./client-status";

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Flatten one client group to the figures this screen uses.
 *
 * Meta's `results` is the lead count where it's populated; where it isn't, the
 * campaign rows are summed and `total_leads` is the last resort. That ladder is
 * what the clients table does, and dropping it makes portfolios with older
 * cached insights read as zero-lead.
 */
export function groupMetrics(group) {
  const insights = group.facebook?.metrics?.insights ?? {};
  const opps = group.gohighlevel?.metrics?.opportunity_stats ?? {};
  const calls = group.hotprospector?.call_stats ?? {};
  // The cohort funnel for the requested window, or null when the backend has
  // not cached that preset yet. There is deliberately no lifetime fallback —
  // see buildFunnel.
  const funnel = group.gohighlevel?.metrics?.funnel ?? null;

  let leads = num(insights.results);
  if (!leads && group.facebook?.campaigns?.length) {
    leads = group.facebook.campaigns.reduce((sum, c) => sum + num(c.results), 0);
  }
  if (!leads) leads = num(insights.total_leads);

  const spend = num(insights.spend);
  const closes = num(opps.won);

  return {
    id: group.id,
    name: group.name || "Unnamed client",
    status: group.client_status ?? "Active",
    currency: group.facebook?.currency || group.ad_account_currency || null,

    spend,
    leads,
    closes,
    revenue: num(opps.won_revenue),
    contacts: num(group.gohighlevel?.metrics?.total_contacts),
    totalOpps: num(opps.total_opportunities),

    // One cohort, four stages. `funnelCached` counts as a sum so the portfolio
    // can tell "every client reports zero closes" from "nothing cached yet".
    funnelCached: funnel ? 1 : 0,
    funnelLeads: num(funnel?.leads),
    funnelInCrm: num(funnel?.in_crm),
    funnelCalled: num(funnel?.called),
    funnelCloses: num(funnel?.closes),

    // Measured per-day spend for this client, [{date, spend}]. Kept off the
    // SUMMED list because it is a series, not a scalar — aggregatePortfolio
    // merges it by date instead.
    dailySpend: Array.isArray(group.facebook?.daily_spend) ? group.facebook.daily_spend : [],

    totalCalls: num(calls.total_calls),
    leadsWithCalls: num(calls.leads_with_calls),
    answeredCalls: num(calls.answered_calls),
    talkTime: num(calls.total_talk_min),
    hpLeads: num(calls.total_leads) || num(group.hotprospector?.metrics?.total_leads),
  };
}

/** Only active clients count towards the portfolio — the clients page agrees.
 *  Sourced from lib/client-status so every surface shares one definition;
 *  comparing `=== "Active"` here missed the 9 groups stored lowercase.
 *  Re-exported because callers already import it from this module. */
export { activeGroups };

const SUMMED = [
  "spend",
  "leads",
  "closes",
  "revenue",
  "contacts",
  "totalOpps",
  "funnelCached",
  "funnelLeads",
  "funnelInCrm",
  "funnelCalled",
  "funnelCloses",
  "totalCalls",
  "leadsWithCalls",
  "answeredCalls",
  "talkTime",
  "hpLeads",
];

/** Sum every additive figure across the portfolio, and derive the ratios. */
export function aggregatePortfolio(groups) {
  const rows = activeGroups(groups).map(groupMetrics);

  const totals = SUMMED.reduce((acc, key) => {
    acc[key] = rows.reduce((sum, row) => sum + row[key], 0);
    return acc;
  }, {});

  return {
    ...totals,
    clientCount: rows.length,
    currency: rows.find((r) => r.currency)?.currency ?? null,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    dailySpend: mergeDailySpend(rows),
    rows,
  };
}

/**
 * One portfolio-wide spend series, from each client's own daily rows.
 *
 * Summed the same way the KPI strip sums spend — per client group. Five ad
 * accounts back two groups each, so their spend lands twice in both figures.
 * That is wrong in the same direction and by the same amount in each, which is
 * the point: the curve and the total above it agree. Fixing the double-count
 * is a separate decision about what a "client" is, and it has to change both
 * at once or the card starts contradicting itself.
 */
function mergeDailySpend(rows) {
  const byDate = new Map();

  for (const row of rows) {
    for (const day of row.dailySpend) {
      if (!day?.date) continue;
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + num(day.spend));
    }
  }

  return [...byDate.entries()]
    .map(([date, spend]) => ({ date, spend }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Deltas ─────────────────────────────────────────────────────────────────

/**
 * Percentage change between two periods, as the shape StatTile wants.
 *
 * Returns null when there is nothing to compare against — no previous period,
 * or a previous period of zero. A metric that went from nothing to something
 * has no meaningful percentage, and rendering "+100%" for a client's first
 * week of spend would be worse than rendering nothing.
 */
export function percentDelta(current, previous, polarity = HIGHER_IS_BETTER) {
  if (previous == null || previous === 0 || !Number.isFinite(previous)) return null;
  if (!Number.isFinite(current)) return null;

  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.05) return null; // flat to one decimal — say nothing

  return {
    direction: change > 0 ? "up" : "down",
    delta: `${Math.abs(change).toFixed(1)}%`,
    polarity,
  };
}

// ─── Cards ──────────────────────────────────────────────────────────────────

/** The four headline figures, with deltas where a previous period exists. */
export function buildKpis(current, previous, formatMoney) {
  const prev = previous ?? {};

  return [
    {
      key: "spend",
      label: "Total ad spend",
      value: formatMoney(current.spend),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.spend, prev.spend) ?? {}),
    },
    {
      key: "leads",
      label: "Total leads",
      value: Math.round(current.leads).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.leads, prev.leads) ?? {}),
    },
    {
      key: "cpl",
      label: "Average CPL",
      value: formatMoney(current.cpl, 2),
      // Cheaper leads are better — a fall here is the good news.
      polarity: LOWER_IS_BETTER,
      ...(percentDelta(current.cpl, prev.cpl, LOWER_IS_BETTER) ?? {}),
    },
    {
      key: "closes",
      label: "Closed Leads",
      value: Math.round(current.closes).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
      ...(percentDelta(current.closes, prev.closes) ?? {}),
    },
  ];
}

/** Six call-centre figures. Three of them improve as they fall. */
export function buildCallInsights(current) {
  const pct = (n) => `${n.toFixed(1)}%`;
  const ratio = (a, b) => (b > 0 ? (a / b).toFixed(1) : "—");

  return [
    {
      key: "total",
      label: "Total calls",
      value: Math.round(current.totalCalls).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
    },
    {
      key: "speed",
      label: "Talk time (min)",
      value: Math.round(current.talkTime).toLocaleString(),
      polarity: HIGHER_IS_BETTER,
    },
    {
      key: "answer",
      label: "Answer rate",
      value: current.totalCalls > 0 ? pct((current.answeredCalls / current.totalCalls) * 100) : "—",
      polarity: HIGHER_IS_BETTER,
    },
    {
      key: "perLead",
      label: "Calls per lead",
      value: ratio(current.totalCalls, current.hpLeads),
      polarity: LOWER_IS_BETTER,
    },
    {
      key: "perClose",
      label: "Calls per close",
      value: ratio(current.totalCalls, current.closes),
      polarity: LOWER_IS_BETTER,
    },
    {
      key: "conversion",
      label: "Conversion rate",
      value: current.leads > 0 ? pct((current.closes / current.leads) * 100) : "—",
      polarity: HIGHER_IS_BETTER,
    },
  ];
}

/**
 * The funnel — one cohort of leads, followed through four stages.
 *
 * Every stage counts the same people: the contacts created inside the selected
 * window. `share` is each stage as a percentage of that cohort, which is the
 * number the screen exists to show — Closes' share *is* the close rate.
 *
 * The backend does the cohort work (see `compute_cohort_funnel` in
 * birdy-backend), because answering it per request meant scanning ghl_contacts
 * on every dashboard load. This function only presents what it cached.
 *
 * Two things follow from cohort semantics and are worth knowing before reading
 * a number off this card:
 *
 *   * **Recent windows under-report.** A cohort keeps closing after its window
 *     ends, so "last 7 days" describes leads that have had a week to convert
 *     and will show a lower close rate than "last month". Compare like windows.
 *   * **Called is measured beside In CRM, not under it.** A lead can be dialled
 *     without anyone opening an opportunity, so Called is a subset of Leads but
 *     not of In CRM. Leads ⊇ In CRM ⊇ Closes always holds, which is what makes
 *     the close rate trustworthy.
 *
 * Returns an empty array when the backend has not cached this preset yet,
 * rather than rendering four zeroes that look like a portfolio with no leads.
 *
 * The handoff's fifth stage, Shows, still has no source: GHL carries won/lost/
 * open/abandoned and nothing about attendance.
 *
 * @param {object} current portfolio totals
 * @param {object|null} previous the preceding period, for deltas
 */
export function buildFunnel(current, previous) {
  const prev = previous ?? {};
  if (!current.funnelCached) return [];

  const cohort = current.funnelLeads;
  const share = (value) =>
    cohort > 0 ? `${((value / cohort) * 100).toFixed(1)}%` : null;

  const stages = [
    {
      key: "leads",
      stage: "Leads",
      value: current.funnelLeads,
      prev: prev.funnelLeads,
      issue: "lead flow",
      stageNoun: "lead",
    },
    {
      key: "engaged",
      stage: "In CRM",
      value: current.funnelInCrm,
      prev: prev.funnelInCrm,
      issue: "CRM sync",
      stageNoun: "CRM",
    },
    {
      key: "called",
      stage: "Called",
      value: current.funnelCalled,
      prev: prev.funnelCalled,
      issue: "call coverage",
      stageNoun: "calling",
    },
    {
      key: "closes",
      stage: "Closes",
      value: current.funnelCloses,
      prev: prev.funnelCloses,
      issue: "close rate",
      stageNoun: "closing",
    },
  ];

  return stages.map((s) => {
    const change = percentDelta(s.value, s.prev);
    return {
      key: s.key,
      stage: s.stage,
      count: Math.round(s.value).toLocaleString(),
      // The first stage is the cohort itself; "100% of leads" is noise.
      share: s.key === "leads" ? null : share(s.value),
      issue: s.issue,
      stageNoun: s.stageNoun,
      // diagnoseFunnel reads delta as a number; the pill-style strings the
      // KPI strip uses don't apply here.
      ...(change ? { direction: change.direction, delta: parseFloat(change.delta) } : {}),
    };
  });
}

/**
 * Client leaderboards, one ranking per metric.
 *
 * Bars are a share of the leader rather than of a fixed scale, so the top row
 * is always full and the rest read as "how close to the best". CPL sorts
 * ascending because cheap is good; everything else sorts descending.
 */
export function buildLeaderboards(current, formatMoney, limit = 5) {
  const rows = current.rows ?? [];
  const money = (n) => formatMoney(n);

  const rank = (list, { by, ascending = false, value, meta }) => {
    const eligible = list.filter((r) => by(r) > 0);
    const sorted = [...eligible].sort((a, b) => (ascending ? by(a) - by(b) : by(b) - by(a)));
    const top = sorted.slice(0, limit);
    if (top.length === 0) return [];

    // Ascending metrics are better when smaller, so the leader is the smallest
    // and a bar is the leader's value over this row's.
    const leader = by(top[0]);

    return top.map((row) => ({
      id: row.id,
      name: row.name,
      meta: meta(row),
      value: value(row),
      bar: ascending
        ? (leader / by(row)) * 100
        : leader > 0
          ? (by(row) / leader) * 100
          : 0,
    }));
  };

  const cpl = (r) => (r.leads > 0 ? r.spend / r.leads : 0);

  return {
    "Avg CPL": rank(rows, {
      by: cpl,
      ascending: true,
      value: (r) => formatMoney(cpl(r), 2),
      meta: (r) => `${money(r.spend)} spend · ${Math.round(r.leads).toLocaleString()} leads`,
    }),
    Closes: rank(rows, {
      by: (r) => r.closes,
      value: (r) => Math.round(r.closes).toLocaleString(),
      meta: (r) =>
        `${Math.round(r.leads).toLocaleString()} leads · ${
          r.leads > 0 ? ((r.closes / r.leads) * 100).toFixed(1) : "0.0"
        }% conv`,
    }),
    Leads: rank(rows, {
      by: (r) => r.leads,
      value: (r) => Math.round(r.leads).toLocaleString(),
      meta: (r) => `${money(r.spend)} spend · ${formatMoney(cpl(r), 2)} CPL`,
    }),
    Revenue: rank(rows, {
      by: (r) => r.revenue,
      value: (r) => money(r.revenue),
      meta: (r) => `${Math.round(r.closes).toLocaleString()} closes`,
    }),
  };
}

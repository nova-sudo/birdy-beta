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

    totalCalls: num(calls.total_calls),
    leadsWithCalls: num(calls.leads_with_calls),
    answeredCalls: num(calls.answered_calls),
    talkTime: num(calls.total_talk_min),
    hpLeads: num(calls.total_leads) || num(group.hotprospector?.metrics?.total_leads),
  };
}

/** Only active clients count towards the portfolio — the clients page agrees. */
export function activeGroups(groups) {
  return (groups ?? []).filter((g) => (g.client_status ?? "Active") === "Active");
}

const SUMMED = [
  "spend",
  "leads",
  "closes",
  "revenue",
  "contacts",
  "totalOpps",
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
    rows,
  };
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
 * The funnel, as far as the data actually reaches.
 *
 * The handoff draws five stages ending in Shows. GoHighLevel's opportunity
 * stats carry won/lost/open/abandoned and no show data, so the last stage is
 * dropped rather than invented — four real stages beat five with a guess.
 */
export function buildFunnel(current, previous) {
  const prev = previous ?? {};

  const stages = [
    { key: "leads", stage: "Leads", value: current.leads, prev: prev.leads, issue: "lead flow", stageNoun: "lead" },
    { key: "engaged", stage: "In CRM", value: current.contacts, prev: prev.contacts, issue: "CRM sync", stageNoun: "CRM" },
    { key: "convos", stage: "Called", value: current.leadsWithCalls, prev: prev.leadsWithCalls, issue: "contact rate", stageNoun: "calling" },
    { key: "closes", stage: "Closes", value: current.closes, prev: prev.closes, issue: "close rate", stageNoun: "closing" },
  ];

  return stages.map((s) => {
    const change = percentDelta(s.value, s.prev);
    return {
      key: s.key,
      stage: s.stage,
      count: Math.round(s.value).toLocaleString(),
      issue: s.issue,
      stageNoun: s.stageNoun,
      // diagnoseFunnel reads delta as a number; StatTile-style strings don't
      // apply here.
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

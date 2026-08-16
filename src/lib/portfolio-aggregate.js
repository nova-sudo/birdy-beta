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
 * What the sampled lead rows say about where Meta leads ended up.
 *
 * `/api/facebook-leads/filtered` returns individual leads that came from Meta,
 * each carrying whether it reached the CRM and what its opportunity did. That
 * attribution is the whole point: a portfolio-level GHL contact count answers a
 * different question, because the CRM also holds organic enquiries, referrals,
 * manual imports and everyone from before Meta was connected.
 *
 * The fetch is capped, so treat these as a sample and read rates off them
 * rather than totals. `capped` says whether we saw everything.
 *
 * @param {object[]} leads
 * @param {number} fetchLimit the cap the rows were fetched under
 */
export function attributionStats(leads, fetchLimit) {
  const rows = leads ?? [];
  const sampled = rows.length;
  const matched = rows.filter((l) => Boolean(l.ghl_matched)).length;
  const won = rows.filter(
    (l) => String(l.ghl_opportunity_status ?? "").toLowerCase() === "won"
  ).length;

  return {
    sampled,
    matched,
    won,
    capped: fetchLimit > 0 && sampled >= fetchLimit,
    matchRate: sampled > 0 ? matched / sampled : null,
    wonRate: sampled > 0 ? won / sampled : null,
  };
}

/**
 * The funnel, built so each stage is genuinely a subset of the one above it.
 *
 * Every stage counts Meta-attributed leads. Mixing bases is what made an
 * earlier version show more people "In CRM" than there were leads: that stage
 * summed every GoHighLevel contact each client had, which is not a subset of
 * anything upstream and is not even windowed the way Meta insights are.
 *
 * "Called" is gone for the same reason — HotProspector call stats count calls
 * to whoever is in the dialler, with no link back to which Meta lead they were.
 * Those figures still have a home in the Call insights card, where they are not
 * pretending to be a stage.
 *
 * The handoff's fifth stage, Shows, has no source at all: GHL opportunity stats
 * carry won/lost/open/abandoned and nothing about attendance.
 *
 * @param {object} current portfolio totals
 * @param {object|null} previous the preceding period, for deltas
 * @param {object} stats from attributionStats
 */
export function buildFunnel(current, previous, stats) {
  const prev = previous ?? {};
  const { matchRate, wonRate, capped } = stats ?? {};

  // The sample gives a rate; the true lead total gives the magnitude. Scaling
  // one by the other keeps the funnel on the same axis as the KPI strip
  // instead of topping out at whatever the fetch limit happened to be.
  const scaled = (rate) => (rate == null ? null : current.leads * rate);

  const stages = [
    {
      key: "leads",
      stage: "Leads",
      value: current.leads,
      prev: prev.leads,
      issue: "lead flow",
      stageNoun: "lead",
    },
    {
      key: "engaged",
      stage: "In CRM",
      value: scaled(matchRate),
      issue: "CRM sync",
      stageNoun: "CRM",
      estimated: capped,
    },
    {
      key: "closes",
      stage: "Closes",
      value: scaled(wonRate),
      issue: "close rate",
      stageNoun: "closing",
      estimated: capped,
    },
  ];

  return stages
    .filter((s) => s.value != null)
    .map((s) => {
      const change = percentDelta(s.value, s.prev);
      return {
        key: s.key,
        stage: s.stage,
        count: Math.round(s.value).toLocaleString(),
        issue: s.issue,
        stageNoun: s.stageNoun,
        estimated: Boolean(s.estimated),
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

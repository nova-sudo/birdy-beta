// Budget pacing for Media Buyer's Projections: how far each client is through
// this month's budget against how far through the month we are.
//
// This is the same arithmetic as the backend's budget pacing tool
// (birdy-backend ai/mcp/pacing_mcp.py, get_budget_pacing), applied to the same
// inputs: the cached this-month Meta figures from /api/client-groups and each
// client's monthly budget (its `monthly_spend` target). "On pace for" is a
// straight line: spend so far ÷ days gone × days in the month, counting today
// as half a day because the cache holds part of it. It is not a forecast.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Points ahead of the month's share that count as overspending, and behind that count as underspending (the tool's). */
export const OVER = 10;
export const UNDER = 15;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Today's place in the month, on the server's clock (UTC), as the tool counts it. */
export function monthOf(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = now.getUTCDate();
  return { y, m, day, days, elapsed: day - 0.5, name: MONTH_NAMES[m], key: `${y}-${String(m + 1).padStart(2, "0")}` };
}

/** "over", "under" or "on_pace" for a share used against the share of the month gone. */
export function paceStatus(usedPct, expectedPct) {
  if (usedPct - expectedPct > OVER) return "over";
  if (expectedPct - usedPct > UNDER) return "under";
  return "on_pace";
}

/**
 * One client's pacing, as get_budget_pacing's pace_row builds it.
 * @returns {{spend: number, budget: number|null, used_pct: number|null, expected_pct: number, projected: number, status: string, runs_out_on: string|null}}
 */
export function paceRow(spend, budget, month) {
  const expected = Math.round((month.elapsed / month.days) * 1000) / 10;
  const row = { spend, budget: budget || null, used_pct: null, expected_pct: expected, projected: (spend / month.elapsed) * month.days, status: "no_budget", runs_out_on: null };
  if (!budget) return row;
  const used = (spend / budget) * 100;
  row.used_pct = Math.round(used * 10) / 10;
  row.status = paceStatus(used, expected);
  if (spend > 0 && used < 100) {
    const day = (month.elapsed * budget) / spend; // the day of the month the budget runs out at this pace
    if (day < month.days - 1) row.runs_out_on = new Date(Date.UTC(month.y, month.m, 1 + Math.floor(day))).toISOString().slice(0, 10);
  } else if (used >= 100) {
    row.runs_out_on = "already";
  }
  return row;
}

/**
 * Every active client's pacing, and the totals of the ones with a budget.
 * @param {object[]} groups client groups from /api/client-groups?preset=this_month
 */
export function pacingOf(groups, now = new Date()) {
  const month = monthOf(now);
  const clients = (groups ?? [])
    .filter((g) => g && g.client_status !== "Inactive")
    .map((g) => {
      const insights = g.facebook?.metrics?.insights ?? {};
      const spend = num(insights.spend) ?? 0;
      const leads = num(insights.results) || num(insights.total_leads) || 0;
      const budget = num(g.targets?.monthly_spend) || null;
      const cplTarget = num(g.targets?.cpl) || null;
      const row = paceRow(spend, budget, month);
      return {
        id: g.id,
        name: g.name,
        currency: g.facebook?.currency || g.ad_account_currency || null,
        leads,
        projectedLeads: (leads / month.elapsed) * month.days,
        cplTarget,
        ...row,
      };
    })
    .sort((a, b) => (a.budget == null) - (b.budget == null) || ((b.used_pct ?? 0) - b.expected_pct) - ((a.used_pct ?? 0) - a.expected_pct) || b.spend - a.spend);

  const budgeted = clients.filter((c) => c.budget);
  const sum = (list, key) => list.reduce((t, c) => t + (c[key] || 0), 0);
  let totals = null;
  if (budgeted.length) {
    const spend = sum(budgeted, "spend");
    const budget = sum(budgeted, "budget");
    const leads = sum(budgeted, "leads");
    // A lead target only when every budgeted client has a CPL target: budget ÷ CPL is how many leads it buys.
    const leadTarget = budgeted.every((c) => c.cplTarget) ? budgeted.reduce((t, c) => t + c.budget / c.cplTarget, 0) : null;
    const usedPct = (spend / budget) * 100;
    totals = {
      clients: budgeted.length,
      spend,
      budget,
      projected: sum(budgeted, "projected"),
      leads,
      projectedLeads: sum(budgeted, "projectedLeads"),
      leadTarget,
      cpl: leads > 0 ? spend / leads : null,
      cplTarget: leadTarget ? budget / leadTarget : null,
      usedPct,
      status: paceStatus(usedPct, clients[0].expected_pct),
    };
  }
  const summary = { over: 0, on_pace: 0, under: 0, no_budget: clients.length - budgeted.length };
  for (const c of budgeted) summary[c.status] += 1;
  return { month, clients, totals, summary, expected_pct: Math.round((month.elapsed / month.days) * 1000) / 10 };
}

/** Words for a pacing status. */
export const PACE_WORDS = {
  over: { label: "Overspending", tone: "danger" },
  under: { label: "Underspending", tone: "warning" },
  on_pace: { label: "On pace", tone: "success" },
  no_budget: { label: "No budget", tone: "neutral" },
};

/** "Runs out 24 Nov", "Budget used", or null. */
export function runsOutWords(runsOut) {
  if (!runsOut) return null;
  if (runsOut === "already") return "Budget used";
  const d = new Date(`${runsOut}T00:00:00Z`);
  return `Runs out ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

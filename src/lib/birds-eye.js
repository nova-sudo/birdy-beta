// What Bird's Eye shows, worked out from the same totals the Dashboard used.
// No React here: each function takes plain figures and returns what to draw.

/** A change smaller than this is not worth a sentence. */
export const NOTABLE_PCT = 10;

/** Signed percentage change, or null when there is nothing to compare with. */
export function change(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** What the comparison is against, in words; null for ranges with no previous period. */
export const comparisonLabel = (preset) => ({ today: "vs yesterday", last_7d: "vs previous 7 days" })[preset] ?? null;

/** The previous period, as it reads mid-sentence. */
const AGAINST = { today: "yesterday", last_7d: "the previous 7 days" };

/** Share of leads that got a call, as a percentage; null when nobody dials or the funnel is not ready. */
export function calledShare(totals, hasCallCentre = true) {
  if (!totals || !hasCallCentre || !totals.funnelCached || !(totals.funnelLeads > 0)) return null;
  return (totals.funnelCalled / totals.funnelLeads) * 100;
}

/**
 * The four tiles. The agency leads with calls; one client leads with its cost per lead.
 *
 * @returns {{key, label, value, kind: "money"|"money2"|"count"|"percent", delta, goodWhen, note, noteTone}[]}
 */
export function buildTiles({ current, previous, preset, hasCallCentre, scoped = false, cplTarget = null, money = (n) => String(n) }) {
  const vs = comparisonLabel(preset);
  const prev = previous ?? {};
  const whole = (n) => Math.round(n).toLocaleString("en-GB");
  const from = (now, before) => (Number.isFinite(before) && before > 0 && Math.round(before) !== Math.round(now) ? `${now < before ? "down" : "up"} from ${whole(before)}` : vs);

  const spend = { key: "spend", label: scoped ? "Spend" : "Ad spend", value: current.spend, kind: "money", delta: change(current.spend, prev.spend), goodWhen: "neither", note: vs };
  const leads = { key: "leads", label: "Leads", value: current.leads, kind: "count", delta: change(current.leads, prev.leads), goodWhen: "up", note: vs };
  const closed = { key: "closes", label: "Closed", value: current.closes, kind: "count", delta: change(current.closes, prev.closes), goodWhen: "up", note: from(current.closes, prev.closes) };

  if (scoped) {
    const cpl = {
      key: "cpl", label: "CPL", value: current.leads > 0 ? current.cpl : null, kind: "money2",
      delta: change(current.cpl, prev.cpl), goodWhen: "down",
      note: cplTarget > 0 ? `limit ${money(cplTarget, 2)}` : vs,
      noteTone: cplTarget > 0 && current.cpl > cplTarget ? "bad" : undefined,
    };
    return [spend, leads, cpl, closed];
  }

  const share = calledShare(current, hasCallCentre);
  const before = calledShare(prev, hasCallCentre);
  const moved = share != null && before != null && Math.round(before) !== Math.round(share);
  const called = {
    key: "called", label: "Leads called", value: share, kind: "percent", delta: null, goodWhen: "up",
    note: share == null
      ? (hasCallCentre ? "Not ready for this range" : "No client has a call centre")
      : `${whole(current.funnelCalled)} of ${whole(current.funnelLeads)}${moved ? ` · ${share < before ? "down" : "up"} from ${Math.round(before)}%` : ""}`,
    noteTone: moved ? (share < before ? "bad" : "good") : undefined,
  };
  return [spend, leads, closed, called];
}

/**
 * The one line under the greeting: the biggest movement, stated as fact.
 * @returns {{lead: string, rest: string} | null} null when there is nothing to compare with
 */
export function buildFinding({ current, previous, preset, hasCallCentre }) {
  const against = AGAINST[preset];
  if (!previous || !against) return null;
  const moves = [
    { name: "Closes", pct: change(current.closes, previous.closes) },
    { name: "Leads", pct: change(current.leads, previous.leads) },
    { name: "Ad spend", pct: change(current.spend, previous.spend) },
  ].filter((m) => m.pct != null);
  if (moves.length === 0) return null;

  const biggest = [...moves].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
  if (Math.abs(biggest.pct) < NOTABLE_PCT) {
    return { lead: "A steady stretch", rest: `: spend, leads and closes are all within ${NOTABLE_PCT}% of ${against}.` };
  }

  const lead = `${biggest.name} are ${biggest.pct < 0 ? "down" : "up"} ${Math.abs(biggest.pct).toFixed(0)}% on ${against}`.replace("Ad spend are", "Ad spend is");
  const share = calledShare(current, hasCallCentre);
  const before = calledShare(previous, hasCallCentre);
  const callsMoved = share != null && before != null && Math.abs(share - before) >= 5;
  return { lead, rest: callsMoved ? `. Leads called went from ${Math.round(before)}% to ${Math.round(share)}%.` : "." };
}

/** Which series the chart can switch between, in order. */
export const chartKeys = (scoped) => (scoped ? ["leads", "spend", "cpl", "closes"] : ["leads", "spend", "calls", "closes"]);

/** The chart's wording for each series. */
export const CHART_COPY = {
  leads: { tab: "Leads", title: "Meta leads per day", kind: "count" },
  spend: { tab: "Ad spend", title: "Ad spend per day", kind: "money" },
  calls: { tab: "Calls", title: "Calls per day", kind: "count" },
  closes: { tab: "Closed", title: "Closed per day", kind: "count" },
  cpl: { tab: "CPL", title: "Cost per lead per day", kind: "money2" },
};

/**
 * One client's campaigns, cheapest lead first. A campaign over the client's limit is marked.
 * @returns {{id, name, meta, cpl, bar, tone}[]}
 */
export function rankCampaigns(campaigns, { cplTarget = null, limit = 6, money = (n) => String(n) } = {}) {
  const rows = (campaigns ?? [])
    .map((c) => ({ id: String(c.id ?? c.name), name: c.name || "Unnamed campaign", spend: Number(c.spend) || 0, leads: Number(c.results) || 0 }))
    .filter((c) => c.spend > 0 && c.leads > 0)
    .map((c) => ({ ...c, cpl: c.spend / c.leads }))
    .sort((a, b) => a.cpl - b.cpl)
    .slice(0, limit);
  const dearest = Math.max(0, ...rows.map((r) => r.cpl));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    meta: `${money(r.spend, 2)} spend · ${Math.round(r.leads).toLocaleString("en-GB")} lead${Math.round(r.leads) === 1 ? "" : "s"}`,
    cpl: r.cpl,
    bar: dearest > 0 ? (r.cpl / dearest) * 100 : 0,
    tone: cplTarget > 0 && r.cpl > cplTarget ? "danger" : "accent",
  }));
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour of the day. */
export const greeting = (hour) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

// What the dashboard says about its data. The page is composition only; the
// wording and the shaping into ds component props live here so they can be
// tested without rendering.

/** Called is the one funnel stage a portfolio with no dialler cannot report. */
export const CALL_CENTRE_FUNNEL_KEYS = ["called"];

/**
 * Which of the six call-insight figures a call centre has to report for.
 *
 * Five of the six. `conversion` is the odd one out and it is worth saying why,
 * because it sits in a group headed "Call insights" and looks like the others:
 * it is closes ÷ leads — GHL won opportunities over Meta results — and a
 * client with no dialler still has both. Greying it out would be telling the
 * reader we can't measure something we can measure perfectly well.
 *
 * `perClose` goes the other way and is included: calls ÷ closes has a real
 * denominator but no numerator, and a ratio is only as available as its worst
 * input.
 *
 * Mapped from buildCallInsights in lib/portfolio-aggregate.js, whose figures
 * come out of `hotprospector.call_stats`.
 */
export const CALL_CENTRE_STAT_KEYS = ["total", "speed", "answer", "perLead", "perClose"];

const MAX_FINDINGS = 5;

// Worst first, so the cap drops good news before it drops a problem.
const TONE_ORDER = ["danger", "warning", "info", "success", "neutral"];

const SEVERITY_TONE = { HIGH: "danger", MEDIUM: "warning", OPPORTUNITY: "success" };

/**
 * "Good morning" / "Good afternoon" / "Good evening" for an hour 0-23. With no
 * hour yet (server render, first client render) it is a neutral "Hello", so
 * the markup is the same on both sides and hydration has nothing to correct.
 */
export function greeting(hour, name) {
  if (hour == null) return name ? `Hello, ${name}` : "Hello";
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return name ? `Good ${part}, ${name}` : `Good ${part}`;
}

/**
 * One sentence on the window: how many clients, what they produced, and which
 * way leads moved against the previous period when there is a comparison.
 */
export function portfolioSummary({ clientCount, kpis }) {
  const kpi = (key) => kpis.find((k) => k.key === key);
  const leads = kpi("leads");
  const spend = kpi("spend");
  if (!clientCount || !leads || !spend) return null;

  const clients = `${clientCount.toLocaleString()} ${clientCount === 1 ? "client" : "clients"}`;
  const moved =
    leads.direction && leads.delta
      ? `, ${leads.direction} ${leads.delta} on the previous period`
      : "";
  return `${clients} brought in ${leads.value} leads on ${spend.value} of ad spend${moved}.`;
}

/**
 * Cost per lead for each bucket the leads series has, from the spend series.
 * The two are bucketed separately, so they are matched on the bucket's
 * tooltip label; a bucket with no leads or no spend has no cost to plot.
 *
 * @param {{labels: string[], tooltipLabels: string[], values: number[]}} leads
 * @param {{tooltipLabels: string[], values: number[]}} spend
 * @returns {{x: string, current: number, tooltipLabel: string}[]}
 */
export function costPerLeadSeries(leads, spend) {
  const spendByBucket = new Map((spend?.tooltipLabels ?? []).map((t, i) => [t, spend.values[i]]));
  const out = [];
  (leads?.values ?? []).forEach((count, i) => {
    const bucketSpend = spendByBucket.get(leads.tooltipLabels?.[i]);
    if (!(count > 0) || !(bucketSpend > 0)) return;
    out.push({
      x: leads.labels?.[i] ?? "",
      current: bucketSpend / count,
      tooltipLabel: leads.tooltipLabels?.[i],
    });
  });
  return out;
}

/**
 * Breakdown rows for "By client": the biggest clients by leads, then one row
 * for everyone else. Shares are of the portfolio's lead total.
 *
 * @param {{id: string, name: string, leads: number}[]} clients
 * @param {{limit?: number, colors: string[], otherColor: string}} options
 * @returns {{total: number, rows: object[]}}
 */
export function clientBreakdown(clients, { limit = 4, colors, otherColor }) {
  const withLeads = (clients ?? []).filter((c) => c.leads > 0).sort((a, b) => b.leads - a.leads);
  const total = withLeads.reduce((sum, c) => sum + c.leads, 0);
  if (total === 0) return { total: 0, rows: [] };

  const share = (n) => Math.round((n / total) * 100);
  const top = withLeads.slice(0, limit);
  const rest = withLeads.slice(limit);

  const rows = top.map((c, i) => ({
    key: c.id,
    label: c.name,
    color: colors[i % colors.length],
    value: Math.round(c.leads).toLocaleString(),
    share: share(c.leads),
  }));
  if (rest.length > 0) {
    const restLeads = rest.reduce((sum, c) => sum + c.leads, 0);
    rows.push({
      key: "others",
      label: `${rest.length} ${rest.length === 1 ? "other" : "others"}`,
      color: otherColor,
      value: Math.round(restLeads).toLocaleString(),
      share: share(restLeads),
    });
  }
  return { total, rows };
}

/**
 * Funnel stages as diagnoseFunnel should read them. Where no client has a
 * dialler the Called stage is stripped of its movement, so the verdict can
 * never name a stage the data cannot see.
 */
export function comparableFunnel(funnel, hasCallCentre) {
  return (funnel ?? []).map((stage) => {
    if (hasCallCentre || !CALL_CENTRE_FUNNEL_KEYS.includes(stage.key)) return stage;
    const { direction, delta, ...rest } = stage;
    return rest;
  });
}

/**
 * The funnel diagnosis as a briefing: one finding whose bold part is the
 * verdict and whose plain part is the evidence. Nothing to say without a
 * comparison or without a body.
 *
 * @returns {{parts: object[], findings: {tone: string, parts: object[]}[]}}
 */
export function briefingFromDiagnosis(diagnosis, { hasComparison }) {
  if (!diagnosis?.body || !hasComparison) return { parts: [], findings: [] };
  return {
    parts: [],
    findings: [
      {
        tone: diagnosis.state === "problem" ? "warning" : "success",
        parts: [{ text: diagnosis.title, strong: true }, { text: ` ${diagnosis.body}` }],
      },
    ],
  };
}

const partsText = (parts, strong) =>
  (parts ?? [])
    .filter((p) => strong === undefined || Boolean(p.strong) === strong)
    .map((p) => p.text)
    .join("")
    .trim();

/**
 * Turns the briefing's findings and the pending suggestions into BirdyRead
 * rows: worst tone first, at most five.
 *
 * A suggestion's "Do it" becomes the row's action and it can be dismissed;
 * briefing findings are observations and carry neither.
 *
 * @param {{findings?: {tone?: string, parts: {text: string, strong?: boolean}[]}[]}} briefing
 * @param {{id: string, severity?: string, client?: string, title: string, why?: string}[]} suggestions
 * @param {{onApply?: (suggestion: object) => void, onDismiss?: (suggestion: object) => void}} [options]
 */
export function toFindings(briefing, suggestions, { onApply, onDismiss } = {}) {
  const fromSuggestions = (suggestions ?? []).map((s) => ({
    id: `suggestion-${s.id}`,
    tone: SEVERITY_TONE[s.severity] ?? "warning",
    title: s.title,
    detail: [s.client, s.why].filter(Boolean).join(" · ") || undefined,
    action: onApply ? { label: "Do it", onClick: () => onApply(s) } : undefined,
    onDismiss: onDismiss ? () => onDismiss(s) : undefined,
  }));

  const fromBriefing = (briefing?.findings ?? []).map((f, i) => ({
    id: `briefing-${i}`,
    tone: TONE_ORDER.includes(f.tone) ? f.tone : "neutral",
    title: partsText(f.parts, true) || partsText(f.parts),
    detail: partsText(f.parts, false) || undefined,
  }));

  // Array#sort is stable, so within a tone suggestions stay ahead of the
  // briefing and each keeps its own order.
  return [...fromSuggestions, ...fromBriefing]
    .sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone))
    .slice(0, MAX_FINDINGS);
}

/**
 * Call insights as MetricGroup cells. Where no client has a call centre the
 * figures that need one are flagged `unavailable` (the page renders its
 * placeholder in their place) rather than passed through as the zeroes they
 * sum to; the cells themselves stay, so the reader still sees which six
 * figures Birdy tracks here.
 *
 * @param {{key: string, label: string, value: string}[]} insights buildCallInsights output
 * @param {boolean} hasCallCentre
 * @returns {{key: string, label: string, value: string, unavailable?: boolean}[]}
 */
export function callInsightItems(insights, hasCallCentre) {
  return (insights ?? []).map(({ key, label, value }) => ({
    key,
    label,
    value,
    ...(!hasCallCentre && CALL_CENTRE_STAT_KEYS.includes(key) ? { unavailable: true } : {}),
  }));
}

/**
 * The Calls tab's headline figure. There is no calls KPI in the strip (the
 * insights carry the total), and with no call centre the total is a dash, not
 * a 0.
 */
export function callsTabValue(insights, hasCallCentre) {
  if (!hasCallCentre) return "—";
  return (insights ?? []).find((i) => i.key === "total")?.value ?? "—";
}

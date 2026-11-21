// A custom metric's formula as the backend stores it (`formula_parts`): a list
// of {type: "metric", value: id}, {type: "number", value, label} and
// {type: "operator", value: "+"|"-"|"*"|"/"}, read left to right.

export const OPERATORS = [
  { value: "+", sign: "+", name: "Add" },
  { value: "-", sign: "−", name: "Subtract" },
  { value: "*", sign: "×", name: "Multiply" },
  { value: "/", sign: "÷", name: "Divide" },
];

export const FORMATS = [
  { value: "integer", label: "Integer" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "decimal", label: "Decimal" },
];

export const AGGREGATIONS = [
  { value: "total", label: "Total" },
  { value: "average", label: "Average" },
];

/** The dashboards a custom metric can show on. */
export const DASHBOARD_OPTIONS = [
  { value: "clients", label: "Client Groups" },
  { value: "campaigns", label: "Campaigns" },
  { value: "adsets", label: "Ad Sets" },
  { value: "ads", label: "Ads" },
  { value: "leads", label: "Leads Hub" },
  { value: "marketing_leads", label: "Marketing Hub — Leads" },
];

// Which level a metric resolves at, and the dashboards that level can show on.
const LEVEL_MAP = {
  meta_spend: "group", meta_impressions: "group", meta_clicks: "group", meta_reach: "group", meta_results: "group", meta_ctr: "group",
  meta_cpc: "group", meta_cpm: "group", meta_leads: "group", ghl_contacts: "group", ghl_revenue: "group", ghl_conversion: "group",
  conversion_rate: "group", cost_per_lead: "group", engagement_rate: "group", roas: "group",
  spend: "campaign", impressions: "campaign", clicks: "campaign", reach: "campaign", results: "campaign", leads: "campaign",
  ctr: "campaign", cpc: "campaign", cpm: "campaign", frequency: "campaign", cpl: "campaign", cost_per_result: "campaign",
  opportunityValue: "lead",
};
const LEVEL_DASHBOARDS = { group: ["clients"], campaign: ["campaigns", "adsets", "ads"], lead: ["leads", "marketing_leads"] };

const opSign = (value) => OPERATORS.find((o) => o.value === value)?.sign ?? value;

/** The formula is empty: nothing to evaluate yet. */
export const isEmpty = (parts) => parts.length === 0 || (parts.length === 1 && parts[0].type === "metric" && !parts[0].value);

/** A metric or a number can go next: at the start, or after an operator. */
export const canAddOperand = (parts) => isEmpty(parts) || parts[parts.length - 1]?.type === "operator";

/** An operator can go next: after a metric or a number. */
export function canAddOperator(parts) {
  const last = parts[parts.length - 1];
  return (last?.type === "metric" && !!last.value) || last?.type === "number";
}

/** Add a metric or a number, replacing the empty placeholder if there is one. */
export const addOperand = (parts, part) => (isEmpty(parts) ? [part] : [...parts, part]);

/**
 * Remove the part at `index`, taking its neighbouring operator with it so the
 * formula still reads metric, operator, metric.
 */
export function removePart(parts, index) {
  const next = [...parts];
  if (parts[index]?.type === "operator") {
    next.splice(index, 1);
    return next;
  }
  if (index > 0 && next[index - 1].type === "operator") next.splice(index - 1, 2);
  else if (index < next.length - 1 && next[index + 1].type === "operator") next.splice(index, 2);
  else next.splice(index, 1);
  return next;
}

/** What is wrong with the formula's shape, or null when it can be saved. */
export function formulaProblem(parts) {
  if (isEmpty(parts)) return "Add a metric to start the formula.";
  if (parts[parts.length - 1].type === "operator") return "End the formula with a metric or a number.";
  return null;
}

/**
 * The formula written out, as stored in `formula_display`: labels for
 * metrics, the raw operator characters, numbers as typed.
 * @param {(id: string) => string|undefined} labelOf
 */
export function formulaText(parts, labelOf) {
  return parts.map((p) => (p.type === "metric" ? labelOf(p.value) ?? p.value : String(p.label ?? p.value))).join(" ");
}

/** The same, for people: × and ÷ and a real minus sign. */
export function formulaWords(parts, labelOf) {
  return parts.map((p) => (p.type === "operator" ? opSign(p.value) : p.type === "metric" ? labelOf(p.value) ?? p.value : String(p.label ?? p.value))).join(" ");
}

/**
 * The level the formula's metrics resolve at, the dashboards it may show on,
 * and whether it mixes levels (which the backend cannot compute).
 */
export function formulaLevel(parts) {
  const levels = new Set(parts.filter((p) => p.type === "metric" && p.value).map((p) => LEVEL_MAP[p.value]).filter(Boolean));
  const mixed = levels.size > 1;
  const level = levels.size === 1 ? [...levels][0] : null;
  return { level, mixed, allowed: level ? new Set(LEVEL_DASHBOARDS[level]) : null };
}

/** Is this dashboard off limits for the formula as it stands? */
export function dashboardDisabled(parts, dashboard) {
  const { mixed, allowed } = formulaLevel(parts);
  return mixed || (allowed !== null && !allowed.has(dashboard));
}

/** "{name} (copy)", or "(copy 2)", "(copy 3)"… until it is free. */
export function copyName(name, taken) {
  const lower = new Set(taken.map((n) => (n || "").trim().toLowerCase()));
  let candidate = `${name} (copy)`;
  for (let n = 2; lower.has(candidate.toLowerCase()); n += 1) candidate = `${name} (copy ${n})`;
  return candidate;
}

/** Another custom metric already has this name (case and spacing aside). */
export function nameTaken(name, customs, exceptId) {
  const clean = (name || "").trim().toLowerCase();
  return !!clean && customs.some((m) => (m.name || "").trim().toLowerCase() === clean && m.id !== exceptId);
}

// Example figures for the preview. Not anyone's data: the preview says so.
const SAMPLE = {
  meta_spend: 1000, spend: 1000, meta_impressions: 50000, impressions: 50000, meta_clicks: 1500, clicks: 1500, meta_reach: 20000, reach: 20000,
  meta_results: 120, results: 120, leads: 120, meta_leads: 120, meta_ctr: 3.0, ctr: 3.0, meta_cpc: 0.67, cpc: 0.67, meta_cpm: 20.0, cpm: 20.0,
  ghl_contacts: 200, frequency: 2.5, conversion_rate: 8.0, cost_per_lead: 8.33, engagement_rate: 3.24, ghl_revenue: 4200, roas: 4.2,
};

/** Evaluate numbers and operators with × and ÷ before + and −. NaN when it cannot. */
function evaluate(terms) {
  if (!terms.length || terms.length % 2 === 0) return NaN;
  const sums = [terms[0]];
  const ops = [];
  for (let i = 1; i < terms.length; i += 2) {
    const op = terms[i];
    const n = terms[i + 1];
    if (op === "*" || op === "/") sums[sums.length - 1] = op === "*" ? sums[sums.length - 1] * n : sums[sums.length - 1] / n;
    else {
      ops.push(op);
      sums.push(n);
    }
  }
  return sums.slice(1).reduce((acc, n, i) => (ops[i] === "-" ? acc - n : acc + n), sums[0]);
}

/**
 * The formula worked out on example figures, for the dialog's preview. A
 * custom metric inside it is worked out from its own formula; unknown metrics
 * count as 100.
 * @param {{id: string, formulaParts: object[]}[]} customs
 * @returns {number|null} null when there is nothing to show
 */
export function sampleResult(parts, customs = []) {
  const valueOf = (id, seen) => {
    if (SAMPLE[id] !== undefined) return SAMPLE[id];
    if (seen.has(id)) return 0;
    const cm = customs.find((m) => m.id === id);
    if (cm?.formulaParts?.length) {
      const sub = run(cm.formulaParts, new Set(seen).add(id));
      return Number.isFinite(sub) ? sub : 0;
    }
    return 100;
  };
  const run = (ps, seen) => evaluate(ps.map((p) => (p.type === "operator" ? p.value : p.type === "number" ? Number(p.value) : valueOf(p.value, seen))));
  if (isEmpty(parts) || parts[parts.length - 1].type === "operator") return null;
  const result = run(parts, new Set());
  return Number.isFinite(result) ? result : null;
}

/** A preview figure in the metric's format. */
export function formatSample(value, format) {
  if (value == null) return "–";
  if (format === "currency") return `$${value.toFixed(2)}`;
  if (format === "percentage") return `${(value * 100).toFixed(1)}%`;
  if (format === "decimal") return value.toFixed(2);
  return Math.round(value).toLocaleString("en-GB");
}

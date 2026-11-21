// Settings › Alerts' pure logic: the tabs, the editor's form and the payload
// it saves, the metric list, how a rule reads in a row, and the fired history.
// The payload is the one the old /alerts page sent (POST /api/alerts,
// PATCH /api/alerts/:id); nothing about the API changes.

import {
  CREATIVE_METRIC_OPTIONS, CREATIVE_NO_THRESHOLD, CREATIVE_OPERATOR_OPTIONS, EMPTY_FORM, FREQUENCY_OPTIONS,
  OPERATOR_OPTIONS, PERIOD_OPTIONS, conditionSummary, isCreativeMetric,
} from "@/lib/alert-helpers";

// ── Tabs ──────────────────────────────────────────────────────────────────────

/** The section's tabs. `active`, `triggered` and `paused` are the buckets GET /api/alerts returns. */
export const ALERT_TABS = [
  { value: "triggered", label: "Triggered" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Snoozed & paused" },
  { value: "history", label: "History" },
];

/** Triggered is where the old page opened too. */
export const DEFAULT_ALERT_TAB = "triggered";

/** The tab an address opens: the old /alerts?tab= values still work. */
export function tabFromParam(value) {
  return ALERT_TABS.some((t) => t.value === value) ? value : DEFAULT_ALERT_TAB;
}

/** The address of a tab, inside Settings. */
export function alertsTabHref(tab) {
  return tab === DEFAULT_ALERT_TAB ? "/settings?section=alerts" : `/settings?section=alerts&tab=${tab}`;
}

/** What an empty tab says. */
export const EMPTY_TAB = {
  triggered: { title: "Nothing has fired", body: "No rule has crossed its threshold. Birdy keeps checking." },
  active: { title: "No alerts yet", body: "Create one and Birdy will watch the numbers for you." },
  paused: { title: "Nothing snoozed or paused", body: "Rules you snooze or pause wait here." },
  history: { title: "No alerts have fired yet", body: "Each time a rule fires, it is listed here." },
};

// ── Metrics ───────────────────────────────────────────────────────────────────

// Grouped under the catalogue's category names, so lib/metric-sources gives
// each the same logo it wears in Settings › Metrics.
const BASE_METRICS = [
  ["spend", "Total Spend", "Meta Ads"],
  ["impressions", "Impressions", "Meta Ads"],
  ["clicks", "Clicks", "Meta Ads"],
  ["reach", "Reach", "Meta Ads"],
  ["ctr", "CTR (%)", "Meta Ads"],
  ["cpc", "CPC ($)", "Meta Ads"],
  ["cpm", "CPM ($)", "Meta Ads"],
  ["meta_leads", "Meta Leads", "Meta Ads"],
  ["meta_conversion", "Meta Conversion (%)", "Meta Ads"],
  ["cpl", "Cost Per Lead ($)", "Meta Ads"],
  ["cost_per_result", "Cost Per Result ($)", "Meta Ads"],
  ["frequency", "Ad Frequency", "Meta Ads"],
  ["ghl_leads", "GHL Leads", "GoHighLevel"],
  ["ghl_conversion", "GHL Conversion (%)", "GoHighLevel"],
  ["ghl_revenue", "GHL Revenue", "GoHighLevel"],
  ["ghl_won_opps", "Won Opps", "GoHighLevel"],
  ["ghl_lost_opps", "Lost Opps", "GoHighLevel"],
  ["ghl_open_opps", "Open Opps", "GoHighLevel"],
  ["ghl_abandoned_opps", "Abandoned Opps", "GoHighLevel"],
  ["ghl_total_opps", "Total Opps", "GoHighLevel"],
  ["hp_leads", "Call Center Leads", "Call Center"],
  ["hp_total_calls", "Total Calls", "Call Center"],
  ["hp_inbound", "Inbound Calls", "Call Center"],
  ["hp_outbound", "Outbound Calls", "Call Center"],
  ["hp_transfers", "Call Transfers", "Call Center"],
  ["hp_leads_with_calls", "Leads Called", "Call Center"],
  ["hp_answered_calls", "Answered Calls", "Call Center"],
  ["hp_talk_time", "Talk Time (min)", "Call Center"],
  ["hp_connect_rate", "Connect Rate (%)", "Call Center"],
  ["hp_answer_rate", "Answer Rate (%)", "Call Center"],
  ["hp_agent_outbound", "Agent Outbound Calls", "Call Center Agents"],
  ["hp_agent_inbound", "Agent Inbound Calls", "Call Center Agents"],
  ["hp_agent_dialed", "Agent Total Dials", "Call Center Agents"],
  ["hp_agent_answered", "Agent Answered Calls", "Call Center Agents"],
  ["hp_agent_convos", "Conversations", "Call Center Agents"],
  ["hp_agent_appts", "Appointments Set", "Call Center Agents"],
  ["hp_agent_talk_min", "Agent Talk Time (min)", "Call Center Agents"],
  ["hp_agent_sms", "SMS Sent", "Call Center Agents"],
  ["hp_agent_answer_rate", "Agent Answer Rate (%)", "Call Center Agents"],
];

/**
 * Everything a client alert can watch: the fixed metrics, one per GoHighLevel
 * tag (`tag:<name>`) and one per custom formula (`custom:<id>`). The ids are
 * the ones the old page saved.
 * @param {{availableTags?: string[], customMetrics?: {id: string, name: string}[]}} [sources]
 * @returns {{id: string, label: string, category: string}[]}
 */
export function alertMetricOptions({ availableTags = [], customMetrics = [] } = {}) {
  return [
    ...BASE_METRICS.map(([id, label, category]) => ({ id, label, category })),
    ...availableTags.map((tag) => ({ id: `tag:${tag}`, label: tag, category: "Tags" })),
    ...customMetrics.map((m) => ({ id: `custom:${m.id}`, label: m.name, category: "Custom Formula" })),
  ];
}

/** A metric id's name, client or creative; the id itself when nothing knows it. */
export function metricName(id, options = []) {
  return (
    options.find((m) => m.id === id)?.label
    ?? BASE_METRICS.find(([v]) => v === id)?.[1]
    ?? CREATIVE_METRIC_OPTIONS.find((m) => m.value === id)?.label
    ?? (typeof id === "string" && id.startsWith("tag:") ? id.slice(4) : id)
  );
}

/** Every GoHighLevel tag any client has seen, for the tag metrics. */
export function tagsFromGroups(groups) {
  const tags = new Set();
  for (const g of groups ?? []) {
    const breakdown = g.gohighlevel?.metrics?.tag_breakdown || g.gohighlevel_cache?.metrics?.tag_breakdown || {};
    for (const tag of Object.keys(breakdown)) tags.add(tag);
  }
  return [...tags].sort();
}

// ── The editor's form ─────────────────────────────────────────────────────────

/** A blank alert. The same defaults the old page started from. */
export const BLANK_FORM = { ...EMPTY_FORM, tracking_mode: "total", scope: "clients", creative_test_ids: [] };

/** An existing alert, as the editor's form. */
export function formFromAlert(alert) {
  return {
    name: alert.name || "",
    description: alert.description || "",
    type: alert.type || "warning",
    metric: alert.condition?.metric || "lead_count",
    operator: alert.condition?.operator || "gt",
    value: String(alert.condition?.value ?? "0"),
    period: alert.condition?.period || "day",
    target_group_ids: alert.target_group_ids || [],
    notification_channels: alert.notification_channels || ["in_app"],
    frequency: alert.frequency || "daily",
    tracking_mode: alert.tracking_mode || "total",
    scope: alert.scope || "clients",
    creative_test_ids: alert.creative_test_ids || [],
  };
}

/** The fixed condition a creative metric fires on, or null when it takes a threshold. */
export function fixedCondition(form) {
  return form.scope === "creative_tests" ? CREATIVE_NO_THRESHOLD[form.metric] ?? null : null;
}

/** Switch between watching clients and watching creative tests; each starts on its own metric. */
export function withScope(form, scope) {
  if (form.scope === scope) return form;
  return scope === "creative_tests"
    ? { ...form, scope, metric: "creative_verdict", operator: "eq", value: "1" }
    : { ...form, scope, metric: "spend", operator: "gt", value: "0" };
}

/** Pick a creative metric: a fixed one sets its own operator, and leaving one clears the value. */
export function withCreativeMetric(form, metric) {
  const fixed = CREATIVE_NO_THRESHOLD[metric];
  const operator = fixed ? fixed.operator : CREATIVE_OPERATOR_OPTIONS.some((o) => o.value === form.operator) ? form.operator : "gt";
  const wasFixed = !!CREATIVE_NO_THRESHOLD[form.metric];
  return { ...form, metric, operator, value: wasFixed && !fixed ? "" : form.value };
}

/** Add or drop one id from a list. */
export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Turn one channel on or off, leaving the others as they are. */
export function withChannel(channels, channel, on) {
  const rest = (channels ?? []).filter((c) => c !== channel);
  return on ? [...rest, channel] : rest;
}

/** What is wrong with the form, field by field; empty when it can be saved. */
export function formProblems(form) {
  const problems = {};
  if (!form.name.trim()) problems.name = "Give this alert a name.";
  if (!fixedCondition(form) && (form.value === "" || form.value == null || Number.isNaN(Number(form.value)))) {
    problems.value = "Enter a number.";
  }
  return problems;
}

/** The body POST /api/alerts and PATCH /api/alerts/:id take. */
export function alertPayload(form) {
  const fixed = fixedCondition(form);
  const creative = form.scope === "creative_tests";
  return {
    name: form.name,
    description: form.description,
    type: form.type,
    condition: {
      metric: form.metric,
      operator: fixed ? fixed.operator : form.operator,
      value: fixed ? fixed.value : Number(form.value),
      period: form.period,
    },
    scope: form.scope,
    creative_test_ids: creative ? form.creative_test_ids : [],
    target_group_ids: creative ? [] : form.target_group_ids,
    notification_channels: form.notification_channels,
    frequency: form.frequency,
    tracking_mode: form.tracking_mode,
  };
}

/** The operators a form offers: creative metrics have no percent change. */
export function operatorOptions(form) {
  return form.scope === "creative_tests" ? CREATIVE_OPERATOR_OPTIONS : OPERATOR_OPTIONS;
}

export { CREATIVE_METRIC_OPTIONS, FREQUENCY_OPTIONS, PERIOD_OPTIONS };

/** What "Total" and "Per client" mean for this form. */
export function trackingHelp(form) {
  const creative = form.scope === "creative_tests";
  if (form.tracking_mode === "total") {
    return creative
      ? "Fires when the combined value across the selected tests crosses the threshold."
      : "Fires when the combined value across the selected clients crosses the threshold.";
  }
  return creative
    ? "Fires separately for each ad account that crosses the threshold on its own."
    : "Fires separately for each client that crosses the threshold on its own.";
}

/** "Per client", or "Per account" for creative tests. */
export const perLabel = (scope) => (scope === "creative_tests" ? "Per account" : "Per client");

/** The form read back as one sentence, under the editor's fields. */
export function formSentence(form, options) {
  const fixed = fixedCondition(form);
  const metric = metricName(form.metric, options);
  const when = fixed ? fixed.hint.replace(/\.$/, "").replace(/^Fires/, "fires") : `fires when ${metric} ${conditionSummary({ condition: { ...alertPayload(form).condition } })}`;
  const period = PERIOD_OPTIONS.find((p) => p.value === form.period)?.label.toLowerCase();
  const creative = form.scope === "creative_tests";
  const count = creative ? form.creative_test_ids.length : form.target_group_ids.length;
  const targets = creative
    ? count ? `${count} test${count === 1 ? "" : "s"}` : "every live test"
    : count ? `${count} client${count === 1 ? "" : "s"}` : "no clients yet";
  const how = form.tracking_mode === "per_client" ? (creative ? "each account on its own" : "each client on its own") : "combined";
  return `${form.name.trim() || "This alert"} ${when}${fixed ? "" : `, ${period}`}, across ${targets} (${how}).`;
}

// ── How a rule reads in a row ─────────────────────────────────────────────────

/** The row's condition, e.g. "Total Spend > 500 · Yesterday". */
export function conditionLine(alert, options) {
  const c = alert.condition ?? {};
  const fixedText = isCreativeMetric(c.metric) && CREATIVE_NO_THRESHOLD[c.metric];
  const summary = conditionSummary(alert).replace(/\s+vs .*$/, "");
  const period = PERIOD_OPTIONS.find((p) => p.value === c.period)?.label;
  const pct = c.operator === "pct_drop" || c.operator === "pct_rise";
  return [`${metricName(c.metric, options)} ${fixedText ? `· ${summary}` : summary}`, period && (pct ? `vs ${period.toLowerCase()}` : period)].filter(Boolean).join(" · ");
}

/** The status pill: tone and words. A paused rule with a snooze end is "Snoozed". */
export function statusOf(alert) {
  if (alert.status === "triggered") return { tone: "danger", label: "Triggered" };
  if (alert.status === "paused") return alert.snoozed_until ? { tone: "warning", label: "Snoozed" } : { tone: "neutral", label: "Paused" };
  if (alert.status === "active") return { tone: "success", label: "Watching" };
  return { tone: "neutral", label: alert.status || "Unknown" };
}

/** Whether a rule is switched on: watching or fired. */
export const isOn = (alert) => alert.status === "active" || alert.status === "triggered";

/** The status a rule's switch sets, as the old page's Pause and Activate did. */
export const nextStatus = (alert) => (isOn(alert) ? "paused" : "active");

const CURRENCY = new Set(["spend", "cpc", "cpm", "cpl", "cost_per_result", "ghl_revenue", "creative_cpl"]);
const PERCENT = new Set(["ctr", "meta_conversion", "ghl_conversion", "hp_connect_rate", "hp_answer_rate", "hp_agent_answer_rate", "creative_ctr", "creative_hook_rate"]);

/** A figure in its metric's unit: "$12.40", "3.1%" or "1,204". */
export function formatFigure(value, metric, operator) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (operator === "pct_drop" || operator === "pct_rise" || PERCENT.has(metric)) return `${n.toFixed(1)}%`;
  if (CURRENCY.has(metric)) return `$${n.toFixed(2)}`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * How close a rule is to firing. `null` until it has been evaluated: the API
 * sends `current_value` once a check has run.
 * @returns {{pct: number, current: string, threshold: string, line: string, tone: "danger"|"warning"|"accent"} | null}
 */
export function progressOf(alert) {
  if (alert.current_value == null) return null;
  const c = alert.condition ?? {};
  const pct = Math.min(100, Math.max(0, Number(alert.progress_pct ?? 0)));
  const fired = alert.status === "triggered";
  const op = { gt: ">", lt: "<", eq: "=", neq: "≠", pct_drop: "↓", pct_rise: "↑" }[c.operator] ?? c.operator;
  const threshold = c.operator === "pct_drop" || c.operator === "pct_rise" ? `${Number(c.value).toFixed(1)}%` : formatFigure(c.value, c.metric);
  return {
    pct: fired ? 100 : pct,
    current: formatFigure(alert.current_value, c.metric, c.operator),
    threshold: `${op} ${threshold}`,
    line: fired ? "Fired" : `${pct.toFixed(0)}% to firing`,
    tone: fired ? "danger" : pct >= 80 ? "warning" : "accent",
  };
}

/** Who a rule watches, in a few words. */
export function targetsLine(alert, testCodes = {}) {
  if (alert.scope === "creative_tests") {
    const ids = alert.creative_test_ids ?? [];
    const what = ids.length === 0 ? "All live tests" : ids.length <= 2 ? ids.map((id) => testCodes[id] || id).join(", ") : `${ids.length} tests`;
    return `${what} · ${alert.tracking_mode === "per_client" ? "Per account" : "Total"}`;
  }
  const ids = alert.target_group_ids ?? [];
  if (!ids.length) return "All clients · Total";
  const names = alert.target_group_names?.length ? alert.target_group_names : ids;
  const what = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  return `${what} · ${alert.tracking_mode === "per_client" ? "Per client" : "Total"}`;
}

/**
 * The Triggered tab's rows. A per-client rule that fired comes back as one
 * row per client (`_virtual`); those fold under one entry for their rule.
 * @returns {{key: string, alert: object, clients: object[]}[]}
 */
export function groupTriggered(rows) {
  const groups = new Map();
  for (const row of rows ?? []) {
    if (!row._virtual) {
      groups.set(`real_${row.id}`, { key: `real_${row.id}`, alert: row, clients: [] });
      continue;
    }
    const key = `group_${row.id}`;
    if (!groups.has(key)) {
      const { _virtual, _virtual_id, _client_id, _client_name, _client_value, _client_progress, ...alert } = row;
      groups.set(key, { key, alert: { ...alert, status: "triggered" }, clients: [] });
    }
    groups.get(key).clients.push(row);
  }
  return [...groups.values()];
}

/** Every rule in the list GET /api/alerts returns, once each (fanned-out rows folded back). */
export function allRules(data) {
  if (Array.isArray(data?.alerts)) return data.alerts;
  const seen = new Map();
  for (const k of ["active", "triggered", "paused"]) for (const a of data?.[k] ?? []) if (!seen.has(a.id)) seen.set(a.id, a);
  return [...seen.values()];
}

// ── Fired history ─────────────────────────────────────────────────────────────

/**
 * GET /api/alerts/notifications' entries, each with its rule's name (when the
 * rule still exists), newest first.
 */
export function historyRows(notifications, rules) {
  const names = new Map((rules ?? []).map((r) => [r.id, r.name]));
  return [...(notifications ?? [])]
    .sort((a, b) => String(b.triggered_at ?? "").localeCompare(String(a.triggered_at ?? "")))
    .map((n, i) => ({
      key: n.id ?? n._id ?? `${n.alert_id}-${n.triggered_at}-${i}`,
      rule: names.get(n.alert_id) ?? null,
      // A per-client fire's message starts "[Client] "; the client is shown on its own.
      message: n.group_name && (n.message || "").startsWith(`[${n.group_name}] `) ? n.message.slice(n.group_name.length + 3) : n.message || "",
      client: n.group_name || null,
      at: n.triggered_at ?? null,
      value: n.current_value,
      unread: n.read === false,
    }));
}

// lib/metric-sources.js
// Maps a catalog metric's backend category onto the six sources the Metrics
// Hub design paints, and onto the tab that filters for it.
//
// The design mocks its own metric list ("Revenue", "Suggestions Sent"…) — those
// names don't exist. What is real comes from routers/metrics.py, whose
// categories are finer-grained than the design's six badges: Meta account-level
// and campaign-level metrics are two categories but one source, and the call
// centre splits group- from agent-level the same way. The badge answers "where
// does this number come from", so both halves of each pair collapse into one.

/** Badge palette, straight from the handoff. */
export const SOURCE_STYLES = {
  meta: { label: "Meta Ads", color: "#3B7DD6", bg: "#EAF1FD", border: "#D6E6FA" },
  ghl: { label: "GoHighLevel", color: "#25A55F", bg: "#EDF8F1", border: "#D5EEDF" },
  // Named for the system the numbers come out of, not the department they
  // describe — "Sales" left the row unable to answer the one question the
  // column asks. Every call-centre metric in the catalog is an `hp_*` field
  // pulled from HotProspector, the only dialler wired to Birdy; the day a
  // second one lands, this splits by metric rather than by category.
  sales: { label: "HotProspector", color: "#B4530A", bg: "#FDF1E7", border: "#F5DDC0" },
  birdy: { label: "Birdy", color: "#6B4EE6", bg: "#F1EEFC", border: "#E3DAFB" },
  tag: { label: "Tags", color: "#C93B8C", bg: "#FCEDF6", border: "#F5D6EA" },
  custom: { label: "Custom Formula", color: "#6B4EE6", bg: "#F1EEFC", border: "#E3DAFB" },
}

const CATEGORY_TO_SOURCE = {
  "Meta Ads": "meta",
  Campaigns: "meta",
  GoHighLevel: "ghl",
  // opportunityValue — a GHL opportunity field, catalogued separately only
  // because it resolves per lead rather than per group.
  "Lead Fields": "ghl",
  "Call Center": "sales",
  "Call Center Agents": "sales",
  // Ratios Birdy derives rather than reads: conversion rate, CPL, engagement.
  Calculated: "birdy",
  Tags: "tag",
  "Custom Formula": "custom",
}

/**
 * The two catalogue categories whose metrics only exist because a call centre
 * reported them. Both map to the `sales` badge above; they are named again
 * here because "which badge does this wear" and "does this number have a
 * source for this client" are different questions with the same answer today
 * and no guarantee of it tomorrow.
 */
export const CALL_CENTRE_CATEGORIES = ["Call Center", "Call Center Agents"];

/**
 * Every metric id in the backend catalogue that a call centre — and only a
 * call centre — can answer. Transcribed from `base_metrics` in
 * birdy-backend/routers/metrics.py, which is the source of truth for what
 * exists and which category it sits in.
 *
 * Enumerated rather than derived because the list is what a client with
 * `call_log_provider: "none"` has no source for, and that has to be readable
 * by anyone auditing which figures Birdy greys out. When a metric is added to
 * either category upstream, it belongs here too — isCallCentreMetric is the
 * only thing that reads it, and a missing id shows up as a stray `0` on a
 * screen that has nothing behind it.
 *
 * Note what is deliberately *not* here: `conversion_rate`, `cost_per_lead` and
 * the GHL opportunity metrics. A close rate is Meta leads over GHL wins; it
 * survives a client having no dialler and must keep its real value, even when
 * it is drawn in a card called "Call insights".
 */
export const CALL_CENTRE_METRIC_IDS = [
  // "Call Center" — per client, windowed by the selected date preset.
  "hp_leads",
  "hp_total_calls",
  "hp_inbound",
  "hp_outbound",
  "hp_transfers",
  "hp_leads_with_calls",
  "hp_answered_calls",
  "hp_talk_time",
  "hp_connect_rate",
  "hp_answer_rate",
  // "Call Center Agents" — per agent, account-wide (the Sales Hub's Members
  // tab). No per-client filter exists upstream, so these dim only when the
  // whole account has no dialler.
  "hp_agent_outbound",
  "hp_agent_inbound",
  "hp_agent_dialed",
  "hp_agent_answered",
  "hp_agent_convos",
  "hp_agent_appts",
  "hp_agent_talk_min",
  "hp_agent_sms",
  "hp_agent_answer_rate",
];

const CALL_CENTRE_METRIC_SET = new Set(CALL_CENTRE_METRIC_IDS);

/**
 * Is this catalogue metric one a client without a call centre cannot have?
 *
 * Custom formulas are not resolved here. A formula that references an `hp_*`
 * field is only as available as its inputs, but that is a question for
 * whatever evaluates the formula — this answers for base metrics only, and
 * says no for anything it doesn't recognise so an unknown id keeps its value.
 */
export function isCallCentreMetric(metricId) {
  return CALL_CENTRE_METRIC_SET.has(metricId);
}

/** Same question, asked of a catalogue row's `category`. */
export function isCallCentreCategory(category) {
  return CALL_CENTRE_CATEGORIES.includes(category);
}

/**
 * @param {string} category Backend `category`, or "Custom Formula".
 * @returns {"meta"|"ghl"|"sales"|"birdy"|"tag"|"custom"} Falls back to `birdy`
 *   — a category we haven't mapped is something Birdy computed, and a neutral
 *   purple badge beats an empty cell or a wrong logo.
 */
export function sourceForCategory(category) {
  return CATEGORY_TO_SOURCE[category] || "birdy"
}

/** Tab strip, in the design's order. `all` first, custom formulas last. */
export const SOURCE_TABS = [
  { key: "all", label: "All Metrics" },
  { key: "ghl", label: "GHL Metrics" },
  { key: "meta", label: "Meta Metrics" },
  { key: "sales", label: "Sales Metrics" },
  { key: "birdy", label: "Birdy Metrics" },
  { key: "tag", label: "Tag Metrics" },
  { key: "custom", label: "Custom Formulas" },
]

export function matchesSourceTab(tab, source) {
  return tab === "all" || tab === source
}

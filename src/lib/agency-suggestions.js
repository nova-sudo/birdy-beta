// Shaping for Birdy's Suggestions tab, from the dashboard summary the app already serves.

import { isChangeActivity } from "@/lib/activity";

const IMPACT = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const TONE = { CRITICAL: "danger", HIGH: "danger", MEDIUM: "warning", LOW: "accent" };

/**
 * What the tab lists, from `/api/dashboard/summary`.
 * Suggestions come back most impact first. History keeps what was done and what was dismissed
 * (not Birdy's read-only analysis passes or the suggestions themselves), newest first as served.
 */
export function shapeSummary(data) {
  const suggestions = (data?.suggestions ?? [])
    .map((s, order) => {
      const severity = String(s.severity ?? "MEDIUM").toUpperCase();
      return {
        id: s.id,
        title: s.title ?? "",
        why: s.description ?? s.why ?? "",
        client: s.client ?? "",
        severity,
        tone: TONE[severity] ?? "warning",
        agentId: s.agent_id ?? null,
        // Where it acts ("Meta Ads") and which rule raised it: how a section tells its own suggestions apart.
        platform: s.platform ?? "",
        ruleKind: s.rule_kind ?? "",
        order,
      };
    })
    .sort((a, b) => (IMPACT[a.severity] ?? 2) - (IMPACT[b.severity] ?? 2) || a.order - b.order);

  const dismissed = (a) => a?.kind === "suggestion_dismissed";
  const history = (data?.activity ?? []).filter((a) => dismissed(a) || isChangeActivity(a)).map((a) => ({
    id: a.id,
    what: a.title ?? a.action ?? "",
    client: a.client ?? "",
    // A suggestion turned down, what Birdy did on standing approval, or what a person signed off.
    mode: dismissed(a) ? "Dismissed" : a.actor === "birdy" ? "Auto-run" : "Approved",
    when: a.time ?? "",
  }));

  return { suggestions, history };
}

const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/** Only the rows about one client, matched on its name (the summary carries no client id). */
export const forClient = (rows, clientName) => (clientName ? rows.filter((r) => same(r.client, clientName)) : rows);

/**
 * The page's heading for a number of suggestions.
 * @param {string|null} [from] the section's name when it is not Birdy: "8 suggestions from Media Buyer"
 */
export function suggestionsHeading(count, clientName, from = null) {
  if (count === 0) return clientName ? `No suggestions for ${clientName}` : "All looking good";
  return `${count} ${count === 1 ? "suggestion" : "suggestions"} ${clientName ? `for ${clientName}` : from ? `from ${from}` : "across your agency"}`;
}

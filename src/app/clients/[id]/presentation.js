// What the client workspace says about its data. The page is composition and
// wiring; the wording and the shaping into BirdyRead rows live here so they can
// be tested without rendering.

import { AT_RISK, BEHIND, formatGoal } from "@/lib/client-goals";

const MAX_FINDINGS = 5;

// Worst first, so the cap drops good news before it drops a problem.
const TONE_ORDER = ["danger", "warning", "info", "success", "neutral"];

const count = (n) => Math.round(n ?? 0).toLocaleString();

/**
 * The window in one row. Leads are Meta's results, the figure CPL and the goals
 * strip use; the CRM cohort (what the funnel counts) is named as such in the
 * detail, so the two numbers explain each other instead of contradicting. States
 * figures only: no trend and no cause, because this page holds no comparison to
 * back one.
 */
function summaryFinding(group, currencySymbol) {
  const funnel = group?.gohighlevel?.metrics?.funnel;
  const insights = group?.facebook?.metrics?.insights ?? {};
  const spend = Number(insights.spend) || 0;
  const metaLeads = Number(insights.results) || Number(insights.total_leads) || 0;
  const crmLeads = Number(funnel?.leads) || 0;
  const leads = metaLeads || crmLeads;

  if (!leads) {
    return {
      id: "summary",
      tone: "neutral",
      title: "No leads recorded in this window yet",
      detail: "Once data comes through, this is where the period is summarised.",
    };
  }

  const detail = [];
  if (metaLeads && funnel) detail.push(`${count(crmLeads)} reached the CRM`);
  const closes = Number(funnel?.closes) || 0;
  detail.push(closes > 0 ? `${count(closes)} ${closes === 1 ? "has" : "have"} closed` : "none closed yet");

  return {
    id: "summary",
    tone: "info",
    title: spend > 0 ? `${count(leads)} leads from ${currencySymbol}${count(spend)} of ad spend` : `${count(leads)} leads`,
    detail: detail.join(" · "),
  };
}

/**
 * Birdy's read of one client: the window's summary, each monthly target the
 * client is behind on, and the funnel verdict when there is a previous window
 * to base one on.
 *
 * @param {object} args
 * @param {object|null} args.group the client group
 * @param {object[]} args.goals the output of buildClientGoals
 * @param {{state: "problem"|"healthy", title: string, body: string}|null} args.diagnosis
 * @param {boolean} args.hasComparison whether the funnel carries movement
 * @param {string} args.currencySymbol
 * @param {() => void} [args.onViewCalls] the action on a funnel problem
 * @param {() => void} [args.onDismissDiagnosis] hides the funnel verdict
 * @returns {{id: string, tone: string, title: string, detail?: string, action?: object, onDismiss?: () => void}[]}
 */
export function clientFindings({
  group,
  goals = [],
  diagnosis = null,
  hasComparison = false,
  currencySymbol = "$",
  onViewCalls,
  onDismissDiagnosis,
}) {
  if (!group) return [];

  const rows = [summaryFinding(group, currencySymbol)];

  // Only the goals with a target say anything. One the agency never set has no
  // opinion attached, so it is left out rather than counted as met.
  for (const goal of goals) {
    if (goal.state !== BEHIND && goal.state !== AT_RISK) continue;
    rows.push({
      id: `goal-${goal.id}`,
      tone: goal.state === BEHIND ? "danger" : "warning",
      title: `${goal.label} is ${goal.state.toLowerCase()}`,
      detail: `${formatGoal(goal.value, goal.format, currencySymbol)} of a ${formatGoal(goal.target, goal.format, currencySymbol)} target`,
    });
  }

  if (hasComparison && diagnosis?.body) {
    const problem = diagnosis.state === "problem";
    rows.push({
      id: "funnel",
      tone: problem ? "danger" : "success",
      title: diagnosis.title,
      detail: diagnosis.body,
      action: problem && onViewCalls ? { label: "View calls", onClick: onViewCalls } : undefined,
      onDismiss: onDismissDiagnosis,
    });
  }

  // Array#sort is stable: within a tone, rows keep the order above.
  return rows.sort((a, b) => TONE_ORDER.indexOf(a.tone) - TONE_ORDER.indexOf(b.tone)).slice(0, MAX_FINDINGS);
}

/**
 * Does this client have a call centre at all? — one definition, used everywhere.
 *
 * The onboarding wizard's sales step has three answers, and the third one is
 * "I don't currently call my leads". That answer is stored on the client group
 * as `call_log_provider: "none"`, alongside the two real diallers ("ghl" and
 * "hotprospector"), and it is the single signal every downstream screen reads.
 *
 * The bug this exists to prevent is subtler than a missing feature. Every
 * call-centre figure in Birdy is a sum over `hotprospector.call_stats` or
 * `hotprospector.daily_calls`, and a client with no call centre has neither —
 * so every one of those sums lands on a perfectly formatted `0`. A reader
 * cannot tell that apart from a client whose call centre had a dead week, and
 * the two mean opposite things: one is "nothing happened", the other is "we
 * have no source for this". So the rule is: where the source does not exist,
 * render the placeholder, never the zero.
 *
 * Two entry points because two screens ask two different questions:
 *
 *   scopeHasCallCentre  the Sales Hub, which is filtered to one client or to
 *                       all of them, and does not filter by client status —
 *                       matching sumCallStats, which feeds the same tiles.
 *   portfolioHasCallCentre
 *                       the Portfolio Dashboard, which rolls up the *active*
 *                       clients only — matching aggregatePortfolio, which
 *                       feeds the same numbers.
 *
 * Both answer "is there at least one client in view whose figures could be
 * real", because a mixed portfolio still has genuine sums; it is the all-none
 * case that has nothing behind it. What a "none" client contributes to a mixed
 * aggregate is a separate question — see lib/portfolio-aggregate.js and the
 * note on calls-per-close there.
 */

import { activeGroups } from "./client-status";

/** The stored `call_log_provider` meaning "no call-centre integration". */
export const NO_CALL_CENTRE = "none";

/**
 * Where the reader goes to fix it.
 *
 * Settings → Integrations already owns the HotProspector connect dialog, and
 * its tab is addressable, so the CTA points at the flow that exists rather
 * than at a second one invented for this state.
 */
export const LINK_SALES_TOOL_HREF = "/settings?tab=integrations";

/**
 * Is a call centre wired up for this client group?
 *
 * Absent reads as *yes*, deliberately. The field only started being projected
 * with this change, and the API's own fallback for a group created before the
 * third option existed is "ghl" — so a missing value means "we don't know",
 * and greying out a client's real call figures because a payload was stale is
 * a worse failure than the zero this is replacing.
 */
export function groupHasCallCentre(group) {
  return String(group?.call_log_provider ?? "").trim().toLowerCase() !== NO_CALL_CENTRE;
}

/**
 * The Sales Hub's question, for whichever client the picker is on.
 *
 * @param {object[]} clientGroups every group on the page
 * @param {string} selectedClientGroup a group id, or "all"
 *
 * An id that matches nothing reads as available for the same reason a missing
 * field does: the list is probably still loading, and a screen that greys
 * itself out mid-fetch and then fills in is worse than one that waits.
 */
export function scopeHasCallCentre(clientGroups, selectedClientGroup = "all") {
  const groups = clientGroups ?? [];

  if (selectedClientGroup && selectedClientGroup !== "all") {
    const group = groups.find((g) => g.id === selectedClientGroup);
    return group ? groupHasCallCentre(group) : true;
  }

  // An empty portfolio is not a portfolio without a call centre — there is
  // nothing to say either way, and the screens above this already have their
  // own "no clients yet" states.
  return groups.length === 0 || groups.some(groupHasCallCentre);
}

/** The Portfolio Dashboard's question: does any *active* client dial? */
export function portfolioHasCallCentre(clientGroups) {
  const active = activeGroups(clientGroups);
  return active.length === 0 || active.some(groupHasCallCentre);
}

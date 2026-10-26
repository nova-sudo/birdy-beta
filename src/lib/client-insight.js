// The Ask Birdy prompt for the Birdy Insights card on Client Detail.
//
// The card's own copy is now written by the page; this keeps the question its
// "Ask Birdy about this" link sends.

import { ON_TRACK, BEHIND, AT_RISK } from "./client-goals";

/** The question the card's "Ask Birdy about this" link sends. */
export function clientInsightPrompt(group, goals = []) {
  const name = group?.name || "this client";
  const behind = goals
    .filter((g) => g.state === BEHIND || g.state === AT_RISK)
    .map((g) => g.label.toLowerCase());

  if (behind.length === 0) {
    return `How is ${name} performing this month, and what should I watch?`;
  }
  return `${name} is behind on ${behind.join(" and ")}. What is driving that, and what should I do?`;
}

export { ON_TRACK };

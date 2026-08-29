// The copy in the Birdy Insights card on Client Detail.
//
// Same discipline as saleshub-insight: this states the window's figures and
// what the client's own targets say about them. It does not claim a trend, a
// cause, or a ranking — the design's sample copy names "the biggest risk" and
// a period-over-period movement, both of which would need a comparison this
// page does not hold. Reporting a made-up delta in a card headed "Birdy
// Insights" is exactly how a dashboard loses trust.
//
// Parts rather than a string so the card can render figures in solid white
// against the body's 88%, the way the design draws them. `strong: true` marks
// a part for that treatment.

import { ON_TRACK, BEHIND, AT_RISK } from "./client-goals";

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n ?? 0).toLocaleString();

/**
 * @param {object} group    the client group
 * @param {object[]} goals  the output of buildClientGoals
 * @param {string} currencySymbol
 */
export function buildClientInsight(group, goals = [], currencySymbol = "$") {
  const funnel = group?.gohighlevel?.metrics?.funnel;
  const spend = Number(group?.facebook?.metrics?.insights?.spend) || 0;
  const name = group?.name || "This client";

  if (!funnel || !funnel.leads) {
    return [
      plain(`No leads recorded for ${name} in this window yet. Once data comes through, this is where the period's figures will be summarised.`),
    ];
  }

  const parts = [
    plain(`${name} brought in `),
    strong(`${count(funnel.leads)} leads`),
  ];

  if (spend > 0) {
    parts.push(
      plain(" from "),
      strong(`${currencySymbol}${count(spend)}`),
      plain(" of ad spend")
    );
  }

  if (funnel.closes > 0) {
    parts.push(
      plain(", closing "),
      strong(`${count(funnel.closes)}`),
      plain(funnel.closes === 1 ? " of them" : " of them")
    );
  }

  parts.push(plain("."));

  // Only the goals with a target say anything. A goal the agency never set has
  // no opinion attached to it, so it is left out rather than counted as met.
  const measured = goals.filter((g) => g.state);
  const behind = measured.filter((g) => g.state === BEHIND || g.state === AT_RISK);

  if (measured.length === 0) {
    parts.push(
      plain(" No monthly targets are set yet, so there is nothing to measure this against.")
    );
  } else if (behind.length === 0) {
    parts.push(plain(" Every monthly target is "), strong("on track"), plain("."));
  } else {
    parts.push(plain(" Behind on "));
    behind.forEach((goal, i) => {
      if (i > 0) parts.push(plain(i === behind.length - 1 ? " and " : ", "));
      parts.push(strong(goal.label.toLowerCase()));
    });
    parts.push(plain("."));
  }

  return parts;
}

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

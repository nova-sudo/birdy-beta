// The copy in the Lead Hub's Birdy Insights card.
//
// Sibling to saleshub-insight.js: states real figures rather than inventing
// prose, and only reaches for a comparison when one actually exists (a
// previous window, or — for the anomaly clause — more than one client group
// in scope). Two things beyond Sales-Hub's version:
//
//   Conversion rate moves in *points*, not percent. A relative percentDelta
//   of a percentage (e.g. "2.6% is down 15% relative to 3.1%") reads as a
//   different, more alarming number than the plain point difference the
//   design shows ("▼0.4pts") — so this computes the point difference itself
//   rather than reusing percentDelta for that one figure.
//
//   The anomaly clause names the single most actionable pattern Birdy found
//   — currently "which client group has the most contacts with no email
//     captured" (routers/client_groups.py's get_unified_leads computes this
//     as meta.stats.top_missing_email_group, scoped to the same filter as
//     everything else on the page). It only appears when the backend found
//     one — which it only looks for when more than one group is in scope,
//     since a "worst of one" comparison says nothing.

import { percentDelta } from "./portfolio-aggregate";

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n ?? 0).toLocaleString();
const pct = (n) => (n ?? 0).toFixed(1);

/**
 * Build the card's copy for the period.
 *
 * @param {{lead_count, contact_count, conversion_rate}} totals the window's summed figures (leadhub-totals.js)
 * @param {{lead_count, conversion_rate}|null} previousTotals the preceding window's, for the movement clauses
 * @param {{name: string, count: number}|null} anomaly the worst-offending client group, if one was found
 * @returns {{text: string, strong: boolean}[]}
 */
export function buildLeadInsight(totals, previousTotals, anomaly) {
  const t = totals ?? {};

  if (!t.lead_count && !t.contact_count) {
    return [
      plain(
        "No leads or contacts captured in this window yet. Once forms and calls start coming in, this is where the period's figures will be summarised."
      ),
    ];
  }

  const parts = [plain("Lead volume is ")];

  const leadDelta = previousTotals ? percentDelta(t.lead_count, previousTotals.lead_count) : null;
  if (leadDelta) {
    parts.push(strong(`${leadDelta.direction === "up" ? "up" : "down"} ${leadDelta.delta}`));
  } else {
    parts.push(strong(`${count(t.lead_count)} leads`));
  }

  const convPts = previousTotals != null ? t.conversion_rate - previousTotals.conversion_rate : null;
  if (convPts != null && Math.abs(convPts) >= 0.05) {
    parts.push(
      plain(convPts < 0 ? ", but conversion has fallen to " : ", and conversion has risen to "),
      strong(`${pct(t.conversion_rate)}%`)
    );
  } else {
    parts.push(plain(" this period. Conversion is at "), strong(`${pct(t.conversion_rate)}%`));
  }
  parts.push(plain("."));

  if (anomaly?.name && anomaly.count > 0) {
    parts.push(
      plain(" "),
      strong(anomaly.name),
      plain(
        ` has ${count(anomaly.count)} contacts with no email captured — fixing that form would unlock your largest untouched pool.`
      )
    );
  }

  return parts;
}

/** The question the card's footer link hands to the assistant. */
export function insightPrompt(parts) {
  return `About my Lead Hub this period: ${parts.map((p) => p.text).join("")} What should I do about it?`;
}

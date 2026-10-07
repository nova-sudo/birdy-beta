// The copy in the Lead Hub's Birdy briefing: one headline sentence and up to
// three findings beneath it.
//
// Sibling to saleshub-insight.js: states real figures rather than inventing
// prose, and only reaches for a comparison when one actually exists (a
// previous window, or — for the per-client findings — a client whose numbers
// clear a floor). Two things beyond Sales-Hub's version:
//
//   Conversion rate moves in *points*, not percent. A relative percentDelta
//   of a percentage (e.g. "2.6% is down 15% relative to 3.1%") reads as a
//   different, more alarming number than the plain point difference the
//   design shows ("▼0.4pts") — so this computes the point difference itself
//   rather than reusing percentDelta for that one figure.
//
//   The findings are where the anomalies live, so the headline stays one
//   sentence. The no-email one is the single most actionable pattern the
//   backend found — "which client group has the most contacts with no email
//   captured" (routers/client_groups.py's get_unified_leads computes this as
//   meta.stats.top_missing_email_group, scoped to the same filter as
//   everything else on the page). It only appears when the backend found
//   one — which it only looks for when more than one group is in scope,
//   since a "worst of one" comparison says nothing. The rest are summed here
//   from each client's daily series, the same rows the figures come from.

import { mergeDailyLeads, previousLeadTotals, windowLeadTotals } from "./leadhub-totals";
import { percentDelta } from "./portfolio-aggregate";

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n ?? 0).toLocaleString();
const pct = (n) => (n ?? 0).toFixed(1);

/**
 * Build the headline sentence for the period.
 *
 * @param {{lead_count, contact_count, conversion_rate}} totals the window's summed figures (leadhub-totals.js)
 * @param {{lead_count, conversion_rate}|null} previousTotals the preceding window's, for the movement clauses
 * @returns {{text: string, strong: boolean}[]}
 */
export function buildLeadInsight(totals, previousTotals) {
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

  return parts;
}

// Floors beneath which a per-client comparison is noise rather than news: a
// 50% drop from 4 leads to 2 is a slow Tuesday, not a finding.
const MIN_PREVIOUS_LEADS = 10;
const MIN_DROP_SHARE = 0.2;
const MIN_OPPORTUNITIES = 10;
const MIN_CONTACT_SHARE = 0.3;

/**
 * Up to three findings beneath the headline, in priority order: the no-email
 * anomaly, the client whose leads fell furthest, the client converting best,
 * and how much of the window's capture was contacts rather than form fills.
 * Each is skipped outright when the data to back it isn't there.
 *
 * @param {object[]} clientGroups every group on the page; only GHL-backed ones count
 * @param {string} selectedClientGroup a group id, or "all"
 * @param {string} datePreset the hub's date window
 * @param {{name: string, count: number}|null} [anomaly] the backend's worst no-email group, if found
 * @returns {{tone: string, parts: {text: string, strong: boolean}[]}[]}
 */
export function buildLeadFindings({ clientGroups, selectedClientGroup, datePreset, anomaly }) {
  const findings = [];

  if (anomaly?.name && anomaly.count > 0) {
    findings.push({
      tone: "warning",
      parts: [
        strong(anomaly.name),
        plain(
          ` has ${count(anomaly.count)} contacts with no email captured — fixing that form would unlock your largest untouched pool.`
        ),
      ],
    });
  }

  // Gated the way the headline totals are (mergeDailyLeads: any group with a
  // daily series), so a share quoted here agrees with the figure in the tab.
  const scoped = (clientGroups ?? []).filter(
    (g) =>
      g?.gohighlevel?.daily_leads?.length &&
      (!selectedClientGroup || selectedClientGroup === "all" || g.id === selectedClientGroup)
  );
  const perClient = scoped.map((g) => {
    const rows = mergeDailyLeads([g]);
    return {
      name: g.name,
      current: windowLeadTotals(rows, datePreset),
      previous: previousLeadTotals(rows, datePreset),
    };
  });

  const drop = perClient
    .filter((c) => c.previous && c.previous.lead_count >= MIN_PREVIOUS_LEADS)
    .map((c) => ({ ...c, share: (c.previous.lead_count - c.current.lead_count) / c.previous.lead_count }))
    .filter((c) => c.share >= MIN_DROP_SHARE)
    .sort((a, b) => b.share - a.share)[0];
  if (drop) {
    findings.push({
      tone: "danger",
      parts: [
        strong(drop.name),
        plain(" leads are down "),
        strong(`${Math.round(drop.share * 100)}%`),
        plain(` on the previous period (${count(drop.current.lead_count)} from ${count(drop.previous.lead_count)}).`),
      ],
    });
  }

  const eligible = perClient.filter(
    (c) => c.current.total_opportunities >= MIN_OPPORTUNITIES && c.current.won > 0
  );
  const best = [...eligible].sort((a, b) => b.current.conversion_rate - a.current.conversion_rate)[0];
  if (best) {
    findings.push({
      tone: "success",
      parts: [
        strong(best.name),
        // "Best" only means something against other clients; alone, it's just its rate.
        plain(eligible.length > 1 ? " converts best at " : " converts "),
        strong(`${pct(best.current.conversion_rate)}%`),
        plain(` of ${count(best.current.total_opportunities)} opportunities.`),
      ],
    });
  }

  const captured = perClient.reduce(
    (acc, c) => ({
      leads: acc.leads + c.current.lead_count,
      contacts: acc.contacts + c.current.contact_count,
    }),
    { leads: 0, contacts: 0 }
  );
  const total = captured.leads + captured.contacts;
  if (total > 0 && captured.contacts / total >= MIN_CONTACT_SHARE) {
    findings.push({
      tone: "info",
      parts: [
        strong(`${Math.round((captured.contacts / total) * 100)}%`),
        plain(" of captures were contacts with no form fill."),
      ],
    });
  }

  return findings.slice(0, 3);
}

/** The question the card's footer link hands to the assistant. */
export function insightPrompt(parts) {
  return `About my Lead Hub this period: ${parts.map((p) => p.text).join("")} What should I do about it?`;
}

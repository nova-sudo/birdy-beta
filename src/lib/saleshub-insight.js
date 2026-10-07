// The copy in Birdy's briefing card.
//
// Two layers. The headline (buildSalesInsight) states the window's figures
// and nothing else: the same numbers the tabs beside it report, summed from
// what the API returned. The findings beneath it (buildSalesFindings) are
// where the card is allowed to rank and compare — but only across clients,
// inside the one window on screen. Nothing here compares against a previous
// period: no Sales Hub figure carries a comparison window, and a movement
// Birdy made up would be worse than none.
//
// Output is a list of parts rather than a string so the card can emphasise
// the figures and names inside a sentence. `strong: true` marks a part for
// that treatment.

import { groupHasCallCentre } from "./call-centre-availability";
import { sumCallStats, windowCallTotals } from "./saleshub-totals";

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n ?? 0).toLocaleString();
const pct = (n) => `${Math.round(n * 100)}%`;

/**
 * Build the card's copy for the period.
 *
 * @param {{calls, called, inbound, outbound, clients}} totals summed call stats
 * @returns {{text: string, strong: boolean}[]}
 */
export function buildSalesInsight(totals) {
  const t = totals ?? {};

  if (!t.calls) {
    return [
      plain(
        "No calls logged in this window yet. Once the dialler runs, this is where the period's figures will be summarised."
      ),
    ];
  }

  const parts = [
    plain("Your call centres placed "),
    strong(`${count(t.calls)} calls`),
    plain(" to "),
    strong(`${count(t.called)} leads`),
  ];

  // Only worth saying across a portfolio — scoped to one client it would read
  // as "across 1 client", which tells the reader nothing they can't see.
  if (t.clients > 1) {
    parts.push(plain(" across "), strong(`${count(t.clients)} clients`));
  }

  parts.push(plain(" this period: "), strong(`${count(t.outbound)} outbound`));

  // A pure-outbound portfolio should not get a clause about zero inbound.
  if (t.inbound > 0) {
    parts.push(plain(" and "), strong(`${count(t.inbound)} inbound`));
  }

  parts.push(plain("."));
  return parts;
}

// A client needs a pool this size before its reach rate means anything: at
// ten leads, one call moves it by ten points.
const REACH_MIN_LEADS = 50;
const REACH_WARN_BELOW = 0.25;
const TRANSFER_EXCESS_MULTIPLE = 1.25;
// Below this, inbound is a rounding error on an outbound operation and not
// worth a line; at or above it, the dialler is not the only thing ringing.
const INBOUND_NOTABLE_SHARE = 0.2;

/**
 * Seconds per call as a reader would say it: "38s", or "2m 05s" once it
 * crosses a minute. Talk time arrives in minutes; a 0.6-minute average is
 * not a figure anyone can picture.
 */
function perCallDuration(talkMinutes, calls) {
  const seconds = Math.round((talkMinutes * 60) / calls);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * One row per client in scope, from the same caches the overview table's
 * rows read (CallCentreContent's overviewRows), so a finding here names the
 * same figure the reader will find in the table below it.
 */
function clientRows(clientGroups, selectedClientGroup, datePreset) {
  const groups = clientGroups ?? [];
  const scoped =
    selectedClientGroup && selectedClientGroup !== "all"
      ? groups.filter((g) => g.id === selectedClientGroup)
      : groups;

  // A client with no call centre has none of these caches; it would land in
  // every ranking as a zero and be named as the worst performer for it.
  return scoped.filter(groupHasCallCentre).map((g) => {
    const hp = g.hotprospector ?? {};
    const daily = windowCallTotals(hp.daily_calls, datePreset);
    return {
      name: g.name || "Unnamed client",
      totalLeads: hp.metrics?.total_leads ?? 0,
      leadsCalled: hp.call_stats?.leads_with_calls ?? 0,
      calls: daily.calls,
    };
  });
}

/**
 * Up to three findings for the briefing, each only when the data in view
 * supports it. Nothing is said about a comparison the screen cannot show.
 *
 * @param {object[]} clientGroups every group on the page
 * @param {string} selectedClientGroup a group id, or "all"
 * @param {string} datePreset the hub's date window
 * @returns {{tone: string, parts: {text: string, strong: boolean}[]}[]}
 */
export function buildSalesFindings(clientGroups, selectedClientGroup = "all", datePreset) {
  const totals = sumCallStats(clientGroups, selectedClientGroup, datePreset);
  if (!totals.calls) return [];

  const rows = clientRows(clientGroups, selectedClientGroup, datePreset);
  const findings = [];

  // Reach: the client leaving the largest share of a real pool untouched.
  const reachable = rows
    .filter((r) => r.totalLeads >= REACH_MIN_LEADS)
    .map((r) => ({ ...r, reach: r.leadsCalled / r.totalLeads }))
    .sort((a, b) => a.reach - b.reach);
  const weakest = reachable[0];
  if (weakest && weakest.reach < REACH_WARN_BELOW) {
    findings.push({
      tone: "warning",
      parts: [
        strong(weakest.name),
        plain(" reached only "),
        strong(pct(weakest.reach)),
        plain(` of its ${count(weakest.totalLeads)} leads`),
        // "The lowest in view" is a ranking; with one client in view there is
        // nothing it was ranked against.
        plain(
          reachable.length > 1
            ? `: the lowest reach of the ${count(reachable.length)} clients with ${REACH_MIN_LEADS}+ leads.`
            : "."
        ),
      ],
    });
  }

  // Volume: who did the most dialling. Needs a second client with calls, or
  // "100% of the total" is a tautology dressed as a finding.
  const dialling = rows.filter((r) => r.calls > 0).sort((a, b) => b.calls - a.calls);
  if (dialling.length > 1) {
    const top = dialling[0];
    findings.push({
      tone: "success",
      parts: [
        strong(top.name),
        plain(" made the most calls this period: "),
        strong(count(top.calls)),
        plain(`, ${pct(top.calls / totals.calls)} of the total.`),
      ],
    });
  }

  // Shape: one line on the mix of the calls themselves, in order of how much
  // it should worry the reader. A transfer count above the call count is
  // Hot Prospector counting every leg of a call as a transfer, and the fix is
  // in its settings rather than on the floor.
  // Transfers come from a preset cache that can run a day behind the daily
  // series the calls are summed from, so a whisker over is not a finding —
  // it has to be clear of that drift.
  if (totals.transfers > totals.calls * TRANSFER_EXCESS_MULTIPLE) {
    findings.push({
      tone: "info",
      parts: [
        plain("Transfers ("),
        strong(count(totals.transfers)),
        plain(") outnumber calls, so check the Hot Prospector transfer rule."),
      ],
    });
  } else if (totals.inbound / totals.calls >= INBOUND_NOTABLE_SHARE) {
    findings.push({
      tone: "info",
      parts: [plain("Inbound is "), strong(pct(totals.inbound / totals.calls)), plain(" of all calls.")],
    });
  } else {
    findings.push({
      tone: "neutral",
      parts: [
        plain("Average talk time is "),
        strong(perCallDuration(totals.talk, totals.calls)),
        plain(" per call."),
      ],
    });
  }

  return findings.slice(0, 3);
}

/** The question the card's footer link hands to the assistant. */
export function insightPrompt(parts) {
  return `About my Sales Hub this period: ${parts.map((p) => p.text).join("")} What should I do about it?`;
}

// The copy in the Birdy Insights card.
//
// This states the window's figures and nothing else. The design asks the card
// to name the biggest movement and then the most actionable anomaly, both of
// which mean deriving claims — a period-over-period comparison, and a ranking
// across clients. Neither is drawn here: the card reports the same numbers the
// tiles beside it report, summed from what the API returned.
//
// Output is a list of parts rather than a string so the card can render the
// figures in white against the body's 88% white, the way the design draws them.
// `strong: true` marks a part for that treatment.

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n ?? 0).toLocaleString();

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

/** The question the card's footer link hands to the assistant. */
export function insightPrompt(parts) {
  return `About my Sales Hub this period: ${parts.map((p) => p.text).join("")} What should I do about it?`;
}

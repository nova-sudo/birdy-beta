// The copy in the Birdy Insights card, generated from the period's own figures.
//
// The design is explicit that this is not static text: "name the biggest
// movement, then the single most actionable anomaly". It is also the product's
// voice — direct and operational, one sentence, with the numbers in it.
//
// Output is a list of parts rather than a string so the card can render figures
// and client names in white against the body's 88% white, the way the design
// draws them. `strong: true` marks a part for that treatment.
//
// What counts as the anomaly here is the largest *untouched pool*: the client
// with the most leads nobody has dialled. It is the one number on this screen
// that names a specific thing to go and do, and unlike a movement it needs no
// previous period to compute — so it survives on the windows that have no
// comparable predecessor, which is most of them.

const plain = (text) => ({ text, strong: false });
const strong = (text) => ({ text, strong: true });

const count = (n) => Math.round(n).toLocaleString();
const pct = (n) => `${Math.round(n * 10) / 10}%`;

/**
 * The client with the most leads never dialled.
 *
 * Ranked by the size of the untouched pool rather than by the ratio, because a
 * client sitting on 228 uncalled leads is a bigger miss than one sitting on 9,
 * even where the second has called a smaller share. Clients with no leads at
 * all are skipped — nothing to act on.
 *
 * @param {{name: string, total_leads: number, leads: number}[]} rows
 */
export function biggestUntouchedPool(rows) {
  return (rows ?? [])
    .filter((r) => (r.total_leads ?? 0) > 0)
    .map((r) => ({
      name: r.name,
      total: r.total_leads ?? 0,
      called: r.leads ?? 0,
      untouched: Math.max(0, (r.total_leads ?? 0) - (r.leads ?? 0)),
    }))
    .sort((a, b) => b.untouched - a.untouched)[0];
}

/**
 * Build the card's copy for the period.
 *
 * @param {{calls: number, called: number, inbound: number, talk: number}} totals
 * @param {object[]} rows one per client, as the Overview table shapes them
 * @returns {{text: string, strong: boolean}[]}
 */
export function buildSalesInsight(totals, rows) {
  const t = totals ?? { calls: 0, called: 0, inbound: 0 };

  if (!t.calls) {
    return [
      plain(
        "No calls logged in this window yet. Once the dialler runs, this is where the movement worth acting on will be called out."
      ),
    ];
  }

  const parts = [
    plain("Your call centres placed "),
    strong(`${count(t.calls)} calls`),
    plain(" to "),
    strong(`${count(t.called)} leads`),
    plain(" this period"),
  ];

  // Inbound share is worth a clause only when there is one — a portfolio doing
  // pure outbound should not get a sentence about 0%.
  if (t.inbound > 0) {
    parts.push(plain(", with "), strong(pct((t.inbound / t.calls) * 100)), plain(" coming inbound"));
  }
  parts.push(plain("."));

  const worst = biggestUntouchedPool(rows);
  // Only worth naming when the pool is actually mostly untouched. A client
  // who has been called 300 of 320 times is not the story.
  if (worst && worst.untouched > 0 && worst.called / worst.total < 0.5) {
    parts.push(
      plain(" "),
      strong(worst.name),
      plain(" has called only "),
      strong(count(worst.called)),
      plain(" of "),
      strong(count(worst.total)),
      plain(" leads — the biggest untouched pool in the portfolio.")
    );
  }

  return parts;
}

/** The question the card's footer link hands to the assistant. */
export function insightPrompt(parts) {
  return `About my Sales Hub this period: ${parts.map((p) => p.text).join("")} What should I do about it?`;
}

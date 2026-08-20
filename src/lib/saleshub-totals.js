// The Sales Hub's figures, summed straight from the client groups already on
// the page.
//
// These are the windowed call stats the backend computed for the selected date
// preset — /api/client-groups serves them, and useClientGroups has them by the
// time this screen renders. Nothing here fetches, scales, estimates or compares
// against another window: each figure is the sum of what the API returned, and
// that is what the tiles show.

/** Sums the windowed call stats across whichever clients are in scope. */
export function sumCallStats(clientGroups, selectedClientGroup) {
  const scoped =
    selectedClientGroup && selectedClientGroup !== "all"
      ? (clientGroups ?? []).filter((g) => g.id === selectedClientGroup)
      : (clientGroups ?? []);

  return scoped.reduce(
    (acc, g) => {
      const cs = g.hotprospector?.call_stats ?? {};
      return {
        clients: acc.clients + ((cs.total_calls ?? 0) > 0 ? 1 : 0),
        called: acc.called + (cs.leads_with_calls ?? 0),
        calls: acc.calls + (cs.total_calls ?? 0),
        inbound: acc.inbound + (cs.inbound_count ?? 0),
        outbound: acc.outbound + (cs.outbound_count ?? 0),
        transfers: acc.transfers + (cs.transfers ?? 0),
        talk: acc.talk + (cs.total_talk_min ?? 0),
      };
    },
    { clients: 0, called: 0, calls: 0, inbound: 0, outbound: 0, transfers: 0, talk: 0 }
  );
}

/**
 * Merges each scoped client's daily call series (`hotprospector.daily_calls`)
 * into one, summed by date — the trend chart's input. Same scoping and same
 * "sum what the API already sent" rule as sumCallStats, just per-day instead
 * of per-window.
 */
export function mergeDailyCalls(clientGroups, selectedClientGroup) {
  const scoped =
    selectedClientGroup && selectedClientGroup !== "all"
      ? (clientGroups ?? []).filter((g) => g.id === selectedClientGroup)
      : (clientGroups ?? []);

  const byDate = new Map();
  for (const g of scoped) {
    for (const row of g.hotprospector?.daily_calls ?? []) {
      if (!row?.date) continue;
      const acc = byDate.get(row.date) ?? { date: row.date, calls: 0, inbound: 0, talk_min: 0, called: 0 };
      acc.calls += row.calls ?? 0;
      acc.inbound += row.inbound ?? 0;
      acc.talk_min += row.talk_min ?? 0;
      acc.called += row.called ?? 0;
      byDate.set(row.date, acc);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Talk time reads as minutes and keeps its decimal; everything else is a count. */
const formatTalk = (v) => (Math.round(v * 10) / 10).toLocaleString();
const formatCount = (v) => Math.round(v).toLocaleString();

const FORMAT = { talk: formatTalk };

/**
 * Render a figure the way its metric is read. Talk time keeps a decimal — the
 * table has always shown 251.7 rather than 252, and the tile above it should
 * agree.
 */
export function formatTotal(key, value) {
  return (FORMAT[key] ?? formatCount)(value);
}

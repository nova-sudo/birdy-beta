import { presetToDateRange } from "./date-utils";

// The Sales Hub's figures, summed straight from the client groups already on
// the page. Nothing here fetches — each figure is a sum of what
// /api/client-groups already returned, the way it returned it.
//
// Two different caches feed these numbers, and which one a figure comes from
// is deliberate, not incidental:
//
//   calls / inbound / outbound / talk  <- hotprospector.daily_calls, the same
//     per-day series the trend chart sums. hotprospector.call_stats (the
//     other, preset-scoped cache) only gets recomputed by the once-a-day
//     hp-tick cron per location, so it can run up to 24h stale against
//     whatever's actually in storage; the daily series is derived from
//     current storage on every refresh. Investigated 2026-08-20: re-deriving
//     it fresh didn't close the gap against call_stats, confirming this is a
//     cadence mismatch between the two caches rather than a rounding error —
//     summing the same source the chart draws keeps the tile and the curve
//     in agreement and gives both the fresher number.
//   called / transfers / clients  <- hotprospector.call_stats, unchanged.
//     "Leads called" here means "distinct leads with any call in the
//     window" — call_stats.leads_with_calls answers exactly that.
//     daily_calls.called answers a different question on purpose (see
//     mergeDailyCalls below); summing it here would just be a smaller,
//     more confusing number for the same tile. "Transfers" is HP's own
//     upstream field, already 1:1 with total_calls on their side — no
//     version of it lives in daily_calls to switch to anyway.

function scopedGroups(clientGroups, selectedClientGroup) {
  return selectedClientGroup && selectedClientGroup !== "all"
    ? (clientGroups ?? []).filter((g) => g.id === selectedClientGroup)
    : (clientGroups ?? []);
}

/**
 * Sums a client's (or several, already-merged) daily rows down to one
 * window's calls/inbound/outbound/talk — the shared slice-and-sum both
 * sumCallStats (portfolio-wide) and CallCentreContent's Overview rows
 * (per-client) do against the same daily_calls series.
 */
export function windowCallTotals(dailyRows, datePreset) {
  const { start_date, end_date } = presetToDateRange(datePreset);
  const rows = (dailyRows ?? []).filter(
    (d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date)
  );
  const calls = rows.reduce((sum, d) => sum + (d.calls ?? 0), 0);
  const inbound = rows.reduce((sum, d) => sum + (d.inbound ?? 0), 0);
  const talk = rows.reduce((sum, d) => sum + (d.talk_min ?? 0), 0);
  return { calls, inbound, outbound: calls - inbound, talk };
}

/** Sums the call stats across whichever clients are in scope, for the tiles and the insight card. */
export function sumCallStats(clientGroups, selectedClientGroup, datePreset) {
  const scoped = scopedGroups(clientGroups, selectedClientGroup);

  const windowed = scoped.reduce(
    (acc, g) => {
      const cs = g.hotprospector?.call_stats ?? {};
      return {
        clients: acc.clients + ((cs.total_calls ?? 0) > 0 ? 1 : 0),
        called: acc.called + (cs.leads_with_calls ?? 0),
        transfers: acc.transfers + (cs.transfers ?? 0),
      };
    },
    { clients: 0, called: 0, transfers: 0 }
  );

  const daily = windowCallTotals(mergeDailyCalls(clientGroups, selectedClientGroup), datePreset);

  return { ...windowed, ...daily };
}

/**
 * Merges each scoped client's daily call series (`hotprospector.daily_calls`)
 * into one, summed by date — the trend chart's input, and sumCallStats' for
 * calls/inbound/outbound/talk above.
 *
 * `called` here is a lifetime cohort (see hp_service.py's
 * _compute_daily_call_series): each lead counted once, on the day of their
 * first-ever call. sumCallStats deliberately does not sum this field for the
 * "Leads called" tile — see the file header.
 */
export function mergeDailyCalls(clientGroups, selectedClientGroup) {
  const scoped = scopedGroups(clientGroups, selectedClientGroup);

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

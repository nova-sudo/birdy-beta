import { presetToDateRange } from "./date-utils";

// The Lead Hub's figures, summed from each client group's precomputed daily
// lead series (`gohighlevel.daily_leads`, written server-side by
// birdy-backend's services/ghl_daily_leads.py) rather than fetched fresh.
//
// This mirrors Sales-Hub's own resolution of the same tradeoff (see
// saleshub-totals.js's file header): /api/leads/unified's meta.stats is the
// freshest source (a live aggregation on every request), but it has no time
// dimension, so the trend chart can only ever be built from the cached daily
// series. Rather than have the tiles and the chart disagree — one live, one
// cached — both are summed from the same cached series here, the way
// Sales-Hub moved calls/inbound/outbound/talk onto daily_calls once that
// series existed. The upside this buys back: a previous-period window is
// just a second filter over data already on the page, so the KPI tiles get
// real deltas with no second API call.
//
// `open`/`won`/`lost`/`abandoned` count one opportunity per lead-type contact
// added that day (unwound, so a contact with two opportunities counts
// twice) — the same rule get_unified_leads' opp_pipeline uses, kept in
// agreement on purpose (see ghl_daily_leads.py's docstring).

function scopedGroups(clientGroups, selectedClientGroup) {
  return selectedClientGroup && selectedClientGroup !== "all"
    ? (clientGroups ?? []).filter((g) => g.id === selectedClientGroup)
    : (clientGroups ?? []);
}

/** Merges each scoped client's daily lead series into one, summed by date — the trend chart's input, and sumLeadStats' below. */
export function mergeDailyLeads(clientGroups, selectedClientGroup) {
  const scoped = scopedGroups(clientGroups, selectedClientGroup);

  const byDate = new Map();
  for (const g of scoped) {
    for (const row of g.gohighlevel?.daily_leads ?? []) {
      if (!row?.date) continue;
      const acc = byDate.get(row.date) ?? {
        date: row.date,
        new_leads: 0,
        new_contacts: 0,
        open: 0,
        won: 0,
        lost: 0,
        abandoned: 0,
      };
      acc.new_leads += row.new_leads ?? 0;
      acc.new_contacts += row.new_contacts ?? 0;
      acc.open += row.open ?? 0;
      acc.won += row.won ?? 0;
      acc.lost += row.lost ?? 0;
      acc.abandoned += row.abandoned ?? 0;
      byDate.set(row.date, acc);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function sumWindow(dailyRows, startDate, endDate) {
  const rows = (dailyRows ?? []).filter(
    (d) => (!startDate || d.date >= startDate) && (!endDate || d.date <= endDate)
  );

  const sums = rows.reduce(
    (acc, d) => ({
      lead_count: acc.lead_count + (d.new_leads ?? 0),
      contact_count: acc.contact_count + (d.new_contacts ?? 0),
      open: acc.open + (d.open ?? 0),
      won: acc.won + (d.won ?? 0),
      lost: acc.lost + (d.lost ?? 0),
      abandoned: acc.abandoned + (d.abandoned ?? 0),
    }),
    { lead_count: 0, contact_count: 0, open: 0, won: 0, lost: 0, abandoned: 0 }
  );

  const total_opportunities = sums.won + sums.lost + sums.open + sums.abandoned;
  const conversion_rate = total_opportunities > 0 ? (sums.won / total_opportunities) * 100 : 0;

  return { ...sums, total_opportunities, conversion_rate };
}

/** Sums the merged daily series into the selected preset's window. */
export function windowLeadTotals(dailyRows, datePreset) {
  const { start_date, end_date } = presetToDateRange(datePreset);
  return sumWindow(dailyRows, start_date, end_date);
}

/**
 * The equal-length window immediately preceding `datePreset`'s own window —
 * generalises Portfolio Dashboard's PREVIOUS_PERIOD preset-pair table
 * (portfolio-series.js) to any preset. That table exists because
 * /api/client-groups only speaks in presets; here the window is just a date
 * filter applied to already-loaded rows, so there's no need to express the
 * previous period as a preset at all — shift the same start/end back by
 * their own span.
 *
 * Returns null for "maximum" — there is no period before all-time.
 */
export function previousWindow(datePreset) {
  if (datePreset === "maximum") return null;

  const { start_date, end_date } = presetToDateRange(datePreset);
  if (!start_date) return null;

  const start = new Date(`${start_date}T00:00:00Z`);
  const end = new Date(`${end_date ?? start_date}T00:00:00Z`);
  const spanDays = Math.round((end - start) / 86_400_000) + 1; // inclusive

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (spanDays - 1));

  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start_date: fmt(prevStart), end_date: fmt(prevEnd) };
}

/** The previous window's totals, for the KPI tiles' delta pills — null when there is no previous window. */
export function previousLeadTotals(dailyRows, datePreset) {
  const prev = previousWindow(datePreset);
  return prev ? sumWindow(dailyRows, prev.start_date, prev.end_date) : null;
}

/** Conversion rate keeps one decimal and a "%" suffix; everything else is a plain count. */
export function formatStat(key, value) {
  if (key === "conversion_rate") return `${(value ?? 0).toFixed(1)}%`;
  return Math.round(value ?? 0).toLocaleString();
}

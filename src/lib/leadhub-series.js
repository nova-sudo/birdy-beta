// The Lead Hub trend chart's four series, from each client's precomputed
// daily lead series (`gohighlevel.daily_leads`, written server-side by
// birdy-backend's services/ghl_daily_leads.py). One row per day already
// carries every metric this chart plots — see leadhub-totals.js for why the
// KPI tiles are summed from the same rows.
//
// Reuses Sales-Hub's bucketing (portfolio-series.js's bucketSeries) and its
// granularity choice (saleshub-series.js's granularityForRange) — both are
// generic over "timestamped rows, bucketed by day/week/month", not specific
// to calls.

import { bucketSeries } from "./portfolio-series";

export { granularityForRange } from "./saleshub-series";

/**
 * Build all four series for the window.
 *
 * @param {object[]} dailyRows [{date, new_leads, new_contacts, open, won, lost, abandoned}, ...]
 * @param {string} granularity Daily | Weekly | Monthly
 */
export function buildLeadSeries(dailyRows, granularity) {
  const rows = dailyRows ?? [];
  const on = (weight) => bucketSeries(rows, (d) => d.date, granularity, weight);

  const leads = on((d) => d.new_leads ?? 0);
  const contacts = on((d) => d.new_contacts ?? 0);
  const open = on((d) => d.open ?? 0);
  const won = on((d) => d.won ?? 0);
  const lost = on((d) => d.lost ?? 0);
  const abandoned = on((d) => d.abandoned ?? 0);

  // Conversion rate per bucket: won / (won+open+lost+abandoned) among that
  // bucket's leads — the same formula leadhub-totals.js's windowLeadTotals
  // (and, upstream of that, get_unified_leads' meta.stats.conversion_rate)
  // uses for the window as a whole, just re-run per bucket. Buckets with no
  // opportunities yet read as 0% rather than dividing by zero.
  const conversion = {
    ...won,
    values: won.values.map((w, i) => {
      const denom = w + open.values[i] + lost.values[i] + abandoned.values[i];
      return denom > 0 ? (w / denom) * 100 : 0;
    }),
  };

  return { leads, contacts, open, conversion };
}

/** Title, subtitle and tab label for each metric, in the design's order. */
export const LEAD_CHART_METRICS = [
  {
    key: "leads",
    tab: "Leads",
    title: "Total leads",
    subtitle: "Lead volume across all client groups",
  },
  {
    key: "contacts",
    tab: "Contacts",
    title: "Total contacts",
    subtitle: "Contacts captured without a lead form",
  },
  {
    key: "open",
    tab: "Open",
    title: "Open leads",
    subtitle: "Leads still in an open opportunity stage",
  },
  {
    key: "conversion",
    tab: "Conversion",
    title: "Conversion rate",
    subtitle: "Share of leads converting to a won opportunity",
  },
];
